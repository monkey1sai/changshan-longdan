using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Animation
{
  // The E06 acceptance numbers, measured on what is shown:
  //  - grip: right hand to the spear grip, and left hand to the spear axis while the left hand holds (lh > 0.98);
  //  - plant slip: largest horizontal drift of a foot during one continuous plant (on the ground while moving or
  //    guarding; attacks, dodges and hits move the body on purpose and are excluded, as the plan allows);
  //  - root jump: root motion beyond the logic position's motion (the logic position is the only displacement authority).
  public sealed class AnimationMetrics
  {
    public const double GripLimit = 0.03, PlantSlipLimit = 0.05, RootJumpLimit = 0.05;

    readonly List<double> rightGrip = new List<double>();
    readonly List<double> leftGrip = new List<double>();
    readonly List<double> plantSlips = new List<double>();
    readonly Plant[] plants = { new Plant(), new Plant() };
    Vec3 lastRoot, lastPlayer;
    bool hasLast;

    sealed class Plant
    {
      public bool Active;
      public Vec3 Start;
      public double Drift;
    }

    public int Frames { get; private set; }
    public double RootJumpMax { get; private set; }
    public double DesignDeviationMax { get; private set; } // largest distance between a shown foot and the Web's target
    public IReadOnlyList<double> PlantSlips => plantSlips;

    public double RightGripP95 => Percentile(rightGrip, 0.95);
    public double LeftGripP95 => Percentile(leftGrip, 0.95);
    public double RightGripMax => Max(rightGrip);
    public double LeftGripMax => Max(leftGrip);
    public double PlantSlipMax => Math.Max(Max(plantSlips), Math.Max(plants[0].Active ? plants[0].Drift : 0, plants[1].Active ? plants[1].Drift : 0));
    public int Plants => plantSlips.Count + (plants[0].Active ? 1 : 0) + (plants[1].Active ? 1 : 0);

    // One shown frame. footL/footR are the final foot positions; desiredL/desiredR the Web rig's targets.
    public void Add(Player player, ProceduralRig rig, Vec3 footL, Vec3 footR, Vec3 desiredL, Vec3 desiredR)
    {
      rig.GripErrors(out double right, out double left);
      rightGrip.Add(right);
      if (rig.Pose.Lh > .98) leftGrip.Add(left);
      var root = rig.Root.WorldPosition;
      var logic = new Vec3(player.X, player.Y, player.Z);
      if (hasLast) RootJumpMax = Math.Max(RootJumpMax, ((root - lastRoot) - (logic - lastPlayer)).Length());
      lastRoot = root;
      lastPlayer = logic;
      hasLast = true;
      bool moving = player.State == PlayerState.Move || player.State == PlayerState.Guard;
      double ground = player.Y + ProceduralRig.SoleAnchorY + FootPlant.GroundTolerance;
      Track(plants[0], footL, moving && footL.Y <= ground);
      Track(plants[1], footR, moving && footR.Y <= ground);
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
      $"plants={Plants} slipMax={PlantSlipMax:0.0000} rootJumpMax={RootJumpMax:0.0000} designDev={DesignDeviationMax:0.000}";
  }
}
