using System;

namespace Changshan.Combat
{
  public enum HitShapeKind { Arc, Circle, Line }

  // Port of src/combat/hitshape.ts. Offset moves the centre along the attacker's facing (sin, cos).
  public sealed class HitShape
  {
    public HitShapeKind Kind { get; }
    public double Range { get; }
    public double HalfAngle { get; } // radians, arc only
    public double Width { get; } // line only
    public double Offset { get; }

    HitShape(HitShapeKind kind, double range, double halfAngle, double width, double offset)
    {
      Kind = kind;
      Range = range;
      HalfAngle = halfAngle;
      Width = width;
      Offset = offset;
    }

    public static HitShape Arc(double range, double halfDegrees, double offset = 0) =>
      new HitShape(HitShapeKind.Arc, range, halfDegrees * (Math.PI / 180), 0, offset);
    public static HitShape Circle(double range, double offset = 0) => new HitShape(HitShapeKind.Circle, range, 0, 0, offset);
    public static HitShape Line(double range, double width, double offset = 0) => new HitShape(HitShapeKind.Line, range, 0, width, offset);

    // Same shape from stored values (half angle already in radians), as the Web data holds it.
    public static HitShape FromRadians(HitShapeKind kind, double range, double halfAngle, double width, double offset) =>
      new HitShape(kind, range, kind == HitShapeKind.Arc ? halfAngle : 0, kind == HitShapeKind.Line ? width : 0, offset);

    // Whether a target of the given radius overlaps the shape on the ground plane.
    public bool Contains(double ax, double az, double facing, double tx, double tz, double radius)
    {
      double fx = Math.Sin(facing);
      double fz = Math.Cos(facing);
      double dx = tx - (ax + fx * Offset);
      double dz = tz - (az + fz * Offset);
      switch (Kind)
      {
        case HitShapeKind.Circle:
          // V8 evaluates (range + radius) ** 2 as an exact product (fdlibm pow special-cases y == 2).
          return dx * dx + dz * dz <= (Range + radius) * (Range + radius);
        case HitShapeKind.Arc:
        {
          double dist = CombatMath.Hypot(dx, dz);
          if (dist > Range + radius) return false;
          if (dist <= radius) return true;
          double angle = Math.Acos(CombatMath.Clamp((dx * fx + dz * fz) / dist, -1, 1));
          return angle <= HalfAngle + Math.Asin(Math.Min(1, radius / dist));
        }
        default:
        {
          double along = dx * fx + dz * fz;
          if (along < -radius || along > Range + radius) return false;
          return Math.Abs(dx * fz - dz * fx) <= Width / 2 + radius;
        }
      }
    }

    // Farthest distance from the attacker the shape can reach; used for spatial queries.
    public double Reach => Kind == HitShapeKind.Line ? Math.Abs(Offset) + CombatMath.Hypot(Range, Width / 2) : Math.Abs(Offset) + Range;
  }
}
