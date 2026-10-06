using System;
using Changshan.Combat;

namespace Changshan.Animation
{
  // Port of the driver rig in src/view/player-model.ts (PlayerModel without its voxel meshes). Drivers live in the Web
  // world frame; Group is the model root at the world origin, as in the Web scene. The player's logic position is the
  // only displacement authority: Root follows it, everything else is pose and IK on top.
  public sealed class ProceduralRig
  {
    public const double UpperArm = 0.32, LowerArm = 0.32, UpperLeg = 0.46, LowerLeg = 0.42;
    public const double SoleAnchorY = 0.089, RunPhaseScale = 2.6, SpearTipZ = 2.7, SpearTrailBaseZ = 1.25;
    public const int CapeSegments = 5;
    public const double CapeLength = 0.3;
    static readonly Vec3 DownAxis = new Vec3(0, -1, 0);

    public readonly RigNode Group = new RigNode("group");
    public readonly RigNode Root = new RigNode("root");
    public readonly RigNode Hips = new RigNode("hips");
    public readonly RigNode Torso = new RigNode("torso");
    public readonly RigNode Head = new RigNode("head");
    public readonly RigNode ThighL = new RigNode("thighL"), ThighR = new RigNode("thighR");
    public readonly RigNode KneeL = new RigNode("kneeL"), KneeR = new RigNode("kneeR");
    public readonly RigNode Spear = new RigNode("spear");
    public readonly RigNode HandAnchorL = new RigNode("handL"), HandAnchorR = new RigNode("handR");
    public readonly RigNode FootAnchorL = new RigNode("footL"), FootAnchorR = new RigNode("footR");
    public readonly RigNode ShoulderAnchorL = new RigNode("shoulderL"), ShoulderAnchorR = new RigNode("shoulderR");
    public readonly RigNode CapeAnchor = new RigNode("capeAnchor");
    public readonly RigNode UpperL = new RigNode("upperL"), ForeL = new RigNode("foreL"), UpperR = new RigNode("upperR"), ForeR = new RigNode("foreR");
    public readonly RigNode[] Cape = new RigNode[CapeSegments - 1];

    readonly Vec3[] capePts = new Vec3[CapeSegments];
    readonly Vec3[] capePrev = new Vec3[CapeSegments];
    bool capeReady;
    Vec3 footLocalL = new Vec3(.15, SoleAnchorY, .12), footLocalR = new Vec3(-.15, SoleAnchorY, -.12);
    Vec3 footFromL, footFromR;
    Pose pose, from, target;
    double fade = 1, fadeTime = 0.1;
    string lastKey = "";
    MoveId? lastMove;
    double lastMoveTime;
    double visualFacing, previousFacing, facingFrom, facingFade = 1, facingFadeTime = .12;
    bool facingReady;
    double runBlend, runFrom;
    int serial; // per rig; only key equality matters

    public Pose Pose => pose;
    public double Fade => fade;
    public double RunBlend => runBlend;
    public double VisualFacing => visualFacing;
    public Vec3 Tip { get; private set; }
    public Vec3 TipBase { get; private set; }

    public ProceduralRig()
    {
      footFromL = footLocalL;
      footFromR = footLocalR;
      Group.Add(Root);
      Root.Add(Hips);
      Hips.Add(Torso, ThighL, ThighR, Spear);
      Torso.Position = new Vec3(0, 0.02, 0);
      Torso.Add(Head, ShoulderAnchorL, ShoulderAnchorR, CapeAnchor);
      Head.Position = new Vec3(0, 0.6, 0);
      ShoulderAnchorL.Position = new Vec3(0.3, 0.47, 0);
      ShoulderAnchorR.Position = new Vec3(-0.3, 0.47, 0);
      CapeAnchor.Position = new Vec3(0, 0.5, -0.18);
      ThighL.Position = new Vec3(0.12, 0, 0);
      ThighR.Position = new Vec3(-0.12, 0, 0);
      ThighL.Add(KneeL);
      ThighR.Add(KneeR);
      KneeL.Position = new Vec3(0, -0.46, 0);
      KneeR.Position = new Vec3(0, -0.46, 0);
      Group.Add(UpperL, UpperR, ForeL, ForeR);
      for (int i = 0; i < Cape.Length; i++) Group.Add(Cape[i] = new RigNode($"cape{i}"));
      Group.Add(HandAnchorL, HandAnchorR, FootAnchorL, FootAnchorR);
    }

