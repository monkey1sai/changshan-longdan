using System;
using Changshan.Combat;

namespace Changshan.View
{
  public enum GameMode { Title, Playing, Paused, Ended }

  // What the frame loop has to do after the mode machine read this frame's input.
  public enum ModeAction { None, StartBattle, Pause, Resume }

  // Port of game.ts's mode handling: the title starts a battle on confirm or attack, the fight pauses on the pause key
  // (and on focus loss), the pause screen resumes on pause or confirm, and the result screen restarts on confirm once
  // the result is shown. Combat input only reaches the simulation while playing; the camera turn only while playing.
  public sealed class GameModes
  {
    public const double ResultDelay = 2.4; // seconds after the outcome before the result screen (game.ts endTimer)

    public GameMode Mode { get; private set; } = GameMode.Title;
    public bool ResultShown { get; private set; }
    double endTimer;

    // Reads one frame's mode input. frameSeconds is real time (the result timer runs while ended).
    public ModeAction Step(in InputFrame input, double frameSeconds)
    {
      switch (Mode)
      {
        case GameMode.Title:
          if (input.Confirm || input.Attack) return Start();
          return ModeAction.None;
        case GameMode.Playing:
          if (input.Pause) return SetPaused(true);
          return ModeAction.None;
        case GameMode.Paused:
          if (input.Pause || input.Confirm) return SetPaused(false);
          return ModeAction.None;
        case GameMode.Ended:
          if (!ResultShown)
          {
            endTimer -= frameSeconds;
            if (endTimer <= 0) ResultShown = true;
          }
          if (ResultShown && input.Confirm) return Start();
          return ModeAction.None;
        default:
          throw new InvalidOperationException();
      }
    }

    // The battle decided (victory or defeat): input is ignored and the result follows after the delay.
    public void End()
    {
      if (Mode != GameMode.Playing) return;
      Mode = GameMode.Ended;
      ResultShown = false;
      endTimer = ResultDelay;
    }

    // Focus loss pauses a running fight (game.ts blur / visibilitychange); anything else is left alone.
    public ModeAction FocusLost() => Mode == GameMode.Playing ? SetPaused(true) : ModeAction.None;

    // The pause screen's resume button.
    public ModeAction ResumeRequested() => Mode == GameMode.Paused ? SetPaused(false) : ModeAction.None;

    // The title's start button or the result's retry button.
    public ModeAction StartRequested() => Mode == GameMode.Title || (Mode == GameMode.Ended && ResultShown) ? Start() : ModeAction.None;

    public bool AcceptsCombatInput => Mode == GameMode.Playing;
    public bool Simulates => Mode == GameMode.Playing || Mode == GameMode.Ended;
    public bool IsTitle => Mode == GameMode.Title;

    ModeAction Start()
    {
      Mode = GameMode.Playing;
      ResultShown = false;
      endTimer = 0;
      return ModeAction.StartBattle;
    }

    ModeAction SetPaused(bool paused)
    {
      if (paused && Mode != GameMode.Playing) return ModeAction.None;
      if (!paused && Mode != GameMode.Paused) return ModeAction.None;
      Mode = paused ? GameMode.Paused : GameMode.Playing;
      return paused ? ModeAction.Pause : ModeAction.Resume;
    }
  }

  // Battle.rank: the result grade from the outcome, kills, time and damage taken.
  public static class BattleRank
  {
    public static string Rank(bool win, long ko, double seconds, double damage)
    {
      if (!win) return ko >= 200 ? "B" : ko >= 100 ? "C" : "D";
      if (seconds < 300 && damage < 400) return "S";
      if (seconds < 480) return "A";
      return "B";
    }
  }
}
