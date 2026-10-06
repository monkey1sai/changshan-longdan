using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Changshan.Combat;

namespace Changshan.Foundation.Tests
{
  // Replays TestData/combat/web-hits.json (scripts/lib/hit-parity.ts) through CombatSimulation. Hit-window instances
  // are global counters in the Web, so both sides name them by first appearance: P1, P2… for the player's windows in
  // ActiveHits order, F1, F2… for the second source in the order it first hits.
  public static class HitParity
  {
    public const string FixturePath = "unity/ChangshanLongdan/TestData/combat/web-hits.json";

    public sealed class Replay
    {
      public readonly CombatParity.Result Result = new CombatParity.Result();
      public readonly List<string> Hits = new List<string>(); // "label=MOVE:i>target" in order
      public readonly List<HitEvent> Events = new List<HitEvent>();
      public double MaxHitstop;
      public double MaxWindowHitstop;
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

    public static HitTargets Targets(Dictionary<string, object> scenario)
    {
      var list = L(scenario["targets"]);
      var targets = new HitTargets(list.Count) { Static = true }; // the E05 harness never runs the soldiers' update()
      foreach (var item in list)
      {
        var t = L(item);
        targets.Add(D(t[0]), D(t[1]), D(t[2]), D(t[3]), (float)D(t[4]));
      }
      return targets;
    }

