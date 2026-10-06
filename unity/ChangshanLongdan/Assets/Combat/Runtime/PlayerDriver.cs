using System;

namespace Changshan.Combat
{
  // The player part of Game.simulate in src/game.ts: during hit-stop presses are only queued, otherwise the player
  // steps and is constrained by the arena. The single owner of the player's position (no root motion elsewhere).
  public sealed class PlayerDriver
  {
    public Player Player { get; }
    public Arena Arena { get; }
    public GameClock Clock { get; }
    public double Hitstop => Clock.Hitstop;

    public PlayerDriver(Player player, Arena arena, GameClock clock = null)
    {
      Player = player ?? throw new ArgumentNullException(nameof(player));
      Arena = arena ?? throw new ArgumentNullException(nameof(arena));
      Clock = clock ?? new GameClock();
    }

    // Hit-stop from several sources in one tick takes the longest, never the sum.
    public void AddHitstop(double seconds) => Clock.AddHitstop(seconds);

    // Returns false when hit-stop held the game and the presses were only queued.
    public bool Step(double dt, in PlayerControls c, AimFunction aim = null)
    {
      double simDt = Clock.Advance(dt, out bool stepped);
      if (!stepped)
      {
        Player.Queue(c);
        return false;
      }
      Player.Update(simDt, c, aim, Arena);
      return true;
    }

    // Pause, focus loss or a menu: drop pending presses.
    public void Interrupt() => Player.ClearQueuedActions();

    public void Restart()
    {
      Clock.Reset();
      Player.Reset(ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
    }
  }
}
