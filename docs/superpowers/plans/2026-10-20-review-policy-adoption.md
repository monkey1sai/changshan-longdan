# 核准載體治理導入候選 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 主控直接編修，Astra僅獨立唯讀審查。

**Goal:** 準備條款一致的核准路由候選，區分合法啟用前的現行正式要求與啟用後scope內的獨立審查＋owner acceptance；不是啟用政策或Godot實作。

**Architecture:** 新政策只處於ADOPTION_CANDIDATE_NOT_EFFECTIVE。七個現有入口加明確條件路由／證據欄位，三個新文件記錄政策、計畫及step evidence。五個既有提案／App文件不變，首次導入依當時有效規則，不由新制度自批。

**Tech Stack:** Markdown、OpenSpec既有CLI、Git、外部Python文件validator；不新增dependency／runtime執行器。

**Spec:** `docs/governance/INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_PROPOSAL.md` §6、`INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_ADOPTION.md` A1–A8；binding controls見AGENTS與Godot phase gate。

## Global Constraints

- Base`116770f1c4947953050c244e25deeb60aa6eebe2`；此為候選準備，activation=HELD，policyStatus=ADOPTION_CANDIDATE_NOT_EFFECTIVE。
- 未合法啟用、scope外或activation未知一律保留legacy formal gate；只有合法啟用且scope內才可採新載體。
- 不刪獨立性、安全、來源保全、品質、S01–S08／數值、必要獨立人類／專項、兩輪與實際已用預算、平台保護或操作授權。
- 不改task checkbox／歷史ledger，不把advisory或owner acceptance當GitHub APPROVED，不倒填#51/#52、不解鎖G01。
- 不push／PR／merge／設定／安裝／download／runtime，本次未授權遠端寫入。

## Review Focus

- 連到inactive policy就誤用新載體 → 七個入口都明列legacy fallback與合法active/in-scope條件。
- 新制度批准自己 → policy、SPEC／template保留then-effective bootstrap核准，缺失HELD。
- 相同SHA但reviewer參與實作／raw不可讀／owner不明 → 獨立性與來源分列，保留HELD案例。
- 歷史觀察被改成當前PASS → ADR／G00只追加明確歷史／現況分隔，原body不改。
- 新欄位暗刪較嚴gate → noncarrier SPEC、數字、checkbox及五個保留文件byte comparison。

## Task 1: 政策與入口一致性候選

**Create:** `docs/governance/INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_POLICY.md`、`docs/governance/REVIEW_POLICY_ADOPTION_STEP_RECORD.md`、本plan。

**Modify:** `AGENTS.md`、`docs/engineering/MUSOU_EXECUTION_PLAN.md`（只common gates）、`docs/engineering/MUSOU_STEP_RECORD.template.md`、`openspec/changes/godot-threejs-migration/specs/godot-threejs-port/spec.md`（只carrier）、同change的`tasks.md`（只gate註解）、`docs/engineering/GODOT_ADR.md`、`GODOT_G00_STEP_RECORD.md`（只歷史／現況前綴）。

**Interfaces:** consumes使用者準備修訂授權、scope review、base/current規則；produces未生效政策及完整舊新路由，不提供執行器或activation證據。

- [x] 核對base/worktree及allowlist，取得獨立preimplementation scope review；run`896757d5-19d2-4164-ba16-1e1cf6719e86`只接受candidate準備。
- [x] 寫政策及其P01–P12矩陣；門檻／擬定載體／owner核准／操作授權分列。
- [x] 精確編修七入口；保留legacy fallback／active-in-scope條件及較嚴規則；原歷史與task勾選不變。
- [x] 完成A–E step record，缺bootstrap時HELD，不因文件存在／merge當生效。

## Task 2: 文件驗證與精確候選

**Files:** tracked allowlist同Task1；validator／raw／manifest僅寫外部證據目錄，不新增production腳本。

**Interfaces:** consumesTask1十個文件及base；produces可讀驗證清單／完整diff／hash manifest／local candidate SHA。

- [x] 檢查十檔allowlist、UTF8/LF／links／秘密pattern／diff check、OpenSpec strict；所有runtime／資產／dependency及非allowlisttracked檔案byte-identical。
- [x] 比較三個原提案及兩個App文件byte identity、Godotcheckbox與數字原樣、noncarrier SPEC requirement原樣、execution歷史§2之後原樣、ADR/G00原body只加notice。
- [x] 每個入口檢查inactive legacy fallback和active scope條件；P01/P02/P04–P12有fail-closed判定描述。以記憶體內刪fallback／壞link負例驗證文件validator拒絕；不可稱實際gate runtime測試。
- [ ] scoped commit，核對三新七改的candidate Git blob hash與被測內容一致，保存完整diff與版本；無需為寫入自身SHA再改commit。

## Task 3: 精確版本獨立審查與交接

**Interfaces:** consumesTask2candidate／evidence；producesadvisory及真實缺項，不產生formal activation approval。

- [ ] 新鮮Astra reviewer親讀完整十檔diff/source/evidence，對精確SHA報候選ready／changes requested；模型requested與可驗證runtime身份分列。
- [ ] 如有修正，新commit／重驗／新SHA審查，保留兩輪上限和consumed；沒有正式bootstrap核准仍HELD。
- [ ] 向使用者交接candidate、advisory、驗證及未解條件，具體下一操作另獲授權。本地worktree未merge則保留。

## 不在本次執行範圍

首次導入正式核准、政策合法生效、外部push/PR/merge與GitHub設定、#51/#52過渡裁決、G00 DONE與G01 runtime均未執行。新candidate沒有批准自身介紹／生效的權力。
