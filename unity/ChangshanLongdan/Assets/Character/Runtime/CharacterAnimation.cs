using System;
using System.Collections.Generic;
using Changshan.Animation;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // Shows the Web procedural rig on the imported Zhao Yun. The rig and skin binding run in the Web (logic) frame; the
  // imported model is glTFast's mirror of the GLB (X negated), so each placed bone's local transform is mirrored back
  // (position x negated, rotation y and z negated) and the model container is pinned to the display frame of the logic
  // origin. Bones not driven by the Web (spine_01, neck, skirts) keep their imported pose, as in the Web. FootPlant
  // locks planted feet on top of the Web rig (an intentional difference, see FootPlant).
  public sealed class CharacterAnimation
  {
    readonly Dictionary<RigNode, Transform> placed = new Dictionary<RigNode, Transform>();
    readonly List<(RigNode Node, Transform Transform)> parentsFirst = new List<(RigNode, Transform)>();
    Transform container, weapon;

    public ProceduralRig Rig { get; } = new ProceduralRig();
    public FootPlant FootPlant { get; } = new FootPlant();
    public SkinBinding Skin { get; private set; }
    public GameObject BoundModel { get; private set; }

    // Mirror between the logic frame and glTFast's import frame (an involution).
    public static Vector3 Mirror(Vec3 v) => new Vector3(-(float)v.X, (float)v.Y, (float)v.Z);
    public static Quaternion Mirror(Quat q) => new Quaternion((float)q.X, -(float)q.Y, -(float)q.Z, (float)q.W);
    public static Vec3 Unmirror(Vector3 v) => new Vec3(-v.x, v.y, v.z);
    public static Quat Unmirror(Quaternion q) => new Quat(q.x, -q.y, -q.z, q.w);

    // Binds to an imported model (its container from ZhaoYunCharacter). The bind pose is read from the import itself,
    // so the binding always matches the instance on screen.
    public void Bind(GameObject model)
    {
      if (model == null) throw new ArgumentNullException(nameof(model));
      Unbind();
      container = model.transform;
      var map = new Dictionary<RigNode, Transform>();
      var scene = new RigNode("scene");
      foreach (Transform child in container) scene.Add(Build(child, map));
      // Corrections come from the bind pose before the scene joins the rig, so the current pose does not matter.
      var skin = new SkinBinding(scene, Rig);
      Skin = skin;
      foreach (var bone in skin.PlacedBones)
      {
        placed[bone] = map[bone];
        parentsFirst.Add((bone, map[bone]));
      }
      parentsFirst.Sort((a, b) => Depth(a.Node).CompareTo(Depth(b.Node)));
      weapon = map[skin.Weapon];
      foreach (var renderer in model.GetComponentsInChildren<SkinnedMeshRenderer>(true)) renderer.updateWhenOffscreen = true;
      BoundModel = model;
    }

    static int Depth(RigNode node)
    {
      int depth = 0;
      for (var n = node.Parent; n != null; n = n.Parent) depth++;
      return depth;
    }

    static RigNode Build(Transform t, Dictionary<RigNode, Transform> map)
    {
      var node = new RigNode(t.name) { Position = Unmirror(t.localPosition), Rotation = Unmirror(t.localRotation) };
      var s = t.localScale;
      node.Scale = new Vec3(s.x, s.y, s.z);
      map[node] = t;
      foreach (Transform child in t) node.Add(Build(child, map));
      return node;
    }

    public void Unbind()
    {
      if (Skin != null)
      {
        Rig.Group.Remove(Skin.Scene);
        Rig.Spear.Remove(Skin.Weapon);
      }
      Skin = null;
      BoundModel = null;
      placed.Clear();
      parentsFirst.Clear();
      container = weapon = null;
    }

    public void Reset()
    {
      Rig.ResetCape();
      FootPlant.Reset();
    }

    // simDt is the game-time step (0 during hit-stop) and simTime the game clock, as Game.updateVisuals passes them.
    public void Step(Player player, double simDt, double simTime, LogicDisplayMapping mapping)
    {
      Rig.Update(player, simDt, simTime);
      FootPlant.Apply(Rig, player, simDt); // E06 foot plant on top of the Web rig
      if (Skin == null || container == null) return;
      Skin.Update(Rig.Pose.Lh);
      container.SetPositionAndRotation(mapping.ToDisplayPosition(0, 0, 0), Quaternion.Euler(0, (float)mapping.BaseYawDegrees, 0));
      // Placed bones get their local scale (bone-length scale, inherited by unplaced children), then their world pose,
      // parents first. A local pose alone is not enough: under a non-uniformly scaled parent the rig's local rotation is
      // decomposed from a sheared matrix, so it is not a unit quaternion (up to 14 % off); three.js composes it as is,
      // Unity normalizes it, and the child joints drift (hands up to 28 cm). The world pose puts every joint where the
      // rig does; only the shear the Web mesh shows on the length-scaled limbs is not reproduced.
      foreach (var (node, t) in parentsFirst)
      {
        t.localScale = new Vector3((float)node.Scale.X, (float)node.Scale.Y, (float)node.Scale.Z);
        t.SetPositionAndRotation(container.TransformPoint(Mirror(node.WorldPosition)), container.rotation * Mirror(node.WorldRotation));
      }
      // The spear mesh follows the spear driver; place it in the container frame like any other node.
      Skin.Weapon.WorldMatrix.Decompose(out var p, out var q, out _);
      weapon.SetPositionAndRotation(container.TransformPoint(Mirror(p)), container.rotation * Mirror(q));
    }

    // Logic-frame world position of a skin node, shown in display space (for checks against the Unity transforms).
    public Vector3 DisplayPosition(RigNode node) => container.TransformPoint(Mirror(node.WorldPosition));
    public Transform TransformOf(RigNode node) => node == Skin?.Weapon ? weapon : placed.TryGetValue(node, out var t) ? t : null;
  }
}
