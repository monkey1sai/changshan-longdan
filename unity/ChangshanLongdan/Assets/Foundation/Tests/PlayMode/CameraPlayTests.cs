using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Changshan.Character;
using Changshan.Combat;
using Changshan.View;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Object = UnityEngine.Object;

namespace Changshan.Foundation.Tests
{
  // E09 in the validation scene: the placeholder castle, the camera following and shortening its boom, the roof
  // cutaway, the title/pause/result flow with the difficulty choice and the shake switch, and focus loss.
  public sealed class CameraPlayTests
  {
    const double Dt = 1.0 / 60;

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

    static IEnumerator Scene(System.Action<ZhaoYunController, ScriptedInput, GameFlow> ready)
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      yield return null;
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      controller.enabled = false;
      var input = new ScriptedInput();
      controller.InputSource = input;
      var flow = GameFlow.Attach(controller);
      controller.SetFocus(true);
      ready(controller, input, flow);
    }

    static void Press(ZhaoYunController c, ScriptedInput input, string key)
    {
      input.Down.Add(key);
      c.Tick(Dt);
      input.Up.Add(key);
      c.Tick(Dt);
    }

    static float Horizontal(Vector3 a, Vector3 b) => Vector2.Distance(new Vector2(a.x, a.z), new Vector2(b.x, b.z));

