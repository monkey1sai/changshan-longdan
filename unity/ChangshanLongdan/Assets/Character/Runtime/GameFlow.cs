using System;
using System.Globalization;
using Changshan.Combat;
using Changshan.View;
using UnityEngine;

namespace Changshan.Character
{
  // E09 (B1): the title, pause and result screens around the fight (game.ts modes through GameModes), the difficulty
  // choice, the shake switch (C1) and the camera rig. In the Player it boots itself after the scene loads; tests and
  // the Editor attach it explicitly. Screens are IMGUI text and buttons; a styled UI is not part of this step.
  public sealed class GameFlow : MonoBehaviour
  {
    public const string BootArgument = "-e09NoFlow"; // the Player skips the flow when the runner or a route asks

    public GameModes Modes { get; } = new GameModes();
    public ZhaoYunController Controller { get; private set; }
    public CameraRigView CameraView { get; private set; }
    public CastlePlaceholders Castle { get; private set; }
    public int DifficultyIndex { get; private set; } = (int)DifficultyId.Normal;
    public DifficultyProfile SelectedDifficulty => Difficulties.All[DifficultyIndex];
    public BattleOutcome Result { get; private set; }
    public bool HasResult { get; private set; }
    public string Locale
    {
      get => BattleStrings.Locale;
      set => BattleStrings.PreferredLocale = value;
    }
    public void SetLocaleForSession(string locale) => BattleStrings.SetLocaleForSession(locale);

    GUIStyle title, label, button, buttonBold, toggle;
    string[] difficultyLabels, difficultyLabelsSelected;
    string resultText = "";

    public readonly struct BattleOutcome
    {
      public readonly bool Win;
      public readonly long Ko;
      public readonly double Seconds, Damage;
      public readonly string Rank;
      public BattleOutcome(bool win, long ko, double seconds, double damage)
      {
        Win = win; Ko = ko; Seconds = seconds; Damage = damage; Rank = BattleRank.Rank(win, ko, seconds, damage);
      }
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
      if (Application.isEditor) return;
      var args = Environment.GetCommandLineArgs();
      if (Array.IndexOf(args, BootArgument) >= 0) return;
      var controller = FindObjectsByType<ZhaoYunController>();
      if (controller.Length == 0) return;
      Attach(controller[0]);
    }

    // Wires the flow, the castle placeholders and the camera rig to a controller; the fight waits on the title.
    public static GameFlow Attach(ZhaoYunController controller)
    {
      if (controller == null) throw new ArgumentNullException(nameof(controller));
      var flow = new GameObject("E09 Game Flow").AddComponent<GameFlow>();
      flow.Controller = controller;
      flow.Castle = controller.EnsureCastle();
      flow.CameraView = controller.UseCameraRig(true);
      if (flow.CameraView != null) flow.CameraView.Castle = flow.Castle;
      controller.Flow = flow;
      return flow;
    }

    public void SelectDifficulty(int index) => DifficultyIndex = ((index % Difficulties.All.Count) + Difficulties.All.Count) % Difficulties.All.Count;

    // The title's start button / the result's retry button.
    public void StartRequested()
    {
      if (Modes.StartRequested() == ModeAction.StartBattle) Controller.StartBattle(SelectedDifficulty);
    }

    public void ResumeRequested()
    {
      if (Modes.ResumeRequested() == ModeAction.Resume) Controller.OnResumed();
    }

    // Called by the controller when the fight decided.
    public void Ended(bool win, long ko, double seconds, double damage)
    {
      Result = new BattleOutcome(win, ko, seconds, damage);
      HasResult = true;
      resultText = string.Format(CultureInfo.InvariantCulture, "擊破 KO {0}\n時間 Time {1}:{2:00}\n受傷 Damage {3:0}\n評等 Rank {4}",
        Result.Ko, (int)(Result.Seconds / 60), (int)(Result.Seconds % 60), Result.Damage, Result.Rank);
      Modes.End();
    }

    public bool ShakeEnabled
    {
      get => CameraView == null ? CameraRigView.ShakeEnabledPref : CameraView.ShakeEnabled;
      set
      {
        if (CameraView != null) CameraView.ShakeEnabled = value;
        else CameraRigView.ShakeEnabledPref = value;
      }
    }

