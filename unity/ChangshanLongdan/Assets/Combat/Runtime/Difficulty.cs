using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Changshan.Combat
{
  // src/core/difficulty.ts: the four profiles differ only in these five numbers.
  public enum DifficultyId { Beginner, Normal, Hard, Chaos }

  public sealed class DifficultyProfile
  {
    public DifficultyId Id { get; }
    public string Name { get; }
    public double EnemyDamage { get; }
    public double Windup { get; } // multiplier on the telegraphed attack duration; normal keeps the original timing
    public double CaptainHp { get; }
    public int MaxAttackers { get; }
    public double EngageRange { get; }

    public DifficultyProfile(DifficultyId id, string name, double enemyDamage, double windup, double captainHp, int maxAttackers, double engageRange)
    {
      Id = id;
      Name = name;
      EnemyDamage = enemyDamage;
      Windup = windup;
      CaptainHp = captainHp;
      MaxAttackers = maxAttackers;
      EngageRange = engageRange;
    }
  }

  public static class Difficulties
  {
    public static readonly DifficultyProfile Beginner = new DifficultyProfile(DifficultyId.Beginner, "初級", 0.65, 1.25, 0.75, 2, 22);
    public static readonly DifficultyProfile Normal = new DifficultyProfile(DifficultyId.Normal, "普通", 1, 1, 1, 4, 26);
    public static readonly DifficultyProfile Hard = new DifficultyProfile(DifficultyId.Hard, "上級", 1.25, 0.9, 1.35, 5, 30);
    public static readonly DifficultyProfile Chaos = new DifficultyProfile(DifficultyId.Chaos, "修羅", 1.55, 0.8, 1.7, 6, 34);
    public static readonly IReadOnlyList<DifficultyProfile> All = new ReadOnlyCollection<DifficultyProfile>(new[] { Beginner, Normal, Hard, Chaos });

    public static DifficultyProfile Get(DifficultyId id) => All[(int)id];
  }

  // src/entities/battle-director.ts: the battle phase by kills; each phase adds engage range and attackers.
  public enum BattlePhase { Opening, Pressure, Surge, Finale }

  public readonly struct BattlePressure
  {
    public readonly BattlePhase Phase;
    public readonly double EngageRange;
    public readonly int MaxAttackers;
    public BattlePressure(BattlePhase phase, double engageRange, int maxAttackers) { Phase = phase; EngageRange = engageRange; MaxAttackers = maxAttackers; }
  }

  public sealed class BattleDirector
  {
    public readonly struct Rule
    {
      public readonly BattlePhase Phase;
      public readonly int MinKo, EngageBonus, AttackerBonus;
      public Rule(BattlePhase phase, int minKo, int engageBonus, int attackerBonus) { Phase = phase; MinKo = minKo; EngageBonus = engageBonus; AttackerBonus = attackerBonus; }
    }

    public static readonly IReadOnlyList<Rule> Phases = new ReadOnlyCollection<Rule>(new[]
    {
      new Rule(BattlePhase.Opening, 0, 0, 0), new Rule(BattlePhase.Pressure, 60, 4, 0), new Rule(BattlePhase.Surge, 150, 8, 1), new Rule(BattlePhase.Finale, 240, 12, 2),
    });

    public BattlePhase Phase { get; private set; } = BattlePhase.Opening;

    public void Reset() => Phase = BattlePhase.Opening;

    public BattlePressure Update(long ko, DifficultyProfile difficulty)
    {
      if (difficulty == null) throw new ArgumentNullException(nameof(difficulty));
      var rule = Phases[0];
      foreach (var candidate in Phases) if (ko >= candidate.MinKo) rule = candidate;
      Phase = rule.Phase;
      return new BattlePressure(rule.Phase, difficulty.EngageRange + rule.EngageBonus, difficulty.MaxAttackers + rule.AttackerBonus);
    }
  }
}
