using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Animation
{
  // The E06 acceptance numbers, measured on what is shown:
  //  - grip: right hand to the spear grip, and left hand to the spear axis while the left hand holds (lh > 0.98);
  //  - plant slip: largest horizontal drift of a foot during one continuous plant (on the ground while moving or
  //    guarding; attacks, dodges and hits move the body on purpose and are excluded, as the plan allows);
  //  - root jump: root motion beyond the logic position's motion (the logic position is the only displacement authority;
  //    the rig pins the root to it, so this is a guard against anyone adding root motion, not a measurement);
  //  - foot vertical speed: the largest vertical speed of a shown foot, so the plant layer's lifted steps stay as smooth as
  //    the Web's own run cycle (a step that switched its arc off mid-way would show as a one-frame drop).
  // Diagnostics (reported, no threshold): hips jump beyond the logic motion; foot slide in the excluded states (attacks,
  // dodges, hits: the Web rig as is) while the logic position stands still; distance between a shown foot and the Web target.
  public sealed class AnimationMetrics
  {
    public const double GripLimit = 0.03, PlantSlipLimit = 0.05, RootJumpLimit = 0.05;

    readonly List<double> rightGrip = new List<double>();
    readonly List<double> leftGrip = new List<double>();
    readonly List<double> plantSlips = new List<double>();
    readonly Plant[] plants = { new Plant(), new Plant() };
    readonly Plant[] unlocked = { new Plant(), new Plant() };
    Vec3 lastRoot, lastHips, lastPlayer, lastFootL, lastFootR;
    bool hasLast, lastMoving;

    sealed class Plant
    {
      public bool Active;
      public Vec3 Start;
      public double Drift;
    }

    public int Frames { get; private set; }
    public double RootJumpMax { get; private set; }
    public double HipsJumpMax { get; private set; } // diagnostic: hips motion beyond the logic motion, per frame
    public double FootVerticalSpeedMax { get; private set; } // m/s, final feet, while moving or guarding (where the plant layer acts)
    public double UnlockedSlipMax { get; private set; } // diagnostic: foot slide on the ground in the excluded states while the logic position is still
    public double DesignDeviationMax { get; private set; } // largest distance between a shown foot and the Web's target
    public IReadOnlyList<double> PlantSlips => plantSlips;

    public double RightGripP95 => Percentile(rightGrip, 0.95);
    public double LeftGripP95 => Percentile(leftGrip, 0.95);
    public double RightGripMax => Max(rightGrip);
    public double LeftGripMax => Max(leftGrip);
    public double PlantSlipMax => Math.Max(Max(plantSlips), Math.Max(plants[0].Active ? plants[0].Drift : 0, plants[1].Active ? plants[1].Drift : 0));
    public int Plants => plantSlips.Count + (plants[0].Active ? 1 : 0) + (plants[1].Active ? 1 : 0);

    // One shown frame. footL/footR are the final foot positions; desiredL/desiredR the Web rig's targets.
    public void Add(Player player, ProceduralRig rig, double dt, Vec3 footL, Vec3 footR, Vec3 desiredL, Vec3 desiredR)
    {
      rig.GripErrors(out double right, out double left);
      rightGrip.Add(right);
      if (rig.Pose.Lh > .98) leftGrip.Add(left);
      var root = rig.Root.WorldPosition;
      var logic = new Vec3(player.X, player.Y, player.Z);
      var hips = rig.Hips.WorldPosition;
      var logicMove = logic - lastPlayer;
      bool moving = player.State == PlayerState.Move || player.State == PlayerState.Guard;
      double ground = player.Y + ProceduralRig.SoleAnchorY + FootPlant.GroundTolerance;
      if (hasLast)
      {
        RootJumpMax = Math.Max(RootJumpMax, ((root - lastRoot) - logicMove).Length());
        HipsJumpMax = Math.Max(HipsJumpMax, ((hips - lastHips) - logicMove).Length());
        if (dt > 0 && moving && lastMoving) FootVerticalSpeedMax = Math.Max(FootVerticalSpeedMax, Math.Max(Math.Abs(footL.Y - lastFootL.Y), Math.Abs(footR.Y - lastFootR.Y)) / dt);
      }
      bool still = hasLast && Math.Sqrt(logicMove.X * logicMove.X + logicMove.Z * logicMove.Z) < 1e-9;
      Track(plants[0], footL, moving && footL.Y <= ground);
      Track(plants[1], footR, moving && footR.Y <= ground);
      UnlockedSlipMax = Math.Max(UnlockedSlipMax, Math.Max(TrackUnlocked(unlocked[0], footL, !moving && still && footL.Y <= ground), TrackUnlocked(unlocked[1], footR, !moving && still && footR.Y <= ground)));
      lastRoot = root;
      lastHips = hips;
      lastPlayer = logic;
      lastFootL = footL;
      lastFootR = footR;
      lastMoving = moving;
      hasLast = true;
      DesignDeviationMax = Math.Max(DesignDeviationMax, Math.Max(footL.DistanceTo(desiredL), footR.DistanceTo(desiredR)));
      Frames++;
    }

    void Track(Plant p, Vec3 foot, bool planted)
    {
      if (!planted)
      {
        if (p.Active) plantSlips.Add(p.Drift);
        p.Active = false;
        return;
      }
      if (!p.Active)
      {
        p.Active = true;
        p.Start = foot;
        p.Drift = 0;
      }
      double dx = foot.X - p.Start.X, dz = foot.Z - p.Start.Z;
      p.Drift = Math.Max(p.Drift, Math.Sqrt(dx * dx + dz * dz));
    }

    static double TrackUnlocked(Plant p, Vec3 foot, bool tracking)
    {
      if (!tracking)
      {
        p.Active = false;
        return 0;
      }
      if (!p.Active)
      {
        p.Active = true;
        p.Start = foot;
        p.Drift = 0;
      }
      double dx = foot.X - p.Start.X, dz = foot.Z - p.Start.Z;
      return p.Drift = Math.Max(p.Drift, Math.Sqrt(dx * dx + dz * dz));
    }

    static double Max(List<double> values)
    {
      double m = 0;
      foreach (var v in values) m = Math.Max(m, v);
      return m;
    }

    public static double Percentile(List<double> values, double q)
    {
      if (values.Count == 0) return 0;
      var sorted = new List<double>(values);
      sorted.Sort();
      return sorted[Math.Min(sorted.Count - 1, (int)Math.Floor(sorted.Count * q))];
    }

    public override string ToString() =>
      $"frames={Frames} gripR p95={RightGripP95:0.0000} max={RightGripMax:0.0000} gripL p95={LeftGripP95:0.0000} max={LeftGripMax:0.0000} " +
      $"plants={Plants} slipMax={PlantSlipMax:0.0000} rootJumpMax={RootJumpMax:0.0000} footVmax={FootVerticalSpeedMax:0.00} " +
      $"hipsJump={HipsJumpMax:0.0000} unlockedSlip={UnlockedSlipMax:0.000} designDev={DesignDeviationMax:0.000}";
  }
}