    void OnGUI()
    {
      if (title == null)
      {
        title = new GUIStyle(GUI.skin.label) { fontSize = 48, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
        label = new GUIStyle(GUI.skin.label) { fontSize = 26, alignment = TextAnchor.MiddleCenter };
        button = new GUIStyle(GUI.skin.button) { fontSize = 26 };
        buttonBold = new GUIStyle(button) { fontStyle = FontStyle.Bold };
        toggle = new GUIStyle(GUI.skin.toggle) { fontSize = 24 };
        difficultyLabels = new string[Difficulties.All.Count];
        difficultyLabelsSelected = new string[Difficulties.All.Count];
        for (int i = 0; i < Difficulties.All.Count; i++)
        {
          difficultyLabels[i] = Difficulties.All[i].Name;
          difficultyLabelsSelected[i] = "▶ " + Difficulties.All[i].Name;
        }
      }
      float w = Screen.width, h = Screen.height;
      switch (Modes.Mode)
      {
        case GameMode.Title:
        {
          GUI.Box(new UnityEngine.Rect(w * 0.25f, h * 0.2f, w * 0.5f, h * 0.55f), "");
          GUI.Label(new UnityEngine.Rect(0, h * 0.24f, w, 70), "常山龍膽 / Changshan Longdan", title);
          GUI.Label(new UnityEngine.Rect(0, h * 0.36f, w, 40), "難度 / Difficulty", label);
          float bw = 120, bx = w / 2 - (bw * Difficulties.All.Count + 10 * (Difficulties.All.Count - 1)) / 2;
          for (int i = 0; i < Difficulties.All.Count; i++)
          {
            bool selected = i == DifficultyIndex;
            if (GUI.Button(new UnityEngine.Rect(bx + i * (bw + 10), h * 0.43f, bw, 44), selected ? difficultyLabelsSelected[i] : difficultyLabels[i], selected ? buttonBold : button)) SelectDifficulty(i);
          }
          if (GUI.Button(new UnityEngine.Rect(w / 2 - 190, h * 0.56f, 380, 54), "出陣 / To Battle (Enter, J)", button)) StartRequested();
          GUI.Label(new UnityEngine.Rect(0, h * 0.66f, w, 40), "WASD 移動  J 普攻  K 蓄力  Space 跳  Shift 閃避  F 防禦  L 無雙  Q/E 轉鏡頭  R 回正  Esc 暫停", label);
          break;
        }
        case GameMode.Paused:
        {
          GUI.Box(new UnityEngine.Rect(w * 0.3f, h * 0.25f, w * 0.4f, h * 0.45f), "");
          GUI.Label(new UnityEngine.Rect(0, h * 0.29f, w, 70), "暫停 / Paused", title);
          if (GUI.Button(new UnityEngine.Rect(w / 2 - 190, h * 0.42f, 380, 54), "繼續 / Resume (Esc, Enter)", button)) ResumeRequested();
          bool shake = ShakeEnabled;
          bool next = GUI.Toggle(new UnityEngine.Rect(w / 2 - 110, h * 0.54f, 260, 40), shake, " 鏡頭震動 / Camera shake", toggle);
          if (next != shake) ShakeEnabled = next;
          break;
        }
        case GameMode.Ended when Modes.ResultShown && HasResult:
        {
          var r = Result;
          GUI.Box(new UnityEngine.Rect(w * 0.3f, h * 0.2f, w * 0.4f, h * 0.6f), "");
          GUI.Label(new UnityEngine.Rect(0, h * 0.24f, w, 70), r.Win ? "完全勝利 / Complete Victory" : "趙雲 敗走 / Zhao Yun Has Fallen", title);
          GUI.Label(new UnityEngine.Rect(0, h * 0.36f, w, 160), resultText, label);
          if (GUI.Button(new UnityEngine.Rect(w / 2 - 190, h * 0.66f, 380, 54), "再戰 / Retry (Enter)", button)) StartRequested();
          break;
        }
      }
      if (Modes.Mode == GameMode.Title || Modes.Mode == GameMode.Paused)
      {
        if (GUI.Button(new UnityEngine.Rect(w - 220, 20, 200, 44), Locale == BattleStrings.English ? "Language: English" : "語言：繁體中文", button))
          Locale = Locale == BattleStrings.English ? BattleStrings.Chinese : BattleStrings.English;
      }
    }
  }
}
