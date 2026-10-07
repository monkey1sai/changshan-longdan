using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
using Changshan.Feedback;
using UnityEngine;

namespace Changshan.Character
{
  // Video evidence: with "-e06Route <dir>" (E06 animation route, no dummies), "-e07Feedback <dir>" (E07 feedback
  // route: hits, kills, a shockwave, strikes on the player, the musou finale) or "-e09Camera <dir>" (E09 camera route:
  // walls, barracks eaves and corners, a walk under a roof, jump, musou, shake off) the Player plays a scripted route at a fixed
  // 30 Hz step, writes one screenshot per frame, the per-frame trace (game time, state, hits, damage and the feedback
  // cues of that frame) and the sound mixed offline at the same clock (audio.wav, each frame's sounds starting at that
  // frame's first sample); scripts/record-route.mjs turns them into a video. Without an argument nothing happens.
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

    // E07: a string into the training dummies, a charge, JA's shockwave and heavy landing, a dodge, a light and a heavy
    // strike on the player, a perfect guard and a guarded heavy strike, then the musou with its finale.
    static readonly (double At, string Key, bool Down)[] FeedbackRoute =
    {
      (0.5, "KeyJ", true), (0.55, "KeyJ", false), (0.8, "KeyJ", true), (0.85, "KeyJ", false), (1.1, "KeyJ", true), (1.15, "KeyJ", false),
      (1.4, "KeyJ", true), (1.45, "KeyJ", false), (1.7, "KeyK", true), (1.75, "KeyK", false),
      (3.6, "Space", true), (3.65, "Space", false), (3.85, "KeyJ", true), (3.9, "KeyJ", false),
      (5.3, "ShiftLeft", true), (5.35, "ShiftLeft", false),
      (8.4, "KeyF", true), (9.6, "KeyF", false),
      (10.6, "KeyL", true), (10.65, "KeyL", false),
    };
    static readonly (double At, bool Heavy)[] FeedbackStrikes = { (5.9, false), (6.3, true), (8.45, false), (9.3, true) };
    public const double FeedbackDuration = 15.5;
    const double FeedbackMusouGainAt = 10.3;

    // E09: camera segments. Each starts by placing the character (a recording-only teleport, like the Web camera tests
    // placing their target), then runs scripted keys; the camera is read back every frame.
    public struct CameraSegment { public double At; public double X, Z, Facing; public string Name; }
    static readonly CameraSegment[] CameraSegments =
    {
      new CameraSegment { At = 0, X = 0, Z = 42, Facing = Math.PI, Name = "open" },
      new CameraSegment { At = 6, X = 0, Z = 54.5, Facing = Math.PI, Name = "south_wall" },
      new CameraSegment { At = 8.5, X = 54.5, Z = 40, Facing = -Math.PI / 2, Name = "east_wall" },
      new CameraSegment { At = 11, X = 36, Z = 0, Facing = -Math.PI / 2, Name = "barracks_walk" },
      new CameraSegment { At = 17, X = 39.6, Z = 13.6, Facing = 0, Name = "barracks_corner" },
      new CameraSegment { At = 22, X = 0, Z = 20, Facing = Math.PI, Name = "jump_musou" },
      new CameraSegment { At = 28, X = 0, Z = 30, Facing = Math.PI, Name = "shake_off" },
    };
    static readonly (double At, string Key, bool Down)[] CameraRoute =
    {
      (0.5, "KeyW", true), (2.0, "KeyW", false), (2.2, "KeyE", true), (3.4, "KeyE", false), (3.6, "KeyQ", true), (4.0, "KeyQ", false),
      (4.8, "KeyR", true), (4.85, "KeyR", false),
      (11.5, "KeyD", true), (13.3, "KeyD", false), (14.0, "KeyA", true), (15.8, "KeyA", false),
      (17.5, "KeyE", true), (21.5, "KeyE", false),
      (22.5, "Space", true), (22.55, "Space", false), (22.8, "KeyJ", true), (22.85, "KeyJ", false),
      (24.5, "KeyL", true), (24.55, "KeyL", false),
    };
    static readonly (double At, int Steps)[] CameraWheel = { (1.0, 1), (1.2, 1), (1.4, 1), (3.0, -1), (3.2, -1), (3.4, -1) };
    // The second strike lands after the first heavy hit's invulnerability, with the shake switched off for the session.
    static readonly (double At, bool Heavy)[] CameraStrikes = { (28.6, true), (31.6, true) };
    const double CameraShakeOffAt = 30.8, CameraMusouGainAt = 24.2;
    public const double CameraDuration = 33.5;

