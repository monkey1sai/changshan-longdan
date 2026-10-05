using System;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // Drives the character root from Changshan.Combat: raw input -> InputMapper -> camera-relative controls ->
  // PlayerDriver. The logic position is the only displacement authority; the transform just displays it.
  // The pose the scene gives the root becomes the logic start point (ArenaLayout start).
  [DisallowMultipleComponent]
  public sealed class ZhaoYunController : MonoBehaviour
  {
    public const double MaxFrameSeconds = 0.05; // same cap as the Web main loop

    readonly InputMapper mapper = new InputMapper();
    bool initialised;

    public PlayerDriver Driver { get; private set; }
    public LogicDisplayMapping Mapping { get; private set; }
    public IRawInputSource InputSource { get; set; }
    public Camera ViewCamera { get; set; }
    public bool Paused { get; private set; }
    public InputFrame LastInput { get; private set; }

    void Awake() => Initialise();

    void Initialise()
    {
      if (initialised) return;
      initialised = true;
      Mapping = new LogicDisplayMapping(transform.position, transform.eulerAngles.y, ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
      Driver = new PlayerDriver(new Player(), ArenaLayout.CreateArena());
      Driver.Restart();
      if (InputSource == null) InputSource = new LegacyInputSource();
      ApplyTransform();
    }

    void Update() => Tick(Time.unscaledDeltaTime);

    // One frame: read input, then simulate unless paused. Public so tests can step deterministically.
    public void Tick(double frameSeconds)
    {
      Initialise();
      if (Paused) return;
      double dt = Math.Min(MaxFrameSeconds, frameSeconds);
      InputSource.Feed(mapper);
      LastInput = mapper.Poll(dt);
      var controls = ControlComposer.Compose(LastInput, CameraYaw());
      Driver.Step(dt, controls);
      ApplyTransform();
    }

    // Focus loss behaves like the Web blur: held keys and pending presses are dropped and simulation stops.
    // Unlike the Web there is no pause menu yet, so simulation resumes when focus returns.
    public void SetFocus(bool focused)
    {
      Initialise();
      if (!focused)
      {
        mapper.Blur();
        Driver.Interrupt();
      }
      Paused = !focused;
    }

    void OnApplicationFocus(bool focused) => SetFocus(focused);

    void OnApplicationPause(bool paused)
    {
      if (paused) SetFocus(false);
    }

    public void Restart()
    {
      Initialise();
      mapper.Blur();
      Driver.Restart();
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
      var p = Driver.Player;
      transform.SetPositionAndRotation(Mapping.ToDisplayPosition(p.X, p.Y, p.Z), Mapping.ToDisplayRotation(p.Facing));
    }
  }
}
