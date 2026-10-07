using System;

namespace Changshan.Combat
{
  // E11 diagnostics only. Matches scripts/lib/director-parity.ts. Never changes battle rules or rng.
  public static class DirectorRoute
  {
    public const string Id = "castle_walk_normal";
    public const int Seed = 7, Resets = 2, Hz = 30;
    public const double Duration = 9, PositionTolerance = 1e-4, ProgressEpsilon = 1e-6;
    public static readonly (double At, string Key, bool Down)[] Keys = { (0, "KeyW", true), (Duration, "KeyW", false) };
    public static PlayerControls Controls() => ControlComposer.Compose(new InputFrame { MoveY = 1 }, Math.PI);

    [Serializable] public sealed class Sample
    {
      public int f, alive, engaged, attackers; public long ko; public string phase, state;
      public double x, z, hp, simTime;
      public bool stepped, inputMove, operationalIdle, rawInputNoProgress, eligibleMove, eligibleStuck;
    }

    public static Sample Capture(CombatSimulation sim, int frame, double previousX, double previousZ, PlayerState previousState, bool inputMove)
    {
      var p = sim.Player; var targets = sim.Targets;
      bool raw = inputMove && CombatMath.Hypot(p.X - previousX, p.Z - previousZ) <= ProgressEpsilon;
      bool eligible = inputMove && p.Hp > 0 && sim.SteppedThisFrame && previousState == PlayerState.Move && p.State == PlayerState.Move;
      return new Sample {
        f = frame, alive = targets.AliveCount, engaged = targets.EngagedCount, attackers = targets.Attackers, ko = sim.KoCount,
        phase = sim.Phase.ToString().ToLowerInvariant(), state = p.State.ToString().ToLowerInvariant(), x = p.X, z = p.Z, hp = p.Hp,
        simTime = sim.Clock.SimTime, stepped = sim.SteppedThisFrame, inputMove = inputMove,
        operationalIdle = p.Hp > 0 && targets.AliveCount > 0 && targets.EngagedCount == 0,
        rawInputNoProgress = raw, eligibleMove = eligible, eligibleStuck = eligible && raw,
      };
    }
  }
}
