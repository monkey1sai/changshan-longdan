using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Changshan.Character;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E10: the delivered environment GLBs match the lock file and the delivery manifest, carry the nodes the game
  // expects, and stay within the request's budgets (counted from the glTF accessors).
  public sealed class EnvironmentAssetEditTests
  {
    static string Root => CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
    static string Streaming => Path.Combine(Application.dataPath, "StreamingAssets", CastleAssets.Folder);

    static List<object> L(object o) => (List<object>)o;
    static Dictionary<string, object> O(object o) => (Dictionary<string, object>)o;

    static string Sha256(byte[] bytes)
    {
      using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
    }

    static Dictionary<string, object> Lock() => O(MiniJson.Parse(File.ReadAllText(Path.Combine(Root, "assets", "art-assets.lock.json"))));

    [Test] public void LockFileMatchesTheShippedFilesAndTheContract()
    {
      var entries = L(Lock()["assets"]).Select(O).ToList();
      Assert.That(entries.Select(e => (string)e["asset_id"]), Is.EquivalentTo(CastleAssets.Delivery.Select(d => d.Id)));
      foreach (var (id, sha, bytes) in CastleAssets.Delivery)
      {
        var entry = entries.Single(e => (string)e["asset_id"] == id);
        Assert.That((string)entry["sha256"], Is.EqualTo(sha), id + " lock vs contract");
        Assert.That((double)entry["bytes"], Is.EqualTo(bytes), id + " bytes");
        var file = File.ReadAllBytes(Path.Combine(Streaming, id + ".glb"));
        Assert.That(file.LongLength, Is.EqualTo(bytes), id + " shipped bytes");
        Assert.That(Sha256(file), Is.EqualTo(sha), id + " shipped hash");
        Assert.That((string)entry["delivery_id"], Is.EqualTo("cl-barracks-set-v1-d1"));
        Assert.That(File.Exists(Path.Combine(Root, "docs", "art", "deliveries", (string)entry["delivery_id"] + ".json")), Is.True, "delivery manifest kept in the game repo");
      }
    }

    [Test] public void DeliveryManifestAgreesWithTheLock()
    {
      var manifest = O(MiniJson.Parse(File.ReadAllText(Path.Combine(Root, "docs", "art", "deliveries", "cl-barracks-set-v1-d1.json"))));
      Assert.That((string)manifest["delivery_id"], Is.EqualTo("cl-barracks-set-v1-d1"));
      Assert.That((string)manifest["request_id"], Is.EqualTo("cl-barracks-set-v1"));
      var files = L(manifest["files"]).Select(O).Where(f => (string)f["purpose"] == "model").ToList();
      foreach (var (id, sha, bytes) in CastleAssets.Delivery)
      {
        var file = files.Single(f => ((string)f["path"]).EndsWith("/" + id + ".glb"));
        Assert.That((string)file["sha256"], Is.EqualTo(sha));
        Assert.That((double)file["bytes"], Is.EqualTo(bytes));
      }
      Assert.That(L(manifest["asset_id"]).Cast<string>(), Is.EquivalentTo(CastleAssets.Delivery.Select(d => d.Id)));
    }

    // The glTF JSON chunk: node names, triangle counts from the index accessors, materials, no images or required extensions.
    static (string[] Nodes, int Triangles, int Materials, int Images, int Required) Describe(string id)
    {
      var doc = O(MiniJson.Parse(GlbJson.Read(File.ReadAllBytes(Path.Combine(Streaming, id + ".glb")))));
      var accessors = L(doc["accessors"]).Select(O).ToList();
      var meshes = L(doc["meshes"]).Select(O).ToList();
      int triangles = 0;
      foreach (var mesh in meshes)
        foreach (var prim in L(mesh["primitives"]).Select(O))
          triangles += (int)(double)accessors[(int)(double)prim["indices"]]["count"] / 3;
      var nodes = L(doc["nodes"]).Select(O).Where(n => n.ContainsKey("mesh")).Select(n => (string)n["name"]).ToArray();
      int images = doc.TryGetValue("images", out var im) ? L(im).Count : 0;
      int required = doc.TryGetValue("extensionsRequired", out var ex) ? L(ex).Count : 0;
      return (nodes, triangles, L(doc["materials"]).Count, images, required);
    }

    [Test] public void BarracksHasSeparateBodyAndRoofNodesWithinBudget()
    {
      var (nodes, triangles, materials, images, required) = Describe("cl-barracks");
      Assert.That(nodes, Is.EquivalentTo(new[] { CastleAssets.BarracksNode, CastleAssets.RoofNode }));
      Assert.That(triangles, Is.EqualTo(360).And.LessThanOrEqualTo(6000));
      Assert.That(materials, Is.LessThanOrEqualTo(8));
      Assert.That(images, Is.Zero);
      Assert.That(required, Is.Zero);
    }

    [Test] public void PropsStayWithinBudgetAndCarryTheirEmissiveParts()
    {
      var brazier = Describe("cl-brazier");
      Assert.That(brazier.Nodes, Is.EquivalentTo(new[] { "brazier-body", "brazier-coals" }));
      Assert.That(brazier.Triangles, Is.EqualTo(36).And.LessThanOrEqualTo(600));
      var wreck = Describe("cl-wreck");
      Assert.That(wreck.Nodes, Is.EquivalentTo(new[] { "wreck-debris", "wreck-embers" }));
      Assert.That(wreck.Triangles, Is.EqualTo(288).And.LessThanOrEqualTo(900));
      Assert.That(brazier.Images + wreck.Images, Is.Zero);
      Assert.That(brazier.Materials, Is.LessThanOrEqualTo(8));
    }
  }
}
