using System;
using System.Collections.Generic;

namespace Changshan.Feedback.Audio
{
  // The sound bus of src/audio/audio-engine.ts for pre-rendered mono sounds: each voice is panned with the
  // StereoPannerNode's equal-power law, summed into the sfx bus (gain 0.9), sent at 0.3 into the reverb, and the sfx
  // and reverb go through the master gain (0.8) into the dynamics compressor. The WebAudio ConvolverNode (a 2.6 s
  // noise impulse) and DynamicsCompressorNode have no Unity counterpart without mixer assets, so they are approximated
  // (Reverb, Compressor below; known difference, to be judged by ear).
  //
  // Threading: Play is called on the main thread; Render runs on the audio thread (or offline for recordings). Requests
  // and voice starts cross under a lock; nothing is allocated while rendering.
  public sealed class SfxMixer
  {
    public const double SfxGain = 0.9, ReverbSend = 0.3, MasterGain = 0.8;

    struct VoiceState
    {
      public float[] Clip;
      public int Position;
      public long Start; // absolute sample at which the clip starts; -1 = as soon as the next buffer begins
      public float GainL, GainR;
      public int Id;
      public bool Active, Started;
    }

    public readonly int Rate;
    readonly VoiceState[] voices;
    readonly List<VoiceState> pending = new List<VoiceState>();
    readonly List<VoiceState> drained = new List<VoiceState>();
    readonly object gate = new object();
    readonly Reverb reverbL, reverbR;
    readonly Compressor compressor;
    readonly (int Id, long Sample)[] starts = new (int, long)[1024];
    long startTotal;
    int nextId;
    long rendered;

    public SfxMixer(int sampleRate, int maxVoices = 96)
    {
      Rate = sampleRate;
      voices = new VoiceState[maxVoices];
      reverbL = new Reverb(sampleRate, 0);
      reverbR = new Reverb(sampleRate, 1);
      compressor = new Compressor(sampleRate);
    }

    // Samples rendered so far (the audio clock of this mixer).
    public long SamplesRendered
    {
      get { lock (gate) return rendered; }
    }

    public int ActiveVoices
    {
      get
      {
        lock (gate)
        {
          int n = pending.Count;
          foreach (var v in voices) if (v.Active) n++;
          return n;
        }
      }
    }

    // Queues a sound. atSample < 0 starts it with the next audio buffer (real time); otherwise at that absolute sample
    // (offline rendering). Returns the request id reported by TakeStarts.
    public int Play(float[] clip, double pan, double gain = 1, long atSample = -1)
    {
      if (clip == null) throw new ArgumentNullException(nameof(clip));
      // StereoPannerNode, mono input: x = (pan + 1) / 2, left cos(x pi / 2), right sin(x pi / 2).
      double x = (Math.Max(-1, Math.Min(1, pan)) + 1) / 2;
      lock (gate)
      {
        int id = ++nextId;
        pending.Add(new VoiceState
        {
          Clip = clip, Start = atSample, GainL = (float)(Math.Cos(x * Math.PI / 2) * gain), GainR = (float)(Math.Sin(x * Math.PI / 2) * gain),
          Id = id, Active = true,
        });
        return id;
      }
    }

    // Silences every voice and the reverb tail (a new fight).
    public void StopAll()
    {
      lock (gate)
      {
        pending.Clear();
        for (int i = 0; i < voices.Length; i++) voices[i].Active = false;
        reverbL.Clear();
        reverbR.Clear();
      }
    }

    // Voice starts since the last call: (request id, absolute sample where the clip's first sample played).
    public void TakeStarts(List<(int Id, long Sample)> into)
    {
      into.Clear();
      lock (gate)
      {
        long from = Math.Max(0, startTotal - starts.Length);
        for (long i = from; i < startTotal; i++) into.Add(starts[i % starts.Length]);
        startTotal = 0;
      }
    }

