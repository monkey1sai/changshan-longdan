namespace Changshan.Combat
{
  // Port of src/core/math.ts createRng (mulberry32). JavaScript's 32-bit integer steps (>>> 0, Math.imul, ToInt32 of
  // the sum) are all low-32-bit arithmetic, so unchecked uint arithmetic reproduces the same stream bit for bit.
  public sealed class Mulberry32
  {
    uint a;

    public Mulberry32(uint seed) => a = seed;

    // The generator's position in its stream (two generators with equal states produce the same values).
    public uint State => a;

    public double Next()
    {
      unchecked
      {
        a += 0x6d2b79f5u;
        uint t = a;
        t = (t ^ (t >> 15)) * (t | 1);
        t ^= t + (t ^ (t >> 7)) * (t | 61);
        return (t ^ (t >> 14)) / 4294967296.0;
      }
    }

    // math.ts range: min + (max - min) * rng().
    public double Range(double min, double max) => min + (max - min) * Next();
  }
}
