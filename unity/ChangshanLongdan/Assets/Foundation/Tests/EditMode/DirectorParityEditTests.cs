using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  public sealed class DirectorParityEditTests
  {
    const string Path = "unity/ChangshanLongdan/TestData/combat/web-director.json";
    [Test] public void ScriptedDirectorSummariesMatchCurrentWeb()
    {
      string root = CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
      var fixture = (Dictionary<string, object>)MiniJson.Parse(File.ReadAllText(System.IO.Path.Combine(root, Path)));
      var sources = CombatParity.CompareSources(fixture, root);
      Assert.That(sources.FailCount, Is.Zero, sources.ToString());
      var route = (Dictionary<string, object>)fixture["route"];
      var holds = (List<object>)route["holds"];
      var hold = (Dictionary<string, object>)holds[0];
      Assert.That(holds.Count, Is.EqualTo(1));
      Assert.That(DirectorRoute.Keys.Length, Is.EqualTo(2));
      Assert.That(DirectorRoute.Keys[0].At, Is.EqualTo((double)hold["from"]));
      Assert.That(DirectorRoute.Keys[0].Key, Is.EqualTo((string)hold["key"]));
      Assert.That(DirectorRoute.Keys[0].Down, Is.True);
      Assert.That(DirectorRoute.Keys[1].At, Is.EqualTo((double)hold["to"]));
      Assert.That(DirectorRoute.Keys[1].Key, Is.EqualTo((string)hold["key"]));
      Assert.That(DirectorRoute.Keys[1].Down, Is.False);
      Assert.That(DirectorRoute.PositionTolerance, Is.EqualTo((double)route["positionTolerance"]));
      var scenarios = ((List<object>)fixture["scenarios"]).Cast<Dictionary<string, object>>().ToArray();
      Assert.That(scenarios.Select(s => (string)s["id"]), Is.EqualTo(new[] { "two_walk_normal", DirectorRoute.Id, "two_dev_death_retry_normal" }));
      foreach (var scenario in scenarios) {
        var result = DirectorParity.Run(scenario);
        TestContext.WriteLine(result.ToString());
        Assert.That(result.FailCount, Is.Zero, result.ToString());
      }
    }
    [Test] public void NoProgressDuringHitStopIsNotEligibleCollisionStuck()
    {
      var targets = new HitTargets(1); var sim = new CombatSimulation(targets);
      targets.Reset(new[] { new Spawn(0, 33, 0, EnemyKind.Spear) }); sim.Restart();
      sim.Player.GainMusou(1); // does not alter hp or movement
      sim.Clock.AddHitstop(0.1);
      double x = sim.Player.X, z = sim.Player.Z; var state = sim.Player.State;
      sim.Step(1.0 / DirectorRoute.Hz, DirectorRoute.Controls());
      var sample = DirectorRoute.Capture(sim, 0, x, z, state, true);
      Assert.That(sample.rawInputNoProgress, Is.True);
      Assert.That(sample.eligibleStuck, Is.False);
    }
  }
}