    // After a teleport (restart), so the cape is not stretched.
    public void ResetCape()
    {
      capeReady = false;
      pose = from = target = PlayerPoses.Stance;
      fade = 1;
      lastKey = "";
      lastMove = null;
      lastMoveTime = 0;
      facingReady = false;
      runBlend = runFrom = 0;
      footLocalL = new Vec3(.15, SoleAnchorY, .12);
      footLocalR = new Vec3(-.15, SoleAnchorY, -.12);
      footFromL = footLocalL;
      footFromR = footLocalR;
    }

    // dt is game time (0 during hit-stop), time the clock that drives the cape's wind.
    public void Update(Player player, double dt, double time)
    {
      if (player == null) throw new ArgumentNullException(nameof(player));
      string key = PoseKey(player);
      bool changed = key != lastKey;
      if (changed)
      {
        from = pose;
        footFromL = footLocalL;
        footFromR = footLocalR;
        runFrom = runBlend;
        fade = 0;
        fadeTime = key == "move" || key == "jump" ? 0.14 : 0.07;
        lastKey = key;
      }
      fade = Math.Min(1, fade + dt / fadeTime);
      TargetPose(player);
      pose = fade < 1 ? Pose.Crossfade(from, target, CombatMath.Smoothstep(0, 1, fade)) : target;
      double run = player.State == PlayerState.Move ? CombatMath.Smoothstep(0.3, 6.5, player.Speed) : 0;
      runBlend = fade < 1 ? runFrom + (run - runFrom) * CombatMath.Smoothstep(0, 1, fade) : run;

      UpdateFacing(player, dt, changed);
      Apply(player);
      SolveArms(player);
      if (dt > 0 || !capeReady) UpdateCape(dt, time);
      Tip = Spear.LocalToWorld(new Vec3(0, 0, SpearTipZ));
      TipBase = Spear.LocalToWorld(new Vec3(0, 0, SpearTrailBaseZ));
    }

    // PlayerModel.animationStatus: right-hand offset from the spear grip, left-hand distance from the spear axis.
    public void GripErrors(out double right, out double left)
    {
      var grip = Spear.WorldPosition;
      right = grip.DistanceTo(HandAnchorR.Position);
      var axis = new Vec3(0, 0, 1).ApplyQuaternion(Spear.WorldRotation);
      var v = HandAnchorL.Position - grip;
      left = v.AddScaled(axis, -v.Dot(axis)).Length();
    }

    void UpdateFacing(Player player, double dt, bool changed)
    {
      if (!facingReady)
      {
        visualFacing = previousFacing = player.Facing;
        facingFade = 1;
        facingReady = true;
        return;
      }
      bool reaction = player.State == PlayerState.Hurt || player.State == PlayerState.Down;
      if ((changed || reaction) && Math.Abs(CombatMath.WrapAngle(player.Facing - previousFacing)) > .1)
      {
        facingFrom = visualFacing;
        facingFade = 0;
        facingFadeTime = player.Move != null ? Math.Min(.07, player.Move.Hits[0].T0) : .12;
      }
      facingFade = Math.Min(1, facingFade + dt / facingFadeTime);
      visualFacing = facingFade < 1
        ? facingFrom + CombatMath.WrapAngle(player.Facing - facingFrom) * CombatMath.Smoothstep(0, 1, facingFade)
        : player.Facing;
      previousFacing = player.Facing;
    }

