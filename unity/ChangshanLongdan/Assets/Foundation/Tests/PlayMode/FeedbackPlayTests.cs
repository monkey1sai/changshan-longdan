using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Changshan.Character;
using Changshan.Combat;
using Changshan.Feedback;
using Changshan.Feedback.Audio;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Object = UnityEngine.Object;

namespace Changshan.Foundation.Tests
{
  // E07 feedback in the validation scene: a hit shows sparks, plays its sound and shakes the camera on the frame the
  // dummy takes the damage; the trace ties them together; hit-stop freezes the particles; a kill shatters into voxel
  // fragments; the spear leaves a trail; a restart clears the effects.
  public sealed class FeedbackPlayTests
  {
    const double Dt = 1.0 / 60;

    sealed class ScriptedInput : IRawInputSource
    {
      public readonly List<string> Down = new List<string>();
      public readonly List<string> Up = new List<string>();

      public void Feed(InputMapper mapper)
      {
        foreach (var code in Down) mapper.KeyDown(code);
        foreach (var code in Up) mapper.KeyUp(code);
        Down.Clear();
        Up.Clear();
      }
    }

    static IEnumerator Scene(System.Action<ZhaoYunController, ScriptedInput> ready)
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      yield return null;
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      controller.enabled = false;
      var input = new ScriptedInput();
      controller.InputSource = input;
      controller.SetFocus(true);
      ready(controller, input);
    }

    static List<FeedbackCue> CuesOf(FeedbackView view, long frame)
    {
      var cues = new List<FeedbackCue>();
      view.Trace.CopyCues(cues);
      return cues.Where(c => c.Frame == frame).ToList();
    }

    static FeedbackFrame LastFrame(FeedbackView view)
    {
      var frames = new List<FeedbackFrame>();
      view.Trace.CopyFrames(frames);
      return frames[frames.Count - 1];
    }

