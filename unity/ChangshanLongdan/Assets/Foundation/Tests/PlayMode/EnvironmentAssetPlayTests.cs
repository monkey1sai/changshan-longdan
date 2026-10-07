using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Character;
using Changshan.Combat;
using Changshan.View;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Object = UnityEngine.Object;

namespace Changshan.Foundation.Tests
{
  // E10 in the validation scene: the delivered GLBs load through glTFast, replace the placeholder blocks they cover,
  // sit on the layout rectangles at the delivered sizes, keep the roof cutaway working, and fall back to the blocks
  // when a file is missing or wrong.
  public sealed class EnvironmentAssetPlayTests
  {
    const double Dt = 1.0 / 60;

    sealed class ScriptedInput : IRawInputSource
    {
      public void Feed(InputMapper mapper) { }
    }

    static IEnumerator Scene(System.Action<ZhaoYunController, GameFlow> ready)
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      yield return null;
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      controller.enabled = false;
      controller.InputSource = new ScriptedInput();
      var flow = GameFlow.Attach(controller);
      controller.SetFocus(true);
      ready(controller, flow);
    }

    static IEnumerator WaitForAssets(CastleAssets assets, float seconds = 30)
    {
      float deadline = Time.realtimeSinceStartup + seconds;
      while (assets.Status == CastleAssetStatus.Loading || assets.Status == CastleAssetStatus.NotStarted)
      {
        if (Time.realtimeSinceStartup > deadline) break;
        yield return null;
      }
    }

    // World-space bounds (for placement) and bounds in the instance's own frame (for sizes: the whole castle is
    // turned by the scene's display yaw, so world AABBs of a rotated box are wider than the box).
    static Bounds BoundsOf(GameObject go)
    {
      var renderers = go.GetComponentsInChildren<Renderer>(true);
      var b = renderers[0].bounds;
      foreach (var r in renderers) b.Encapsulate(r.bounds);
      return b;
    }

    static Bounds LocalBoundsOf(GameObject part, Transform frame)
    {
      Bounds result = default;
      bool first = true;
      foreach (var filter in part.GetComponentsInChildren<MeshFilter>(true))
      {
        var mb = filter.sharedMesh.bounds;
        for (int corner = 0; corner < 8; corner++)
        {
          var local = new Vector3((corner & 1) == 0 ? mb.min.x : mb.max.x, (corner & 2) == 0 ? mb.min.y : mb.max.y, (corner & 4) == 0 ? mb.min.z : mb.max.z);
          var p = frame.InverseTransformPoint(filter.transform.TransformPoint(local));
          if (first) { result = new Bounds(p, Vector3.zero); first = false; } else result.Encapsulate(p);
        }
      }
      return result;
    }

