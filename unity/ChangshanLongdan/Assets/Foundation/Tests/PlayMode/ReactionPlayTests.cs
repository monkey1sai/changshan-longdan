using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Changshan.Character;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Object = UnityEngine.Object;

namespace Changshan.Foundation.Tests
{
  // E07 in the validation scene: a hit dummy reacts and flashes on screen, an enemy strike hurts the player and shakes
  // the camera, and everything recovers.
  public sealed class ReactionPlayTests
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

    static IEnumerator Scene(System.Action<ZhaoYunController, ScriptedInput> ready)
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      yield return null;
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      controller.enabled = false;
      var input = new ScriptedInput();
      controller.InputSource = input;
      controller.SetFocus(true);
      ready(controller, input);
    }

    [UnityTest] public IEnumerator HitDummyFlinchesFlashesAndRecovers()
    {
      ZhaoYunController controller = null;
      ScriptedInput input = null;
      yield return Scene((c, i) => { controller = c; input = i; });
      var targets = controller.Simulation.Targets;
      var dummies = controller.Dummies;
      var baseRotation = dummies.Dummies[0].rotation;
      input.Down.Add("KeyJ");
      controller.Tick(Dt);
      input.Up.Add("KeyJ");
      int hit = -1;
      for (int frame = 0; frame < 60 && hit < 0; frame++)
      {
        controller.Tick(Dt);
        foreach (var e in controller.Simulation.Hits) hit = e.Target;
      }
      Assert.That(hit, Is.GreaterThanOrEqualTo(0), "N1 never hit a dummy");
      Assert.That(targets.State(hit), Is.EqualTo(EnemyState.Flinch));
      Assert.That(targets.Flash(hit), Is.GreaterThan(0.5));
      Assert.That(controller.LastHit, Does.StartWith("Pierce x")); // N1 reaches several ring dummies at once
      var dummy = dummies.Dummies[hit];
      Assert.That(dummy.gameObject.activeSelf, Is.True);
      // The hit's hit-stop (0.05 s) freezes the game, state time included, so the flinch lean sin(t / 0.42 * pi) stays
      // zero until the game steps again; it is visible two steps after that.
      int frozen = 0;
      while (controller.Simulation.Clock.Hitstop > 0 && frozen++ < 10) controller.Tick(Dt);
      controller.Tick(Dt);
      controller.Tick(Dt);
      TestContext.WriteLine($"hit {hit}: frozen frames {frozen}, state {targets.State(hit)}, stateTime {targets.StateTime(hit):0.0000}, flash {targets.Flash(hit):0.000}, up {dummy.up}, euler {dummy.rotation.eulerAngles}");
      Assert.That(targets.State(hit), Is.EqualTo(EnemyState.Flinch));
      Assert.That(targets.StateTime(hit), Is.GreaterThan(0.02));
      // Leaning forward: the capsule's up axis is no longer vertical; the hit flash tints it toward white.
      Assert.That(Vector3.Dot(dummy.up, Vector3.up), Is.LessThan(0.999f), "a flinching dummy must lean");
      var block = new MaterialPropertyBlock();
      dummy.GetComponent<MeshRenderer>().GetPropertyBlock(block);
      Assert.That(block.GetColor("_BaseColor").r, Is.GreaterThan(0.6f), "the flash must tint the dummy toward white");
      Assert.That(controller.Shake, Is.Not.Null);
      Assert.That(controller.Shake.Trauma, Is.GreaterThan(0), "a hit shakes the camera");
      for (int frame = 0; frame < 60; frame++) controller.Tick(Dt);
      Assert.That(targets.State(hit), Is.EqualTo(EnemyState.Idle), "flinch lasts 0.42 s and recovers");
      Assert.That(targets.Flash(hit), Is.Zero);
      Assert.That(Vector3.Dot(dummy.up, Vector3.up), Is.GreaterThan(0.999f));
      Assert.That(targets.Y(hit), Is.Zero, "a standing dummy stays on the ground");
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator InjectedStrikeHurtsThenKnocksDown()
    {
      ZhaoYunController controller = null;
      yield return Scene((c, i) => controller = c);
      var p = controller.Simulation.Player;
      controller.Tick(Dt);
      double hp = p.Hp;
      controller.InjectStrike(false);
      Assert.That(p.State, Is.EqualTo(PlayerState.Hurt));
      Assert.That(p.Hp, Is.EqualTo(hp - 26).Within(1e-9));
      Assert.That(controller.LastHit, Is.EqualTo("hurt"));
      Assert.That(controller.Shake.Trauma, Is.GreaterThan(0.2f));
      for (int frame = 0; frame < 40; frame++) controller.Tick(Dt);
      Assert.That(p.State, Is.EqualTo(PlayerState.Move), "hurt lasts 0.4 s");
      controller.InjectStrike(true);
      Assert.That(p.State, Is.EqualTo(PlayerState.Down));
      Assert.That(p.Invulnerable, Is.GreaterThan(1));
      double before = p.Hp;
      controller.InjectStrike(false);
      Assert.That(p.Hp, Is.EqualTo(before), "strikes during invulnerability are ignored");
      for (int frame = 0; frame < 120; frame++) controller.Tick(Dt);
      Assert.That(p.State, Is.EqualTo(PlayerState.Move), "down lasts 1.3 s then the player stands");
      Assert.That(controller.Simulation.DamageSum, Is.EqualTo(96).Within(1e-9));
      // The camera shake fades out in real time.
      yield return new WaitForSecondsRealtime(1.2f);
      Assert.That(controller.Shake.Trauma, Is.Zero);
      LogAssert.NoUnexpectedReceived();
    }
  }
}