    // A new key restarts the fade; the same move started again (moveTime went back) gets a fresh key.
    string PoseKey(Player player)
    {
      if ((player.State == PlayerState.Attack || player.State == PlayerState.Musou) && player.Move != null)
      {
        var id = player.Move.Id;
        bool restarted = id == lastMove && player.MoveTime < lastMoveTime;
        lastMove = id;
        lastMoveTime = player.MoveTime;
        string prefix = id + ":";
        if (restarted) return prefix + ++serial;
        return lastKey.StartsWith(prefix, StringComparison.Ordinal) ? lastKey : prefix + ++serial;
      }
      lastMove = null;
      return StateKey(player.State);
    }

    static string StateKey(PlayerState s)
    {
      string name = s.ToString();
      return char.ToLowerInvariant(name[0]) + name.Substring(1);
    }

    void TargetPose(Player player)
    {
      switch (player.State)
      {
        case PlayerState.Move:
        {
          double run = CombatMath.Smoothstep(0.3, 6.5, player.Speed);
          target = Pose.Mix(PlayerPoses.Stance, PlayerPoses.Run, run);
          target.Crouch += Math.Sin(player.RunPhase * 2) * 0.035 * run;
          break;
        }
        case PlayerState.Jump: target = PlayerPoses.Air; break;
        case PlayerState.Guard: target = PlayerPoses.Guard; break;
        case PlayerState.Attack:
        case PlayerState.Musou:
          if (player.Move != null) target = PlayerPoses.MovePose(player.Move.Id, player.MoveTime);
          break;
        case PlayerState.Dodge:
          if (player.DodgeBack)
          {
            target = PlayerPoses.Hurt;
            target.Lean = -0.15;
          }
          else
          {
            target = PlayerPoses.Roll;
            target.Flip = CombatMath.Tau * CombatMath.Smoothstep(0.02, 0.36, player.StateTime);
            target.Lean = 0.9;
            target.Crouch = -0.35;
          }
          break;
        case PlayerState.Hurt: target = PlayerPoses.Hurt; break;
        case PlayerState.Down: target = Pose.Mix(PlayerPoses.Down, PlayerPoses.Stance, CombatMath.Smoothstep(0.95, 1.3, player.StateTime)); break;
        case PlayerState.Dead: target = PlayerPoses.Down; break;
      }
    }

    void Apply(Player player)
    {
      var p = pose;
      Root.Position = new Vec3(player.X, player.Y, player.Z);
      Root.SetEuler(0, visualFacing + p.Spin, 0);
      double runWeight = runBlend;
      double hipsY = 0.95 + p.Crouch - .12 * runWeight;
      Hips.Position = new Vec3(0, hipsY, 0);
      Hips.SetEuler(p.Flip, 0, 0);
      Torso.SetEuler(p.Lean, p.Twist, 0);
      Head.SetEuler(-p.Lean * 0.4, -p.Twist * 0.5, 0);
      Spear.Position = new Vec3(p.Gx, p.Gy - hipsY, p.Gz);
      Spear.SetEuler(-p.Pitch, p.Yaw, p.Roll, yxz: true);

      // Legs: bend the knees so the feet can reach the ground, then add stance and the run swing.
      bool airborne = player.Y > 0.25 && player.State != PlayerState.Down && player.State != PlayerState.Dead;
      bool lying = Math.Abs(p.Flip + Math.PI / 2) < 0.6;
      double thighL, thighR, kneeL, kneeR;
      if (airborne)
      {
        thighL = -1.0; thighR = -0.35; kneeL = 1.4; kneeR = 0.9;
      }
      else if (lying)
      {
        thighL = -0.1; thighR = 0.05; kneeL = 0.15; kneeR = 0.1;
      }
      else
      {
        double bend = 2 * Math.Acos(CombatMath.Clamp(hipsY / 0.95, 0.35, 1));
        double run = player.State == PlayerState.Move ? CombatMath.Smoothstep(0.3, 6.5, player.Speed) : 0;
        double swing = Math.Sin(player.RunPhase) * 0.95 * run;
        thighL = -bend / 2 - 0.35 * p.Stance + swing;
        thighR = -bend / 2 + 0.3 * p.Stance - swing;
        kneeL = bend + 0.25 * p.Stance + Math.Max(0, Math.Sin(player.RunPhase + 1.6)) * 1.1 * run;
        kneeR = bend + 0.1 * p.Stance + Math.Max(0, -Math.Sin(player.RunPhase + 1.6)) * 1.1 * run;
      }
      ThighL.SetEuler(thighL, 0, 0.04);
      ThighR.SetEuler(thighR, 0, -0.04);
      KneeL.SetEuler(kneeL, 0, 0);
      KneeR.SetEuler(kneeR, 0, 0);
      if (!airborne && !lying && Math.Abs(p.Flip) < .05)
      {
        footLocalL = StepFoot(footFromL, 1, player.RunPhase * RunPhaseScale, runWeight);
        footLocalR = StepFoot(footFromR, -1, player.RunPhase * RunPhaseScale + Math.PI, runWeight);
        SolveLeg(ThighL, KneeL, footLocalL, FootAnchorL, 1);
        SolveLeg(ThighR, KneeR, footLocalR, FootAnchorR, -1);
      }
      else
      {
        FootAnchorL.Position = KneeL.LocalToWorld(new Vec3(0, -LowerLeg, 0));
        FootAnchorR.Position = KneeR.LocalToWorld(new Vec3(0, -LowerLeg, 0));
      }
    }