    [UnityTest] public IEnumerator DeliveredAssetsReplaceTheBlocksOnTheLayout()
    {
      ZhaoYunController controller = null;
      GameFlow flow = null;
      yield return Scene((c, f) => { controller = c; flow = f; });
      var castle = controller.Castle;
      var assets = Object.FindObjectsByType<CastleAssets>().Single();
      yield return WaitForAssets(assets);
      Assert.That(assets.Status, Is.EqualTo(CastleAssetStatus.Ready), assets.FailureCode + " " + assets.FailureDetail);
      Assert.That(assets.Barracks.Count, Is.EqualTo(6));
      Assert.That(assets.Roofs.Count(r => r != null), Is.EqualTo(6));
      Assert.That(assets.Braziers.Count, Is.EqualTo(16));
      Assert.That(assets.Wrecks.Count, Is.EqualTo(2));
      Assert.That(castle.AssetsShown, Is.True);
      // The blocks the assets cover are hidden; the walls stay.
      Assert.That(castle.Roofs.All(r => !r.enabled), Is.True, "placeholder roof slabs hidden");
      Assert.That(castle.transform.Find("Wall N").GetComponent<MeshRenderer>().enabled, Is.True);
      Assert.That(castle.transform.Find("Barracks 0").GetComponent<MeshRenderer>().enabled, Is.False);
      // Sizes and placement: the barracks body and roof match the delivery on the first layout rectangle.
      var r0 = CastleGeometry.Barracks[0];
      var frame = assets.Barracks[0].transform;
      var bodyNode = CastleAssets.FindNode(assets.Barracks[0], CastleAssets.BarracksNode);
      var body = LocalBoundsOf(bodyNode, frame);
      Assert.That(body.size.y, Is.EqualTo(4.75f).Within(0.05f));
      Assert.That(body.size.z, Is.EqualTo(14.4f).Within(0.1f), "the long side runs along the asset's +Z");
      Assert.That(body.size.x, Is.EqualTo(12.4f).Within(0.1f));
      var centre = controller.Mapping.ToDisplayPosition((r0.MinX + r0.MaxX) / 2, 0, (r0.MinZ + r0.MaxZ) / 2);
      var bodyWorld = BoundsOf(bodyNode);
      Assert.That(Vector2.Distance(new Vector2(bodyWorld.center.x, bodyWorld.center.z), new Vector2(centre.x, centre.z)), Is.LessThan(0.05f));
      Assert.That(bodyWorld.min.y, Is.EqualTo(centre.y).Within(0.05f), "the body stands on the ground");
      var roof = LocalBoundsOf(assets.Roofs[0], frame);
      Assert.That(roof.size.z, Is.EqualTo(17.45f).Within(0.1f), "roof overhang 1.225 m beyond the 15 m side");
      Assert.That(roof.size.x, Is.EqualTo(15.45f).Within(0.1f));
      Assert.That(roof.max.y - body.min.y, Is.EqualTo(7.57f).Within(0.1f), "ridge height");
      // A brazier stands on its collision square; a wreck on its centre.
      var (bx, bz) = CastleGeometry.Braziers[0];
      var brazier = BoundsOf(assets.Braziers[0]);
      var bc = controller.Mapping.ToDisplayPosition(bx, 0, bz);
      Assert.That(Vector2.Distance(new Vector2(brazier.center.x, brazier.center.z), new Vector2(bc.x, bc.z)), Is.LessThan(0.05f));
      Assert.That(LocalBoundsOf(assets.Braziers[0], assets.Braziers[0].transform).size.x, Is.EqualTo(1.15f).Within(0.05f));
      // The roof cutaway now drives the asset roof node: stand under barracks 1's eave.
      flow.StartRequested();
      controller.Simulation.Player.Reset(39.55, 0, -System.Math.PI / 2);
      controller.CameraView.Snap(controller.Simulation.Player);
      for (int frame = 0; frame < 30; frame++) controller.Tick(Dt);
      Assert.That(assets.Roofs[1].activeSelf, Is.False, "the asset roof hides under the eave");
      Assert.That(assets.Roofs[0].activeSelf, Is.True);
      controller.Simulation.Player.Reset(30, 0, System.Math.PI / 2);
      for (int frame = 0; frame < 30; frame++) controller.Tick(Dt);
      Assert.That(assets.Roofs.All(r => r.activeSelf), Is.True);
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator MissingFileKeepsThePlaceholderBlocks()
    {
      ZhaoYunController controller = null;
      yield return Scene((c, f) => controller = c);
      var live = Object.FindObjectsByType<CastleAssets>().Single();
      yield return WaitForAssets(live);
      var mapping = controller.Mapping;
      var placeholders = CastlePlaceholders.Create(mapping, null);
      try
      {
        LogAssert.Expect(LogType.Error, new System.Text.RegularExpressions.Regex("CASTLE_ASSETS_FILE_MISSING"));
        var broken = CastleAssets.Create(mapping, placeholders, Path.Combine(Application.temporaryCachePath, "no-such-folder"));
        yield return WaitForAssets(broken, 10);
        Assert.That(broken.Status, Is.EqualTo(CastleAssetStatus.Failed));
        Assert.That(broken.FailureCode, Is.EqualTo("FILE_MISSING"));
        Assert.That(placeholders.AssetsShown, Is.False);
        Assert.That(placeholders.Roofs.All(r => r.enabled), Is.True, "blocks stay visible as the fallback");
        var flags = new bool[6];
        for (int i = 0; i < 6; i++) flags[i] = i != 2;
        placeholders.ShowRoofs(flags);
        Assert.That(placeholders.Roofs[2].enabled, Is.False, "the cutaway still drives the blocks");
        Object.Destroy(broken.gameObject);
      }
      finally
      {
        Object.Destroy(placeholders.gameObject);
      }
      yield return null;
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator TamperedFileIsRejected()
    {
      ZhaoYunController controller = null;
      yield return Scene((c, f) => controller = c);
      var live = Object.FindObjectsByType<CastleAssets>().Single();
      yield return WaitForAssets(live);
      string folder = Path.Combine(Application.temporaryCachePath, "e10-tampered");
      Directory.CreateDirectory(folder);
      foreach (var (id, _, _) in CastleAssets.Delivery)
      {
        var bytes = File.ReadAllBytes(Path.Combine(Application.streamingAssetsPath, CastleAssets.Folder, id + ".glb"));
        if (id == "cl-brazier") bytes[bytes.Length - 1] ^= 0x5a; // one flipped byte in the binary chunk
        File.WriteAllBytes(Path.Combine(folder, id + ".glb"), bytes);
      }
      var placeholders = CastlePlaceholders.Create(controller.Mapping, null);
      try
      {
        LogAssert.Expect(LogType.Error, new System.Text.RegularExpressions.Regex("CASTLE_ASSETS_HASH_MISMATCH"));
        var tampered = CastleAssets.Create(controller.Mapping, placeholders, folder);
        yield return WaitForAssets(tampered, 10);
        Assert.That(tampered.Status, Is.EqualTo(CastleAssetStatus.Failed));
        Assert.That(tampered.FailureCode, Is.EqualTo("HASH_MISMATCH"));
        Assert.That(tampered.Barracks.Count, Is.Zero, "nothing is placed from a partial set");
        Object.Destroy(tampered.gameObject);
      }
      finally
      {
        Object.Destroy(placeholders.gameObject);
        Directory.Delete(folder, true);
      }
      yield return null;
      LogAssert.NoUnexpectedReceived();
    }
  }
}
