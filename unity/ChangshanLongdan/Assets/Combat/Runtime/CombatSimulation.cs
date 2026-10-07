using System;
using System.Collections.Generic;

namespace Changshan.Combat
{
  // Battle.step's combat core: the clock decides whether the game steps; when it does, the player updates, the director
  // sets the pressure from the kills so far (updatePressure), the soldiers step their AI and reactions (soldiers.update),
  // the player's active windows hit soldiers once per (window instance, target) and apply their reactions, every window
  // that hit asks for its hit-stop (the clock keeps the longest) and the player gains musou as in
  // Battle.resolvePlayerHits; other sources (the musou dragon later) hit through the afterPlayerHits callback of the
  // same step, like updateDragon after resolvePlayerHits (outside it ApplyExternal is refused); kills are collected
  // (resolveKills) and the soldiers' strikes land on the player (resolveStrike). InjectStrike plays Battle's
  // debug.injectStrike. A gauge that just became full is announced at the end of the step. Combo, victory and defeat
  // are not ported yet.
  public sealed class CombatSimulation
  {
    public const double ParryHitstop = 0.06;
    public const int KoMilestone = 100;

    readonly List<HitEvent> hits = new List<HitEvent>();
    readonly List<KillInfo> kills = new List<KillInfo>();
    readonly List<CombatEvent> events = new List<CombatEvent>();
    readonly AimFunction aim;

    public GameClock Clock { get; }
    public PlayerDriver Driver { get; }
    public Player Player => Driver.Player;
    public HitTargets Targets { get; }
    public HitResolver Resolver { get; }
    public HitStampSource Stamps { get; }
    public Arena Arena { get; }
    public BattleDirector Director { get; } = new BattleDirector();
    public DifficultyProfile Difficulty { get; private set; } = Difficulties.Normal;
    public BattlePhase Phase { get; private set; } = BattlePhase.Opening;
    public IReadOnlyList<HitEvent> Hits => hits; // this frame's hits
    public IReadOnlyList<KillInfo> Kills => kills; // this frame's kills
    public IReadOnlyList<CombatEvent> Events => events; // this frame's events (or the last injected strike's)
    public long TotalHits { get; private set; }
    public long KoCount { get; private set; }
    public double DamageSum { get; private set; } // damage the player took (Battle.damageSum)
    public bool SteppedThisFrame { get; private set; }

    bool externalOpen;
    bool stepping;
    bool musouWasReady;
    int spawnCount;

    public CombatSimulation(HitTargets targets, PlayerTuning tuning = null, Arena arena = null)
    {
      Targets = targets ?? throw new ArgumentNullException(nameof(targets));
      spawnCount = targets.Count;
      Stamps = new HitStampSource();
      Clock = new GameClock();
      Arena = arena ?? ArenaLayout.CreateArena();
      Driver = new PlayerDriver(new Player(tuning, Stamps), Arena, Clock);
      Resolver = new HitResolver(targets);
      // Game.aim: the nearest living soldier within reach.
      aim = (double x, double z, double maxDistance, out double tx, out double tz) =>
      {
        int i = Targets.Nearest(x, z, maxDistance);
        tx = i < 0 ? 0 : Targets.X(i);
        tz = i < 0 ? 0 : Targets.Z(i);
        return i >= 0;
      };
      Targets.SetPressure(Difficulty);
    }

    // Battle.reset(difficulty): takes effect at the next Restart (captain health is set when the soldiers are reset).
    public void SetDifficulty(DifficultyProfile difficulty)
    {
      Difficulty = difficulty ?? throw new ArgumentNullException(nameof(difficulty));
      Targets.SetPressure(Difficulty);
    }

    // One rendered frame (realDt already capped). Returns whether the game stepped. afterPlayerHits runs only when the
    // game stepped, receives the game-time step and is the one place where ApplyExternal is allowed. Not reentrant:
    // stepping or restarting from inside the callback would move hits to another step, so it is refused.
    public bool Step(double realDt, in PlayerControls c, Action<double> afterPlayerHits = null)
    {
      if (stepping) throw new InvalidOperationException("STEP_REENTRANT");
      stepping = true;
      try
      {
        return StepOnce(realDt, c, afterPlayerHits);
      }
      finally
      {
        stepping = false;
      }
    }