    sealed class ScriptedKeys : IRawInputSource
    {
      public readonly List<(string Key, bool Down)> Pending = new List<(string, bool)>();
      public double Wheel;

      public void Feed(InputMapper mapper)
      {
        foreach (var (key, down) in Pending)
          if (down) mapper.KeyDown(key);
          else mapper.KeyUp(key);
        Pending.Clear();
        if (Wheel != 0) mapper.Wheel(Wheel);
        Wheel = 0;
      }
    }

    [Serializable] public sealed class RouteFrame
    {
      public int f; public double simTime; public string state; public string move; public double x; public double z;
      public bool stepped; public int hits; public double damage; public int kills; public long audioSample; public string[] cues;
      // E09: the camera in logic space, its clearance, the roof flags, the focus in the viewport, the shake state.
      public string segment; public double camX, camY, camZ, yaw, clearance, trauma; public int[] roofs; public double focusU, focusV; public bool shakeEnabled;
    }
    [Serializable] public sealed class RouteLog
    {
      public string mode; public double duration; public int frameRate; public int pausedFrames; public int audioRate; public long audioSamples;
      public int viewportWidth, viewportHeight; public float renderScale; public int blockers;
      public RouteFrame[] frames;
    }

    string output;
    bool feedbackRoute, cameraRoute;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
      if (Application.isEditor) return;
      var args = Environment.GetCommandLineArgs();
      int i = Array.IndexOf(args, "-e06Route");
      int j = Array.IndexOf(args, "-e07Feedback");
      int k = Array.IndexOf(args, "-e09Camera");
      bool camera = i < 0 && j < 0 && k >= 0;
      bool feedback = i < 0 && j >= 0;
      int at = camera ? k : feedback ? j : i;
      if (at < 0 || at + 1 >= args.Length) return;
      var recorder = new GameObject(camera ? "E09 Camera Recorder" : feedback ? "E07 Feedback Recorder" : "E06 Route Recorder").AddComponent<RouteRecorder>();
      recorder.output = args[at + 1];
      recorder.feedbackRoute = feedback;
      recorder.cameraRoute = camera;
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
      controller.enabled = false;
      var keys = new ScriptedKeys();
      controller.InputSource = keys;
      // The E09 flow boots in the Player: the camera route plays through it (title -> battle); the older routes run
      // without it (the script passes -e09NoFlow), so their fixed camera and immediate stepping are unchanged.
      var flow = controller.Flow;
      if (cameraRoute && flow == null) flow = GameFlow.Attach(controller);
      if (flow != null) flow.StartRequested();
      if (!feedbackRoute && !cameraRoute)
      {
        // The dummies would block the view of the body; the E06 video reviews animation, not hits.
        foreach (var dummies in FindObjectsByType<TrainingDummies>()) dummies.gameObject.SetActive(false);
        controller.UseDummies(null);
      }
      else if (flow == null) controller.Restart();
      var route = cameraRoute ? CameraRoute : feedbackRoute ? FeedbackRoute : Route;
      double duration = cameraRoute ? CameraDuration : feedbackRoute ? FeedbackDuration : Duration;
      double gainAt = cameraRoute ? CameraMusouGainAt : feedbackRoute ? FeedbackMusouGainAt : MusouGainAt;
      var strikes = cameraRoute ? CameraStrikes : feedbackRoute ? FeedbackStrikes : Array.Empty<(double At, bool Heavy)>();
      var cameraView = controller.CameraView;
      if (cameraRoute && cameraView == null)
      {
        Debug.LogError("E09_ROUTE_NO_CAMERA_RIG");
        Application.Quit(2);
        yield break;
      }
      int nextSegment = 0;
      bool shakeTurnedOff = false;
      if (cameraRoute) cameraView.SetShakeForSession(true); // reproducible regardless of the saved setting
      var mainCamera = controller.ViewCamera != null ? controller.ViewCamera : Camera.main;

