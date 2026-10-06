using System;
using System.Collections.Generic;

namespace Changshan.Animation
{
  // One glTF node as written in the GLB (bind pose). Matrix, when present, replaces translation/rotation/scale.
  public sealed class GltfNodeData
  {
    public string Name;
    public int[] Children = Array.Empty<int>();
    public double[] Translation = { 0, 0, 0 };
    public double[] Rotation = { 0, 0, 0, 1 };
    public double[] Scale = { 1, 1, 1 };
    public double[] Matrix;
  }

  // Port of ZhaoYunSkin in src/view/zhaoyun-adapter.ts: binds the user's skeleton to the procedural rig and places the
  // bones every frame in the Web world frame. The GLB scene root sits at the world origin, as in the Web scene.
  public sealed class SkinBinding
  {
    public const string WeaponName = "SM_ZhaoYunSpear";
    public const string BodyMeshName = "SM_ZhaoYun";
    public static readonly string[] BoneNames =
    {
      "pelvis", "spine_01", "spine_03", "neck", "head", "upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r",
      "thigh_l", "calf_l", "foot_l", "thigh_r", "calf_r", "foot_r", "cape_01", "cape_02", "skirt_l", "skirt_r",
    };
    public const double UpperArm = .32, LowerArm = .32, UpperLeg = .46, LowerLeg = .42;
    static readonly Vec3 Down = new Vec3(0, -1, 0);
    static readonly Vec3 SourceShaft = new Vec3(-1.416, 1.695, 0.024).Normalized();

    sealed class Binding
    {
      public RigNode Bone, Driver;
      public Quat Correction;
      public Vec3 Scale;
      public bool Translate;
    }

    sealed class HandBinding
    {
      public RigNode Bone, Driver, Fore;
      public Quat Correction;
      public bool Left;
    }

    sealed class FootBinding
    {
      public RigNode Bone, Driver;
      public Quat Correction;
    }

    readonly ProceduralRig rig;
    readonly List<Binding> bindings = new List<Binding>();
    readonly List<HandBinding> hands = new List<HandBinding>();
    readonly List<FootBinding> feet = new List<FootBinding>();
    readonly Dictionary<string, RigNode> bones = new Dictionary<string, RigNode>();

    public RigNode Scene { get; }
    public RigNode Weapon { get; }

    // The bones placed each frame, in placement order.
    public IEnumerable<RigNode> PlacedBones
    {
      get
      {
        foreach (var b in bindings) yield return b.Bone;
        foreach (var h in hands) yield return h.Bone;
        foreach (var f in feet) yield return f.Bone;
      }
    }

    public RigNode Bone(string name) => bones.TryGetValue(name, out var b) ? b : throw new KeyNotFoundException($"SKIN_BONE_MISSING: {name}");

    // Builds the scene the way GLTFLoader does (node TRS or matrix, children order) and attaches it to the rig.
    public static RigNode BuildScene(IReadOnlyList<GltfNodeData> nodes, IReadOnlyList<int> sceneRoots)
    {
      if (nodes == null) throw new ArgumentNullException(nameof(nodes));
      var built = new RigNode[nodes.Count];
      for (int i = 0; i < nodes.Count; i++)
      {
        var n = nodes[i];
        var node = built[i] = new RigNode(n.Name);
        if (n.Matrix != null)
        {
          var m = n.Matrix;
          var mat = new Mat4
          {
            E0 = m[0], E1 = m[1], E2 = m[2], E3 = m[3], E4 = m[4], E5 = m[5], E6 = m[6], E7 = m[7],
            E8 = m[8], E9 = m[9], E10 = m[10], E11 = m[11], E12 = m[12], E13 = m[13], E14 = m[14], E15 = m[15],
          };
          mat.Decompose(out node.Position, out node.Rotation, out node.Scale);
        }
        else
        {
          node.Position = new Vec3(n.Translation[0], n.Translation[1], n.Translation[2]);
          node.Rotation = new Quat(n.Rotation[0], n.Rotation[1], n.Rotation[2], n.Rotation[3]);
          node.Scale = new Vec3(n.Scale[0], n.Scale[1], n.Scale[2]);
        }
      }
      for (int i = 0; i < nodes.Count; i++)
        foreach (int child in nodes[i].Children) built[i].Add(built[child]);
      var scene = new RigNode("scene");
      foreach (int r in sceneRoots) scene.Add(built[r]);
      return scene;
    }

