using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Changshan.Foundation;
using GLTFast;
using GLTFast.Logging;
using UnityEngine;

namespace Changshan.Character
{
  public enum CharacterLoadStatus { NotStarted, Loading, Ready, Failed }

  // Loads the retained Zhao Yun GLB at runtime. The fallback stays the visible character until an import passes
  // ZhaoYunContract; a failed import is discarded and reported, never shown.
  [DisallowMultipleComponent]
  public sealed class ZhaoYunCharacter : MonoBehaviour
  {
    const string ModelName = "ZhaoYun Model";

    [SerializeField] GameObject fallback;
    [SerializeField] bool loadOnStart = true;

    readonly CancellationTokenSource lifetime = new CancellationTokenSource();
    GameObject model;
    GltfImport modelImport;
    int generation;
    int loadCount;
    bool holdingCapture;
    bool runReportWritten;

    public GameObject Fallback { get => fallback; set => fallback = value; }
    public bool LoadOnStart { get => loadOnStart; set => loadOnStart = value; }
    public GameObject Model => model;
    public CharacterLoadStatus Status { get; private set; }
    public CharacterImportReport Report { get; private set; } = new CharacterImportReport();

    void Awake()
    {
      SetFallbackVisible(true);
      if (!loadOnStart) return;
      CaptureGate.Hold();
      holdingCapture = true;
    }

    async void Start()
    {
      if (loadOnStart) await LoadFromStreamingAssets(ZhaoYunContract.StreamingAssetPath);
    }

    void OnDestroy()
    {
      lifetime.Cancel();
      ReleaseCapture();
      modelImport?.Dispose();
      modelImport = null;
    }

    public Task<bool> LoadFromStreamingAssets(string relativePath) =>
      Load(Path.Combine(Application.streamingAssetsPath, relativePath), null);

    public Task<bool> LoadFromBytes(byte[] bytes, string label) =>
      Load(label, bytes ?? throw new ArgumentNullException(nameof(bytes)));

    // A newer call supersedes an unfinished one; only the latest attempt changes Status and Report.
    async Task<bool> Load(string source, byte[] bytes)
    {
      int attempt = ++generation;
      var report = new CharacterImportReport { status = "LOADING", source = source, loadCount = ++loadCount };
      Report = report;
      Status = CharacterLoadStatus.Loading;
      float started = Time.realtimeSinceStartup;
      var logger = new CollectingLogger();
      GltfImport import = null;
      GameObject container = null;
      try
      {
        Uri uri = null;
        if (bytes == null)
        {
          if (!File.Exists(source)) return Fail(attempt, report, logger, started, "FILE_MISSING", "no file at " + source, null, null);
          bytes = File.ReadAllBytes(source);
          uri = new Uri(Path.GetFullPath(source));
        }
        report.sourceBytes = bytes.LongLength;
        report.sourceSha256 = Sha256(bytes);

        import = new GltfImport(logger: logger);
        bool decoded;
        try { decoded = await import.Load(bytes, uri, null, lifetime.Token); }
        catch (Exception exception) when (!(exception is OperationCanceledException))
        {
          decoded = false;
          logger.Error(exception.GetType().Name + ": " + exception.Message);
        }
        if (Abandoned(attempt)) return Discard(import, null);
        if (!decoded) return Fail(attempt, report, logger, started, "DECODE_FAILED", "glTFast rejected the data", import, null);

        // Instantiate hidden; the import becomes visible only after it passes the contract.
        container = new GameObject(ModelName);
        container.SetActive(false);
        container.transform.SetParent(transform, false);
        bool instantiated = await import.InstantiateMainSceneAsync(container.transform, lifetime.Token);
        if (Abandoned(attempt)) return Discard(import, container);
        if (!instantiated) return Fail(attempt, report, logger, started, "INSTANTIATE_FAILED", "glTFast could not instantiate the main scene", import, container);
        if (!CharacterImportValidator.Validate(container, report, out var code, out var detail))
          return Fail(attempt, report, logger, started, code, detail, import, container);

        Swap(container, import);
        report.status = "READY";
        report.readyFrame = Time.frameCount;
        Status = CharacterLoadStatus.Ready;
        Finish(report, logger, started);
        return true;
      }
      catch (OperationCanceledException)
      {
        return Discard(import, container);
      }
      catch (Exception exception)
      {
        return Fail(attempt, report, logger, started, "UNEXPECTED_EXCEPTION", exception.GetType().Name + ": " + exception.Message, import, container);
      }
    }

