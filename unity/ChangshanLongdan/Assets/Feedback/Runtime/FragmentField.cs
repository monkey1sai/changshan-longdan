using System;
using Changshan.Combat;

namespace Changshan.Feedback
{
  // Port of src/fx/fragments.ts Fragments (the simulation): a killed soldier bursts into voxel cubes that fall, bounce on
  // the ground and the arena edge, then shrink away. Colours come from the soldier palette by body height
  // (src/view/soldier-view.ts SOLDIER_COLORS, linear like three.js Color). Rotations are three.js 'XYZ' Euler angles.
  public sealed class FragmentField : IFragmentSink
  {
    public const int DefaultCapacity = 5000;

    // SOLDIER_COLORS converted from sRGB hex to linear (three.js ColorManagement), checked against web-presentation.json.
    public static readonly Rgb Armor = Hex(0x2f5dbd), ArmorLight = Hex(0x4f7fd8), ArmorDark = Hex(0x213f86), Cloth = Hex(0x2a2c38),
      Boot = Hex(0x1b1612), Skin = Hex(0xc8926c), Helmet = Hex(0x223153), Trim = Hex(0xb69449), Belt = Hex(0x8a6a32), Steel = Hex(0xc9d1d8),
      Wood = Hex(0x6b4a2b);

    // Body height (0 feet -> 1 head) -> palette.
    static readonly (double From, Rgb[] Colors)[] Bands =
    {
      (0.0, new[] { Boot, Cloth }),
      (0.24, new[] { Cloth, ArmorDark }),
      (0.46, new[] { ArmorDark, Belt, Armor }),
      (0.58, new[] { Armor, ArmorLight, Armor }),
      (0.83, new[] { Skin }),
      (0.92, new[] { Helmet, Trim }),
    };

    public readonly int Capacity;
    public readonly double Limit; // PLAY_LIMIT + 0.8
    public int Count { get; private set; }
    int cursor;
    public readonly float[] P, V, R, W, Size, Life, Colors;

    public FragmentField(double playLimit, int capacity = DefaultCapacity)
    {
      Capacity = capacity;
      Limit = playLimit + 0.8;
      P = new float[capacity * 3];
      V = new float[capacity * 3];
      R = new float[capacity * 3];
      W = new float[capacity * 3];
      Size = new float[capacity];
      Life = new float[capacity];
      Colors = new float[capacity * 3];
    }

    public void Clear() => Count = 0;

    public void SpawnSoldier(in KillInfo kill, Mulberry32 rng)
    {
      bool captain = kill.Kind == EnemyKind.Captain;
      double body = captain ? 1.22 : 1;
      int n = captain ? 28 : 18;
      double c = Math.Cos(kill.Yaw);
      double s = Math.Sin(kill.Yaw);
      for (int k = 0; k < n; k++)
      {
        double h = rng.Next();
        var palette = Bands[0].Colors;
        foreach (var (from, colors) in Bands) if (h >= from) palette = colors;
        bool weapon = k < 2;
        var color = weapon ? (k == 0 ? Steel : Wood) : palette[(int)Math.Floor(rng.Next() * palette.Length)];
        double lx = (rng.Next() - 0.5) * 0.46 * body;
        double lz = (rng.Next() - 0.5) * 0.3 * body;
        Spawn(kill.X + lx * c + lz * s,
          kill.Y + (weapon ? 1.1 : h * 1.8 * body),
          kill.Z - lx * s + lz * c,
          kill.Vx + (rng.Next() - 0.5) * 5,
          kill.Vy + 1.5 + rng.Next() * 4 + h * 2,
          kill.Vz + (rng.Next() - 0.5) * 5,
          (0.12 + rng.Next() * 0.11) * body,
          1.8 + rng.Next() * 1.4,
          color, rng);
      }
    }

