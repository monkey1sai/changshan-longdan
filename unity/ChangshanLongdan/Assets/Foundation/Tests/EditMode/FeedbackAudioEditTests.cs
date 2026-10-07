using System;
using System.Collections.Generic;
using System.Linq;
using Changshan.Combat;
using Changshan.Feedback;
using Changshan.Feedback.Audio;
using NUnit.Framework;

namespace Changshan.Foundation.Tests
{
  // E07 sound: the offline imitation of the WebAudio nodes, the ported recipes, the bus and the mixer's timing. These
  // check the arithmetic and the timing; whether the sounds feel right is a listening check (not done by tests).
  public sealed class FeedbackAudioEditTests
  {
    const int Rate = 48000;

    static (double Peak, int PeakAt, double Rms) Measure(float[] clip)
    {
      double peak = 0, sum = 0;
      int at = 0;
      for (int i = 0; i < clip.Length; i++)
      {
        Assert.That(float.IsNaN(clip[i]) || float.IsInfinity(clip[i]), Is.False, $"sample {i}");
        double v = Math.Abs(clip[i]);
        if (v > peak) { peak = v; at = i; }
        sum += v * v;
      }
      return (peak, at, Math.Sqrt(sum / clip.Length));
    }

    // AudioParam automation as the Web Audio API defines it: default before the first event, ramps from the previous
    // event, exponential in between, held after the last event.
    [Test] public void ParamCurveFollowsTheWebAudioAutomationRules()
    {
      var env = new ParamCurve(1).Set(0.0001, 0.1).ExpTo(0.5, 0.11).ExpTo(0.0001, 0.31);
      Assert.That(env.At(0.05), Is.EqualTo(1), "default value before the first event");
      Assert.That(env.At(0.1), Is.EqualTo(0.0001).Within(1e-12));
      Assert.That(env.At(0.105), Is.EqualTo(0.0001 * Math.Pow(0.5 / 0.0001, 0.5)).Within(1e-12), "exponential ramp halfway");
      Assert.That(env.At(0.11), Is.EqualTo(0.5).Within(1e-12));
      Assert.That(env.At(0.21), Is.EqualTo(0.5 * Math.Pow(0.0001 / 0.5, 0.5)).Within(1e-12));
      Assert.That(env.At(5), Is.EqualTo(0.0001).Within(1e-12), "held after the last event");
      var linear = new ParamCurve(0).Set(2, 0).LinearTo(4, 1);
      Assert.That(linear.At(0.25), Is.EqualTo(2.5).Within(1e-12));
    }

    // BiquadFilterNode: a band-pass passes its centre at unit gain; a low-pass passes DC (Q in dB) and stops near Nyquist.
    [Test] public void BiquadMatchesTheSpecificationResponse()
    {
      double Gain(FilterType type, double filterHz, double q, double toneHz)
      {
        var tone = new Oscillator(Wave.Sine, toneHz, Rate, 0, 2);
        var f = new Biquad(tone, type, filterHz, q, Rate, 0);
        double peak = 0;
        for (int k = 0; k < Rate; k++)
        {
          double y = f.Next(k, (double)k / Rate);
          if (k > Rate / 2) peak = Math.Max(peak, Math.Abs(y));
        }
        return peak;
      }
      Assert.That(Gain(FilterType.Bandpass, 1000, 2, 1000), Is.EqualTo(1).Within(0.01));
      Assert.That(Gain(FilterType.Bandpass, 1000, 8, 3000), Is.LessThan(0.1));
      Assert.That(Gain(FilterType.Lowpass, 500, 0.7, 20), Is.EqualTo(1).Within(0.01));
      Assert.That(Gain(FilterType.Lowpass, 500, 0.7, 8000), Is.LessThan(0.01));
      Assert.That(Gain(FilterType.Highpass, 1200, 0.7, 50), Is.LessThan(0.01));
      // Q is in dB for the low-pass: 8 dB gives a resonant peak of about 10^(8/20) at the cutoff.
      Assert.That(Gain(FilterType.Lowpass, 2000, 8, 2000), Is.EqualTo(Math.Pow(10, 8 / 20.0)).Within(0.1));
    }

