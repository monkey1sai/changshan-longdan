using System;
using System.Collections.Generic;

namespace Changshan.Combat
{
  // Game.simulate's combat core: the clock decides whether the game steps; when it does, the player updates, its active
  // windows hit targets once per (window instance, target), every window that hit asks for its hit-stop (the clock keeps
  // the longest) and the player gains musou as in Game.onHits. Other sources (the musou dragon later) hit through the
  // afterPlayerHits callback of the same step, like updateDragon after resolvePlayerHits; outside it ApplyExternal is refused.
  public sealed class CombatSimulation
  {
    readonly List<HitEvent> hits = new List<HitEvent>();
    readonly AimFunction aim;

    public GameClock Clock { get; }
    public PlayerDriver Driver { get; }
    public Player Player => Driver.Player;
    public HitTargets Targets { get; }
    public HitResolver Resolver { get; }
    public HitStampSource Stamps { get; }
    public IReadOnlyList<HitEvent> Hits => hits; // this frame's hits
    public long TotalHits { get; private set; }
    public bool SteppedThisFrame { get; private set; }

    bool externalOpen;

    public CombatSimulation(HitTargets targets, PlayerTuning tuning = null, Arena arena = null)
    {
      Targets = targets ?? throw new ArgumentNullException(nameof(targets));
      Stamps = new HitStampSource();
      Clock = new GameClock();
      Driver = new PlayerDriver(new Player(tuning, Stamps), arena ?? ArenaLayout.CreateArena(), Clock);
      Resolver = new HitResolver(targets);
      // Game.aim: the nearest living soldier within reach.
      aim = (double x, double z, double maxDistance, out double tx, out double tz) =>
      {
        int i = Targets.Nearest(x, z, maxDistance);
        tx = i < 0 ? 0 : Targets.X(i);
        tz = i < 0 ? 0 : Targets.Z(i);
        return i >= 0;
      };
    }

    // One rendered frame (realDt already capped). Returns whether the game stepped. afterPlayerHits runs only when the
    // game stepped, receives the game-time step and is the one place where ApplyExternal is allowed.
    public bool Step(double realDt, in PlayerControls c, Action<double> afterPlayerHits = null)
    {
      hits.Clear();
      SteppedThisFrame = Driver.Step(realDt, c, aim);
      if (!SteppedThisFrame) return false;
      Resolver.BeginStep();
      var active = Player.ActiveHits;
      for (int k = 0; k < active.Count; k++)
      {
        var h = active[k];
        int n = Resolver.Apply(h.Stamp, h.Window, h.X, h.Y, h.Z, h.Facing, HitSource.Player, h.Move, h.WindowIndex, Clock.SimSteps, Clock.SimTime, hits);
        if (n == 0) continue;
        Clock.AddHitstop(h.Window.Hitstop);
        Player.GainMusou(Math.Min(9, n * 1.4));
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
      return true;
    }

    // A non-player source inside Step's afterPlayerHits callback. No hit-stop or musou, like the Web dragon.
    public int ApplyExternal(uint stamp, HitWindow window, double ax, double ay, double az, double facing)
    {
      if (!externalOpen) throw new InvalidOperationException("EXTERNAL_HIT_OUTSIDE_STEP");
      int n = Resolver.Apply(stamp, window, ax, ay, az, facing, HitSource.External, null, -1, Clock.SimSteps, Clock.SimTime, hits);
      TotalHits += n;
      return n;
    }

    public void Interrupt() => Driver.Interrupt();

    public void Restart()
    {
      Driver.Restart();
      Resolver.Clear();
      hits.Clear();
      TotalHits = 0;
      SteppedThisFrame = false;
    }
  }
}