    bool Abandoned(int attempt) => this == null || lifetime.IsCancellationRequested || attempt != generation;

    static bool Discard(GltfImport import, GameObject container)
    {
      if (container) Destroy(container);
      import?.Dispose();
      return false;
    }

    bool Fail(int attempt, CharacterImportReport report, CollectingLogger logger, float started, string code, string detail,
      GltfImport import, GameObject container)
    {
      Discard(import, container);
      if (Abandoned(attempt)) return false;
      report.status = "FAILED";
      report.failureCode = code;
      report.failureDetail = detail;
      Status = CharacterLoadStatus.Failed;
      // A failed reload keeps the previous valid model; otherwise the fallback remains the visible character.
      if (model == null) SetFallbackVisible(true);
      Finish(report, logger, started);
      Debug.LogError($"CHARACTER_LOAD_FAILED {code}: {detail} [{report.source}]");
      return false;
    }

    void Swap(GameObject container, GltfImport import)
    {
      var previousModel = model;
      var previousImport = modelImport;
      model = container;
      modelImport = import;
      container.SetActive(true);
      SetFallbackVisible(false);
      if (previousModel)
      {
        previousModel.SetActive(false);
        Destroy(previousModel);
      }
      previousImport?.Dispose();
    }

    void Finish(CharacterImportReport report, CollectingLogger logger, float started)
    {
      report.loadSeconds = Time.realtimeSinceStartup - started;
      var items = logger.Items?.ToArray() ?? Array.Empty<LogItem>();
      report.gltfErrors = items.Count(item => item.Type == LogType.Error || item.Type == LogType.Exception || item.Type == LogType.Assert);
      report.gltfWarnings = items.Count(item => item.Type == LogType.Warning);
      report.gltfMessages = items.Select(item => item.ToString()).ToArray();
      report.fallbackVisible = fallback && fallback.activeInHierarchy;
      report.modelVisible = model && model.activeInHierarchy;
      WriteRunReport(report);
      ReleaseCapture();
    }

    // Player validation runs only: editor tests receive the same arguments and must not write into stage directories.
    void WriteRunReport(CharacterImportReport report)
    {
      if (runReportWritten || Application.isEditor || !loadOnStart) return;
      string output = Argument("-e02Output");
      string runId = Argument("-e02RunId");
      if (string.IsNullOrEmpty(output) || !Directory.Exists(output) || !Guid.TryParse(runId, out _)) return;
      runReportWritten = true;
      report.runId = runId;
      string path = Path.Combine(output, "character.json");
      if (File.Exists(path))
      {
        Debug.LogError("E03 character report already exists; refusing overwrite");
        return;
      }
      File.WriteAllText(path, JsonUtility.ToJson(report, true));
    }

    void ReleaseCapture()
    {
      if (!holdingCapture) return;
      holdingCapture = false;
      CaptureGate.Release();
    }

    void SetFallbackVisible(bool visible)
    {
      if (fallback) fallback.SetActive(visible);
    }

    static string Sha256(byte[] bytes)
    {
      using var sha = SHA256.Create();
      return string.Concat(sha.ComputeHash(bytes).Select(value => value.ToString("x2")));
    }

    static string Argument(string name)
    {
      var args = Environment.GetCommandLineArgs();
      int i = Array.IndexOf(args, name);
      return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }
  }
}
