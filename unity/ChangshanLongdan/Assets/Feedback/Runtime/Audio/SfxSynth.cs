using System;
using Changshan.Combat;

namespace Changshan.Feedback.Audio
{
  public enum Sound { Swing, Hit, Shatter, EnemySwing, PlayerHurt, Jump, Land, Dodge, MusouStart, MusouBlast, MusouReady }

  // The sound recipes of src/audio/audio-engine.ts (swing through musouReady; the dragon roar, milestone, UI, victory,
  // defeat, music and ambience are not ported) rendered offline into mono buffers that start at the call time. The
  // engine's Math.random draws (noise offsets, clink detune, shatter timing) come from a seeded generator, so each
  // variant is reproducible; the stereo pan, the bus gains, the reverb and the compressor are applied by SfxMixer.
  public sealed class SfxSynth
  {
    public readonly int Rate;
    readonly float[] noise;
    readonly float[] drive;

    public SfxSynth(int sampleRate, uint seed = 1)
    {
      if (sampleRate < 8000) throw new ArgumentOutOfRangeException(nameof(sampleRate));
      Rate = sampleRate;
      var rng = new Mulberry32(seed);
      noise = new float[sampleRate * 2]; // AudioEngine: two seconds of white noise
      for (int i = 0; i < noise.Length; i++) noise[i] = (float)(rng.Next() * 2 - 1);
      drive = DistortionCurve(18);
    }

    public static float[] DistortionCurve(double amount)
    {
      const int n = 1024;
      var curve = new float[n];
      for (int i = 0; i < n; i++)
      {
        double x = (i * 2.0) / n - 1;
        curve[i] = (float)(((1 + amount) * x) / (1 + amount * Math.Abs(x)));
      }
      return curve;
    }

    // Renders one sound. heavy and kind select the variant; count is the hit or shatter count; rng supplies the
    // engine's Math.random draws.
    public float[] Render(Sound sound, bool heavy, HitSfx kind, int count, Mulberry32 rng)
    {
      var v = new Voice(this, rng);
      switch (sound)
      {
        case Sound.Swing: Swing(v, heavy); break;
        case Sound.Hit: Hit(v, kind, count); break;
        case Sound.Shatter: Shatter(v, count); break;
        case Sound.EnemySwing: EnemySwing(v); break;
        case Sound.PlayerHurt: PlayerHurt(v, heavy); break;
        case Sound.Jump: Jump(v); break;
        case Sound.Land: Land(v, heavy); break;
        case Sound.Dodge: Dodge(v); break;
        case Sound.MusouStart: MusouStart(v); break;
        case Sound.MusouBlast: MusouBlast(v); break;
        case Sound.MusouReady: MusouReady(v); break;
        default: throw new ArgumentOutOfRangeException(nameof(sound));
      }
      return v.Render();
    }

    // The hit's loudness factor (audio-engine.ts hit power).
    public static double HitPower(HitSfx kind, int count) => Math.Min(1.6, 0.7 + count * 0.12) * (kind == HitSfx.Heavy ? 1.3 : 1);

    static void Swing(Voice v, bool heavy)
    {
      double dur = heavy ? 0.32 : 0.2;
      var bp = v.Filter(v.Noise(0, dur), FilterType.Bandpass, heavy ? 500 : 800, 1.4);
      bp.Frequency.ExpTo(heavy ? 2200 : 3400, dur * 0.45).ExpTo(heavy ? 600 : 1000, dur);
      v.Out(v.Env(bp, 0, dur * 0.35, heavy ? 0.55 : 0.35, dur * 0.65));
    }

