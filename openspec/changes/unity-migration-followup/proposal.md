## Why

Unity 功能移植已有 E02–E11 工程與合併紀錄，但主線台帳尚未同步 E11，E12 只有受阻的量測能力候選，E13 未開始。需要一份可追溯的後續規格，區分歷史限定接受、當前工程缺口、美術交付依賴及正式可玩版本驗收。

## What Changes

- 新增 Unity 移植盤點，核對 main、未合併 E12 候選及短 probe；保留原計畫、profile 快照與 review 缺口，不改寫歷史 PASS。
- 明確分工：美術工程師負責趙雲資產製作／修復／匯出，遊戲工程負責 Unity runtime、量測、匯入、相容性與實際遊玩驗收。
- 設定後續單元順序：新證據與量測能力方案 → 補足工具能力 → 固定品質資產整合 → 正式 E12 → 同版本 E13。
- 允許在美術交付等待期間推進獨立工具工程；未完成品質、workload 與量測門檻不跑正式 benchmark。
- 本次僅生成 spec 與盤點，不改 runtime、不製作資產、不送委託、不推送／合併／發布、不付費。

## Capabilities

### New Capabilities

- `unity-migration-completion`: Unity 移植現況、責任邊界、量測能力、資產整合、E12／E13 與交付門檻。

### Modified Capabilities

無。本分支沒有既有 `openspec/specs/` 主規格；沿用 MUSOU E00–E13 與 S01–S08，不放寬原要求。先前角色修復 change 保留於另一個本機分支，不是本分支的隱含依賴或已批准實作。

## Impact

- 規格基準：main `805db86f67ab2be152dea8abe57ca47f4e735fb7`；E12 候選 `3f45d134da9b6ca997e1de0c8b5b2a2eec60c447` 未合併，不能視為 main 功能。
- 保留 Unity 6000.6.4f1、URP 17.6.0、Windows x64 Mono／D3D11 方向；保留 Three.js／TypeScript Web 與 itch 交付。Unity WebGL、其他平台、Editor 升級、IL2CPP 不在此範圍。
- 後續可能涉及 `scripts/e12-*`、`scripts/lib/e12-*`、Unity PerformanceProbe／Foundation timing 及其測試；確切檔案須在每個單元開始前審查。此清單不授權立即實作。
- E12 涉及 V06／V09／V10／V12 與 S05、S01／S02／S03／S06／S07 回歸；E13 涉及全部 V01–V12／S01–S08。
- 此次無 API、依賴、環境變數、部署流程、排程、Webhook、資料 migration 或 Jev 配置變更。
