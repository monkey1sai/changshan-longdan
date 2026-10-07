using System;
using Changshan.Combat;

namespace Changshan.Feedback
{
  // Port of src/fx/dust.ts Dust (the simulation): dust raised by landings, kills and shockwaves. A particle's Size is
  // its world diameter (the Web point size is Size * sizeScale / depth with sizeScale = height / (2 tan(fov / 2))).
  public sealed class DustField : IDustSink
  {
    public const int DefaultCapacity = 900;
    const double Tau = Math.PI * 2;

    public readonly int Capacity;
    public int Count { get; private set; }
    public readonly float[] Pos, Vel, Alpha, Size, Life, MaxLife, Grow;

    public DustField(int capacity = DefaultCapacity)
    {
      Capacity = capacity;
      Pos = new float[capacity * 3];
      Vel = new float[capacity * 3];
      Alpha = new float[capacity];
      Size = new float[capacity];
      Life = new float[capacity];
      MaxLife = new float[capacity];
      Grow = new float[capacity];
    }

    public void Clear() => Count = 0;

    public void Puff(double x, double y, double z, int n, double speed, Mulberry32 rng)
    {
      for (int k = 0; k < n; k++)
      {
        double a = rng.Next() * Tau;
        double s = speed * (0.4 + rng.Next() * 0.6);
        Spawn(x, y + 0.2, z, Math.Cos(a) * s, 0.6 + rng.Next() * 1.2, Math.Sin(a) * s, 0.5 + rng.Next() * 0.5, 0.6 + rng.Next() * 0.6);
      }
    }

    // The ring of dust around a shockwave.
    public void Ring(double x, double z, double radius, int n, Mulberry32 rng)
    {
      for (int k = 0; k < n; k++)
      {
        double a = ((double)k / n) * Tau + rng.Next() * 0.2;
        double s = radius * (2.2 + rng.Next() * 1.4);
        Spawn(x + Math.Cos(a) * 0.8, 0.3, z + Math.Sin(a) * 0.8, Math.Cos(a) * s, 0.8 + rng.Next() * 1.6, Math.Sin(a) * s, 0.9 + rng.Next() * 0.8,
          0.7 + rng.Next() * 0.5);
      }
    }

    void Spawn(double x, double y, double z, double vx, double vy, double vz, double size, double life)
    {
      if (Count >= Capacity) return;
      int i = Count++;
      int i3 = i * 3;
      Pos[i3] = (float)x; Pos[i3 + 1] = (float)y; Pos[i3 + 2] = (float)z;
      Vel[i3] = (float)vx; Vel[i3 + 1] = (float)vy; Vel[i3 + 2] = (float)vz;
      Size[i] = (float)size;
      Grow[i] = (float)(size * 2.5);
      Life[i] = (float)life;
      MaxLife[i] = (float)life;
    }

    public void Update(double dt)
    {
      for (int i = 0; i < Count; i++)
      {
        Life[i] = (float)(Life[i] - dt);
        if (Life[i] <= 0)
        {
          int last = --Count;
          if (i != last)
          {
            for (int a = 0; a < 3; a++)
            {
              Pos[i * 3 + a] = Pos[last * 3 + a];
              Vel[i * 3 + a] = Vel[last * 3 + a];
            }
            Size[i] = Size[last];
            Grow[i] = Grow[last];
            Life[i] = Life[last];
            MaxLife[i] = MaxLife[last];
          }
          i--;
          continue;
        }
        int i3 = i * 3;
        double drag = 1 - 4 * dt;
        Vel[i3] = (float)(Vel[i3] * drag);
        Vel[i3 + 1] = (float)(Vel[i3 + 1] * drag - 0.5 * dt);
        Vel[i3 + 2] = (float)(Vel[i3 + 2] * drag);
        Pos[i3] = (float)(Pos[i3] + Vel[i3] * dt);
        Pos[i3 + 1] = (float)Math.Max(0.1, Pos[i3 + 1] + Vel[i3 + 1] * dt);
        Pos[i3 + 2] = (float)(Pos[i3 + 2] + Vel[i3 + 2] * dt);
        double k = (double)Life[i] / MaxLife[i];
        Size[i] = (float)(Size[i] + Grow[i] * dt);
        Alpha[i] = (float)(0.45 * k * k);
      }
    }
  }
}