    // compareFrames: false for the divergent scenario, where Unity's stricter identity changes the timeline on purpose.
    public static Replay Run(Dictionary<string, object> scenario, bool compareFrames)
    {
      var replay = new Replay();
      var result = replay.Result;
      double hz = D(scenario["hz"]);
      double dt = 1 / hz;
      var sim = new CombatSimulation(Targets(scenario));
      sim.Restart();
      double gain = D(scenario["gain"]);
      if (gain > 0) sim.Player.GainMusou(gain);

      HitWindow foreignWindow = null;
      double foreignEvery = 0, foreignTimer = 0;
      double[] foreignAt = null;
      uint foreignStamp = 0;
      if (scenario["foreign"] is Dictionary<string, object> foreign)
      {
        var w = O(foreign["window"]);
        foreignWindow = new HitWindow(0, 0, HitShape.Circle(D(w["range"])), D(w["damage"]), Reaction.Launch, push: 0, lift: 0,
          hitstop: D(w["hitstop"]), shake: 0, radial: B(w["radial"]), yMin: w["yMin"] == null ? (double?)null : D(w["yMin"]),
          yMax: w["yMax"] == null ? (double?)null : D(w["yMax"]));
        foreignEvery = D(foreign["every"]);
        var at = L(foreign["at"]);
        foreignAt = new[] { D(at[0]), D(at[1]), D(at[2]) };
      }

      var labels = new Dictionary<uint, string>();
      int playerLabels = 0, foreignLabels = 0;
      var frames = L(scenario["frames"]);
      var row = new List<(string Name, int Target, bool Killed, float Hp)>();
      for (int f = 0; f < frames.Count; f++)
      {
        var frame = O(frames[f]);
        string at = $"{scenario["id"]}@{hz}Hz frame {f}";
        var c = L(frame["c"]);
        var controls = new PlayerControls
        {
          MoveX = D(c[0]), MoveZ = D(c[1]), Attack = B(c[2]), Charge = B(c[3]), Jump = B(c[4]), Dodge = B(c[5]), Musou = B(c[6]), Guard = B(c[7]),
        };
        row.Clear();
        // The second source hits inside the step, after the player's windows, like updateDragon in Game.simulate.
        Action<double> second = null;
        if (foreignWindow != null)
          second = _ =>
          {
            foreignTimer -= dt;
            if (foreignTimer <= 0)
            {
              foreignTimer = foreignEvery;
              foreignStamp = sim.Stamps.Next();
            }
            sim.ApplyExternal(foreignStamp, foreignWindow, foreignAt[0], foreignAt[1], foreignAt[2], 0);
          };
        if (sim.Step(dt, controls, second))
        {
          foreach (var h in sim.Player.ActiveHits)
            if (!labels.ContainsKey(h.Stamp)) labels[h.Stamp] = "P" + (++playerLabels).ToString(CultureInfo.InvariantCulture);
          foreach (var e in sim.Hits)
          {
            string name;
            if (e.Source == HitSource.Player)
            {
              name = $"{labels[e.Stamp]}={e.Move}:{e.WindowIndex.ToString(CultureInfo.InvariantCulture)}";
              replay.MaxWindowHitstop = Math.Max(replay.MaxWindowHitstop, Moves.Get(e.Move.Value).Hits[e.WindowIndex].Hitstop);
            }
            else
            {
              if (!labels.ContainsKey(e.Stamp)) labels[e.Stamp] = "F" + (++foreignLabels).ToString(CultureInfo.InvariantCulture);
              name = labels[e.Stamp];
            }
            row.Add((name, e.Target, e.Killed, e.HpAfter));
            replay.Hits.Add($"{name}>{e.Target.ToString(CultureInfo.InvariantCulture)}");
            replay.Events.Add(e);
          }
        }
        row.Sort((a, b) => a.Name == b.Name ? a.Target.CompareTo(b.Target) : string.CompareOrdinal(a.Name, b.Name));
        replay.MaxHitstop = Math.Max(replay.MaxHitstop, sim.Clock.Hitstop);
        result.Frames++;
        if (!compareFrames) continue;

        var p = sim.Player;
        var s = L(frame["s"]);
        result.Text(at + " state", (string)s[0], p.State.ToString().ToLowerInvariant());
        result.Text(at + " move", (string)s[1], p.Move == null ? "" : p.Move.Id.ToString());
        double[] actual = { p.MoveTime, p.X, p.Y, p.Z, p.Facing, p.Musou };
        string[] names = { "moveTime", "x", "y", "z", "facing", "musou" };
        for (int i = 0; i < actual.Length; i++) result.Number($"{at} {names[i]}", D(s[i + 2]), actual[i], CombatParity.ContinuousTolerance);
        result.Number(at + " hitstop", D(frame["hs"]), sim.Clock.Hitstop, CombatParity.ContinuousTolerance);
        var expected = frame.TryGetValue("h", out var hs) ? L(hs) : new List<object>();
        if (expected.Count != row.Count)
        {
          result.Fail($"{at} hits: expected {expected.Count}, got {row.Count} ({string.Join(" ", row.ConvertAll(r => r.Name + ">" + r.Target))})");
          continue;
        }
        for (int i = 0; i < row.Count; i++)
        {
          var e = L(expected[i]);
          string hit = $"{at} hit {i}";
          result.Text(hit + " window", (string)e[0], row[i].Name);
          result.Text(hit + " target", ((int)D(e[1])).ToString(CultureInfo.InvariantCulture), row[i].Target.ToString(CultureInfo.InvariantCulture));
          result.Text(hit + " killed", B(e[2]).ToString(), row[i].Killed.ToString());
          // Health is single precision on both sides and must match exactly.
          result.Number(hit + " hp", D(e[3]), row[i].Hp, 0);
        }
      }
      return replay;
    }

    // Distinct and duplicated player (window instance, soldier) pairs recorded by the Web for one scenario.
    public static (HashSet<string> Distinct, int Duplicates) WebPlayerPairs(Dictionary<string, object> scenario)
    {
      var seen = new HashSet<string>();
      int duplicates = 0;
      foreach (var item in L(scenario["frames"]))
      {
        if (!O(item).TryGetValue("h", out var hs)) continue;
        foreach (var h in L(hs))
        {
          var e = L(h);
          string name = (string)e[0];
          if (!name.StartsWith("P", StringComparison.Ordinal)) continue;
          if (!seen.Add($"{name}>{((int)D(e[1])).ToString(CultureInfo.InvariantCulture)}")) duplicates++;
        }
      }
      return (seen, duplicates);
    }
  }
}
