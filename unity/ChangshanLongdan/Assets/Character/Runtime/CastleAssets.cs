using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Changshan.Combat;
using Changshan.View;
using GLTFast;
using GLTFast.Logging;
using UnityEngine;
using Rect = Changshan.Combat.Rect;

namespace Changshan.Character
{
  public enum CastleAssetStatus { NotStarted, Loading, Ready, Failed }

  // E10: the first delivered environment assets (delivery cl-barracks-set-v1-d1: barracks with a separate roof node,
  // brazier, burning wreck) loaded at runtime with glTFast from StreamingAssets/Environment, checked against the lock
  // file's hashes, and instanced over the shared layout: six barracks (west ones turned to face the castle), sixteen
  // braziers, two wrecks. While loading, and whenever anything fails, the E09 placeholder blocks stay visible; only a
  // complete, verified load hides the blocks it replaces. Collision is untouched (the logic arena).
  public sealed class CastleAssets : MonoBehaviour
  {
    public const string Folder = "Environment";
    public const string BarracksNode = "barracks-body", RoofNode = "barracks-roof";

    public static readonly IReadOnlyList<(string Id, string Sha256, long Bytes)> Delivery = new[]
    {
      ("cl-barracks", "9431e8c367c55afe0b6d1876b1dec75923a6ff79540419b90f63434321a9142f", 25292L),
      ("cl-brazier", "a31c49de3412e5654f860c959111b82ae25511704d57d06c2c353cc434d91daf", 4396L),
      ("cl-wreck", "467f40473bbe7f5ed584eface2fea9d919e09c7c9b75e0ab7c963ee6dd5eebe0", 18496L),
    };

    public CastleAssetStatus Status { get; private set; }
    public string FailureCode { get; private set; } = "";
    public string FailureDetail { get; private set; } = "";
    public IReadOnlyList<GameObject> Barracks => barracks;
    public IReadOnlyList<GameObject> Roofs => roofs;
    public IReadOnlyList<GameObject> Braziers => braziers;
    public IReadOnlyList<GameObject> Wrecks => wrecks;
    public CastlePlaceholders Placeholders { get; private set; }

    readonly List<GameObject> barracks = new List<GameObject>(), roofs = new List<GameObject>(), braziers = new List<GameObject>(), wrecks = new List<GameObject>();
    readonly List<GltfImport> imports = new List<GltfImport>();
    readonly CancellationTokenSource lifetime = new CancellationTokenSource();
    LogicDisplayMapping mapping;
    string folder;

    // folder: the directory holding the GLBs (default StreamingAssets/Environment; tests pass another to fail on purpose).
    public static CastleAssets Create(LogicDisplayMapping mapping, CastlePlaceholders placeholders, string folder = null)
    {
      var go = new GameObject("E10 Castle Assets");
      var assets = go.AddComponent<CastleAssets>();
      assets.mapping = mapping;
      assets.Placeholders = placeholders;
      assets.folder = folder ?? Path.Combine(Application.streamingAssetsPath, Folder);
      _ = assets.LoadAll();
      return assets;
    }

    public Task Loading { get; private set; } = Task.CompletedTask;

    async Task LoadAll()
    {
      Status = CastleAssetStatus.Loading;
      var task = LoadAllInner();
      Loading = task;
      await task;
    }

    async Task LoadAllInner()
    {
      var templates = new Dictionary<string, GameObject>();
      try
      {
        foreach (var (id, sha, bytes) in Delivery)
        {
          var template = await LoadTemplate(id, sha, bytes);
          if (template == null) return; // Fail already recorded
          templates[id] = template;
        }
        if (this == null || lifetime.IsCancellationRequested) return;
        Place(templates);
        Status = CastleAssetStatus.Ready;
        if (Placeholders != null) Placeholders.AttachAssets(this);
      }
      catch (OperationCanceledException) { }
      catch (Exception exception)
      {
        Fail("UNEXPECTED_EXCEPTION", exception.GetType().Name + ": " + exception.Message);
      }
    }

