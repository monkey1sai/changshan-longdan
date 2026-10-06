using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Changshan.Combat
{
  // src/world/layout.ts SQUADS and src/entities/enemies.ts squadSpawns, as src/entities/castle-setup.ts combines them:
  // 25 squad centres, 4 x 3 soldiers each (300), one captain in the front-centre of every third squad, odd squads with
  // swords, jitter from a fresh mulberry32(7) each time, so every battle has the same layout.
  public static class CastleLayout
  {
    public const int Capacity = 320;
    public const uint SpawnSeed = 7;

    public readonly struct Centre
    {
      public readonly double X, Z;
      public Centre(double x, double z) { X = x; Z = z; }
    }

    public static readonly IReadOnlyList<Centre> Squads = new ReadOnlyCollection<Centre>(Build());

    static List<Centre> Build()
    {
      var list = new List<Centre>();
      foreach (double z in new double[] { 24, 10, -4, -18})
        foreach (double x in new double[] { -34, -17, 0, 17, 34 }) list.Add(new Centre(x, z));
      list.Add(new Centre(-30, -42));
      list.Add(new Centre(28, -43));
      list.Add(new Centre(-26, 34));
      list.Add(new Centre(26, 34));
      list.Add(new Centre(0, -23.5));
      return list;
    }

    // enemies.ts squadSpawns: x, z and yaw jitter are drawn in that order for every soldier.
    public static List<Spawn> SquadSpawns(IReadOnlyList<Centre> centres, Mulberry32 rng)
    {
      if (centres == null) throw new ArgumentNullException(nameof(centres));
      if (rng == null) throw new ArgumentNullException(nameof(rng));
      var spawns = new List<Spawn>(centres.Count * 12);
      for (int s = 0; s < centres.Count; s++)
      {
        var c = centres[s];
        bool sword = s % 2 == 1;
        for (int row = 0; row < 3; row++)
          for (int col = 0; col < 4; col++)
          {
            bool captain = s % 3 == 0 && row == 2 && col == 1;
            double x = c.X + (col - 1.5) * 1.6 + (rng.Next() - 0.5) * 0.4;
            double z = c.Z + (row - 1) * 1.7 + (rng.Next() - 0.5) * 0.4;
            double yaw = (rng.Next() - 0.5) * 0.3;
            spawns.Add(new Spawn(x, z, yaw, captain ? EnemyKind.Captain : sword ? EnemyKind.Sword : EnemyKind.Spear));
          }
      }
      return spawns;
    }

    public static List<Spawn> Spawns() => SquadSpawns(Squads, new Mulberry32(SpawnSeed));
  }
}
