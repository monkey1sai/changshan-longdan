using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.View
{
  // The rendering side of src/world/layout.ts: the rectangles the camera, the roof cutaway and the placeholder castle
  // share with the collision arena (ArenaLayout keeps the collision set). Metres, y up, south gate at +Z.
  public static class CastleGeometry
  {
    public const double Inner = ArenaLayout.Inner, WallThick = 6, WallHeight = 9, PlayLimit = ArenaLayout.PlayLimit, GateHalf = 6;
    public const double KeepHeight = 2.6;

    public const double BarracksRoofPadding = 1.6, RoofTrimPadding = 0.5, RoofCornerOffset = 0.15, RoofCornerSize = 0.55;
    public static readonly double BarracksRoofOverhang = BarracksRoofPadding / 2 + Math.Max(RoofTrimPadding / 2, RoofCornerOffset + RoofCornerSize / 2);
    public const double RoofCutawayEnter = 0.6, RoofCutawayExit = 1;

    public static Rect Keep => ArenaLayout.Keep;
    public static Rect Stairs => ArenaLayout.Stairs;

    public static readonly IReadOnlyList<Rect> Barracks = new[]
    {
      new Rect(40, 53, -28, -13), new Rect(40, 53, -6, 7), new Rect(40, 53, 14, 28),
      new Rect(-53, -40, -28, -13), new Rect(-53, -40, -6, 7), new Rect(-53, -40, 14, 28),
    };

    // Each barracks rectangle grown by the eave overhang (layout.ts ROOFS in camera-clearance.ts).
    public static readonly IReadOnlyList<Rect> Roofs = Grow(Barracks, BarracksRoofOverhang);

    public static readonly IReadOnlyList<(double X, double Z)> Braziers = new (double, double)[]
    {
      (-8, 40), (8, 40), (-8, 26), (8, 26), (-8, 12), (8, 12), (-8, -2), (8, -2), (-8, -16), (8, -16),
      (-11, -28.5), (11, -28.5), (-38, 10.5), (38, 10.5), (-38, -9.5), (38, -9.5),
    };

    // BIG_FIRES: burning roofs (y >= 1) and ground wrecks (y < 1, which also block).
    public static readonly IReadOnlyList<(double X, double Y, double Z, double Scale)> BigFires = new (double, double, double, double)[]
    {
      (46.5, 7.4, 21, 3.2), (-46.5, 7.4, -20.5, 3), (-30, 0.4, 44, 2.4), (36, 0.4, -47, 2.2),
    };

    public static readonly IReadOnlyList<Rect> Wrecks = BuildWrecks();

    static IReadOnlyList<Rect> BuildWrecks()
    {
      var list = new List<Rect>();
      foreach (var f in BigFires) if (f.Y < 1) list.Add(new Rect(f.X - 2.2, f.X + 2.2, f.Z - 2.2, f.Z + 2.2));
      return list;
    }

    static IReadOnlyList<Rect> Grow(IReadOnlyList<Rect> rects, double margin)
    {
      var list = new Rect[rects.Count];
      for (int i = 0; i < rects.Count; i++) list[i] = new Rect(rects[i].MinX - margin, rects[i].MaxX + margin, rects[i].MinZ - margin, rects[i].MaxZ + margin);
      return list;
    }

    public static bool Inside(in Rect rect, double x, double z, double margin) =>
      x >= rect.MinX - margin && x <= rect.MaxX + margin && z >= rect.MinZ - margin && z <= rect.MaxZ + margin;

    static bool SameRect(in Rect a, in Rect b) => a.MinX == b.MinX && a.MaxX == b.MaxX && a.MinZ == b.MinZ && a.MaxZ == b.MaxZ;

    // camera-clearance.ts BLOCKERS: every collision obstacle except the barracks bodies, plus the eave rectangles.
    public static readonly IReadOnlyList<Rect> CameraBlockers = BuildBlockers();

    static IReadOnlyList<Rect> BuildBlockers()
    {
      var list = new List<Rect>();
      foreach (var o in ArenaLayout.Obstacles())
      {
        bool barracks = false;
        foreach (var b in Barracks) if (SameRect(o, b)) barracks = true;
        if (!barracks) list.Add(o);
      }
      list.AddRange(Roofs);
      return list;
    }
  }
}