    async Task<GameObject> LoadTemplate(string id, string expectedSha, long expectedBytes)
    {
      string path = Path.Combine(folder, id + ".glb");
      if (!File.Exists(path)) { Fail("FILE_MISSING", "no file at " + path); return null; }
      byte[] bytes = File.ReadAllBytes(path);
      string sha = Sha256(bytes);
      if (bytes.LongLength != expectedBytes || sha != expectedSha) { Fail("HASH_MISMATCH", $"{id}.glb {bytes.LongLength} bytes {sha}"); return null; }
      var logger = new CollectingLogger();
      var import = new GltfImport(logger: logger);
      bool decoded;
      try { decoded = await import.Load(bytes, new Uri(Path.GetFullPath(path)), null, lifetime.Token); }
      catch (Exception exception) when (!(exception is OperationCanceledException))
      {
        decoded = false;
        logger.Error(exception.GetType().Name + ": " + exception.Message);
      }
      if (!decoded || Errors(logger) > 0) { Fail("DECODE_FAILED", id + ": " + Summary(logger)); import.Dispose(); return null; }
      var container = new GameObject(id + " template");
      container.SetActive(false);
      container.transform.SetParent(transform, false);
      bool instantiated = await import.InstantiateMainSceneAsync(container.transform, lifetime.Token);
      if (!instantiated || Errors(logger) > 0) { Fail("INSTANTIATE_FAILED", id + ": " + Summary(logger)); import.Dispose(); Destroy(container); return null; }
      imports.Add(import);
      return container;
    }

    void Place(Dictionary<string, GameObject> templates)
    {
      var barracksTemplate = templates["cl-barracks"];
      if (FindNode(barracksTemplate, RoofNode) == null || FindNode(barracksTemplate, BarracksNode) == null)
      {
        Fail("NODES_MISSING", "cl-barracks lacks " + BarracksNode + " / " + RoofNode);
        return;
      }
      var list = CastleGeometry.Barracks;
      for (int i = 0; i < list.Count; i++)
      {
        var r = list[i];
        // The delivery's door is on the low-X side; the west barracks (minX < 0) face the castle with their high-X side.
        double facing = r.MinX > 0 ? 0 : Math.PI;
        var instance = Instance(barracksTemplate, $"Barracks {i}", (r.MinX + r.MaxX) / 2, (r.MinZ + r.MaxZ) / 2, facing);
        barracks.Add(instance);
        roofs.Add(FindNode(instance, RoofNode));
      }
      foreach (var (x, z) in CastleGeometry.Braziers) braziers.Add(Instance(templates["cl-brazier"], "Brazier", x, z, 0));
      foreach (var w in CastleGeometry.Wrecks) wrecks.Add(Instance(templates["cl-wreck"], "Wreck", (w.MinX + w.MaxX) / 2, (w.MinZ + w.MaxZ) / 2, 0));
    }

    GameObject Instance(GameObject template, string name, double x, double z, double facing)
    {
      var instance = Instantiate(template, transform);
      instance.name = name;
      instance.transform.SetPositionAndRotation(mapping.ToDisplayPosition(x, 0, z), mapping.ToDisplayRotation(facing));
      instance.SetActive(true);
      return instance;
    }

    public static GameObject FindNode(GameObject root, string name)
    {
      foreach (var t in root.GetComponentsInChildren<Transform>(true)) if (t.name == name) return t.gameObject;
      return null;
    }

    // Roof visibility from the cutaway (one flag per barracks, layout order).
    public void ShowRoofs(bool[] visible)
    {
      for (int i = 0; i < roofs.Count && i < visible.Length; i++)
        if (roofs[i] != null && roofs[i].activeSelf != visible[i]) roofs[i].SetActive(visible[i]);
    }

    void Fail(string code, string detail)
    {
      Status = CastleAssetStatus.Failed;
      FailureCode = code;
      FailureDetail = detail;
      Debug.LogError("CASTLE_ASSETS_" + code + " " + detail);
    }

    static int Errors(CollectingLogger logger)
    {
      int n = 0;
      if (logger.Items == null) return 0;
      foreach (var item in logger.Items) if (item.Type == LogType.Error || item.Type == LogType.Exception) n++;
      return n;
    }

    static string Summary(CollectingLogger logger)
    {
      if (logger.Items == null) return "";
      var parts = new List<string>();
      foreach (var item in logger.Items) if (item.Type == LogType.Error || item.Type == LogType.Exception) parts.Add(item.ToString());
      return string.Join("; ", parts);
    }

    static string Sha256(byte[] bytes)
    {
      using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
    }

    void OnDestroy()
    {
      lifetime.Cancel();
      foreach (var import in imports) import.Dispose();
      imports.Clear();
    }
  }
}
