using System;
using System.Collections.Generic;
using System.IO;
using Changshan.Animation;
using Changshan.Combat;

namespace Changshan.Foundation.Tests
{
  // Replays TestData/combat/web-rig.json (scripts/lib/rig-parity.ts): the Web Player, PlayerModel driver rig and
  // ZhaoYunSkin bones, frame by frame, against Player + ProceduralRig + SkinBinding. Values in the fixture are rounded
  // to 1e-6, so continuous values are compared within RigTolerance.
  public static class RigParity
  {
    public const string FixturePath = "unity/ChangshanLongdan/TestData/combat/web-rig.json";
    public const double RigTolerance = 2e-6;

    public sealed class Replay
    {
      public readonly CombatParity.Result Result = new CombatParity.Result();
      public readonly List<string> Started = new List<string>();
      public readonly List<double> RightGrip = new List<double>();
      public readonly List<double> LeftGrip = new List<double>(); // only while the left hand holds the spear
    }

    public static Dictionary<string, object> Load(string repoRoot) =>
      (Dictionary<string, object>)MiniJson.Parse(File.ReadAllText(Path.Combine(repoRoot, FixturePath)));

    static List<object> L(object o) => (List<object>)o;
    static Dictionary<string, object> O(object o) => (Dictionary<string, object>)o;
    static double D(object o) => o is bool b ? (b ? 1 : 0) : (double)o;
    static bool B(object o) => o is bool b ? b : (double)o != 0;

    public static IEnumerable<Dictionary<string, object>> Scenarios(Dictionary<string, object> fixture)
    {
      foreach (var s in L(fixture["scenarios"])) yield return O(s);
    }

    public static (List<GltfNodeData> Nodes, List<int> Roots) GlbNodes(Dictionary<string, object> fixture)
    {
      var glb = O(fixture["glb"]);
      var nodes = new List<GltfNodeData>();
      foreach (var item in L(glb["nodes"]))
      {
        var n = O(item);
        double[] Arr(object o) => o == null ? null : L(o).ConvertAll(D).ToArray();
        nodes.Add(new GltfNodeData
        {
          Name = (string)n["name"], Children = L(n["children"]).ConvertAll(c => (int)D(c)).ToArray(),
          Translation = Arr(n["t"]), Rotation = Arr(n["r"]), Scale = Arr(n["s"]), Matrix = Arr(n["m"]),
        });
      }
      return (nodes, L(glb["scene"]).ConvertAll(c => (int)D(c)));
    }

    public static (ProceduralRig Rig, SkinBinding Skin) CreateRig(Dictionary<string, object> fixture)
    {
      var (nodes, roots) = GlbNodes(fixture);
      var rig = new ProceduralRig();
      var skin = new SkinBinding(SkinBinding.BuildScene(nodes, roots), rig);
      return (rig, skin);
    }

    static RigNode NodeOf(ProceduralRig rig, string name)
    {
      switch (name)
      {
        case "root": return rig.Root;
        case "hips": return rig.Hips;
        case "torso": return rig.Torso;
        case "head": return rig.Head;
        case "spear": return rig.Spear;
        case "handL": return rig.HandAnchorL;
        case "handR": return rig.HandAnchorR;
        case "footL": return rig.FootAnchorL;
        case "footR": return rig.FootAnchorR;
        case "upperL": return rig.UpperL;
        case "upperR": return rig.UpperR;
        case "cape0": return rig.Cape[0];
        case "cape3": return rig.Cape[3];
        default: throw new ArgumentException($"unknown rig node {name}");
      }
    }

    static void CompareTransform(CombatParity.Result result, string at, List<object> expected, Mat4 world, bool withScale)
    {
      world.Decompose(out var p, out var q, out var s);
      // q and -q are the same rotation; compare with the sign that matches the expected value.
      double sign = q.X * D(expected[3]) + q.Y * D(expected[4]) + q.Z * D(expected[5]) + q.W * D(expected[6]) < 0 ? -1 : 1;
      double[] actual = withScale
        ? new[] { p.X, p.Y, p.Z, q.X * sign, q.Y * sign, q.Z * sign, q.W * sign, s.X, s.Y, s.Z }
        : new[] { p.X, p.Y, p.Z, q.X * sign, q.Y * sign, q.Z * sign, q.W * sign };
      for (int i = 0; i < actual.Length; i++) result.Number($"{at}[{i}]", D(expected[i]), actual[i], RigTolerance);
    }

