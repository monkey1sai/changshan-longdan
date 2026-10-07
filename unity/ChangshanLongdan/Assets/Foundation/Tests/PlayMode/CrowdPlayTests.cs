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
  // E08 in the validation scene: the authored dummies stay a sandbox (AI off), the pressure crowd brings the castle's
  // 300 soldiers who engage, take tokens and strike, and the difficulty cycles with a fresh fight.
  public sealed class CrowdPlayTests
  {
    const double Dt = 1.0 / 60;

    sealed class ScriptedInput : IRawInputSource
    {
      public void Feed(InputMapper mapper) { }
    }

    static IEnumerator Scene(System.Action<ZhaoYunController> ready)
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      yield return null;
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      controller.enabled = false;
      controller.InputSource = new ScriptedInput();
      controller.SetFocus(true);
      ready(controller);
    }

    [UnityTest] public IEnumerator PressureCrowdEngagesAndStrikesThePlayer()
    {
      ZhaoYunController controller = null;
      yield return Scene(c => controller = c);
      var targets = controller.Simulation.Targets;
      Assert.That(targets.AiEnabled, Is.False, "the authored dummies are a sandbox");
      Assert.That(targets.Count, Is.EqualTo(20));
      controller.UsePressureCrowd(true);
      targets = controller.Simulation.Targets;
      Assert.That(controller.PressureCrowd, Is.True);
      Assert.That(targets.Count, Is.EqualTo(300));
      Assert.That(targets.AiEnabled, Is.True);
      Assert.That(Enumerable.Range(0, 300).Count(i => targets.Kind(i) == EnemyKind.Captain), Is.EqualTo(9));
      Assert.That(controller.Dummies.Dummies.Count, Is.EqualTo(300));
      bool struck = false;
      int maxAttackers = 0;
      var seen = new HashSet<EnemyState>();
      for (int frame = 0; frame < 600 && !struck; frame++)
      {
        controller.Tick(Dt);
        maxAttackers = System.Math.Max(maxAttackers, targets.Attackers);
        Assert.That(targets.Attackers, Is.LessThanOrEqualTo(targets.MaxAttackers));
        for (int i = 0; i < targets.Count; i++) seen.Add(targets.State(i));
        foreach (var e in controller.Simulation.Events) if (e.Type == CombatEventType.EnemyStrike) struck = true;
      }
      Assert.That(struck, Is.True, "no soldier struck within ten seconds");
      // No March here: the castle layout starts with 36 (normal) soldiers already engaged, above the 20 that would send the
      // nearest waiting soldier marching, and the Web's castle summary shows zero marchers for its whole six seconds. The
      // march rule is covered by the eighteen_march_normal parity scenario.
      Assert.That(seen, Is.SupersetOf(new[] { EnemyState.Engage, EnemyState.Windup, EnemyState.Strike }));
      Assert.That(seen, Has.No.Member(EnemyState.March), "a march here would differ from the Web castle summary");
      Assert.That(targets.EngagedCount, Is.GreaterThan(0).And.LessThanOrEqualTo(HitTargets.MaxEngaged));
      Assert.That(maxAttackers, Is.GreaterThan(0));
      // The capsules follow the soldiers: an engaged soldier's capsule is near its logic position.
      int engaged = Enumerable.Range(0, 300).First(i => targets.Engaged(i));
      var shown = controller.Dummies.Dummies[engaged].position;
      var logic = controller.Mapping.ToDisplayPosition(targets.X(engaged), 0, targets.Z(engaged));
      Assert.That(Vector3.Distance(new Vector3(shown.x, 0, shown.z), logic), Is.LessThan(0.01f));
      controller.UsePressureCrowd(false);
      Assert.That(controller.Simulation.Targets.Count, Is.EqualTo(20));
      Assert.That(controller.PressureCrowd, Is.False);
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator DifficultyCyclesWithAFreshFight()
    {
      ZhaoYunController controller = null;
      yield return Scene(c => controller = c);
      controller.UsePressureCrowd(true);
      Assert.That(controller.Simulation.Difficulty, Is.SameAs(Difficulties.Normal));
      int captain = Enumerable.Range(0, 300).First(i => controller.Simulation.Targets.Kind(i) == EnemyKind.Captain);
      Assert.That(controller.Simulation.Targets.Hp(captain), Is.EqualTo(230f));
      controller.CycleDifficulty();
      Assert.That(controller.Simulation.Difficulty, Is.SameAs(Difficulties.Hard));
      Assert.That(controller.Simulation.Targets.Hp(captain), Is.EqualTo((float)(230 * 1.35)), "hard captains have 35 % more health");
      Assert.That(controller.Simulation.Targets.MaxAttackers, Is.EqualTo(5));
      Assert.That(controller.Simulation.Phase, Is.EqualTo(BattlePhase.Opening));
      controller.CycleDifficulty();
      controller.CycleDifficulty();
      controller.CycleDifficulty();
      Assert.That(controller.Simulation.Difficulty, Is.SameAs(Difficulties.Normal), "four steps return to normal");
      controller.UsePressureCrowd(false);
      LogAssert.NoUnexpectedReceived();
      yield return null;
    }
  }
}
