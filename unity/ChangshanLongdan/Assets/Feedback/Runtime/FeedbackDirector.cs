using System;
using System.Collections.Generic;
using Changshan.Combat;

namespace Changshan.Feedback
{
  // Port of src/presentation.ts Presentation for the events E07 has: turns one step's events into sound, particles,
  // camera shake, post values and HUD notices, without changing the fight. The particles draw from one shared
  // generator seeded like game.ts (createRng(99)) in the same order. The dragon (dragonFrame), combo, milestones,
  // battle phases and the outcome are not ported.
  public sealed class FeedbackDirector
  {
    public const double MusicLevel = 0.42; // presentation.ts MUSIC_LEVEL
    public const uint Seed = 99; // game.ts: createRng(99)
    public static readonly Rgb Shock = new Rgb(3.2, 2.2, 1.2);
    public static readonly Rgb Gold = new Rgb(5, 3.4, 1.1);
    public static readonly Rgb White = new Rgb(6, 6, 5);

    readonly FeedbackSinks sinks;
    bool wasMusou;

    public Mulberry32 Rng { get; }

    public FeedbackDirector(FeedbackSinks sinks, Mulberry32 rng = null)
    {
      this.sinks = sinks ?? throw new ArgumentNullException(nameof(sinks));
      if (sinks.Sparks == null || sinks.Dust == null || sinks.Waves == null || sinks.Fragments == null || sinks.Camera == null ||
          sinks.Post == null || sinks.Hud == null) throw new ArgumentException("FEEDBACK_SINK_MISSING", nameof(sinks));
      Rng = rng ?? new Mulberry32(Seed);
    }

    // A new fight (Presentation.reset; the generator is not reseeded, like game.ts).
    public void Reset() => wasMusou = false;

    public void Play(IReadOnlyList<FeedbackEvent> events, IFeedbackSource battle)
    {
      var s = sinks;
      var audio = s.Audio;
      var rng = Rng;
      double px = battle.PlayerX, py = battle.PlayerY, pz = battle.PlayerZ;
      for (int n = 0; n < events.Count; n++)
      {
        var e = events[n];
        switch (e.Type)
        {
          case FeedbackEventType.Swing:
            audio?.Swing(e.Heavy);
            break;
          case FeedbackEventType.Jump:
            audio?.Jump();
            break;
          case FeedbackEventType.Land:
            audio?.Land(e.Heavy);
            s.Dust.Puff(px, 0, pz, e.Heavy ? 16 : 8, e.Heavy ? 5 : 3, rng);
            if (e.Heavy) s.Camera.AddTrauma(0.15);
            break;
          case FeedbackEventType.Dodge:
            audio?.Dodge();
            s.Dust.Puff(px, 0, pz, 6, 2.5, rng);
            break;
          case FeedbackEventType.MusouStart:
            s.Hud.PlayCutin();
            audio?.MusouStart();
            audio?.SetMusicLevel(0.14, 0.2);
            s.Camera.AddTrauma(0.35);
            s.Post.Radial = 1;
            break;
          case FeedbackEventType.Fx:
            GroundFx(e.Fx, e.X, e.Z, e.Radius, battle.PlayerFacing);
            break;
          case FeedbackEventType.Hit:
          {
            var win = e.Window;
            bool heavy = win.Sfx == HitSfx.Heavy;
            s.Camera.AddTrauma(win.Shake * (e.Count > 3 ? 1.15 : 1));
            if (heavy)
            {
              s.Camera.Kick(0.5);
              s.Post.Aberration = Math.Max(s.Post.Aberration, 0.8);
            }
            var hits = battle.Hits;
            for (int i = e.Start; i < e.Start + e.Count; i++)
            {
              var h = hits[i];
              s.Sparks.Burst(h.X, h.Y + 1.1, h.Z, h.DirX, h.DirZ, heavy ? 12 : 7, heavy, rng);
            }
            var first = hits[e.Start];
            audio?.Hit(win.Sfx, e.Count, Pan(first.X, first.Z));
            break;
          }
          case FeedbackEventType.Kill:
          {
            var kills = battle.Kills;
            for (int i = e.Start; i < e.Start + e.Count; i++)
            {
              var k = kills[i];
              s.Fragments.SpawnSoldier(k, rng);
              s.Dust.Puff(k.X, 0, k.Z, 3, 2.5, rng);
            }
            var first = kills[e.Start];
            audio?.Shatter(e.Count, Pan(first.X, first.Z));
            break;
          }
          case FeedbackEventType.EnemyStrike:
            audio?.EnemySwing(Pan(e.X, e.Z));
            break;
          case FeedbackEventType.Parry:
          case FeedbackEventType.GuardBlock:
          {
            bool perfect = e.Type == FeedbackEventType.Parry;
            audio?.Hit(HitSfx.Pierce, 1, Pan(e.X, e.Z));
            s.Sparks.Burst(px, py + 1.2, pz, Math.Sin(e.Facing), Math.Cos(e.Facing), perfect ? 18 : 6, perfect, rng);
            s.Camera.AddTrauma(perfect ? 0.12 : 0.04);
            if (perfect) s.Waves.Ring(px, pz, 2.4, 0.3, White);
            break;
          }
          case FeedbackEventType.Hurt:
          {
            audio?.PlayerHurt(e.Heavy);
            s.Camera.AddTrauma(e.Heavy ? 0.45 : 0.25);
            double dx = px - e.X, dz = pz - e.Z;
            double d = Hypot(dx, dz);
            if (d == 0) d = 1;
            s.Sparks.Burst(px, py + 1.2, pz, dx / d, dz / d, 6, e.Heavy, rng);
            break;
          }
          case FeedbackEventType.MusouReady:
            audio?.MusouReady();
            s.Hud.ShowBanner(Banner.MusouReady, 1.4, true);
            break;
        }
      }
    }

