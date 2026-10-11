# REA：Unity 移植 SPEC 的靜態證據工具

## 本次採用

使用者於 2026-10-11 要求將 REA 套用到自己的 fork 遊戲 repo 與未完成 SPEC。目標為 `monkey1sai/changshan-longdan`，沿用 `unity-migration-followup` 的 22 項任務及既有 Unity 工程，不重建已完成的引擎移植。

Adopt 官方 `rea-agents@6.4.0`（MIT），以 `tools/rea/package.json`／lock 獨立鎖版。Node 要求 `^22.19.0 || ^24.11.0 || >=26.0.0`，比遊戲本身更嚴；本次實際 Node 為 22.22.0。遊戲根 package、Unity runtime、資產與量測門檻不變。

本次只使用既有 CLI 的 managed static provider；沒有新增 wrapper、全域安裝、setup、MCP 註冊或第三方 skill 安裝。套件內附 skill 沒有啟用或完整技能審計，不宣稱其 CLEAN。安裝停用 lifecycle scripts，不代表所有可選功能皆可用或完成整個相依鏈安全審計。

## 對未完成 SPEC 的用途

| 任務 | 可加入的 REA 支持證據 | 仍需原有證據 |
|---|---|---|
| 2.1 時鐘／Player／counter | 核對指定 DLL 的 SHA-256、MVID、型別、方法、CIL 與呼叫／欄位關係，協助確認診斷程式是否進入指定建置 | producer 時鐘、實際 Player 身分、counter 語義與 freshness；靜態名稱不證明 runtime 接線 |
| 2.4 工具與建置驗證 | 保存指定建置內 DLL 的靜態身分，必要時用官方 `compare-managed-members` 比較兩份已鎖定產物 | 原 Unity compile／Edit／Play／build／Player、完整包 hash 與短 probe |
| 3.3 資產整合 | 後續經該單元 scope review，可調查 bridge 的 managed 呼叫與欄位 | 美術交付、21 骨／17 招／握點及實際動作驗收；本次沒有開始此單元 |
| 4／5 正式 E12／E13 | 同版產物的輔助追溯資料 | 分級、30 分鐘長測、可見 Unity、自然操作、音效、手把與人類確認 |

JavaScript／Web 分析可供未來缺少來源的 bundle 調查；目前已有 TypeScript source、parity 與測試，優先沿用。沒有為了使用 REA 而反編譯取代原始 source，亦沒有把它變成遊戲 runtime 相依。

## 重現命令

從遊戲 repo 根執行；npm cache 留在 ignored `release`，安裝不執行套件 lifecycle：

```powershell
npm ci --prefix tools/rea --ignore-scripts --no-audit --no-fund --cache "$PWD/release/rea-npm-cache"
node tools/rea/node_modules/rea-agents/scripts/rea.mjs --version
```

先核對指定 DLL 與所有祖先沒有 reparse point、路徑在授權範圍內，再指定完整路徑。每次使用新的 evidence 目錄，不覆蓋既有 raw：

```powershell
$reaArtifact = (Resolve-Path -LiteralPath 'unity/ChangshanLongdan/Library/ScriptAssemblies/Changshan.Foundation.dll').Path
node tools/rea/node_modules/rea-agents/scripts/rea.mjs inspect-managed-artifact $reaArtifact --format json
node tools/rea/node_modules/rea-agents/scripts/rea.mjs inspect-managed-members $reaArtifact --format json
```

也可由 `npm --silent --prefix tools/rea run rea -- <command> <path> --format json` 呼叫同一 CLI。`--json` 不是本次核定語法。

保存 stdout／stderr、完整命令、exit、REA／Node／lock 版本、輸入前後 hash、來源 code SHA、完整 build manifest、provider／coverage／limitations。exit 0 之外，須核對沒有 error、`provider.id=rea-dotnet-static`、subject／normalized artifact SHA 與輸入一致，以及 coverage 的完整性。partial／unknown／missing 不算 PASS；來源或 build 未知就保留 UNKNOWN。PE machine=x86、IL-only／AnyCPU 的 DLL 不等於 Windows Player 平台錯誤，也不能單靠它證明 Player 是 x64。

