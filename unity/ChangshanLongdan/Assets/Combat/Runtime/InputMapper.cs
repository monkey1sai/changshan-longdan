using System;
using System.Collections.Generic;

namespace Changshan.Combat
{
  // Movement is camera-relative: X right, Y forward. Buttons other than Guard mean "pressed this frame".
  public struct InputFrame
  {
    public double MoveX;
    public double MoveY;
    public double CamTurn;
    public double Zoom;
    public bool Attack;
    public bool Charge;
    public bool Jump;
    public bool Dodge;
    public bool Musou;
    public bool Guard;
    public bool Recenter;
    public bool Pause;
    public bool Confirm;
    public bool Debug;
  }

  // Keyboard and mouse part of src/core/input.ts, fed with Web KeyboardEvent.code names so both share one mapping.
  // Gamepad support is deferred. DOM-only behaviour (focused form controls, preventDefault) has no Unity counterpart.
  public sealed class InputMapper
  {
    enum Action { Attack, Charge, Jump, Dodge, Musou, Pause, Confirm, Debug, Recenter }

    public const double AttackRepeatInterval = 0.18;
    public const double ChargeRepeatHold = 0.48;

    static readonly Dictionary<string, Action> keyActions = new Dictionary<string, Action>
    {
      ["KeyJ"] = Action.Attack, ["KeyK"] = Action.Charge, ["KeyL"] = Action.Musou, ["Space"] = Action.Jump,
      ["ShiftLeft"] = Action.Dodge, ["ShiftRight"] = Action.Dodge, ["Escape"] = Action.Pause, ["KeyP"] = Action.Pause,
      ["Enter"] = Action.Confirm, ["F3"] = Action.Debug, ["KeyR"] = Action.Recenter,
    };

    // Every code the game reacts to; a raw input source only needs to report these.
    public static readonly IReadOnlyList<string> GameKeys = new List<string>(keyActions.Keys)
    {
      "KeyF", "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    };

    readonly HashSet<string> held = new HashSet<string>();
    readonly bool[] pressed = new bool[Enum.GetValues(typeof(Action)).Length];
    double wheel;
    bool mouseAttack;
    double attackRepeat;

    public void KeyDown(string code, bool repeat = false)
    {
      if (code == null) throw new ArgumentNullException(nameof(code));
      held.Add(code);
      if (repeat) return;
      if (keyActions.TryGetValue(code, out var action)) pressed[(int)action] = true;
    }

    public void KeyUp(string code) => held.Remove(code);

    public void MouseDown(int button)
    {
      if (button == 0)
      {
        pressed[(int)Action.Attack] = true;
        mouseAttack = true;
      }
      else if (button == 2) pressed[(int)Action.Charge] = true;
    }

    public void MouseUp(int button)
    {
      if (button == 0) mouseAttack = false;
    }

    public void Wheel(double deltaY) => wheel += Math.Sign(deltaY);

    // Window blur: forget everything held or pressed.
    public void Blur()
    {
      held.Clear();
      Array.Clear(pressed, 0, pressed.Length);
      mouseAttack = false;
      attackRepeat = 0;
      wheel = 0;
    }

    public InputFrame Poll(double dt)
    {
      double moveX = Math.Max(K("KeyD"), K("ArrowRight")) - Math.Max(K("KeyA"), K("ArrowLeft"));
      double moveY = Math.Max(K("KeyW"), K("ArrowUp")) - Math.Max(K("KeyS"), K("ArrowDown"));
      double camTurn = K("KeyE") - K("KeyQ");

      // Holding attack keeps the string going; charge and guard win so auto-repeat cannot override a manual branch.
      bool guard = held.Contains("KeyF");
      bool attackHeld = held.Contains("KeyJ") || mouseAttack;
      attackRepeat = Math.Max(0, attackRepeat - dt);
      if (!attackHeld) attackRepeat = 0;
      else if (!guard && attackRepeat == 0)
      {
        pressed[(int)Action.Attack] = true;
        attackRepeat = AttackRepeatInterval;
      }
      if (pressed[(int)Action.Charge])
      {
        pressed[(int)Action.Attack] = false;
        attackRepeat = ChargeRepeatHold;
      }

      double len = CombatMath.Hypot(moveX, moveY);
      if (len > 1)
      {
        moveX /= len;
        moveY /= len;
      }
      var frame = new InputFrame
      {
        MoveX = moveX,
        MoveY = moveY,
        CamTurn = Math.Max(-1, Math.Min(1, camTurn)),
        Zoom = wheel,
        Attack = pressed[(int)Action.Attack],
        Charge = pressed[(int)Action.Charge],
        Jump = pressed[(int)Action.Jump],
        Dodge = pressed[(int)Action.Dodge],
        Musou = pressed[(int)Action.Musou],
        Guard = guard,
        Recenter = pressed[(int)Action.Recenter],
        Pause = pressed[(int)Action.Pause],
        Confirm = pressed[(int)Action.Confirm],
        Debug = pressed[(int)Action.Debug],
      };
      Array.Clear(pressed, 0, pressed.Length);
      wheel = 0;
      return frame;
    }

    double K(string code) => held.Contains(code) ? 1 : 0;
  }

  // Game.simulate's camera-relative composition with CameraRig's basis: forward (sin yaw, cos yaw), right (-cos yaw, sin yaw).
  public static class ControlComposer
  {
    public static PlayerControls Compose(in InputFrame f, double cameraYaw)
    {
      double fx = Math.Sin(cameraYaw), fz = Math.Cos(cameraYaw);
      double rx = -Math.Cos(cameraYaw), rz = Math.Sin(cameraYaw);
      double mx = fx * f.MoveY + rx * f.MoveX;
      double mz = fz * f.MoveY + rz * f.MoveX;
      double len = CombatMath.Hypot(mx, mz);
      if (len > 1)
      {
        mx /= len;
        mz /= len;
      }
      return new PlayerControls
      {
        MoveX = mx, MoveZ = mz, Attack = f.Attack, Charge = f.Charge, Jump = f.Jump, Dodge = f.Dodge, Musou = f.Musou, Guard = f.Guard,
      };
    }
  }
}
