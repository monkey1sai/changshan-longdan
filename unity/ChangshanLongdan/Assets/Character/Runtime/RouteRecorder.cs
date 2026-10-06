using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // E06 video evidence: with "-e06Route <dir>" the Player plays the plan's route with scripted keys at a fixed 30 Hz
  // step and writes one screenshot per frame to <dir>; scripts/record-route.mjs turns them into a video. Without the
  // argument (normal play, runner validation) nothing happens.
  public sealed class RouteRecorder : MonoBehaviour
  {
    public const double FrameSeconds = 1.0 / 30;

    // (seconds, key, down): the plan's route: run, stop, turn, N1-N6, C3, C6, jump attacks, dodges and DASH, guard, musou.
    static readonly (double At, string Key, bool Down)[] Route =
    {
      (0.5, "KeyW", true), (1.3, "KeyW", false), (2.0, "KeyS", true), (2.7, "KeyS", false),
      (3.5, "KeyJ", true), (3.55, "KeyJ", false), (3.75, "KeyJ", true), (3.8, "KeyJ", false), (4.0, "KeyJ", true), (4.05, "KeyJ", false),
      (4.25, "KeyJ", true), (4.3, "KeyJ", false), (4.55, "KeyJ", true), (4.6, "KeyJ", false), (4.85, "KeyJ", true), (4.9, "KeyJ", false),
      (6.5, "KeyJ", true), (6.55, "KeyJ", false), (6.75, "KeyJ", true), (6.8, "KeyJ", false), (7.0, "KeyK", true), (7.05, "KeyK", false),
      (9.0, "KeyJ", true), (9.05, "KeyJ", false), (9.3, "KeyJ", true), (9.35, "KeyJ", false), (9.55, "KeyJ", true), (9.6, "KeyJ", false),
      (9.85, "KeyJ", true), (9.9, "KeyJ", false), (10.2, "KeyJ", true), (10.25, "KeyJ", false), (10.6, "KeyK", true), (10.65, "KeyK", false),
      (13.0, "Space", true), (13.05, "Space", false), (13.25, "KeyJ", true), (13.3, "KeyJ", false),
      (14.2, "Space", true), (14.25, "Space", false), (14.45, "KeyK", true), (14.5, "KeyK", false),
      (15.45, "KeyD", true), (15.5, "ShiftLeft", true), (15.55, "ShiftLeft", false), (15.6, "KeyD", false),
      (16.3, "ShiftLeft", true), (16.35, "ShiftLeft", false), (16.45, "KeyJ", true), (16.5, "KeyJ", false),
      (17.5, "KeyF", true), (18.6, "KeyF", false),
      (19.0, "KeyL", true), (19.05, "KeyL", false),
    };
    public const double Duration = 23.5;
    const double MusouGainAt = 18.9;

    sealed class ScriptedKeys : IRawInputSource
    {
      public readonly List<(string Key, bool Down)> Pending = new List<(string, bool)>();

      public void Feed(InputMapper mapper)
      {
        foreach (var (key, down) in Pending)
          if (down) mapper.KeyDown(key);
          else mapper.KeyUp(key);
        Pending.Clear();
      }
    }

    [Serializable] public sealed class RouteFrame { public int f; public double simTime; public string state; public string move; public double x; public double z; }
    [Serializable] public sealed class RouteLog { public double duration; public int frameRate; public int pausedFrames; public RouteFrame[] frames; }

    string output;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
      if (Application.isEditor) return;
      var args = Environment.GetCommandLineArgs();
      int i = Array.IndexOf(args, "-e06Route");
      if (i < 0 || i + 1 >= args.Length) return;
      var recorder = new GameObject("E06 Route Recorder").AddComponent<RouteRecorder>();
      recorder.output = args[i + 1];
    }

    IEnumerator Start()
    {
      if (!Directory.Exists(output) || Directory.EnumerateFileSystemEntries(output).Any())
      {
        Debug.LogError("E06_ROUTE_OUTPUT_INVALID: the frame directory must exist and be empty");
        Application.Quit(2);
        yield break;
      }
      var controller = FindObjectsByType<ZhaoYunController>().FirstOrDefault();
      var character = controller != null ? controller.GetComponent<ZhaoYunCharacter>() : null;
      float deadline = Time.realtimeSinceStartup + 30;
      // The character starts loading after the scene is up (NotStarted first): wait for an outcome.
      while (character != null && character.Status != CharacterLoadStatus.Ready && character.Status != CharacterLoadStatus.Failed && Time.realtimeSinceStartup < deadline) yield return null;
      if (controller == null || character == null || character.Status != CharacterLoadStatus.Ready)
      {
        Debug.LogError("E06_ROUTE_CHARACTER_NOT_READY");
        Application.Quit(2);
        yield break;
      }
      // The dummies would block the view of the body; this video reviews animation, not hits.
      foreach (var dummies in FindObjectsByType<TrainingDummies>()) dummies.gameObject.SetActive(false);
      controller.enabled = false;
      var keys = new ScriptedKeys();
      controller.InputSource = keys;
      controller.UseDummies(null);
      // The window may lose focus while recording; the input is scripted, so focus loss must not pause the simulation.
      controller.IgnoreFocusLoss = true;
      controller.SetFocus(true);
      // The validation camera is fixed and the route lunges out of its view, so the camera keeps its starting offset to
      // the character's ground point. It only translates: the controls are camera-relative and its yaw stays the same,
      // so the route's input directions are unchanged. Ground point (y = 0) so jumps stay visible as height.
      var view = controller.ViewCamera != null ? controller.ViewCamera : Camera.main;
      Vector3 Ground()
      {
        var p = controller.Simulation.Player;
        return controller.Mapping.ToDisplayPosition(p.X, 0, p.Z);
      }
      var offset = view != null ? view.transform.position - Ground() : Vector3.zero;
      int frames = (int)Math.Round(Duration / FrameSeconds);
      int next = 0;
      bool gained = false;
      var log = new RouteLog { duration = Duration, frameRate = (int)Math.Round(1 / FrameSeconds), frames = new RouteFrame[frames] };
      string logPath = Path.Combine(output, "route.json");
      for (int frame = 0; frame < frames; frame++)
      {
        double t = frame * FrameSeconds;
        while (next < Route.Length && Route[next].At <= t + 1e-9) keys.Pending.Add((Route[next].Key, Route[next++].Down));
        if (!gained && t >= MusouGainAt)
        {
          controller.Simulation.Player.GainMusou(PlayerTuning.Default.MusouMax);
          gained = true;
        }
        if (controller.Paused)
        {
          // Never expected with IgnoreFocusLoss; a paused frame would silently desynchronise the video from the route.
          log.pausedFrames++;
          Debug.LogError($"E06_ROUTE_PAUSED at frame {frame}");
          File.WriteAllText(logPath, JsonUtility.ToJson(log));
          Application.Quit(3);
          yield break;
        }
        controller.Tick(FrameSeconds);
        if (view != null) view.transform.position = Ground() + offset;
        var player = controller.Simulation.Player;
        log.frames[frame] = new RouteFrame
        {
          f = frame, simTime = controller.Simulation.Clock.SimTime, state = player.State.ToString(), move = player.Move?.Id.ToString() ?? "", x = player.X, z = player.Z,
        };
        ScreenCapture.CaptureScreenshot(Path.Combine(output, $"frame_{frame:0000}.png"));
        yield return null;
      }
      yield return null;
      yield return null;
      // Per-frame game time, state and move: scripts/record-route.mjs checks the simulation never stalled and the route ran.
      File.WriteAllText(logPath, JsonUtility.ToJson(log));
      Application.Quit(0);
    }
  }
}
