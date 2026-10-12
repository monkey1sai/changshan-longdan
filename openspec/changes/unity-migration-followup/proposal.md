## Why

Unity 功能移植已有 E02–E11 工程與合併紀錄，但主線台帳尚未同步 E11，E12 只有受阻的量測能力候選，E13 未開始。需要一份可追溯的後續規格，區分歷史限定接受、當前工程缺口、美術交付依賴及正式可玩版本驗收。

## What Changes

2026-10-12 使用者授權修訂為 SPEC v2；v1 不可變基準為 `a52b79eefb6cc90a3b12bf152bbec8c32e8620b1`。逐項差異、責任與人工驗收清單見 [v2 決策紀錄](../../../docs/engineering/UNITY_SPEC_V2_DECISION_RECORD.md)。保留全部 22 項及目前 4/22 狀態；本次修訂不增加實測額度、不放寬門檻、不代表遊戲驗收通過。

- 新增 Unity 移植盤點，核對 main、未合併 E12 候選及短 probe；保留原計畫、profile 快照與 review 缺口，不改寫歷史 PASS。
- 明確分工：美術工程師負責必要的資產製作／修復／匯出；遊戲工程負責 runtime、量測、匯入、測試與證據；使用者負責實際自然遊玩、聲音、實體手把與體驗確認，獨立正式批准另列。
- 設定後續單元順序：新證據與量測能力方案 → 補足工具能力 → 固定品質資產整合 → 正式 E12 → 同版本 E13。
- 先選擇並驗收現有資產，品質不符且需要製作／修改時才走新美術交付；選用現有資產不等於 ACCEPTED。允許獨立工具工程，正式 benchmark 仍須品質、workload 與量測門檻齊備。
- 允許經等價性審查的替代量測 provider，保留 counter／身分／時鐘／freshness 與全部數值要求；新增方法仍須新證據、審查與精確額度授權。
- 本次僅生成 spec 與盤點，不改 runtime、不製作資產、不送委託、不推送／合併／發布、不付費。

## Capabilities

### New Capabilities

- `unity-migration-completion`: Unity 移植現況、責任邊界、量測能力、資產整合、E12／E13 與交付門檻。

### Modified Capabilities

無。本分支沒有既有 `openspec/specs/` 主規格；沿用 MUSOU E00–E13 與 S01–S08。v2 調整資產取得、量測來源與人工執行方法，保留產品驗收與數值要求。先前角色修復 change 保留於另一個本機分支，不是本分支的隱含依賴或已批准實作。

## Impact

- 規格基準：main `805db86f67ab2be152dea8abe57ca47f4e735fb7`；E12 候選 `3f45d134da9b6ca997e1de0c8b5b2a2eec60c447` 未合併，不能視為 main 功能。
- 保留 Unity 6000.6.4f1、URP 17.6.0、Windows x64 Mono／D3D11 方向；保留 Three.js／TypeScript Web 與 itch 交付。Unity WebGL、其他平台、Editor 升級、IL2CPP 不在此範圍。
- 後續可能涉及 `scripts/e12-*`、`scripts/lib/e12-*`、Unity PerformanceProbe／Foundation timing 及其測試；確切檔案須在每個單元開始前審查。此清單不授權立即實作。
- E12 涉及 V06／V09／V10／V12 與 S05、S01／S02／S03／S06／S07 回歸；E13 涉及全部 V01–V12／S01–S08。
- 此次無 API、依賴、環境變數、部署流程、排程、Webhook、資料 migration 或 Jev 配置變更。
