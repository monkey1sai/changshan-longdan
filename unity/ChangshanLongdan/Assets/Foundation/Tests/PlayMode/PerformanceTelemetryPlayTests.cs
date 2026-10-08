using System;
using System.Collections.Generic;
using System.Linq;
using Changshan.Character;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Changshan.Foundation.Tests
{
  public sealed class PerformanceTelemetryPlayTests
  {
    const double Dt = 1.0 / 60;
    sealed class EmptyInput : IRawInputSource
    {
      public void Feed(InputMapper mapper) { }
    }

    sealed class Fixture : IDisposable
    {
      readonly GameObject root = new GameObject("Seed verification fixture");
      public readonly ZhaoYunController Controller;
      public readonly TrainingDummies Dummies;

      public Fixture(IReadOnlyList<Spawn> spawns)
      {
        var controlled = new GameObject("Controlled");
        controlled.transform.SetParent(root.transform, false);
        controlled.transform.SetPositionAndRotation(new Vector3(3, 0, 5), Quaternion.Euler(0, 160, 0));
        Controller = controlled.AddComponent<ZhaoYunController>();
        Controller.enabled = false; // Only the explicit legal Tick calls below advance this fixture.
        Controller.InputSource = new EmptyInput();
        var camera = new GameObject("Owned camera");
        camera.transform.SetParent(root.transform, false);
        Controller.ViewCamera = camera.AddComponent<Camera>();
        Controller.SetFocus(true);
        var dummies = new GameObject("Owned soldiers");
        dummies.transform.SetParent(root.transform, false);
        Dummies = dummies.AddComponent<TrainingDummies>();
        var items = new List<Transform>();
        for (int i = 0; i < spawns.Count; i++)
        {
          var soldier = new GameObject("Soldier " + i);
          soldier.transform.SetParent(dummies.transform, false);
          items.Add(soldier.transform);
        }
        Dummies.SetDummies(items, spawns, ai: true);
        // Seed verification is not audio acceptance; do not attach an output to another scene listener.
        Controller.Effects.OfflineAudio = true;
        Controller.Effects.transform.SetParent(root.transform, true);
      }

      public void Dispose() { Object.DestroyImmediate(root); }
    }

    static CombatSimulation Reference(IReadOnlyList<Spawn> spawns, uint seed)
    {
      var targets = new HitTargets(spawns.Count, seed);
      var simulation = new CombatSimulation(targets);
      simulation.SetDifficulty(Difficulties.Normal);
      targets.AiEnabled = true;
      ResetReference(simulation, spawns);
      return simulation;
    }

    static void ResetReference(CombatSimulation simulation, IReadOnlyList<Spawn> spawns)
    {
      simulation.Targets.Clear();
      simulation.Targets.Reset(spawns);
      simulation.Restart();
    }

    static float[] Health(HitTargets targets) => Enumerable.Range(0, targets.Count).Select(targets.Hp).ToArray();

    static void AssertState(CombatSimulation actual, CombatSimulation expected)
    {
      Assert.AreSame(expected.Difficulty, actual.Difficulty);
      Assert.AreEqual(expected.Phase, actual.Phase);
      Assert.AreEqual(expected.Clock.SimTime, actual.Clock.SimTime);
      Assert.AreEqual(expected.Player.Hp, actual.Player.Hp);
      Assert.AreEqual(expected.Player.State, actual.Player.State);
      Assert.AreEqual(expected.Player.X, actual.Player.X);
      Assert.AreEqual(expected.Player.Z, actual.Player.Z);
      Assert.AreEqual(expected.Events.Count, actual.Events.Count);
      for (int i = 0; i < expected.Events.Count; i++) Assert.AreEqual(expected.Events[i].Type, actual.Events[i].Type);
      var a = actual.Targets; var e = expected.Targets;
      Assert.IsTrue(a.AiEnabled);
      Assert.AreEqual(e.Count, a.Count);
      Assert.AreEqual(e.AliveCount, a.AliveCount);
      Assert.AreEqual(e.Attackers, a.Attackers);
      for (int i = 0; i < e.Count; i++)
      {
        Assert.AreEqual(e.Hp(i), a.Hp(i));
        Assert.AreEqual(e.Cooldown(i), a.Cooldown(i));
        Assert.AreEqual(e.Scale(i), a.Scale(i));
        Assert.AreEqual(e.State(i), a.State(i));
        Assert.AreEqual(e.StateTime(i), a.StateTime(i));
        Assert.AreEqual(e.X(i), a.X(i));
        Assert.AreEqual(e.Y(i), a.Y(i));
        Assert.AreEqual(e.Z(i), a.Z(i));
        Assert.AreEqual(e.Vx(i), a.Vx(i));
        Assert.AreEqual(e.Vz(i), a.Vz(i));
        Assert.AreEqual(e.Yaw(i), a.Yaw(i));
        Assert.AreEqual(e.Engaged(i), a.Engaged(i));
        Assert.AreEqual(e.Token(i), a.Token(i));
      }
    }

    static void Step(ZhaoYunController controller, CombatSimulation reference)
    {
      for (int frame = 0; frame < 180; frame++)
      {
        controller.Tick(Dt);
        reference.Step(Dt, default);
        AssertState(controller.Simulation, reference);
      }
    }

    [TestCase(7u)]
    [TestCase(11u)]
    [TestCase(23u)]
    public void ExplicitSeedMatchesIndependentStreamAcrossTicksRestartAndRebuild(uint seed)
    {
      // All three AI seeds use the same spawn roster; position randomness cannot hide a missing AI seed.
      var spawns = PerformanceProbe.ProbeSpawns(20, 7);
      using (var fixture = new Fixture(spawns))
      {
        var controller = fixture.Controller;
        controller.UseDummies(fixture.Dummies, seed);
        var reference = Reference(spawns, seed);
        AssertState(controller.Simulation, reference);
        var initialHealth = Health(controller.Simulation.Targets);
        if (seed != 7) Assert.IsFalse(initialHealth.SequenceEqual(Health(Reference(spawns, 7).Targets)), "AI seed was ignored");
        Step(controller, reference);
        var previousTargets = controller.Simulation.Targets;
        controller.Restart();
        ResetReference(reference, spawns);
        Assert.AreSame(previousTargets, controller.Simulation.Targets);
        AssertState(controller.Simulation, reference);
        Assert.IsFalse(initialHealth.SequenceEqual(Health(controller.Simulation.Targets)), "Restart reseeded the stream");
        Step(controller, reference);
        controller.UseDummies(fixture.Dummies, seed);
        Assert.AreNotSame(previousTargets, controller.Simulation.Targets);
        CollectionAssert.AreEqual(initialHealth, Health(controller.Simulation.Targets));
        reference = Reference(spawns, seed);
        AssertState(controller.Simulation, reference);
        Step(controller, reference);
      }
    }

    [Test] public void OriginalSingleParameterApiMatchesExplicitDefaultSeed()
    {
      var spawns = PerformanceProbe.ProbeSpawns(20, 7);
      using (var original = new Fixture(spawns))
      using (var explicitDefault = new Fixture(spawns))
      {
        original.Controller.UseDummies(original.Dummies);
        explicitDefault.Controller.UseDummies(explicitDefault.Dummies, HitTargets.DefaultSeed);
        AssertState(original.Controller.Simulation, explicitDefault.Controller.Simulation);
        for (int frame = 0; frame < 180; frame++)
        {
          original.Controller.Tick(Dt);
          explicitDefault.Controller.Tick(Dt);
          AssertState(original.Controller.Simulation, explicitDefault.Controller.Simulation);
        }
      }
    }
  }
}
