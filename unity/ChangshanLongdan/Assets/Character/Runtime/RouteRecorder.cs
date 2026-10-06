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
      while (character != null && character.Status == CharacterLoadStatus.Loading && Time.realtimeSinceStartup < deadline) yield return null;
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
      controller.SetFocus(true);
      int frames = (int)Math.Round(Duration / FrameSeconds);
      int next = 0;
      bool gained = false;
      for (int frame = 0; frame < frames; frame++)
      {
        double t = frame * FrameSeconds;
        while (next < Route.Length && Route[next].At <= t + 1e-9) keys.Pending.Add((Route[next].Key, Route[next++].Down));
        if (!gained && t >= MusouGainAt)
        {
          controller.Simulation.Player.GainMusou(PlayerTuning.Default.MusouMax);
          gained = true;
        }
        controller.Tick(FrameSeconds);
        ScreenCapture.CaptureScreenshot(Path.Combine(output, $"frame_{frame:0000}.png"));
        yield return null;
      }
      yield return null;
      yield return null;
      Application.Quit(0);
    }
  }
}
