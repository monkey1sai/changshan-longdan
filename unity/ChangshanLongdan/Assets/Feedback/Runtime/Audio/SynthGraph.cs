using System;
using System.Collections.Generic;

namespace Changshan.Feedback.Audio
{
  // An offline imitation of the WebAudio nodes src/audio/audio-engine.ts builds (buffer and oscillator sources, biquad
  // filters, wave shaper, gain envelopes), following the Web Audio API specification's formulas so the sounds keep their
  // timbre and timing. Rendered once into mono buffers; nothing here runs on the audio thread.

  // AudioParam automation: setValueAtTime, linearRampToValueAtTime and exponentialRampToValueAtTime, evaluated per
  // sample as the specification defines (a ramp starts at the previous event's time and value).
  public sealed class ParamCurve
  {
    enum Kind { Set, Linear, Exponential }

    readonly double defaultValue;
    readonly List<(Kind Kind, double Time, double Value)> events = new List<(Kind, double, double)>();

    public ParamCurve(double defaultValue) => this.defaultValue = defaultValue;

    public ParamCurve Set(double value, double time) => Add(Kind.Set, time, value);
    public ParamCurve LinearTo(double value, double time) => Add(Kind.Linear, time, value);
    public ParamCurve ExpTo(double value, double time) => Add(Kind.Exponential, time, value);

    ParamCurve Add(Kind kind, double time, double value)
    {
      int i = events.Count;
      while (i > 0 && events[i - 1].Time > time) i--;
      events.Insert(i, (kind, time, value));
      return this;
    }

    public double At(double t)
    {
      double prevTime = 0, prevValue = defaultValue;
      for (int i = 0; i < events.Count; i++)
      {
        var e = events[i];
        if (t < e.Time)
        {
          if (e.Kind == Kind.Set) return prevValue;
          double u = e.Time > prevTime ? (t - prevTime) / (e.Time - prevTime) : 1;
          if (u < 0) return prevValue;
          if (e.Kind == Kind.Linear) return prevValue + (e.Value - prevValue) * u;
          // Exponential: undefined for a zero or sign change (the engine never does that); hold the previous value then.
          if (prevValue == 0 || prevValue * e.Value <= 0) return prevValue;
          return prevValue * Math.Pow(e.Value / prevValue, u);
        }
        prevTime = e.Time;
        prevValue = e.Value;
      }
      return prevValue;
    }
  }

  // A node pulled once per output sample (sample index k, time k / rate).
  public abstract class SynthNode
  {
    public abstract double Next(int k, double t);
  }

  // A node read by several others (fan-out): computes each sample once.
  public sealed class Shared : SynthNode
  {
    readonly SynthNode input;
    int lastK = -1;
    double last;
    public Shared(SynthNode input) => this.input = input;
    public override double Next(int k, double t)
    {
      if (k != lastK)
      {
        last = input.Next(k, t);
        lastK = k;
      }
      return last;
    }
  }

  // AudioBufferSourceNode over the engine's looping white-noise buffer, started at `start` from `offset` seconds.
  public sealed class NoiseSource : SynthNode
  {
    readonly float[] buffer;
    readonly double rate, start, stop, offset;

    public NoiseSource(float[] buffer, double rate, double start, double duration, double offset)
    {
      this.buffer = buffer;
      this.rate = rate;
      this.start = start;
      stop = start + duration + 0.05;
      this.offset = offset;
    }

    public override double Next(int k, double t)
    {
      if (t < start || t >= stop) return 0;
      double pos = (t - start + offset) * rate;
      long i = (long)Math.Floor(pos) % buffer.Length;
      return buffer[i];
    }
  }

  public enum Wave { Sine, Square, Sawtooth, Triangle }

  // OscillatorNode with a frequency automation. Sawtooth and square are band-limited (PolyBLEP) like WebAudio's
  // periodic waves; every wave starts at the same phase as WebAudio's (crossing zero upward at t = start).
  public sealed class Oscillator : SynthNode
  {
    readonly Wave wave;
    readonly double rate, start, stop;
    public readonly ParamCurve Frequency;
    public SynthNode FrequencyMod; // an input added to the frequency (unused by the ported sounds)
    double phase; // cycles, 0..1

    public Oscillator(Wave wave, double frequency, double rate, double start, double duration)
    {
      this.wave = wave;
      this.rate = rate;
      this.start = start;
      stop = start + duration + 0.05;
      Frequency = new ParamCurve(440).Set(frequency, start);
    }

