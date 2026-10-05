using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E05: hit identity, hit-stop and clocks, replayed against the unmodified Web (TestData/combat/web-hits.json).
  public sealed class HitParityEditTests
  {
    static readonly string[] ScenarioIds =
    {
      "n1_x1", "n1_x5", "n1_x20", "n4_x1", "n4_x5", "n4_x20", "c5_x1", "c5_x5", "c5_x20", "musou_x1", "musou_x5", "musou_x20",
      "n1_reach_sweep", "n1_width_sweep", "n2_angle_sweep", "n1_height_sweep", "c5_dodge_cancel", "kill_stops_later_hits",
      "c5_windows_shorter_than_step", "hitstop_charge_once", "n1_interleaved_second_source",
    };

    static string root;
    static Dictionary<string, object> fixture;
    static readonly Dictionary<string, HitParity.Replay> replays = new Dictionary<string, HitParity.Replay>();

    static Dictionary<string, object> Fixture
    {
      get
      {
        if (fixture != null) return fixture;
        root = CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
        return fixture = HitParity.Load(root);
      }
    }

    static IEnumerable<Dictionary<string, object>> At(double hz) => HitParity.Scenarios(Fixture).Where(s => (double)s["hz"] == hz);

    static HitParity.Replay Replay(Dictionary<string, object> s)
    {
      string key = $"{s["id"]}@{s["hz"]}";
      if (!replays.TryGetValue(key, out var r)) replays[key] = r = HitParity.Run(s, compareFrames: !(bool)s["divergent"]);
      return r;
    }

    [Test] public void FixtureWasGeneratedFromTheCurrentWebSource()
    {
      Assert.That(Fixture["schemaVersion"], Is.EqualTo(1.0));
      var result = CombatParity.CompareSources(Fixture, root);
      Assert.That(result.FailCount, Is.Zero, result.ToString());
    }

    // Exact set, so regenerating the fixture cannot silently drop a required case.
    [Test] public void ScenarioSetIsComplete()
    {
      Assert.That(HitParity.Scenarios(Fixture).Select(s => (string)s["id"]).Distinct(), Is.EquivalentTo(ScenarioIds));
      Assert.That(At(20).Select(s => (string)s["id"]), Is.EquivalentTo(new[] { "c5_windows_shorter_than_step" }));
      Assert.That(HitParity.Scenarios(Fixture).Count(s => (bool)s["divergent"]), Is.EqualTo(3));
    }

    [TestCase(20), TestCase(30), TestCase(60), TestCase(120)]
    public void HitTracesMatchWeb(double hz)
    {
      var all = new CombatParity.Result();
      foreach (var s in At(hz).Where(s => !(bool)s["divergent"])) all.Merge((string)s["id"], Replay(s).Result);
      TestContext.WriteLine(all.ToString());
      Assert.That(all.FailCount, Is.Zero, all.ToString());
      Assert.That(all.Frames, Is.GreaterThan(0));
    }

    // The Web keeps only the last stamp per soldier, so a second source in between lets one window hit again.
    // Unity must hit each (window instance, soldier) once and reach exactly the soldiers the Web reached.
    [Test] public void InterleavedSecondSourceHitsEachWindowOncePerSoldier()
    {
      foreach (var s in HitParity.Scenarios(Fixture).Where(s => (bool)s["divergent"]))
      {
        var (webPairs, webDuplicates) = HitParity.WebPlayerPairs(s);
        var unity = Replay(s).Hits.Where(h => h.StartsWith("P", StringComparison.Ordinal)).ToList();
        string at = $"{s["id"]}@{s["hz"]}";
        Assert.That(webDuplicates, Is.GreaterThan(0), $"{at}: the Web duplicate this case documents did not occur");
        Assert.That(unity, Is.Unique, at);
        Assert.That(unity, Is.EquivalentTo(webPairs), at);
        Assert.That(Replay(s).Hits.Any(h => h.StartsWith("F", StringComparison.Ordinal)), Is.True, $"{at}: second source never hit");
      }
    }

    [Test] public void EveryWindowInstanceHitsASoldierAtMostOnce()
    {
      foreach (var s in HitParity.Scenarios(Fixture))
        Assert.That(Replay(s).Hits, Is.Unique, $"{s["id"]}@{s["hz"]}");
    }

    // 20 soldiers struck in one tick stop the game for the longest window's hit-stop, not 20 times it.
    [Test] public void HitStopIsTheLongestRequestNotTheSum()
    {
      foreach (var s in HitParity.Scenarios(Fixture))
      {
        var r = Replay(s);
        Assert.That(r.MaxHitstop, Is.LessThanOrEqualTo(r.MaxWindowHitstop + 1e-12), $"{s["id"]}@{s["hz"]}");
      }
      var crowd = new HitTargets(20);
      for (int i = 0; i < 20; i++) crowd.Add(0.05 * i - 0.5, 0, ArenaLayout.StartZ - 1.5 - 0.01 * i, 1, 500);
      var sim = new CombatSimulation(crowd);
      sim.Restart();
      sim.Step(1.0 / 60, new PlayerControls { Charge = true }); // C1: arc 3.3 m, hit-stop 0.07 s
      int frames = 0;
      while (sim.TotalHits == 0 && frames++ < 60) sim.Step(1.0 / 60, default);
      Assert.That(sim.Hits.Count, Is.GreaterThanOrEqualTo(10), "one swing should strike most of the crowd at once");
      Assert.That(sim.Clock.Hitstop, Is.EqualTo(Moves.Get(MoveId.C1).Hits[0].Hitstop));
    }

    [Test] public void KilledSoldiersAreNeverHitAgain()
    {
      int kills = 0;
      foreach (var s in HitParity.Scenarios(Fixture))
      {
        var dead = new HashSet<int>();
        foreach (var e in Replay(s).Events)
        {
          Assert.That(dead.Contains(e.Target), Is.False, $"{s["id"]}@{s["hz"]}: soldier {e.Target} hit after death");
          if (e.Killed) dead.Add(e.Target);
        }
        kills += dead.Count;
      }
      Assert.That(kills, Is.GreaterThan(100));
    }

    // At 20 Hz a step (0.05 s) is longer than a C5 jab window (0.04 s); every window must still strike exactly once.
    [Test] public void WindowsShorterThanAStepStillHitOnce()
    {
      foreach (var s in HitParity.Scenarios(Fixture).Where(s => (string)s["id"] == "c5_windows_shorter_than_step"))
      {
        var c5 = Replay(s).Events.Where(e => e.Move == MoveId.C5).Select(e => e.WindowIndex).ToList();
        Assert.That(c5, Is.EquivalentTo(Enumerable.Range(0, Moves.Get(MoveId.C5).Hits.Count)), $"{s["hz"]} Hz");
      }
    }

    // Each sweep must straddle its edge, otherwise it would not test the boundary.
    [Test] public void BoundarySweepsStraddleTheEdge()
    {
      foreach (var s in HitParity.Scenarios(Fixture).Where(s => ((string)s["id"]).EndsWith("_sweep", StringComparison.Ordinal)))
      {
        int count = ((List<object>)s["targets"]).Count;
        int hit = Replay(s).Events.Select(e => e.Target).Distinct().Count();
        Assert.That(hit, Is.InRange(1, count - 1), $"{s["id"]}@{s["hz"]}");
      }
    }

    [Test] public void CancelledMovesStopHitting()
    {
      foreach (var s in HitParity.Scenarios(Fixture).Where(s => (string)s["id"] == "c5_dodge_cancel"))
        Assert.That(Replay(s).Events.Any(e => e.Move == MoveId.C5 && e.WindowIndex == 8), Is.False, $"{s["hz"]} Hz: finisher after dodge");
    }

    [Test] public void FinishedWindowsAreForgotten()
    {
      var targets = new HitTargets(1);
      targets.Add(0, 0, 2, 1, 500);
      var resolver = new HitResolver(targets);
      var events = new List<HitEvent>();
      var w = Moves.Get(MoveId.N5).Hits[0];
      resolver.BeginStep();
      Assert.That(resolver.Apply(7, w, 0, 0, 0, 0, HitSource.Player, MoveId.N5, 0, 1, 0, events), Is.EqualTo(1));
      resolver.BeginStep();
      Assert.That(resolver.Apply(7, w, 0, 0, 0, 0, HitSource.Player, MoveId.N5, 0, 2, 0, events), Is.Zero, "same window hit twice");
      Assert.That(resolver.RememberedPairs, Is.EqualTo(1));
      resolver.BeginStep(); // window 7 was applied last step, still active
      Assert.That(resolver.RememberedPairs, Is.EqualTo(1));
      resolver.BeginStep(); // not applied in the previous step: ended
      Assert.That(resolver.RememberedPairs, Is.Zero);
      Assert.That(resolver.ActiveWindows, Is.Zero);
      Assert.That(resolver.Apply(8, w, 0, 0, 0, 0, HitSource.Player, MoveId.N5, 0, 5, 0, events), Is.EqualTo(1), "a new instance hits again");
      Assert.Throws<ArgumentOutOfRangeException>(() => resolver.Apply(0, w, 0, 0, 0, 0, HitSource.Player, null, 0, 6, 0, events));
    }

    [Test] public void GameClockFreezesDuringHitstopAndScalesSlowMotion()
    {
      var clock = new GameClock();
      Assert.That(clock.Advance(0.02, out bool stepped), Is.EqualTo(0.02));
      Assert.That(stepped, Is.True);
      clock.AddHitstop(0.05);
      clock.AddHitstop(0.03);
      Assert.That(clock.Hitstop, Is.EqualTo(0.05), "hit-stop takes the longest request");
      double sim = clock.SimTime;
      int held = 0;
      while (clock.Hitstop > 0)
      {
        Assert.That(clock.Advance(0.02, out stepped), Is.Zero);
        Assert.That(stepped, Is.False);
        held++;
      }
      Assert.That(held, Is.EqualTo(3));
      Assert.That(clock.SimTime, Is.EqualTo(sim));
      clock.StartSlowmo(0.5);
      Assert.That(clock.Advance(0.02, out _), Is.EqualTo(0.02 * GameClock.SlowmoScale).Within(1e-15));
      Assert.That(clock.RealTime, Is.EqualTo(0.02 * 5).Within(1e-12));
      Assert.Throws<ArgumentOutOfRangeException>(() => clock.Advance(-0.01, out _));
      Assert.Throws<ArgumentOutOfRangeException>(() => clock.AddHitstop(double.NaN));
    }

    [Test] public void NearestIgnoresDeadAndOutOfReachTargets()
    {
      var targets = new HitTargets(3);
      targets.Add(0, 0, 1, 1, 5);
      targets.Add(0, 0, 2, 1, 50);
      targets.Add(0, 0, 9, 1, 50);
      Assert.That(targets.Nearest(0, 0, 6.5), Is.EqualTo(0));
      var resolver = new HitResolver(targets);
      resolver.Apply(1, Moves.Get(MoveId.N1).Hits[0], 0, 0, 0, 0, HitSource.Player, MoveId.N1, 0, 1, 0, new List<HitEvent>());
      Assert.That(targets.Alive(0), Is.False);
      Assert.That(targets.AliveCount, Is.EqualTo(2));
      Assert.That(targets.Nearest(0, 0, 6.5), Is.EqualTo(1));
      Assert.That(targets.Nearest(0, 0, 1.5), Is.EqualTo(-1));
      Assert.Throws<InvalidOperationException>(() => new HitTargets(0).Add(0, 0, 0, 1, 1));
      Assert.Throws<ArgumentOutOfRangeException>(() => new HitTargets(1).Add(0, 0, 0, 0, 1));
    }
  }
}
