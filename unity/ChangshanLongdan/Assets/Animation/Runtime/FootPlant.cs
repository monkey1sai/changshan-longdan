using System;
using Changshan.Combat;

namespace Changshan.Animation
{
  // E06 foot plant on top of the Web rig (an intentional difference from the Web, which slides feet when turning in
  // place, starting or stopping a run, settling into stance or raising the guard). While the player moves or guards on
  // the ground a landed foot is locked in the world; when the Web's foot target drifts past StepThreshold, or the leg can
  // no longer reach, the foot takes a short lifted step to the target and locks again. In any other state (attacks,
  // dodges, hits: designed displacement) the feet follow the Web rig, blending back over ReleaseTime.
  public sealed class FootPlant
  {
    public const double StepThreshold = 0.12, StepTime = 0.12, CatchUpTime = 0.05, ReleaseTime = 0.1, LiftHeight = 0.07;
    public const double GroundTolerance = 0.002, FollowTolerance = 0.02;

    public enum Mode { Follow, Locked, Stepping, Releasing }

    struct Foot
    {
      public Mode Mode;
      public Vec3 Lock, From, Current;
      public double T, Duration;
      public bool Lift; // decided when the step starts, so the arc cannot switch on or off mid-step
    }

    Foot left, right;

    public Mode LeftMode => left.Mode;
    public Mode RightMode => right.Mode;
    public Vec3 Left => left.Current;
    public Vec3 Right => right.Current;
    public int Steps { get; private set; }

    public void Reset()
    {
      left = right = default;
      Steps = 0;
    }

    // Call after ProceduralRig.Update (dt is the same game-time step) and before SkinBinding.Update.
    public void Apply(ProceduralRig rig, Player player, double dt)
    {
      if (rig == null) throw new ArgumentNullException(nameof(rig));
      if (player == null) throw new ArgumentNullException(nameof(player));
      var desiredL = rig.FootAnchorL.Position;
      var desiredR = rig.FootAnchorR.Position;
      // The Web solves the legs only when |flip| < 0.05, so after a forward roll (flip = 2 pi, the same orientation) it
      // briefly places the feet by forward kinematics while the player stands; treat that as grounded too.
      double flip = Math.Abs(CombatMath.WrapAngle(rig.Pose.Flip));
      bool airborne = player.Y > 0.25 && player.State != PlayerState.Down && player.State != PlayerState.Dead;
      if (!rig.FeetGrounded && (airborne || flip >= .05))
      {
        // Airborne, lying or flipping: the Web places the feet by forward kinematics; nothing to plant.
        left = new Foot { Mode = Mode.Follow, Current = desiredL };
        right = new Foot { Mode = Mode.Follow, Current = desiredR };
        return;
      }
      bool lockable = player.State == PlayerState.Move || player.State == PlayerState.Guard;
      double ground = player.Y + ProceduralRig.SoleAnchorY + GroundTolerance;
      double reach = ProceduralRig.UpperLeg + ProceduralRig.LowerLeg - 0.01;
      var finalL = Step(ref left, desiredL, rig.ThighL.WorldPosition, lockable, ground, reach, dt);
      var finalR = Step(ref right, desiredR, rig.ThighR.WorldPosition, lockable, ground, reach, dt);
      if (left.Mode != Mode.Follow || right.Mode != Mode.Follow) rig.PlaceFeet(finalL, finalR);
    }

    Vec3 Step(ref Foot f, Vec3 desired, Vec3 hip, bool lockable, double ground, double reach, double dt)
    {
      bool onGround = desired.Y <= ground;
      if (!lockable)
      {
        if (f.Mode == Mode.Locked || f.Mode == Mode.Stepping)
        {
          f.Mode = Mode.Releasing;
          f.From = f.Current;
          f.T = 0;
        }
        if (f.Mode == Mode.Releasing)
        {
          f.T = Math.Min(1, f.T + dt / ReleaseTime);
          if (f.T >= 1) f.Mode = Mode.Follow;
          else return f.Current = Vec3.Lerp(f.From, desired, CombatMath.Smoothstep(0, 1, f.T));
        }
        return f.Current = desired;
      }
      switch (f.Mode)
      {
        case Mode.Follow:
          if (onGround)
          {
            f.Mode = Mode.Locked;
            f.Lock = desired;
          }
          return f.Current = desired;
        case Mode.Releasing:
        {
          // Back in a plantable state while still blending: keep blending, and plant where the foot is (no snap).
          var p = Release(ref f, desired, dt);
          if (onGround)
          {
            f.Mode = Mode.Locked;
            f.Lock = p;
          }
          return f.Current = p;
        }
        case Mode.Locked:
        {
          double drift = Horizontal(desired, f.Lock);
          bool reachable = hip.DistanceTo(f.Lock) <= reach;
          if (!onGround && drift < FollowTolerance)
          {
            // Normal lift-off in the run cycle: the Web target is still where the foot stands.
            f.Mode = Mode.Follow;
            return f.Current = desired;
          }
          if (!onGround || drift > StepThreshold || !reachable)
          {
            f.Mode = Mode.Stepping;
            f.From = f.Lock;
            f.T = 0;
            // The Web already lifted the foot (run cycle): catch up quickly instead of a full step.
            f.Duration = onGround ? StepTime : CatchUpTime;
            f.Lift = onGround;
            Steps++;
            return f.Current = StepPosition(f, desired);
          }
          return f.Current = f.Lock;
        }
        default: // Stepping
          f.T = Math.Min(1, f.T + dt / f.Duration);
          f.Current = StepPosition(f, desired);
          if (f.T >= 1)
          {
            if (onGround)
            {
              f.Mode = Mode.Locked;
              f.Lock = f.Current = desired;
            }
            else f.Mode = Mode.Follow;
          }
          return f.Current;
      }
    }

    static Vec3 Release(ref Foot f, Vec3 desired, double dt)
    {
      f.T = Math.Min(1, f.T + dt / ReleaseTime);
      if (f.T >= 1)
      {
        f.Mode = Mode.Follow;
        return desired;
      }
      return Vec3.Lerp(f.From, desired, CombatMath.Smoothstep(0, 1, f.T));
    }

    static Vec3 StepPosition(in Foot f, Vec3 desired)
    {
      double s = CombatMath.Smoothstep(0, 1, f.T);
      var p = Vec3.Lerp(f.From, desired, s);
      if (f.Lift) p.Y += LiftHeight * Math.Sin(Math.PI * f.T);
      return p;
    }

    static double Horizontal(Vec3 a, Vec3 b)
    {
      double dx = a.X - b.X, dz = a.Z - b.Z;
      return Math.Sqrt(dx * dx + dz * dz);
    }
  }
}
