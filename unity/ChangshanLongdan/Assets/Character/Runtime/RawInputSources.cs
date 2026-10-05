using System;
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
  // The polled keys are exactly InputMapper.GameKeys, so a key added there without a KeyCode fails at startup.
  public sealed class LegacyInputSource : IRawInputSource
  {
    static readonly Dictionary<string, KeyCode> keyCodes = new Dictionary<string, KeyCode>
    {
      ["KeyJ"] = KeyCode.J, ["KeyK"] = KeyCode.K, ["KeyL"] = KeyCode.L, ["Space"] = KeyCode.Space,
      ["ShiftLeft"] = KeyCode.LeftShift, ["ShiftRight"] = KeyCode.RightShift, ["Escape"] = KeyCode.Escape, ["KeyP"] = KeyCode.P,
      ["Enter"] = KeyCode.Return, ["F3"] = KeyCode.F3, ["KeyR"] = KeyCode.R, ["KeyF"] = KeyCode.F,
      ["KeyW"] = KeyCode.W, ["KeyA"] = KeyCode.A, ["KeyS"] = KeyCode.S, ["KeyD"] = KeyCode.D, ["KeyQ"] = KeyCode.Q, ["KeyE"] = KeyCode.E,
      ["ArrowUp"] = KeyCode.UpArrow, ["ArrowDown"] = KeyCode.DownArrow, ["ArrowLeft"] = KeyCode.LeftArrow, ["ArrowRight"] = KeyCode.RightArrow,
    };

    static readonly KeyValuePair<KeyCode, string>[] keys = Build();

    public static IReadOnlyList<KeyValuePair<KeyCode, string>> PolledKeys { get; } = Array.AsReadOnly(keys);

    static KeyValuePair<KeyCode, string>[] Build()
    {
      var list = new List<KeyValuePair<KeyCode, string>>();
      foreach (string code in InputMapper.GameKeys)
      {
        if (!keyCodes.TryGetValue(code, out var key)) throw new InvalidOperationException($"No KeyCode for game key {code}");
        list.Add(new KeyValuePair<KeyCode, string>(key, code));
      }
      if (list.Count != keyCodes.Count) throw new InvalidOperationException("KeyCode table lists keys the game does not use");
      return list.ToArray();
    }

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
