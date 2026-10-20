# G00 Godot 決策、規格與計畫紀錄

依 `MUSOU_STEP_RECORD.template.md` A–E；本文件不是 runtime 通過證據。

## A. 開始前範圍審查

```text
stepId: G00
status: AWAITING_REVIEW
implementationPr: null
implementer: OpenAI API assistant / parent session
independentReviewer: OpenAI API assistant / reviewer subagent
sourceBaseSha: 034e27052f02967d55241abae80659f2c64ded78
previousStepPrAndDoneEvidence: user changes engine direction; not continuation of Unity E12
reviewedPlanSha: null (preimplementation scope reviewed uncommitted design against base)
changedVariableIds: [V12 decision/evidence planning; V01-V11 runtime unchanged]
requiredScenarioIdsAndSubcases: [S01-S08 retained as future product gates; none claimed PASS]
allowedPaths: [AGENTS.md, README.md, docs/engineering/GODOT_*.md, docs/engineering/E02_UNITY_ADR.md, docs/engineering/MUSOU_EXECUTION_PLAN.md, docs/superpowers/plans/2026-10-20-godot-g00-g01.md, openspec/changes/godot-threejs-migration/, historical notice prefixes in openspec/changes/unity-migration-followup/]
forbiddenChanges: [runtime, assets, dependencies, .codex, provider/config, install/download, source deletion, external mutation, release, paid generation]
preImplementationReview: advisory ACCEPT_SCOPE
preImplementationReviewEvidence: reviewer run 575e775d-5971-4e8c-b2f2-42c68235d0cf
mergeAuthorization: null
paidActionAuthorization: null
```

使用者明確 Three.js→Godot、Windows＋Web，並於設計後回覆「同意」。此為方向與先進行決策／雙平台基礎的授權；只執行第一 eligible G00，不跨過正式 gates。Reviewer 接受 G00 文件 scope，要求更正 user approval 狀態、核對模板 provenance、保留兩輪用盡與數值／formal gates；已納入。

## B. 候選版本與環境

```text
candidateSha: recorded externally after scoped commit (avoid self-reference)
currentBaseShaAtFinalReview: pending readback
profileHash: source unchanged; hash recorded in external manifest
assetManifestAndHashes: source unchanged; hashes recorded in external manifest
runnerVersionOrHash: no new runtime runner; external document validator transcript
platform: Windows host / Git Bash / documentation only
osAndDriver: NOT_RUN (no performance/render execution)
engineOrBrowserVersion: Godot CLI 4.7.2.stable.official.ed1daf0bf; no browser/runtime test
cpuGpuRam: NOT_RUN
viewportAndUiScale: NOT_RUN
renderResolutionAndScale: NOT_RUN
vsyncRefreshRateAndFrameCap: NOT_RUN
seedsAndDifficulty: NOT_RUN
inputMethod: file inspection and CLI version only
startEndTimeWithTimezone: exact validation UTC in external evidence
```

Node22.22.0／OpenSpec1.6.0 可用；Godot executable hash／來源與 templates 空目錄觀察詳 ADR。尚未官方 archive checksum 比對，沒有下載、import、測試或匯出。

## C. 驗證矩陣

