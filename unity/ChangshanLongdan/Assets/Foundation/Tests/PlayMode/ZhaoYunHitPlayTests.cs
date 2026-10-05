using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Changshan.Character;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Object = UnityEngine.Object;

namespace Changshan.Foundation.Tests
{
  // E05: the controller resolves hits on training dummies through CombatSimulation.
  public sealed class ZhaoYunHitPlayTests
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

    readonly List<GameObject> created = new List<GameObject>();

    [TearDown] public void Destroy()
    {
      foreach (var go in created) if (go) Object.Destroy(go);
      created.Clear();
    }

    // A controller with one dummy 1.5 m in front of the start; dummies are plain transforms (no physics module).
    (ZhaoYunController Controller, ScriptedInput Input, Transform Dummy) Create()
    {
      var root = new GameObject("Hit Test Controller");
      created.Add(root);
      root.transform.SetPositionAndRotation(new Vector3(-6, 0, 9), Quaternion.Euler(0, 160, 0));
      var controller = root.AddComponent<ZhaoYunController>();
      controller.enabled = false;
      var dummies = new GameObject("Hit Test Dummies");
      created.Add(dummies);
      var dummy = new GameObject("Dummy").transform;
      dummy.SetParent(dummies.transform, false);
      dummy.position = controller.Mapping.ToDisplayPosition(ArenaLayout.StartX, 0, ArenaLayout.StartZ - 1.5);
      var component = dummies.AddComponent<TrainingDummies>();
      component.SetDummies(new[] { dummy });
      controller.UseDummies(component);
      var input = new ScriptedInput();
      controller.InputSource = input;
      controller.SetFocus(true);
      return (controller, input, dummy);
    }

    [UnityTest] public IEnumerator SceneHasTwentyDummiesAroundTheCharacter()
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      yield return null;
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      var dummies = Object.FindObjectsByType<TrainingDummies>().Single();
      Assert.That(controller.Dummies, Is.SameAs(dummies));
      var targets = controller.Simulation.Targets;
      Assert.That(targets.Count, Is.EqualTo(20));
      Assert.That(targets.AliveCount, Is.EqualTo(20));
      for (int i = 0; i < targets.Count; i++)
      {
        double dx = targets.X(i) - ArenaLayout.StartX, dz = targets.Z(i) - ArenaLayout.StartZ;
        double distance = Math.Sqrt(dx * dx + dz * dz);
        Assert.That(Math.Min(Math.Abs(distance - 2.8), Math.Abs(distance - 4.2)), Is.LessThan(0.01), $"dummy {i} distance {distance}");
        // Not in the 120° in front of the starting facing (towards the validation camera).
        double cos = (Math.Sin(ArenaLayout.StartFacing) * dx + Math.Cos(ArenaLayout.StartFacing) * dz) / distance;
        Assert.That(cos, Is.LessThan(Math.Cos(Math.PI / 3) + 1e-6), $"dummy {i} blocks the view");
        Assert.That(targets.Hp(i), Is.EqualTo(TrainingDummies.DummyHp));
      }
      Assert.That(Vector3.Distance(controller.transform.position, new Vector3(0, -1, 4.2f)), Is.LessThan(1e-4f), "start pose moved");
    }

    [UnityTest] public IEnumerator AttackHitsADummyOnceAndHoldsTheGame()
    {
      var (controller, input, _) = Create();
      var sim = controller.Simulation;
      input.Down.Add("KeyJ");
      controller.Tick(Dt);
      input.Up.Add("KeyJ");
      var hits = new List<HitEvent>();
      int frame = 0;
      while (hits.Count == 0 && frame++ < 30)
      {
        controller.Tick(Dt);
        hits.AddRange(sim.Hits);
      }
      Assert.That(hits, Has.Count.EqualTo(1));
      Assert.That(hits[0].Move, Is.EqualTo(MoveId.N1));
      Assert.That(hits[0].HpAfter, Is.EqualTo(TrainingDummies.DummyHp - 14));
      Assert.That(sim.Clock.Hitstop, Is.EqualTo(Moves.Get(MoveId.N1).Hits[0].Hitstop));
      double simTime = sim.Clock.SimTime, moveTime = sim.Player.MoveTime;
      controller.Tick(Dt);
      controller.Tick(Dt);
      Assert.That(sim.Clock.SimTime, Is.EqualTo(simTime), "game time advanced during hit-stop");
      Assert.That(sim.Player.MoveTime, Is.EqualTo(moveTime));
      for (int i = 0; i < 40; i++)
      {
        controller.Tick(Dt);
        hits.AddRange(sim.Hits);
      }
      Assert.That(hits, Has.Count.EqualTo(1), "the N1 window hit the dummy more than once");
      Assert.That(sim.Clock.SimTime, Is.GreaterThan(simTime));
      yield return null;
    }

    [UnityTest] public IEnumerator KilledDummyIsHiddenAndRestartRestoresIt()
    {
      var (controller, input, dummy) = Create();
      var sim = controller.Simulation;
      var hits = new List<HitEvent>();
      for (int frame = 0; frame < 400 && sim.Targets.AliveCount > 0; frame++)
      {
        if (frame % 8 == 0) input.Down.Add("KeyJ");
        if (frame % 8 == 1) input.Up.Add("KeyJ");
        controller.Tick(Dt);
        hits.AddRange(sim.Hits);
      }
      Assert.That(sim.Targets.Alive(0), Is.False, "the string never killed the dummy");
      Assert.That(hits.Count(h => h.Killed), Is.EqualTo(1));
      Assert.That(hits.Last().Killed, Is.True);
      Assert.That(dummy.gameObject.activeSelf, Is.False);
      for (int i = 0; i < 60; i++)
      {
        if (i % 8 == 0) input.Down.Add("KeyJ");
        if (i % 8 == 1) input.Up.Add("KeyJ");
        controller.Tick(Dt);
        Assert.That(sim.Hits, Is.Empty, "a dead dummy was hit");
      }
      controller.Restart();
      Assert.That(dummy.gameObject.activeSelf, Is.True);
      Assert.That(sim.Targets.AliveCount, Is.EqualTo(1));
      Assert.That(sim.Targets.Hp(0), Is.EqualTo(TrainingDummies.DummyHp));
      Assert.That(sim.TotalHits, Is.Zero);
      yield return null;
    }
  }
}
