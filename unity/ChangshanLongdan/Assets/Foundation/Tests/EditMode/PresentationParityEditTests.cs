using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
using Changshan.Feedback;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E07 feedback: the ported Presentation, particles and trail replayed against the unmodified Web
  // (TestData/combat/web-presentation.json), and the event order the simulation hands to it.
  public sealed class PresentationParityEditTests
  {
    static readonly string[] ScenarioIds = { "string_crowd", "charge_crowd", "air_dodge", "musou_crowd", "guard_and_hurt" };

    static string root;
    static Dictionary<string, object> fixture;

    static Dictionary<string, object> Fixture
    {
      get
      {
        if (fixture != null) return fixture;
        root = CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
        return fixture = PresentationParity.Load(root);
      }
    }

    [Test] public void FixtureWasGeneratedFromTheCurrentWebSource()
    {
      Assert.That(Fixture["schemaVersion"], Is.EqualTo(1.0));
      var result = CombatParity.CompareSources(Fixture, root);
      Assert.That(result.FailCount, Is.Zero, result.ToString());
      var ids = PresentationParity.Scenarios(Fixture).Select(s => (string)s["id"]).Distinct().ToArray();
      Assert.That(ids, Is.EquivalentTo(ScenarioIds));
    }

    [Test] public void FragmentPaletteMatchesTheWebSoldierColors()
    {
      var result = PresentationParity.ComparePalette(Fixture);
      Assert.That(result.FailCount, Is.Zero, result.ToString());
    }

    [TestCase(30.0)]
    [TestCase(60.0)]
    [TestCase(120.0)]
    public void PresentationMatchesTheWebFrameByFrame(double hz)
    {
      var total = new CombatParity.Result();
      var calls = new Dictionary<string, int>();
      int scenarios = 0;
      foreach (var s in PresentationParity.Scenarios(Fixture).Where(s => (double)s["hz"] == hz))
      {
        var replay = PresentationParity.Run(Fixture, s);
        total.Merge((string)s["id"], replay.Result);
        foreach (var c in replay.Calls) calls[c.Key] = (calls.TryGetValue(c.Key, out int n) ? n : 0) + c.Value;
        Assert.That(replay.Draws, Is.GreaterThan(0), (string)s["id"]);
        scenarios++;
      }
      Assert.That(scenarios, Is.GreaterThanOrEqualTo(2));
      Assert.That(total.FailCount, Is.Zero, total.ToString());
      TestContext.WriteLine($"{hz} Hz: {total}");
      if (hz == 30 || hz == 60)
      {
        // Every output the ported events drive is exercised at these rates.
        string[] expected =
        {
          "audio.swing", "audio.jump", "audio.land", "audio.dodge", "audio.hit", "audio.shatter", "audio.enemySwing", "audio.playerHurt",
          "audio.musouStart", "audio.musouBlast", "audio.musouReady", "audio.setMusicLevel", "sparks.burst", "dust.puff", "dust.ring",
          "waves.ring", "waves.pillar", "fragments.spawnSoldier", "camera.addTrauma", "camera.kick", "post.aberration", "post.radial",
          "post.flash", "hud.showBanner", "hud.playCutin",
        };
        Assert.That(expected.Where(name => !calls.ContainsKey(name)), Is.Empty);
      }
    }

    [Test] public void TrailMatchesTheWebFrameByFrame()
    {
      int rates = 0;
      foreach (var t in PresentationParity.Trails(Fixture))
      {
        var result = PresentationParity.RunTrail(t);
        Assert.That(result.FailCount, Is.Zero, result.ToString());
        Assert.That(result.Frames, Is.GreaterThan(20));
        rates++;
      }
      Assert.That(rates, Is.EqualTo(3));
    }

    // A changed port must be caught: one extra draw shifts the shared stream; sparks that are never spawned change the counts.
    [Test] public void ReplayDetectsADivergingPort()
    {
      var s = PresentationParity.Scenarios(Fixture).First(x => (string)x["id"] == "string_crowd" && (double)x["hz"] == 60);
      var extraDraw = PresentationParity.Run(Fixture, s, (director, frame) => { if (frame == 30) director.Rng.Next(); });
      Assert.That(extraDraw.Result.FailCount, Is.GreaterThan(0));
      Assert.That(extraDraw.Result.Mismatches, Has.Some.Contains("random draws differ"));
      var noSparks = PresentationParity.Run(Fixture, s, null, dropBursts: true);
      Assert.That(noSparks.Result.Mismatches, Has.Some.Contains("sparks count"));
    }

    // Battle.step's order: forwarded player events, the player's hits, kills, then the musou-ready notice; nothing
    // from the player while hit-stop holds the step; an injected strike's events alone.
    [Test] public void SimulationEventsReachThePresentationInBattleOrder()
    {
      var targets = new HitTargets(2);
      targets.Add(ArenaLayout.StartX + Math.Sin(ArenaLayout.StartFacing) * 1.6, 0, ArenaLayout.StartZ + Math.Cos(ArenaLayout.StartFacing) * 1.6, 1, 10);
      targets.Add(60, 0, 60, 1, 400);
      var sim = new CombatSimulation(targets);
      sim.Restart();
      var events = new List<FeedbackEvent>();
      var seen = new List<FeedbackEventType>();
      bool sawFrozen = false;
      sim.Player.GainMusou(99.5);
      for (int frame = 0; frame < 60; frame++)
      {
        var c = new PlayerControls { Attack = frame == 0 };
        sim.Step(1.0 / 60, c);
        FeedbackEvents.FromStep(sim, events);
        if (!sim.SteppedThisFrame)
        {
          Assert.That(events, Is.Empty, "hit-stop frame");
          sawFrozen = true;
        }
        if (events.Count == 0) continue;
        int last = -1;
        foreach (var e in events)
        {
          int rank = e.Type == FeedbackEventType.Hit ? 1 : e.Type == FeedbackEventType.Kill ? 2 : e.Type == FeedbackEventType.MusouReady ? 3 : 0;
          Assert.That(rank, Is.GreaterThanOrEqualTo(last), $"frame {frame}: {string.Join(",", events.Select(x => x.Type))}");
          last = rank;
          seen.Add(e.Type);
        }
      }
      Assert.That(sawFrozen, Is.True);
      Assert.That(seen, Has.Member(FeedbackEventType.Swing).And.Member(FeedbackEventType.Hit).And.Member(FeedbackEventType.Kill)
        .And.Member(FeedbackEventType.MusouReady));
      Assert.That(seen.Count(t => t == FeedbackEventType.MusouReady), Is.EqualTo(1), "announced once when the gauge fills");

      sim.InjectStrike(new EnemyStrike(26, false, sim.Player.X, sim.Player.Z + 2));
      FeedbackEvents.FromStrike(sim, events);
      Assert.That(events.Select(e => e.Type), Is.EqualTo(new[] { FeedbackEventType.EnemyStrike, FeedbackEventType.Hurt }));

      sim.Restart();
      sim.Player.GainMusou(100);
      sim.Step(1.0 / 60, default);
      FeedbackEvents.FromStep(sim, events);
      Assert.That(events.Select(e => e.Type), Has.Member(FeedbackEventType.MusouReady), "a restart forgets the gauge was full");
    }

    // The common trace keeps each frame's hits, damage and the cues issued for them together.
    [Test] public void TraceTiesCuesToTheFrameOfTheirHits()
    {
      var trace = new FeedbackTrace(8, 64);
      var hits = new List<HitEvent> { new HitEvent(3, 0.05, HitSource.Player, 1, MoveId.N1, 0, 0, 12, 30, false, 0, 1, 0, 0, 2) };
      trace.BeginFrame(7, 3, 0.05, true, hits, 0);
      trace.Add("sparks.burst", 1, 7);
      trace.Add("audio.hit", 3, 0, 1, 0.2);
      trace.EndFrame();
      trace.BeginFrame(8, 3, 0.05, false, new List<HitEvent>(), 0);
      trace.EndFrame();
      var frames = new List<FeedbackFrame>();
      var cues = new List<FeedbackCue>();
      trace.CopyFrames(frames);
      trace.CopyCues(cues);
      Assert.That(frames.Count, Is.EqualTo(2));
      Assert.That(frames[0].Hits, Is.EqualTo(1));
      Assert.That(frames[0].Damage, Is.EqualTo(12));
      Assert.That(frames[0].CueCount, Is.EqualTo(2));
      Assert.That(cues.Select(c => c.Frame), Is.All.EqualTo(7L));
      Assert.That(frames[1].Stepped, Is.False);
      Assert.That(frames[1].CueCount, Is.Zero);
      // Bounded: older entries are dropped, never reallocated.
      for (int i = 0; i < 100; i++) trace.Add("camera.addTrauma", 1, i);
      trace.CopyCues(cues);
      Assert.That(cues.Count, Is.EqualTo(64));
      Assert.That(cues[63].A0, Is.EqualTo(99));
    }

    [Test] public void DirectorRefusesMissingOutputs()
    {
      Assert.Throws<ArgumentException>(() => new FeedbackDirector(new FeedbackSinks { Sparks = new SparkField() }));
      Assert.Throws<ArgumentNullException>(() => new FeedbackEvent(FeedbackEventType.Hit));
    }

  }
}