| 檢查 | 對應V/S與子情境 | 完整命令或操作路線 | 被測SHA | 結果 | 產物 | 審查者確認 |
|---|---|---|---|---|---|---|
| 主線／隔離 | V12 | git status, fetch --no-tags origin main, merge --ff-only, rev-parse, worktree list | base034e270 | PASS：main=origin/main；既有 dirty 保留 | session tool output | pending |
| preimplementation scope | V12 | reviewer run 575e775d… 親讀設計／規則 | base+untracked design | advisory ACCEPT_SCOPE，不是 formal | retained reviewer artifact | scope accepted |
| OpenSpec strict | V12 | openspec validate godot-threejs-migration --strict; validate unity-migration-followup --strict | candidate externally pinned | 結果見外部 validation.json | local_only external evidence | pending |
| 正例／負例／邊界 | V12 | 外部文件 validator：relative links、UTF8、allowlist、history suffix／checkbox 不變；記憶體內壞連結／改寫歷史 fixtures 拒絕 | blob hashes externally pinned | 結果見外部 validation.json | local_only external evidence | pending |
| whitespace／secrets／原 source 不變 | V12 | git diff --check、candidate paths/contents inspection、blob SHA comparison | external candidate | 結果見外部 validation.json | local_only external evidence | pending |
| Web Vitest/build/package及CI | 保留原版 | 此 G00 未改 runtime/deps；未安裝依賴或執行 | null | NOT_RUN，不作產品 PASS；文件範圍理由待review接受 | null | pending |
| Godot compile/export／render／影片 | S01-S08 | G00 不建工程；G01待formal gates及matching templates | null | NOT_RUN | null | pending |
| 自然操作／聽感／手把 | S01-S08 | 無runtime變更，非本單元交付 | null | NOT_RUN，不冒稱產品PASS | null | pending |
| 效能／soak | S05 | G00不執行；原E12用盡兩輪不重設 | null | NOT_RUN | null | pending |
| 未適用項目的理由與批准 | — | 僅文件，未豁免任何後續承諾測項 | null | reviewed reason pending；不用NOT_APPLICABLE消除缺項 | null | pending |

外部證據預定 `C:/Repos/changshan-longdan-godot-evidence/g00-20261020/`，不在待清理 worktree 內。第一次 `python C:/Repos/changshan-longdan-godot-evidence/g00-20261020/validate-documents.py` exit0、81 PASS／0 FAIL，保存 `validation-1.json` 與兩份 OpenSpec strict／diff stdout/stderr。之後 checklist／本紀錄更新的最終內容另生成新序號並與 candidate blob hashes 比對。具體 SHA／命令 exit／run 時間與 reviewer 可讀性以外部 readback 為準，不以本表自述當驗證結果。

## D. Commit 與審查閉環

| 輪次 | candidate SHA | 修改目的 | 當輪驗證 | 真實reviewer與ID | 發現 | 修正與再驗證 |
|---|---|---|---|---|---|---|
| scope | base034e270+design | 限定G00 | 來源唯讀 | reviewer 575e775d… | ACCEPT_SCOPE含guardrails | 文件納入，非formal |
| final | external exact SHA | 決策／SPEC／route | 外部validation manifest | pending | NOT_RUN | pending |

```text
selfReview: requirement coverage and source preservation checked; final transcript external
selfReviewScopeAndEvidence: G00-only docs, no runtime or assets; hashes externally pinned
formalIndependentReview: NOT_RUN
formalReviewCommitSha: null
formalReviewUrlOrId: null
latestCiHeadShaAndResults: NOT_RUN (not pushed)
unresolvedReviewThreads: unknown (no PR)
unresolvedBlockingFindings: formal review/remote authorization/postmerge missing; matching templates for G01 absent
reviewerOpenedArtifacts: scope design only; final artifacts pending
baseDriftAssessment: source034e270 same as origin/main at start; final readback external
finalSameVersionVerdict: NOT_VERIFIED
```

## E. 完成與下一步門檻

```text
stepVerdict: AWAITING_REVIEW (not VERIFIED/DONE)
remainingFailuresOrEvidenceGaps: [exact-head independent final review, formal APPROVED, push/PR/merge authorization, CI if required, postmerge compatibility and task cleanup]
mergeAuthorizedByAndEvidence: null
mergeSha: null
postMergeValidationAndCompatibility: NOT_RUN
postMergeEvidence: null
rollbackCommitOrArtifact: ordinary revert G00 document commit; preserve source034e270 and evidence
nextStepAllowed: false (G01 runtime)
releaseOrPaidActionPerformed: false
```

### 停止／回滾紀錄

不以方向批准代替 gate，不開始 G01。templates 缺失需固定官方下載範圍授權；正式／遠端授權缺失時保留本任務 worktree，報告尚未合併／清理。既有其他 worktree、共享 raw、.claude 與 .worktrees dirty 未動。回滾只 ordinary revert 本次文件，不 reset/clean/force 或刪舊工程；不自動恢復 Unity 路線。
