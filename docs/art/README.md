# Reusable AI Game Art Manufacturing Workflow

本目錄的目的不是替《常山龍膽》製作某一批美術，也不是指定某個場景的開發需求。

它是一套提供給 **Codex / Claude Code / 其他 AI Agent 重複執行的遊戲美術製造與整合 SOP**：每次收到新的角色、場景、道具、UI 或 VFX 任務，都走同一條可驗證流程。

## Agent Workflow

模型相關工作預設先依 [模型資產協作契約](asset-collaboration.md) 向 `mmo-asset-pipeline` 美術工程師提出需求；以下製作與驗收步驟仍適用，遊戲端負責整合、遊戲內驗收及退修回饋。

1. **Visual Target Intake** — 讀取使用者 reference、目標平台、鏡頭、風格與品質要求；缺資料時明確標記未知，不自行發明。
2. **Art Direction Extraction** — 從 reference 萃取比例、shape language、palette、material、lighting、camera、VFX 規則，形成/更新 Art Bible。
3. **Asset Plan** — 將需求拆成 model / texture / material / rig / animation / environment / UI / VFX；決定生成、採購、重用或修改。
4. **Asset Manufacturing** — 依計畫製造候選素材；保留來源、生成方式、版本與授權 metadata。
5. **Technical Validation** — 驗證格式、座標、scale、UV、材質、骨架、動畫、LOD、貼圖與效能預算。
6. **Game Integration** — 以 adapter/manifest 接入遊戲；避免把單一素材假設散落到 gameplay code。
7. **Scene Assembly** — 依 Art Bible 做 composition、dressing、lighting、VFX、camera 與 UI integration。
8. **Visual QA Loop** — 固定鏡位截圖 → 與 target 比較 → 列出最大差距 → 每輪只修最重要項目 → 重拍。
9. **Acceptance Gate** — 工程測試、視覺檢查、效能與授權全部通過才算完成。
10. **Knowledge Capture** — 把可重用規則寫回 Art Bible / manifest / QA 紀錄，下一個 Agent 任務沿用。

## Agent contract
- 「build 成功」不等於「美術完成」。
- 不得把 reference 當成可直接複製的成品素材。
- 不得使用來源或授權未知的第三方素材作為正式交付。
- 不得只用主觀的「更漂亮」驗收；必須用固定 reference、鏡位與 checklist。
- 不得為單一作品把 workflow 寫死；project-specific target 應是輸入資料，而不是 pipeline 本身。
- Agent 應留下可供下一次執行讀取的 manifest、決策與 QA evidence。

## Reusable interfaces
- `art-bible/`：跨任務視覺規則，可由新 reference 有意識地修訂。
- `reference/`：reference intake 與 provenance。
- `asset-manifest.example.json`：每個 asset 的來源、授權、技術與整合 metadata。
- `visual-qa-template.md`：固定的 screenshot → critique → iterate evidence。

## Definition of Done
一次美術任務只有在 **Asset 可追溯 + Technical Validation + Game Integration + Visual QA + Performance + License** 都通過時才完成。
