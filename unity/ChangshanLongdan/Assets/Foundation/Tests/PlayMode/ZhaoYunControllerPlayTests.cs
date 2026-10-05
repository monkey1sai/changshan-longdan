using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Changshan.Character;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Changshan.Foundation.Tests
{
  // E04: the Unity controller feeds the ported logic and only displays its result.
  public sealed class ZhaoYunControllerPlayTests
  {
    const double Dt = 1.0 / 60;

    // Scripted device: key codes held or pressed per frame, delivered like the legacy source would.
    sealed class ScriptedInput : IRawInputSource
    {
      public readonly List<string> Down = new List<string>();
      public readonly List<string> Up = new List<string>();

      public void Feed(InputMapper mapper)
      {
        foreach (var code in Down) mapper.KeyDown(code);
        foreach (var code in Up) mapper.KeyUp(code);
        Down.Clear();
        Up.Clear();
      }
    }

    GameObject root, cameraObject;

    [TearDown] public void Destroy()
    {
      if (root) Object.Destroy(root);
      if (cameraObject) Object.Destroy(cameraObject);
    }

    ZhaoYunController Create(out ScriptedInput input, float cameraYaw = 0)
    {
      cameraObject = new GameObject("Test Camera");
      cameraObject.transform.SetPositionAndRotation(new Vector3(0, 1, -2), Quaternion.Euler(20, cameraYaw, 0));
      var view = cameraObject.AddComponent<Camera>();
      root = new GameObject("Controlled");
      root.transform.SetPositionAndRotation(new Vector3(3, 0, 5), Quaternion.Euler(0, 160, 0));
      var controller = root.AddComponent<ZhaoYunController>();
      controller.enabled = false; // stepped explicitly below
      input = new ScriptedInput();
      controller.InputSource = input;
      controller.ViewCamera = view;
      controller.SetFocus(true);
      return controller;
    }

    static void Run(ZhaoYunController controller, int frames)
    {
      for (int i = 0; i < frames; i++) controller.Tick(Dt);
    }

    [UnityTest] public IEnumerator SceneCharacterKeepsItsPoseAndCarriesTheController()
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      yield return null;
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      Assert.That(controller.GetComponent<ZhaoYunCharacter>(), Is.Not.Null);
      Assert.That(Vector3.Distance(controller.transform.position, new Vector3(0, -1, 4.2f)), Is.LessThan(1e-4f));
      Assert.That(Mathf.DeltaAngle(controller.transform.eulerAngles.y, 160), Is.EqualTo(0).Within(1e-3f));
      Assert.That(controller.Driver.Player.State, Is.EqualTo(PlayerState.Move));
      Assert.That(controller.Driver.Player.X, Is.EqualTo(ArenaLayout.StartX));
      Assert.That(controller.Driver.Player.Z, Is.EqualTo(ArenaLayout.StartZ));
    }

    [UnityTest] public IEnumerator MovementFollowsTheCameraOnScreen()
    {
      foreach (float cameraYaw in new[] { 0f, 120f })
      {
        var controller = Create(out var input, cameraYaw);
        var start = controller.transform.position;
        input.Down.Add("KeyW");
        Run(controller, 30);
        var moved = controller.transform.position - start;
        var forward = Quaternion.Euler(0, cameraYaw, 0) * Vector3.forward;
        Assert.That(Vector3.Dot(moved, forward), Is.GreaterThan(1.5f), $"forward at camera yaw {cameraYaw}");
        Assert.That(Vector3.Cross(forward, moved).magnitude, Is.LessThan(0.05f), $"drift at camera yaw {cameraYaw}");
        // The displayed character turns toward its movement.
        Assert.That(Vector3.Dot(controller.transform.forward, forward), Is.GreaterThan(0.99f));

        input.Up.Add("KeyW");
        input.Down.Add("KeyD");
        var before = controller.transform.position;
        Run(controller, 30);
        var right = Quaternion.Euler(0, cameraYaw, 0) * Vector3.right;
        Assert.That(Vector3.Dot(controller.transform.position - before, right), Is.GreaterThan(1.0f), $"right at camera yaw {cameraYaw}");
        Destroy();
        yield return null;
      }
    }

    [UnityTest] public IEnumerator AttackKeyStartsTheNormalStringAndChargeBranches()
    {
      var controller = Create(out var input);
      input.Down.Add("KeyJ");
      controller.Tick(Dt);
      var player = controller.Driver.Player;
      Assert.That(player.Move?.Id, Is.EqualTo(MoveId.N1));
      input.Up.Add("KeyJ");
      Run(controller, 6);
      input.Down.Add("KeyK");
      var started = new List<MoveId>();
      double highest = 0;
      for (int i = 0; i < 40; i++)
      {
        controller.Tick(Dt);
        started.AddRange(player.Events.Where(e => e.Type == PlayerEventType.MoveStart).Select(e => e.Move));
        highest = System.Math.Max(highest, player.Y);
        // One displacement authority: the root shows exactly the logic position, lunges and C2's rise included.
        // The project has no animation module, so no Animator can add root motion.
        Assert.That(Vector3.Distance(controller.transform.position, controller.Mapping.ToDisplayPosition(player.X, player.Y, player.Z)),
          Is.LessThan(1e-5f), $"frame {i}");
      }
      Assert.That(started, Is.EqualTo(new[] { MoveId.C2 }));
      Assert.That(highest, Is.GreaterThan(0.5));
      yield return null;
    }

    [UnityTest] public IEnumerator FocusLossDropsHeldKeysAndPendingPresses()
    {
      var controller = Create(out var input);
      var player = controller.Driver.Player;
      input.Down.Add("KeyW");
      input.Down.Add("KeyJ");
      controller.Tick(Dt);
      Assert.That(player.Move?.Id, Is.EqualTo(MoveId.N1));
      input.Down.Add("KeyK");
      controller.Tick(Dt); // charge buffered for N1's cancel point
      Assert.That(player.BufferedButton, Is.EqualTo(ChargeButton.Charge));

      controller.SetFocus(false);
      Assert.That(controller.Paused, Is.True);
      Assert.That(player.BufferedButton, Is.Null);
      double frozen = player.MoveTime;
      Run(controller, 10);
      Assert.That(player.MoveTime, Is.EqualTo(frozen), "simulation advanced while unfocused");

      controller.SetFocus(true);
      var started = new List<MoveId>();
      for (int i = 0; i < 60; i++)
      {
        controller.Tick(Dt);
        started.AddRange(player.Events.Where(e => e.Type == PlayerEventType.MoveStart).Select(e => e.Move));
      }
      Assert.That(started, Is.Empty, "a press from before the focus loss fired");
      Assert.That(controller.LastInput.MoveY, Is.Zero, "a key held before the focus loss is still held");
      yield return null;
    }

    [UnityTest] public IEnumerator RestartRestoresTheStartState()
    {
      var controller = Create(out var input);
      var player = controller.Driver.Player;
      var start = controller.transform.position;
      input.Down.Add("KeyW");
      Run(controller, 20);
      player.TakeHit(250, false, player.X, player.Z - 2);
      player.GainMusou(40);
      controller.Restart();
      Assert.That(player.Hp, Is.EqualTo(player.MaxHp));
      Assert.That(player.Musou, Is.Zero);
      Assert.That(player.State, Is.EqualTo(PlayerState.Move));
      Assert.That(Vector3.Distance(controller.transform.position, start), Is.LessThan(1e-5f));
      controller.Tick(Dt);
      Assert.That(controller.LastInput.MoveY, Is.Zero, "held input survived the restart");
      yield return null;
    }
  }
}
