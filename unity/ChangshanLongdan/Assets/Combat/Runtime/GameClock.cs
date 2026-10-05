using System;

namespace Changshan.Combat
{
  // The three clocks of src/game.ts made explicit:
  //  - real/input clock: every rendered frame, capped at MaxFrameSeconds; input is polled and queued on it, even during hit-stop.
  //  - game clock (SimTime): advances only when the simulation steps; hit-stop freezes it, slow motion scales it by 0.3.
  //  - animation clock: E06 animates from SimTime, so poses freeze with the game during hit-stop.
  public sealed class GameClock
  {
    public const double MaxFrameSeconds = 0.05;
    public const double SlowmoScale = 0.3;

    public double RealTime { get; private set; }
    public double SimTime { get; private set; }
    public long Frames { get; private set; }
    public long SimSteps { get; private set; }
    public double Hitstop { get; private set; }
    public double Slowmo { get; private set; }

    // Several hits in one tick (or 20 soldiers in one swing) stop the game for the longest request, never the sum.
    public void AddHitstop(double seconds)
    {
      if (double.IsNaN(seconds) || seconds < 0) throw new ArgumentOutOfRangeException(nameof(seconds));
      Hitstop = Math.Max(Hitstop, seconds);
    }

    public void StartSlowmo(double seconds)
    {
      if (double.IsNaN(seconds) || seconds < 0) throw new ArgumentOutOfRangeException(nameof(seconds));
      Slowmo = Math.Max(Slowmo, seconds);
    }

    // Advances real time by one frame (already capped by the caller) and returns the game-time step; `stepped` is false
    // when hit-stop held the game. Same order as Game.simulate: hit-stop and slow motion both count down in real time.
    public double Advance(double realDt, out bool stepped)
    {
      if (double.IsNaN(realDt) || realDt < 0) throw new ArgumentOutOfRangeException(nameof(realDt));
      RealTime += realDt;
      Frames++;
      if (Hitstop > 0)
      {
        Hitstop -= realDt;
        stepped = false;
        return 0;
      }
      stepped = true;
      if (Slowmo > 0) Slowmo -= realDt;
      double dt = realDt * (Slowmo > 0 ? SlowmoScale : 1);
      SimTime += dt;
      SimSteps++;
      return dt;
    }

    public void Reset()
    {
      RealTime = SimTime = Hitstop = Slowmo = 0;
      Frames = SimSteps = 0;
    }
  }
}