    Vec3 StepFoot(Vec3 fromLocal, double side, double phase, double run)
    {
      double u = ((phase / CombatMath.Tau) % 1 + 1) % 1;
      double stride = Math.PI / (1.25 * RunPhaseScale);
      double swing = Math.Max(0, (u - .5) * 2);
      double z = u < .5 ? stride * (.5 - 2 * u) : stride * (-.5 + CombatMath.Smoothstep(0, 1, swing));
      double y = u < .5 ? 0 : Math.Sin(swing * Math.PI) * .20;
      var outV = new Vec3(side * (.15 + pose.Stance * .035), SoleAnchorY + y * run, side * pose.Stance * .30 * (1 - run) + z * run);
      if (fade < 1) outV = Vec3.Lerp(fromLocal, outV, CombatMath.Smoothstep(0, 1, fade));
      return outV;
    }

    void SolveLeg(RigNode thigh, RigNode knee, Vec3 targetLocal, RigNode marker, double side)
    {
      var v1 = Hips.WorldToLocal(Root.LocalToWorld(targetLocal));
      var pole = new Vec3(side * .15, -.5, 1.5);
      GripIk.SolveTwoBone(thigh.Position, v1, pole, UpperLeg, LowerLeg, out var elbow, out var hand);
      var q = Quat.FromUnitVectors(DownAxis, (elbow - thigh.Position).Normalized());
      thigh.Rotation = q;
      var rootQ = Quat.FromUnitVectors(DownAxis, (hand - elbow).Normalized());
      knee.Rotation = q.Inverse() * rootQ;
      marker.Position = Hips.LocalToWorld(hand);
    }

