using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Feedback.Audio
{
  // The sound output of the presentation: renders each sound's variants once (the Web draws Math.random per call; a
  // few seeded variants per sound stand in for that), then plays one through the mixer. Hits closer than 25 ms of
  // audio time apart are dropped like AudioEngine.hit. Music is not ported: SetMusicLevel only records the level.
  public sealed class SfxBank : ISfxSink
  {
    public const int Variants = 3;
    public const double HitSpacing = 0.025;
    public const int MaxHitCount = 8; // the hit power stops growing at 8 targets
    public const int MaxShatterCount = 4; // the shatter stops adding impacts at 4 kills

    readonly SfxSynth synth;
    readonly SfxMixer mixer;
    readonly Func<double> audioTime;
    readonly Dictionary<int, float[][]> cache = new Dictionary<int, float[][]>();
    readonly Mulberry32 variantRng;
    readonly Mulberry32 renderRng;
    readonly object gate = new object();
    double lastHitTime = double.NegativeInfinity;

    public double MusicLevel { get; private set; } = FeedbackDirector.MusicLevel;
    public int LastRequest { get; private set; } // the mixer id of the last sound played (0: none)
    public Sound LastSound { get; private set; }

    // audioTime: the audio clock in seconds (AudioContext.currentTime); for the hit spacing.
    public SfxBank(SfxSynth synth, SfxMixer mixer, Func<double> audioTime, uint seed = 7)
    {
      this.synth = synth ?? throw new ArgumentNullException(nameof(synth));
      this.mixer = mixer ?? throw new ArgumentNullException(nameof(mixer));
      this.audioTime = audioTime ?? throw new ArgumentNullException(nameof(audioTime));
      if (synth.Rate != mixer.Rate) throw new ArgumentException("SFX_RATE_MISMATCH");
      variantRng = new Mulberry32(seed);
      renderRng = new Mulberry32(seed ^ 0x9e3779b9u);
    }

    public SfxMixer Mixer => mixer;

    // Renders every variant now (call off the frame loop if the first sounds must not wait for rendering).
    public void Prewarm()
    {
      foreach (bool heavy in new[] { false, true })
      {
        Clips(Sound.Swing, heavy, HitSfx.Light, 0);
        Clips(Sound.PlayerHurt, heavy, HitSfx.Light, 0);
        Clips(Sound.Land, heavy, HitSfx.Light, 0);
      }
      foreach (var kind in new[] { HitSfx.Light, HitSfx.Heavy, HitSfx.Pierce })
        for (int c = 1; c <= MaxHitCount; c++) Clips(Sound.Hit, false, kind, c);
      for (int c = 1; c <= MaxShatterCount; c++) Clips(Sound.Shatter, false, HitSfx.Light, c);
      foreach (var s in new[] { Sound.EnemySwing, Sound.Jump, Sound.Dodge, Sound.MusouStart, Sound.MusouBlast, Sound.MusouReady })
        Clips(s, false, HitSfx.Light, 0);
    }

    // The rendered variants of one sound (rendered on first use).
    public float[][] Clips(Sound sound, bool heavy, HitSfx kind, int count)
    {
      int key = ((int)sound << 16) | ((heavy ? 1 : 0) << 12) | ((int)kind << 8) | count;
      lock (gate)
      {
        if (cache.TryGetValue(key, out var clips)) return clips;
        clips = new float[Variants][];
        for (int i = 0; i < Variants; i++) clips[i] = synth.Render(sound, heavy, kind, count, renderRng);
        cache[key] = clips;
        return clips;
      }
    }

    int Play(Sound sound, bool heavy = false, HitSfx kind = HitSfx.Light, int count = 0, double pan = 0)
    {
      var clips = Clips(sound, heavy, kind, count);
      var clip = clips[(int)Math.Floor(variantRng.Next() * clips.Length)];
      LastSound = sound;
      return LastRequest = mixer.Play(clip, pan);
    }

    public void Swing(bool heavy) => Play(Sound.Swing, heavy);
    public void Jump() => Play(Sound.Jump);
    public void Land(bool heavy) => Play(Sound.Land, heavy);
    public void Dodge() => Play(Sound.Dodge);

    public void Hit(HitSfx kind, int count, double pan)
    {
      double t = audioTime();
      if (t - lastHitTime < HitSpacing) return;
      lastHitTime = t;
      Play(Sound.Hit, false, kind, Math.Max(1, Math.Min(MaxHitCount, count)), pan);
    }

    public void Shatter(int count, double pan) => Play(Sound.Shatter, count: Math.Max(1, Math.Min(MaxShatterCount, count)), pan: pan);
    public void EnemySwing(double pan) => Play(Sound.EnemySwing, pan: pan);
    public void PlayerHurt(bool heavy) => Play(Sound.PlayerHurt, heavy);
    public void MusouStart() => Play(Sound.MusouStart);
    public void MusouBlast() => Play(Sound.MusouBlast);
    public void MusouReady() => Play(Sound.MusouReady);
    public void SetMusicLevel(double level, double seconds) => MusicLevel = level;
  }
}
