using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Foundation.Tests
{
  public static class DirectorParity
  {
    static double D(object value) => (double)value;
    static Dictionary<string, object> O(object value) => (Dictionary<string, object>)value;
    // Counts, state and flags are exact; continuous tolerance is fixed before replay. First differences are retained.
    public static CombatParity.Result Run(Dictionary<string, object> scenario)
    {
      var result = new CombatParity.Result();
      var spawns = CrowdParity.SpawnsOf(scenario);
      var targets = new HitTargets(spawns.Count, DirectorRoute.Seed);
      var sim = new CombatSimulation(targets);
      var witnesses = (List<object>)scenario["resetWitnesses"];
      targets.Reset(spawns); CompareReset(0);
      sim.SetDifficulty(CrowdParity.DifficultyOf((string)scenario["difficulty"]));
      targets.Reset(spawns); CompareReset(1); sim.Restart();
      void CompareReset(int index) {
        var expected = (List<object>)witnesses[index];
        for (int i = 0; i < expected.Count; i++) result.Number("reset " + index + " cooldown " + i, D(expected[i]), targets.Cooldown(i), DirectorRoute.PositionTolerance);
      }
      bool retry = (string)scenario["id"] == "two_dev_death_retry_normal";
      result.Number("resets", D(scenario["resets"]), retry ? 3 : DirectorRoute.Resets, 0);
      result.Number("seed", D(scenario["seed"]), DirectorRoute.Seed, 0);
      result.Number("hz", D(scenario["hz"]), DirectorRoute.Hz, 0);
      var summaries = (List<object>)scenario["summaries"];
      int next = 0, count = (int)Math.Round(D(scenario["duration"]) * DirectorRoute.Hz);
      for (int f = 0; f < count; f++)
      {
        if (retry && f == 30) { targets.Reset(spawns); CompareReset(2); sim.Restart(); }
        double x = sim.Player.X, z = sim.Player.Z; var state = sim.Player.State;
        sim.Step(1.0 / DirectorRoute.Hz, DirectorRoute.Controls());
        if (retry && f == 29) { sim.Player.SetHp(1); sim.InjectStrike(new EnemyStrike(70, true, sim.Player.X, sim.Player.Z - 1)); }
        var actual = DirectorRoute.Capture(sim, f, x, z, state, true);
        if (next >= summaries.Count || D(O(summaries[next])["f"]) != f) continue;
        var expected = O(summaries[next++]); string at = scenario["id"] + " f" + f;
        result.Frames++;
        result.Number(at + " alive", D(expected["alive"]), actual.alive, 0);
        result.Number(at + " engaged", D(expected["engaged"]), actual.engaged, 0);
        result.Number(at + " attackers", D(expected["attackers"]), actual.attackers, 0);
        result.Number(at + " ko", D(expected["ko"]), actual.ko, 0);
        result.Text(at + " phase", (string)expected["phase"], actual.phase);
        result.Text(at + " state", (string)expected["state"], actual.state);
        result.Number(at + " x", D(expected["x"]), actual.x, DirectorRoute.PositionTolerance);
        result.Number(at + " z", D(expected["z"]), actual.z, DirectorRoute.PositionTolerance);
        result.Number(at + " hp", D(expected["hp"]), actual.hp, DirectorRoute.PositionTolerance);
        result.Number(at + " simTime", D(expected["simTime"]), actual.simTime, DirectorRoute.PositionTolerance);
        Compare("stepped", actual.stepped); Compare("inputMove", actual.inputMove); Compare("operationalIdle", actual.operationalIdle);
        Compare("rawInputNoProgress", actual.rawInputNoProgress); Compare("eligibleMove", actual.eligibleMove); Compare("eligibleStuck", actual.eligibleStuck);
        void Compare(string key, bool value) { if ((bool)expected[key] != value) result.Fail(at + " " + key + ": expected " + expected[key] + ", got " + value); }
      }
      result.Number("summary coverage", summaries.Count, next, 0);
      result.Number("summary count", Math.Round(D(scenario["duration"])), summaries.Count, 0);
      return result;
    }
  }
}
