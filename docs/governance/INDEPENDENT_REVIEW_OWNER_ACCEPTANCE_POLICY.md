# 獨立審查＋維護者核准：導入候選政策

**policyStatus: ADOPTION_CANDIDATE_NOT_EFFECTIVE**

- proposedPolicyVersion: `review-owner-v1`
- effectiveVersion / effectiveDate / effectiveScope: `null`
- activationDecision / activationAuthority / activationEvidence: `null`
- bootstrapFormalApproval: `MISSING / HELD`
- 本候選 base：`116770f1c4947953050c244e25deeb60aa6eebe2`。

本文件是依[既有提案](INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_PROPOSAL.md)及[導入清單](INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_ADOPTION.md)準備的條款一致性候選，**不是已生效政策、首次導入批准或可執行安全gate**。使用者授權準備修訂，不等於核准尚未形成的精確candidate。本輪不push／PR／merge，不修改GitHub設定、App或帳號，不開始Godot G01。

## 1. 適用核准路由：先判生效，再判內容

每次判斷正式核准，必須先核對有效政策版本、作用域及合法activation證據，不能只看文件是否存在或已merge。

1. **未合法啟用、超出effectiveScope，或無法驗證activation時**：保持原先有效的正式核准要求（包括要求GitHub正式APPROVED的條款）。缺項即HELD；不能把owner acceptance、Astra advisory或本文件取代原門檻。
2. **只有已按當時有效規則合法啟用、且candidate屬明確effectiveScope時**：本政策才允許「獨立審查接受＋維護者對精確候選的明確核准」作為該範圍的正式核准載體。它不創造GitHub APPROVED事件，也不取代實際較嚴的server protection或必要獨立人類／專項簽核。
3. 任一分支都必須保留測試、raw evidence、同版本身份、獨立性、security／source preservation／quality、S01–S08與數值、有效修正上限／已用round、當次操作授權及交付收尾。政策衝突採仍有效且較嚴要求，未釐清時HELD。

「適用正式核准」指上述路由判定後的要求；不代表各任務可以自行挑選較寬鬆分支。GitHub實際review狀態永遠如實記錄。

## 2. 啟用前置與不可自批的首次導入

本候選不能批准自身介紹、合併或生效。首次導入必須依**當時有效規則**取得所需正式核准，而非用本候選所提出的owner-acceptance機制批准其自身。方向選擇、scope/final advisory、文件commit／merge、owner對提案一般同意，均不自動構成activation。

需分開核對：
- activationAuthority的權限及明確原文、適用的舊規核准／必要專項批准與精確candidate。
- policyVersion、effectiveDate（含timezone）、repo／PR／任務作用域、舊條款替代清單與未替代的較嚴要求。
- 同版獨立審查、必要測試／證據、明確人類核准、當次外部操作／merge授權、實際遠端合併、post-merge一致性及安全清理。

上述條件不齊，bootstrapFormalApproval仍MISSING、activation仍HELD。不得透過修改低優先序文件覆寫不可豁免的指令，不建立bot/App、不用owner第二帳號、不換作者或重開無內容PR來補票。此殘餘阻礙可能仍需一位符合現規的外部正式reviewer，本候選沒有解掉它。

## 3. 啟用後的三種獨立判斷

### 3.1 非實作者的獨立審查

Reviewer必須未參與候選實作／修正，親讀完整diff、相關source/spec、適用tests/raw evidence，記錄實作者／reviewer身份、session/run、artifact可讀性、base/head/profile/asset/build、findings及結果。

requestedModel（預設使用者指定Astra）與runtimeModelEvidence分列；沒有可觀測後端身份時揭露限制，不以模型自稱作實證。必要獨立性、模型能力或人類資格不符時HELD，不擅自切provider。Reviewer若實作修正，另一位未參與該修正的reviewer才可做獨立審查。

結果：`INDEPENDENT_REVIEW_ACCEPTED / CHANGES_REQUESTED / HELD`。既有advisory不自動改標；需核對精確範圍與版本，必要時重審。提供者計算的hash／測試和reviewer親自重跑分開，不用模型共識或分數代替結果。

### 3.2 人類維護者的精確候選核准

維護者必須明確接受精確head、scope、已讀證據與限制。記錄identity、來源、原文或獲准去敏摘錄、核准時間與head；「同意方向」「繼續」或舊候選合併授權不足。來源不可驗證或未獲准傳送私人資料時HELD，不公開完整私人對話或秘密。

owner acceptance不是第二位獨立人類，不是GitHub APPROVED，也不免除指定人類感官／實體手把／專家核准。exceptions欄位只揭露限制，**不提供豁免權**。

### 3.3 當次操作授權與交付

