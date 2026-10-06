using System;

namespace Changshan.Combat
{
  // The part of src/entities/enemies.ts EnemyStore that receives hits: position, size, health and life, in SoA arrays.
  // Soldiers here do not move or react (reactions are E07, AI is E08). Health is single precision like the Web's
  // Float32Array, so damage rounds the same way.
  public sealed class HitTargets
  {
    public const double BodyRadius = 0.42;

    readonly double[] x, y, z, scale;
    readonly float[] hp, maxHp;
    readonly bool[] alive;

    public int Capacity { get; }
    public int Count { get; private set; }
    public int AliveCount { get; private set; }

    public HitTargets(int capacity)
    {
      if (capacity < 0) throw new ArgumentOutOfRangeException(nameof(capacity));
      Capacity = capacity;
      x = new double[capacity];
      y = new double[capacity];
      z = new double[capacity];
      scale = new double[capacity];
      hp = new float[capacity];
      maxHp = new float[capacity];
      alive = new bool[capacity];
    }

    public int Add(double px, double py, double pz, double size, float health)
    {
      if (Count == Capacity) throw new InvalidOperationException($"HIT_TARGETS_FULL: capacity {Capacity}");
      if (!(size > 0) || double.IsInfinity(size)) throw new ArgumentOutOfRangeException(nameof(size));
      if (!(health > 0) || float.IsInfinity(health)) throw new ArgumentOutOfRangeException(nameof(health));
      int i = Count++;
      x[i] = px;
      y[i] = py;
      z[i] = pz;
      scale[i] = size;
      hp[i] = maxHp[i] = health;
      alive[i] = true;
      AliveCount++;
      return i;
    }

    public void Clear() => Count = AliveCount = 0;

    public double X(int i) => x[Check(i)];
    public double Y(int i) => y[Check(i)];
    public double Z(int i) => z[Check(i)];
    public double Scale(int i) => scale[Check(i)];
    public float Hp(int i) => hp[Check(i)];
    public float MaxHp(int i) => maxHp[Check(i)];
    public bool Alive(int i) => alive[Check(i)];
    public double Radius(int i) => BodyRadius * scale[Check(i)];

    // Applies damage and reports whether this hit killed the target.
    internal bool Damage(int i, double amount)
    {
      hp[i] = (float)(hp[i] - amount);
      if (hp[i] > 0) return false;
      alive[i] = false;
      AliveCount--;
      return true;
    }

    // Port of EnemyStore.nearest: the closest living target strictly within maxDist, or -1.
    // The Web walks spatial-hash cells, so only exact distance ties could pick a different target.
    public int Nearest(double px, double pz, double maxDist)
    {
      int best = -1;
      double bestD = maxDist * maxDist;
      for (int i = 0; i < Count; i++)
      {
        if (!alive[i]) continue;
        double dx = x[i] - px, dz = z[i] - pz;
        double d2 = dx * dx + dz * dz;
        if (d2 < bestD)
        {
          bestD = d2;
          best = i;
        }
      }
      return best;
    }

    int Check(int i)
    {
      if ((uint)i >= (uint)Count) throw new ArgumentOutOfRangeException(nameof(i));
      return i;
    }
  }
}
