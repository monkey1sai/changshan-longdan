using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Animation
{
  // Port of src/view/player-poses.ts. Character-local: +z forward, +x left, +y up. Only the spear and body are posed;
  // the hands are placed on the spear by IK.
  public struct Pose
  {
    public double Lean, Twist, Crouch, Spin, Flip, Gx, Gy, Gz, Yaw, Pitch, Roll, Stance, Lh;

    public static Pose Mix(in Pose a, in Pose b, double t) => new Pose
    {
      Lean = CombatMath.Lerp(a.Lean, b.Lean, t), Twist = CombatMath.Lerp(a.Twist, b.Twist, t), Crouch = CombatMath.Lerp(a.Crouch, b.Crouch, t),
      Spin = CombatMath.Lerp(a.Spin, b.Spin, t), Flip = CombatMath.Lerp(a.Flip, b.Flip, t), Gx = CombatMath.Lerp(a.Gx, b.Gx, t),
      Gy = CombatMath.Lerp(a.Gy, b.Gy, t), Gz = CombatMath.Lerp(a.Gz, b.Gz, t), Yaw = CombatMath.Lerp(a.Yaw, b.Yaw, t),
      Pitch = CombatMath.Lerp(a.Pitch, b.Pitch, t), Roll = CombatMath.Lerp(a.Roll, b.Roll, t), Stance = CombatMath.Lerp(a.Stance, b.Stance, t),
      Lh = CombatMath.Lerp(a.Lh, b.Lh, t),
    };

    // Fading between different actions: whole-body spin and flip take the shortest way so nothing unwinds a full turn.
    public static Pose Crossfade(in Pose from, in Pose to, double t)
    {
      var p = Mix(from, to, t);
      p.Spin = from.Spin + CombatMath.WrapAngle(to.Spin - from.Spin) * t;
      p.Flip = from.Flip + CombatMath.WrapAngle(to.Flip - from.Flip) * t;
      return p;
    }

    public double this[int i]
    {
      get
      {
        switch (i)
        {
          case 0: return Lean; case 1: return Twist; case 2: return Crouch; case 3: return Spin; case 4: return Flip;
          case 5: return Gx; case 6: return Gy; case 7: return Gz; case 8: return Yaw; case 9: return Pitch;
          case 10: return Roll; case 11: return Stance; case 12: return Lh;
          default: throw new ArgumentOutOfRangeException(nameof(i));
        }
      }
    }

    public static readonly string[] FieldNames = { "lean", "twist", "crouch", "spin", "flip", "gx", "gy", "gz", "yaw", "pitch", "roll", "stance", "lh" };
  }

  // Overrides on top of STANCE, mirroring the Web's P({...}) partial objects.
  struct Partial
  {
    public double? Lean, Twist, Crouch, Spin, Flip, Gx, Gy, Gz, Yaw, Pitch, Roll, Stance, Lh;

    public Pose On(Pose b)
    {
      if (Lean.HasValue) b.Lean = Lean.Value;
      if (Twist.HasValue) b.Twist = Twist.Value;
      if (Crouch.HasValue) b.Crouch = Crouch.Value;
      if (Spin.HasValue) b.Spin = Spin.Value;
      if (Flip.HasValue) b.Flip = Flip.Value;
      if (Gx.HasValue) b.Gx = Gx.Value;
      if (Gy.HasValue) b.Gy = Gy.Value;
      if (Gz.HasValue) b.Gz = Gz.Value;
      if (Yaw.HasValue) b.Yaw = Yaw.Value;
      if (Pitch.HasValue) b.Pitch = Pitch.Value;
      if (Roll.HasValue) b.Roll = Roll.Value;
      if (Stance.HasValue) b.Stance = Stance.Value;
      if (Lh.HasValue) b.Lh = Lh.Value;
      return b;
    }

    // { ...this, ...over } in the Web.
    public Partial With(Partial over) => new Partial
    {
      Lean = over.Lean ?? Lean, Twist = over.Twist ?? Twist, Crouch = over.Crouch ?? Crouch, Spin = over.Spin ?? Spin, Flip = over.Flip ?? Flip,
      Gx = over.Gx ?? Gx, Gy = over.Gy ?? Gy, Gz = over.Gz ?? Gz, Yaw = over.Yaw ?? Yaw, Pitch = over.Pitch ?? Pitch, Roll = over.Roll ?? Roll,
      Stance = over.Stance ?? Stance, Lh = over.Lh ?? Lh,
    };

    public static Partial Of(in Pose p) => new Partial
    {
      Lean = p.Lean, Twist = p.Twist, Crouch = p.Crouch, Spin = p.Spin, Flip = p.Flip, Gx = p.Gx, Gy = p.Gy, Gz = p.Gz, Yaw = p.Yaw,
      Pitch = p.Pitch, Roll = p.Roll, Stance = p.Stance, Lh = p.Lh,
    };
  }

  public static class PlayerPoses
  {
    const double Tau = CombatMath.Tau;

    public static readonly Pose Stance = new Pose
    {
      Lean = 0.08, Twist = -0.1, Crouch = -0.05, Spin = 0, Flip = 0, Gx = -0.16, Gy = 1.08, Gz = 0.2, Yaw = 0.25, Pitch = -0.18, Roll = 0, Stance = 0.4, Lh = 1,
    };

    static Pose P(Partial o) => o.On(Stance);

    public static readonly Pose Run = P(new Partial { Lean = 0.3, Twist = 0, Crouch = -0.02, Gx = -0.3, Gy = 1.02, Gz = -0.08, Yaw = -2.75, Pitch = 0.35, Stance = 0, Lh = 0 });
    public static readonly Pose Air = P(new Partial { Lean = 0.1, Crouch = 0, Gx = -0.25, Gy = 1.2, Gz = 0, Yaw = -2.5, Pitch = 0.5, Stance = 0, Lh = 0 });
    public static readonly Pose Hurt = P(new Partial { Lean = -0.35, Twist = 0.25, Crouch = -0.1, Gx = -0.3, Gy = 1.1, Gz = -0.05, Yaw = -1.9, Pitch = 0.6, Lh = 0, Stance = 0.2 });
    public static readonly Pose Down = P(new Partial { Lean = 0, Flip = -Math.PI / 2, Crouch = -0.7, Gx = -0.35, Gy = 0.95, Gz = 0, Yaw = -1.6, Pitch = 0.1, Lh = 0, Stance = 0 });
    public static readonly Pose Roll = P(new Partial { Lean = 0.4, Crouch = -0.45, Gx = -0.2, Gy = 1.0, Gz = 0.1, Yaw = -2.6, Pitch = 0.3, Lh = 0, Stance = 0 });
    public static readonly Pose Guard = P(new Partial { Lean = -0.08, Twist = -0.24, Crouch = -0.14, Gx = -0.3, Gy = 1.36, Gz = 0.18, Yaw = -0.72, Pitch = 0.52, Roll = -0.08, Stance = 0.88, Lh = 1 });

    readonly struct Key
    {
      public readonly double T;
      public readonly Pose P;
      public Key(double t, Pose p) { T = t; P = p; }
    }

    static Key K(double t) => new Key(t, Stance);
    static Key K(double t, Partial o) => new Key(t, P(o));

    static readonly Partial Side = new Partial { Gx = -0.36, Gy = 1.12, Gz = 0.02, Yaw = -1.55, Pitch = 0.02, Twist = -0.3, Crouch = -0.12, Lh = 0 };
    static readonly Partial Thrust = new Partial { Gx = -0.12, Gy = 1.2, Gz = 0.62, Yaw = 0, Pitch = 0.02, Lean = 0.28, Twist = 0.15, Stance = 1 };
    static readonly Partial C2Low = new Partial { Gx = -0.3, Gy = 0.9, Gz = 0.3, Yaw = -0.6, Pitch = -0.9, Lean = 0.3, Crouch = -0.28, Twist = -0.4, Stance = 0.9 };
    static readonly Partial C2High = new Partial { Gx = -0.1, Gy = 1.55, Gz = 0.3, Yaw = 0.4, Pitch = 1.45, Lean = -0.2, Twist = 0.3, Crouch = 0.05, Stance = 0.4 };
    static readonly Partial BigWind = new Partial { Gx = -0.24, Gy = 1.1, Gz = -0.25, Yaw = 0.05, Pitch = 0.05, Twist = -0.55, Lean = -0.05, Crouch = -0.18, Stance = 0.8 };
    static readonly Partial BigThrust = new Partial { Gx = -0.1, Gy = 1.18, Gz = 0.72, Yaw = 0, Pitch = 0.02, Twist = 0.3, Lean = 0.5, Crouch = -0.25, Stance = 1.2 };
    static readonly Partial Slam = new Partial { Gx = -0.08, Gy = 0.85, Gz = 0.55, Yaw = 0, Pitch = -1.25, Lean = 0.6, Crouch = -0.45, Stance = 1.2 };
    static readonly Partial GuardPartial = Partial.Of(Guard);

    static Key[] Barrage()
    {
      var keys = new List<Key> { K(0), K(0.08, new Partial { Gx = -0.2, Gy = 1.15, Gz = 0, Yaw = 0, Pitch = 0, Lean = 0.1, Twist = -0.3, Stance = 1 }) };
      for (int i = 0; i < 8; i++)
      {
        double t = 0.12 + i * 0.08;
        keys.Add(K(t, Thrust.With(new Partial { Gy = 1.12 + (i % 3) * 0.05, Yaw = i % 2 == 0 ? -0.22 : 0.22, Pitch = ((i % 3) - 1) * 0.1, Lean = 0.3 })));
        keys.Add(K(t + 0.04, new Partial { Gx = -0.2, Gy = 1.15, Gz = 0.12, Yaw = 0, Lean = 0.2, Twist = -0.2, Stance = 1 }));
      }
      keys.Add(K(0.8, BigWind.With(new Partial { Twist = -0.6 })));
      keys.Add(K(0.93, BigThrust));
      keys.Add(K(1.15, BigThrust));
      keys.Add(K(1.35));
      return keys.ToArray();
    }

    static readonly Dictionary<MoveId, Key[]> anims = BuildAnims();

    static Dictionary<MoveId, Key[]> BuildAnims()
    {
      var dashHold = Thrust.With(new Partial { Gx = -0.13, Gy = 1.12, Gz = 0.88, Pitch = -0.04, Lean = 0.48, Crouch = -0.22, Stance = 1.25 });
      var counterHold = BigThrust.With(new Partial { Gx = -0.08, Gy = 1.24, Gz = 0.9, Yaw = -0.1, Pitch = 0.08, Twist = 0.18, Lean = 0.55, Crouch = -0.2, Stance = 1.25 });
      var n6Hold = BigThrust.With(new Partial { Twist = 0.25, Lean = 0.45, Gz = 0.7 });
      var c1Up = new Partial { Gx = -0.15, Gy = 1.5, Gz = 0.35, Yaw = 0.05, Pitch = 1.25, Lean = -0.12, Crouch = 0, Twist = 0.1, Stance = 0.6 };
      var c3Slam = Slam.With(new Partial { Crouch = -0.35, Pitch = -1.1, Gy = 0.95, Gz = 0.6, Lean = 0.5 });
      var n4Thrust = Thrust.With(new Partial { Gz = 0.66, Yaw = 0.08, Pitch = 0.04, Lean = 0.34, Twist = 0.2, Stance = 1.1 });
      return new Dictionary<MoveId, Key[]>
      {
        [MoveId.DASH] = new[]
        {
          K(0, GuardPartial.With(new Partial { Gx = -0.34, Gy = 1.04, Gz = -0.1, Yaw = -0.22, Pitch = -0.18, Lean = 0.32, Crouch = -0.26, Lh = 0 })),
          K(0.055, new Partial { Gx = -0.2, Gy = 1.08, Gz = 0.08, Yaw = -0.08, Pitch = -0.08, Lean = 0.38, Crouch = -0.25, Stance = 1.05, Lh = 0 }),
          K(0.13, dashHold), K(0.24, dashHold), K(0.38),
        },
        [MoveId.COUNTER] = new[]
        {
          K(0, GuardPartial),
          K(0.075, new Partial { Gx = 0.08, Gy = 1.48, Gz = -0.02, Yaw = 1.28, Pitch = 0.72, Twist = 0.62, Lean = -0.2, Crouch = -0.08, Stance = 0.72, Lh = 0 }),
          K(0.18, counterHold), K(0.36, counterHold), K(0.62),
        },
        [MoveId.N1] = new[] { K(0), K(0.06, new Partial { Gx = -0.2, Gy = 1.15, Gz = -0.05, Yaw = 0.05, Pitch = 0, Lean = 0, Twist = -0.35 }), K(0.12, Thrust), K(0.24, Thrust), K(0.42) },
        [MoveId.N2] = new[]
        {
          K(0),
          K(0.07, new Partial { Gx = -0.36, Gy = 1.2, Gz = 0.05, Yaw = -1.35, Pitch = 0.08, Twist = -0.6, Lean = 0.05, Lh = 0 }),
          K(0.16, new Partial { Gx = -0.1, Gy = 1.2, Gz = 0.35, Yaw = 0.1, Pitch = 0.05, Twist = 0, Lean = 0.18, Stance = 0.8, Lh = 0 }),
          K(0.24, new Partial { Gx = 0.18, Gy = 1.15, Gz = 0.2, Yaw = 1.45, Pitch = 0.02, Twist = 0.6, Lean = 0.12, Stance = 0.8, Lh = 0 }),
          K(0.46),
        },
        [MoveId.N3] = new[]
        {
          K(0, new Partial { Gx = 0.1, Yaw = 1.2, Twist = 0.5, Lh = 0 }),
          K(0.06, new Partial { Gx = 0.15, Gy = 1.2, Gz = 0.15, Yaw = 1.4, Pitch = 0.1, Twist = 0.55, Lh = 0 }),
          K(0.16, new Partial { Gx = -0.1, Gy = 1.25, Gz = 0.4, Yaw = 0, Pitch = 0.18, Twist = 0, Lean = 0.18, Stance = 0.8, Lh = 0 }),
          K(0.24, new Partial { Gx = -0.38, Gy = 1.3, Gz = 0.1, Yaw = -1.5, Pitch = 0.3, Twist = -0.6, Stance = 0.8, Lh = 0 }),
          K(0.46),
        },
        [MoveId.N4] = new[]
        {
          K(0),
          K(0.05, new Partial { Gx = -0.2, Gy = 1.12, Gz = -0.05, Yaw = 0.02, Pitch = -0.05, Twist = -0.3, Lean = 0.05 }),
          K(0.11, Thrust.With(new Partial { Yaw = -0.08, Pitch = -0.02, Lean = 0.3 })),
          K(0.17, new Partial { Gx = -0.2, Gy = 1.18, Gz = 0, Yaw = 0.08, Pitch = 0.02, Lean = 0.1, Twist = -0.25, Stance = 1 }),
          K(0.25, n4Thrust), K(0.36, n4Thrust), K(0.55),
        },
        [MoveId.N5] = new[]
        {
          K(0), K(0.08, Side.With(new Partial { Spin = 0 })), K(0.32, Side.With(new Partial { Spin = Tau })), K(0.4, Side.With(new Partial { Spin = Tau })),
          K(0.6, new Partial { Spin = Tau }),
        },
        [MoveId.N6] = new[] { K(0), K(0.1, BigWind), K(0.2, n6Hold), K(0.5, n6Hold), K(0.85) },
        [MoveId.C1] = new[]
        {
          K(0),
          K(0.1, new Partial { Gx = -0.25, Gy = 0.95, Gz = 0.3, Yaw = 0.1, Pitch = -0.75, Lean = 0.25, Crouch = -0.2, Twist = -0.2, Stance = 0.8 }),
          K(0.22, c1Up), K(0.45, c1Up), K(0.72),
        },
        [MoveId.C2] = new[] { K(0), K(0.1, C2Low), K(0.24, C2High), K(0.5, C2High), K(0.78) },
        [MoveId.C3] = new[]
        {
          K(0), K(0.1, C2Low), K(0.22, C2High),
          K(0.36, new Partial { Gx = -0.3, Gy = 1.3, Gz = 0.2, Yaw = -1.2, Pitch = 0.1, Twist = -0.5, Lh = 0, Stance = 0 }),
          K(0.44, new Partial { Gx = 0.1, Gy = 1.3, Gz = 0.25, Yaw = 1.2, Pitch = 0.1, Twist = 0.5, Lh = 0, Stance = 0 }),
          K(0.52, new Partial { Gx = 0.1, Gy = 1.35, Gz = 0.2, Yaw = 1.25, Pitch = 0.25, Twist = 0.5, Lh = 0, Stance = 0 }),
          K(0.6, new Partial { Gx = -0.3, Gy = 1.3, Gz = 0.25, Yaw = -1.2, Pitch = 0, Twist = -0.5, Lh = 0, Stance = 0 }),
          K(0.68, new Partial { Gx = -0.32, Gy = 1.35, Gz = 0.15, Yaw = -1.3, Pitch = 0.4, Twist = -0.55, Lh = 0, Stance = 0 }),
          K(0.76, new Partial { Gx = 0.12, Gy = 1.25, Gz = 0.25, Yaw = 1.3, Pitch = -0.2, Twist = 0.55, Lh = 0, Stance = 0 }),
          K(0.82, new Partial { Gx = -0.1, Gy = 1.7, Gz = 0.1, Yaw = 0, Pitch = 1.3, Lean = -0.2, Stance = 0 }),
          K(0.9, c3Slam), K(1.0, c3Slam), K(1.2),
        },
        [MoveId.C4] = new[]
        {
          K(0), K(0.08, Side.With(new Partial { Crouch = -0.2, Spin = 0 })), K(0.52, Side.With(new Partial { Crouch = -0.2, Spin = 2 * Tau })),
          K(0.62, Side.With(new Partial { Spin = 2 * Tau })), K(0.9, new Partial { Spin = 2 * Tau }),
        },
        [MoveId.C5] = Barrage(),
        [MoveId.C6] = new[]
        {
          K(0),
          K(0.1, new Partial { Gx = -0.2, Gy = 1.3, Gz = 0.3, Yaw = 0.2, Pitch = 0.9, Lean = -0.1, Stance = 0.5 }),
          K(0.36, new Partial { Gx = -0.05, Gy = 1.8, Gz = 0, Yaw = 0, Pitch = 1.45, Lean = -0.3, Crouch = 0, Stance = 0 }),
          K(0.5, new Partial { Gx = -0.05, Gy = 1.85, Gz = -0.05, Yaw = 0, Pitch = 1.5, Lean = -0.35, Stance = 0 }),
          K(0.56, Slam), K(0.95, Slam), K(1.3),
        },
        [MoveId.JA] = new[]
        {
          K(0, new Partial { Gx = -0.1, Gy = 1.5, Gz = 0.1, Pitch = 1.2, Stance = 0, Lean = -0.1 }),
          K(0.1, new Partial { Gx = -0.08, Gy = 1.0, Gz = 0.4, Pitch = -1.35, Lean = 0.5, Crouch = -0.2, Stance = 0 }),
          K(0.2, new Partial { Gx = -0.08, Gy = 0.8, Gz = 0.5, Pitch = -1.3, Crouch = -0.4, Stance = 1, Lean = 0.5 }),
          K(0.5),
        },
        [MoveId.JC] = new[]
        {
          K(0, Side.With(new Partial { Spin = 0, Stance = 0 })), K(0.34, Side.With(new Partial { Spin = Tau, Stance = 0 })),
          K(0.46, Side.With(new Partial { Spin = Tau, Crouch = -0.3, Stance = 0.6 })), K(0.6, new Partial { Spin = Tau }),
        },
      };
    }

    static Pose Sample(Key[] keys, double t)
    {
      if (t <= keys[0].T) return keys[0].P;
      for (int i = 1; i < keys.Length; i++)
      {
        var b = keys[i];
        if (t <= b.T)
        {
          var a = keys[i - 1];
          return Pose.Mix(a.P, b.P, CombatMath.Smoothstep(0, 1, (t - a.T) / (b.T - a.T)));
        }
      }
      return keys[keys.Length - 1].P;
    }

    static readonly Pose Raise = P(new Partial { Gx = -0.05, Gy = 1.85, Gz = 0.05, Pitch = 1.5, Lean = -0.25, Stance = 0.5, Lh = 1 });
    static readonly Pose RaiseHigh = P(new Partial { Gx = -0.05, Gy = 1.9, Gz = -0.1, Pitch = 1.5, Lean = -0.3, Crouch = 0, Stance = 0.6, Spin = 3 * Tau });
    static readonly Pose Final = P(BigThrust.With(new Partial { Pitch = -0.2, Gz = 0.75, Lean = 0.55, Crouch = -0.3, Spin = 3 * Tau }));

    static double EaseOutCubic(double t)
    {
      double u = 1 - t;
      return 1 - u * u * u;
    }

    // Raise and charge, three spinning turns of thrusts, raise high to call the dragon, then one full thrust.
    static Pose MusouPose(double t)
    {
      if (t < 0.3) return Pose.Mix(Stance, Raise, CombatMath.Smoothstep(0, 1, t / 0.3));
      if (t < 2.6)
      {
        double u = t - 0.3;
        double n = Math.Floor(u / 0.12);
        double beat = u / 0.12 - n;
        double thrust = beat < 0.35 ? beat / 0.35 : 1 - (beat - 0.35) / 0.65;
        var o = Stance;
        o.Spin = (u / 2.3) * 3 * Tau;
        o.Gx = -0.14;
        o.Gz = 0.1 + 0.55 * thrust;
        o.Gy = 1.15 + (JsMod(n, 3) - 1) * 0.12;
        o.Yaw = (JsMod(n, 2) == 0 ? 0.35 : -0.35) * (1 - thrust * 0.5);
        o.Pitch = (JsMod(n, 3) - 1) * 0.15;
        o.Lean = 0.2 + 0.15 * thrust;
        o.Twist = 0.2 * thrust - 0.1;
        o.Crouch = -0.12;
        o.Stance = 1;
        return o;
      }
      if (t < 2.95)
      {
        var s = Stance;
        s.Spin = 3 * Tau;
        return Pose.Mix(s, RaiseHigh, CombatMath.Smoothstep(0, 1, (t - 2.6) / 0.35));
      }
      if (t < 3.1) return Pose.Mix(RaiseHigh, Final, EaseOutCubic((t - 2.95) / 0.15));
      if (t < 3.35) return Final;
      var end = Stance;
      end.Spin = 3 * Tau;
      return Pose.Mix(Final, end, CombatMath.Smoothstep(0, 1, (t - 3.35) / 0.25));
    }

    // JavaScript % on doubles (sign of the dividend), as used on Math.floor results.
    static double JsMod(double a, double b) => a % b;

    public static Pose MovePose(MoveId id, double t) => id == MoveId.MUSOU ? MusouPose(t) : Sample(anims[id], t);
  }
}
