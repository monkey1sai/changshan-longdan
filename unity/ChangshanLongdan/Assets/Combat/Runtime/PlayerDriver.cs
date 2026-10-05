using System;

namespace Changshan.Combat
{
  // The player part of Game.simulate in src/game.ts: during hit-stop presses are only queued, otherwise the player
  // steps and is constrained by the arena. The single owner of the player's position (no root motion elsewhere).
  public sealed class PlayerDriver
  {
    public Player Player { get; }
    public Arena Arena { get; }
    public double Hitstop { get; private set; }

    public PlayerDriver(Player player, Arena arena)
    {
      Player = player ?? throw new ArgumentNullException(nameof(player));
      Arena = arena ?? throw new ArgumentNullException(nameof(arena));
    }

    // Hit-stop from several sources in one tick takes the longest, never the sum.
    public void AddHitstop(double seconds) => Hitstop = Math.Max(Hitstop, seconds);

    public void Step(double dt, in PlayerControls c, AimFunction aim = null)
    {
      if (Hitstop > 0)
      {
        Hitstop -= dt;
        Player.Queue(c);
        return;
      }
      Player.Update(dt, c, aim, Arena);
    }

    // Pause, focus loss or a menu: drop pending presses.
    public void Interrupt() => Player.ClearQueuedActions();

    public void Restart()
    {
      Hitstop = 0;
      Player.Reset(ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
    }
  }
}
