using System;
using System.Collections;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;

namespace Changshan.Character
{
  // Opt-in clock diagnostic only. Does not start a battle or change normal game flow.
  public sealed class E12ClockReady : MonoBehaviour
  {
    [Serializable] public sealed class ReadyReport
    {
      public string status, runId, processStartUtc, utc, monotonicTick, frequency, graphicsApi, unityVersion, assetStatus;
      public int pid, width, height, framesSinceEntry, errorCount;
      public bool focused, development, batchMode;
    }
    string output, runId;
    int entryFrame, errors;
    double entryTime;
    public static bool ParseLaunch(string[] args, out string output, out string runId)
    {
      output = null; runId = null;
      int index = Array.IndexOf(args, "-e12ClockReady"), id = Array.IndexOf(args, "-e12RunId");
      if (index < 0 || index + 1 >= args.Length || id < 0 || id + 1 >= args.Length ||
        Array.LastIndexOf(args, "-e12ClockReady") != index || Array.LastIndexOf(args, "-e12RunId") != id ||
        Array.IndexOf(args, "-e12Probe") >= 0 || Array.IndexOf(args, "-e02Output") >= 0 ||
        !Guid.TryParseExact(args[id + 1], "D", out _)) return false;
      output = args[index + 1]; runId = args[id + 1];
      return Path.IsPathRooted(output) && Directory.Exists(output) && Directory.GetFileSystemEntries(output).Length == 0;
    }
    public static bool CanPublish(CharacterLoadStatus status, int frames, int errors) =>
      status == CharacterLoadStatus.Ready && frames >= 120 && errors == 0;
    public static void Publish(string directory, string name, string json)
    {
      string temporary = Path.Combine(directory, name + ".partial"), final = Path.Combine(directory, name);
      using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
      {
        byte[] bytes = new UTF8Encoding(false).GetBytes(json);
        stream.Write(bytes, 0, bytes.Length); stream.Flush(true);
      }
      File.Move(temporary, final); // Same-directory rename, refuses existing evidence.
    }
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)] static void Boot()
    {
      if (Application.isEditor || !Debug.isDebugBuild) return;
      var args = Environment.GetCommandLineArgs();
      if (Array.IndexOf(args, "-e12ClockReady") < 0) return;
      if (!ParseLaunch(args, out string directory, out string id)) { Application.Quit(2); return; }
      var diagnostic = new GameObject("E12 clock readiness").AddComponent<E12ClockReady>();
      diagnostic.output = directory; diagnostic.runId = id;
    }
    void Awake()
    {
      entryFrame = Time.frameCount; entryTime = Time.realtimeSinceStartupAsDouble;
      Application.logMessageReceived += CountErrors;
    }
    void OnDestroy() { Application.logMessageReceived -= CountErrors; }
    void Update() { if (output != null && Time.realtimeSinceStartupAsDouble - entryTime >= 90) Application.Quit(2); }
    void CountErrors(string message, string stack, LogType type)
    { if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert) errors++; }
    ReadyReport Report(string status, ZhaoYunCharacter character)
    {
      using (var process = System.Diagnostics.Process.GetCurrentProcess())
        return new ReadyReport { status = status, runId = runId, pid = process.Id,
          processStartUtc = process.StartTime.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture),
          utc = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture),
          monotonicTick = System.Diagnostics.Stopwatch.GetTimestamp().ToString(CultureInfo.InvariantCulture),
          frequency = System.Diagnostics.Stopwatch.Frequency.ToString(CultureInfo.InvariantCulture),
          graphicsApi = SystemInfo.graphicsDeviceType.ToString(), unityVersion = Application.unityVersion,
          assetStatus = character == null ? "MISSING" : character.Status.ToString(),
          width = Screen.width, height = Screen.height, framesSinceEntry = Time.frameCount - entryFrame,
          errorCount = errors, focused = Application.isFocused, development = Debug.isDebugBuild, batchMode = Application.isBatchMode };
    }
    IEnumerator Start()
    {
      ZhaoYunCharacter character = FindFirstObjectByType<ZhaoYunCharacter>();
      while (Time.realtimeSinceStartupAsDouble - entryTime < 30 && errors == 0 && character != null &&
        character.Status != CharacterLoadStatus.Failed && !CanPublish(character.Status, Time.frameCount - entryFrame, errors)) yield return null;
      bool ready = character != null && CanPublish(character.Status, Time.frameCount - entryFrame, errors);
      Publish(output, "ready.json", JsonUtility.ToJson(Report(ready ? "READY_CLOCK_ONLY" : "BLOCKED_READY", character), true));
      if (!ready) { Application.Quit(2); yield break; }
      while (!File.Exists(Path.Combine(output, "stop.json")) && Time.realtimeSinceStartupAsDouble - entryTime < 90 && errors == 0) yield return null;
      bool stopped = File.Exists(Path.Combine(output, "stop.json")) && errors == 0;
      Publish(output, "end.json", JsonUtility.ToJson(Report(stopped ? "STOPPED_CLOCK_ONLY" : "BLOCKED_END", character), true));
      Application.Quit(stopped ? 0 : 2);
    }
  }
}
