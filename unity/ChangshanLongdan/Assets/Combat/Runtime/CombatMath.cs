using System;

namespace Changshan.Combat
{
  // Port of src/core/math.ts. Same operation order as the Web source so results stay within rounding of the reference.
  public static class CombatMath
  {
    public const double Tau = Math.PI * 2;

    public static double Clamp(double value, double min, double max) => value < min ? min : value > max ? max : value;

    public static double Lerp(double a, double b, double t) => a + (b - a) * t;

    public static double Smoothstep(double edge0, double edge1, double x)
    {
      double t = Clamp((x - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    }

    // Frame-rate independent exponential approach.
    public static double Damp(double current, double target, double lambda, double dt) => Lerp(current, target, 1 - Math.Exp(-lambda * dt));

    // Wraps to [-PI, PI); C# and JavaScript % both keep the dividend's sign.
    public static double WrapAngle(double angle)
    {
      double a = (angle + Math.PI) % Tau;
      if (a < 0) a += Tau;
      return a - Math.PI;
    }

    public static double DampAngle(double current, double target, double lambda, double dt) =>
      current + WrapAngle(target - current) * (1 - Math.Exp(-lambda * dt));

    // Samples [time, value] keys with smoothstep between neighbours.
    public static double SampleKeys(double[,] keys, double t)
    {
      int count = keys.GetLength(0);
      if (t <= keys[0, 0]) return keys[0, 1];
      for (int i = 1; i < count; i++)
      {
        double t1 = keys[i, 0];
        if (t <= t1)
        {
          double t0 = keys[i - 1, 0];
          double u = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
          return Lerp(keys[i - 1, 1], keys[i, 1], u * u * (3 - 2 * u));
        }
      }
      return keys[count - 1, 1];
    }

    // Two-argument Math.hypot as V8 computes it (scaled Kahan sum), so normalisation matches the Web bit for bit.
    public static double Hypot(double x, double y)
    {
      double ax = Math.Abs(x), ay = Math.Abs(y);
      if (double.IsInfinity(ax) || double.IsInfinity(ay)) return double.PositiveInfinity;
      if (double.IsNaN(ax) || double.IsNaN(ay)) return double.NaN;
      double max = Math.Max(ax, ay);
      if (max == 0) return 0;
      double sum = 0, compensation = 0;
      Accumulate(ax / max, ref sum, ref compensation);
      Accumulate(ay / max, ref sum, ref compensation);
      return Math.Sqrt(sum) * max;
    }

    static void Accumulate(double n, ref double sum, ref double compensation)
    {
      double summand = n * n - compensation;
      double preliminary = sum + summand;
      compensation = preliminary - sum - summand;
      sum = preliminary;
    }
  }
}
