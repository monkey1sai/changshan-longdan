using System;
using Changshan.Character;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E04: logic keeps the Web world numbers; only the display negates X (as glTFast does) and places the start at the scene anchor.
  public sealed class LogicDisplayMappingEditTests
  {
    static readonly Vector3 Anchor = new Vector3(0, -1, 4.2f);
    static LogicDisplayMapping Mapping => new LogicDisplayMapping(Anchor, 160, ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);

    static Vector3 Flat(Vector3 v) => new Vector3(v.x, 0, v.z).normalized;

    [Test] public void StartPoseMapsToTheSceneAnchor()
    {
      var m = Mapping;
      Assert.That(Vector3.Distance(m.ToDisplayPosition(ArenaLayout.StartX, 0, ArenaLayout.StartZ), Anchor), Is.LessThan(1e-5f));
      Assert.That(m.ToDisplayYawDegrees(ArenaLayout.StartFacing), Is.EqualTo(160).Within(1e-9));
      Assert.That(Vector3.Distance(m.ToDisplayPosition(ArenaLayout.StartX, 2.5, ArenaLayout.StartZ), Anchor + Vector3.up * 2.5f), Is.LessThan(1e-5f));
    }

    // Moving one metre along the logic facing must move the display one metre along the displayed forward,
    // and the character's left (logic) must stay on its left (display) despite the X mirror.
    [Test] public void FacingAndHandednessSurviveTheMirror()
    {
      var m = Mapping;
      foreach (double facing in new[] { 0, 0.7, Math.PI, -2.1 })
      {
        var start = m.ToDisplayPosition(ArenaLayout.StartX, 0, ArenaLayout.StartZ);
        var ahead = m.ToDisplayPosition(ArenaLayout.StartX + Math.Sin(facing), 0, ArenaLayout.StartZ + Math.Cos(facing));
        var displayForward = m.ToDisplayRotation(facing) * Vector3.forward;
        Assert.That(Vector3.Distance(ahead - start, displayForward), Is.LessThan(1e-5f), $"facing {facing}");

        // Web (three.js, right-handed, y up): the character's left is (cos f, 0, -sin f).
        var left = m.ToDisplayPosition(ArenaLayout.StartX + Math.Cos(facing), 0, ArenaLayout.StartZ - Math.Sin(facing));
        var displayLeft = m.ToDisplayRotation(facing) * Vector3.left;
        Assert.That(Vector3.Distance(left - start, displayLeft), Is.LessThan(1e-5f), $"left at facing {facing}");
      }
    }

    // A camera direction converted to logic yaw and composed with "forward" input moves the player along that direction on screen.
    [Test] public void CameraRelativeInputFollowsTheDisplayedCamera()
    {
      var m = Mapping;
      foreach (float cameraYaw in new[] { 0f, 35f, 160f, -90f })
      {
        var cameraForward = Quaternion.Euler(0, cameraYaw, 0) * Vector3.forward;
        var cameraRight = Quaternion.Euler(0, cameraYaw, 0) * Vector3.right;
        double yaw = m.ToLogicYaw(cameraForward);
        var forward = ControlComposer.Compose(new InputFrame { MoveY = 1 }, yaw);
        var right = ControlComposer.Compose(new InputFrame { MoveX = 1 }, yaw);
        var origin = m.ToDisplayPosition(ArenaLayout.StartX, 0, ArenaLayout.StartZ);
        var f = m.ToDisplayPosition(ArenaLayout.StartX + forward.MoveX, 0, ArenaLayout.StartZ + forward.MoveZ) - origin;
        var r = m.ToDisplayPosition(ArenaLayout.StartX + right.MoveX, 0, ArenaLayout.StartZ + right.MoveZ) - origin;
        Assert.That(Vector3.Distance(Flat(f), cameraForward), Is.LessThan(1e-5f), $"forward at camera yaw {cameraYaw}");
        Assert.That(Vector3.Distance(Flat(r), cameraRight), Is.LessThan(1e-5f), $"right at camera yaw {cameraYaw}");
      }
    }
  }
}
