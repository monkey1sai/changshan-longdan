using System;

namespace Changshan.Feedback
{
  // Port of src/fx/trail.ts Trail (the ribbon data; Unity builds the mesh): the spear's two trail points recorded over
  // game time form a strip; a fast swing is filled in with Catmull-Rom points so the arc stays smooth. Musou makes it
  // gold and longer. Float arrays like the Web's Float32Array (times included).
  public sealed class TrailRibbon
  {
    public const int Max = 64;

    readonly float[] bases = new float[Max * 3];
    readonly float[] tips = new float[Max * 3];
    readonly float[] times = new float[Max];
    readonly double[] scratchB = new double[3], scratchT = new double[3];

    public int Count { get; private set; }
    public readonly float[] Positions = new float[Max * 2 * 3]; // per point: base xyz, tip xyz
    public readonly float[] Fade = new float[Max * 2]; // per point: base fade, tip fade
    public Rgb Color { get; private set; } = new Rgb(1.6, 2.4, 3.4);
    public double Lifetime { get; private set; } = 0.14;

    public void SetStyle(bool musou)
    {
      Color = new Rgb(musou ? 4.2 : 1.6, musou ? 2.8 : 2.4, musou ? 0.9 : 3.4);
      Lifetime = musou ? 0.22 : 0.14;
    }

    public void Clear() => Count = 0;

    public void Push(double bx, double by, double bz, double tx, double ty, double tz, double time)
    {
      if (Count > 0)
      {
        int l = (Count - 1) * 3;
        double dist = Hypot3(tx - tips[l], ty - tips[l + 1], tz - tips[l + 2]);
        int steps = (int)Math.Min(6, Math.Floor(dist / 0.22));
        if (steps > 0)
        {
          int pl = Count >= 2 ? (Count - 2) * 3 : l;
          double lastTime = times[Count - 1];
          for (int s = 1; s <= steps; s++)
          {
            double t = (double)s / (steps + 1);
            for (int a = 0; a < 3; a++)
            {
              double nb = a == 0 ? bx : a == 1 ? by : bz;
              double nt = a == 0 ? tx : a == 1 ? ty : tz;
              scratchB[a] = CatmullRom(bases[pl + a], bases[l + a], nb, nb + (nb - bases[l + a]), t);
              scratchT[a] = CatmullRom(tips[pl + a], tips[l + a], nt, nt + (nt - tips[l + a]), t);
            }
            Add(scratchB[0], scratchB[1], scratchB[2], scratchT[0], scratchT[1], scratchT[2], lastTime + (time - lastTime) * t);
          }
        }
      }
      Add(bx, by, bz, tx, ty, tz, time);
    }

    void Add(double bx, double by, double bz, double tx, double ty, double tz, double time)
    {
      if (Count == Max)
      {
        Array.Copy(bases, 3, bases, 0, (Max - 1) * 3);
        Array.Copy(tips, 3, tips, 0, (Max - 1) * 3);
        Array.Copy(times, 1, times, 0, Max - 1);
        Count--;
      }
      int i = Count++;
      bases[i * 3] = (float)bx; bases[i * 3 + 1] = (float)by; bases[i * 3 + 2] = (float)bz;
      tips[i * 3] = (float)tx; tips[i * 3 + 1] = (float)ty; tips[i * 3 + 2] = (float)tz;
      times[i] = (float)time;
    }

    public void Update(double time)
    {
      int drop = 0;
      while (drop < Count && time - times[drop] > Lifetime) drop++;
      if (drop > 0)
      {
        Array.Copy(bases, drop * 3, bases, 0, (Count - drop) * 3);
        Array.Copy(tips, drop * 3, tips, 0, (Count - drop) * 3);
        Array.Copy(times, drop, times, 0, Count - drop);
        Count -= drop;
      }
      for (int j = 0; j < Count; j++)
      {
        double age = Math.Min(1, (time - times[j]) / Lifetime);
        double f = (1 - age) * (1 - age);
        Array.Copy(bases, j * 3, Positions, j * 6, 3);
        Array.Copy(tips, j * 3, Positions, j * 6 + 3, 3);
        Fade[j * 2] = (float)(f * 0.12);
        Fade[j * 2 + 1] = (float)f;
      }
    }

    static double CatmullRom(double p0, double p1, double p2, double p3, double t)
    {
      double t2 = t * t;
      return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t2 * t);
    }

    // Math.hypot of three values as V8 computes it (scaled by the largest, compensated sum).
    static double Hypot3(double a, double b, double c)
    {
      a = Math.Abs(a); b = Math.Abs(b); c = Math.Abs(c);
      double max = Math.Max(a, Math.Max(b, c));
      if (max == 0) return 0;
      double sum = 0, compensation = 0;
      Accumulate(a / max, ref sum, ref compensation);
      Accumulate(b / max, ref sum, ref compensation);
      Accumulate(c / max, ref sum, ref compensation);
      return Math.Sqrt(sum) * max;
    }

    static void Accumulate(double r, ref double sum, ref double compensation)
    {
      double summand = r * r - compensation;
      double preliminary = sum + summand;
      compensation = (preliminary - sum) - summand;
      sum = preliminary;
    }
  }
}