    [UnityTest] public IEnumerator FlowGoesTitleBattlePauseResultRetry()
    {
      ZhaoYunController controller = null;
      ScriptedInput input = null;
      GameFlow flow = null;
      yield return Scene((c, i, f) => { controller = c; input = i; flow = f; });
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Title));
      Assert.That(controller.Castle, Is.Not.Null);
      Assert.That(controller.Castle.Roofs.Count, Is.EqualTo(6));
      Assert.That(controller.Castle.BlockCount, Is.GreaterThan(30));
      var sim = controller.Simulation;
      long steps = sim.Clock.SimSteps;
      Press(controller, input, "KeyW");
      Assert.That(sim.Clock.SimSteps, Is.EqualTo(steps), "the title does not simulate");
      // The title orbit circles the castle at 78 m (logic space); the display position differs by the scene anchor.
      Assert.That(controller.CameraView.Rig.Position.Length(), Is.GreaterThan(60), "the title camera orbits outside the castle");
      Assert.That(Horizontal(Camera.main.transform.position, controller.transform.position), Is.GreaterThan(30));
      flow.SelectDifficulty((int)DifficultyId.Hard);
      Press(controller, input, "KeyJ");
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Playing), "J starts the battle from the title");
      Assert.That(sim.Difficulty, Is.SameAs(Difficulties.Hard));
      for (int frame = 0; frame < 120; frame++) controller.Tick(Dt);
      Assert.That(sim.Clock.SimSteps, Is.GreaterThan(steps));
      // The camera sits behind the character at the follow distance and frames it.
      var cam = Camera.main.transform.position;
      Assert.That(Horizontal(cam, controller.transform.position), Is.EqualTo(9.2f).Within(0.3f));
      var vp = Camera.main.WorldToViewportPoint(controller.CameraView.DisplayFocus);
      Assert.That(vp.z, Is.GreaterThan(0));
      Assert.That(vp.x, Is.EqualTo(0.5f).Within(0.05f));
      Assert.That(vp.y, Is.InRange(0.3f, 0.7f));
      // A point ahead of the character (logic forward) shows above the focus.
      var p = sim.Player;
      var ahead = controller.Mapping.ToDisplayPosition(p.X + System.Math.Sin(controller.CameraView.LogicYaw) * 2, p.Y + CameraRig.FocusHeight, p.Z + System.Math.Cos(controller.CameraView.LogicYaw) * 2);
      Assert.That(Camera.main.WorldToViewportPoint(ahead).y, Is.GreaterThan(vp.y));
      // Pause: Esc stops the simulation, Enter resumes.
      steps = sim.Clock.SimSteps;
      Press(controller, input, "Escape");
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Paused));
      long paused = sim.Clock.SimSteps;
      Press(controller, input, "KeyJ");
      Assert.That(sim.Clock.SimSteps, Is.EqualTo(paused), "paused: no stepping, J does nothing");
      Press(controller, input, "Enter");
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Playing));
      controller.Tick(Dt);
      Assert.That(sim.Clock.SimSteps, Is.GreaterThan(paused));
      // Focus loss pauses and stays paused on return; the pause screen's resume button continues.
      controller.SetFocus(false);
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Paused));
      controller.SetFocus(true);
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Paused));
      flow.ResumeRequested();
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Playing));
      // Defeat: heavy strikes until the character dies, then the result after 2.4 s, then Enter retries.
      for (int n = 0; n < 60 && sim.Player.State != PlayerState.Dead; n++)
      {
        controller.InjectStrike(true);
        for (int frame = 0; frame < 100; frame++) controller.Tick(Dt);
      }
      Assert.That(sim.Player.State, Is.EqualTo(PlayerState.Dead));
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Ended));
      Assert.That(flow.HasResult, Is.True);
      Assert.That(flow.Result.Win, Is.False);
      Assert.That(flow.Result.Rank, Is.EqualTo("D"));
      Press(controller, input, "Enter");
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Ended), "Enter before the result is shown is ignored");
      for (int frame = 0; frame < 150; frame++) controller.Tick(Dt);
      Assert.That(flow.Modes.ResultShown, Is.True);
      Press(controller, input, "Enter");
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Playing));
      Assert.That(sim.Player.State, Is.Not.EqualTo(PlayerState.Dead));
      Assert.That(sim.Player.Hp, Is.EqualTo(sim.Player.MaxHp));
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator CameraShortensAtTheBarracksAndTheRoofOpensUnderTheEave()
    {
      ZhaoYunController controller = null;
      ScriptedInput input = null;
      GameFlow flow = null;
      yield return Scene((c, i, f) => { controller = c; input = i; flow = f; });
      flow.StartRequested();
      var sim = controller.Simulation;
      // Stand beside barracks 1 facing it (the Web camera test target): the boom cannot reach into the building.
      sim.Player.Reset(39.55, 0, -System.Math.PI / 2);
      controller.CameraView.Snap(sim.Player);
      for (int frame = 0; frame < 400; frame++) controller.Tick(Dt);
      var rig = controller.CameraView.Rig;
      Assert.That(System.Math.Abs(rig.Position.X), Is.LessThan(38.5), "the camera stays outside the barracks");
      Assert.That(Horizontal(Camera.main.transform.position, controller.transform.position), Is.LessThan(9.2f - 2));
      Assert.That(rig.Position.Y - rig.Focus.Y, Is.EqualTo(4.4).Within(0.05), "it keeps its height");
      var roofs = controller.Castle.Roofs;
      Assert.That(roofs[1].enabled, Is.False, "standing under the eave hides that roof");
      Assert.That(roofs.Count(r => r.enabled), Is.EqualTo(5));
      // Walk away: the roof returns once the exit buffer is passed.
      sim.Player.Reset(30, 0, System.Math.PI / 2);
      for (int frame = 0; frame < 30; frame++) controller.Tick(Dt);
      Assert.That(roofs.All(r => r.enabled), Is.True);
      yield return null;
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator ShakeSwitchPersistsAndSilencesTheCamera()
    {
      ZhaoYunController controller = null;
      ScriptedInput input = null;
      GameFlow flow = null;
      bool before = CameraRigView.ShakeEnabledPref;
      try
      {
        yield return Scene((c, i, f) => { controller = c; input = i; flow = f; });
        flow.StartRequested();
        for (int frame = 0; frame < 200; frame++) controller.Tick(Dt);
        var rig = controller.CameraView.Rig;
        flow.ShakeEnabled = false;
        Assert.That(CameraRigView.ShakeEnabledPref, Is.False, "saved");
        var rest = Camera.main.transform.position;
        controller.InjectStrike(true);
        controller.Tick(Dt);
        Assert.That(rig.Trauma, Is.Zero);
        Assert.That(controller.Shake.Trauma, Is.Zero, "the E07 shake forwards into the rig");
        Assert.That(Vector3.Distance(Camera.main.transform.position, rest), Is.LessThan(0.05f));
        // The heavy hit leaves the character invulnerable for over two seconds (E07 fixture): wait it out.
        for (int frame = 0; frame < 220; frame++) controller.Tick(Dt);
        Assert.That(controller.Simulation.Player.Invulnerable, Is.Zero);
        flow.ShakeEnabled = true;
        controller.InjectStrike(true);
        controller.Tick(Dt);
        Assert.That(rig.Trauma, Is.GreaterThan(0.3));
        Assert.That(controller.Shake.Trauma, Is.GreaterThan(0.3f));
      }
      finally
      {
        CameraRigView.ShakeEnabledPref = before;
      }
      LogAssert.NoUnexpectedReceived();
    }
  }
}
