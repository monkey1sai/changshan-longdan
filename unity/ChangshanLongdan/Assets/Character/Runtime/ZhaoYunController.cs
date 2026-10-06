using System;
using System.Globalization;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // Drives the character root from Changshan.Combat: raw input -> InputMapper -> camera-relative controls ->
  // CombatSimulation (clock, player, hits on the scene's training dummies). The logic position is the only
  // displacement authority; the transform just displays it. The pose the scene gives the root becomes the logic start.
  [DisallowMultipleComponent]
  public sealed class ZhaoYunController : MonoBehaviour
  {
    public const double MaxFrameSeconds = GameClock.MaxFrameSeconds; // same cap as the Web main loop

    readonly InputMapper mapper = new InputMapper();
    bool initialised;
    ZhaoYunCharacter character;
    GameObject failedModel;
    GUIStyle hudStyle;

    public CombatSimulation Simulation { get; private set; }
    public PlayerDriver Driver => Simulation.Driver;
    public TrainingDummies Dummies { get; private set; }
    public LogicDisplayMapping Mapping { get; private set; }
    public IRawInputSource InputSource { get; set; }
    public Camera ViewCamera { get; set; }
    public bool Paused { get; private set; }
    // Scripted route recording: input is scripted, so losing the window focus must not pause or blur (RouteRecorder).
    public bool IgnoreFocusLoss { get; set; }
    public bool ShowDebug { get; set; } = true; // F3 toggles
    public string LastHit { get; private set; } = "-"; // last feedback event, for the HUD

    // The shake component on the view camera (added on first use; null without a camera).
    public CameraShake Shake
    {
      get
      {
        if (shake != null) return shake;
        var view = ViewCamera != null ? ViewCamera : Camera.main;
        if (view == null) return null;
        shake = view.GetComponent<CameraShake>();
        if (shake == null) shake = view.gameObject.AddComponent<CameraShake>();
        return shake;
      }
    }
    CameraShake shake;
    public InputFrame LastInput { get; private set; }
    public CharacterAnimation Animation { get; } = new CharacterAnimation();

    void Awake() => Initialise();

    void Initialise()
    {
      if (initialised) return;
      initialised = true;
      Mapping = new LogicDisplayMapping(transform.position, transform.eulerAngles.y, ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
      character = GetComponent<ZhaoYunCharacter>();
      var found = FindObjectsByType<TrainingDummies>();
      Build(found.Length > 0 ? found[0] : null);
      if (InputSource == null) InputSource = new LegacyInputSource();
    }

    // Uses these dummies (or none) as the hit targets and restarts the fight.
    public void UseDummies(TrainingDummies dummies)
    {
      Initialise();
      Build(dummies);
    }

    void Build(TrainingDummies dummies)
    {
      Dummies = dummies;
      var targets = new HitTargets(dummies != null ? dummies.Dummies.Count : 0);
      Simulation = new CombatSimulation(targets);
      ResetFight();
    }

    void Update()
    {
      Tick(Time.unscaledDeltaTime);
      if (Paused) return;
      if (Input.GetKeyDown(KeyCode.F4)) InjectStrike(false);
      if (Input.GetKeyDown(KeyCode.F5)) InjectStrike(true);
    }

    // One frame: read input, then simulate unless paused. Public so tests can step deterministically.
    public void Tick(double frameSeconds)
    {
      Initialise();
      if (Paused) return;
      double dt = Math.Min(MaxFrameSeconds, frameSeconds);
      InputSource.Feed(mapper);
      LastInput = mapper.Poll(dt);
      if (LastInput.Debug) ShowDebug = !ShowDebug;
      var controls = ControlComposer.Compose(LastInput, CameraYaw());
      Simulation.Step(dt, controls);
      Feedback();
      if (Dummies != null) Dummies.Show(Simulation.Targets, Mapping);
      ApplyTransform();
      Animate();
    }

    // E07: the presentation side of this frame's events (src/presentation.ts): camera trauma and kick for hits and
    // hurts, the musou start and a heavy landing. Sparks, dust, fragments and audio are not ported yet (see E07 doc).
    void Feedback()
    {
      var shake = Shake;
      foreach (var e in Simulation.Events)
      {
        switch (e.Type)
        {
          case CombatEventType.Hit when e.Source == HitSource.Player:
            LastHit = $"{e.Window.Sfx} x{e.Count} shake {e.Window.Shake:0.00}";
            if (shake != null)
            {
              shake.AddTrauma(e.Window.Shake * (e.Count > 3 ? 1.15 : 1));
              if (e.Window.Sfx == HitSfx.Heavy) shake.Kick(0.5);
            }
            break;
          case CombatEventType.Hurt:
            LastHit = e.Heavy ? "hurt (heavy)" : "hurt";
            if (shake != null) shake.AddTrauma(e.Heavy ? 0.45 : 0.25);
            break;
          case CombatEventType.Parry: LastHit = "parry"; break;
          case CombatEventType.GuardBlock: LastHit = $"guard block {e.Damage:0.0}"; break;
          case CombatEventType.Kill: LastHit = $"kill x{e.Count}"; break;
        }
      }
      foreach (var e in Simulation.Player.Events)
      {
        if (shake == null) break;
        if (e.Type == PlayerEventType.MusouStart) shake.AddTrauma(0.35);
        else if (e.Type == PlayerEventType.Land && e.Heavy) shake.AddTrauma(0.15);
      }
    }

    // Dev and tests until the AI (E08) attacks: one enemy strike from 2 m in front of the player (F4 light, F5 heavy).
    public void InjectStrike(bool heavy)
    {
      Initialise();
      var p = Simulation.Player;
      double x = p.X + Math.Sin(p.Facing) * 2, z = p.Z + Math.Cos(p.Facing) * 2;
      Simulation.InjectStrike(new EnemyStrike(heavy ? 70 : 26, heavy, x, z));
      Feedback();
    }

    // E06: the Web procedural rig poses the imported model once it is READY; until then the fallback stays visible.
    void Animate()
    {
      if (character != null && character.Status == CharacterLoadStatus.Ready && character.Model != null &&
          character.Model != Animation.BoundModel && character.Model != failedModel)
      {
        try
        {
          Animation.Bind(character.Model);
        }
        catch (Exception exception)
        {
          failedModel = character.Model;
          Animation.Unbind();
          Debug.LogError("CHARACTER_ANIMATION_BIND_FAILED " + exception.Message);
        }
      }
      var clock = Simulation.Clock;
      Animation.Step(Simulation.Player, clock.LastSimDt, clock.SimTime, Mapping);
    }

    // Focus loss behaves like the Web blur: held keys and pending presses are dropped and simulation stops.
    // Unlike the Web there is no pause menu yet, so simulation resumes when focus returns.
    public void SetFocus(bool focused)
    {
      Initialise();
      if (!focused && IgnoreFocusLoss) return;
      if (!focused)
      {
        mapper.Blur();
        Simulation.Interrupt();
      }
      Paused = !focused;
    }

    void OnApplicationFocus(bool focused) => SetFocus(focused);

    void OnApplicationPause(bool paused)
    {
      if (paused) SetFocus(false);
    }

    // Back to the start pose with every dummy restored; the same Player instance is kept.
    public void Restart()
    {
      Initialise();
      mapper.Blur();
      ResetFight();
    }

    void ResetFight()
    {
      var targets = Simulation.Targets;
      targets.Clear();
      if (Dummies != null) Dummies.Fill(targets, Mapping);
      Simulation.Restart();
      Animation.Reset();
      ApplyTransform();
    }

    double CameraYaw()
    {
      var view = ViewCamera != null ? ViewCamera : Camera.main;
      if (view == null) return Mapping.ToLogicYaw(transform.forward);
      var forward = view.transform.forward;
      forward.y = 0;
      // Looking straight down: use the camera's up vector, which then points away from the viewer.
      if (forward.sqrMagnitude < 1e-8f) forward = view.transform.up;
      return Mapping.ToLogicYaw(forward);
    }

    void ApplyTransform()
    {
      var p = Simulation.Player;
      transform.SetPositionAndRotation(Mapping.ToDisplayPosition(p.X, p.Y, p.Z), Mapping.ToDisplayRotation(p.Facing));
    }

    // Debug readout until E06/E07 give moves and hits visible animation and effects.
    void OnGUI()
    {
      if (!ShowDebug || Simulation == null) return;
      if (hudStyle == null) hudStyle = new GUIStyle(GUI.skin.label) { fontSize = 24 };
      var p = Simulation.Player;
      string move = p.Move == null ? "-" : p.Move.Id.ToString();
      string text = string.Format(CultureInfo.InvariantCulture,
        "State {0}  Move {1} {2:0.00}s  Musou {3:0}  HP {8:0}\nHits {4}  KO {9}  Hit-stop {5:0.000}s  Dummies {6}/{7}\nLast {10}  (F3 hides, F4/F5 strike)",
        p.State, move, p.MoveTime, p.Musou, Simulation.TotalHits, Math.Max(0, Simulation.Clock.Hitstop),
        Simulation.Targets.AliveCount, Simulation.Targets.Count, p.Hp, Simulation.KoCount, LastHit);
      GUI.Box(new UnityEngine.Rect(50, 300, 1000, 120), "");
      GUI.Label(new UnityEngine.Rect(75, 310, 950, 110), text, hudStyle);
    }
  }
}
