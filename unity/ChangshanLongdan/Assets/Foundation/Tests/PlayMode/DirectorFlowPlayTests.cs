using System.Collections;
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
  public sealed class DirectorFlowPlayTests
  {
    const double Dt = 1.0 / 60;
    sealed class NoInput : IRawInputSource { public void Feed(InputMapper mapper) {} }
    sealed class AttackInput : IRawInputSource
    {
      int frame;
      public void Feed(InputMapper mapper)
      {
        if (frame == 0) mapper.KeyDown("KeyJ");
        if (frame == 1) mapper.KeyUp("KeyJ");
        frame++;
      }
    }
    string savedPref;
    bool hadPref;

    [SetUp] public void SaveLocale()
    {
      hadPref = PlayerPrefs.HasKey(BattleStrings.LocalePref);
      savedPref = PlayerPrefs.GetString(BattleStrings.LocalePref);
      BattleStrings.SetLocaleForSession(BattleStrings.Chinese);
    }

    [TearDown] public void RestoreLocale()
    {
      if (hadPref) PlayerPrefs.SetString(BattleStrings.LocalePref, savedPref);
      else PlayerPrefs.DeleteKey(BattleStrings.LocalePref);
      PlayerPrefs.Save();
      BattleStrings.SetLocaleForSession(null);
    }

    static IEnumerator Scene(System.Action<ZhaoYunController> ready)
    {
      yield return SceneManager.LoadSceneAsync("Foundation", LoadSceneMode.Single);
      yield return null;
      var controller = Object.FindObjectsByType<ZhaoYunController>().Single();
      controller.enabled = false;
      controller.InputSource = new NoInput();
      controller.SetFocus(true);
      ready(controller);
    }

    [UnityTest] public IEnumerator BannersUseExactWebStringsDurationGoldAndLiveLocale()
    {
      ZhaoYunController c = null;
      yield return Scene(controller => c = controller);
      var view = c.Effects;
      var phases = new[] { BattlePhase.Opening, BattlePhase.Pressure, BattlePhase.Surge, BattlePhase.Finale };
      var zh = new[] { "魏軍列陣", "敵軍壓上！", "攻勢加劇！", "最後包圍！" };
      var en = new[] { "Wei troops assemble", "The enemy advances!", "The assault intensifies!", "The final encirclement!" };
      for (int i = 0; i < phases.Length; i++)
      {
        BattleStrings.SetLocaleForSession(BattleStrings.Chinese);
        view.ShowBattleBanner(CombatEvent.PhaseChanged(phases[i]));
        Assert.That(view.BannerText, Is.EqualTo(zh[i]));
        Assert.That(view.BannerLeft, Is.EqualTo(2));
        Assert.That(view.BannerGold, Is.False);
        view.AfterAnimate(c.Simulation, null, 0, 0.5);
        BattleStrings.SetLocaleForSession(BattleStrings.English);
        Assert.That(view.BannerText, Is.EqualTo(en[i]));
        Assert.That(view.BannerLeft, Is.EqualTo(1.5), "locale refresh must not restart the timer");
      }
      view.ShowBattleBanner(CombatEvent.Milestone(200));
      Assert.That(view.BannerText, Is.EqualTo("200 KOs!"));
      Assert.That(view.BannerGold, Is.True);
      BattleStrings.SetLocaleForSession(BattleStrings.Chinese);
      Assert.That(view.BannerText, Is.EqualTo("200 人斬！"));
      view.ShowBattleBanner(CombatEvent.HalfDefeated());
      Assert.That(view.BannerText, Is.EqualTo("魏軍 半數潰滅"));
      Assert.That(view.BannerGold, Is.False);
      BattleStrings.SetLocaleForSession(BattleStrings.English);
      Assert.That(view.BannerText, Is.EqualTo("Half the Wei Army Defeated"));
      view.AfterAnimate(c.Simulation, null, 0, 1.99);
      Assert.That(view.BannerLeft, Is.EqualTo(0.01).Within(1e-9));
      view.AfterAnimate(c.Simulation, null, 0, 0.01);
      Assert.That(view.BannerLeft, Is.Zero);
      c.Restart();
      Assert.That(view.BannerText, Is.Empty);
      Assert.That(view.BannerLeft, Is.Zero);
      Assert.That(c.Simulation.Events, Is.Empty);
    }

    [UnityTest] public IEnumerator ControllerAttackCrossesMilestoneAndHalfAndPresentsTheirEvents()
    {
      ZhaoYunController c = null;
      yield return Scene(controller => c = controller);
      var originalDummies = c.Dummies;
      var created = new GameObject[2];
      try
      {
        for (int scenario = 0; scenario < 2; scenario++)
        {
          int count = scenario == 0 ? 201 : 5;
          int before = scenario == 0 ? 99 : 2;
          var parent = new GameObject("DEV Director Banner Targets");
          created[scenario] = parent;
          var dummyTransforms = new Transform[count];
          for (int i = 0; i < count; i++)
          {
            var dummy = new GameObject("DEV Target " + i).transform;
            dummy.SetParent(parent.transform, false);
            // One living target in N1's line; all others are separated and out of reach.
            dummy.position = i == before ? c.Mapping.ToDisplayPosition(ArenaLayout.StartX, 0, ArenaLayout.StartZ - 1.5) :
              c.Mapping.ToDisplayPosition(100 + i * 25, 0, -50);
            dummyTransforms[i] = dummy;
          }
          var dummies = parent.AddComponent<TrainingDummies>();
          dummies.SetDummies(dummyTransforms);
          c.UseDummies(dummies);
          var sim = c.Simulation;
          sim.Targets.Static = true;
          sim.Targets.AiEnabled = false;
          for (int i = 0; i < count; i++) sim.Targets.SetHp(i, 1);
          // DEV preparation only: stop one kill short of the banner threshold.
          var window = Moves.Get(MoveId.MUSOU).Hits[19];
          sim.Step(Dt, default, _ =>
          {
            for (int i = 0; i < before; i++)
              Assert.That(sim.ApplyExternal((uint)(1000000 + i), window, sim.Targets.X(i), 0, sim.Targets.Z(i), 0), Is.EqualTo(1));
          });
          Assert.That(sim.KoCount, Is.EqualTo(before));
          Assert.That(c.Effects.BannerText, Is.Empty);
          c.InputSource = new AttackInput();
          int frames = 0;
          while (sim.KoCount == before && frames++ < 30) c.Tick(Dt);
          Assert.That(sim.KoCount, Is.EqualTo(before + 1), "N1 through controller.Tick must cross the threshold");
          Assert.That(sim.Hits.Single(h => h.Killed).Source, Is.EqualTo(HitSource.Player));
          Assert.That(sim.Hits.Single(h => h.Killed).Move, Is.EqualTo(MoveId.N1));
          var bannerType = scenario == 0 ? CombatEventType.Milestone : CombatEventType.HalfDefeated;
          Assert.That(sim.Events.Count(e => e.Type == bannerType), Is.EqualTo(1));
          Assert.That(c.Effects.BannerText, Is.EqualTo(scenario == 0 ? "100 人斬！" : "魏軍 半數潰滅"));
          Assert.That(c.Effects.BannerGold, Is.EqualTo(scenario == 0));
          Assert.That(c.Effects.BannerLeft, Is.EqualTo(2 - Dt).Within(1e-9));
        }
      }
      finally
      {
        c.UseDummies(originalDummies);
        foreach (var parent in created) if (parent != null) Object.Destroy(parent);
      }
      yield return null;
    }

    [UnityTest] public IEnumerator SessionLocaleDoesNotPersistAndInvalidPreferenceFallsBack()
    {
      ZhaoYunController c = null;
      yield return Scene(controller => c = controller);
      var flow = GameFlow.Attach(c);
      flow.Locale = BattleStrings.Chinese;
      flow.SetLocaleForSession(BattleStrings.English);
      Assert.That(flow.Locale, Is.EqualTo(BattleStrings.English));
      Assert.That(PlayerPrefs.GetString(BattleStrings.LocalePref), Is.EqualTo(BattleStrings.Chinese));
      flow.SetLocaleForSession(null);
      Assert.That(flow.Locale, Is.EqualTo(BattleStrings.Chinese));
      flow.Locale = BattleStrings.English;
      Assert.That(PlayerPrefs.GetString(BattleStrings.LocalePref), Is.EqualTo(BattleStrings.English));
      PlayerPrefs.SetString(BattleStrings.LocalePref, "unsupported");
      Assert.That(flow.Locale, Is.EqualTo(BattleStrings.Chinese));
      Assert.Throws<System.ArgumentException>(() => flow.SetLocaleForSession("unsupported"));
      Assert.Throws<System.ArgumentException>(() => flow.Locale = "unsupported");
    }

    [UnityTest] public IEnumerator DevDeathResultAndRetryResetTheFightAndBanner()
    {
      ZhaoYunController c = null;
      yield return Scene(controller => c = controller);
      c.UsePressureCrowd(true);
      var flow = GameFlow.Attach(c);
      flow.SelectDifficulty((int)DifficultyId.Hard);
      flow.SetLocaleForSession(BattleStrings.English);
      flow.StartRequested();
      var sim = c.Simulation;
      sim.Targets.AiEnabled = false; // deterministic DEV setup, not natural-play evidence
      sim.Targets.Static = true;
      var spawns = CastleLayout.Spawns();
      // DEV setup: kill 60 isolated soldiers through combat, causing Pressure on the next controller tick.
      for (int i = 0; i < sim.Targets.Count; i++) sim.Targets.SetHp(i, i < 60 ? 1 : 10000);
      var window = Moves.Get(MoveId.MUSOU).Hits[19];
      sim.Step(Dt, default, _ =>
      {
        int first = 0;
        while (sim.KoCount + sim.Targets.Kills.Count < 60 && first < sim.Targets.Count)
        {
          if (sim.Targets.Alive(first)) sim.ApplyExternal((uint)(1000000 + first), window, sim.Targets.X(first), 0, sim.Targets.Z(first), 0);
          first++;
        }
      });
      c.Tick(Dt);
      Assert.That(sim.Phase, Is.EqualTo(BattlePhase.Pressure));
      Assert.That(c.Effects.BannerText, Is.EqualTo("The enemy advances!"));
      // DEV damage injection through the existing health and strike APIs.
      sim.Player.SetHp(1);
      c.InjectStrike(true);
      c.Tick(Dt);
      Assert.That(sim.Player.State, Is.EqualTo(PlayerState.Dead));
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Ended));
      Assert.That(flow.Result.Win, Is.False);
      flow.StartRequested();
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Ended), "retry ignored until result delay completes");
      for (int f = 0; f < 150; f++) c.Tick(Dt);
      Assert.That(flow.Modes.ResultShown, Is.True);
      c.Effects.ShowBattleBanner(CombatEvent.Milestone(100));
      flow.StartRequested();
      Assert.That(flow.Modes.Mode, Is.EqualTo(GameMode.Playing));
      Assert.That(sim.KoCount, Is.Zero);
      Assert.That(sim.Phase, Is.EqualTo(BattlePhase.Opening));
      Assert.That(sim.Player.Hp, Is.EqualTo(sim.Player.Tuning.MaxHp));
      Assert.That(sim.Player.State, Is.Not.EqualTo(PlayerState.Dead));
      Assert.That(sim.Player.X, Is.EqualTo(ArenaLayout.StartX));
      Assert.That(sim.Player.Z, Is.EqualTo(ArenaLayout.StartZ));
      Assert.That(sim.Targets.AliveCount, Is.EqualTo(300));
      Assert.That(sim.Targets.EngageRange, Is.EqualTo(Difficulties.Hard.EngageRange));
      Assert.That(sim.Targets.MaxAttackers, Is.EqualTo(Difficulties.Hard.MaxAttackers));
      Assert.That(sim.Targets.Attackers, Is.Zero);
      Assert.That(sim.DamageSum, Is.Zero);
      Assert.That(sim.Clock.SimTime, Is.Zero);
      Assert.That(c.Effects.BannerText, Is.Empty);
      Assert.That(c.Effects.BannerLeft, Is.Zero);
      Assert.That(flow.Locale, Is.EqualTo(BattleStrings.English));
      for (int i = 0; i < spawns.Count; i++)
      {
        Assert.That(sim.Targets.X(i), Is.EqualTo(spawns[i].X).Within(1e-5));
        Assert.That(sim.Targets.Z(i), Is.EqualTo(spawns[i].Z).Within(1e-5));
      }
    }
  }
}
