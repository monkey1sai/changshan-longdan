using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Changshan.Combat
{
  public readonly struct Rect
  {
    public readonly double MinX, MaxX, MinZ, MaxZ;
    public Rect(double minX, double maxX, double minZ, double maxZ) { MinX = minX; MaxX = maxX; MinZ = minZ; MaxZ = maxZ; }
  }

  // Port of src/entities/arena.ts: square play limit plus rectangular obstacles, pushing a circle out.
  public sealed class Arena
  {
    public double Limit { get; }
    public IReadOnlyList<Rect> Obstacles { get; }

    public Arena(double limit, IEnumerable<Rect> obstacles)
    {
      Limit = limit;
      Obstacles = new ReadOnlyCollection<Rect>(new List<Rect>(obstacles ?? throw new ArgumentNullException(nameof(obstacles))));
    }

    public void Constrain(ref double x, ref double z, double radius)
    {
      double lim = Limit - radius;
      x = CombatMath.Clamp(x, -lim, lim);
      z = CombatMath.Clamp(z, -lim, lim);
      for (int i = 0; i < Obstacles.Count; i++)
      {
        Rect o = Obstacles[i];
        double cx = CombatMath.Clamp(x, o.MinX, o.MaxX);
        double cz = CombatMath.Clamp(z, o.MinZ, o.MaxZ);
        double dx = x - cx;
        double dz = z - cz;
        double d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8)
        {
          double d = Math.Sqrt(d2);
          double push = (radius - d) / d;
          x += dx * push;
          z += dz * push;
        }
        else
        {
          // Centre inside the rectangle: leave through the shallowest side.
          double left = x - o.MinX;
          double right = o.MaxX - x;
          double near = z - o.MinZ;
          double far = o.MaxZ - z;
          double m = Math.Min(Math.Min(left, right), Math.Min(near, far));
          if (m == left) x = o.MinX - radius;
          else if (m == right) x = o.MaxX + radius;
          else if (m == near) z = o.MinZ - radius;
          else z = o.MaxZ + radius;
        }
      }
    }
  }

  // Port of the collision part of src/world/layout.ts (meters, y up, south gate at +Z).
  public static class ArenaLayout
  {
    public const double Inner = 56;
    public const double PlayLimit = Inner - 1;
    public const double StartX = 0;
    public const double StartZ = 42;
    public const double StartFacing = Math.PI;

    public static Rect Keep => new Rect(-20, 20, -55, -31);
    public static Rect Stairs => new Rect(-6, 6, -31, -26.5);

    static readonly Rect[] barracks =
    {
      new Rect(40, 53, -28, -13), new Rect(40, 53, -6, 7), new Rect(40, 53, 14, 28),
      new Rect(-53, -40, -28, -13), new Rect(-53, -40, -6, 7), new Rect(-53, -40, 14, 28),
    };

    // Burning wrecks are the ground-level BIG_FIRES (y < 1).
    static readonly (double X, double Z)[] wreckCentres = { (-30, 44), (36, -47) };

    static readonly (double X, double Z)[] braziers =
    {
      (-8, 40), (8, 40), (-8, 26), (8, 26), (-8, 12), (8, 12), (-8, -2), (8, -2), (-8, -16), (8, -16),
      (-11, -28.5), (11, -28.5), (-38, 10.5), (38, 10.5), (-38, -9.5), (38, -9.5),
    };

    public static Rect[] Obstacles()
    {
      var list = new List<Rect> { Keep, Stairs };
      list.AddRange(barracks);
      foreach (var (x, z) in wreckCentres) list.Add(new Rect(x - 2.2, x + 2.2, z - 2.2, z + 2.2));
      foreach (var (x, z) in braziers) list.Add(new Rect(x - 0.6, x + 0.6, z - 0.6, z + 0.6));
      return list.ToArray();
    }

    public static Arena CreateArena() => new Arena(PlayLimit, Obstacles());
  }
}
