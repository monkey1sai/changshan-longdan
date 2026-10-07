using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Feedback
{
  // The part of Battle.ts BattleEvent that src/presentation.ts plays and E07 ports. Hit and Kill refer to the
  // simulation's hit and kill buffers of the same frame ([Start, Start + Count)).
  public enum FeedbackEventType { Swing, Jump, Land, Dodge, MusouStart, Fx, Hit, Kill, EnemyStrike, Parry, GuardBlock, Hurt, MusouReady }

  public readonly struct FeedbackEvent
  {
    public readonly FeedbackEventType Type;
    public readonly bool Heavy; // Swing, Land, EnemyStrike, GuardBlock, Hurt
    public readonly HitFx Fx; // Fx
    public readonly HitWindow Window; // Hit
    public readonly int Start, Count; // Hit, Kill
    public readonly double X, Z, Radius, Facing, Damage; // Fx (X, Z, Radius); EnemyStrike, Parry, GuardBlock, Hurt (X, Z, Facing, Damage)

    public FeedbackEvent(FeedbackEventType type, bool heavy = false, HitFx fx = HitFx.None, HitWindow window = null, int start = 0, int count = 0,
      double x = 0, double z = 0, double radius = 0, double facing = 0, double damage = 0)
    {
      if (type == FeedbackEventType.Hit && window == null) throw new ArgumentNullException(nameof(window));
      Type = type;
      Heavy = heavy;
      Fx = fx;
      Window = window;
      Start = start;
      Count = count;
      X = x;
      Z = z;
      Radius = radius;
      Facing = facing;
      Damage = damage;
    }
  }

  // Hit and kill data the events refer to, and the player the presentation reads (Presentation's PresentationSource).
  public interface IFeedbackSource
  {
    IReadOnlyList<HitEvent> Hits { get; }
    IReadOnlyList<KillInfo> Kills { get; }
    double PlayerX { get; }
    double PlayerY { get; }
    double PlayerZ { get; }
    double PlayerFacing { get; }
  }

  // Builds one frame's feedback events from the simulation in Battle.step's order: the player's forwarded events
  // (guard, parry, hurt and death are reported with positions by the simulation instead), the player's hits, kills,
  // then the musou-ready notice. Hits from other sources (the dragon, test blows) are not presented here: the Web
  // presents the dragon's hits differently and the dragon is not ported.
  public static class FeedbackEvents
  {
    public static void FromStep(CombatSimulation sim, List<FeedbackEvent> into)
    {
      if (sim == null) throw new ArgumentNullException(nameof(sim));
      into.Clear();
      if (sim.SteppedThisFrame)
      {
        var player = sim.Player.Events;
        for (int i = 0; i < player.Count; i++)
        {
          var e = player[i];
          switch (e.Type)
          {
            case PlayerEventType.Swing: into.Add(new FeedbackEvent(FeedbackEventType.Swing, heavy: e.Heavy)); break;
            case PlayerEventType.Jump: into.Add(new FeedbackEvent(FeedbackEventType.Jump)); break;
            case PlayerEventType.Land: into.Add(new FeedbackEvent(FeedbackEventType.Land, heavy: e.Heavy)); break;
            case PlayerEventType.Dodge: into.Add(new FeedbackEvent(FeedbackEventType.Dodge)); break;
            case PlayerEventType.MusouStart: into.Add(new FeedbackEvent(FeedbackEventType.MusouStart)); break;
            case PlayerEventType.Fx: into.Add(new FeedbackEvent(FeedbackEventType.Fx, fx: e.Fx, x: e.X, z: e.Z, radius: e.Radius)); break;
          }
        }
      }
      AddCombat(sim, into);
    }

    // The events of an injected strike (outside a step).
    public static void FromStrike(CombatSimulation sim, List<FeedbackEvent> into)
    {
      if (sim == null) throw new ArgumentNullException(nameof(sim));
      into.Clear();
      AddCombat(sim, into);
    }

    static void AddCombat(CombatSimulation sim, List<FeedbackEvent> into)
    {
      var events = sim.Events;
      for (int i = 0; i < events.Count; i++)
      {
        var e = events[i];
        switch (e.Type)
        {
          case CombatEventType.Hit when e.Source == HitSource.Player:
            into.Add(new FeedbackEvent(FeedbackEventType.Hit, window: e.Window, start: e.Start, count: e.Count));
            break;
          case CombatEventType.Kill: into.Add(new FeedbackEvent(FeedbackEventType.Kill, start: e.Start, count: e.Count)); break;
          case CombatEventType.EnemyStrike: into.Add(new FeedbackEvent(FeedbackEventType.EnemyStrike, heavy: e.Heavy, x: e.X, z: e.Z)); break;
          case CombatEventType.Parry: into.Add(new FeedbackEvent(FeedbackEventType.Parry, x: e.X, z: e.Z, facing: e.Facing)); break;
          case CombatEventType.GuardBlock:
            into.Add(new FeedbackEvent(FeedbackEventType.GuardBlock, heavy: e.Heavy, x: e.X, z: e.Z, facing: e.Facing, damage: e.Damage));
            break;
          case CombatEventType.Hurt: into.Add(new FeedbackEvent(FeedbackEventType.Hurt, heavy: e.Heavy, x: e.X, z: e.Z)); break;
          case CombatEventType.MusouReady: into.Add(new FeedbackEvent(FeedbackEventType.MusouReady)); break;
        }
      }
    }
  }

  // A CombatSimulation read as a feedback source.
  public sealed class SimulationSource : IFeedbackSource
  {
    readonly CombatSimulation sim;
    public SimulationSource(CombatSimulation sim) => this.sim = sim ?? throw new ArgumentNullException(nameof(sim));
    public bool Reads(CombatSimulation other) => ReferenceEquals(sim, other);
    public IReadOnlyList<HitEvent> Hits => sim.Hits;
    public IReadOnlyList<KillInfo> Kills => sim.Kills;
    public double PlayerX => sim.Player.X;
    public double PlayerY => sim.Player.Y;
    public double PlayerZ => sim.Player.Z;
    public double PlayerFacing => sim.Player.Facing;
  }
}
