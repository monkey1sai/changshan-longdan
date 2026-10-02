# E__ 逐步實作、驗證與審查紀錄（空白模板）

搭配 [執行計畫](./MUSOU_EXECUTION_PLAN.md)。複製到該步 PR 描述／評論並逐欄填寫；此檔本身不是任何步驟的證據。未知填 `null` 或 `NOT_RUN`，不要填0、PASS或捏造URL。最終結果引用不可變candidate SHA；不要為把SHA寫入同一commit而無窮產生新commit。

## A. 開始前範圍審查

```text
stepId: E__
status: NOT_STARTED
implementationPr: null
implementer: null
independentReviewer: null
sourceBaseSha: null
previousStepPrAndDoneEvidence: null
reviewedPlanSha: null
changedVariableIds: []
requiredScenarioIdsAndSubcases: []
allowedPaths: []
forbiddenChanges: []
preImplementationReview: NOT_RUN
preImplementationReviewEvidence: null
mergeAuthorization: null
paidActionAuthorization: null
```

列出本步交付、已存在的runner、必須建立的runner、依賴與未決事項；任何 scope/門檻調整須在跑結果前留下review。審查者與實作者不得相同，作者self-review不能填成independentReviewer。

## B. 候選版本與環境

```text
candidateSha: null
currentBaseShaAtFinalReview: null
profileHash: null
assetManifestAndHashes: null
runnerVersionOrHash: null
platform: null
osAndDriver: null
engineOrBrowserVersion: null
cpuGpuRam: null
viewportAndUiScale: null
renderResolutionAndScale: null
vsyncRefreshRateAndFrameCap: null
seedsAndDifficulty: null
inputMethod: null
startEndTimeWithTimezone: null
```

檔案由本地測完再commit時，附被測檔案hash與commit內容一致性證據；不一致必須重新測試。敏感資料不得放入log。若某環境欄位不適用於純文件步驟，記理由；不能把未知硬體當成不適用於效能驗收。

## C. 驗證矩陣

| 檢查 | 對應V/S與子情境 | 完整命令或操作路線 | 被測SHA | exit code / 結果 | 可存取原始產物及SHA-256 | 審查者確認 |
|---|---|---|---|---|---|---|
| 共通回歸/CI | — | 待填 | null | NOT_RUN | null | NOT_RUN |
| 正例 | — | 待填 | null | NOT_RUN | null | NOT_RUN |
| 負例 | — | 待填 | null | NOT_RUN | null | NOT_RUN |
| 邊界/跨幀 | — | 待填 | null | NOT_RUN | null | NOT_RUN |
| 真實渲染/連續影片 | — | 待填 | null | NOT_RUN | null | NOT_RUN |
| 自然遊玩 | — | 待填 | null | NOT_RUN | null | NOT_RUN |
| 人類聽感/實體手把 | — | 待填 | null | NOT_RUN | null | NOT_RUN |
| 效能/soak | — | 待填 | null | NOT_RUN | null | NOT_RUN |
| 未適用項目的理由與批准 | — | 待填 | null | NOT_RUN | null | NOT_RUN |

結果使用PASS/FAIL/NOT_RUN/TOOL_FAILURE/NOT_APPLICABLE。保留失敗行與追加補測，不覆蓋失敗記錄。人工操作沒有exit code時寫「不適用：人工驗證」，仍要有路線、時間、受測版本和證據。

自然輸入、腳本合成輸入、DEV state/health/musou注入要分開；各自能證明什麼必須寫清楚。只測S的一個子情境不能給整個S PASS；缺工具/畫面/聲音/人類確認不是NOT_APPLICABLE。

## D. Commit 與審查閉環

| 輪次 | candidate SHA | 修改目的 | 當輪驗證 | 真實reviewer與review URL/ID | 發現與嚴重度 | 修正commit與再驗證 |
|---|---|---|---|---|---|---|
| 1 | null | 待填 | NOT_RUN | null | 尚未審查 | null |

```text
selfReview: NOT_RUN
selfReviewScopeAndEvidence: null
formalIndependentReview: NOT_RUN
formalReviewCommitSha: null
formalReviewUrlOrId: null
latestCiHeadShaAndResults: null
unresolvedReviewThreads: null
unresolvedBlockingFindings: null
reviewerOpenedArtifacts: NOT_RUN
baseDriftAssessment: NOT_RUN
finalSameVersionVerdict: NOT_RUN
```

COMMENT、advisory、計畫結構PASS與GitHub正式APPROVED分開列。新commit需更新CI與審查版本，不能保留舊head結論冒充最新；本地路徑列local_only，reviewer看不到產物就不能填已確認。連續兩輪修正仍不過，登錄BLOCKED與最小解除條件，不無限重試。

## E. 完成與下一步門檻

```text
stepVerdict: NOT_STARTED
remainingFailuresOrEvidenceGaps: []
mergeAuthorizedByAndEvidence: null
mergeSha: null
postMergeValidationAndCompatibility: NOT_RUN
postMergeEvidence: null
rollbackCommitOrArtifact: null
nextStepAllowed: false
releaseOrPaidActionPerformed: false
```

VERIFIED：該步承諾的實作、適用驗證、最終SHA的正式獨立APPROVED、最新CI與零未解決threads/阻擋項全部成立。DONE：另外有合併授權、merge SHA與合併後建置/相容性確認。兩者都不能靠填欄位自動成立，必須核對GitHub與原始產物。

### 停止／回滾紀錄

寫明觸發原因、失敗SHA、受影響範圍、保留產物、可回復的來源/模型/設定版本及需要的授權。使用普通revert PR，不force-push，不刪使用者未提交檔案，不自動回退線上部署。
