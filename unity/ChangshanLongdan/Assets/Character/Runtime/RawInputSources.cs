using System.Collections.Generic;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // Delivers one frame of raw device changes to the mapper, which then produces the same InputFrame as the Web.
  public interface IRawInputSource
  {
    void Feed(InputMapper mapper);
  }

  // Keyboard and mouse through the legacy Input Manager (activeInputHandler 0); gamepad support is deferred.
  public sealed class LegacyInputSource : IRawInputSource
  {
    static readonly KeyValuePair<KeyCode, string>[] keys =
    {
      new KeyValuePair<KeyCode, string>(KeyCode.J, "KeyJ"),
      new KeyValuePair<KeyCode, string>(KeyCode.K, "KeyK"),
      new KeyValuePair<KeyCode, string>(KeyCode.L, "KeyL"),
      new KeyValuePair<KeyCode, string>(KeyCode.Space, "Space"),
      new KeyValuePair<KeyCode, string>(KeyCode.LeftShift, "ShiftLeft"),
      new KeyValuePair<KeyCode, string>(KeyCode.RightShift, "ShiftRight"),
      new KeyValuePair<KeyCode, string>(KeyCode.Escape, "Escape"),
      new KeyValuePair<KeyCode, string>(KeyCode.P, "KeyP"),
      new KeyValuePair<KeyCode, string>(KeyCode.Return, "Enter"),
      new KeyValuePair<KeyCode, string>(KeyCode.F3, "F3"),
      new KeyValuePair<KeyCode, string>(KeyCode.R, "KeyR"),
      new KeyValuePair<KeyCode, string>(KeyCode.F, "KeyF"),
      new KeyValuePair<KeyCode, string>(KeyCode.W, "KeyW"),
      new KeyValuePair<KeyCode, string>(KeyCode.A, "KeyA"),
      new KeyValuePair<KeyCode, string>(KeyCode.S, "KeyS"),
      new KeyValuePair<KeyCode, string>(KeyCode.D, "KeyD"),
      new KeyValuePair<KeyCode, string>(KeyCode.Q, "KeyQ"),
      new KeyValuePair<KeyCode, string>(KeyCode.E, "KeyE"),
      new KeyValuePair<KeyCode, string>(KeyCode.UpArrow, "ArrowUp"),
      new KeyValuePair<KeyCode, string>(KeyCode.DownArrow, "ArrowDown"),
      new KeyValuePair<KeyCode, string>(KeyCode.LeftArrow, "ArrowLeft"),
      new KeyValuePair<KeyCode, string>(KeyCode.RightArrow, "ArrowRight"),
    };

    public void Feed(InputMapper mapper)
    {
      foreach (var key in keys)
      {
        if (Input.GetKeyDown(key.Key)) mapper.KeyDown(key.Value);
        if (Input.GetKeyUp(key.Key)) mapper.KeyUp(key.Value);
      }
      // Web MouseEvent.button: 0 left, 2 right. Unity: 0 left, 1 right.
      if (Input.GetMouseButtonDown(0)) mapper.MouseDown(0);
      if (Input.GetMouseButtonDown(1)) mapper.MouseDown(2);
      if (Input.GetMouseButtonUp(0)) mapper.MouseUp(0);
      // Web wheel deltaY is positive when scrolling down; Unity's scroll delta is positive when scrolling up.
      float wheel = Input.mouseScrollDelta.y;
      if (wheel != 0) mapper.Wheel(-wheel);
    }
  }
}