    [Test] public void OscillatorsStartLikeWebAudioAndStayBandLimited()
    {
      foreach (var wave in new[] { Wave.Sine, Wave.Sawtooth, Wave.Square, Wave.Triangle })
      {
        var o = new Oscillator(wave, 200, Rate, 0, 1);
        Assert.That(Math.Abs(o.Next(0, 0)), Is.LessThan(0.6), $"{wave} starts near its upward zero crossing");
        double peak = 0;
        for (int k = 1; k < Rate / 2; k++) peak = Math.Max(peak, Math.Abs(o.Next(k, (double)k / Rate)));
        Assert.That(peak, Is.InRange(0.95, 1.1), wave.ToString());
      }
      var silent = new Oscillator(Wave.Sine, 200, Rate, 0.5, 0.1);
      Assert.That(silent.Next(0, 0.1), Is.EqualTo(0), "not started yet");
      Assert.That(silent.Next(0, 0.66), Is.EqualTo(0), "stopped 50 ms after its duration");
    }

    [Test] public void DistortionCurveIsTheEnginesDrive()
    {
      var curve = SfxSynth.DistortionCurve(18);
      Assert.That(curve.Length, Is.EqualTo(1024));
      Assert.That(curve[0], Is.EqualTo(-1f).Within(1e-6));
      Assert.That(curve[512], Is.EqualTo(0f).Within(1e-6));
      double x = 768 * 2.0 / 1024 - 1;
      Assert.That(curve[768], Is.EqualTo((float)(19 * x / (1 + 18 * x))).Within(1e-6));
    }

    // Every ported recipe renders finite audio of the engine's length, peaking where its envelope peaks.
    [Test] public void EveryPortedSoundRendersWithItsEnvelope()
    {
      var synth = new SfxSynth(Rate);
      var rng = new Mulberry32(3);
      var cases = new (Sound Sound, bool Heavy, HitSfx Kind, int Count, double Seconds, double PeakBeforeMs)[]
      {
        (Sound.Swing, false, HitSfx.Light, 0, 0.2, 120), (Sound.Swing, true, HitSfx.Light, 0, 0.32, 180),
        (Sound.Hit, false, HitSfx.Light, 1, 0.3, 12), (Sound.Hit, false, HitSfx.Heavy, 3, 0.6, 20), (Sound.Hit, false, HitSfx.Pierce, 8, 0.3, 12),
        (Sound.Shatter, false, HitSfx.Light, 2, 0.2, 160), (Sound.EnemySwing, false, HitSfx.Light, 0, 0.22, 100),
        (Sound.PlayerHurt, true, HitSfx.Light, 0, 0.3, 20), (Sound.Jump, false, HitSfx.Light, 0, 0.18, 80),
        (Sound.Land, true, HitSfx.Light, 0, 0.3, 12), (Sound.Dodge, false, HitSfx.Light, 0, 0.26, 80),
        (Sound.MusouStart, false, HitSfx.Light, 0, 3.2, 40), (Sound.MusouBlast, false, HitSfx.Light, 0, 1.8, 30),
        (Sound.MusouReady, false, HitSfx.Light, 0, 0.71, 260),
      };
      foreach (var c in cases)
      {
        var clip = synth.Render(c.Sound, c.Heavy, c.Kind, c.Count, rng);
        var (peak, at, rms) = Measure(clip);
        string id = $"{c.Sound} heavy={c.Heavy} {c.Kind} x{c.Count}";
        Assert.That(clip.Length / (double)Rate, Is.InRange(c.Seconds, c.Seconds + 0.1), id + " length");
        Assert.That(peak, Is.GreaterThan(0.02), id + " audible");
        Assert.That(at * 1000.0 / Rate, Is.LessThan(c.PeakBeforeMs), id + " peak time");
        Assert.That(rms, Is.GreaterThan(0), id);
        Assert.That(Math.Abs(clip[clip.Length - 1]), Is.LessThan(0.01), id + " ends quietly");
      }
    }

