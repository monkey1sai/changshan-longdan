using System;

namespace Changshan.Combat
{
  // Battle.ts BattleEvent, the part E07 ports: what happened in one step (or one injected strike) for presentation.
  // Player-side events (move start, swing, fx, jump, land, dodge, musou start) stay in Player.Events. Phase is the
  // director's battle-phase change; MusouReady is Battle's notice that the gauge just became full (end of a step).
  public enum CombatEventType { Hit, Kill, EnemyStrike, Parry, GuardBlock, Hurt, Phase, MusouReady, Milestone, HalfDefeated }

  public readonly struct CombatEvent
  {
    public readonly CombatEventType Type;
    public readonly HitSource Source; // Hit
    public readonly HitWindow Window; // Hit
    public readonly int Start, Count; // Hit: CombatSimulation.Hits[Start, Start + Count); Kill: Kills[Start, Start + Count)
    public readonly double X, Z, Facing; // EnemyStrike, Parry, GuardBlock, Hurt
    public readonly bool Heavy; // EnemyStrike, GuardBlock, Hurt
    public readonly double Damage; // GuardBlock: damage taken through the guard
    public readonly BattlePhase Phase; // Phase: the battle phase just entered
    public readonly long Ko; // Milestone: the last crossed 100-KO bucket

    CombatEvent(CombatEventType type, HitSource source = HitSource.Player, HitWindow window = null, int start = 0, int count = 0,
      double x = 0, double z = 0, double facing = 0, bool heavy = false, double damage = 0, BattlePhase phase = BattlePhase.Opening, long ko = 0)
    {
      Type = type;
      Source = source;
      Window = window;
      Start = start;
      Count = count;
      X = x;
      Z = z;
      Facing = facing;
      Heavy = heavy;
      Damage = damage;
      Phase = phase;
      Ko = ko;
    }

    public static CombatEvent PhaseChanged(BattlePhase phase) => new CombatEvent(CombatEventType.Phase, phase: phase);
    public static CombatEvent Milestone(long ko) => new CombatEvent(CombatEventType.Milestone, ko: ko);
    public static CombatEvent HalfDefeated() => new CombatEvent(CombatEventType.HalfDefeated);

    public static CombatEvent Hit(HitSource source, HitWindow window, int start, int count) =>
      new CombatEvent(CombatEventType.Hit, source, window ?? throw new ArgumentNullException(nameof(window)), start, count);
    public static CombatEvent Kill(int start, int count) => new CombatEvent(CombatEventType.Kill, start: start, count: count);
    public static CombatEvent EnemyStrike(double x, double z, bool heavy) => new CombatEvent(CombatEventType.EnemyStrike, x: x, z: z, heavy: heavy);
    public static CombatEvent Parry(double x, double z, double facing) => new CombatEvent(CombatEventType.Parry, x: x, z: z, facing: facing);
    public static CombatEvent GuardBlock(double x, double z, double facing, bool heavy, double damage) =>
      new CombatEvent(CombatEventType.GuardBlock, x: x, z: z, facing: facing, heavy: heavy, damage: damage);
    public static CombatEvent Hurt(double x, double z, bool heavy) => new CombatEvent(CombatEventType.Hurt, x: x, z: z, heavy: heavy);
    public static CombatEvent MusouReady() => new CombatEvent(CombatEventType.MusouReady);
  }
}