    public SkinBinding(RigNode scene, ProceduralRig rig)
    {
      Scene = scene ?? throw new ArgumentNullException(nameof(scene));
      this.rig = rig ?? throw new ArgumentNullException(nameof(rig));
      foreach (var name in BoneNames)
      {
        var b = scene.Find(name) ?? throw new InvalidOperationException($"SKIN_BONE_MISSING: {name}");
        bones[name] = b;
      }
      if (scene.Find(BodyMeshName) == null) throw new InvalidOperationException("SKIN_BODY_MISSING");
      Weapon = scene.Find(WeaponName) ?? throw new InvalidOperationException("SKIN_WEAPON_MISSING");

      Bind("pelvis", rig.Hips);
      Bind("spine_03", rig.Torso, translate: false);
      Bind("head", rig.Head, translate: false);
      foreach (var (s, upper, fore, thigh, knee, hand, left) in new[]
      {
        ("l", rig.UpperL, rig.ForeL, rig.ThighL, rig.KneeL, rig.HandAnchorL, true),
        ("r", rig.UpperR, rig.ForeR, rig.ThighR, rig.KneeR, rig.HandAnchorR, false),
      })
      {
        Bind($"upperarm_{s}", upper, $"lowerarm_{s}", UpperArm);
        Bind($"lowerarm_{s}", fore, $"hand_{s}", LowerArm);
        Bind($"thigh_{s}", thigh, $"calf_{s}", UpperLeg);
        Bind($"calf_{s}", knee, $"foot_{s}", LowerLeg);
        var h = bones[$"hand_{s}"];
        var correction = Quat.FromUnitVectors(SourceShaft, new Vec3(0, 0, 1)) * h.WorldRotation;
        hands.Add(new HandBinding { Bone = h, Driver = hand, Fore = fore, Correction = correction, Left = left });
        var foot = bones[$"foot_{s}"];
        feet.Add(new FootBinding { Bone = foot, Correction = foot.WorldRotation, Driver = s == "l" ? rig.FootAnchorL : rig.FootAnchorR });
      }
      Bind("cape_01", rig.Cape[0], "cape_02", .60);
      Bind("cape_02", rig.Cape[2]);

      // ZhaoYunAdapter: the GLB scene goes under the model group and the spear mesh under the spear driver.
      rig.Group.Add(scene);
      rig.Spear.Add(Weapon);
    }

    void Bind(string name, RigNode driver, string end = null, double length = 0, bool translate = true)
    {
      var b = bones[name];
      var correction = b.WorldRotation;
      var scale = new Vec3(1, 1, 1);
      if (end != null)
      {
        var delta = bones[end].WorldPosition - b.WorldPosition;
        if (delta.Length() < .001) throw new InvalidOperationException($"SKIN_BONE_LENGTH_INVALID: {name}");
        if (length > 0) scale.Y = length / delta.Length();
        correction = Quat.FromUnitVectors(delta.Normalized(), Down) * correction;
      }
      bindings.Add(new Binding { Bone = b, Driver = driver, Correction = correction, Scale = scale, Translate = translate });
    }

    // support: the pose's left-hand weight; below 1 the left hand blends toward the forearm's free rotation.
    public void Update(double support = 1)
    {
      foreach (var b in bindings)
      {
        var position = b.Translate ? b.Driver.WorldPosition : b.Bone.WorldPosition;
        var rotation = b.Driver.WorldRotation * b.Correction;
        Place(b.Bone, Mat4.Compose(position, rotation, b.Scale));
      }
      foreach (var h in hands)
      {
        var position = h.Driver.WorldPosition;
        var rotation = rig.Spear.WorldRotation * h.Correction;
        if (h.Left && support < 1)
        {
          var free = h.Fore.WorldRotation * h.Correction;
          rotation = rotation.Slerp(free, 1 - support);
        }
        Place(h.Bone, Mat4.Compose(position, rotation, new Vec3(1, 1, 1)));
      }
      foreach (var f in feet)
      {
        var position = f.Driver.WorldPosition;
        var rotation = rig.Hips.WorldRotation * f.Correction;
        Place(f.Bone, Mat4.Compose(position, rotation, new Vec3(1, 1, 1)));
      }
    }

    static void Place(RigNode bone, Mat4 world)
    {
      var local = bone.Parent != null ? bone.Parent.WorldMatrix.Inverse() * world : world;
      local.Decompose(out bone.Position, out bone.Rotation, out bone.Scale);
    }
  }
}
