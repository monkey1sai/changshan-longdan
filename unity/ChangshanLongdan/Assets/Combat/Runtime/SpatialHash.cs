using System;
using System.Collections.Generic;

namespace Changshan.Combat
{
  // Port of src/core/spatial-hash.ts: a uniform grid on the ground plane. Query order is the Web's (cells by cx then
  // cz, ids in insertion order inside a cell), which is the order hits are applied and the rng is consumed in.
  public sealed class SpatialHash
  {
    readonly Dictionary<long, List<int>> cells = new Dictionary<long, List<int>>();
    readonly Stack<List<int>> pool = new Stack<List<int>>();

    public double CellSize { get; }

    public SpatialHash(double cellSize)
    {
      if (!(cellSize > 0)) throw new ArgumentOutOfRangeException(nameof(cellSize));
      CellSize = cellSize;
    }

    public void Clear()
    {
      foreach (var list in cells.Values)
      {
        list.Clear();
        pool.Push(list);
      }
      cells.Clear();
    }

    public void Insert(int id, double x, double z)
    {
      long key = CellKey((long)Math.Floor(x / CellSize), (long)Math.Floor(z / CellSize));
      if (!cells.TryGetValue(key, out var list))
      {
        list = pool.Count > 0 ? pool.Pop() : new List<int>();
        cells.Add(key, list);
      }
      list.Add(id);
    }

    // Ids in cells that may intersect the radius; exact distance is the caller's job.
    public List<int> Query(double x, double z, double r, List<int> output)
    {
      output.Clear();
      long x0 = (long)Math.Floor((x - r) / CellSize), x1 = (long)Math.Floor((x + r) / CellSize);
      long z0 = (long)Math.Floor((z - r) / CellSize), z1 = (long)Math.Floor((z + r) / CellSize);
      for (long cx = x0; cx <= x1; cx++)
        for (long cz = z0; cz <= z1; cz++)
          if (cells.TryGetValue(CellKey(cx, cz), out var list)) output.AddRange(list);
      return output;
    }

    static long CellKey(long cx, long cz) => (cx + 32768) * 65536 + (cz + 32768);
  }
}
