# Unity SPEC v2 決策與驗收責任（2026-10-12）

使用者於2026-10-12指示「現在改spec」，授權將先前提出的收斂方式寫入規格。本次僅修改四個 OpenSpec artifacts 與本紀錄，不實作runtime、不新增實測、不推送／合併／發布、不清理資料。v1不可變基準：`a52b79eefb6cc90a3b12bf152bbec8c32e8620b1`；原文件可由 `git show <SHA>:openspec/changes/unity-migration-followup/<path>` 取得。v2正文見 [proposal](../../openspec/changes/unity-migration-followup/proposal.md)、[design](../../openspec/changes/unity-migration-followup/design.md)、[tasks](../../openspec/changes/unity-migration-followup/tasks.md)、[spec](../../openspec/changes/unity-migration-followup/specs/unity-migration-completion/spec.md)。

## 決策與不變條件

- 保留 Unity6000.6.4f1／URP17.6／Windows x64 Mono／D3D11、現有玩法、Web／itch歷史與發布tag。
- 現有資產先選擇、鎖hash、查來源授權與QA，再完成相同品質驗收。只有需要製作／修改才要求新美術交付；不虛構delivery_id，不把選用當ACCEPTED。
- 量測provider可替換，但須先證明等價性。指定Player、PID／processStart、adapter全集、counter／unit、UTC／query window、高水位與lag≤2s、future≤250ms、query≤2s不變；UNKNOWN不算PASS。
- agent完成工程與證據；使用者作為人工executor完成可見Unity開啟、自然遊玩、音效、實體手把與產品體驗確認。Jev仍支援合法步驟選擇，實際執行者與outcome另記。
- 正式E12全部級別／三seeds／30分鐘長測、全部品質門檻與E13同版完整遊戲驗收仍必要。沒有延後或刪除任何必要任務；未來如需調整必須另有使用者決策及影響對照，不能算PASS或移除分母。
- 衣角限定例外仍只適用原run／code／GLB／畫面；不延伸其他姿勢、部位或後續版本。原始失敗、正式審查缺口與已用額度保留。

## v1 → v2 任務對照

保留22個ID，目前仍 **4/22（18.2%）**。前四項是原有歷史限定完成，不是新增遊戲測試通過。

| ID | v1條件 | v2條件與狀態 |
| --- | --- | --- |
| 1.1 | 基準／差異／範圍盤點 | 不變；歷史完成 |
| 1.2 | 原始失敗與新來源定位 | 不變；歷史完成，不證明Player freshness |
| 1.3 | 能力方案與審查 | 不變；歷史完成，不代表runtime通過 |
| 1.4 | U1文件退出 | 不變；歷史限定人類決定，reviews=0不補正式批准 |
| 2.1 | timestamp／Player／counter修正 | 可審查替代provider；語義與數值不變；未完成 |
| 2.2 | foreground與真正visible | 不變；M2-T工程定義與可讀性驗收分列；未完成 |
| 2.3 | delayed timing與記憶體對齊 | 不變；未完成 |
| 2.4 | 工具／Unity五階段／短probe | 不變；agent工程執行，無新實測額度；未完成 |
| 2.5 | 能力單元正式審查／merge／postmerge | 不變；未完成 |
| 3.1 | 必須送新美術需求 | 改為選定現有基線並鎖hash；需要製作／修改才委託；未完成 |
| 3.2 | 必須接收新delivery | 改為核對現有來源／授權／QA，必要新交付仍走契約；未完成 |
| 3.3 | 骨架／招式／bridge等工程驗收 | 同時適用現有或新資產，所有門檻不變；未完成 |
| 3.4 | 雙引擎render／自然操作／30/60/120Hz | 不變；未完成 |
| 3.5 | 視覺確認／正式審查／merge／postmerge | 不變，不因選用現有資產免除；未完成 |
| 4.1 | 品質與量測前置／版本凍結 | 不變；未完成 |
| 4.2 | 20人三seeds | 不變；未完成 |
| 4.3 | 50/100/200/300逐級 | 不變；未完成 |
| 4.4 | 30分鐘soak／回歸 | 不變；未完成 |
| 4.5 | E12正式審查／merge／CI／postmerge | 不變；未完成 |
| 5.1 | E12 DONE後凍結單一Windows包 | 不變；未完成 |
| 5.2 | 工具executor開Unity／完整Player驗收 | 明列使用者人工executor與逐項證據；全部測項保留；未完成 |
| 5.3 | 體驗／正式批准／merge／postmerge | 明列三種批准責任，branch protection不變；未完成 |