    void SolveArms(Player player)
    {
      var p = pose;
      var shoulderL = ShoulderAnchorL.WorldPosition;
      var shoulderR = ShoulderAnchorR.WorldPosition;
      var rootQ = Root.WorldRotation;
      var gripR = Spear.LocalToWorld(new Vec3(0, 0, 0));
      var axis = new Vec3(0, 0, 1).ApplyQuaternion(Spear.WorldRotation);
      GripIk.FitWeaponGrip(ref gripR, out var gripL, axis, shoulderR, shoulderL, UpperArm + LowerArm - .002, p.Lh > .98);
      Spear.Position = Spear.Parent.WorldToLocal(gripR);

      // The left hand takes the point on the shaft nearest the left shoulder; without the spear it hangs at the waist.
      double swing = player.State == PlayerState.Move ? Math.Sin(player.RunPhase) * 0.3 * CombatMath.Smoothstep(0.3, 6.5, player.Speed) : 0;
      var waist = Torso.LocalToWorld(new Vec3(0.36, 0.12, 0.12 - swing));
      var handL = Vec3.Lerp(waist, gripL, CombatMath.Clamp(p.Lh, 0, 1));

      var pole = new Vec3(-0.7, -0.6, -0.5).ApplyQuaternion(rootQ) + shoulderR;
      GripIk.SolveTwoBone(shoulderR, gripR, pole, UpperArm, LowerArm, out var elbow, out var hand);
      HandAnchorR.Position = hand;
      PlaceBone(UpperR, shoulderR, elbow);
      PlaceBone(ForeR, elbow, hand);

      pole = new Vec3(0.7, -0.6, -0.5).ApplyQuaternion(rootQ) + shoulderL;
      GripIk.SolveTwoBone(shoulderL, handL, pole, UpperArm, LowerArm, out elbow, out hand);
      HandAnchorL.Position = hand;
      PlaceBone(UpperL, shoulderL, elbow);
      PlaceBone(ForeL, elbow, hand);
    }

    static void PlaceBone(RigNode bone, Vec3 fromV, Vec3 to)
    {
      bone.Position = fromV;
      bone.Rotation = Quat.FromUnitVectors(DownAxis, (to - fromV).Normalized());
    }

    void UpdateCape(double dt, double time)
    {
      double step = Math.Min(dt, 1.0 / 30);
      var anchor = CapeAnchor.WorldPosition;
      var torsoQ = Torso.WorldRotation;
      var fwd = new Vec3(0, 0, 1).ApplyQuaternion(torsoQ);
      var right = new Vec3(1, 0, 0).ApplyQuaternion(torsoQ);
      if (!capeReady || capePts[0].DistanceToSq(anchor) > 4)
      {
        for (int i = 0; i < capePts.Length; i++)
        {
          var pt = anchor.AddScaled(fwd, -0.05 * i);
          pt.Y -= CapeLength * i;
          capePts[i] = pt;
          capePrev[i] = pt;
        }
        capeReady = true;
      }
      capePts[0] = anchor;
      for (int i = 1; i < capePts.Length; i++)
      {
        var v = (capePts[i] - capePrev[i]).Scale(0.9);
        capePrev[i] = capePts[i];
        var pt = capePts[i] + v;
        pt.Y -= 9.8 * step * step;
        pt.X += 2.2 * step * step * (1 + Math.Sin(time * 3.1 + i));
        pt.Z += 0.6 * step * step * Math.Sin(time * 2.3 + i * 1.7);
        capePts[i] = pt;
      }
      for (int iter = 0; iter < 3; iter++)
      {
        for (int i = 1; i < capePts.Length; i++)
        {
          var v = capePts[i] - capePts[i - 1];
          double len = v.Length();
          if (len == 0 || double.IsNaN(len)) len = 1e-4;
          var pt = capePts[i - 1].AddScaled(v, CapeLength / len);
          double front = (pt - anchor).Dot(fwd);
          double limit = -0.07 * i;
          if (front > limit) pt = pt.AddScaled(fwd, limit - front);
          if (pt.Y < 0.05) pt.Y = 0.05;
          capePts[i] = pt;
        }
      }
      for (int i = 0; i < Cape.Length; i++)
      {
        var seg = Cape[i];
        seg.Position = capePts[i];
        var by = (capePts[i] - capePts[i + 1]).Normalized();
        var bx = right.AddScaled(by, -right.Dot(by)).Normalized();
        var bz = Vec3.Cross(bx, by);
        seg.Rotation = Quat.FromRotationMatrix(Mat4.MakeBasis(bx, by, bz));
      }
    }
  }
}
