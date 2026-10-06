using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using Changshan.Combat;

namespace Changshan.Foundation.Tests
{
  // E08: replays TestData/combat/web-crowd.json (the Web Battle end to end: soldier AI, tokens, director pressure, the
  // four difficulties) through CombatSimulation. Small groups compare every recorded frame; the castle scenarios compare
  // per-second summaries.
  public static class CrowdParity
  {
    public const string FixturePath = "unity/ChangshanLongdan/TestData/combat/web-crowd.json";
    public const double FloatTolerance = 1e-4; // as ReactionParity: Float32 state, ULP differences amplified by normalised short vectors

    public sealed class Replay
    {
      public readonly CombatParity.Result Result = new CombatParity.Result();
      public readonly HashSet<EnemyState> StatesSeen = new HashSet<EnemyState>();
      public readonly HashSet<double> RingsSeen = new HashSet<double>();
      public int MaxAttackersSeen, MaxEngagedSeen, MaxAttackersAllowed;
      public List<string> InvariantFailures = new List<string>();
    }

    static List<object> L(object o) => (List<object>)o;
    static Dictionary<string, object> O(object o) => (Dictionary<string, object>)o;
    static double D(object o) => o is bool b ? (b ? 1 : 0) : (double)o;
    static bool B(object o) => o is bool b ? b : (double)o != 0;
    static string I(double v) => ((long)v).ToString(CultureInfo.InvariantCulture);
    static int FrameOf(double t, double hz) => Math.Max(0, (int)Math.Ceiling(t * hz - 1e-9));

    public static Dictionary<string, object> Load(string repoRoot) =>
      (Dictionary<string, object>)MiniJson.Parse(File.ReadAllText(Path.Combine(repoRoot, FixturePath)));

    public static IEnumerable<Dictionary<string, object>> Scenarios(Dictionary<string, object> fixture)
    {
      foreach (var s in L(fixture["scenarios"])) yield return O(s);
    }

    static readonly Dictionary<HitWindow, string> windowKeys = BuildWindowKeys();

    static Dictionary<HitWindow, string> BuildWindowKeys()
    {
      var map = new Dictionary<HitWindow, string>();
      foreach (var id in (MoveId[])Enum.GetValues(typeof(MoveId)))
      {
        var hits = Moves.Get(id).Hits;
        for (int i = 0; i < hits.Count; i++) map[hits[i]] = $"{id}:{i.ToString(CultureInfo.InvariantCulture)}";
      }
      return map;
    }

    public static DifficultyProfile DifficultyOf(string id)
    {
      switch (id)
      {
        case "beginner": return Difficulties.Beginner;
        case "normal": return Difficulties.Normal;
        case "hard": return Difficulties.Hard;
        case "chaos": return Difficulties.Chaos;
        default: throw new ArgumentOutOfRangeException(nameof(id), id);
      }
    }

    public static List<Spawn> SpawnsOf(Dictionary<string, object> scenario)
    {
      var list = new List<Spawn>();
      foreach (var item in L(scenario["spawns"]))
      {
        var s = L(item);
        list.Add(new Spawn(D(s[0]), D(s[1]), D(s[2]), (EnemyKind)(int)D(s[3])));
      }
      return list;
    }

    // Battle.reset order: the difficulty (captain health) before the soldiers are placed, then the player and director.
    public static CombatSimulation Create(Dictionary<string, object> scenario, out HitTargets targets)
    {
      var spawns = SpawnsOf(scenario);
      targets = new HitTargets(spawns.Count);
      var sim = new CombatSimulation(targets);
      // The Web Battle resets once in its constructor (normal difficulty) and again when the battle starts with the chosen
      // difficulty; the soldiers' rng stream has been drawn twice by then, so the replay resets twice as well.
      targets.Reset(spawns);
      sim.SetDifficulty(DifficultyOf((string)scenario["difficulty"]));
      targets.Reset(spawns);
      sim.Restart();
      return sim;
    }