    // Once a frame (Presentation.musouState): when the musou ends while the fight goes on, the music comes back.
    public void MusouState(bool musou, bool playing)
    {
      if (wasMusou && !musou && playing) sinks.Audio?.SetMusicLevel(MusicLevel, 1);
      wasMusou = musou;
    }

    void GroundFx(HitFx fx, double x, double z, double radius, double facing)
    {
      var s = sinks;
      if (fx == HitFx.Shockwave)
      {
        s.Waves.Ring(x, z, radius * 1.1, 0.45, Shock);
        s.Dust.Ring(x, z, radius, 26, Rng);
        s.Camera.AddTrauma(0.3);
        s.Post.Radial = Math.Max(s.Post.Radial, 0.5);
        return;
      }
      if (fx != HitFx.Blast) return;
      // The musou finale: the dragon hits the ground 6 m in front of Zhao Yun.
      double fxX = x + Math.Sin(facing) * 6;
      double fxZ = z + Math.Cos(facing) * 6;
      s.Waves.Ring(fxX, fxZ, 12, 0.8, Gold);
      s.Waves.Ring(fxX, fxZ, 6, 0.5, White);
      s.Waves.Pillar(fxX, fxZ, 3, 34, 0.9, Gold);
      s.Dust.Ring(fxX, fxZ, 9, 56, Rng);
      s.Audio?.MusouBlast();
      s.Post.Flash = 0.5;
      s.Post.Radial = 1;
      s.Camera.AddTrauma(1);
      s.Camera.Kick(1);
    }

    // The pan from where the sound is relative to the camera's right (presentation.ts pan).
    public double Pan(double x, double z)
    {
      var c = sinks.Camera;
      double v = ((x - c.PositionX) * c.RightX + (z - c.PositionZ) * c.RightZ) / 12;
      return Math.Max(-1, Math.Min(1, v)) * 0.7;
    }

    // Math.hypot of two finite values, as V8 computes it for the hurt direction (sqrt of the sum of squares after scaling).
    static double Hypot(double a, double b)
    {
      a = Math.Abs(a);
      b = Math.Abs(b);
      double max = Math.Max(a, b);
      if (max == 0) return 0;
      double ra = a / max, rb = b / max;
      return Math.Sqrt(ra * ra + rb * rb) * max;
    }
  }
}
