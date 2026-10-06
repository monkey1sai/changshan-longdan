using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Animation
{
  // A minimal three.js Object3D: local position, rotation and scale under an optional parent. In three 0.186 every
  // world query (getWorldPosition, localToWorld, worldToLocal, getWorldQuaternion) first refreshes the matrices of the
  // node and its ancestors, so computing the world matrix on demand gives the same numbers.
  public sealed class RigNode
  {
    readonly List<RigNode> children = new List<RigNode>();

    public string Name { get; }
    public RigNode Parent { get; private set; }
    public IReadOnlyList<RigNode> Children => children;
    public Vec3 Position;
    public Quat Rotation = Quat.Identity;
    public Vec3 Scale = new Vec3(1, 1, 1);

    public RigNode(string name = null) => Name = name;

    public RigNode Add(params RigNode[] nodes)
    {
      foreach (var node in nodes)
      {
        if (node == null) throw new ArgumentNullException(nameof(nodes));
        node.Parent?.children.Remove(node);
        node.Parent = this;
        children.Add(node);
      }
      return this;
    }

    public void Remove(RigNode node)
    {
      if (node == null || node.Parent != this) return;
      children.Remove(node);
      node.Parent = null;
    }

    // Object3D.rotation.set(x, y, z[, order]) updates the quaternion through Quaternion.setFromEuler.
    public void SetEuler(double x, double y, double z, bool yxz = false) => Rotation = Quat.FromEuler(x, y, z, yxz);

    public Mat4 LocalMatrix => Mat4.Compose(Position, Rotation, Scale);

    public Mat4 WorldMatrix
    {
      get
      {
        var local = LocalMatrix;
        return Parent == null ? local : Parent.WorldMatrix * local;
      }
    }

    public Vec3 LocalToWorld(Vec3 v) => v.ApplyMatrix(WorldMatrix);
    public Vec3 WorldToLocal(Vec3 v) => v.ApplyMatrix(WorldMatrix.Inverse());
    public Vec3 WorldPosition => WorldMatrix.Position;

    public Quat WorldRotation
    {
      get
      {
        WorldMatrix.Decompose(out _, out var rotation, out _);
        return rotation;
      }
    }

    public RigNode Find(string name)
    {
      if (Name == name) return this;
      foreach (var child in children)
      {
        var found = child.Find(name);
        if (found != null) return found;
      }
      return null;
    }
  }

  // src/core/ik.ts and src/view/weapon-grip.ts.
  public static class GripIk
  {
    // Two-bone IK: elbow and end positions for a root, a target and a pole the elbow prefers.
    public static void SolveTwoBone(Vec3 root, Vec3 target, Vec3 pole, double upper, double lower, out Vec3 elbow, out Vec3 end)
    {
      var dir = target - root;
      double dist = Math.Min(Math.Max(dir.Length(), 1e-4), upper + lower - 1e-4);
      dir = dir.Normalized();
      double cosA = (upper * upper + dist * dist - lower * lower) / (2 * upper * dist);
      double a = Math.Acos(Math.Min(1, Math.Max(-1, cosA)));
      var bend = pole - root;
      bend = bend.AddScaled(dir, -bend.Dot(dir));
      if (bend.LengthSq() < 1e-8)
      {
        bend = new Vec3(0, -1, 0);
        bend = bend.AddScaled(dir, -bend.Dot(dir));
        if (bend.LengthSq() < 1e-8) bend = new Vec3(1, 0, 0);
      }
      bend = bend.Normalized();
      elbow = root.AddScaled(dir, upper * Math.Cos(a)).AddScaled(bend, upper * Math.Sin(a));
      end = root.AddScaled(dir, dist);
    }

    // Keeps the right hand within reach and slides the left hand along the shaft (visual only; combat is unchanged).
    public static void FitWeaponGrip(ref Vec3 right, out Vec3 left, Vec3 axis, Vec3 shoulderR, Vec3 shoulderL, double reach, bool twoHands)
    {
      left = default;
      Vec3 offset = default;
      for (int i = 0; i < (twoHands ? 12 : 1); i++)
      {
        offset = right - shoulderR;
        double distance = offset.Length();
        if (distance > reach) right = shoulderR.AddScaled(offset, reach / distance);
        offset = shoulderL - right;
        double along = CombatMath.Clamp(offset.Dot(axis), .18, 1.1);
        left = right.AddScaled(axis, along);
        if (!twoHands) break;
        offset = left - shoulderL;
        double leftDistance = offset.Length();
        if (leftDistance <= reach) break;
        var correction = shoulderL.AddScaled(offset, reach / leftDistance) - left;
        right = right + correction;
      }
      offset = shoulderL - right;
      double final = CombatMath.Clamp(offset.Dot(axis), .18, 1.1);
      left = right.AddScaled(axis, final);
    }
  }
}