    public static Replay Run(Dictionary<string, object> scenario)
    {
      var replay = new Replay();
      var result = replay.Result;
      double hz = D(scenario["hz"]);
      double dt = 1 / hz;
      bool summary = B(scenario["summary"]);
      var sim = Create(scenario, out var targets);
      replay.MaxAttackersAllowed = targets.MaxAttackers;
      var holds = L(scenario["holds"]);
      var presses = L(scenario["presses"]);
      var recorded = new Dictionary<int, Dictionary<string, object>>();
      foreach (var f in L(scenario[summary ? "summaries" : "frames"]))
      {
        var frame = O(f);
        recorded[(int)D(frame["f"])] = frame;
      }
      var labels = new Dictionary<uint, string>();
      var actual = new List<List<object>>();
      int steps = (int)Math.Round(D(scenario["duration"]) * hz);
      for (int frame = 0; frame < steps; frame++)
      {
        double t = frame * dt;
        var controls = new PlayerControls();
        foreach (var h in holds)
        {
          var hold = O(h);
          if (t + 1e-9 < D(hold["from"]) || t + 1e-9 >= D(hold["to"])) continue;
          if (hold.TryGetValue("guard", out var g) && B(g)) controls.Guard = true;
          if (hold.TryGetValue("move", out var m) && m != null)
          {
            controls.MoveX = D(L(m)[0]);
            controls.MoveZ = D(L(m)[1]);
          }
        }
        foreach (var p in presses)
        {
          var press = L(p);
          if (FrameOf(D(press[0]), hz) != frame) continue;
          switch ((string)press[1])
          {
            case "attack": controls.Attack = true; break;
            case "charge": controls.Charge = true; break;
            case "jump": controls.Jump = true; break;
            case "dodge": controls.Dodge = true; break;
            case "musou": controls.Musou = true; break;
          }
        }
        actual.Clear();
        if (sim.Step(dt, controls)) Collect(sim, actual, labels);
        Invariants(replay, sim, targets, frame);
        if (!recorded.TryGetValue(frame, out var expected)) continue;
        result.Frames++;
        string at = $"{scenario["id"]}@{hz}Hz frame {frame}";
        if (summary) CompareSummary(result, at, expected, sim, targets, actual);
        else Compare(result, at, expected, sim, targets, actual);
      }
      return replay;
    }

    static void Invariants(Replay replay, CombatSimulation sim, HitTargets targets, int frame)
    {
      int engaged = 0;
      for (int i = 0; i < targets.Count; i++)
      {
        if (!targets.Alive(i)) continue;
        replay.StatesSeen.Add(targets.State(i));
        if (targets.Engaged(i))
        {
          engaged++;
          replay.RingsSeen.Add(targets.Ring(i));
        }
        if (targets.Token(i) && !targets.Engaged(i)) replay.InvariantFailures.Add($"frame {frame}: soldier {i} holds a token without being engaged");
      }
      replay.MaxEngagedSeen = Math.Max(replay.MaxEngagedSeen, engaged);
      replay.MaxAttackersSeen = Math.Max(replay.MaxAttackersSeen, targets.Attackers);
      replay.MaxAttackersAllowed = Math.Max(replay.MaxAttackersAllowed, targets.MaxAttackers);
      if (targets.Attackers > targets.MaxAttackers) replay.InvariantFailures.Add($"frame {frame}: {targets.Attackers} attackers over the limit {targets.MaxAttackers}");
      if (engaged > HitTargets.MaxEngaged) replay.InvariantFailures.Add($"frame {frame}: {engaged} engaged over {HitTargets.MaxEngaged}");
    }