## 責任與可執行清單

| 負責者 | 工作 | 可證明範圍 |
| --- | --- | --- |
| agent主控 | source／tests／CLI五階段、版本與payload、量測方案／證據核對、Jev合法選項與紀錄 | 工程及工具證據；不冒稱人體感官或實體裝置操作 |
| 使用者 | 可見Editor開啟、同版Player自然遊玩、音效、實體手把、視覺與手感確認 | 實際操作與產品體驗；不自動構成正式獨立GitHub批准 |
| 獨立技術reviewer | 範圍及exact-candidate技術審查 | advisory；本次由 `/root/unity_spec_review` 提供，不假冒counted approval |
| 具資格獨立正式reviewer | 審閱完整diff／證據並對exact head提供正式批准 | 須實際符合repo／GitHub規則；尚未指定合資格帳號，保持缺口 |
| 美術工程師（條件式） | 必要的新製作／修改／匯出與交付QA | DELIVERED不等於遊戲內ACCEPTED |

以下清單在E13 eligible後執行；不是現在已跑的測試，也不提前豁免第2–4單元。人工結果使用原S01–S08矩陣逐項記錄，不以一份「可以」聲明替代。

1. agent提供凍結code/profile/asset/full-build hashes、完整輸出包、project絕對路徑、Unity版本、全部必要工程及E12證據；使用者核對實際Editor／Player身分。
2. 實際操作者可見開啟指定Unity project，記錄日期時間、操作者、Editor版本／project、啟動及Play或操作畫面；另啟動同版輸出Windows Player，兩者證據分列。
3. agent核對Jev實際能力，以允許去敏state提供合法步驟，記錄Choice/confidence、state版本／時間、採用／拒絕原因；使用者或工具執行後記錄實際操作、結果與對應outcome。Jev不可用保持缺口，不偽造回應。
4. 使用者在同版Player完成全部S01–S08及四難度的自然勝敗，另核對重試、暫停、失焦恢復；不以DEV補血、無敵、teleport代替自然操作。
5. 使用者實際聽取音效、操作實體手把，記錄音訊／手把裝置、輸入動作、可觀察反應、感受及結果；無裝置或無聲音證據記NOT_RUN並阻擋。
6. 每測項記錄操作者、時間、版本、情境／操作、原始畫面／操作紀錄、結果及原因；失敗或缺項保留，版本不符不沿用PASS。使用者確認視覺／手感，agent核對矩陣完整性。
7. 分別取得產品體驗確認與具資格獨立exact-head正式APPROVED，再依具體授權merge及postmerge；全部22項及同版必要測試齊備才稱SPEC completed。發布仍另行授權。

## 預算、失敗與退出

原兩輪修正及既有時鐘對照批次已用／已停止狀態維持；最多三窗口不表示第一窗口失敗停止後尚可使用其餘窗口。新provider方法必須有新證據、方案審查及明確操作／次數／窗口／失敗停止條件授權。本次文件修訂不新增測試、Unity build或Player／WMI／CIM窗口。

額度耗盡或必要資料未知時停止受限動作、交付已取得證據，能獨立離線完成的授權診斷可繼續；不能重命名、換工具重設預算或繞過權限。環境／工具／網路／授權／測試／產品失敗分開分類。要新增實測或調整驗收要求時提出具體決策與影響；在決策前保持BLOCKED，不以無限重試代替退出。

## 本次文件驗證與回復

範圍審查已接受五檔spec-only修改；完成後須跑OpenSpec strict、22 IDs／4 checked／18 unchecked、數值及例外hash保留、連結與全文一致性、git diff檢查，再對本機exact SHA獨立終審。實際結果以交付回覆及review紀錄為準，本節不是預先宣稱PASS。runtime未改，V01–V12／S01–S08驗收契約保留；本次文件通過不增加遊戲完成率。形成feature branch本機checkpoint，可用普通revert回復文件，不刪歷史或失敗證據。
