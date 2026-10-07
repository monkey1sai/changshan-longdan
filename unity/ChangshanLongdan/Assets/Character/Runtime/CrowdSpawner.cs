using System.Collections.Generic;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // E08 pressure crowd: one capsule per Web spawn (CastleLayout: 300 soldiers in 25 squads), captains larger and
  // tinted, posed every frame by TrainingDummies.Show from the AI-driven HitTargets. Voxel soldiers and the castle are
  // later steps; this is the crowd's logic made visible.
  public static class CrowdSpawner
  {
    static readonly int BaseColor = Shader.PropertyToID("_BaseColor");
    static readonly int Color = Shader.PropertyToID("_Color");

    public static TrainingDummies Create(string name, IReadOnlyList<Spawn> spawns, LogicDisplayMapping mapping, Material soldierMaterial)
    {
      var root = new GameObject(name);
      var capsuleMesh = Resources.GetBuiltinResource<Mesh>("New-Capsule.fbx");
      var items = new List<Transform>(spawns.Count);
      var captainMaterial = soldierMaterial == null ? null : new Material(soldierMaterial) { name = soldierMaterial.name + " Captain" };
      var swordMaterial = soldierMaterial == null ? null : new Material(soldierMaterial) { name = soldierMaterial.name + " Sword" };
      Tint(captainMaterial, new Color(0.62f, 0.30f, 0.22f));
      Tint(swordMaterial, new Color(0.40f, 0.36f, 0.50f));
      for (int i = 0; i < spawns.Count; i++)
      {
        var s = spawns[i];
        // The built-in capsule mesh without a collider (no physics module in this assembly).
        var capsule = new GameObject($"Soldier {i:000}");
        capsule.AddComponent<MeshFilter>().sharedMesh = capsuleMesh;
        var renderer = capsule.AddComponent<MeshRenderer>();
        capsule.transform.SetParent(root.transform, false);
        float scale = s.Kind == EnemyKind.Captain ? 1.22f : 1f;
        capsule.transform.localScale = new Vector3(0.84f * scale, 0.9f * scale, 0.84f * scale);
        capsule.transform.SetPositionAndRotation(mapping.ToDisplayPosition(s.X, 0, s.Z) + Vector3.up * (0.9f * scale), mapping.ToDisplayRotation(s.Yaw));
        var material = s.Kind == EnemyKind.Captain ? captainMaterial : s.Kind == EnemyKind.Sword ? swordMaterial : soldierMaterial;
        if (material != null) renderer.sharedMaterial = material;
        items.Add(capsule.transform);
      }
      var dummies = root.AddComponent<TrainingDummies>();
      dummies.SetDummies(items, spawns, ai: true);
      return dummies;
    }

    static void Tint(Material material, Color color)
    {
      if (material == null) return;
      if (material.HasProperty(BaseColor)) material.SetColor(BaseColor, color);
      if (material.HasProperty(Color)) material.SetColor(Color, color);
    }
  }
}
