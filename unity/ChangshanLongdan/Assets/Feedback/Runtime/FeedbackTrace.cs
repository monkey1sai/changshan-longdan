using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Feedback
{
  // One output call the presentation made (a sound, a particle spawn, a camera or post value, a HUD notice), named
  // like the Web sink method ("audio.hit", "sparks.burst") with its numeric arguments.
  public struct FeedbackCue
  {
    public const int MaxArgs = 9;
    public long Frame;
    public string Name;
    public int ArgCount;
    public double A0, A1, A2, A3, A4, A5, A6, A7, A8;

    public double Arg(int i)
    {
      switch (i)
      {
        case 0: return A0;
        case 1: return A1;
        case 2: return A2;
        case 3: return A3;
        case 4: return A4;
        case 5: return A5;
        case 6: return A6;
        case 7: return A7;
        case 8: return A8;
        default: throw new ArgumentOutOfRangeException(nameof(i));
      }
    }
  }

  // One rendered frame of the common trace: the game step, the hits and damage the fight resolved, and which cues the
  // presentation issued for them (Cues[FirstCue, FirstCue + CueCount) in the trace's cue buffer).
  public struct FeedbackFrame
  {
    public long Frame;
    public long SimSteps;
    public double SimTime;
    public bool Stepped;
    public int Hits;
    public double Damage;
    public int Kills;
    public int FirstCue, CueCount;
  }

  // The common trace of hits, damage, sound and effects (E07 "命中、扣血、聲音／VFX 時點共同 trace"). Bounded: the newest
  // frames and cues are kept, older ones are dropped when full; nothing is allocated per frame.
  public sealed class FeedbackTrace
  {
    readonly FeedbackCue[] cues;
    readonly FeedbackFrame[] frames;
    long cueTotal, frameTotal;
    long currentFrame = -1;
    FeedbackFrame open;
    bool isOpen;

    public FeedbackTrace(int frameCapacity = 4096, int cueCapacity = 16384)
    {
      frames = new FeedbackFrame[frameCapacity];
      cues = new FeedbackCue[cueCapacity];
    }

    public long CueTotal => cueTotal;
    public long FrameTotal => frameTotal;
    public int FrameCapacity => frames.Length;
    public int CueCapacity => cues.Length;

    public void Clear()
    {
      cueTotal = 0;
      frameTotal = 0;
      currentFrame = -1;
      isOpen = false;
    }

    // Starts a frame; cues recorded until EndFrame belong to it.
    public void BeginFrame(long frame, long simSteps, double simTime, bool stepped, IReadOnlyList<HitEvent> hits, int kills)
    {
      if (isOpen) EndFrame();
      currentFrame = frame;
      double damage = 0;
      for (int i = 0; i < hits.Count; i++) damage += hits[i].Damage;
      open = new FeedbackFrame
      {
        Frame = frame, SimSteps = simSteps, SimTime = simTime, Stepped = stepped, Hits = hits.Count, Damage = damage, Kills = kills,
        FirstCue = (int)(cueTotal % cues.Length), CueCount = 0,
      };
      isOpen = true;
    }

    public void EndFrame()
    {
      if (!isOpen) return;
      frames[frameTotal % frames.Length] = open;
      frameTotal++;
      isOpen = false;
    }

    public void Add(string name, int count, double a0 = 0, double a1 = 0, double a2 = 0, double a3 = 0, double a4 = 0, double a5 = 0,
      double a6 = 0, double a7 = 0, double a8 = 0)
    {
      cues[cueTotal % cues.Length] = new FeedbackCue
      {
        Frame = currentFrame, Name = name, ArgCount = count, A0 = a0, A1 = a1, A2 = a2, A3 = a3, A4 = a4, A5 = a5, A6 = a6, A7 = a7, A8 = a8,
      };
      cueTotal++;
      if (isOpen) open.CueCount++;
    }

    // The kept frames, oldest first.
    public void CopyFrames(List<FeedbackFrame> into)
    {
      into.Clear();
      long from = Math.Max(0, frameTotal - frames.Length);
      for (long i = from; i < frameTotal; i++) into.Add(frames[i % frames.Length]);
    }

    // The kept cues, oldest first.
    public void CopyCues(List<FeedbackCue> into)
    {
      into.Clear();
      long from = Math.Max(0, cueTotal - cues.Length);
      for (long i = from; i < cueTotal; i++) into.Add(cues[i % cues.Length]);
    }
  }

  // Wraps the sinks so that every call is recorded in a trace before it reaches the real output.
  public static class TracingSinks
  {
    public static FeedbackSinks Wrap(FeedbackSinks inner, FeedbackTrace trace)
    {
      if (inner == null) throw new ArgumentNullException(nameof(inner));
      if (trace == null) throw new ArgumentNullException(nameof(trace));
      return new FeedbackSinks
      {
        Audio = new Sfx(inner.Audio, trace),
        Sparks = new Sparks(inner.Sparks, trace),
        Dust = new Dust(inner.Dust, trace),
        Waves = new Waves(inner.Waves, trace),
        Fragments = new Fragments(inner.Fragments, trace),
        Camera = new Camera(inner.Camera, trace),
        Post = new Post(inner.Post, trace),
        Hud = new Hud(inner.Hud, trace),
      };
    }

    static double B(bool v) => v ? 1 : 0;

    // A sound is traced even without a sound output (the Web records nothing then; the trace keeps the intent).
    sealed class Sfx : ISfxSink
    {
      readonly ISfxSink inner;
      readonly FeedbackTrace t;
      public Sfx(ISfxSink inner, FeedbackTrace t) { this.inner = inner; this.t = t; }
      public void Swing(bool heavy) { t.Add("audio.swing", 1, B(heavy)); inner?.Swing(heavy); }
      public void Jump() { t.Add("audio.jump", 0); inner?.Jump(); }
      public void Land(bool heavy) { t.Add("audio.land", 1, B(heavy)); inner?.Land(heavy); }
      public void Dodge() { t.Add("audio.dodge", 0); inner?.Dodge(); }
      public void Hit(HitSfx kind, int count, double pan) { t.Add("audio.hit", 3, (double)kind, count, pan); inner?.Hit(kind, count, pan); }
      public void Shatter(int count, double pan) { t.Add("audio.shatter", 2, count, pan); inner?.Shatter(count, pan); }
      public void EnemySwing(double pan) { t.Add("audio.enemySwing", 1, pan); inner?.EnemySwing(pan); }
      public void PlayerHurt(bool heavy) { t.Add("audio.playerHurt", 1, B(heavy)); inner?.PlayerHurt(heavy); }
      public void MusouStart() { t.Add("audio.musouStart", 0); inner?.MusouStart(); }
      public void MusouBlast() { t.Add("audio.musouBlast", 0); inner?.MusouBlast(); }
      public void MusouReady() { t.Add("audio.musouReady", 0); inner?.MusouReady(); }
      public void SetMusicLevel(double level, double seconds) { t.Add("audio.setMusicLevel", 2, level, seconds); inner?.SetMusicLevel(level, seconds); }
    }

    sealed class Sparks : ISparkSink
    {
      readonly ISparkSink inner;
      readonly FeedbackTrace t;
      public Sparks(ISparkSink inner, FeedbackTrace t) { this.inner = inner; this.t = t; }
      public void Burst(double x, double y, double z, double dirX, double dirZ, int n, bool heavy, Mulberry32 rng)
      {
        t.Add("sparks.burst", 7, x, y, z, dirX, dirZ, n, B(heavy));
        inner.Burst(x, y, z, dirX, dirZ, n, heavy, rng);
      }
    }

    sealed class Dust : IDustSink
    {
      readonly IDustSink inner;
      readonly FeedbackTrace t;
      public Dust(IDustSink inner, FeedbackTrace t) { this.inner = inner; this.t = t; }
      public void Puff(double x, double y, double z, int n, double speed, Mulberry32 rng) { t.Add("dust.puff", 5, x, y, z, n, speed); inner.Puff(x, y, z, n, speed, rng); }
      public void Ring(double x, double z, double radius, int n, Mulberry32 rng) { t.Add("dust.ring", 4, x, z, radius, n); inner.Ring(x, z, radius, n, rng); }
    }

    sealed class Waves : IWaveSink
    {
      readonly IWaveSink inner;
      readonly FeedbackTrace t;
      public Waves(IWaveSink inner, FeedbackTrace t) { this.inner = inner; this.t = t; }
      public void Ring(double x, double z, double radius, double duration, Rgb c)
      {
        t.Add("waves.ring", 7, x, z, radius, duration, c.R, c.G, c.B);
        inner.Ring(x, z, radius, duration, c);
      }
      public void Pillar(double x, double z, double radius, double height, double duration, Rgb c)
      {
        t.Add("waves.pillar", 8, x, z, radius, height, duration, c.R, c.G, c.B);
        inner.Pillar(x, z, radius, height, duration, c);
      }
    }

    sealed class Fragments : IFragmentSink
    {
      readonly IFragmentSink inner;
      readonly FeedbackTrace t;
      public Fragments(IFragmentSink inner, FeedbackTrace t) { this.inner = inner; this.t = t; }
      public void SpawnSoldier(in KillInfo kill, Mulberry32 rng) { t.Add("fragments.spawnSoldier", 1, kill.Id); inner.SpawnSoldier(kill, rng); }
    }

    sealed class Camera : ICameraSink
    {
      readonly ICameraSink inner;
      readonly FeedbackTrace t;
      public Camera(ICameraSink inner, FeedbackTrace t) { this.inner = inner; this.t = t; }
      public void AddTrauma(double amount) { t.Add("camera.addTrauma", 1, amount); inner.AddTrauma(amount); }
      public void Kick(double amount) { t.Add("camera.kick", 1, amount); inner.Kick(amount); }
      public double PositionX => inner.PositionX;
      public double PositionZ => inner.PositionZ;
      public double RightX => inner.RightX;
      public double RightZ => inner.RightZ;
    }

    sealed class Post : IPostSink
    {
      readonly IPostSink inner;
      readonly FeedbackTrace t;
      public Post(IPostSink inner, FeedbackTrace t) { this.inner = inner; this.t = t; }
      public double Aberration { get => inner.Aberration; set { t.Add("post.aberration", 1, value); inner.Aberration = value; } }
      public double Radial { get => inner.Radial; set { t.Add("post.radial", 1, value); inner.Radial = value; } }
      public double Flash { get => inner.Flash; set { t.Add("post.flash", 1, value); inner.Flash = value; } }
    }

    sealed class Hud : IHudSink
    {
      readonly IHudSink inner;
      readonly FeedbackTrace t;
      public Hud(IHudSink inner, FeedbackTrace t) { this.inner = inner; this.t = t; }
      public void ShowBanner(Banner banner, double seconds, bool gold) { t.Add("hud.showBanner", 2, seconds, B(gold)); inner.ShowBanner(banner, seconds, gold); }
      public void PlayCutin() { t.Add("hud.playCutin", 0); inner.PlayCutin(); }
    }
  }
}