    static void Hit(Voice v, HitSfx kind, int count)
    {
      double power = HitPower(kind, count);
      var thump = v.Osc(Wave.Sine, kind == HitSfx.Heavy ? 140 : 180, 0, 0.3);
      thump.Frequency.ExpTo(42, 0.18);
      v.Out(v.Env(thump, 0, 0.004, 0.9 * power, 0.22));
      v.Out(v.Env(v.Filter(v.Noise(0, 0.14), FilterType.Highpass, 1200, 0.7), 0, 0.002, 0.5 * power, 0.1));
      v.Out(v.Env(v.Filter(v.Noise(0, 0.2), FilterType.Bandpass, kind == HitSfx.Pierce ? 4200 : 3000, 2), 0, 0.003, 0.25 * power, 0.16));
      if (kind == HitSfx.Heavy)
      {
        var boom = v.Osc(Wave.Sine, 72, 0, 0.6);
        boom.Frequency.ExpTo(32, 0.45);
        v.Out(v.Env(new Shaper(boom, v.Drive), 0, 0.005, 0.45, 0.5));
      }
      else
      {
        foreach (double f in new[] { 1850.0, 2790.0 })
        {
          var clink = v.Osc(Wave.Square, f * (0.95 + v.Random() * 0.1), 0, 0.1);
          v.Out(v.Env(v.Filter(clink, FilterType.Bandpass, f, 8), 0, 0.001, 0.07, 0.08));
        }
      }
    }

    // Voxel shattering: a run of small block impacts.
    static void Shatter(Voice v, int count)
    {
      int n = Math.Min(12, 4 + count * 2);
      for (int i = 0; i < n; i++)
      {
        double t = v.Random() * 0.14;
        double f = 1500 + v.Random() * 3500;
        v.Out(v.Env(v.Filter(v.Noise(t, 0.05), FilterType.Bandpass, f, 6), t, 0.001, 0.22, 0.04));
      }
      var thud = v.Osc(Wave.Sine, 95, 0, 0.2);
      thud.Frequency.ExpTo(40, 0.15);
      v.Out(v.Env(thud, 0, 0.003, 0.35, 0.15));
    }

    static void EnemySwing(Voice v)
    {
      var bp = v.Filter(v.Noise(0, 0.22), FilterType.Bandpass, 400, 1.2);
      bp.Frequency.ExpTo(1400, 0.12);
      v.Out(v.Env(bp, 0, 0.06, 0.18, 0.14));
    }

    static void PlayerHurt(Voice v, bool heavy)
    {
      var thump = v.Osc(Wave.Sine, 120, 0, 0.3);
      thump.Frequency.ExpTo(45, 0.2);
      v.Out(v.Env(thump, 0, 0.003, heavy ? 1 : 0.7, 0.25));
      // A grunt from two formants.
      var voice = v.Osc(Wave.Sawtooth, heavy ? 170 : 200, 0, 0.25);
      voice.Frequency.ExpTo(115, 0.2);
      var shared = new Shared(voice);
      v.Out(new Gain(Voice.Envelope(0, 0.01, 0.22, 0.18),
        v.Filter(shared, FilterType.Bandpass, 700, 5), v.Filter(shared, FilterType.Bandpass, 1150, 6)));
    }

    static void Jump(Voice v)
    {
      var bp = v.Filter(v.Noise(0, 0.18), FilterType.Bandpass, 600, 1.5);
      bp.Frequency.ExpTo(1800, 0.15);
      v.Out(v.Env(bp, 0, 0.04, 0.2, 0.12));
    }

    static void Land(Voice v, bool heavy)
    {
      var thud = v.Osc(Wave.Sine, heavy ? 90 : 110, 0, 0.3);
      thud.Frequency.ExpTo(38, 0.22);
      v.Out(v.Env(thud, 0, 0.003, heavy ? 0.9 : 0.4, 0.25));
      v.Out(v.Env(v.Filter(v.Noise(0, 0.25), FilterType.Lowpass, 500, 0.7), 0, 0.005, heavy ? 0.6 : 0.25, 0.2));
    }

    static void Dodge(Voice v)
    {
      var bp = v.Filter(v.Noise(0, 0.26), FilterType.Bandpass, 900, 1.1);
      bp.Frequency.ExpTo(3000, 0.1).ExpTo(700, 0.22);
      v.Out(v.Env(bp, 0, 0.03, 0.32, 0.2));
    }