    // Adds `frames` frames of the bus output into an interleaved buffer with `channels` channels (the first two get
    // left and right; a mono buffer gets their average).
    public void Render(float[] data, int frames, int channels)
    {
      lock (gate)
      {
        drained.Clear();
        drained.AddRange(pending);
        pending.Clear();
        foreach (var v in drained)
        {
          int slot = FreeVoice();
          voices[slot] = v;
        }
        for (int f = 0; f < frames; f++)
        {
          long now = rendered + f;
          double l = 0, r = 0;
          for (int i = 0; i < voices.Length; i++)
          {
            ref var v = ref voices[i];
            if (!v.Active) continue;
            if (!v.Started)
            {
              if (v.Start >= 0 && now < v.Start) continue;
              v.Started = true;
              v.Start = now;
              starts[startTotal % starts.Length] = (v.Id, now);
              startTotal++;
            }
            float s = v.Clip[v.Position++];
            l += s * v.GainL;
            r += s * v.GainR;
            if (v.Position >= v.Clip.Length) v.Active = false;
          }
          l *= SfxGain;
          r *= SfxGain;
          double wl = reverbL.Process(l * ReverbSend), wr = reverbR.Process(r * ReverbSend);
          compressor.Process((l + wl) * MasterGain, (r + wr) * MasterGain, out double ol, out double or);
          if (channels == 1) data[f] += (float)((ol + or) / 2);
          else
          {
            data[f * channels] += (float)ol;
            data[f * channels + 1] += (float)or;
          }
        }
        rendered += frames;
      }
    }

    // A free slot, or the voice that started first when all are busy.
    int FreeVoice()
    {
      for (int i = 0; i < voices.Length; i++) if (!voices[i].Active) return i;
      int best = 0;
      for (int i = 1; i < voices.Length; i++) if (voices[i].Start < voices[best].Start) best = i;
      return best;
    }

    // The reverb send of one channel: an 8-line feedback delay network fed through two diffusing all-passes, with a
    // flat 2.3 s decay (the Web impulse falls by 60 dB at about 2.34 s of its 2.6 s) and no high-frequency damping (the
    // Web impulse is white). Its output is scaled so that its impulse response carries the energy of the Web impulse
    // after the ConvolverNode's normalisation (about 0.1645 per channel at 48 kHz).
    public sealed class Reverb
    {
      public const double DecaySeconds = 2.3, TargetEnergy = 0.1645;
      static readonly double[] LineMs = { 29.7, 33.1, 37.1, 41.1, 43.7, 47.9, 53.3, 59.9 };

      readonly float[][] lines;
      readonly int[] heads;
      readonly double[] feedback;
      readonly AllPass a1, a2;
      readonly double outGain;
      readonly double[] outs = new double[8], mixed = new double[8];

      public Reverb(int rate, int channel)
      {
        double spread = channel == 0 ? 1 : 1.071; // decorrelates left and right
        lines = new float[LineMs.Length][];
        heads = new int[LineMs.Length];
        feedback = new double[LineMs.Length];
        for (int i = 0; i < LineMs.Length; i++)
        {
          int n = Math.Max(1, (int)Math.Round(LineMs[i] * spread * rate / 1000));
          lines[i] = new float[n];
          feedback[i] = Math.Pow(10, -3.0 * n / (DecaySeconds * rate));
        }
        a1 = new AllPass((int)(rate * 0.0051 * spread), 0.6);
        a2 = new AllPass((int)(rate * 0.0017 * spread), 0.6);
        outGain = 1;
        // Calibrate: the energy of three seconds of impulse response.
        double energy = 0;
        for (int k = 0; k < rate * 3; k++)
        {
          double y = Process(k == 0 ? 1 : 0);
          energy += y * y;
        }
        outGain = Math.Sqrt(TargetEnergy / energy);
        Clear();
      }

      public void Clear()
      {
        foreach (var l in lines) Array.Clear(l, 0, l.Length);
        Array.Clear(heads, 0, heads.Length);
        a1.Clear();
        a2.Clear();
      }

