using System;
using Changshan.Combat;

namespace Changshan.View
{
  // Port of src/view/camera-clearance.ts: how much of the focus-to-camera boom survives the walls, the keep, the
  // barracks eaves and the arena edge, and the push that keeps the camera out from under an eave.
  public static class CameraClearance
  {
    public const int DefaultSamples = 16;
    public const double DefaultMargin = 0.35;

    // The largest fraction of the boom that stays clear, sampled at fixed steps from the focus outward.
    public static double Clearance(double fx, double fz, double cx, double cz, int samples = DefaultSamples, double margin = DefaultMargin)
    {
      double edge = CastleGeometry.PlayLimit - margin;
      var blockers = CastleGeometry.CameraBlockers;
      for (int i = 1; i <= samples; i++)
      {
        double t = (double)i / samples;
        double x = fx + (cx - fx) * t;
        double z = fz + (cz - fz) * t;
        bool blocked = Math.Abs(x) > edge || Math.Abs(z) > edge;
        if (!blocked)
          for (int k = 0; k < blockers.Count && !blocked; k++)
            if (CastleGeometry.Inside(blockers[k], x, z, margin)) blocked = true;
        if (blocked) return (double)(i - 1) / samples;
      }
      return 1;
    }

    // The focus may stand under an eave; the camera is pushed out of the nearest eave edge (plus the margin).
    public static void ClearOverhang(ref double x, ref double z, double margin = DefaultMargin)
    {
      foreach (var r in CastleGeometry.Roofs)
      {
        if (!CastleGeometry.Inside(r, x, z, margin)) continue;
        double left = x - r.MinX + margin;
        double right = r.MaxX + margin - x;
        double front = z - r.MinZ + margin;
        double back = r.MaxZ + margin - z;
        double nearest = Math.Min(Math.Min(left, right), Math.Min(front, back));
        if (nearest == left) x = r.MinX - margin;
        else if (nearest == right) x = r.MaxX + margin;
        else if (nearest == front) z = r.MinZ - margin;
        else z = r.MaxZ + margin;
      }
    }
  }

  // Port of src/view/roof-cutaway.ts: a roof opens when the player comes under its eave (0.6 m in) and closes again
  // only once the player is 1 m out, so the edge does not flicker; the title screen shows every roof.
  public static class RoofCutaway
  {
    public static void Update(bool[] visible, double x, double z, bool title)
    {
      if (visible == null) throw new ArgumentNullException(nameof(visible));
      var barracks = CastleGeometry.Barracks;
      if (visible.Length != barracks.Count) throw new ArgumentException("one flag per roof", nameof(visible));
      for (int i = 0; i < visible.Length; i++)
      {
        var rect = barracks[i];
        double margin = CastleGeometry.BarracksRoofOverhang + (visible[i] ? CastleGeometry.RoofCutawayEnter : CastleGeometry.RoofCutawayExit);
        bool near = x >= rect.MinX - margin && x <= rect.MaxX + margin && z >= rect.MinZ - margin && z <= rect.MaxZ + margin;
        visible[i] = title || !near;
      }
    }
  }
}
