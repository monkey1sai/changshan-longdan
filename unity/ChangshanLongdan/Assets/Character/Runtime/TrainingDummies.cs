using System.Collections.Generic;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // Static soldiers for E05: each child becomes a hit target at its ground position. They do not move or react yet
  // (reactions are E07, AI is E08); a killed dummy is hidden so the result is visible.
  [DisallowMultipleComponent]
  public sealed class TrainingDummies : MonoBehaviour
  {
    public const float DummyHp = 46; // inside the Web soldier range of 40-52 HP

    [SerializeField] List<Transform> dummies = new List<Transform>();

    public IReadOnlyList<Transform> Dummies => dummies;

    public void SetDummies(IEnumerable<Transform> items)
    {
      dummies.Clear();
      dummies.AddRange(items);
    }

    // Adds every dummy to empty targets in logic space (index i is dummies[i]) and shows them all again.
    public void Fill(HitTargets targets, LogicDisplayMapping mapping)
    {
      foreach (var dummy in dummies)
      {
        dummy.gameObject.SetActive(true);
        var (x, z) = mapping.ToLogicPosition(dummy.position);
        targets.Add(x, 0, z, 1, DummyHp);
      }
    }

    public void Show(HitTargets targets)
    {
      for (int i = 0; i < dummies.Count && i < targets.Count; i++)
        if (dummies[i].gameObject.activeSelf != targets.Alive(i)) dummies[i].gameObject.SetActive(targets.Alive(i));
    }
  }
}