    // Musou start: a gong, a rising surge and a taiko.
    static void MusouStart(Voice v)
    {
      double[] partials = { 1, 1.49, 2.1, 2.72, 3.3, 4.1 };
      double[] gains = { 0.5, 0.3, 0.25, 0.18, 0.12, 0.1 };
      for (int i = 0; i < partials.Length; i++)
      {
        var o = v.Osc(Wave.Sine, 98 * partials[i], 0, 3.2);
        o.Frequency.ExpTo(98 * partials[i] * 0.97, 3);
        v.Out(v.Env(o, 0, 0.005, gains[i], 3 - i * 0.3));
      }
      v.Out(v.Env(v.Filter(v.Noise(0, 0.3), FilterType.Bandpass, 2400, 1), 0, 0.002, 0.4, 0.25));
      var riser = v.Osc(Wave.Sawtooth, 110, 0, 1.2);
      riser.Frequency.ExpTo(220, 1.0);
      var lp = v.Filter(riser, FilterType.Lowpass, 300, 8);
      lp.Frequency.ExpTo(3500, 1.0);
      v.Out(v.Env(lp, 0, 0.9, 0.22, 0.25));
      var taiko = v.Osc(Wave.Sine, 80, 0, 0.6);
      taiko.Frequency.ExpTo(45, 0.4);
      v.Out(v.Env(taiko, 0, 0.004, 1, 0.5));
    }

    static void MusouBlast(Voice v)
    {
      var boom = v.Osc(Wave.Sine, 70, 0, 1.6);
      boom.Frequency.ExpTo(28, 1.2);
      v.Out(v.Env(new Shaper(boom, v.Drive), 0, 0.004, 0.9, 1.4));
      var lp = v.Filter(v.Noise(0, 1.8), FilterType.Lowpass, 6000, 0.8);
      lp.Frequency.ExpTo(150, 1.6);
      v.Out(v.Env(lp, 0, 0.004, 0.9, 1.6));
    }

    // Musou gauge full: a rising pentatonic arpeggio.
    static void MusouReady(Voice v)
    {
      int[] notes = { 74, 77, 81, 86 };
      for (int i = 0; i < notes.Length; i++)
      {
        double t = i * 0.07;
        double f = 440 * Math.Pow(2, (notes[i] - 69) / 12.0);
        v.Out(v.Env(v.Osc(Wave.Triangle, f, t, 0.5), t, 0.003, 0.14, 0.4));
        v.Out(v.Env(v.Osc(Wave.Sine, f * 2, t, 0.3), t, 0.003, 0.05, 0.25));
      }
    }

    // One sound being built: its chains, the latest time any source plays, and the random draws.
    sealed class Voice
    {
      readonly SfxSynth synth;
      readonly Mulberry32 rng;
      readonly Mix mix = new Mix();
      double end;

      public Voice(SfxSynth synth, Mulberry32 rng)
      {
        this.synth = synth;
        this.rng = rng ?? throw new ArgumentNullException(nameof(rng));
      }

      public float[] Drive => synth.drive;
      public double Random() => rng.Next();

      public NoiseSource Noise(double t, double duration)
      {
        end = Math.Max(end, t + duration + 0.05);
        return new NoiseSource(synth.noise, synth.Rate, t, duration, Random() * 1.5);
      }

      public Oscillator Osc(Wave wave, double frequency, double t, double duration)
      {
        end = Math.Max(end, t + duration + 0.05);
        return new Oscillator(wave, frequency, synth.Rate, t, duration);
      }

      public Biquad Filter(SynthNode input, FilterType type, double frequency, double q) => new Biquad(input, type, frequency, q, synth.Rate, 0);

      // audio-engine.ts env: from 0.0001 up to peak in `attack`, then down to 0.0001 over `decay` (exponential).
      public static ParamCurve Envelope(double t, double attack, double peak, double decay) =>
        new ParamCurve(1).Set(0.0001, t).ExpTo(Math.Max(0.0002, peak), t + attack).ExpTo(0.0001, t + attack + decay);

      public Gain Env(SynthNode input, double t, double attack, double peak, double decay) => new Gain(Envelope(t, attack, peak, decay), input);

      public void Out(SynthNode chain) => mix.Add(chain);

      public float[] Render()
      {
        int length = (int)Math.Ceiling((end + 0.02) * synth.Rate);
        var buffer = new float[length];
        for (int k = 0; k < length; k++) buffer[k] = (float)mix.Next(k, (double)k / synth.Rate);
        return buffer;
      }
    }
  }
}