    [Test] public void HitLoudnessFollowsTheEnginePower()
    {
      Assert.That(SfxSynth.HitPower(HitSfx.Light, 1), Is.EqualTo(0.82).Within(1e-12));
      Assert.That(SfxSynth.HitPower(HitSfx.Heavy, 1), Is.EqualTo(0.82 * 1.3).Within(1e-12));
      Assert.That(SfxSynth.HitPower(HitSfx.Pierce, 8), Is.EqualTo(1.6).Within(1e-12));
      Assert.That(SfxSynth.HitPower(HitSfx.Light, 20), Is.EqualTo(1.6).Within(1e-12), "saturates from eight targets");
      var synth = new SfxSynth(Rate);
      double one = Measure(synth.Render(Sound.Hit, false, HitSfx.Light, 1, new Mulberry32(1))).Rms;
      double eight = Measure(synth.Render(Sound.Hit, false, HitSfx.Light, 8, new Mulberry32(1))).Rms;
      Assert.That(eight, Is.GreaterThan(one * 1.5));
    }

    [Test] public void RenderingIsReproducibleFromItsSeed()
    {
      var a = new SfxSynth(Rate, 9).Render(Sound.Swing, true, HitSfx.Light, 0, new Mulberry32(4));
      var b = new SfxSynth(Rate, 9).Render(Sound.Swing, true, HitSfx.Light, 0, new Mulberry32(4));
      var c = new SfxSynth(Rate, 9).Render(Sound.Swing, true, HitSfx.Light, 0, new Mulberry32(5));
      Assert.That(a, Is.EqualTo(b));
      Assert.That(a, Is.Not.EqualTo(c), "another draw picks another noise offset");
    }

    // StereoPannerNode's equal-power law for a mono source, through the bus gains.
    [Test] public void MixerPansWithTheEqualPowerLaw()
    {
      foreach (double pan in new[] { -0.7, 0, 0.35, 0.7 })
      {
        var mixer = new SfxMixer(Rate);
        var clip = new float[1024];
        for (int i = 0; i < clip.Length; i++) clip[i] = 0.001f; // far under the threshold: the compressor only adds make-up
        mixer.Play(clip, pan);
        var data = new float[2 * 1024];
        mixer.Render(data, 1024, 2);
        int at = (int)Math.Round(SfxMixer.Compressor.LookAhead * Rate) + 10; // after the look-ahead delay
        double x = (pan + 1) / 2;
        double ratio = data[at * 2 + 1] / data[at * 2];
        Assert.That(ratio, Is.EqualTo(Math.Sin(x * Math.PI / 2) / Math.Cos(x * Math.PI / 2)).Within(1e-3), $"pan {pan}");
      }
    }

    [Test] public void CompressorUsesTheEngineSettings()
    {
      Assert.That(SfxMixer.Compressor.Curve(-40), Is.EqualTo(-40), "below the knee");
      Assert.That(SfxMixer.Compressor.Curve(0), Is.EqualTo(-16 + 16 / 4.0).Within(1e-12), "above the knee: ratio 4");
      Assert.That(SfxMixer.Compressor.Curve(-16), Is.EqualTo(-16 - 0.75 * 36 / 24).Within(1e-12), "soft knee around the threshold");
      Assert.That(SfxMixer.Compressor.Curve(-22), Is.EqualTo(-22), "the knee starts 6 dB under the threshold");
      Assert.That(new SfxMixer.Compressor(Rate).MakeupDb, Is.EqualTo(12 * 0.6).Within(1e-9), "Chromium make-up gain");
      // A loud burst is pulled down after the attack.
      var c = new SfxMixer.Compressor(Rate);
      double last = 0;
      for (int i = 0; i < Rate / 10; i++)
      {
        c.Process(1, 1, out double l, out _);
        last = l;
      }
      Assert.That(last, Is.EqualTo(Math.Pow(10, (-12 + 7.2) / 20)).Within(0.02));
    }

    [Test] public void ReverbCarriesTheWebImpulseEnergyAndDecays()
    {
      var reverb = new SfxMixer.Reverb(Rate, 0);
      double energy = 0, early = 0, late = 0;
      for (int k = 0; k < Rate * 3; k++)
      {
        double y = reverb.Process(k == 0 ? 1 : 0);
        energy += y * y;
        if (k < Rate / 2) early += y * y;
        else if (k > Rate * 2) late += y * y;
      }
      Assert.That(energy, Is.EqualTo(SfxMixer.Reverb.TargetEnergy).Within(1e-6));
      Assert.That(late, Is.LessThan(early * 1e-3), "about 60 dB down after two seconds");
    }

