# Unity 移植現況與後續範圍

日期：2026-10-08（Asia/Taipei）。本次為文件盤點，沒有重跑遊戲、Unity runner、benchmark 或重新查核即時 GitHub。Git ancestry、source、既有紀錄及 probe outcome 是本次依據；歷史 PASS 不能轉為新版本 runtime PASS。

## 版本與範圍

- 本機 main／origin-main 已知基準：`805db86f67ab2be152dea8abe57ca47f4e735fb7`（PR44 Jev 配置）；本次未 fetch，不宣稱遠端沒有後續提交。
- E11 合併：`be04336f108db76bb75da31e8b68e065eb182307`（PR43），在 main ancestry 中。
- E12 未合併候選：`3f45d134da9b6ca997e1de0c8b5b2a2eec60c447`，位於 `.worktrees/e12-performance`。該工作樹本次 Git status 乾淨。
- 角色修復草案：`0aaf40f8bcfbaae846a1d20d07a669026aa8d1c9`，位於 `.worktrees/spec-zhaoyun-deformation`，本機草案、未合併。新規格不刪除它，也不把它當正式批准。

## 已移植與未驗收的區別

| 範圍 | 依據 | 可以主張／缺口 |
|---|---|---|
| E00–E01 基線 | MUSOU_EXECUTION_PLAN 台帳與各步紀錄 | 歷史限定接受；不是 Unity 完整驗收 |
| E02 工程與平台 | E02_UNITY_ADR、DECISION、VALIDATION、source ProjectVersion／manifest | Unity 6000.6.4f1、URP17.6、Windows x64 Mono／D3D11；保留 Web；Unity WebGL 未選定 |
| E03–E07 角色、17 招式、命中、動畫、反應／音效 | E03_ZHAOYUN_IMPORT、E04_INPUT_MOVES、E05_HIT_CLOCK、E06_ANIMATION、E07_IMPACT | 已有移植與限定接受紀錄；技術美術、感官與正式 review 缺口不能消失 |
| E08–E10 群體、鏡頭、第一批场景資產 | E08_CROWD、E09_CAMERA、E10_ASSETS | 已有限定接受；部分城池仍佔位，未代表全部最終美術 |
| E11 Director | main merge ancestry；E12_PERFORMANCE 記錄 postmerge run `e180ca75-2ffb-498a-86ce-8b68f19cf275` | 已合併；紀錄載 Unity 五階段與 Web308／parity8／runner84 PASS；formal APPROVED 缺口保留 |
| E12 量測 | 候選 PERFORMANCE／STEP_RECORD 及 `release/e12/c-outcome.md` | 工具候選與短 probe；正式分級／soak 未跑、未合併 |
| E13 完整整合 | MUSOU_EXECUTION_PLAN E13 | 未開始；需單一凍結版本的全部 S01–S08 |

主線 `MUSOU_EXECUTION_PLAN.md` 的 E11–E13 台帳仍停在舊狀態；本盤點提供補充，保留該文件歷史文字與原 profile 的 `runtimeConnected=false`／舊 sourceSnapshot，不偽造它們已接入 runtime。

## E12 實際阻礙

最新本機 probe outcome 記錄 601 frames、15 GPU memory samples、有效樣本 0，overall `BLOCKED_CAPABILITY_PROBE`、`benchmarkAllowed=false`。這是既有結果，本次未重跑。

1. provider timestamp 與 query UTC 相差約 8 小時；freshness validator 已拒收。需要原始時鐘語義及獨立時間轉換證據，不放寬 freshness 窗口。
2. `Draw Calls Count` 實際匹配 UI Toolkit；必須以 category／name／unit 精確辨識目標渲染 counter。
3. 每幀前景／失焦、真正可見數、固定交戰／無雙／倒地 workload 未齊備；frustum 不能代替遮擋／pixel 可見數。
4. CPU／GPU delayed timing 與逐幀／每秒記憶體樣本的對齊、去重、收尾契約未完成。
5. 原兩輪 correction budget 已使用；新工作須先有新定位證據與受審查方案，不能改名或重建 spec 重新計數。

## 分工與下一步

美術工程師處理趙雲來源、拓撲／配重／骨架及匯出交付；遊戲工程處理 Unity runtime、量測能力、匯入、契約回歸及遊玩驗收。跨 repo 需求仍依 asset-collaboration；實際送達未確認，保持 PREPARED_NOT_SENT。資產原因未知時不得預斷必須改 topology；若確認 Unity bridge 原因則由工程修復。

接續 [Unity 後續 SPEC](../../openspec/changes/unity-migration-followup/specs/unity-migration-completion/spec.md) 及 [tasks](../../openspec/changes/unity-migration-followup/tasks.md)。量測能力工程可以獨立推進；正式 E12 須固定品質資產、workload 與完整能力。E13 須 E12 完成。新實作、送委託、push／PR／merge／發布均按各自範圍與 gate 執行，本次文件整理不執行這些動作。
