using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using Changshan.Combat;
using Unity.Profiling;
using Unity.Profiling.LowLevel.Unsafe;
using UnityEngine;

namespace Changshan.Character
{
  // Capability probe only: real wall intervals, no fixed clock, no screenshots during sampling,
  // no focus override, no gameplay/quality optimization. Missing providers stay missing.
  public sealed class PerformanceProbe : MonoBehaviour
  {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    const int Capacity = 4096;
    static readonly string[] Names = { "CPU Main Thread Frame Time", "CPU Render Thread Frame Time", "GPU Frame Time",
      "Draw Calls Count", "GC Allocated In Frame", "GC Used Memory", "GC Reserved Memory", "Total Used Memory" };

    [Serializable] public sealed class CounterInfo { public string name, category, unit; public bool available, validAtEnd; public int sampleCount, reads; }
    [Serializable] public sealed class Report
    {
      public string kind = "CAPABILITY_PROBE", runId, unityVersion, backend, visibleProvider = "UNAVAILABLE", error, processStart, castleAssets;
      public string wallProvider = "System.Diagnostics.Stopwatch", cpuProvider = "ProfilerRecorder active counters; max(main,render); ns to ms";
      public int pid, population, spawnSeed, aiSeed, width, height, refresh, vSync, cap, frames, errorCount;
      public double warmupSeconds = 3, sampleSeconds = 10;
      public float renderScale;
      public bool development, frameTimingEnabled, batchMode;
      public CounterInfo[] counters;
      public string[] gaps = { "true camera visible count (occlusion/pixel tested)", "fixed full workload and peak coverage", "formal 180s sampling / 30min soak" };
    }
    struct Sample
    {
      public int frame, alive, engaged, attackers, frustum, foregroundPid, gc0, gc1, gc2;
      public double seconds, wallMs;
      public bool focus, minimized;
      public long privateBytes, workingSet;
      public long? main, render, gpu, draws, allocated, gcUsed, gcReserved, used;
    }
    sealed class Counter : IDisposable
    {
      public CounterInfo Info;
      ProfilerRecorder recorder;
      public Counter(string name, List<ProfilerRecorderHandle> handles)
      {
        Info = new CounterInfo { name = name };
        foreach (var handle in handles)
        {
          var d = ProfilerRecorderHandle.GetDescription(handle);
          if (d.Name != name) continue;
          Info.category = d.Category.Name; Info.unit = d.UnitType.ToString();
          recorder = ProfilerRecorder.StartNew(d.Category, name, 1);
          Info.available = recorder.Valid;
          break;
        }
      }
      public long? Read()
      {
        Info.validAtEnd = recorder.Valid; Info.sampleCount = recorder.Valid ? recorder.Count : 0;
        if (!Info.available || !Info.validAtEnd || Info.sampleCount == 0) return null;
        Info.reads++; return recorder.LastValue;
      }
      public void Dispose() { Info.validAtEnd = recorder.Valid; if (recorder.Valid) recorder.Dispose(); }
    }
    public static List<Spawn> ProbeSpawns(int population, uint seed)
    {
      if (population != 20 && population != 50 && population != 100 && population != 200 && population != 300)
        throw new ArgumentOutOfRangeException(nameof(population));
      if (seed != 7 && seed != 11 && seed != 23) throw new ArgumentOutOfRangeException(nameof(seed));
      // Nested nearest-first subset of the unchanged castle roster; only this explicit probe uses this ordering.
      return CastleLayout.SquadSpawns(CastleLayout.Squads, new Mulberry32(seed))
        .OrderBy(s => (s.X - ArenaLayout.StartX) * (s.X - ArenaLayout.StartX) + (s.Z - ArenaLayout.StartZ) * (s.Z - ArenaLayout.StartZ))
        .Take(population).ToList();
    }
    string output, runId; int errors;
    void Awake() { Application.logMessageReceived += CountErrors; }
    void OnDestroy() { Application.logMessageReceived -= CountErrors; }
    void CountErrors(string message, string stack, LogType type) { if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert) errors++; }
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)] static void Boot()
    {
      if (Application.isEditor || !Debug.isDebugBuild) return;
      var args = Environment.GetCommandLineArgs();
      int i = Array.IndexOf(args, "-e12Probe");
      if (i >= 0 && i + 1 < args.Length)
      {
        var recorder = new GameObject("E12 capability probe").AddComponent<PerformanceProbe>();
        recorder.output = args[i + 1];
        int id = Array.IndexOf(args, "-e12RunId");
        recorder.runId = id >= 0 && id + 1 < args.Length ? args[id + 1] : null;
      }
    }
    IEnumerator Start()
    {
      if (!Directory.Exists(output) || Directory.EnumerateFileSystemEntries(output).Any()) { Application.Quit(2); yield break; }
      var report = new Report { runId = runId, population = 20, spawnSeed = 7, aiSeed = 7,
        unityVersion = Application.unityVersion, backend = SystemInfo.graphicsDeviceType.ToString(),
        development = Debug.isDebugBuild, frameTimingEnabled = FrameTimingManager.IsFeatureEnabled(), batchMode = Application.isBatchMode };
      if (!Guid.TryParse(runId, out _)) { report.error = "INVALID_RUN_ID"; WriteReport(report); Application.Quit(2); yield break; }
      var process = System.Diagnostics.Process.GetCurrentProcess(); report.pid = process.Id;
      report.processStart = process.StartTime.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
      var controller = FindObjectsByType<ZhaoYunController>().FirstOrDefault();
      var character = controller != null ? controller.GetComponent<ZhaoYunCharacter>() : null;
      double deadline = Time.realtimeSinceStartupAsDouble + 30;
      while (character != null && character.Status == CharacterLoadStatus.NotStarted && Time.realtimeSinceStartupAsDouble < deadline) yield return null;
      while (character != null && character.Status != CharacterLoadStatus.Ready && character.Status != CharacterLoadStatus.Failed && Time.realtimeSinceStartupAsDouble < deadline) yield return null;
      if (controller == null || character == null || character.Status != CharacterLoadStatus.Ready)
      { report.error = "CHARACTER_NOT_READY"; WriteReport(report); Application.Quit(2); yield break; }
      Material material = null;
      if (controller.Dummies != null && controller.Dummies.Dummies.Count > 0)
        material = controller.Dummies.Dummies[0].GetComponent<MeshRenderer>()?.sharedMaterial;
      if (material == null) { report.error = "SOLDIER_MATERIAL_MISSING"; WriteReport(report); Application.Quit(2); yield break; }
      if (controller.Flow != null) controller.Flow.StartRequested();
      controller.StartBattle(Difficulties.Normal);
      if (controller.Dummies != null) controller.Dummies.gameObject.SetActive(false);
      var crowd = CrowdSpawner.Create("E12 probe capsules", ProbeSpawns(20, 7), controller.Mapping, material);
      controller.UseDummies(crowd, 7);
      controller.EnsureCastle(); controller.UseCameraRig(true);
      var castle = controller.Castle != null ? controller.Castle.Assets : null;
      deadline = Time.realtimeSinceStartupAsDouble + 30;
      while (castle != null && !castle.Settled && Time.realtimeSinceStartupAsDouble < deadline) yield return null;
      report.castleAssets = castle != null ? castle.Status.ToString() : "MISSING";
      if (castle == null || castle.Status != CastleAssetStatus.Ready)
      { report.error = "CASTLE_ASSETS_NOT_READY"; WriteReport(report); process.Dispose(); Application.Quit(2); yield break; }
      controller.ShowDebug = false;
      controller.SetFocus(Application.isFocused);
      var handles = new List<ProfilerRecorderHandle>(); ProfilerRecorderHandle.GetAvailable(handles);
      var counters = Names.Select(n => new Counter(n, handles)).ToArray();
      report.counters = counters.Select(c => c.Info).ToArray();
      report.width = Screen.width; report.height = Screen.height; report.refresh = (int)Math.Round(Screen.currentResolution.refreshRateRatio.value);
      report.vSync = QualitySettings.vSyncCount; report.cap = Application.targetFrameRate;
      report.renderScale = Changshan.Foundation.FoundationSmoke.CurrentRenderScale();
      var renderers = crowd.Dummies.Select(t => t.GetComponent<Renderer>()).ToArray();
      var planes = new Plane[6]; var samples = new Sample[Capacity];
      var clock = System.Diagnostics.Stopwatch.StartNew(); double previous = clock.Elapsed.TotalSeconds;
      int count = 0; var endOfFrame = new WaitForEndOfFrame();
      while (clock.Elapsed.TotalSeconds < report.warmupSeconds + report.sampleSeconds)
      {
        yield return endOfFrame;
        double now = clock.Elapsed.TotalSeconds, wall = (now - previous) * 1000; previous = now;
        FrameTimingManager.CaptureFrameTimings();
        if (now < report.warmupSeconds) continue;
        if (count == Capacity) { report.error = "BOUNDED_SAMPLE_BUFFER_FULL"; break; }
        var targets = controller.Simulation.Targets; int engaged = 0, frustum = 0;
        var camera = controller.ViewCamera != null ? controller.ViewCamera : Camera.main;
        if (camera != null) GeometryUtility.CalculateFrustumPlanes(camera, planes);
        for (int i = 0; i < targets.Count; i++)
        {
          if (targets.Alive(i) && targets.Engaged(i)) engaged++;
          if (camera != null && targets.Alive(i) && renderers[i] != null && renderers[i].enabled && GeometryUtility.TestPlanesAABB(planes, renderers[i].bounds)) frustum++;
        }
        var window = GetForegroundWindow(); GetWindowThreadProcessId(window, out uint foregroundPid);
        process.Refresh();
        samples[count++] = new Sample { frame = Time.frameCount, seconds = now, wallMs = wall,
          alive = targets.AliveCount, engaged = engaged, attackers = targets.Attackers, frustum = frustum,
          focus = Application.isFocused, foregroundPid = (int)foregroundPid, minimized = process.MainWindowHandle == IntPtr.Zero || IsIconic(process.MainWindowHandle),
          privateBytes = process.PrivateMemorySize64, workingSet = process.WorkingSet64,
          gc0 = GC.CollectionCount(0), gc1 = GC.CollectionCount(1), gc2 = GC.CollectionCount(2),
          main = counters[0].Read(), render = counters[1].Read(), gpu = counters[2].Read(), draws = counters[3].Read(),
          allocated = counters[4].Read(), gcUsed = counters[5].Read(), gcReserved = counters[6].Read(), used = counters[7].Read() };
      }
      foreach (var c in counters) c.Dispose(); process.Dispose();
      report.frames = count;
      report.errorCount = errors;
      if (errors > 0) report.error = "PLAYER_LOG_ERRORS";
      using (var writer = new StreamWriter(Path.Combine(output, "frames.csv"), false))
      {
        writer.WriteLine("frame,seconds,wallMs,alive,visible,frustum,engaged,attackers,focus,foregroundPid,minimized,privateBytes,workingSet,gc0,gc1,gc2,cpuMainRaw,cpuRenderRaw,gpuRaw,draws,allocated,gcUsed,gcReserved,used");
        for (int i = 0; i < count; i++) { var s = samples[i];
          writer.WriteLine(string.Join(",", s.frame, F(s.seconds), F(s.wallMs), s.alive, "", s.frustum, s.engaged, s.attackers,
            s.focus, s.foregroundPid, s.minimized, s.privateBytes, s.workingSet, s.gc0, s.gc1, s.gc2,
            s.main, s.render, s.gpu, s.draws, s.allocated, s.gcUsed, s.gcReserved, s.used)); }
      }
      WriteReport(report);
      ScreenCapture.CaptureScreenshot(Path.Combine(output, "end.png"));
      yield return null; yield return null;
      Application.Quit(report.error == null ? 0 : 2);
    }
    static string F(double value) => value.ToString("R", CultureInfo.InvariantCulture);
    void WriteReport(Report report) => File.WriteAllText(Path.Combine(output, "probe.json"), JsonUtility.ToJson(report, true));
  }
}