    // Timing: a real-time request starts with the next audio buffer; an offline request at its exact sample.
    [Test] public void VoicesStartAtTheNextBufferOrTheirSample()
    {
      var mixer = new SfxMixer(Rate);
      var data = new float[2 * 1024];
      mixer.Render(data, 1024, 2);
      int id = mixer.Play(new float[] { 0.5f, 0.5f }, 0);
      int later = mixer.Play(new float[] { 0.5f }, 0, 1, 1024 + 1500);
      var starts = new List<(int Id, long Sample)>();
      mixer.Render(data, 1024, 2);
      mixer.TakeStarts(starts);
      Assert.That(starts, Is.EqualTo(new[] { (id, 1024L) }));
      mixer.Render(data, 1024, 2);
      mixer.TakeStarts(starts);
      Assert.That(starts, Is.EqualTo(new[] { (later, 1024L + 1500) }));
      Assert.That(mixer.SamplesRendered, Is.EqualTo(3 * 1024));
      Assert.That(mixer.ActiveVoices, Is.Zero, "short clips have ended");
      Assert.Throws<ArgumentNullException>(() => mixer.Play(null, 0));
      Assert.Throws<ArgumentException>(() => mixer.Play(new float[0], 0));
    }

    // When every voice is busy, new sounds replace the voices that started first, not each other.
    [Test] public void FullMixerStealsTheOldestPlayingVoices()
    {
      var mixer = new SfxMixer(Rate, 2);
      var data = new float[2 * 256];
      var starts = new List<(int Id, long Sample)>();
      int a = mixer.Play(new float[Rate], 0), b = mixer.Play(new float[Rate], 0);
      mixer.Render(data, 256, 2);
      int c = mixer.Play(new float[Rate], 0), d = mixer.Play(new float[Rate], 0);
      mixer.Render(data, 256, 2);
      mixer.TakeStarts(starts);
      Assert.That(starts.Select(s => s.Id), Is.EquivalentTo(new[] { a, b, c, d }), "both new sounds start");
      Assert.That(mixer.ActiveVoices, Is.EqualTo(2));
    }

    // A sound's variants depend only on the seed, not on which sounds were rendered before it.
    [Test] public void BankVariantsDoNotDependOnRenderOrder()
    {
      var first = new SfxBank(new SfxSynth(Rate), new SfxMixer(Rate), () => 0);
      var second = new SfxBank(new SfxSynth(Rate), new SfxMixer(Rate), () => 0);
      second.Clips(Sound.Dodge, false, HitSfx.Light, 0);
      Assert.That(second.Clips(Sound.Swing, true, HitSfx.Light, 0), Is.EqualTo(first.Clips(Sound.Swing, true, HitSfx.Light, 0)));
    }

    [Test] public void BankSpacesHitsByTwentyFiveMilliseconds()
    {
      double now = 0;
      var mixer = new SfxMixer(Rate);
      var bank = new SfxBank(new SfxSynth(Rate), mixer, () => now);
      bank.Hit(HitSfx.Light, 1, 0);
      int first = bank.LastRequest;
      now = 0.02;
      bank.Hit(HitSfx.Heavy, 2, 0);
      Assert.That(bank.LastRequest, Is.EqualTo(first), "a hit within 25 ms of the last is dropped");
      now = 0.026;
      bank.Hit(HitSfx.Heavy, 2, 0);
      Assert.That(bank.LastRequest, Is.GreaterThan(first));
      Assert.That(bank.LastSound, Is.EqualTo(Sound.Hit));
      bank.Swing(true);
      Assert.That(bank.LastSound, Is.EqualTo(Sound.Swing));
      bank.SetMusicLevel(0.14, 0.2);
      Assert.That(bank.MusicLevel, Is.EqualTo(0.14));
      Assert.Throws<ArgumentException>(() => new SfxBank(new SfxSynth(Rate), new SfxMixer(44100), () => 0));
    }
  }
}