    [UnityTest] public IEnumerator HitShowsSparksPlaysSoundAndShakesOnTheSameFrame()
    {
      ZhaoYunController controller = null;
      ScriptedInput input = null;
      yield return Scene((c, i) => { controller = c; input = i; });
      var sim = controller.Simulation;
      input.Down.Add("KeyJ");
      controller.Tick(Dt);
      input.Up.Add("KeyJ");
      var view = controller.Effects;
      bool trailSeen = false;
      for (int frame = 0; frame < 60 && sim.Hits.Count == 0; frame++)
      {
        controller.Tick(Dt);
        trailSeen |= view.Trail.Count > 0;
      }
      int hits = sim.Hits.Count;
      Assert.That(hits, Is.GreaterThan(0), "N1 never hit a dummy");
      Assert.That(trailSeen || view.Trail.Count > 0, Is.True, "N1's trail window draws the spear trail");

      // The common trace: this frame's hits, their damage and the cues issued for them.
      var traced = LastFrame(view);
      Assert.That(traced.Stepped, Is.True);
      Assert.That(traced.Hits, Is.EqualTo(hits));
      Assert.That(traced.Damage, Is.EqualTo(sim.Hits.Sum(h => h.Damage)).Within(1e-9));
      var cues = CuesOf(view, traced.Frame);
      Assert.That(cues.Count(c => c.Name == "sparks.burst"), Is.EqualTo(hits), "one burst per dummy hit");
      Assert.That(cues.Count(c => c.Name == "audio.hit"), Is.EqualTo(1));
      Assert.That(cues.Single(c => c.Name == "audio.hit").A1, Is.EqualTo(hits), "the sound carries the hit count");
      Assert.That(cues.Any(c => c.Name == "camera.addTrauma"), Is.True);
      // N1 is a light (pierce) hit: 7 sparks and a flash per dummy, spawned now.
      Assert.That(view.Sparks.Count, Is.EqualTo(hits * 8));
      Assert.That(controller.Shake.Trauma, Is.GreaterThan(0));
      if (view.Sound != null) Assert.That(view.Sound.LastSound, Is.EqualTo(Sound.Hit), "the hit sound was queued on the hit frame");

      // Drawn: the spark mesh holds four corners per spark, with the feedback shader.
      yield return null;
      var sparks = view.transform.Find("Sparks");
      Assert.That(sparks.GetComponent<MeshFilter>().sharedMesh.vertexCount, Is.EqualTo(view.Sparks.Count * 4));
      Assert.That(sparks.GetComponent<MeshRenderer>().sharedMaterial.shader.name, Is.EqualTo("Changshan/Feedback"));

      // Hit-stop freezes the sparks with the game (they update with the game-time step).
      Assert.That(sim.Clock.Hitstop, Is.GreaterThan(0));
      float x = view.Sparks.Pos[0];
      controller.Tick(Dt);
      Assert.That(sim.SteppedThisFrame, Is.False);
      Assert.That(view.Sparks.Pos[0], Is.EqualTo(x), "frozen during hit-stop");
      for (int frame = 0; frame < 60; frame++) controller.Tick(Dt);
      Assert.That(view.Sparks.Count, Is.Zero, "sparks live under half a second of game time");
      Assert.That(view.Trail.Count, Is.Zero, "the trail fades once N1's window closes");
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator KillShattersIntoFragmentsAndRestartClearsTheEffects()
    {
      ZhaoYunController controller = null;
      ScriptedInput input = null;
      yield return Scene((c, i) => { controller = c; input = i; });
      var sim = controller.Simulation;
      var view = controller.Effects;
      long killFrame = -1;
      int kills = 0, fragmentsAtKill = 0;
      for (int frame = 0; frame < 600 && killFrame < 0; frame++)
      {
        if (frame % 15 == 0) input.Down.Add("KeyJ");
        if (frame % 15 == 1) input.Up.Add("KeyJ");
        int before = view.Fragments.Count;
        controller.Tick(Dt);
        if (sim.Kills.Count == 0) continue;
        kills = sim.Kills.Count;
        killFrame = LastFrame(view).Frame;
        fragmentsAtKill = view.Fragments.Count - before;
      }
      Assert.That(killFrame, Is.GreaterThanOrEqualTo(0), "the string never killed a dummy");
      // Training dummies are spear soldiers: 18 fragments each, a dust puff, one shatter sound for the frame.
      Assert.That(fragmentsAtKill, Is.EqualTo(18 * kills));
      var cues = CuesOf(view, killFrame);
      Assert.That(cues.Count(c => c.Name == "fragments.spawnSoldier"), Is.EqualTo(kills));
      Assert.That(cues.Count(c => c.Name == "audio.shatter"), Is.EqualTo(1));
      Assert.That(LastFrame(view).Kills, Is.EqualTo(kills));
      yield return null;
      var mesh = view.transform.Find("Fragments").GetComponent<MeshFilter>().sharedMesh;
      Assert.That(mesh.vertexCount, Is.EqualTo(view.Fragments.Count * 24), "six faces per voxel");
      Assert.That(view.Dust.Count, Is.GreaterThan(0));

      controller.Restart();
      Assert.That(view.Fragments.Count + view.Sparks.Count + view.Dust.Count + view.Trail.Count + view.Waves.ActiveCount, Is.Zero,
        "a new fight starts without the last one's effects");
      yield return null;
      Assert.That(view.transform.Find("Fragments").GetComponent<MeshFilter>().sharedMesh.vertexCount, Is.Zero);
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator StrikesMusouReadyAndTheFinaleShowTheirFeedback()
    {
      ZhaoYunController controller = null;
      ScriptedInput input = null;
      yield return Scene((c, i) => { controller = c; input = i; });
      var sim = controller.Simulation;
      var view = controller.Effects;
      controller.Tick(Dt);
      controller.InjectStrike(true);
      var hurt = CuesOf(view, LastFrame(view).Frame);
      Assert.That(hurt.Select(c => c.Name), Is.EqualTo(new[] { "audio.enemySwing", "audio.playerHurt", "camera.addTrauma", "sparks.burst" }));
      Assert.That(view.Sparks.Count, Is.EqualTo(7));
      for (int frame = 0; frame < 150; frame++) controller.Tick(Dt);

      sim.Player.GainMusou(100);
      controller.Tick(Dt);
      Assert.That(CuesOf(view, LastFrame(view).Frame).Select(c => c.Name), Does.Contain("audio.musouReady").And.Contain("hud.showBanner"));
      Assert.That(view.BannerText, Does.Contain("Longdan"));
      Assert.That(view.BannerLeft, Is.GreaterThan(1));

      input.Down.Add("KeyL");
      controller.Tick(Dt);
      input.Up.Add("KeyL");
      Assert.That(sim.Player.State, Is.EqualTo(PlayerState.Musou));
      Assert.That(view.Cutins, Is.EqualTo(1));
      bool blast = false;
      for (int frame = 0; frame < 300 && !blast; frame++)
      {
        controller.Tick(Dt);
        blast = CuesOf(view, LastFrame(view).Frame).Any(c => c.Name == "waves.pillar");
      }
      Assert.That(blast, Is.True, "the musou finale raises its light pillar");
      Assert.That(view.Waves.Pillars.Count(p => p.Active), Is.EqualTo(1));
      Assert.That(view.Waves.Rings.Count(r => r.Active), Is.GreaterThanOrEqualTo(2));
      Assert.That(view.Post.Flash, Is.GreaterThan(0), "kept for the trace (post-processing is not drawn)");
      yield return null;
      Assert.That(view.transform.Find("Pillars").GetComponent<MeshFilter>().sharedMesh.vertexCount, Is.EqualTo(66));
      LogAssert.NoUnexpectedReceived();
    }

    // The sound reaches the audio thread: a queued voice starts with the first audio buffer after the request.
    [UnityTest] public IEnumerator QueuedSoundStartsWithTheNextAudioBuffer()
    {
      ZhaoYunController controller = null;
      yield return Scene((c, i) => controller = c);
      controller.Tick(Dt);
      controller.Effects.SetCamera(Camera.main, controller.Shake);
      var bank = controller.Effects.Sound;
      Assert.That(bank, Is.Not.Null, "no audio output: AudioSettings.outputSampleRate " + AudioSettings.outputSampleRate);
      var prewarm = controller.Effects.Prewarm;
      float deadline = Time.realtimeSinceStartup + 30;
      while (!prewarm.IsCompleted && Time.realtimeSinceStartup < deadline) yield return null;
      Assert.That(prewarm.IsCompleted && !prewarm.IsFaulted, Is.True, "variants rendered");
      var mixer = bank.Mixer;
      long first = mixer.SamplesRendered;
      deadline = Time.realtimeSinceStartup + 3;
      while (mixer.SamplesRendered == first && Time.realtimeSinceStartup < deadline) yield return null;
      Assert.That(mixer.SamplesRendered, Is.GreaterThan(first), "the audio thread pulls the mixer through the listener");
      var starts = new List<(int Id, long Sample)>();
      mixer.TakeStarts(starts);
      long requestedAt = mixer.SamplesRendered;
      bank.Hit(HitSfx.Heavy, 3, 0);
      int id = bank.LastRequest;
      deadline = Time.realtimeSinceStartup + 3;
      long started = -1;
      while (started < 0 && Time.realtimeSinceStartup < deadline)
      {
        yield return null;
        mixer.TakeStarts(starts);
        foreach (var s in starts) if (s.Id == id) started = s.Sample;
      }
      AudioSettings.GetDSPBufferSize(out int buffer, out _);
      TestContext.WriteLine($"rate {mixer.Rate}, buffer {buffer}, requested at {requestedAt}, started at {started}");
      Assert.That(started, Is.GreaterThanOrEqualTo(requestedAt));
      Assert.That(started - requestedAt, Is.LessThanOrEqualTo(2 * buffer), "within the buffer being mixed when it was queued and the next");
      LogAssert.NoUnexpectedReceived();
    }
  }
}