    static void Collect(CombatSimulation sim, List<List<object>> rows, Dictionary<uint, string> labels)
    {
      foreach (var e in sim.Events)
      {
        var row = new List<object>();
        switch (e.Type)
        {
          case CombatEventType.Hit:
          {
            uint stamp = sim.Hits[e.Start].Stamp;
            if (!labels.ContainsKey(stamp)) labels[stamp] = "P" + (labels.Count + 1).ToString(CultureInfo.InvariantCulture);
            row.Add("hit");
            row.Add($"{labels[stamp]}={windowKeys[e.Window]}");
            for (int i = e.Start; i < e.Start + e.Count; i++)
            {
              var h = sim.Hits[i];
              row.Add(new List<object> { (double)h.Target, h.Killed ? 1.0 : 0.0, (double)h.HpAfter, h.X, h.Y, h.Z, h.DirX, h.DirZ });
            }
            break;
          }
          case CombatEventType.Kill:
            row.Add("kill");
            for (int i = e.Start; i < e.Start + e.Count; i++)
            {
              var k = sim.Kills[i];
              row.Add(new List<object> { (double)k.Id, k.X, k.Y, k.Z, k.Vx, k.Vy, k.Vz, k.Yaw, k.Spin, (double)(int)k.Kind });
            }
            break;
          case CombatEventType.EnemyStrike: row.AddRange(new object[] { "enemyStrike", e.X, e.Z, e.Heavy ? 1.0 : 0.0 }); break;
          case CombatEventType.Parry: row.AddRange(new object[] { "parry", e.X, e.Z, e.Facing }); break;
          case CombatEventType.GuardBlock: row.AddRange(new object[] { "guardBlock", e.X, e.Z, e.Facing, e.Heavy ? 1.0 : 0.0, e.Damage }); break;
          case CombatEventType.Hurt: row.AddRange(new object[] { "hurt", e.X, e.Z, e.Heavy ? 1.0 : 0.0 }); break;
          case CombatEventType.Phase: row.AddRange(new object[] { "phase", (double)(int)e.Phase }); break;
        }
        rows.Add(row);
      }
    }

    static void CompareEvents(CombatParity.Result result, string at, Dictionary<string, object> frame, List<List<object>> actual)
    {
      var expectedEvents = frame.TryGetValue("e", out var ev) ? L(ev) : new List<object>();
      if (expectedEvents.Count != actual.Count)
      {
        result.Fail($"{at} events: expected {expectedEvents.Count}, got {actual.Count} ({string.Join(" ", actual.ConvertAll(r => (string)r[0]))})");
        return;
      }
      for (int i = 0; i < actual.Count; i++)
      {
        var e = L(expectedEvents[i]);
        var a = actual[i];
        string where = $"{at} event {i}";
        result.Text(where + " type", (string)e[0], (string)a[0]);
        if (e.Count != a.Count)
        {
          result.Fail($"{where}: expected {e.Count} fields, got {a.Count}");
          continue;
        }
        for (int k = 1; k < e.Count; k++)
        {
          if (e[k] is string es) result.Text($"{where} field {k}", es, (string)a[k]);
          else if (e[k] is List<object> el)
          {
            var al = (List<object>)a[k];
            for (int j = 0; j < el.Count; j++) result.Number($"{where} field {k}.{j}", D(el[j]), (double)al[j], j == 0 ? 0 : FloatTolerance);
          }
          else result.Number($"{where} field {k}", D(e[k]), (double)a[k], (string)a[0] == "phase" ? 0 : FloatTolerance);
        }
      }
    }

