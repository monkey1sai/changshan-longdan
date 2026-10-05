using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.PackageManager;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Changshan.Foundation.Editor
{
  public static class FoundationBuild
  {
    public const string ScenePath = "Assets/Foundation/Scenes/Foundation.unity";
    private const string PipelinePath = "Assets/Foundation/Settings/FoundationURP.asset";

    [Serializable] public sealed class PackageRecord { public string name, version, source, resolvedPath; }
    [Serializable] public sealed class Report
    {
      public string runId, unityVersion, revision, projectPath, stage, buildResult, graphicsApi, colorSpace, pipeline, backend;
      public int width, height, targetFrameRate, vSyncCount, buildErrors;
      public float renderScale;
      public ulong buildBytes;
      public PackageRecord[] packages;
    }

    public static void Configure()
    {
      RequireVersion();
      var target = NamedBuildTarget.Standalone;
      PlayerSettings.SetScriptingBackend(target, ScriptingImplementation.Mono2x);
      PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.StandaloneWindows64, false);
      PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneWindows64, new[] { GraphicsDeviceType.Direct3D11 });
      PlayerSettings.colorSpace = ColorSpace.Linear;
      PlayerSettings.defaultScreenWidth = FoundationContract.Width;
      PlayerSettings.defaultScreenHeight = FoundationContract.Height;
      PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
      PlayerSettings.resizableWindow = false;
      PlayerSettings.runInBackground = true;
      PlayerSettings.companyName = "ChangshanLongdan";
      PlayerSettings.productName = "ChangshanLongdan E02";
      QualitySettings.vSyncCount = FoundationContract.VSync;
      Application.targetFrameRate = FoundationContract.FrameRate;
      Directory.CreateDirectory("Assets/Foundation/Settings");
      var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath);
      if (pipeline == null)
      {
        var renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
        AssetDatabase.CreateAsset(renderer, "Assets/Foundation/Settings/FoundationRenderer.asset");
        pipeline = UniversalRenderPipelineAsset.Create(renderer);
        pipeline.renderScale = 1;
        AssetDatabase.CreateAsset(pipeline, PipelinePath);
      }
      GraphicsSettings.defaultRenderPipeline = pipeline;
      QualitySettings.renderPipeline = pipeline;
      if (!File.Exists(ScenePath))
      {
        Directory.CreateDirectory("Assets/Foundation/Scenes");
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var camera = new GameObject("Foundation Camera").AddComponent<Camera>();
        camera.tag = "MainCamera";
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0.035f, 0.065f, 0.12f);
        camera.gameObject.AddComponent<UniversalAdditionalCameraData>();
        new GameObject("Foundation Smoke").AddComponent<FoundationSmoke>();
        EditorSceneManager.SaveScene(scene, ScenePath);
      }
      Changshan.Character.Editor.CharacterSetup.Ensure(ScenePath);
      EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
      AssetDatabase.SaveAssets();
      WriteReport("compile", null);
    }

    public static void BuildWindows()
    {
      RequireVersion();
      Application.targetFrameRate = FoundationContract.FrameRate;
      string output = RequiredArgument("-e02Output");
      var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
        scenes = new[] { ScenePath }, target = BuildTarget.StandaloneWindows64,
        locationPathName = Path.Combine(output, "player", "ChangshanLongdan.exe"), options = BuildOptions.Development
      });
      WriteReport("build", report);
      if (report.summary.result != BuildResult.Succeeded || report.summary.totalErrors != 0)
        throw new InvalidOperationException("E02 Windows build failed: " + report.summary.result);
    }

    private static void RequireVersion()
    {
      if (Application.unityVersion != FoundationContract.EditorVersion || InternalEditorUtilityVersion() != "12bfff696524")
        throw new InvalidOperationException("E02 Editor version/revision mismatch");
    }

    private static string InternalEditorUtilityVersion() { return UnityEditorInternal.InternalEditorUtility.GetUnityBuildHash(); }

    private static void WriteReport(string stage, BuildReport build)
    {
      var pipeline = GraphicsSettings.defaultRenderPipeline as UniversalRenderPipelineAsset;
      var infos = UnityEditor.PackageManager.PackageInfo.GetAllRegisteredPackages();
      var packages = new PackageRecord[infos.Length];
      for (int i = 0; i < infos.Length; i++) packages[i] = new PackageRecord {
        name = infos[i].name, version = infos[i].version, source = infos[i].source.ToString(), resolvedPath = infos[i].resolvedPath
      };
      var apis = PlayerSettings.GetGraphicsAPIs(BuildTarget.StandaloneWindows64);
      var report = new Report {
        runId = RequiredArgument("-e02RunId"), unityVersion = Application.unityVersion, revision = InternalEditorUtilityVersion(),
        projectPath = Directory.GetCurrentDirectory(), stage = stage,
        backend = PlayerSettings.GetScriptingBackend(NamedBuildTarget.Standalone).ToString(),
        graphicsApi = apis.Length == 1 ? apis[0].ToString() : "UNEXPECTED", colorSpace = PlayerSettings.colorSpace.ToString(),
        width = PlayerSettings.defaultScreenWidth, height = PlayerSettings.defaultScreenHeight,
        targetFrameRate = Application.targetFrameRate, vSyncCount = QualitySettings.vSyncCount,
        pipeline = pipeline == null ? "MISSING" : pipeline.GetType().Name, renderScale = pipeline == null ? 0 : pipeline.renderScale,
        buildResult = build == null ? "NOT_RUN" : build.summary.result.ToString(),
        buildErrors = build == null ? 0 : (int)build.summary.totalErrors,
        buildBytes = build == null ? 0 : build.summary.totalSize, packages = packages
      };
      if (pipeline == null || report.renderScale != 1 || report.backend != "Mono2x" || report.graphicsApi != "Direct3D11" ||
        report.colorSpace != "Linear" || report.width != 1920 || report.height != 1080 || report.vSyncCount != 1)
        throw new InvalidOperationException("E02 effective settings do not match ADR");
      string filename = Path.Combine(RequiredArgument("-e02Output"), stage + ".json");
      if (File.Exists(filename)) throw new IOException("Refusing to overwrite E02 report");
      File.WriteAllText(filename, JsonUtility.ToJson(report, true));
    }

    private static string RequiredArgument(string name)
    {
      var args = Environment.GetCommandLineArgs();
      int i = Array.IndexOf(args, name);
      if (i < 0 || i + 1 >= args.Length) throw new ArgumentException("Missing " + name);
      return args[i + 1];
    }
  }
}
