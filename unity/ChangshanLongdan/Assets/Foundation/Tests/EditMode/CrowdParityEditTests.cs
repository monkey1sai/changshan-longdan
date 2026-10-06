using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E08: the soldier AI, attack tokens, director pressure and the four difficulties replayed against the unmodified
  // Web Battle (TestData/combat/web-crowd.json), plus the rules the fixture cannot isolate.
  public sealed class CrowdParityEditTests
  {
    static readonly string[] ScenarioIds =
    {
      "six_idle_beginner", "six_idle_normal", "six_idle_hard", "six_idle_chaos", "six_guard_normal", "six_attack_normal", "eighteen_march_normal",
      "twentyfour_rings_chaos", "six_walk_hard",
    };
    static readonly string[] CastleIds = { "castle_normal_idle", "castle_chaos_idle" };

    static string root;
    static Dictionary<string, object> fixture;

    static Dictionary<string, object> Fixture
    {
      get
      {
        if (fixture != null) return fixture;
        root = CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
        return fixture = CrowdParity.Load(root);
      }
    }

    static IEnumerable<Dictionary<string, object>> At(double hz) => CrowdParity.Scenarios(Fixture).Where(s => (double)s["hz"] == hz);
    static bool IsSummary(Dictionary<string, object> s) => s["summary"] is bool b && b;

    [Test] public void FixtureWasGeneratedFromTheCurrentWebSource()
    {
      Assert.That(Fixture["schemaVersion"], Is.EqualTo(1.0));
      var result = CombatParity.CompareSources(Fixture, root);
      Assert.That(result.FailCount, Is.Zero, result.ToString());
    }

    [Test] public void ScenarioSetIsComplete()
    {
      foreach (double hz in new double[] { 30, 120 })
        Assert.That(At(hz).Select(s => (string)s["id"]), Is.EqualTo(ScenarioIds), $"{hz} Hz");
      Assert.That(At(60).Select(s => (string)s["id"]), Is.EqualTo(ScenarioIds.Concat(CastleIds)), "60 Hz");
    }

    [TestCase(30), TestCase(60), TestCase(120)]
    public void CrowdTracesMatchWeb(double hz)
    {
      var all = new CombatParity.Result();
      var states = new HashSet<EnemyState>();
      var invariants = new List<string>();
      foreach (var s in At(hz).Where(s => !IsSummary(s)))
      {
        var replay = CrowdParity.Run(s);
        all.Merge((string)s["id"], replay.Result);
        states.UnionWith(replay.StatesSeen);
        invariants.AddRange(replay.InvariantFailures);
      }
      TestContext.WriteLine(all.ToString());
      Assert.That(all.FailCount, Is.Zero, all.ToString());
      Assert.That(all.Frames, Is.GreaterThan(1000));
      Assert.That(invariants, Is.Empty);
      // Living soldiers only (a killed soldier leaves the living set), so Dead is checked through the kill events in the fixture.
      Assert.That(states, Is.SupersetOf(new[] { EnemyState.Engage, EnemyState.Windup, EnemyState.Strike, EnemyState.Recover, EnemyState.March, EnemyState.Flinch }));
    }

    // The castle: 300 soldiers for six seconds, compared per second (counts, states, tokens, kills, the player).
    [Test] public void CastleSummariesMatchWeb()
    {
      foreach (var s in At(60).Where(IsSummary))
      {
        var replay = CrowdParity.Run(s);
        TestContext.WriteLine($"{s["id"]}: {replay.Result} maxEngaged={replay.MaxEngagedSeen} maxAttackers={replay.MaxAttackersSeen}/{replay.MaxAttackersAllowed}");
        Assert.That(replay.Result.FailCount, Is.Zero, replay.Result.ToString());
        Assert.That(replay.Result.Frames, Is.GreaterThanOrEqualTo(6));
        Assert.That(replay.InvariantFailures, Is.Empty);
        Assert.That(replay.MaxEngagedSeen, Is.LessThanOrEqualTo(HitTargets.MaxEngaged));
        Assert.That(replay.MaxAttackersSeen, Is.LessThanOrEqualTo(replay.MaxAttackersAllowed));
      }
    }

    [Test] public void DifficultyTableMatchesWeb()
    {
      var table = (Dictionary<string, object>)Fixture["difficulties"];
      foreach (var d in Difficulties.All)
      {
        var row = (List<object>)table[d.Id.ToString().ToLowerInvariant()];
        Assert.That(new[] { d.EnemyDamage, d.Windup, d.CaptainHp, d.MaxAttackers, d.EngageRange }, Is.EqualTo(row.Select(v => (double)v)), d.Name);
      }
    }

    [Test] public void DirectorPhasesFollowTheKills()
    {
      var director = new BattleDirector();
      Assert.That(director.Update(0, Difficulties.Normal).Phase, Is.EqualTo(BattlePhase.Opening));
      Assert.That(director.Update(59, Difficulties.Normal).MaxAttackers, Is.EqualTo(4));
      var p = director.Update(60, Difficulties.Normal);
      Assert.That(p.Phase, Is.EqualTo(BattlePhase.Pressure));
      Assert.That(p.EngageRange, Is.EqualTo(30));
      p = director.Update(150, Difficulties.Hard);
      Assert.That((p.Phase, p.EngageRange, p.MaxAttackers), Is.EqualTo((BattlePhase.Surge, 38.0, 6)));
      p = director.Update(240, Difficulties.Chaos);
      Assert.That((p.Phase, p.EngageRange, p.MaxAttackers), Is.EqualTo((BattlePhase.Finale, 46.0, 8)));
      director.Reset();
      Assert.That(director.Phase, Is.EqualTo(BattlePhase.Opening));
    }

    // Port of the whole castle: the same 300 spawns as the Web (mulberry32(7) jitter), captains and swords where the Web puts them.
    [Test] public void CastleSpawnsMatchWeb()
    {
      var expected = CrowdParity.SpawnsOf(At(60).First(s => (string)s["id"] == "castle_normal_idle"));
      var spawns = CastleLayout.Spawns();
      Assert.That(spawns.Count, Is.EqualTo(300));
      Assert.That(expected.Count, Is.EqualTo(300));
      for (int i = 0; i < 300; i++)
      {
        Assert.That(spawns[i].X, Is.EqualTo(expected[i].X).Within(1e-6), $"spawn {i} x");
        Assert.That(spawns[i].Z, Is.EqualTo(expected[i].Z).Within(1e-6), $"spawn {i} z");
        Assert.That(spawns[i].Yaw, Is.EqualTo(expected[i].Yaw).Within(1e-6), $"spawn {i} yaw");
        Assert.That(spawns[i].Kind, Is.EqualTo(expected[i].Kind), $"spawn {i} kind");
      }
      Assert.That(spawns.Count(s => s.Kind == EnemyKind.Captain), Is.EqualTo(9));
    }

    // Equal distances keep index order (the Web's stable sort): the lower index takes the inner ring.
    [Test] public void EngagementOrderIsStableOnEqualDistances()
    {
      var targets = new HitTargets(20);
      var spawns = new List<Spawn>();
      for (int i = 0; i < 20; i++) spawns.Add(new Spawn(i < 10 ? 5 : -5, ArenaLayout.StartZ + (i % 10 == 0 ? 0 : 0.001 * (i % 10)), 0, EnemyKind.Spear));
      targets.Reset(spawns);
      targets.Step(1.0 / 60, ArenaLayout.StartX, 0, ArenaLayout.StartZ, ArenaLayout.CreateArena());
      // Soldiers 0 and 10 are exactly 5 m away: index 0 is sorted first and lands on the first ring with the next eight.
      Assert.That(targets.Ring(0), Is.EqualTo(2.7).Within(1e-6));
      Assert.That(targets.Ring(10), Is.EqualTo(2.7).Within(1e-6));
      Assert.That(Enumerable.Range(0, 20).Count(i => targets.Ring(i) > 2.7 + 1e-6), Is.EqualTo(11), "the tenth and later soldiers take the second ring");
      Assert.That(targets.EngagedCount, Is.EqualTo(20));
    }

    [Test] public void TokensAreCappedAndReturnedOnHits()
    {
      var targets = new HitTargets(12);
      var spawns = new List<Spawn>();
      for (int i = 0; i < 12; i++) spawns.Add(new Spawn(Math.Sin(i * 0.5) * 3, ArenaLayout.StartZ - 3 - Math.Cos(i * 0.5) * 0.5, 0, EnemyKind.Spear));
      targets.Reset(spawns);
      var arena = ArenaLayout.CreateArena();
      int maxAttackers = 0;
      for (int f = 0; f < 600; f++)
      {
        targets.Step(1.0 / 60, ArenaLayout.StartX, 0, ArenaLayout.StartZ, arena);
        maxAttackers = Math.Max(maxAttackers, targets.Attackers);
        Assert.That(targets.Attackers, Is.LessThanOrEqualTo(targets.MaxAttackers));
      }
      Assert.That(maxAttackers, Is.EqualTo(Difficulties.Normal.MaxAttackers), "normal difficulty hands out four tokens");
      int holder = Enumerable.Range(0, 12).First(i => targets.Token(i));
      var resolver = new HitResolver(targets);
      var hits = new List<HitEvent>();
      resolver.Apply(1, new HitWindow(0, 0, HitShape.Circle(0.6), 1, Reaction.Flinch), targets.X(holder), 0, targets.Z(holder), 0, HitSource.External, null, -1, 0, 0, hits);
      Assert.That(hits.Select(h => h.Target), Does.Contain(holder));
      Assert.That(targets.Token(holder), Is.False, "a hit returns the attack token");
    }

    [Test] public void SoldierClosesInAndStrikesThePlayer()
    {
      var targets = new HitTargets(1);
      targets.Reset(new[] { new Spawn(ArenaLayout.StartX, ArenaLayout.StartZ - 4, 0, EnemyKind.Spear) });
      var sim = new CombatSimulation(targets);
      sim.Restart();
      var seen = new HashSet<EnemyState>();
      bool struck = false;
      for (int f = 0; f < 600 && !struck; f++)
      {
        sim.Step(1.0 / 60, default);
        seen.Add(targets.State(0));
        foreach (var e in sim.Events) if (e.Type == CombatEventType.EnemyStrike) struck = true;
      }
      Assert.That(struck, Is.True, "the soldier never attacked");
      Assert.That(seen, Is.SupersetOf(new[] { EnemyState.Engage, EnemyState.Windup, EnemyState.Strike }));
      Assert.That(sim.DamageSum, Is.EqualTo(26).Within(1e-9), "a soldier's strike does 26 on normal");
      Assert.That(sim.Player.State, Is.EqualTo(PlayerState.Hurt));
    }

    [Test] public void AiOffKeepsSoldiersStanding()
    {
      var targets = new HitTargets(1) { AiEnabled = false };
      targets.Reset(new[] { new Spawn(ArenaLayout.StartX, ArenaLayout.StartZ - 4, 0, EnemyKind.Spear) });
      var sim = new CombatSimulation(targets);
      sim.Restart();
      for (int f = 0; f < 300; f++)
      {
        sim.Step(1.0 / 60, default);
        Assert.That(targets.State(0), Is.EqualTo(EnemyState.Idle));
        Assert.That(sim.Events, Is.Empty);
      }
      Assert.That(targets.Engaged(0), Is.False);
      Assert.That(targets.Z(0), Is.EqualTo(ArenaLayout.StartZ - 4).Within(1e-5), "a standing soldier does not move");
    }

    [Test] public void DifficultyChangesStrikeDamageAndCaptainHealth()
    {
      foreach (var d in Difficulties.All)
      {
        var targets = new HitTargets(1);
        var sim = new CombatSimulation(targets);
        sim.SetDifficulty(d);
        targets.Reset(new[] { new Spawn(ArenaLayout.StartX, ArenaLayout.StartZ - 3, 0, EnemyKind.Captain) });
        sim.Restart();
        Assert.That(targets.Hp(0), Is.EqualTo((float)(230 * d.CaptainHp)), d.Name);
        bool struck = false;
        for (int f = 0; f < 900 && !struck; f++)
        {
          sim.Step(1.0 / 60, default);
          foreach (var e in sim.Events) if (e.Type == CombatEventType.EnemyStrike) struck = e.Heavy;
        }
        Assert.That(struck, Is.True, d.Name + ": the captain never attacked");
        Assert.That(sim.DamageSum, Is.EqualTo(70 * d.EnemyDamage).Within(1e-9), d.Name);
      }
    }
  }
}
