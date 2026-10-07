using Changshan.Combat;

namespace Changshan.Feedback
{
  // An HDR colour in the Web's linear working space (three.js Color).
  public readonly struct Rgb
  {
    public readonly double R, G, B;
    public Rgb(double r, double g, double b) { R = r; G = g; B = b; }
  }

  // The outputs src/presentation.ts drives (PresentationSinks), each limited to what it calls. Logic coordinates.
  public interface ISfxSink
  {
    void Swing(bool heavy);
    void Jump();
    void Land(bool heavy);
    void Dodge();
    void Hit(HitSfx kind, int count, double pan);
    void Shatter(int count, double pan);
    void EnemySwing(double pan);
    void PlayerHurt(bool heavy);
    void MusouStart();
    void MusouBlast();
    void MusouReady();
    void SetMusicLevel(double level, double seconds);
  }

  public interface ISparkSink
  {
    void Burst(double x, double y, double z, double dirX, double dirZ, int n, bool heavy, Mulberry32 rng);
  }

  public interface IDustSink
  {
    void Puff(double x, double y, double z, int n, double speed, Mulberry32 rng);
    void Ring(double x, double z, double radius, int n, Mulberry32 rng);
  }

  public interface IWaveSink
  {
    void Ring(double x, double z, double radius, double duration, Rgb color);
    void Pillar(double x, double z, double radius, double height, double duration, Rgb color);
  }

  public interface IFragmentSink
  {
    void SpawnSoldier(in KillInfo kill, Mulberry32 rng);
  }

  // The camera: shake, and where the listener is for the sound pan (camera position and right vector, logic space).
  public interface ICameraSink
  {
    void AddTrauma(double amount);
    void Kick(double amount);
    double PositionX { get; }
    double PositionZ { get; }
    double RightX { get; }
    double RightZ { get; }
  }

  // Post-processing settings the presentation raises (they decay elsewhere). Not rendered in Unity yet: the values are
  // kept for the trace.
  public interface IPostSink
  {
    double Aberration { get; set; }
    double Radial { get; set; }
    double Flash { get; set; }
  }

  public enum Banner { MusouReady }

  public interface IHudSink
  {
    void ShowBanner(Banner banner, double seconds, bool gold);
    void PlayCutin();
  }

  public sealed class FeedbackSinks
  {
    public ISfxSink Audio; // null: no sound (the Web before the first gesture)
    public ISparkSink Sparks;
    public IDustSink Dust;
    public IWaveSink Waves;
    public IFragmentSink Fragments;
    public ICameraSink Camera;
    public IPostSink Post;
    public IHudSink Hud;
  }

  // Keeps the post values without rendering them; Decay is game.ts's per-frame damping toward zero.
  public sealed class PostValues : IPostSink
  {
    public double Aberration { get; set; }
    public double Radial { get; set; }
    public double Flash { get; set; }

    public void Decay(double realDt)
    {
      Flash = Damp(Flash, 9, realDt);
      Aberration = Damp(Aberration, 7, realDt);
      Radial = Damp(Radial, 5, realDt);
    }

    public void Clear() => Aberration = Radial = Flash = 0;

    // math.ts damp(a, 0, lambda, dt).
    static double Damp(double a, double lambda, double dt) => a + (0 - a) * (1 - System.Math.Exp(-lambda * dt));
  }
}