    public override double Next(int k, double t)
    {
      if (t < start || t >= stop) return 0;
      double f = Frequency.At(t) + (FrequencyMod?.Next(k, t) ?? 0);
      double dt = Math.Min(0.5, Math.Abs(f) / rate);
      double p = phase;
      double v;
      switch (wave)
      {
        case Wave.Sine: v = Math.Sin(2 * Math.PI * p); break;
        case Wave.Sawtooth:
        {
          double q = p + 0.5;
          if (q >= 1) q -= 1;
          v = 2 * q - 1 - PolyBlep(q, dt);
          break;
        }
        case Wave.Square:
          v = (p < 0.5 ? 1 : -1) + PolyBlep(p, dt) - PolyBlep(p + 0.5 >= 1 ? p - 0.5 : p + 0.5, dt);
          break;
        case Wave.Triangle:
          // Its harmonics fall as 1/k^2, so the naive shape is close to the band-limited one: 0 rising, peak at 1/4.
          v = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
          break;
        default: throw new InvalidOperationException();
      }
      phase += f / rate;
      phase -= Math.Floor(phase);
      return v;
    }

    static double PolyBlep(double t, double dt)
    {
      if (dt <= 0) return 0;
      if (t < dt)
      {
        t /= dt;
        return t + t - t * t - 1;
      }
      if (t > 1 - dt)
      {
        t = (t - 1) / dt;
        return t * t + t + t + 1;
      }
      return 0;
    }
  }

  public enum FilterType { Lowpass, Highpass, Bandpass }

  // BiquadFilterNode (Web Audio API specification coefficients; lowpass/highpass Q is in dB, bandpass Q is linear),
  // with the cutoff automated per sample.
  public sealed class Biquad : SynthNode
  {
    readonly SynthNode input;
    readonly FilterType type;
    readonly double rate, q;
    public readonly ParamCurve Frequency;
    double x1, x2, y1, y2;

    public Biquad(SynthNode input, FilterType type, double frequency, double q, double rate, double now)
    {
      this.input = input;
      this.type = type;
      this.q = q;
      this.rate = rate;
      Frequency = new ParamCurve(350).Set(frequency, now);
    }

    public override double Next(int k, double t)
    {
      double x = input.Next(k, t);
      double f0 = Math.Max(0, Math.Min(rate / 2, Frequency.At(t)));
      double w0 = 2 * Math.PI * f0 / rate;
      double cos = Math.Cos(w0), sin = Math.Sin(w0);
      double b0, b1, b2, a0, a1, a2;
      switch (type)
      {
        case FilterType.Lowpass:
        {
          double alpha = sin / (2 * Math.Pow(10, q / 20));
          b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
          a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
          break;
        }
        case FilterType.Highpass:
        {
          double alpha = sin / (2 * Math.Pow(10, q / 20));
          b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
          a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
          break;
        }
        default:
        {
          double alpha = sin / (2 * q);
          b0 = alpha; b1 = 0; b2 = -alpha;
          a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
          break;
        }
      }
      double y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x;
      y2 = y1; y1 = y;
      return y;
    }
  }

  // WaveShaperNode without oversampling: the curve indexed by the input over [-1, 1], linearly interpolated.
  public sealed class Shaper : SynthNode
  {
    readonly SynthNode input;
    readonly float[] curve;

    public Shaper(SynthNode input, float[] curve)
    {
      this.input = input;
      this.curve = curve;
    }

    public override double Next(int k, double t)
    {
      double x = input.Next(k, t);
      int n = curve.Length;
      double v = (n - 1) / 2.0 * (x + 1);
      if (v <= 0) return curve[0];
      if (v >= n - 1) return curve[n - 1];
      int i = (int)Math.Floor(v);
      double f = v - i;
      return (1 - f) * curve[i] + f * curve[i + 1];
    }
  }

  // GainNode with an automated gain (default 1), summing all its inputs.
  public sealed class Gain : SynthNode
  {
    readonly SynthNode[] inputs;
    public readonly ParamCurve Value;

    public Gain(ParamCurve value, params SynthNode[] inputs)
    {
      Value = value;
      this.inputs = inputs;
    }

    public override double Next(int k, double t)
    {
      double sum = 0;
      foreach (var i in inputs) sum += i.Next(k, t);
      return sum * Value.At(t);
    }
  }

  // Several chains into one output.
  public sealed class Mix : SynthNode
  {
    readonly List<SynthNode> inputs = new List<SynthNode>();
    public void Add(SynthNode node) => inputs.Add(node);
    public override double Next(int k, double t)
    {
      double sum = 0;
      for (int i = 0; i < inputs.Count; i++) sum += inputs[i].Next(k, t);
      return sum;
    }
  }
}