      public double Process(double x)
      {
        double d = a2.Process(a1.Process(x));
        for (int i = 0; i < lines.Length; i++) outs[i] = lines[i][heads[i]];
        // 8x8 Hadamard mix (fast Walsh-Hadamard), normalised.
        double h0 = outs[0] + outs[1], h1 = outs[0] - outs[1], h2 = outs[2] + outs[3], h3 = outs[2] - outs[3];
        double h4 = outs[4] + outs[5], h5 = outs[4] - outs[5], h6 = outs[6] + outs[7], h7 = outs[6] - outs[7];
        double g0 = h0 + h2, g1 = h1 + h3, g2 = h0 - h2, g3 = h1 - h3, g4 = h4 + h6, g5 = h5 + h7, g6 = h4 - h6, g7 = h5 - h7;
        double s = 1 / Math.Sqrt(8);
        var m = mixed;
        m[0] = (g0 + g4) * s; m[1] = (g1 + g5) * s; m[2] = (g2 + g6) * s; m[3] = (g3 + g7) * s;
        m[4] = (g0 - g4) * s; m[5] = (g1 - g5) * s; m[6] = (g2 - g6) * s; m[7] = (g3 - g7) * s;
        double y = 0;
        for (int i = 0; i < lines.Length; i++)
        {
          y += outs[i];
          lines[i][heads[i]] = (float)((m[i] + d) * feedback[i]);
          if (++heads[i] >= lines[i].Length) heads[i] = 0;
        }
        return y * outGain;
      }

      sealed class AllPass
      {
        readonly float[] buffer;
        readonly double g;
        int head;
        public AllPass(int length, double g)
        {
          buffer = new float[Math.Max(1, length)];
          this.g = g;
        }
        public void Clear()
        {
          Array.Clear(buffer, 0, buffer.Length);
          head = 0;
        }
        public double Process(double x)
        {
          double delayed = buffer[head];
          double v = x + g * delayed;
          buffer[head] = (float)v;
          if (++head >= buffer.Length) head = 0;
          return delayed - g * v;
        }
      }
    }

    // DynamicsCompressorNode with audio-engine.ts's settings (threshold -16 dB, knee 12 dB, ratio 4, attack 3 ms,
    // release 250 ms): a stereo-linked soft-knee compressor with Chromium's 6 ms look-ahead and its automatic make-up
    // gain ((1 / curve(0 dBFS)) ^ 0.6). Chromium's adaptive release and exact knee shape are not reproduced.
    public sealed class Compressor
    {
      public const double Threshold = -16, Knee = 12, Ratio = 4, Attack = 0.003, Release = 0.25, LookAhead = 0.006;

      readonly float[] delayL, delayR;
      readonly double attackCoef, releaseCoef, makeup;
      int head;
      double reduction; // dB, <= 0

      public Compressor(int rate)
      {
        int n = Math.Max(1, (int)Math.Round(LookAhead * rate));
        delayL = new float[n];
        delayR = new float[n];
        attackCoef = Math.Exp(-1 / (Attack * rate));
        releaseCoef = Math.Exp(-1 / (Release * rate));
        makeup = Math.Pow(10, -Curve(0) * 0.6 / 20);
      }

      public double MakeupDb => -Curve(0) * 0.6;

      // The static curve: output level (dB) for an input level (dB).
      public static double Curve(double x)
      {
        double over = x - Threshold;
        if (2 * over < -Knee) return x;
        if (2 * Math.Abs(over) <= Knee)
        {
          double k = over + Knee / 2;
          return x + (1 / Ratio - 1) * k * k / (2 * Knee);
        }
        return Threshold + over / Ratio;
      }

      public void Process(double l, double r, out double outL, out double outR)
      {
        double peak = Math.Max(Math.Abs(l), Math.Abs(r));
        double level = peak > 1e-9 ? 20 * Math.Log10(peak) : -180;
        double target = Curve(level) - level;
        double coef = target < reduction ? attackCoef : releaseCoef;
        reduction = target + (reduction - target) * coef;
        double gain = Math.Pow(10, reduction / 20) * makeup;
        outL = delayL[head] * gain;
        outR = delayR[head] * gain;
        delayL[head] = (float)l;
        delayR[head] = (float)r;
        if (++head >= delayL.Length) head = 0;
      }
    }
  }
}
