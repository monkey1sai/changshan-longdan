using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E07: soldier reactions, the player's hurt loop and the presentation events replayed against the unmodified Web
  // (TestData/combat/web-reactions.json), plus the rules the fixture cannot isolate.
  public sealed class ReactionParityEditTests
  {
    static readonly string[] ScenarioIds =
    {
      "flinch_twice", "launch_juggle_land", "knockback_crowd", "blowaway_captain_and_soldier", "knockdown_cycles", "getup_flinch",
      "captain_flinch_push", "kill_velocities", "n6_string_crowd", "c5_crowd", "musou_crowd", "hurt_light", "hurt_heavy_down_invuln",
      "guard_parry_then_block", "armor_half_damage", "death",
    };

    static string root;
    static Dictionary<string, object> fixture;

    static Dictionary<string, object> Fixture
    {
      get
      {
        if (fixture != null) return fixture;
        root = CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
        return fixture = ReactionParity.Load(root);
      }
    }

    static IEnumerable<Dictionary<string, object>> At(double hz) => ReactionParity.Scenarios(Fixture).Where(s => (double)s["hz"] == hz);

    [Test] public void FixtureWasGeneratedFromTheCurrentWebSource()
    {
      Assert.That(Fixture["schemaVersion"], Is.EqualTo(1.0));
      var result = CombatParity.CompareSources(Fixture, root);
      Assert.That(result.FailCount, Is.Zero, result.ToString());
    }

    [Test] public void ScenarioSetIsComplete()
    {
      foreach (double hz in new double[] { 30, 60, 120 })
        Assert.That(At(hz).Select(s => (string)s["id"]), Is.EqualTo(ScenarioIds), $"{hz} Hz");
    }

    [TestCase(30), TestCase(60), TestCase(120)]
    public void ReactionTracesMatchWeb(double hz)
    {
      var all = new CombatParity.Result();
      var states = new HashSet<EnemyState>();
      foreach (var s in At(hz))
      {
        var replay = ReactionParity.Run(s);
        all.Merge((string)s["id"], replay.Result);
        states.UnionWith(replay.StatesSeen);
      }
      TestContext.WriteLine(all.ToString());
      Assert.That(all.FailCount, Is.Zero, all.ToString());
      Assert.That(all.Frames, Is.GreaterThan(1000));
      Assert.That(states, Is.EquivalentTo((EnemyState[])Enum.GetValues(typeof(EnemyState))), "every reaction state must be shown");
    }

    [Test] public void Mulberry32MatchesTheWebStream()
    {
      var rng = new Mulberry32(HitTargets.DefaultSeed);
      double[] expected = { 0.011704753153026104, 0.061958257574588060, 0.97690763277933002, 0.69902870571240783 };
      foreach (double v in expected) Assert.That(rng.Next(), Is.EqualTo(v).Within(1e-17));
    }

    // Hits are applied in the Web's spatial-hash order (cells by x then z), not in index order: reactions and rng draws follow it.
    [Test] public void HitOrderFollowsTheSpatialHash()
    {
      var targets = new HitTargets(2);
      targets.Add(3, 0, 0, 1, 100);
      targets.Add(-3, 0, 0, 1, 100);
      var resolver = new HitResolver(targets);
      var hits = new List<HitEvent>();
      resolver.Apply(1, new HitWindow(0, 0, HitShape.Circle(4), 1, Reaction.Flinch), 0, 0, 0, 0, HitSource.External, null, -1, 0, 0, hits);
      Assert.That(hits.Select(h => h.Target), Is.EqualTo(new[] { 1, 0 }));
    }

    [Test] public void CaptainTakesLessPushAndLift()
    {
      var targets = new HitTargets(2);
      targets.Reset(new[] { new Spawn(0, -2, 0, EnemyKind.Spear), new Spawn(1, -2, 0, EnemyKind.Captain) });
      var resolver = new HitResolver(targets);
      var hits = new List<HitEvent>();
      var launch = Moves.Get(MoveId.C1).Hits[0]; // push 2, lift 8
      resolver.Apply(1, new HitWindow(0, 0, HitShape.Circle(4), 1, Reaction.Launch, push: launch.Push, lift: launch.Lift), 0, 0, 0, Math.PI, HitSource.External, null, -1, 0, 0, hits);
      Assert.That(hits.Count, Is.EqualTo(2));
      Assert.That(CombatMath.Hypot(targets.Vx(0), targets.Vz(0)), Is.EqualTo(2).Within(1e-6));
      Assert.That(targets.Vy(0), Is.EqualTo(8).Within(1e-6));
      Assert.That(CombatMath.Hypot(targets.Vx(1), targets.Vz(1)), Is.EqualTo(2 * 0.6).Within(1e-6));
      Assert.That(targets.Vy(1), Is.EqualTo(8 * 0.7).Within(1e-6));
      Assert.That(targets.State(0), Is.EqualTo(EnemyState.Air));
      Assert.That(targets.Y(0), Is.EqualTo(0.01).Within(1e-6));
      // A knockdown on an airborne soldier slams it down at -10 m/s with half the push.
      resolver.Apply(2, new HitWindow(0, 0, HitShape.Circle(4), 1, Reaction.Knockdown, push: 4), 0, 0, 0, Math.PI, HitSource.External, null, -1, 0, 0, hits);
      Assert.That(targets.Vy(0), Is.EqualTo(-10));
      Assert.That(CombatMath.Hypot(targets.Vx(0), targets.Vz(0)), Is.EqualTo(2).Within(1e-6));
    }

    [Test] public void ReactionsRecoverToStandingOnTheWebTimers()
    {
      var targets = new HitTargets(1);
      targets.Reset(new[] { new Spawn(0, -2, 0, EnemyKind.Spear) });
      var arena = ArenaLayout.CreateArena();
      var resolver = new HitResolver(targets);
      var hits = new List<HitEvent>();
      resolver.Apply(1, new HitWindow(0, 0, HitShape.Circle(4), 1, Reaction.Knockdown), 0, 0, 0, Math.PI, HitSource.External, null, -1, 0, 0, hits);
      Assert.That(targets.State(0), Is.EqualTo(EnemyState.Down));
      double t = 0;
      void Until(Func<bool> done, double limit)
      {
        double start = t;
        while (!done() && t - start < limit)
        {
          targets.Step(1.0 / 60, 0, 0, 0, arena);
          t += 1.0 / 60;
        }
      }
      Until(() => targets.State(0) == EnemyState.Getup, 2);
      Assert.That(t, Is.EqualTo(1.15).Within(0.02), "Down lasts 1.15 s");
      Until(() => targets.State(0) == EnemyState.Idle, 2);
      Assert.That(t, Is.EqualTo(1.65).Within(0.02), "Getup lasts 0.5 s");
      resolver.Apply(2, new HitWindow(0, 0, HitShape.Circle(4), 1, Reaction.Flinch), 0, 0, 0, Math.PI, HitSource.External, null, -1, 0, 0, hits);
      double from = t;
      Until(() => targets.State(0) == EnemyState.Idle, 2);
      Assert.That(t - from, Is.EqualTo(0.42).Within(0.02), "Flinch lasts 0.42 s");
      Assert.That(targets.Y(0), Is.Zero);
      Assert.That(targets.Flash(0), Is.LessThan(0.02), "flash decays at 9 per second");
    }

    [Test] public void SeparationPushesOverlappingSoldiersApart()
    {
      var targets = new HitTargets(2);
      targets.Reset(new[] { new Spawn(0, 5, 0, EnemyKind.Spear), new Spawn(0.2, 5, 0, EnemyKind.Spear) });
      targets.Step(1.0 / 60, 0, 0, 0, ArenaLayout.CreateArena());
      double minD = (targets.Scale(0) + targets.Scale(1)) * HitTargets.BodyRadius;
      Assert.That(Math.Abs(targets.X(1) - targets.X(0)), Is.EqualTo(minD).Within(1e-5));
      // Soldiers also keep 0.95 m from the player.
      var near = new HitTargets(1);
      near.Reset(new[] { new Spawn(0.3, 0.3, 0, EnemyKind.Spear) });
      near.Step(1.0 / 60, 0, 0, 0, ArenaLayout.CreateArena());
      Assert.That(CombatMath.Hypot(near.X(0), near.Z(0)), Is.EqualTo(0.95).Within(1e-5));
    }

    [Test] public void KillRecordsHowTheBodyFlies()
    {
      var targets = new HitTargets(1);
      targets.Reset(new[] { new Spawn(0, -2, 0, EnemyKind.Spear) });
      targets.SetHp(0, 1);
      var resolver = new HitResolver(targets);
      var hits = new List<HitEvent>();
      resolver.Apply(1, new HitWindow(0, 0, HitShape.Circle(4), 5, Reaction.Launch, push: 2, lift: 8), 0, 0, 0, Math.PI, HitSource.External, null, -1, 0, 0, hits);
      Assert.That(hits[0].Killed, Is.True);
      Assert.That(targets.AliveCount, Is.Zero);
      Assert.That(targets.State(0), Is.EqualTo(EnemyState.Dead));
      var k = targets.Kills.Single();
      Assert.That(k.Vy, Is.EqualTo(8 * 0.8).Within(1e-9));
      Assert.That(CombatMath.Hypot(k.Vx, k.Vz), Is.EqualTo(2 * 0.8).Within(1e-6));
      Assert.That(k.Kind, Is.EqualTo(EnemyKind.Spear));
    }

    [Test] public void StrikesResolveOutsideTheStepWithBattleRules()
    {
      var sim = new CombatSimulation(new HitTargets(0));
      sim.Restart();
      Assert.Throws<InvalidOperationException>(() => sim.Step(1.0 / 60, default, _ => sim.InjectStrike(new EnemyStrike(26, false, 0, ArenaLayout.StartZ - 2))));
      double hp = sim.Player.Hp;
      sim.InjectStrike(new EnemyStrike(26, false, ArenaLayout.StartX, ArenaLayout.StartZ - 2));
      Assert.That(sim.Events.Select(e => e.Type), Is.EqualTo(new[] { CombatEventType.EnemyStrike, CombatEventType.Hurt }));
      Assert.That(sim.Player.State, Is.EqualTo(PlayerState.Hurt));
      Assert.That(sim.DamageSum, Is.EqualTo(hp - sim.Player.Hp).Within(1e-9));
      Assert.That(sim.Player.Musou, Is.EqualTo(4).Within(1e-9), "a hit charges 4 musou");
      // Reset clears the frame lists and the damage taken.
      sim.Restart();
      Assert.That(sim.Events, Is.Empty);
      Assert.That(sim.DamageSum, Is.Zero);
    }

    [Test] public void FixtureStatesCoverEveryReaction()
    {
      var seen = new HashSet<int>();
      foreach (var s in At(60))
        foreach (var f in (List<object>)s["frames"])
          foreach (var n in (List<object>)((Dictionary<string, object>)f)["n"]) seen.Add((int)(double)((List<object>)n)[0]);
      Assert.That(seen, Is.EquivalentTo(((EnemyState[])Enum.GetValues(typeof(EnemyState))).Select(v => (int)v)));
    }
  }
}
