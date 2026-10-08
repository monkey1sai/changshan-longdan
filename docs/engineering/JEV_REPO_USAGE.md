# Jev 開發路由配置

## 本次決策與範圍

2026-10-08 使用者選擇 TypeSafe 技能討論中的推薦方案：開發角色／技能與驗證資源的 advisory Choice 路由；本次不呼叫 TypeSafe provider、不傳私有 source/log、不加入遊戲 runtime。

使用 `configure-jev-repo` 將 repo override 限定於 `.codex/orchestrator.json` 與 `.codex/jev.json`。Global roles 與 compiled floors 沿用，repo active cap 降為 1；不改 native Codex config、permissions、hooks、MCP、憑證或 Global 檔案。配置不切換現有 session model，不啟動 agent。

此變更是 repo onboarding，不是 E12 實作或 gameplay spec。使用者明確要求：本次討論與配置合併到 origin 後，仍須等使用者說「開始 spec」，才啟動先前工作紀錄所列的後續工作。合併本配置不視為該口令。

## 適用能力

| capability | 用途 | 限制 |
|---|---|---|
| evidence_inventory | 唯讀盤點 source/tests、交接與證據閱讀順序 | 不寫檔，不自行重定義完成狀態 |
| web_combat | 有明確任務後的 Web combat/player 工作 | 精確檔案清單是上限；每次 task 仍須縮限，不授權所有功能 |
| character_runtime | Unity 蒙皮／controller 診斷 | 不包含資產製作、替換或跨 repo 委託 |
| validation_tooling | 現有 Unity runner／路線 guard 診斷 | 不啟動 Player 或 benchmark，不重設既有失敗預算 |
| independent_review | 固定 base/head 與完整 diff 的獨立唯讀審查 | advisory 不等於正式 GitHub APPROVED |

`allowed_files` 是有限候選能力的檔案上限，不是 OS sandbox，也不是寫入授權。未列出的檔案或能力必須重新盤點並界定 task，不能直接擴大範圍。唯讀 researcher/reviewer 的檔案寫入清單為空。

## 使用方法與證據

1. 主控先核對實際 workspace、工具可用性、來源新舊、任務授權與必要 review。既有規則已能決定時不呼叫模型。
2. 只有有語意歧義、候選差異充分且資料可傳送時，才考慮既有 `jev_decide`／resource Choice。使用者指定能力不可被替換；保留無適用候選及資訊不足的結果。
3. workspace 必須是實際工作目錄。MCP 不向父目錄搜尋 override；在其他 worktree 或 clone 工作時，須核對該工作目錄的設定，不能用 main 的設定冒稱生效。
4. threshold 0.9 是保守初始配置，未以專案標記資料校準。低信心、資訊不足、停用、timeout 或 provider failure 回主控；不阻擋已有本地證據支持的工作，也不取消 review。
5. 有 `observation.status=written` 的 route/decide，依 Global 契約回報 outcome；caller-reported metadata 不等於實測成功。

`.codex/jev.json` 每次 MCP 呼叫讀取；Global core 的 capability catalog 是另一套控制平面，**不會自動成為 MCP 候選或自動呼叫 Jev**。主控需按實際 task 手動建構候選。設定存在、工具可呼叫、provider 成功、路由品質及實際任務結果是不同主張。

validator argv 只登錄為資料，core 不執行。`web_unit`／`web_build`／`web_parity` 是 Web 工程檢查；`unity_runner` 只測 Node runner；`unity_preflight` 只做環境前置檢查，均不能取代 Unity compile/Edit/Play/build/Player、實際 render、自然操作或人類感官驗收。真正 Unity 驗證須依適用步驟另外給出 exact candidate、參數、產物與授權。

## 固定界線與回滾

- Jev 不決定 PASS／FAIL、permission、retry budget、formal approval、merge、deploy 或 gameplay outcome。
- Global core live execution、native children、external writes、hooks、merge execution 維持關閉。validator／provider／native isolation 未驗證時如實保留。
- 不傳憑證、私有 source、完整 log 或對談。provider 使用及資料傳送要在具體 task 另行核對；本次沒有 provider call。
- 資產協作、E00–E13 與獨立審查要求仍以 AGENTS／工程計畫為準；不以 capability 選擇跨過尚未通過的步驟。
- 合併後需撤回時，使用正常 scoped revert PR。套用尚未提交時，可用 skill 的外部 journal 與原 plan SHA 做條件式 rollback；有後續漂移就停止，不覆寫。

## 官方來源

- [TypeSafe agent skill](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md)：程式保留工作流程控制，Jev 提供 typed judgments。
- [Jev with coding agents](https://docs.typesafe.ai/introduction/coding-agents)：Jev 不是 coding agent 的替代模型。
- [Choice](https://docs.typesafe.ai/primitives/choice)、[Confidence](https://docs.typesafe.ai/confidence)：有限候選與不確定性；typed output／confidence 不保證真實性或權限。
