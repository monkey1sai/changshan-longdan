using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Changshan.Animation;
using Changshan.Character;
using Changshan.Combat;
using NUnit.Framework;
using UnityEngine;

namespace Changshan.Foundation.Tests
{
  // E06: the Web procedural rig and skin binding replayed against the unmodified Web (TestData/combat/web-rig.json),
  // and the acceptance numbers measured on what is shown (with the E06 foot plant).
  public sealed class RigParityEditTests
  {
    static readonly string[] ScenarioIds =
    {
      "run_stop_turn", "normal_string", "charge_c1_c2", "charge_c3", "charge_c4", "charge_c5", "charge_c6", "jump_land", "dodge_dash",
      "guard_counter", "hurt_down", "musou",
    };

    static string root;
    static Dictionary<string, object> fixture;
    static readonly Dictionary<string, AnimationMetrics> measured = new Dictionary<string, AnimationMetrics>();

    static Dictionary<string, object> Fixture
    {
      get
      {
        if (fixture != null) return fixture;
        root = CombatParity.RepoRoot(Directory.GetParent(Application.dataPath).FullName);
        return fixture = RigParity.Load(root);
      }
    }

    static IEnumerable<Dictionary<string, object>> At(double hz) => RigParity.Scenarios(Fixture).Where(s => (double)s["hz"] == hz);

    static AnimationMetrics Measure(Dictionary<string, object> s, bool footPlant)
    {
      string key = $"{s["id"]}@{s["hz"]}:{footPlant}";
      if (!measured.TryGetValue(key, out var m)) measured[key] = m = RigParity.Measure(Fixture, s, footPlant);
      return m;
    }

    [Test] public void FixtureWasGeneratedFromTheCurrentWebSource()
    {
      Assert.That(Fixture["schemaVersion"], Is.EqualTo(1.0));
      var result = CombatParity.CompareSources(Fixture, root);
      Assert.That(result.FailCount, Is.Zero, result.ToString());
    }

    // Exact set, so regenerating the fixture cannot silently drop a part of the plan's route.
    [Test] public void ScenarioSetIsComplete()
    {
      foreach (double hz in new double[] { 30, 60, 120 })
        Assert.That(At(hz).Select(s => (string)s["id"]), Is.EquivalentTo(ScenarioIds), $"{hz} Hz");
    }

    [TestCase(30), TestCase(60), TestCase(120)]
    public void RigTracesMatchWeb(double hz)
    {
      var all = new CombatParity.Result();
      foreach (var s in At(hz)) all.Merge((string)s["id"], RigParity.Run(Fixture, s).Result);
      TestContext.WriteLine(all.ToString());
      Assert.That(all.FailCount, Is.Zero, all.ToString());
      // Every recorded frame was compared: the Web records each scenario's frames at the rate's sampling interval.
      double every = Convert.ToDouble(((Dictionary<string, object>)Fixture["sampleEvery"])[hz.ToString(System.Globalization.CultureInfo.InvariantCulture)]);
      int expected = At(hz).Sum(s => (int)Math.Ceiling(Math.Round((double)s["duration"] * hz) / every));
      Assert.That(all.Frames, Is.EqualTo(expected));
    }

    [Test] public void EveryMoveIsPosed()
    {
      var started = At(60).SelectMany(s => ((List<object>)s["started"]).Cast<string>()).Distinct();
      Assert.That(started, Is.EquivalentTo(Enum.GetNames(typeof(MoveId))));
    }

    // Plan threshold: hands on the spear, p95 within 3 cm (left hand only while it holds the spear).
    [Test] public void HandsStayOnTheSpear()
    {
      foreach (var s in RigParity.Scenarios(Fixture))
      {
        var m = Measure(s, true);
        TestContext.WriteLine($"{s["id"]}@{s["hz"]} {m}");
        Assert.That(m.RightGripP95, Is.LessThanOrEqualTo(AnimationMetrics.GripLimit), $"{s["id"]}@{s["hz"]}");
        Assert.That(m.LeftGripP95, Is.LessThanOrEqualTo(AnimationMetrics.GripLimit), $"{s["id"]}@{s["hz"]}");
      }
    }

