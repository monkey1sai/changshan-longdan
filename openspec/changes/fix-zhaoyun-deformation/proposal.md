## Why

趙雲已有 Player 畫面可見衣料尖三角與拉伸，既有 Web CPU 診斷也在 idle 後出現異常；角色品質基線未恢復前，不能把 E12 效能成績當成可交付版本。需要分離資產拓撲／配重與 runtime 蒙皮原因，保留來源及玩法契約，取得同版本 Web／Unity 驗收證據。

## What Changes

- 建立可追溯的 fresh import／bind-only／idle／短動作診斷與資產、runtime 對照，未知原因保留 UNKNOWN。
- 依既有資產協作契約準備趙雲修復需求；確認原因後才做最小拓撲／配重或獨立 runtime 修復，候選另給版本與 manifest。
- 規定工程正例／負例／邊界、Web／Unity 實際畫面、自然操作、人類視覺確認與失敗回滾。
- 角色品質通過後形成新的 E12 基線；本 change 不處理 E12 量測器、正式 benchmark／soak 或 E13。
- 本次交付僅 spec，不製作／替換資產、不改 runtime、不跨 repo 寫入／傳送、不付費、不推送／發布；實作須另依批准的範圍與 step gates 進行。

## Capabilities

### New Capabilities

- `zhaoyun-deformation-quality`: 同版本形變原因隔離、版本化修復與雙引擎品質驗收。這是首次建立的 OpenSpec 契約，不代表已有新遊戲功能。

### Modified Capabilities

無。此前沒有 `openspec/specs/` 主規格；沿用工程計畫及資產契約，不重寫 gameplay 規則。

## Impact

- spec 基準：PR44 merge `805db86f67ab2be152dea8abe57ca47f4e735fb7`。PR44 與父提交的變更只含 Jev 配置／說明，未修復角色；formal GitHub reviews 仍空，不補寫 APPROVED。
- 歷史診斷來源：`codex/fix-zhaoyun-deformation` commit `fb7e7cd7ab8f116530ca488bb020bcb12be2f557` 的 `docs/art/requests/cl-zhaoyun-deformation-v1.md`；原遊戲基準 `be04336f…`、GLB SHA-256 `7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33`。
- 可能受影響的後續實作：`scripts/prepare-zhaoyun.py`、`src/view/zhaoyun-adapter.ts`、Unity `SkinBinding.cs`／`CharacterAnimation.cs` 與 rig／import 測試；確切修改路徑須依診斷再縮限，這份清單不是寫入授權。
- V04／V09／V12 為主要變量；S01／S03／S07 為主要驗收，S02 保護命中與 tip/tipBase，S06／S08 作顯示及自然流程回歸。S05 完整效能驗收仍由 E12 負責。
- 保留 Three.js Web 與 Unity 6000.6.4f1，21 骨命名／層級、17 招式、root-motion=false、weapon tip/tipBase、FootPlant、載入失敗 fallback。無新增依賴、API、環境變數、migration、排程或部署變更。
