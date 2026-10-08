## ADDED Requirements

### Requirement: Version-bound diagnostic evidence

診斷系統 SHALL 將程式 commit、GLB／manifest／來源身分、engine／runner、pose/time、座標 mapping、測量規則及 raw artifact hashes 綁定同一個 run；未知或缺失的資料 MUST 明示，不能以零或 PASS 替代。

#### Scenario: Comparable fresh to animated snapshots
- **WHEN** 對同一資產執行 fresh import、bind-only、單次 idle 與連續短序列
- **THEN** 保存完整 snapshot 身分、palette、頂點與 influence 定位，以及有限值與參照姿勢結果

#### Scenario: Asset or source changes
- **WHEN** 比較途中 asset hash 或 source SHA 改變
- **THEN** 既有結果不能代表新候選，系統拒絕同版本 PASS 並要求新 run

### Requirement: Isolate asset and runtime causes

診斷流程 MUST 分離 topology／weights、程序姿勢及 Unity bridge 原因；SHALL 使用來源 bind pose 與可定位正例、負例、邊界對照，而非只比較共享 rig 的 joints。誤差、tiny-edge 排除與時間窗 MUST 在候選取樣前由獨立 reviewer 登錄。

#### Scenario: Web and Unity share a deformation
- **WHEN** 相同輸入的 Web／Unity 都出現拉伸
- **THEN** 結果不得宣稱 Unity bridge 是唯一原因；保留共同資產／姿勢原因待定位

#### Scenario: Ambiguous or incomplete matrices
- **WHEN** full palette、來源 topology 或座標轉換證據缺失
- **THEN** 原因維持 UNKNOWN，後續修復不以猜測或 lowered threshold 作驗收

### Requirement: Preserve character and combat contracts

修復交付 SHALL 保留既有 PS2 角色辨識度、21 骨命名／層級、SM_ZhaoYun／SM_ZhaoYunSpear、每頂點最多 4 influences、17 招式、rootMotion=false、FootPlant 與權威 weapon tip/tipBase；技術預算 MUST 不超過鎖定 manifest 的 triangles／textures／LOD／clips 上限。manifest 未明列的 material count MUST 在實作前從鎖定 GLB 盤點並登錄為基準上限，不能虛構數值。必要契約差異 MUST 另行審查，不能靜默接入。

S03 回歸 MUST 沿用 30/60/120 Hz 重播、指定握點誤差 p95≤3 cm、指定 plant 窗口滑移≤5 cm、扣除設計位移後非預期 root 跳變≤5 cm。SHALL 依既有規則分列換握／鬆手窗口、空中姿態、設計滑步／擊退，不將其混入支撐或握點統計，也不藉排除隱藏異常。

#### Scenario: Compatible candidate
- **WHEN** 候選符合骨架／預算與既有姿勢、握點、腳接觸、tip/tipBase、命中回歸
- **THEN** 工程結果可記錄為該候選的測試證據，但仍須實際畫面與自然操作驗收

#### Scenario: Missing bones or malformed influences
- **WHEN** 匯入缺骨、非法／非有限 weights 或超出 influence 契約
- **THEN** 候選驗收 FAIL，沿用既有可見載入失敗 fallback；fallback 不算角色品質 PASS

### Requirement: Versioned asset collaboration

遊戲端 SHALL 依既有 asset-collaboration 契約提供可定位 request；資產製作 MUST 在指定工程師／workspace／資料與動作授權範圍後進行。delivery SHALL 含新 delivery_id、來源與輸出 hash、export metadata、technical QA，且 MUST 保留原資產與證據。

#### Scenario: Prepared request without delivery authority
- **WHEN** request 已準備但製作端或跨 repo／外部傳送範圍未確認
- **THEN** 狀態保持 PREPARED_NOT_SENT，不能宣稱已委託、製作或交付

#### Scenario: Rejected delivery
- **WHEN** 候選違約或驗收失敗
- **THEN** 保留該失敗 delivery 與 raw evidence，原資產不被覆寫，記錄 CHANGES_REQUESTED 或 BLOCKED

### Requirement: Rendered and natural-play quality acceptance

候選 SHALL 以同資產／程式／build 在 Web 與 Unity 真實 render 驗證固定正面、背面及左右側，並涵蓋 idle、跑停轉身、N1–N6、C1–C6、空中招、格擋反擊、閃避、受傷／倒地、死亡／重試與無雙。SHALL 保留連續錄影、工程 trace、自然操作及使用者視覺確認；CPU 診斷、測試、CI、單張 screenshot MUST 不被當成完整品質驗收。

#### Scenario: Visible deformation despite passing tests
- **WHEN** 工程測試通過但 render 或自然操作出現大片尖三角、跨部位拉伸、衣料裂開或持續抖動
- **THEN** 該候選品質結果為 FAIL，不能接受或用摘要分位數掩蓋異常

#### Scenario: Incomplete play evidence
- **WHEN** 某招式／狀態、某引擎畫面或人類視覺確認未執行
- **THEN** 該項標為 NOT_RUN，整體品質不標 VERIFIED／ACCEPTED

### Requirement: Quality gate before formal performance work

品質交付 MUST 經同版本測試、render／自然操作證據、正式獨立審查後，才能執行已授權的候選資產／runtime 合併；合併後 compatibility 通過才作為 E12 新基線。SHALL 保留 E12 原始 correction budget 及 blockers，完整效能／soak 與 E13 MUST 另行完成。

#### Scenario: New quality baseline
- **WHEN** 品質候選通過所有必要門檻並完成已授權合併與 compatibility checks
- **THEN** 登錄新 code/profile/asset/build hashes，E12 正式測試針對新版本重新執行

#### Scenario: Missing approval or remaining quality failure
- **WHEN** 仍缺 formal APPROVED、品質失敗或必要證據
- **THEN** 不開始正式 E12／E13，不重設失敗預算，不發布或付費