    // Plan threshold: no root motion beyond the logic position's (the logic position is the only displacement authority).
    [Test] public void RootFollowsOnlyTheLogicPosition()
    {
      foreach (var s in RigParity.Scenarios(Fixture))
        Assert.That(Measure(s, true).RootJumpMax, Is.LessThanOrEqualTo(1e-9), $"{s["id"]}@{s["hz"]}");
    }

    // Plan threshold: a planted foot drifts at most 5 cm. The Web rig alone slides far more (turning in place,
    // starting and stopping a run, settling into stance), which is why the foot plant exists.
    [Test] public void FootPlantKeepsPlantedFeetStill()
    {
      foreach (var s in RigParity.Scenarios(Fixture))
      {
        var m = Measure(s, true);
        Assert.That(m.PlantSlipMax, Is.LessThanOrEqualTo(AnimationMetrics.PlantSlipLimit), $"{s["id"]}@{s["hz"]}: {m}");
        Assert.That(m.Plants, Is.GreaterThan(0), $"{s["id"]}@{s["hz"]}: no plant measured");
      }
      foreach (var s in RigParity.Scenarios(Fixture).Where(s => (string)s["id"] == "run_stop_turn"))
      {
        var web = Measure(s, false);
        Assert.That(web.PlantSlipMax, Is.GreaterThan(0.3), $"{s["hz"]} Hz: the Web-only baseline no longer shows the slide this layer fixes");
        Assert.That(Measure(s, true).PlantSlipMax, Is.LessThan(web.PlantSlipMax / 10));
      }
    }

