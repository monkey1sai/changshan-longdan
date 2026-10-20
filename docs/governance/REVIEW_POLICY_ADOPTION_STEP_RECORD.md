# 核准路由導入候選：逐步紀錄

**status: ADOPTION_CANDIDATE_NOT_EFFECTIVE / ACTIVATION_HELD**。依MUSOU_STEP_RECORD.template的A–E結構；本紀錄不是activation證據。

## A. 開始前範圍審查

```text
stepId: REVIEW_POLICY_ADOPTION_CANDIDATE
status: AWAITING_REVIEW
implementationPr: null
implementer: OpenAI API assistant / parent session
independentReviewer: read-only reviewer subagent, requested openai-codex/gpt-6-astra
sourceBaseSha: 116770f1c4947953050c244e25deeb60aa6eebe2
previousStepPrAndDoneEvidence: PR52 merged as proposal only, no formal activation approval
reviewedPlanSha: null (scope reviewed before editing)
changedVariableIds: [V12 approval-route documentation only]
requiredScenarioIdsAndSubcases: [S01-S08 preserved, no product PASS]
allowedPaths: [AGENTS.md, docs/engineering/MUSOU_EXECUTION_PLAN.md, docs/engineering/MUSOU_STEP_RECORD.template.md, openspec/changes/godot-threejs-migration/specs/godot-threejs-port/spec.md, openspec/changes/godot-threejs-migration/tasks.md, docs/engineering/GODOT_ADR.md, docs/engineering/GODOT_G00_STEP_RECORD.md, docs/governance/INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_POLICY.md, docs/governance/REVIEW_POLICY_ADOPTION_STEP_RECORD.md, docs/superpowers/plans/2026-10-20-review-policy-adoption.md]
forbiddenChanges: [other tracked source/assets/dependencies, historical checkboxes/ledger/noncarrier thresholds, existing proposal/App designs, runtime/G01, GitHub/platform config, push/PR/merge, installs/downloads, fake approval or activation]
preImplementationReview: ACCEPT_SCOPE advisory for candidate preparation; ACTIVATION_HELD
preImplementationReviewEvidence: reviewer run896757d5-19d2-4164-ba16-1e1cf6719e86 / external scope-review.md
mergeAuthorization: null
paidActionAuthorization: null
```

使用者在「完成治理導入條件與規則一致性修訂」後回覆「允許」。此為candidate準備授權，不是對尚未形成candidate的精確核准或外部寫入授權。Scope reviewer要求十檔、每入口雙路由、bootstrap不自批、五個歷史設計原樣、Godot2/20及獨立final review；均列入[計畫](../superpowers/plans/2026-10-20-review-policy-adoption.md)。

## B. 候選與環境

```text
candidateSha: externally pinned after local commit
currentBaseShaAtFinalReview: pending readback
profileHash: unchanged, verified against base externally
assetManifestAndHashes: unchanged, no asset edit
runnerVersionOrHash: external document validator; no new enforcement runtime
platform: Windows host / isolated Git worktree / documentation only
osAndDriver: NOT_RUN
engineOrBrowserVersion: NOT_RUN
cpuGpuRam: NOT_RUN
viewportAndUiScale: NOT_RUN
renderResolutionAndScale: NOT_RUN
vsyncRefreshRateAndFrameCap: NOT_RUN
seedsAndDifficulty: NOT_RUN
inputMethod: file inspection/document validation
startEndTimeWithTimezone: external validation UTC
```

Worktree`C:/Repos/changshan-longdan-review-policy-adoption`，branch`codex/review-policy-adoption-20261020`。啟動時main=origin/main=base，既有其他worktree／共享evidence及dirty保留。Requested Astra與可觀測模型metadata分列，不捏造後端身分。

## C. 驗證矩陣

