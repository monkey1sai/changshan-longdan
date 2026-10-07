using Changshan.Combat;

namespace Changshan.Feedback
{
  // Port of src/fx/sparks.ts Sparks (the simulation; Unity draws it): hit sparks stretched along their velocity, HDR
  // colours fading with life. Values live in float arrays like the Web's Float32Array, arithmetic is in double and every
  // store rounds to float, so the stream matches the Web bit for bit apart from transcendental-function ULPs.
  public sealed class SparkField : ISparkSink
  {
    public const int DefaultCapacity = 1400;

    public readonly int Capacity;
    public int Count { get; private set; }
    public readonly float[] Pos, Vel, Color, Size, Life, MaxLife, Base;

    public SparkField(int capacity = DefaultCapacity)
    {
      Capacity = capacity;
      Pos = new float[capacity * 3];
      Vel = new float[capacity * 3];
      Color = new float[capacity * 4];
      Base = new float[capacity * 3];
      Size = new float[capacity];
      Life = new float[capacity];
      MaxLife = new float[capacity];
    }

    public void Clear() => Count = 0;

    // Sparks at a hit point; dir is the knock-back direction.
    public void Burst(double x, double y, double z, double dirX, double dirZ, int n, bool heavy, Mulberry32 rng)
    {
      for (int k = 0; k < n; k++)
      {
        double speed = (heavy ? 10 : 7) + rng.Next() * 10;
        double hot = rng.Next();
        // C# evaluates arguments left to right like JavaScript, so the draws keep the Web's order.
        Spawn(x, y, z,
          dirX * speed + (rng.Next() - 0.5) * 9, 2 + rng.Next() * 6, dirZ * speed + (rng.Next() - 0.5) * 9,
          0.03 + rng.Next() * 0.035,
          0.16 + rng.Next() * 0.28,
          6 + hot * 2, 3 + hot * 2.2, 1 + hot * 1.6);
      }
      // The flash at the moment of impact.
      Spawn(x, y, z, 0, 0, 0, heavy ? 0.55 : 0.32, 0.07, 9, 7, 5);
    }

    void Spawn(double x, double y, double z, double vx, double vy, double vz, double size, double life, double r, double g, double b)
    {
      if (Count >= Capacity) return;
      int i = Count++;
      int i3 = i * 3;
      Pos[i3] = (float)x; Pos[i3 + 1] = (float)y; Pos[i3 + 2] = (float)z;
      Vel[i3] = (float)vx; Vel[i3 + 1] = (float)vy; Vel[i3 + 2] = (float)vz;
      Base[i3] = (float)r; Base[i3 + 1] = (float)g; Base[i3 + 2] = (float)b;
      Size[i] = (float)size;
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
            Copy3(Pos, i, last);
            Copy3(Vel, i, last);
            Copy3(Base, i, last);
            Size[i] = Size[last];
            Life[i] = Life[last];
            MaxLife[i] = MaxLife[last];
          }
          i--;
          continue;
        }
        int i3 = i * 3;
        double drag = 1 - 3 * dt;
        Vel[i3] = (float)(Vel[i3] * drag);
        Vel[i3 + 2] = (float)(Vel[i3 + 2] * drag);
        Vel[i3 + 1] = (float)(Vel[i3 + 1] * drag - 16 * dt);
        Pos[i3] = (float)(Pos[i3] + Vel[i3] * dt);
        Pos[i3 + 1] = (float)(Pos[i3 + 1] + Vel[i3 + 1] * dt);
        Pos[i3 + 2] = (float)(Pos[i3 + 2] + Vel[i3 + 2] * dt);
        double k = (double)Life[i] / MaxLife[i];
        Color[i * 4] = Base[i3];
        Color[i * 4 + 1] = (float)(Base[i3 + 1] * (0.4 + 0.6 * k));
        Color[i * 4 + 2] = (float)(Base[i3 + 2] * k);
        Color[i * 4 + 3] = (float)k;
      }
    }

    static void Copy3(float[] a, int to, int from)
    {
      a[to * 3] = a[from * 3];
      a[to * 3 + 1] = a[from * 3 + 1];
      a[to * 3 + 2] = a[from * 3 + 2];
    }
  }
}