      // Sound on the recording clock: the live output stops pulling the mixer, each frame's sounds start at that frame's
      // first sample, and the mixer is rendered offline frame by frame into audio.wav.
      var effects = controller.Effects;
      var bank = effects.Sound;
      var mixer = bank?.Mixer;
      long audioSample = 0;
      int samplesPerFrame = mixer != null ? (int)Math.Round(mixer.Rate * FrameSeconds) : 0;
      var audio = new List<float>();
      float[] block = mixer != null ? new float[samplesPerFrame * 2] : null;
      if (bank != null)
      {
        effects.OfflineAudio = true;
        if (effects.Prewarm != null) while (!effects.Prewarm.IsCompleted) yield return null;
        bank.UseClock(() => audioSample / (double)mixer.Rate, () => audioSample);
      }
      var cues = new List<FeedbackCue>();
      var traced = new List<FeedbackFrame>();
      // The window may lose focus while recording; the input is scripted, so focus loss must not pause the simulation.
      controller.IgnoreFocusLoss = true;
      controller.SetFocus(true);
      // The validation camera is fixed and the route lunges out of its view, so the camera keeps its starting offset to
      // the character's ground point. It only translates: the controls are camera-relative and its yaw stays the same,
      // so the route's input directions are unchanged. Ground point (y = 0) so jumps stay visible as height.
      var view = cameraRoute ? null : controller.ViewCamera != null ? controller.ViewCamera : Camera.main;
      Vector3 Ground()
      {
        var p = controller.Simulation.Player;
        return controller.Mapping.ToDisplayPosition(p.X, 0, p.Z);
      }
      var offset = view != null ? view.transform.position - Ground() : Vector3.zero;
      int frames = (int)Math.Round(duration / FrameSeconds);
      int next = 0, nextStrike = 0;
      bool gained = false;
      var log = new RouteLog
      {
        mode = cameraRoute ? "e09-camera" : feedbackRoute ? "e07-feedback" : "e06-route", duration = duration, frameRate = (int)Math.Round(1 / FrameSeconds),
        audioRate = mixer?.Rate ?? 0, frames = new RouteFrame[frames],
        viewportWidth = Screen.width, viewportHeight = Screen.height, blockers = Changshan.View.CastleGeometry.CameraBlockers.Count,
        renderScale = Changshan.Foundation.FoundationSmoke.CurrentRenderScale(),
      };
      string logPath = Path.Combine(output, "route.json");
      for (int frame = 0; frame < frames; frame++)
      {
        double t = frame * FrameSeconds;
        while (next < route.Length && route[next].At <= t + 1e-9) keys.Pending.Add((route[next].Key, route[next++].Down));
        if (cameraRoute)
        {
          foreach (var (wheelAt, steps) in CameraWheel) if (Math.Max(0, (int)Math.Ceiling(wheelAt / FrameSeconds - 1e-9)) == frame) keys.Wheel += steps;
          while (nextSegment < CameraSegments.Length && CameraSegments[nextSegment].At <= t + 1e-9)
          {
            var seg = CameraSegments[nextSegment++];
            controller.Simulation.Player.Reset(seg.X, seg.Z, seg.Facing);
            if (seg.At > 0) cameraView.Snap(controller.Simulation.Player);
          }
          if (!shakeTurnedOff && t >= CameraShakeOffAt)
          {
            cameraView.SetShakeForSession(false);
            shakeTurnedOff = true;
          }
        }
        if (!gained && t >= gainAt)
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
        long traceStart = effects.Trace.FrameTotal;
        controller.Tick(FrameSeconds);
        while (nextStrike < strikes.Length && strikes[nextStrike].At <= t + 1e-9) controller.InjectStrike(strikes[nextStrike++].Heavy);
        if (view != null) view.transform.position = Ground() + offset;
        var player = controller.Simulation.Player;
        // This frame's trace (the step and any strike) and its cues.
        effects.Trace.CopyFrames(traced);
        effects.Trace.CopyCues(cues);
        var entry = new RouteFrame
        {
          f = frame, simTime = controller.Simulation.Clock.SimTime, state = player.State.ToString(), move = player.Move?.Id.ToString() ?? "", x = player.X, z = player.Z,
          stepped = controller.Simulation.SteppedThisFrame, audioSample = audioSample,
        };
        var names = new List<string>();
        foreach (var tf in traced)
        {
          if (tf.Frame < traceStart) continue;
          entry.hits += tf.Hits;
          entry.damage += tf.Damage;
          entry.kills += tf.Kills;
          foreach (var c in cues) if (c.Frame == tf.Frame) names.Add(c.Name);
        }
        entry.cues = names.ToArray();
        if (cameraRoute)
        {
          var rig = cameraView.Rig;
          entry.segment = CameraSegments[Math.Max(0, nextSegment - 1)].Name;
          entry.camX = rig.Position.X; entry.camY = rig.Position.Y; entry.camZ = rig.Position.Z; entry.yaw = rig.Yaw;
          entry.clearance = Changshan.View.CameraClearance.Clearance(rig.Focus.X, rig.Focus.Z, rig.Position.X, rig.Position.Z);
          entry.trauma = rig.Trauma;
          entry.shakeEnabled = rig.ShakeEnabled;
          entry.roofs = new int[cameraView.RoofsVisible.Length];
          for (int ri = 0; ri < entry.roofs.Length; ri++) entry.roofs[ri] = cameraView.RoofsVisible[ri] ? 1 : 0;
          var vp = mainCamera != null ? mainCamera.WorldToViewportPoint(cameraView.DisplayFocus) : new Vector3(-1, -1, 0);
          entry.focusU = vp.z > 0 ? vp.x : -1; entry.focusV = vp.z > 0 ? vp.y : -1;
        }
        log.frames[frame] = entry;
        if (mixer != null)
        {
          Array.Clear(block, 0, block.Length);
          mixer.Render(block, samplesPerFrame, 2);
          audio.AddRange(block);
          audioSample += samplesPerFrame;
        }
        ScreenCapture.CaptureScreenshot(Path.Combine(output, $"frame_{frame:0000}.png"));
        yield return null;
      }
      yield return null;
      yield return null;
      // Per-frame game time, state, move and feedback: scripts/record-route.mjs checks the route ran and encodes it.
      log.audioSamples = audioSample;
      File.WriteAllText(logPath, JsonUtility.ToJson(log));
      if (mixer != null) WriteWav(Path.Combine(output, "audio.wav"), audio, mixer.Rate);
      Application.Quit(0);
    }

    // 16-bit stereo PCM; samples beyond full scale are clipped like the output device would.
    static void WriteWav(string path, List<float> interleaved, int rate)
    {
      using (var w = new BinaryWriter(File.Create(path)))
      {
        int bytes = interleaved.Count * 2;
        w.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
        w.Write(36 + bytes);
        w.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt "));
        w.Write(16);
        w.Write((short)1);
        w.Write((short)2);
        w.Write(rate);
        w.Write(rate * 4);
        w.Write((short)4);
        w.Write((short)16);
        w.Write(System.Text.Encoding.ASCII.GetBytes("data"));
        w.Write(bytes);
        foreach (var v in interleaved) w.Write((short)Math.Round(Math.Max(-1, Math.Min(1, v)) * 32767));
      }
    }
  }
}