Merge授權須可辨識repo／PR／base/head與允許操作；不是永久push/merge/部署/刪除/付費權。核准與授權可同處一則原文，但要分別清楚，不能從含糊字詞推導。

新head重新綁review／owner acceptance；base漂移做影響評估及必要重驗。存在HIGH/CRITICAL、未解blocker/thread、缺必要數據、已用盡兩輪或實際平台review/protection不符即HELD，不admin bypass或啟用auto-merge規避。

## 4. 生效後狀態與證據欄位

```text
policyStatus: ADOPTION_CANDIDATE_NOT_EFFECTIVE | ADOPTED_AND_EFFECTIVE
policyVersion / effectiveScope / effectiveDate: null
activationDecisionAndThenEffectiveApprovalEvidence: null
applicableApprovalRoute: LEGACY_FORMAL_GATE | ADOPTED_REVIEW_OWNER_CARRIER | HELD
baseSha / headSha / profileHash / assetHashes / fullBuildHashes: null
implementerIdentity / reviewerIdentity / reviewerRun: null
reviewerImplementationParticipation: false | true | unknown
requestedModel / runtimeModelEvidenceOrLimitation: null
independentReviewVerdict / reviewedHeadSha / openedArtifacts: null
ownerAcceptanceIdentitySource / ownerAcceptanceQuoteOrAuthorizedExcerpt: null
ownerAcceptanceHeadSha / ownerAcceptanceScope / ownerAcceptanceTime: null
requiredHumanAndSpecialistSignoffs: []
githubActualReviewState / githubActualReviewId / githubActualReviewCommit: null
applicableFormalApprovalSatisfied: false
mergeAuthorizationSourceAndExactTuple: null
retryBudgetAndConsumedRounds / baseDriftAssessment: null
mergeSha / postMergeEvidence / cleanupEvidence: null
```

適用正式核准、獨立性、同版適用驗證、必要人類／專項批准、最新CI與零未解阻擋均成立才VERIFIED；再有當次merge授權、remote merge、post-merge、證據保全及worktree清理才DONE。未生效／未在scope時仍依legacy formal gate，不是以此處定義豁免。

## 5. 歷史與Godot過渡

PR51 candidate `186503b0327f71583776204e8df0b6bd9d22fa52`、merge `ae2b2b49cd0154e9278c01e6db78ed15967f2edd`；PR52 candidate `88f5988b50f8799968a797c41a3e3962a959a5e1`、merge `116770f1c4947953050c244e25deeb60aa6eebe2`。其merge、Astra advisory與owner原文不等於GitHub APPROVED，不能倒填歷史核准或時間。

本候選不自動採納PR51／52，也不把G00改DONE；Godot仍2/20，G01不可開始。即使未來合法啟用，#51是否納入仍需明確過渡裁決、重新核對其身份／證據與缺口，保留先merge後核准的偏差。已下載模板／MCP smoke只算工具資料，不是G01出口包證據。

既有提案三檔及舊App設計兩檔保持原樣，均不是本政策的activation來源。若未來需替代它們，另以可審決策記錄，不暗改歷史。

## 6. 文件判定矩陣（不是runtime執行器）

| 案例 | 條件 | 必須判定 |
|---|---|---|
| P01 | inactive、out-of-scope或activation未知 | legacy正式要求仍有效；缺項HELD |
| P02 | 首次導入缺舊規核准 | HELD，不能用新owner carrier自批 |
| P03 | active/in-scope、獨立same-head、owner精確接受、其他全部gates齊 | 可判正式核准成立；仍須操作授權／交付收尾 |
| P04 | review或owner綁舊head | HELD，重新審查／接受 |
| P05 | 缺owner acceptance或來源不明 | HELD，不能只用Astra |
| P06 | reviewer曾寫入修正 | HELD，另找未參與實作reviewer |
| P07 | 平台required GitHub approval不符 | HELD，不bypass |
| P08 | 必要專家／獨立人類／視聽裝置證據缺失 | HELD，owner不能代填 |
| P09 | 同一問題兩輪已用盡 | HELD，保留已用round |
| P10 | raw evidence不可讀或身份不符 | HELD，不以hash或摘要作PASS |
| P11 | 缺當次merge授權 | 不合併 |
| P12 | 已merge但post-merge／備份／清理缺失 | 不標DONE |

本次交付僅文件一致性檢查與候選review；所有新政策實際執行／平台正負測試均NOT_RUN，不以文字矩陣宣稱安全控制已運作。詳[計畫](../superpowers/plans/2026-10-20-review-policy-adoption.md)與[逐步紀錄](REVIEW_POLICY_ADOPTION_STEP_RECORD.md)。
