using System;
using System.Collections.Generic;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // Soldiers of the validation scene: each child is a hit target spawned at its authored ground position. E07 shows the
  // target's state every frame: position (knockback, launch, separation), facing, the Web soldier-view's reaction poses
  // (flinch lean, air tumble, lying down, getting up) and the hit flash; a killed dummy is hidden. AI is E08.
  [DisallowMultipleComponent]
  public sealed class TrainingDummies : MonoBehaviour
  {
    public const float DummyHp = 46; // inside the Web soldier range of 40-52 HP
    public const float Height = 1.8f; // the capsule stands 1.8 m tall; its pivot is its centre
    public const float CapsuleRadius = 0.42f; // the Web body radius; the capsule is scaled to it
    static readonly int BaseColor = Shader.PropertyToID("_BaseColor");
    static readonly int Color = Shader.PropertyToID("_Color");

    [SerializeField] List<Transform> dummies = new List<Transform>();
    [SerializeField] bool aiEnabled; // E08: off for the authored validation dummies (a hitting sandbox), on for the pressure crowd
    List<Spawn> spawns; // when set, Fill resets the targets from these Web spawns (soldier kinds, captain health, rng) instead of adding static dummies
    readonly List<Vector3> spawnPositions = new List<Vector3>();
    readonly List<MeshRenderer> renderers = new List<MeshRenderer>();
    readonly List<Color> baseColors = new List<Color>();
    MaterialPropertyBlock block;

    public IReadOnlyList<Transform> Dummies => dummies;
    public bool AiEnabled => aiEnabled;

    public void SetDummies(IEnumerable<Transform> items, IReadOnlyList<Spawn> soldierSpawns = null, bool ai = false)
    {
      dummies.Clear();
      dummies.AddRange(items);
      spawns = soldierSpawns == null ? null : new List<Spawn>(soldierSpawns);
      if (spawns != null && spawns.Count != dummies.Count) throw new ArgumentException("one spawn per dummy", nameof(soldierSpawns));
      aiEnabled = ai;
      spawnPositions.Clear();
      renderers.Clear();
    }

    void Prepare()
    {
      if (spawnPositions.Count == dummies.Count) return;
      spawnPositions.Clear();
      renderers.Clear();
      baseColors.Clear();
      foreach (var dummy in dummies)
      {
        spawnPositions.Add(dummy.position);
        var renderer = dummy.GetComponent<MeshRenderer>();
        renderers.Add(renderer);
        var material = renderer != null ? renderer.sharedMaterial : null;
        baseColors.Add(material != null && material.HasProperty(BaseColor) ? material.GetColor(BaseColor) : material != null && material.HasProperty(Color) ? material.GetColor(Color) : UnityEngine.Color.gray);
      }
      if (block == null) block = new MaterialPropertyBlock();
    }

    // Adds every dummy to empty targets in logic space at its authored spawn (index i is dummies[i]) and shows them all.
    public void Fill(HitTargets targets, LogicDisplayMapping mapping)
    {
      Prepare();
      targets.AiEnabled = aiEnabled;
      for (int i = 0; i < dummies.Count; i++) dummies[i].gameObject.SetActive(true);
      if (spawns != null)
      {
        targets.Reset(spawns);
        return;
      }
      for (int i = 0; i < dummies.Count; i++)
      {
        var (x, z) = mapping.ToLogicPosition(spawnPositions[i]);
        targets.Add(x, 0, z, 1, DummyHp);
      }
    }

    // Poses every dummy from the target state. Angles follow src/view/soldier-view.ts (lean, tumble, lift) in degrees
    // about the dummy's own axes; the mirror between logic and display space is in the mapping.
    public void Show(HitTargets targets, LogicDisplayMapping mapping)
    {
      Prepare();
      for (int i = 0; i < dummies.Count && i < targets.Count; i++)
      {
        var dummy = dummies[i];
        bool alive = targets.Alive(i);
        if (dummy.gameObject.activeSelf != alive) dummy.gameObject.SetActive(alive);
        if (!alive) continue;
        double t = targets.StateTime(i);
        float lean = 0, tumble = 0, lift = 0;
        switch (targets.State(i))
        {
          case EnemyState.Flinch:
          {
            double k = Math.Sin(Math.Min(1, t / 0.42) * Math.PI);
            lean = (float)(-0.45 * k);
            break;
          }
          case EnemyState.Knockback: lean = -0.4f; break;
          case EnemyState.Air: tumble = (float)targets.Spin(i); break;
          case EnemyState.Down:
            tumble = (float)(-Math.PI / 2);
            lift = -0.74f;
            break;
          case EnemyState.Getup:
          {
            double k = CombatMath.Smoothstep(0, 0.5, t);
            tumble = (float)(-Math.PI / 2 * (1 - k));
            lift = (float)(-0.74 * (1 - k));
            break;
          }
        }
        var ground = mapping.ToDisplayPosition(targets.X(i), targets.Y(i), targets.Z(i));
        var facing = mapping.ToDisplayRotation(targets.Yaw(i));
        // Like the Web soldier view, the body turns about its 0.9 m pivot (the capsule centre) and lift lowers it; a
        // lying capsule is kept at its own radius above the ground so it does not sink into the floor.
        var pitch = Quaternion.AngleAxis((lean + tumble) * Mathf.Rad2Deg, Vector3.right);
        float centreHeight = Mathf.Max(Height / 2 + lift, Mathf.Lerp(Height / 2, CapsuleRadius, Mathf.Abs(Mathf.Sin(lean + tumble))));
        dummy.SetPositionAndRotation(ground + facing * new Vector3(0, centreHeight, 0), facing * pitch);
        var renderer = renderers[i];
        if (renderer == null) continue;
        float flash = (float)targets.Flash(i);
        var color = UnityEngine.Color.Lerp(baseColors[i], UnityEngine.Color.white, flash);
        renderer.GetPropertyBlock(block);
        block.SetColor(BaseColor, color);
        block.SetColor(Color, color);
        renderer.SetPropertyBlock(block);
      }
    }
  }
}
