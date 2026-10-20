# 獨立審查＋維護者核准：導入檢查表與準備計畫

狀態：**PROPOSAL_ONLY / NOT_EFFECTIVE / NOT_IMPLEMENTED**。搭配[提案](INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_PROPOSAL.md)及[紀錄](INDEPENDENT_REVIEW_OWNER_ACCEPTANCE_STEP_RECORD.md)。這是未來導入條件，不是執行、push、PR、merge、帳號／App／設定變更或G01授權。

## 1. 本輪提案準備（不啟用）

- [x] P1 查核基準／主工作區／隔離worktree、使用者授權及獨立開始前scope review。
- [x] P2 完成本提案、檢查表與step record三檔；正負邊界及純文件檢查通過、舊規完全未改。
- [ ] P3 固定本地candidate SHA，提供完整diff／原始證據，取得新鮮context Astra唯讀精確版本審查；此結果仍為advisory，不當成首次導入批准。
- [ ] P4 向使用者報告草案、適用限制與bootstrap缺項；後續另行授權，不宣稱制度或Godot階段完成。

這4項僅提案準備的task計數，與Godot2/20分開；P2文件通過不等於下列A/V項完成。原先App設計／checklist不修改、不安裝。未合併的本任務worktree保留。

## 2. 首次導入的必要批准與作用域（未執行）

- [ ] A1 列出所有目前有效條款、GitHub保護／CODEOWNER／required reviews、必要人類／專項要求及目前真實狀態；較嚴規則仍適用。
- [ ] A2 取得符合當前規則的首次導入正式核准；不得讓本提案的owner acceptance批准其自身。缺資格／核准即HELD，不用App、第二帳號、改作者或新PR繞過。
- [ ] A3 維護者另確認具體治理導入候選／精確SHA、影響範圍、有效日期及版本；方向同意不算此項。
- [ ] A4 另行取得需修改的AGENTS／SPEC／模板／routing允許路徑、scope review及正負驗證方案；所有門檻保留或明確對照，禁止暗刪品質測項。
- [ ] A5 若需push／PR／設定／merge，分列Destination／Purpose／Allowed／Data／Forbidden／Stop，取得具體授權；不預設可公開完整私人對話或改branch protection。
- [ ] A6 導入候選按當時有效規則通過精確版本正式審查、CI及適用驗證後才可合併；記錄remote merge／post-merge／備份與清理。
- [ ] A7 明確確認ADOPTED_AND_EFFECTIVE的版本／日期／scope及未替代條款；文件存在、合併、advisory本身不代表生效。
- [ ] A8 舊PR或#51另有過渡處置，保留缺核准與合併時間序列，不追溯改寫GitHub狀態。未處置前G00仍HELD。

## 3. 未來每次交付的證據與核准（僅制度生效後使用）

- [ ] D1 base/head、原source/profile/asset/build、實作者與獨立reviewer身份／run綁定；model requested與runtime可驗證資料分列。
- [ ] D2 reviewer未參與實作／修正，親讀完整source/diff/tests/raw、列明提供者結果與親自重跑結果；工具或能力不足保持HELD。
- [ ] D3 適用正負邊界、真實render／自然操作／聲音／裝置、S01–S08及數值／品質門檻通過，缺項不靠NOT_APPLICABLE豁免。
- [ ] D4 依原有兩輪上限及實際已用round判定；不得按branch／tool／新假說重新計數。
- [ ] D5 owner對同一精確candidate及scope有明確可稽核原文核准，身份／來源可驗證、必要傳輸另授權；例外欄位只披露不提供豁免權。
- [ ] D6 必要獨立人類／專項簽核及實際平台保護照常成立；owner acceptance不當第二位獨立人類或GitHub APPROVED。
- [ ] D7 另有當次merge授權；head改變重新審查／owner核准，base漂移評估影響並重驗；未解blockers/threads必須歸零。
- [ ] D8 remote merge、post-merge相容性、主工作區ff-only同步、外部可還原備份與無force清理完畢才DONE；發布／下載／付費另授權。

## 4. 判定契約與負例／邊界

以下是提議的人工／將來工具判定表，不是現有可執行安全控制。`ALLOW`只表示該階段條件成立，從不自動擴權。

| 案例 | 輸入／狀態 | 必須結果 |
|---|---|---|
| V01 正向 | 已合法生效、reviewer獨立且same-head、證據完整、owner精確核准、其餘gates成立 | 可判內容VERIFIED；仍須獨立merge授權與交付收尾才DONE |
| V02 stale SHA | review或owner綁舊head | HELD，重審與重核准新head，不沿用舊PASS |
| V03 missing evidence | hash有但raw不可讀、零測試或來源不明 | HELD，不把有hash當成驗收 |
| V04 self-review | reviewer曾實作或修正候選 | HELD，換未參與實作的reviewer；不能自己接受自己修正 |
| V05 owner absent | AI接受、owner只說方向／未核准精確candidate | HELD，AI不是owner approval |
| V06 merge absent | review／owner成立但無當次merge授權 | 不合併，不推導永久操作權 |
| V07 bootstrap blocked | 制度仍draft或首次導入舊規核准缺失 | HELD，本提案不得批准自身；不能解鎖G01 |
| V08 GitHub stronger | 新形式完整但平台仍要求有效APPROVED | HELD，不用admin／auto-merge／帳號／作者切換繞過 |
| V09 specialized signoff | owner＋Astra齊，但必要獨立人類或專家未核准 | HELD；例外欄位不能刪除實質要求 |
| V10 exhausted rounds | 同一問題兩輪已用盡 | HELD，不能以改名或改工具取得新額度 |
| V11 base drift | head不變但base／依賴前進 | 影響審查及必要重驗，未確認相容前HELD |
| V12 postmerge missing | remote MERGED但相容性、備份或清理缺失 | 不標DONE，保留worktree／證據及實際缺口 |
| V13 late approval | review晚於merge | 記事後核准與偏差，不能倒填合併前核准 |
| V14 identity unknown | requested Astra但無runtime資料或reviewer獨立性不明 | 模型限制明記；必要身份／獨立性無法確認則HELD，不自行切provider |

## 5. 本輪驗證計畫與候選形成

1. 在三檔加入明確PROPOSAL_ONLY，對照現行條款、角色、bootstrap／#51時間序列與所有不可豁免controls。
2. 檢查三檔allowlist、UTF-8/LF、Markdown相對連結、必要術語與條款覆蓋；Git確認所有原tracked檔案相對base byte-identical。以壞連結／刪除非生效標示的記憶體內負例確認文件驗證器拒絕。
3. 對V01–V14逐列判定表做self-review；其規範設計可被檢查，**不是已實作gate的runtime測試**，不得宣稱規則執行器PASS。
4. scoped commit只包含三檔，紀錄被測檔案SHA與candidate blob一致；外部提供完整diff／驗證清單與hash，不把同commit的SHA寫回自身造成迴圈。
5. 新鮮Astra精確candidate唯讀final review；修正以新commit保留round、更新驗證及review。沒有push／merge授權時保留本地，回報準備進度及缺項。
