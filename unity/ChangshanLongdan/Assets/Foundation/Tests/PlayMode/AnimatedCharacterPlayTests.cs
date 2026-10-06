using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Changshan.Animation;
using Changshan.Character;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Object = UnityEngine.Object;

namespace Changshan.Foundation.Tests
{
  // E06: the imported Zhao Yun is posed by the Web rig (with the foot plant) through the controller.
  public sealed class AnimatedCharacterPlayTests
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

    static bool Finite(Vector3 v) => !(float.IsNaN(v.x) || float.IsNaN(v.y) || float.IsNaN(v.z) || float.IsInfinity(v.x) || float.IsInfinity(v.y) || float.IsInfinity(v.z));

    [UnityTest] public IEnumerator SceneCharacterIsPosedByTheRig()
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      var character = controller.GetComponent<ZhaoYunCharacter>();
      float deadline = Time.realtimeSinceStartup + 30;
      // The character starts loading after the scene is up (NotStarted first): wait for an outcome.
      while (character.Status != CharacterLoadStatus.Ready && character.Status != CharacterLoadStatus.Failed && Time.realtimeSinceStartup < deadline) yield return null;
      Assert.That(character.Status, Is.EqualTo(CharacterLoadStatus.Ready), character.Report.failureDetail);
      controller.enabled = false;
      var input = new ScriptedInput();
      controller.InputSource = input;
      controller.UseDummies(null);
      controller.SetFocus(true);
      var animation = controller.Animation;
      var rig = animation.Rig;

      // Stand, turn and run (camera-relative D then W), then attack: exercises plants, steps and release.
      var script = new Dictionary<int, (string Down, string Up)>
      {
        [10] = ("KeyD", null), [40] = ("KeyW", "KeyD"), [70] = (null, "KeyW"), [100] = ("KeyJ", null), [102] = (null, "KeyJ"),
      };
      double worstBone = 0, worstGrip = 0;
      for (int frame = 0; frame < 140; frame++)
      {
        if (script.TryGetValue(frame, out var keys))
        {
          if (keys.Down != null) input.Down.Add(keys.Down);
          if (keys.Up != null) input.Up.Add(keys.Up);
        }
        controller.Tick(Dt);
        Assert.That(animation.BoundModel, Is.SameAs(character.Model), $"frame {frame}: model not animated");
        foreach (var node in animation.Skin.PlacedBones.Append(animation.Skin.Weapon))
        {
          var t = animation.TransformOf(node);
          Assert.That(Finite(t.position), Is.True, $"frame {frame} {node.Name}");
          worstBone = System.Math.Max(worstBone, Vector3.Distance(t.position, animation.DisplayPosition(node)));
        }
        // The right hand bone holds the spear grip (the spear driver's origin).
        var hand = animation.TransformOf(animation.Skin.Bone("hand_r")).position;
        var grip = animation.TransformOf(animation.Skin.Weapon).position;
        worstGrip = System.Math.Max(worstGrip, Vector3.Distance(hand, grip));
      }
      TestContext.WriteLine($"worst bone offset {worstBone:0.000000} m, worst right-hand grip {worstGrip:0.0000} m, steps {animation.FootPlant.Steps}");
      Assert.That(worstBone, Is.LessThan(1e-3), "a Unity bone is not where the rig placed it");
      Assert.That(worstGrip, Is.LessThan(AnimationMetrics.GripLimit), "the right hand left the spear");
      Assert.That(controller.Simulation.TotalHits, Is.Zero);
      Assert.That(animation.FootPlant.Steps, Is.GreaterThan(0), "turning never made the planted feet step");
      Assert.That(controller.Simulation.Player.State == PlayerState.Attack || controller.Simulation.Player.State == PlayerState.Move, Is.True);
      var feet = new[] { animation.Skin.Bone("foot_l"), animation.Skin.Bone("foot_r") };
      Assert.That(Vector3.Distance(animation.TransformOf(feet[0]).position, animation.DisplayPosition(feet[0])), Is.LessThan(1e-3));
      LogAssert.NoUnexpectedReceived();
    }

    [UnityTest] public IEnumerator ControllerWithoutModelStillRunsTheRig()
    {
      var root = new GameObject("Rig Without Model");
      try
      {
        var controller = root.AddComponent<ZhaoYunController>();
        controller.enabled = false;
        controller.UseDummies(null);
        var input = new ScriptedInput();
        controller.InputSource = input;
        controller.SetFocus(true);
        // One tap: holding J auto-repeats the string (InputMapper), which would chain into N2 and N3.
        input.Down.Add("KeyJ");
        controller.Tick(Dt);
        input.Up.Add("KeyJ");
        for (int i = 1; i < 20; i++) controller.Tick(Dt); // N1 lasts 0.42 s
        var rig = controller.Animation.Rig;
        Assert.That(controller.Animation.BoundModel, Is.Null);
        Assert.That(controller.Animation.Skin, Is.Null);
        Assert.That(double.IsNaN(rig.Tip.X) || double.IsNaN(rig.Tip.Y) || double.IsNaN(rig.Tip.Z), Is.False);
        Assert.That(rig.Tip.DistanceTo(rig.TipBase), Is.EqualTo(ProceduralRig.SpearTipZ - ProceduralRig.SpearTrailBaseZ).Within(1e-9));
        Assert.That(controller.Simulation.Player.Move?.Id, Is.EqualTo(MoveId.N1));
      }
      finally
      {
        Object.Destroy(root);
      }
      yield return null;
    }
  }
}
