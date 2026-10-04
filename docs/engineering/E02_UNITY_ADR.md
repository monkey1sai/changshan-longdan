# E02 Unity 決策

提案日期：2026-10-03；決策接受日期：2026-10-04（Asia/Taipei）。`decisionStatus: ACCEPTED`。使用者已核准方向 1 與固定官方套件下載，原文、固定提案 hashes 與授權界線見 [E02_DECISION.md](./E02_DECISION.md)。下列盤點與三個方向保留原提案背景；實際工程驗證以 [E02_UNITY_VALIDATION.md](./E02_UNITY_VALIDATION.md) 及新收證紀錄為準。

## 來源與問題

[PR #8](https://github.com/monkey1sai/changshan-longdan/pull/8) 的 E02 要先鎖定引擎、平台、管線、工程界線及可重現驗證，避免後續功能移植依賴未記錄的環境。起始主線是 `8932ee47b1e902c1d858b9f1b4a1733657c04a8a`；[E01／PR #13](https://github.com/monkey1sai/changshan-longdan/pull/13)已限定結案，未測的完整遊玩／裝置／效能仍保留。

使用者先授權開始 E02 本機工作，再明確核准本 ADR 方向 1 與必要固定官方套件下載。付費、新 Editor／平台、E02 推送／合併／發布與正式最終人類 review 不在本次授權內。原三個固定 PR 的限定人類接受不延伸至 E02。

## 已觀察環境

| 欄位 | 唯讀觀察結果 | 可支持的範圍 |
|---|---|---|
| Editor | `C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe`；ProductVersion `6000.6.4f1_12bfff696524` | 已安裝檔案與 PE 中繼資料，不是 compile／license PASS |
| Editor SHA-256 | `eaba9cb7a7fcfa922c439bf85e60a4e5c3e58215a14cdb53e820d1e9c0ad638f` | 這一台的檔案身分，不假設其他平台執行檔相同 |
| 平台目錄 | `windowsstandalonesupport`、`WebGLSupport`；存在 win64 Mono development／nondevelopment variations | 平台檔案存在，不是實際 build 通過；Windows IL2CPP 未選取 |
| 內附模板 | `com.unity.template.urp-blank-17.2.1.tgz` | 模板版本不是 URP package 版本 |
| 模板 packages | URP `17.6.0`、Test Framework `1.8.0` | 讀自該模板 manifest；尚未證明套件已快取或完成匯入 |
| CPU／RAM | i5-13500，14 cores／20 threads；63.75 GiB | 參考機盤點，不是最低硬體或效能達標 |
| GPU／顯示 | RTX 4060 Ti；driver `32.0.15.8097`；1920×1080、60 Hz | VRAM 容量未確認，保持 `null` |
| OS | Windows 11 Pro `10.0.26100` | 這一台的本機驗證平台 |
| 既有工程 | 本 repo（含 worktrees）、EvoLoot、mmo-asset-pipeline 及三個常見 UnityProjects 位置未找到 `ProjectVersion.txt`；Unity Hub `projects-v1.json` 不存在 | 有限搜尋，不宣稱整台電腦沒有工程 |
| 既有程序 | Unity PID 39732，無視窗標題、路徑未知 | 不接管、不停止、不把它視為本任務工程 |

官方 [6000.6.4f1 release notes](https://unity.com/releases/editor/whats-new/6000.6.4f1)確認版本及已知問題，含特定 project／bee_backend crash 與高 polling rate 滑鼠的 Play Mode 問題。本提案選擇已安裝版本以避免新 Editor 安裝，不能因此保證穩定性；實際 import、build、輸入及 log 必須另驗。

## 三個方向

| 方向 | 具體執行 | 取捨與本輪不涵蓋事項 |
|---|---|---|
| 1（建議） | 鎖 `6000.6.4f1 / 12bfff696524`、URP `17.6.0`、Test Framework `1.8.0`、Windows x64／Mono、Direct3D11；在 `unity/ChangshanLongdan` 建立最小隔離工程與完整 runner | 可直接使用已有 Editor／Mono 支援，符合後續渲染擴展方向；套件匯入相容性仍須實測。本輪不採 HDRP、IL2CPP、Unity WebGL 或玩法移植 |
| 2 | 同一 Editor／Windows x64／Mono，採 Built-in pipeline，只固定 Test Framework；先修訂本提案與預檢契約，再建最小工程 | 初始套件較少；後續改 URP 必須另行轉換材質／渲染設定並重驗，不能沿用方向 1 的設定與結果 |
| 3 | 保留 E02 的 ADR、盤點、唯讀 runner 與測試，先不選平台／管線，也不建立或啟動 Unity 工程 | 保留後續選擇時間；E02 維持 BLOCKED，E03 和功能移植無法開始 |

建議方向 1 的理由是已找到對應 Editor、Mono 支援與同版 URP 模板；這是架構判斷，並非已驗證 URP／效能優於其他方向。方向 1 的資料提案在 [e02-unity.proposed.json](./e02-unity.proposed.json)。

## 方向 1 的決策內容

- **工程與 Web 保留**：Unity source 只放 `unity/ChangshanLongdan`；`Library/Temp/Obj/Logs` 不提交，build／原始 logs 放新 `release/e02/<run>`。保留全部 `src/`、`public/`、Web 入口、相依 lockfile、`base:'./'` 和 itch 打包／回滾點 `8932ee4`。Unity 試作沒有取消 Web 版，也不修改原 package。
- **渲染與參考機**：Windows x64、Mono、Direct3D11、Linear、1920×1080、render scale 1、60 fps cap、VSync count 1；參考機是上表硬體，VRAM 未知保持 null。這些是候選設定，不是 1080p60 結論；runner 後續必須讀回 effective settings。
- **單位與座標**：玩法距離以 m、時間以 s、角度以 rad；保留既有 gameplay 的 X／Y-up／Z 數值。正式來源 `player.ts`／`camera-rig.ts` 的朝向向量為 `(sin(facing),0,cos(facing))`，相機輸入 right 為 `(-cos(yaw),0,sin(yaw))`。Unity 顯示 adapter 才轉 rad→deg，不把 `Transform.right` 直接當成現有 input right。Three.js／glTF 與 Unity 手性／mesh winding／骨架匯入的處理留在資產顯示邊界，E03 須以已知點與實際來源驗證；不做未證明的整個世界 Z 翻轉。
- **時鐘與唯一位移權威**：起步由 gameplay controller／既有招式位移曲線提供位移，Animator `applyRootMotion=false`，不再由 animation／physics 累加同一位移。game time、unscaled input time 和動畫採樣要分開；E02 只建工具／最小工程，實際戰鬥移植與 30／60／120 Hz 重播屬後續步驟。
- **資產策略**：保留既有趙雲 GLB `7dccbfae…`、manifest `b0662f37…`，不重生、不改骨架／玩法／`tip`、`tipBase` 世界座標語義，不在 E02 匯入新角色替代品。`.blend` 來源與 GLB 的完整關係以 E00 原件及 E03 核對為準；Unity glTF importer 尚未選定，不假設 Unity 原生能完整載入 GLB。
- **相依與成本**：最小工程只加入固定 URP `17.6.0`、Test Framework `1.8.0` 及它們必要的官方 transitive dependencies，鎖定解析後版本。不自動加入模板中的 collab、AI navigation、IDE、inputsystem、timeline、visualscripting 等其他功能。先核對本機 cache；若需下載固定套件，須對應下載授權，並記錄 packages lock 與來源。Editor 授權可用性 `NOT_RUN`；不讀取／輸出授權檔或 credentials、不自動啟用登入／付費，生成預算 0。

## 驗證、退出與回滾

可執行入口見 [E02_UNITY_VALIDATION.md](./E02_UNITY_VALIDATION.md)。2026-10-03 僅有唯讀預檢；2026-10-04 已建立完整 execution runner 與最小工程，真實 compile attempt 受共享授權服務阻擋。編譯沒有 PASS，其後 Edit Mode、Play Mode、Windows build、Player 啟動／關閉與真實畫面都是 `NOT_RUN`。

依接受的決策已建立實際工程、Unity Editor C# build／settings check 入口、Edit Mode／Play Mode 最小測試與按階段收證 runner。每階段保留 exit、Editor log、測試 XML 或 build hashes；零測試、缺／陳舊 XML、compile error、非零 exit、timeout 都停止。`-runTests` 不加會提早終止測試的 `-quit`；build 明確用 `-buildTarget StandaloneWindows64`。命令依官方 [Editor command line](https://docs.unity3d.com/6000.6/Documentation/Manual/EditorCommandLineArguments.html)及已安裝 Test Framework `1.8.0` 的 `CommandLineTest/SettingsBuilder.cs` 核對；這是來源證據，實際測試執行仍未通過。

E02 DONE 仍需：決策記錄、可由新 checkout 重現的精確工程、真實 compile／Edit Mode／Play Mode／build／啟動關閉、錯版本／缺 executable 等負例、Web 回歸、適用真實畫面、最終 SHA 的獨立正式 review、另行授權合併及合併後確認。可啟動空場景只證明工程可啟動，不是戰鬥／角色驗收。

回滾只普通 revert E02 source／settings，保留本步失敗 logs；不刪 Web／原素材、不 reset／clean 原工作區、不改未知程序、不撤換公開版本。