| 項目 | 命令／方法與範圍 | 結果 |
|---|---|---|
| base／隔離／preimplementation | ff-only同步、HEAD/status、scope review | PASS開始來源一致；scope ACCEPT，非formal |
| 十檔allowlist／五個歷史設計／其他原檔 | 與base blob比較、歷史suffix／noncarrier SPEC／checkbox／數字比較 | 外部validation manifest |
| inactive/active-scope分支、角色／身份／版本／預算 | 七入口文件條款＋policyP01–P12覆蓋；缺fallback／壞link記憶體負例 | 外部validation manifest；非執行gate測試 |
| UTF8/LF／links／secrets／whitespace | document validator、git diff --check | 外部validation manifest |
| OpenSpec | openspec validate godot-threejs-migration --strict | 外部stdout/stderr與exit |
| candidate／被測內容 | Git blob SHA-256與驗證manifest一致 | 外部candidate manifest |
| runtime/export/render/play/audio/gamepad/performance | 本候選不建／執行runtime | NOT_RUN；不刪後續必要測項 |
| 新policy／server實際正負控制 | 本候選不啟用、不改平台設定或API批准 | NOT_RUN，不能宣稱制度有效 |
| 純文件驗證scope接受 | 獨立exact-head reviewer待親讀 | final advisory pending；不是formal approval |

證據預定存`C:/Repos/changshan-longdan-godot-evidence/review-policy-adoption-20261020/`，worktree外local_only；未授權公開／上傳。首輪validation-1.json為84 PASS／2 FAIL：G00 notice缺明示狀態碼、policy缺精確的禁止自批句。根因是兩處文字標示不夠明確，依現有其他入口模式補明（不放寬validator）；本單元文件修正round1；validation-2.json為86 PASS／0 FAIL，exit0，OpenSpec strict及whitespace通過。計畫勾選／本紀錄追加後另驗最終內容並比對candidate blobs；原失敗／新序號結果均保留，不能只發摘要。沒有用NOT_APPLICABLE將實質要求改判通過。

## D. Commit與審查閉環

```text
selfReview: required-route/preservation checks; exact results external
formalIndependentReview: NOT_RUN under current effective policy
formalReviewCommitSha: null
formalReviewUrlOrId: null
policyStatus: ADOPTION_CANDIDATE_NOT_EFFECTIVE
activationDecisionAndThenEffectiveApprovalEvidence: null
applicableApprovalRoute: LEGACY_FORMAL_GATE
independentFinalCandidateAdvisory: PENDING
ownerAcceptanceExactCandidate: null
githubActualReviewStateIdAndCommit: null (no PR)
applicableFormalApprovalSatisfied: false
latestCiHeadShaAndResults: NOT_RUN (not pushed)
unresolvedReviewThreads: null
unresolvedBlockingFindings: first-adoption then-effective formal approval and activation authority absent
reviewerOpenedArtifacts: scope source only; final candidate pending
baseDriftAssessment: start same base; final evidence external
retryBudgetAndConsumedRounds: candidate preparation corrections1 (document clarity); prior Unity E12 two rounds exhausted unchanged
finalSameVersionVerdict: NOT_VERIFIED
```

Scope不能當final，不拿舊candidate advisory／CI／owner方向同意當新head核准。實際formal gate未滿足；新獨立載體只在合法生效scope內可採。

## E. 停止、交接與下一步

```text
stepVerdict: CANDIDATE_PREPARATION_ONLY / ACTIVATION_HELD
remainingFailuresOrEvidenceGaps: [exact-head final advisory, then-effective first-adoption formal approval, owner exact-candidate acceptance, activation authority/scope/version/date, any future external-operation authorization]
mergeAuthorizedByAndEvidence: null
mergeSha: null
postMergeValidationAndCompatibility: NOT_RUN
postMergeEvidence: null
rollbackCommitOrArtifact: ordinary revert candidate docs under applicable authority; preserve source base/evidence
nextStepAllowed: false (policy activation and Godot G01)
releaseOrPaidActionPerformed: false
```

不因candidate存在、merge或人類一般同意宣稱ADOPTED_AND_EFFECTIVE，不用新機制批准自身，不追溯批准#51/#52。Godot保持2/20（10%task計數），現有G00缺口保留。本任務未merge的worktree保留；無reset/clean/force、不刪共享成果／他人分支。若首次導入現規核准無法成立，直接HELD，不能靠低優先序文件覆寫不可豁免指令。
