using System;

namespace Changshan.Feedback
{
  // Port of src/fx/shockwave.ts Shockwaves (the timing; Unity draws the meshes): ground rings for landings and big
  // moves, light pillars for the musou finale. A fixed pool; when every slot is busy the first one restarts.
  public sealed class ShockwaveSet : IWaveSink
  {
    public const int RingCount = 10, PillarCount = 3;

    public sealed class Effect
    {
      public bool Active;
      public double T, Duration = 1, Radius = 1, Height = 1;
      public double X, Y, Z;
      public double ScaleX, ScaleY, ScaleZ; // the mesh scale (ring: unit 2x2 plane; pillar: unit open cylinder)
      public double Alpha;
      public Rgb Color;
    }

    public readonly Effect[] Rings = new Effect[RingCount];
    public readonly Effect[] Pillars = new Effect[PillarCount];

    public ShockwaveSet()
    {
      for (int i = 0; i < RingCount; i++) Rings[i] = new Effect();
      for (int i = 0; i < PillarCount; i++) Pillars[i] = new Effect();
    }

    public int ActiveCount
    {
      get
      {
        int n = 0;
        foreach (var e in Rings) if (e.Active) n++;
        foreach (var e in Pillars) if (e.Active) n++;
        return n;
      }
    }

    public void Ring(double x, double z, double radius, double duration, Rgb color) => Start(Free(Rings), x, 0.08, z, radius, 1, duration, color);

    public void Pillar(double x, double z, double radius, double height, double duration, Rgb color) =>
      Start(Free(Pillars), x, 0, z, radius, height, duration, color);

    public void Clear()
    {
      foreach (var e in Rings) e.Active = false;
      foreach (var e in Pillars) e.Active = false;
    }

    public void Update(double dt)
    {
      foreach (var e in Rings)
      {
        if (!e.Active) continue;
        e.T += dt;
        double k = Math.Min(1, e.T / e.Duration);
        double r = e.Radius * (0.15 + 0.85 * EaseOutCubic(k));
        e.ScaleX = r; e.ScaleY = 1; e.ScaleZ = r;
        e.Alpha = (1 - k) * (1 - k);
        if (k >= 1) e.Active = false;
      }
      foreach (var e in Pillars)
      {
        if (!e.Active) continue;
        e.T += dt;
        double k = Math.Min(1, e.T / e.Duration);
        double r = e.Radius * (1 - 0.6 * k);
        e.ScaleX = r; e.ScaleY = e.Height * (0.4 + 0.6 * EaseOutCubic(Math.Min(1, k * 3))); e.ScaleZ = r;
        e.Alpha = 1 - k;
        if (k >= 1) e.Active = false;
      }
    }

    static Effect Free(Effect[] pool)
    {
      foreach (var e in pool) if (!e.Active) return e;
      return pool[0];
    }

    // A freshly started effect keeps its previous mesh scale until the next update, as in the Web.
    static void Start(Effect e, double x, double y, double z, double radius, double height, double duration, Rgb color)
    {
      e.Active = true;
      e.T = 0;
      e.Duration = duration;
      e.Radius = radius;
      e.Height = height;
      e.X = x; e.Y = y; e.Z = z;
      e.Color = color;
    }

    // math.ts easeOutCubic.
    public static double EaseOutCubic(double t)
    {
      double u = 1 - t;
      return 1 - u * u * u;
    }
  }
}
