# E07 補件：加入 Unity 內建音訊模組

日期：2026-10-06（Asia/Taipei）。`decisionStatus: ACCEPTED`（只涵蓋套件政策，不是 E07 的實作核准或驗收）。

## 使用者原文

- 提問：Unity 工程沒有啟用內建音訊模組，即時音效無法編譯（第 1 次 runner 在 compile 階段失敗）；是否核准把 Editor 內建的 `com.unity.modules.audio` 1.0.0 加進套件政策（manifest、packages-lock、政策 20→21 項，另寫決策紀錄）。建議選項為「核准加入」。
- 回覆：「案照建議」。

## 範圍

| 套件 | 版本 | 來源 | 相依 |
|---|---|---|---|
| `com.unity.modules.audio` | 1.0.0 | Editor 6000.6.4f1 內建模組（`BuiltInPackages/com.unity.modules.audio/package.json`） | 無 |

- 不下載、不付費、沒有 registry 套件變動。`Packages/manifest.json` 直接相依（depth 0），`packages-lock.json` 依既有排序規則（`com.unity.modules.*` 置後、名稱排序）加入；`e02-package-policy.json` 與 runner 的固定清單（`scripts/lib/unity-execution.mjs`）同步加入。
- 用途：`AudioSettings`、`AudioListener` 與 `OnAudioFilterRead`，讓 `SfxMixer` 由音訊執行緒輸出合成音效。音效本身仍是純 C# 離線合成（照 `src/audio/audio-engine.ts`），不引入音檔或外部生成。

## 原因與證據

第 1 次候選 `8787fbd` 的 runner 在 compile 階段失敗（`STAGE_FAILED: compile; exit=1`，證據 `.worktrees/e07-f1/release/e02/e07-f1/compile/Editor.log`，local_only）：`CS1069: The type name 'AudioListener' could not be found ... forwarded to assembly 'UnityEngine.AudioModule'`。

## 回滾

revert 本決策的提交即回到 20 項政策；屆時 `FeedbackView` 的即時音訊輸出須一併移除，離線錄影音軌（純 C#）不受影響。