    [Test] public void FootPlantStepsAndReleases()
    {
      var turn = RigParity.Scenarios(Fixture).Single(s => (string)s["id"] == "run_stop_turn" && (double)s["hz"] == 60);
      var (rig, _) = RigParity.CreateRig(Fixture);
      var plant = new FootPlant();
      var player = new Player();
      var arena = ArenaLayout.CreateArena();
      player.Reset(ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
      rig.ResetCape();
      // The plan's run, stop and turn: the Web target swings around the body when turning, so the locked feet must step.
      int frames = (int)Math.Round((double)turn["duration"] * 60);
      for (int frame = 0; frame < frames; frame++)
      {
        player.Update(1.0 / 60, RigParity.ControlsAt(turn, frame, 60), null, arena);
        rig.Update(player, 1.0 / 60, (frame + 1) / 60.0);
        plant.Apply(rig, player, 1.0 / 60);
      }
      Assert.That(plant.Steps, Is.GreaterThan(0));
      Assert.That(plant.LeftMode, Is.EqualTo(FootPlant.Mode.Locked));
      // An attack is designed displacement: the feet are handed back to the Web rig.
      player.Update(1.0 / 60, new PlayerControls { Attack = true }, null, arena);
      for (int frame = 0; frame < 12; frame++)
      {
        rig.Update(player, 1.0 / 60, 2 + frame / 60.0);
        plant.Apply(rig, player, 1.0 / 60);
        player.Update(1.0 / 60, default, null, arena);
      }
      Assert.That(player.State, Is.EqualTo(PlayerState.Attack));
      Assert.That(plant.LeftMode, Is.EqualTo(FootPlant.Mode.Follow));
      Assert.That(plant.Left.DistanceTo(rig.FootAnchorL.Position), Is.LessThan(1e-9));
    }

    // Review finding: the lift arc must be decided when a step starts. Switching it with the Web foot's ground contact
    // mid-step dropped the shown foot by up to LiftHeight in one frame. Drives the Web target directly.
    [Test] public void FootPlantLiftIsDecidedWhenTheStepStarts()
    {
      const double dt = 1.0 / 60;
      var rig = new ProceduralRig();
      var plant = new FootPlant();
      var player = new Player();
      player.Reset(ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
      rig.ResetCape();
      rig.Update(player, dt, dt); // standing: FeetGrounded, legs solvable
      double ground = ProceduralRig.SoleAnchorY;
      var start = rig.FootAnchorL.Position;
      start.Y = ground;
      // The plant layer's own vertical discontinuity: the shown foot's change minus the Web target's change per frame
      // (PlaceFeet rewrites the anchor, so the target is tracked here, not read back from the rig).
      double worstJump = 0, previousDesired = 0;
      bool first = true;
      void Frame(Vec3 desired)
      {
        double before = plant.Left.Y;
        rig.FootAnchorL.Position = desired;
        plant.Apply(rig, player, dt);
        if (!first) worstJump = Math.Max(worstJump, Math.Abs((plant.Left.Y - before) - (desired.Y - previousDesired)));
        first = false;
        previousDesired = desired.Y;
      }
      for (int i = 0; i < 3; i++) Frame(start);
      Assert.That(plant.LeftMode, Is.EqualTo(FootPlant.Mode.Locked));
      // A lifted step (target still on the ground), then the Web foot leaves the ground half-way through.
      var far = start + new Vec3(0.2, 0, 0);
      for (int i = 0; i < 4; i++) Frame(far);
      Assert.That(plant.LeftMode, Is.EqualTo(FootPlant.Mode.Stepping));
      for (int i = 1; i <= 8; i++) Frame(far + new Vec3(0, 0.01 * i, 0));
      // A catch-up step (the Web foot lifting off), then the Web foot lands half-way through.
      for (int i = 0; i < 6; i++) Frame(start);
      Assert.That(plant.LeftMode, Is.EqualTo(FootPlant.Mode.Locked));
      Frame(start + new Vec3(0.03, 0.005, 0));
      Assert.That(plant.LeftMode, Is.EqualTo(FootPlant.Mode.Stepping));
      Frame(start + new Vec3(0.045, 0.015, 0));
      for (int i = 0; i < 6; i++) Frame(start + new Vec3(0.05, 0, 0));
      Assert.That(plant.Steps, Is.EqualTo(2));
      // The lift arc itself moves ~3 cm per frame at 60 Hz (measured 0.0296); switching the arc with the target's ground
      // contact jumped 0.0718 in one frame.
      Assert.That(worstJump, Is.LessThan(0.04), "the plant layer moved a foot vertically by a jump within one frame");
    }

    [Test] public void SkinRejectsMissingOrDegenerateBones()
    {
      var (nodes, roots) = RigParity.GlbNodes(Fixture);
      var missing = nodes.Select(n => new GltfNodeData
      {
        Name = n.Name == "hand_l" ? "hand_left" : n.Name, Children = n.Children, Translation = n.Translation, Rotation = n.Rotation, Scale = n.Scale, Matrix = n.Matrix,
      }).ToList();
      var e = Assert.Throws<InvalidOperationException>(() => new SkinBinding(SkinBinding.BuildScene(missing, roots), new ProceduralRig()));
      StringAssert.StartsWith("SKIN_BONE_MISSING: hand_l", e.Message);
      int calf = nodes.FindIndex(n => n.Name == "calf_l");
      var collapsed = nodes.Select((n, i) => new GltfNodeData
      {
        Name = n.Name, Children = n.Children, Translation = i == calf ? new double[] { 0, 0, 0 } : n.Translation, Rotation = n.Rotation, Scale = n.Scale, Matrix = n.Matrix,
      }).ToList();
      e = Assert.Throws<InvalidOperationException>(() => new SkinBinding(SkinBinding.BuildScene(collapsed, roots), new ProceduralRig()));
      StringAssert.StartsWith("SKIN_BONE_LENGTH_INVALID: thigh_l", e.Message);
    }

    // glTFast negates X; the animation mirrors bones back and forth with the same involution.
    [Test] public void MirrorBetweenLogicAndImportRoundTrips()
    {
      var v = new Vec3(0.3, -1.2, 4.5);
      var q = new Quat(0.1, 0.7, -0.2, 0.68).Normalized();
      var mv = CharacterAnimation.Mirror(v);
      Assert.That(mv, Is.EqualTo(new Vector3(-0.3f, -1.2f, 4.5f)));
      var back = CharacterAnimation.Unmirror(mv);
      Assert.That(back.DistanceTo(v), Is.LessThan(1e-6));
      var mq = CharacterAnimation.Unmirror(CharacterAnimation.Mirror(q));
      Assert.That(Math.Abs(mq.Dot(q)), Is.EqualTo(1).Within(1e-6));
      // A mirrored rotation applied to a mirrored vector equals the mirror of the original rotation of the vector.
      var rotated = CharacterAnimation.Mirror(v.ApplyQuaternion(q));
      var viaUnity = CharacterAnimation.Mirror(q) * CharacterAnimation.Mirror(v);
      Assert.That(Vector3.Distance(rotated, viaUnity), Is.LessThan(1e-5f));
    }
  }
}