若停用 scripts 導致 CLI 缺能力，保存 TOOL_FAILURE；不自行執行 setup、doctor、更新、native provider 或 runtime capture。靜態分析不能代替 WMI／CIM／PDH 實測，也不授予新的 Player 窗口。歷史預算、2s 來源限制與失敗即停保持不變。

## 本次實際證據

base `b5354382662ffe8cfaaf005601c00f442c793401`。在其隔離工作目錄分析既有 Library cache 中的 `Changshan.Foundation.dll`，11,264 bytes，SHA-256 `60df31b6033ce29b7895e0060eabceb3f334a38e9eaa7380b3875248dbb6f793`；前後一致。**此 cache 的來源 code SHA／完整 build SHA 均 UNKNOWN**，不是當前候選或輸出 Player 的同版驗收證據。

- 兩個靜態命令 exit 0、provider `rea-dotnet-static`、coverage complete／issues 空，觀察到 11 types／23 methods，MVID `4bacd497-27b6-4426-9ebd-b98c24346460`。這些是 DLL 位元組的觀察，不是玩法正確或 C# 重建完成。
- missing path、非 managed JSON、只有 `MZ` 的截斷檔：三項均 exit 1／`target_unavailable`，沒有產生成功分析結果。2 正例＋3 負例驗證 PASS。
- 實際工作目錄沒有 `Changshan.Character.dll`；本次沒有因此開 Unity 補 build。`E12ClockReady`／`PerformanceProbe` 的指定 Player 建置內容尚未由本分析證明。
- raw 與 summary：`release/rea-spec-support-v1/`（local_only、Git ignored）。artifact JSON SHA-256 `bb5d5bf9bf01abc31ccd67ac6e52feb379c897799fd5792327e873ea0a7ae14e`；members JSON SHA-256 `bfd5537f6c5fb0ec3501c30d80537adfab4e3e581bca201d39bf1250a381efaa`。
- lock SHA-256 `d296e5f42cec1ca9c875132a5662112ad954ad952770c16891abd6a261220d6e`；REA tarball integrity `sha512-Vj1zWfSlna5bphGoaoI/TcVBuYvze9u+OyPC3Shz8YkBqaCTqB4COnnRoX7XDwMpwI24ZlFEel2yEj0k8LTWEQ==`，npm lock 相符。

最初本機結果核對的 PowerShell `ConvertFrom-Json` 無法讀 lock 中的空名稱 root key；改用其支援的 `-AsHashtable` 後核對通過。這是證據核對命令錯誤，不是 REA 或遊戲失敗；沒有重跑任何遊戲或 provider 實測。

## 下一個最小步驟

仍從 2.1 開始。先定位既有、版本可追溯的完整 Player build；若存在，對其中 `Changshan.Character.dll` 做同樣靜態核對，再對照 readiness／probe source 與 build manifest。若沒有可追溯產物，保持 UNKNOWN，提出具體有界 build／量測方案並按原 gates 審查，不用 Library cache、重新命名或 REA 成功來重設實測預算。WMI 真實例外與時鐘語義缺口仍需另外解除。

本次只完成支持工具整合；SPEC **4/22（18.2%）**。完整 Unity 遊戲驗收才可完成 SPEC。所有 raw／DLL 保持本機，不因本文件取得公開上傳授權；先前清理封存是整合前快照，不能涵蓋本次新增資料。

來源：[REA 已發佈版本對應原始碼的 managed 文件](https://github.com/morluto/rea/blob/a56f7bb668ab23fec8d33f7af353ac7ed2fe1895/docs/managed-code-analysis.md)、[安裝與版本界線](https://github.com/morluto/rea/blob/main/docs/installation.md)。