    bool StepOnce(double realDt, in PlayerControls c, Action<double> afterPlayerHits)
    {
      hits.Clear();
      kills.Clear();
      events.Clear();
      SteppedThisFrame = Driver.Step(realDt, c, aim);
      if (!SteppedThisFrame) return false;
      // Battle.step: pressure from the kills so far, then soldiers.update, then the player's hits are resolved.
      UpdatePressure();
      Targets.Step(Clock.LastSimDt, Player.X, Player.Y, Player.Z, Arena);
      Resolver.BeginStep();
      var active = Player.ActiveHits;
      for (int k = 0; k < active.Count; k++)
      {
        var h = active[k];
        int start = hits.Count;
        int n = Resolver.Apply(h.Stamp, h.Window, h.X, h.Y, h.Z, h.Facing, HitSource.Player, h.Move, h.WindowIndex, Clock.SimSteps, Clock.SimTime, hits);
        if (n == 0) continue;
        Clock.AddHitstop(h.Window.Hitstop);
        Player.GainMusou(Math.Min(9, n * 1.4));
        events.Add(CombatEvent.Hit(HitSource.Player, h.Window, start, n));
      }
      TotalHits += hits.Count;
      if (afterPlayerHits != null)
      {
        externalOpen = true;
        try
        {
          afterPlayerHits(Clock.LastSimDt);
        }
        finally
        {
          externalOpen = false;
        }
      }
      ResolveKills();
      // Battle.step: the soldiers' strikes of this step land after the player's hits and kills (a soldier killed or
      // staggered this step still lands the blow it started).
      var strikes = Targets.Strikes;
      for (int i = 0; i < strikes.Count; i++) ResolveStrike(strikes[i]);
      // Battle.step: the gauge just became full (no outcome is ported, so the battle is always ongoing).
      bool ready = Player.MusouReady;
      if (ready && !musouWasReady) events.Add(CombatEvent.MusouReady());
      musouWasReady = ready;
      return true;
    }

    // Battle.updatePressure: the director's phase from the kills before this step; a change is an event.
    void UpdatePressure()
    {
      var pressure = Director.Update(KoCount, Difficulty);
      Targets.SetPressure(Difficulty, pressure.EngageRange, pressure.MaxAttackers);
      if (pressure.Phase == Phase) return;
      Phase = pressure.Phase;
      events.Add(CombatEvent.PhaseChanged(Phase));
    }

    // A non-player source inside Step's afterPlayerHits callback. No hit-stop or musou, like the Web dragon.
    public int ApplyExternal(uint stamp, HitWindow window, double ax, double ay, double az, double facing)
    {
      if (!externalOpen) throw new InvalidOperationException("EXTERNAL_HIT_OUTSIDE_STEP");
      int start = hits.Count;
      int n = Resolver.Apply(stamp, window, ax, ay, az, facing, HitSource.External, null, -1, Clock.SimSteps, Clock.SimTime, hits);
      TotalHits += n;
      if (n > 0) events.Add(CombatEvent.Hit(HitSource.External, window, start, n));
      return n;
    }

    // Battle.resolveKills: this step's kills, in hit order.
    void ResolveKills()
    {
      var fresh = Targets.Kills;
      if (fresh.Count == 0) return;
      long before = KoCount;
      int start = kills.Count;
      for (int i = 0; i < fresh.Count; i++) kills.Add(fresh[i]);
      events.Add(CombatEvent.Kill(start, fresh.Count));
      KoCount += fresh.Count;
      Targets.ClearKills();
      if (Targets.AliveCount == 0) return;
      int half = (spawnCount + 1) / 2;
      if (before / KoMilestone < KoCount / KoMilestone)
        events.Add(CombatEvent.Milestone(KoCount / KoMilestone * KoMilestone));
      else if (before < half && KoCount >= half)
        events.Add(CombatEvent.HalfDefeated());
    }

    // Battle.debug.injectStrike / resolveStrike: one enemy attack on the player, resolved now (outside a step).
    public void InjectStrike(EnemyStrike s)
    {
      if (stepping) throw new InvalidOperationException("STEP_REENTRANT");
      events.Clear();
      ResolveStrike(s);
    }

    // Battle.resolveStrike: a parry asks for its own hit-stop; a block or a hit through the guard is reported with the
    // strike's position.
    void ResolveStrike(EnemyStrike s)
    {
      events.Add(CombatEvent.EnemyStrike(s.X, s.Z, s.Heavy));
      var p = Player;
      double hpBefore = p.Hp;
      int eventStart = p.Events.Count;
      bool hurt = p.TakeHit(s.Damage, s.Heavy, s.X, s.Z);
      PlayerEvent? outcome = p.Events.Count > eventStart ? p.Events[eventStart] : (PlayerEvent?)null;
      DamageSum += hpBefore - p.Hp;
      if (p.Hp > 0 && outcome?.Type == PlayerEventType.Parry)
      {
        Clock.AddHitstop(ParryHitstop);
        events.Add(CombatEvent.Parry(s.X, s.Z, p.Facing));
        return;
      }
      if (p.Hp > 0 && outcome?.Type == PlayerEventType.GuardBlock)
      {
        events.Add(CombatEvent.GuardBlock(s.X, s.Z, p.Facing, s.Heavy, outcome.Value.Damage));
        return;
      }
      if (!hurt) return;
      events.Add(CombatEvent.Hurt(s.X, s.Z, s.Heavy));
    }

    public void Interrupt() => Driver.Interrupt();

    // Battle.reset without the soldiers: the caller refills or resets Targets first (their rng stream continues).
    public void Restart()
    {
      if (stepping) throw new InvalidOperationException("STEP_REENTRANT");
      Driver.Restart();
      Resolver.Clear();
      Director.Reset();
      Phase = BattlePhase.Opening;
      Targets.SetPressure(Difficulty);
      Targets.ClearKills();
      hits.Clear();
      kills.Clear();
      events.Clear();
      TotalHits = 0;
      KoCount = 0;
      spawnCount = Targets.Count;
      DamageSum = 0;
      SteppedThisFrame = false;
      musouWasReady = false;
    }
  }
}