    static void Compare(CombatParity.Result result, string at, Dictionary<string, object> frame, CombatSimulation sim, HitTargets targets, List<List<object>> actual)
    {
      var p = sim.Player;
      var s = L(frame["s"]);
      result.Text(at + " state", (string)s[0], p.State.ToString().ToLowerInvariant());
      result.Text(at + " move", (string)s[1], p.Move == null ? "" : p.Move.Id.ToString());
      double[] values = { p.MoveTime, p.X, p.Y, p.Z, p.Facing, p.Musou, p.Hp, p.Invulnerable };
      string[] names = { "moveTime", "x", "y", "z", "facing", "musou", "hp", "invuln" };
      for (int i = 0; i < values.Length; i++) result.Number($"{at} {names[i]}", D(s[i + 2]), values[i], CombatParity.ContinuousTolerance);
      result.Number(at + " hitstop", D(frame["hs"]), sim.Clock.Hitstop, CombatParity.ContinuousTolerance);
      result.Text(at + " attackers", I(D(frame["attackers"])), targets.Attackers.ToString(CultureInfo.InvariantCulture));
      result.Text(at + " ko", I(D(frame["ko"])), sim.KoCount.ToString(CultureInfo.InvariantCulture));
      CompareEvents(result, at, frame, actual);
      var soldiers = L(frame["n"]);
      if (soldiers.Count != targets.Count)
      {
        result.Fail($"{at} soldiers: expected {soldiers.Count}, got {targets.Count}");
        return;
      }
      for (int i = 0; i < soldiers.Count; i++)
      {
        var n = L(soldiers[i]);
        string where = $"{at} soldier {i}";
        result.Text(where + " state", I(D(n[0])), ((int)targets.State(i)).ToString(CultureInfo.InvariantCulture));
        result.Text(where + " alive", I(D(n[1])), targets.Alive(i) ? "1" : "0");
        result.Number(where + " hp", D(n[2]), targets.Hp(i), 0);
        double[] v = { targets.X(i), targets.Y(i), targets.Z(i), targets.Vx(i), targets.Vy(i), targets.Vz(i), targets.Yaw(i), targets.Spin(i), targets.SpinVel(i), targets.Flash(i), targets.StateTime(i) };
        string[] vn = { "x", "y", "z", "vx", "vy", "vz", "yaw", "spin", "spinVel", "flash", "stateTime" };
        for (int k = 0; k < v.Length; k++) result.Number($"{where} {vn[k]}", D(n[k + 3]), v[k], FloatTolerance);
        result.Text(where + " engaged", I(D(n[14])), targets.Engaged(i) ? "1" : "0");
        result.Text(where + " token", I(D(n[15])), targets.Token(i) ? "1" : "0");
        result.Number(where + " ring", D(n[16]), targets.Ring(i), FloatTolerance);
        result.Number(where + " cooldown", D(n[17]), targets.Cooldown(i), FloatTolerance);
      }
    }

    static void CompareSummary(CombatParity.Result result, string at, Dictionary<string, object> frame, CombatSimulation sim, HitTargets targets, List<List<object>> actual)
    {
      var states = new int[12];
      int engaged = 0, tokens = 0;
      for (int i = 0; i < targets.Count; i++)
      {
        if (!targets.Alive(i)) continue;
        states[(int)targets.State(i)]++;
        if (targets.Engaged(i)) engaged++;
        if (targets.Token(i)) tokens++;
      }
      result.Text(at + " alive", I(D(frame["alive"])), targets.AliveCount.ToString(CultureInfo.InvariantCulture));
      result.Text(at + " engaged", I(D(frame["engaged"])), engaged.ToString(CultureInfo.InvariantCulture));
      result.Text(at + " tokens", I(D(frame["tokens"])), tokens.ToString(CultureInfo.InvariantCulture));
      result.Text(at + " attackers", I(D(frame["attackers"])), targets.Attackers.ToString(CultureInfo.InvariantCulture));
      result.Text(at + " ko", I(D(frame["ko"])), sim.KoCount.ToString(CultureInfo.InvariantCulture));
      var expectedStates = L(frame["states"]);
      for (int k = 0; k < 12; k++) result.Text($"{at} state count {k}", I(D(expectedStates[k])), states[k].ToString(CultureInfo.InvariantCulture));
      var p = sim.Player;
      var s = L(frame["s"]);
      result.Text(at + " player state", (string)s[0], p.State.ToString().ToLowerInvariant());
      result.Text(at + " player move", (string)s[1], p.Move == null ? "" : p.Move.Id.ToString());
      double[] values = { p.X, p.Z, p.Facing, p.Hp };
      string[] names = { "x", "z", "facing", "hp" };
      for (int i = 0; i < values.Length; i++) result.Number($"{at} player {names[i]}", D(s[i + 2]), values[i], FloatTolerance);
      result.Number(at + " hitstop", D(frame["hs"]), sim.Clock.Hitstop, CombatParity.ContinuousTolerance);
      CompareEvents(result, at, frame, actual);
    }
  }
}
