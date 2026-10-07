using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Changshan.Foundation
{
  public sealed class FoundationSmoke : MonoBehaviour
  {
    // The active URP asset's render scale (0 without URP), for recordings that log their viewport.
    public static float CurrentRenderScale()
    {
      var pipeline = UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline as UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset;
      return pipeline == null ? 0 : pipeline.renderScale;
    }

    [Serializable]
    public sealed class RuntimeReport
    {
      public string runId, unityVersion, graphicsApi, pipeline, colorSpace, screenshot;
      public int width, height, targetFrameRate, vSyncCount, frameCount, errorCount, pendingCaptureGates;
      public float renderScale;
      public bool batchMode, focused;
    }

    private string runId = "manual";
    private int errors;

    private void Awake()
    {
      Application.targetFrameRate = FoundationContract.FrameRate;
      QualitySettings.vSyncCount = FoundationContract.VSync;
      Application.logMessageReceived += CountErrors;
    }

    private void OnDestroy() { Application.logMessageReceived -= CountErrors; }
    private void CountErrors(string message, string stack, LogType type)
    {
      if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert) errors++;
    }

    private IEnumerator Start()
    {
      // Capture is Player-only. Editor Play Mode tests also receive -e02Output and must not write or quit.
      if (Application.isEditor) yield break;
      string output = Argument("-e02Output");
      if (string.IsNullOrEmpty(output)) yield break;
      runId = Argument("-e02RunId");
      if (!Guid.TryParse(runId, out _) || !Directory.Exists(output))
      {
        Debug.LogError("E02 requires an existing fresh output directory and UUID runId");
        Application.Quit(2);
        yield break;
      }
      string image = Path.Combine(output, "scene.png");
      string reportPath = Path.Combine(output, "runtime.json");
      if (File.Exists(image) || File.Exists(reportPath))
      {
        Debug.LogError("E02 output already exists; refusing overwrite");
        Application.Quit(2);
        yield break;
      }
      for (int i = 0; i < 120; i++) yield return null;
      float gateDeadline = Time.realtimeSinceStartup + 20;
      while (CaptureGate.Pending > 0 && Time.realtimeSinceStartup < gateDeadline) yield return null;
      yield return new WaitForEndOfFrame();
      ScreenCapture.CaptureScreenshot(image);
      float deadline = Time.realtimeSinceStartup + 15;
      while ((!File.Exists(image) || new FileInfo(image).Length == 0) && Time.realtimeSinceStartup < deadline)
        yield return null;
      // Give asynchronous capture an additional presented frame before writing the report.
      yield return null;
      var pipeline = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
      var report = new RuntimeReport {
        runId = runId, unityVersion = Application.unityVersion,
        graphicsApi = SystemInfo.graphicsDeviceType.ToString(), pipeline = pipeline == null ? "MISSING" : pipeline.GetType().Name,
        colorSpace = QualitySettings.activeColorSpace.ToString(), width = Screen.width, height = Screen.height,
        targetFrameRate = Application.targetFrameRate, vSyncCount = QualitySettings.vSyncCount,
        renderScale = pipeline == null ? 0 : pipeline.renderScale,
        frameCount = Time.frameCount, errorCount = errors, pendingCaptureGates = CaptureGate.Pending,
        batchMode = Application.isBatchMode, focused = Application.isFocused, screenshot = image
      };
      File.WriteAllText(reportPath, JsonUtility.ToJson(report, true));
      bool passed = pipeline != null && report.width == FoundationContract.Width && report.height == FoundationContract.Height &&
        report.graphicsApi == "Direct3D11" && report.colorSpace == "Linear" && report.renderScale == 1 &&
        report.errorCount == 0 && report.pendingCaptureGates == 0 && File.Exists(image) && new FileInfo(image).Length > 0;
      Application.Quit(passed ? 0 : 2);
    }

    private static string Argument(string name)
    {
      var args = Environment.GetCommandLineArgs();
      int i = Array.IndexOf(args, name);
      return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    private void OnGUI()
    {
      var style = new GUIStyle(GUI.skin.label) { fontSize = 28, wordWrap = true };
      GUI.Box(new Rect(50, 50, 1000, 240), "");
      GUI.Label(new Rect(75, 70, 950, 220),
        "Changshan Longdan / E02 engine foundation\n" +
        "Validation scene - Zhao Yun (E03), input and moves (E04), hits on training dummies (E05)\n" +
        Application.unityVersion + " / " + SystemInfo.graphicsDeviceType + " / " + Screen.width + " x " + Screen.height +
        "\nRun: " + runId, style);
    }
  }
}
