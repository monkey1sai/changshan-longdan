using System;
using UnityEngine;

namespace Changshan.Character
{
  // Maps the Web world used by Changshan.Combat (right-handed, metres, facing 0 = +Z) to Unity display space.
  // Like glTFast's import, X is negated, so a move to the character's left stays on its left. The logic start
  // point is placed at the scene anchor with the anchor's yaw, so the E03 validation pose is unchanged.
  public readonly struct LogicDisplayMapping
  {
    public readonly Vector3 Anchor;
    public readonly double StartX, StartZ;
    public readonly double BaseYawDegrees; // display yaw of logic facing 0

    public LogicDisplayMapping(Vector3 anchor, double anchorYawDegrees, double startX, double startZ, double startFacing)
    {
      Anchor = anchor;
      StartX = startX;
      StartZ = startZ;
      BaseYawDegrees = anchorYawDegrees + startFacing * (180 / Math.PI);
    }

    public Vector3 ToDisplayPosition(double x, double y, double z)
    {
      double dx = -(x - StartX), dz = z - StartZ;
      double a = BaseYawDegrees * (Math.PI / 180);
      double sin = Math.Sin(a), cos = Math.Cos(a);
      // Unity yaw rotation: (x, z) -> (x cos + z sin, -x sin + z cos).
      return Anchor + new Vector3((float)(dx * cos + dz * sin), (float)y, (float)(-dx * sin + dz * cos));
    }

    // Inverse of ToDisplayPosition on the ground plane: the logic (x, z) shown at a display position.
    public (double X, double Z) ToLogicPosition(Vector3 display)
    {
      double dx = display.x - Anchor.x, dz = display.z - Anchor.z;
      double a = BaseYawDegrees * (Math.PI / 180);
      double sin = Math.Sin(a), cos = Math.Cos(a);
      double ux = dx * cos - dz * sin, uz = dx * sin + dz * cos;
      return (StartX - ux, StartZ + uz);
    }

    public double ToDisplayYawDegrees(double facing) => BaseYawDegrees - facing * (180 / Math.PI);

    public Quaternion ToDisplayRotation(double facing) => Quaternion.Euler(0, (float)ToDisplayYawDegrees(facing), 0);

    // Logic yaw of a horizontal display direction, e.g. a camera's forward vector.
    public double ToLogicYaw(Vector3 displayDirection) =>
      BaseYawDegrees * (Math.PI / 180) - Math.Atan2(displayDirection.x, displayDirection.z);
  }
}
