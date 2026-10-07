using System.Linq;
using Changshan.Combat;
using NUnit.Framework;

namespace Changshan.Foundation.Tests
{
  // DEV deterministic kills at separated coordinates, through the existing external-hit seam; no KO setters.
  public sealed class DirectorEventsEditTests
  {
    const double Dt = 1.0 / 60;
    static CombatSimulation Fight(int count, int capacity = 401)
    {
      var targets = new HitTargets(capacity) { Static = true, AiEnabled = false };
      for (int i = 0; i < count; i++) targets.Add(i * 25, 0, -50, 1, 1);
      var sim = new CombatSimulation(targets);
      sim.Restart();
      return sim;
    }

    static void Kill(CombatSimulation sim, int first, int count)
    {
      var hit = Moves.Get(MoveId.MUSOU).Hits[19];
      sim.Step(Dt, default, _ =>
      {
        for (int i = first; i < first + count; i++)
          Assert.That(sim.ApplyExternal((uint)(1_000_000 + i), hit, sim.Targets.X(i), 0, sim.Targets.Z(i), 0), Is.EqualTo(1));
      });
    }

    static CombatEvent[] Banners(CombatSimulation sim) => sim.Events.Where(e =>
      e.Type == CombatEventType.Milestone || e.Type == CombatEventType.HalfDefeated).ToArray();

    [Test] public void MilestoneAtOneHundredNotNinetyNineOrNextStep()
    {
      var sim = Fight(301);
      Kill(sim, 0, 99);
      Assert.That(Banners(sim), Is.Empty);
      Kill(sim, 99, 1);
      Assert.That(Banners(sim).Single().Type, Is.EqualTo(CombatEventType.Milestone));
      Assert.That(Banners(sim).Single().Ko, Is.EqualTo(100));
      sim.Step(Dt, default);
      Assert.That(Banners(sim), Is.Empty);
    }

    [Test] public void MultiBucketKillOnlyAnnouncesTheLatestBucket()
    {
      var sim = Fight(401);
      Kill(sim, 0, 250);
      Assert.That(Banners(sim).Length, Is.EqualTo(1));
      Assert.That(Banners(sim)[0].Ko, Is.EqualTo(200));
    }

    [Test] public void HalfRoundsUpFromSpawnCountNotCapacityAndOnlyAnnouncesOnce()
    {
      var sim = Fight(5);
      Kill(sim, 0, 2);
      Assert.That(Banners(sim), Is.Empty);
      Kill(sim, 2, 1);
      Assert.That(Banners(sim).Single().Type, Is.EqualTo(CombatEventType.HalfDefeated));
      Kill(sim, 3, 1);
      Assert.That(Banners(sim), Is.Empty);
    }

    [Test] public void CoincidentHalfAndMilestoneOnlyAnnouncesMilestone()
    {
      var sim = Fight(200);
      Kill(sim, 0, 100);
      Assert.That(Banners(sim).Length, Is.EqualTo(1));
      Assert.That(Banners(sim)[0].Type, Is.EqualTo(CombatEventType.Milestone));
    }

    [Test] public void MilestoneDoesNotSuppressExistingMusouReadyEvent()
    {
      var sim = Fight(301);
      sim.Player.GainMusou(sim.Player.Tuning.MusouMax);
      Kill(sim, 0, 100);
      Assert.That(Banners(sim).Single().Type, Is.EqualTo(CombatEventType.Milestone));
      Assert.That(sim.Events.Count(e => e.Type == CombatEventType.MusouReady), Is.EqualTo(1));
      Assert.That(sim.Events.Last().Type, Is.EqualTo(CombatEventType.MusouReady));
      sim.Step(Dt, default);
      Assert.That(sim.Events.Any(e => e.Type == CombatEventType.MusouReady), Is.False);
    }

    [Test] public void AllDeadSuppressesMilestoneAndHalfButKeepsKillEvent()
    {
      foreach (int count in new[] { 1, 100 })
      {
        var sim = Fight(count);
        Kill(sim, 0, count);
        Assert.That(sim.Targets.AliveCount, Is.Zero);
        Assert.That(sim.KoCount, Is.EqualTo(count));
        Assert.That(Banners(sim), Is.Empty);
        Assert.That(sim.Events.Single(e => e.Type == CombatEventType.Kill).Count, Is.EqualTo(count));
      }
    }

    [Test] public void RestartRefreshesHalfThresholdWithoutAnnouncingOpening()
    {
      var sim = Fight(5);
      Kill(sim, 0, 3);
      sim.Targets.Clear();
      for (int i = 0; i < 9; i++) sim.Targets.Add(i * 25, 0, -50, 1, 1);
      sim.Restart();
      Assert.That(sim.Events, Is.Empty);
      Assert.That(sim.Phase, Is.EqualTo(BattlePhase.Opening));
      Kill(sim, 0, 4);
      Assert.That(Banners(sim), Is.Empty);
      Kill(sim, 4, 1);
      Assert.That(Banners(sim).Single().Type, Is.EqualTo(CombatEventType.HalfDefeated));
    }

    [Test] public void PhaseChangesOnceOnTheStepAfterCrossingEachThreshold()
    {
      var sim = Fight(301);
      var phases = new[] { BattlePhase.Pressure, BattlePhase.Surge, BattlePhase.Finale };
      var thresholds = new[] { 60, 150, 240 };
      int first = 0;
      for (int i = 0; i < phases.Length; i++)
      {
        var previous = i == 0 ? BattlePhase.Opening : phases[i - 1];
        Kill(sim, first, thresholds[i] - 1 - first);
        sim.Step(Dt, default);
        Assert.That(sim.KoCount, Is.EqualTo(thresholds[i] - 1));
        Assert.That(sim.Phase, Is.EqualTo(previous));
        Assert.That(sim.Events.Any(e => e.Type == CombatEventType.Phase), Is.False);
        var beforePressure = new BattleDirector().Update(thresholds[i] - 1, sim.Difficulty);
        Assert.That(sim.Targets.EngageRange, Is.EqualTo(beforePressure.EngageRange));
        Assert.That(sim.Targets.MaxAttackers, Is.EqualTo(beforePressure.MaxAttackers));
        Kill(sim, thresholds[i] - 1, 1);
        Assert.That(sim.KoCount, Is.EqualTo(thresholds[i]));
        Assert.That(sim.Phase, Is.EqualTo(previous));
        Assert.That(sim.Events.Any(e => e.Type == CombatEventType.Phase), Is.False);
        sim.Step(Dt, default);
        Assert.That(sim.Events.Single(e => e.Type == CombatEventType.Phase).Phase, Is.EqualTo(phases[i]));
        Assert.That(sim.Phase, Is.EqualTo(phases[i]));
        var afterPressure = new BattleDirector().Update(thresholds[i], sim.Difficulty);
        Assert.That(sim.Targets.EngageRange, Is.EqualTo(afterPressure.EngageRange));
        Assert.That(sim.Targets.MaxAttackers, Is.EqualTo(afterPressure.MaxAttackers));
        sim.Step(Dt, default);
        Assert.That(sim.Events.Any(e => e.Type == CombatEventType.Phase), Is.False);
        first = thresholds[i];
      }
    }
  }
}