    void Spawn(double x, double y, double z, double vx, double vy, double vz, double size, double life, Rgb color, Mulberry32 rng)
    {
      int i;
      if (Count < Capacity) i = Count++;
      else i = cursor = (cursor + 1) % Capacity;
      int i3 = i * 3;
      P[i3] = (float)x; P[i3 + 1] = (float)y; P[i3 + 2] = (float)z;
      V[i3] = (float)vx; V[i3 + 1] = (float)vy; V[i3 + 2] = (float)vz;
      R[i3] = (float)(rng.Next() * 6); R[i3 + 1] = (float)(rng.Next() * 6); R[i3 + 2] = (float)(rng.Next() * 6);
      W[i3] = (float)((rng.Next() - 0.5) * 28); W[i3 + 1] = (float)((rng.Next() - 0.5) * 28); W[i3 + 2] = (float)((rng.Next() - 0.5) * 28);
      Size[i] = (float)size;
      Life[i] = (float)life;
      Colors[i3] = (float)color.R; Colors[i3 + 1] = (float)color.G; Colors[i3 + 2] = (float)color.B;
    }

    public void Update(double dt)
    {
      for (int i = 0; i < Count; i++)
      {
        Life[i] = (float)(Life[i] - dt);
        if (Life[i] <= 0)
        {
          Remove(i);
          i--;
          continue;
        }
        int i3 = i * 3;
        double half = Size[i] / 2.0;
        double drag = 1 - 0.25 * dt;
        V[i3] = (float)(V[i3] * drag);
        V[i3 + 2] = (float)(V[i3 + 2] * drag);
        V[i3 + 1] = (float)(V[i3 + 1] - 24 * dt);
        for (int a = 0; a < 3; a++)
        {
          P[i3 + a] = (float)(P[i3 + a] + V[i3 + a] * dt);
          R[i3 + a] = (float)(R[i3 + a] + W[i3 + a] * dt);
        }
        if (P[i3 + 1] < half)
        {
          P[i3 + 1] = (float)half;
          if (V[i3 + 1] < 0)
          {
            V[i3 + 1] = Math.Abs(V[i3 + 1]) < 1 ? 0 : (float)(-V[i3 + 1] * 0.32);
            V[i3] = (float)(V[i3] * 0.7);
            V[i3 + 2] = (float)(V[i3 + 2] * 0.7);
            for (int a = 0; a < 3; a++) W[i3 + a] = (float)(W[i3 + a] * 0.65);
          }
        }
        for (int a = 0; a <= 2; a += 2)
        {
          if (Math.Abs(P[i3 + a]) > Limit)
          {
            P[i3 + a] = (float)(Math.Sign(P[i3 + a]) * Limit);
            V[i3 + a] = (float)(V[i3 + a] * -0.4);
          }
        }
      }
    }

    // The displayed edge length: shrinks over the last 0.35 s of life.
    public double DisplaySize(int i) => Size[i] * Math.Min(1, Life[i] / 0.35);

    // Fills the last one into the gap to keep the arrays packed.
    void Remove(int i)
    {
      int last = --Count;
      if (i == last) return;
      int i3 = i * 3, l3 = last * 3;
      for (int a = 0; a < 3; a++)
      {
        P[i3 + a] = P[l3 + a];
        V[i3 + a] = V[l3 + a];
        R[i3 + a] = R[l3 + a];
        W[i3 + a] = W[l3 + a];
        Colors[i3 + a] = Colors[l3 + a];
      }
      Size[i] = Size[last];
      Life[i] = Life[last];
    }

    // three.js Color.setHex under ColorManagement: sRGB channel -> linear.
    public static Rgb Hex(int hex) => new Rgb(SrgbToLinear(((hex >> 16) & 255) / 255.0), SrgbToLinear(((hex >> 8) & 255) / 255.0),
      SrgbToLinear((hex & 255) / 255.0));

    static double SrgbToLinear(double c) => c < 0.04045 ? c * 0.0773993808 : Math.Pow(c * 0.9478672986 + 0.0521327014, 2.4);
  }
}