    public static Replay Run(Dictionary<string, object> fixture, Dictionary<string, object> scenario, PlayerTuning tuning = null)
    {
      var replay = new Replay();
      var result = replay.Result;
      double hz = D(scenario["hz"]);
      double dt = 1 / hz;
      var (rig, skin) = CreateRig(fixture);
      var player = new Player(tuning);
      var arena = ArenaLayout.CreateArena();
      player.Reset(ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
      rig.ResetCape();
      var ops = OpsByFrame(scenario, hz);
      var frames = L(scenario["frames"]);
      int recorded = 0;
      int lastFrame = (int)D(O(frames[frames.Count - 1])["f"]);
      for (int frame = 0; frame <= lastFrame; frame++)
      {
        if (ops.TryGetValue(frame, out var list))
          foreach (var op in list)
          {
            if ((string)op[0] == "hit") player.TakeHit(D(op[1]), B(op[2]), D(op[3]), D(op[4]));
            else player.GainMusou(D(op[1]));
          }
        var rec = recorded < frames.Count && (int)D(O(frames[recorded])["f"]) == frame ? O(frames[recorded]) : null;
        var c = ControlsAt(scenario, frame, hz);
        player.Update(dt, c, null, arena);
        foreach (var e in player.Events) if (e.Type == PlayerEventType.MoveStart) replay.Started.Add(e.Move.ToString());
        rig.Update(player, dt, (frame + 1) * dt);
        skin.Update(rig.Pose.Lh);
        if (rec == null) continue;
        recorded++;
        string at = $"{scenario["id"]}@{hz}Hz frame {frame}";
        var cs = L(rec["c"]);
        double[] controls = { c.MoveX, c.MoveZ, c.Attack ? 1 : 0, c.Charge ? 1 : 0, c.Jump ? 1 : 0, c.Dodge ? 1 : 0, c.Musou ? 1 : 0, c.Guard ? 1 : 0 };
        result.Text(at + " controls", string.Join(",", cs.ConvertAll(x => CombatParity.R(D(x)))), string.Join(",", Array.ConvertAll(controls, CombatParity.R)));
        var st = L(rec["st"]);
        result.Text(at + " state", (string)st[0], StateName(player.State));
        var pose = rig.Pose;
        var ep = L(rec["pose"]);
        for (int i = 0; i < 13; i++) result.Number($"{at} pose.{Pose.FieldNames[i]}", D(ep[i]), pose[i], RigTolerance);
        rig.GripErrors(out double right, out double left);
        double[] values = { rig.VisualFacing, rig.Fade, rig.RunBlend, right, left };
        var ev = L(rec["v"]);
        for (int i = 0; i < values.Length; i++) result.Number($"{at} v[{i}]", D(ev[i]), values[i], RigTolerance);
        var tip = L(rec["tip"]);
        double[] tips = { rig.Tip.X, rig.Tip.Y, rig.Tip.Z, rig.TipBase.X, rig.TipBase.Y, rig.TipBase.Z };
        for (int i = 0; i < 6; i++) result.Number($"{at} tip[{i}]", D(tip[i]), tips[i], RigTolerance);
        foreach (var entry in O(rec["n"])) CompareTransform(result, $"{at} {entry.Key}", L(entry.Value), NodeOf(rig, entry.Key).WorldMatrix, false);
        if (rec.TryGetValue("b", out var b))
          foreach (var entry in O(b)) CompareTransform(result, $"{at} bone {entry.Key}", L(entry.Value), BoneOf(skin, entry.Key).WorldMatrix, true);
        replay.RightGrip.Add(right);
        if (pose.Lh > .98) replay.LeftGrip.Add(left);
        result.Frames++;
      }
      result.Text($"{scenario["id"]}@{hz}Hz started", string.Join(",", L(scenario["started"]).ConvertAll(x => (string)x)), string.Join(",", replay.Started));
      if (recorded != frames.Count) result.Fail($"{scenario["id"]}@{hz}Hz: {frames.Count - recorded} recorded frames not reached");
      return replay;
    }

    // Runs a route scenario at its rate and measures what would be shown, with or without the E06 foot plant.
    public static AnimationMetrics Measure(Dictionary<string, object> fixture, Dictionary<string, object> scenario, bool footPlant)
    {
      double hz = D(scenario["hz"]);
      double dt = 1 / hz;
      var (rig, skin) = CreateRig(fixture);
      var plant = new FootPlant();
      var metrics = new AnimationMetrics();
      var player = new Player();
      var arena = ArenaLayout.CreateArena();
      player.Reset(ArenaLayout.StartX, ArenaLayout.StartZ, ArenaLayout.StartFacing);
      rig.ResetCape();
      var ops = OpsByFrame(scenario, hz);
      int frames = (int)Math.Round(D(scenario["duration"]) * hz);
      for (int frame = 0; frame < frames; frame++)
      {
        if (ops.TryGetValue(frame, out var list))
          foreach (var op in list)
          {
            if ((string)op[0] == "hit") player.TakeHit(D(op[1]), B(op[2]), D(op[3]), D(op[4]));
            else player.GainMusou(D(op[1]));
          }
        player.Update(dt, ControlsAt(scenario, frame, hz), null, arena);
        rig.Update(player, dt, (frame + 1) * dt);
        var desiredL = rig.FootAnchorL.Position;
        var desiredR = rig.FootAnchorR.Position;
        if (footPlant) plant.Apply(rig, player, dt);
        skin.Update(rig.Pose.Lh);
        metrics.Add(player, rig, dt, rig.FootAnchorL.Position, rig.FootAnchorR.Position, desiredL, desiredR);
      }
      return metrics;
    }

    static string StateName(PlayerState s)
    {
      string name = s.ToString();
      return char.ToLowerInvariant(name[0]) + name.Substring(1);
    }

    static RigNode BoneOf(SkinBinding skin, string name) => name == SkinBinding.WeaponName ? skin.Weapon : skin.Bone(name);

    static Dictionary<int, List<List<object>>> OpsByFrame(Dictionary<string, object> scenario, double hz)
    {
      var map = new Dictionary<int, List<List<object>>>();
      if (!scenario.TryGetValue("ops", out var ops)) return map;
      foreach (var item in L(ops))
      {
        var pair = L(item);
        int frame = FrameOf(D(pair[0]), hz);
        if (!map.TryGetValue(frame, out var list)) map[frame] = list = new List<List<object>>();
        list.Add(L(pair[1]));
      }
      return map;
    }

    static int FrameOf(double t, double hz) => Math.Max(0, (int)Math.Ceiling(t * hz - 1e-9));

    public static PlayerControls ControlsAt(Dictionary<string, object> scenario, int frame, double hz)
    {
      var c = new PlayerControls();
      foreach (var item in L(scenario["holds"]))
      {
        var h = O(item);
        if (FrameOf(D(h["from"]), hz) <= frame && frame < FrameOf(D(h["to"]), hz))
        {
          if (h.TryGetValue("move", out var move)) { c.MoveX = D(L(move)[0]); c.MoveZ = D(L(move)[1]); }
          if (h.TryGetValue("guard", out var guard) && B(guard)) c.Guard = true;
        }
      }
      foreach (var item in L(scenario["presses"]))
      {
        var pr = L(item);
        if (FrameOf(D(pr[0]), hz) != frame) continue;
        switch ((string)pr[1])
        {
          case "attack": c.Attack = true; break;
          case "charge": c.Charge = true; break;
          case "jump": c.Jump = true; break;
          case "dodge": c.Dodge = true; break;
          case "musou": c.Musou = true; break;
        }
      }
      return c;
    }
  }
}
