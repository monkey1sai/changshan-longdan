# E11 戰場節奏與 Director 基線

建立：2026-10-07（Asia/Taipei）。`stepStatus: AWAITING_REVIEW`（實作候選備妥；Unity／錄影結果在同候選外部 evidence 登記，正式 APPROVED 尚缺）。本文件記錄範圍與量測定義；測試、腳本錄影、自然試玩與正式審查分開記錄。未取得 push／PR／merge 授權，沒有進入 E12。

## 範圍與依據

依據 `MUSOU_EXECUTION_PLAN.md` E11 及本次 Claude → Codex 交接（`E11_HANDOFF.md`）。來源基準 `30bdbac8a549a3b6b27f062f1343f77c5021a7bf`，沿用 `claude/e11-director` worktree。E10 PR #41 已於本次以 GitHub provider 唯讀核對：MERGED，merge `d554e253ad3be00a8a6fb27471d433baf40b52b9`，reviews 空集合，兩平台 CI success。E10 是限定接受，不繼承正式 APPROVED。

- A1：延伸既有 `RouteRecorder`、Web `Battle` fixture 和 Unity Edit Mode replay，記錄固定 seed 路線每秒摘要與逐幀遭遇資料。
- B1：移植 phase／milestone／halfDefeated 橫幅，沿用 Web 中英文與兩秒壽命，使用 `changshan.locale` 和 session 覆寫。此步不新增里程碑音效；既有 Unity 音效無對應方法。
- B1 畫面修正：`FoundationSmoke` 僅在 Editor 或顯式 `-e02Output` 驗證模式顯示診斷面板；正常 Player 與所有路線錄製使用遊戲提示，避免面板與橫幅互相覆蓋。截圖、錯誤計數與退出驗證不變。
- C1：以角色半徑 0.45 m、0.25 m 格距驗證 25 小隊中心與 seed 7 的 9 隊長位置可達，加入堵塞負例及通行寬度證據。
- 不修改 `src/`、`public/models/`、場景位置、戰鬥數值、AI 行為或資產；不新增套件、真正增援、友軍、劇情任務、第二角色、付費生成。

變量 V06／V07／V11，另記 V12 的版本與證據；情境 S05 的遭遇內容、S08 階段／死亡／重試／語言子情境。沒有更動場景位置，不以本步證據取代完整 S02／S06／E12 效能驗收。

## 資源沿用與工作分工

直接延伸 `CombatSimulation.ResolveKills`、`FeedbackView`、`GameFlow`、`scripts/combat-parity.mjs`、`scripts/record-route.mjs` 和既有 Unity runner。各引擎碰撞資料使用自身 layout；Web runtime 保持對照基準。沒有缺口需要第三方依賴。

主控 Codex 負責 scope 判定、通路測試、整合、文件、驗證與候選 commit。獨立開始前 reviewer 為 native `architecture_reviewer`（`/root/e11_scope_review`）；已實讀計畫／來源並給 accept、no blocking scope issue（本次 native agent 回覆）。B1 worker 獨占事件／橫幅／語言與相關測試；A1 worker 獨占路線／fixture／錄製檢查；主控 C1 不重疊寫入。Advisory review 與 GitHub counted approval 分開，後者尚未取得。

## 量測定義（實跑前固定）

- 固定路線為 scripted input；控制 frame rate、seed、難度與 camera yaw。DEV 注入的門檻／致死／重試情境另行標記，不當成自然 KO 或自然勝敗。
- alive、engaged、attackers、KO 與 phase 是不同計數。`engaged=0` 的既有 Engage 漏狀態照 E08 保留。
- 空跑記錄活著且仍有敵人時 `engaged=0` 的時間，是 operational proxy；E08 漏狀態使它不能單獨證明沒有實際接敵。遭遇是由無交戰轉有交戰的旗標邊界，不能從畫面人數推斷。
- 原始「有移動輸入卻無位移」與可判定的碰撞卡住分開。後者只在 alive、實際 simulation step、Move 狀態及有移動輸入時累計；受擊、倒地、攻擊與 hit-stop 不冒充堵門。
- 通路格網使用點到矩形／邊界的最小距離，節點保留格距半對角線的餘量，以保守確保節點連接線及精確目標連接線有角色淨空。四向 BFS；不穿矩形角、不以推出後跳過障礙當路徑。
- 通行寬度是從起點到所有必要目標的可達路徑瓶頸寬度下界，並非所有幾何縫隙中的最小值。以相同格網與二分 threshold 求保守下界；測試要求 ≥ 0.9 m。解析幾何另測直徑邊界與不足直徑的反例。

## 已取得基線與限制

2026-10-07，本步修改程式前：`npx vitest run --exclude "release/**"` 33 files／296 tests PASS；`npm run typecheck` PASS；`npm run parity:check` 七份 PASS；`npm run test:unity-runner` 65／65 PASS。Node v22.22.0。這些是 Web／runner 基線，不是新 Unity runtime 或自然試玩證據。

最初 sandbox process startup 回 `orchestrator_helper_incomplete: setup helper exited successfully before setup completed`，其後新 context 下 Node／tests 可執行；sandbox Git 則回 dubious ownership（owner SID 1001、tool SID 1004）。Git 唯讀核對使用逐命令受審核的 host context，沒有修改 safe.directory／ACL／全域設定。

修改前四項檢查亦已保存原始 log 與各命令時間／exit code，在 `release/e11/baseline-20261007/`（`local_only`）。通路測試已新增；Web 四例通過，C# 四例仍待 fresh clone Unity 執行。`E11_HANDOFF.md` 作為原交接來源保留並納入本步文件；其建檔時狀態是歷史紀錄，後續狀態以本步證據為準。

整合後本機回歸（candidate-a，2026-10-07 15:55 +08:00）：Vitest 35 files／308 tests、typecheck、八份 parity、runner 84／84、build、itch 打包全部 exit 0；完整命令、時間與原始 log 在 `release/e11/candidate-a/`（`local_only`）。本機打包未上傳；fixture 在 Unity 執行前仍只是 Web 證據。

### 已實作的驗收集

| 集合 | 數量與範圍 |
|---|---|
| Web `layout-reachability.test.ts` | 4：34 目標可達、堵塞／寬通道、0.9 m 解析邊界、薄牆／阻擋起點／外部目標 |
| Web `director-parity.test.ts` | 8：fresh 再生一致、死亡／第三次 Reset 的 RNG 指紋、兩隊區域、受擊／倒地／攻擊／hit-stop 與碰撞卡住分開 |
| C# `DirectorEventsEditTests` | 8：99→100、多 bucket、半數向上取整、同時門檻優先、全滅抑制、MusouReady 共存、Reset、59/60／149/150／239/240 時序與壓力 |
| C# `DirectorParityEditTests` | 2：兩兵／300 兵／DEV 死亡重試三情境 13 個摘要，reset cooldown 指紋，hit-stop 負例 |
| C# `LayoutReachabilityEditTests` | 4：Web 對應幾何測試與 5.646044921875 m 保守共同路徑寬度下界 |
| C# `DirectorFlowPlayTests` | 4：雙語兩秒橫幅與存活計時切語言、N1 最後一擊穿過 controller 觸發 milestone／half、偏好與 session／非法語言、致死→結果延遲→正式重試 |
| Node e11 route guard | 19：完整 trace、缺欄位、dt／flow、數量／來源／解析度、離散差異與固定容差、DEV 尾段分類與橫幅等 |

固定錄製 30 Hz、15 秒、450 frames：前 9 秒 W 移動（seed 7、normal、初始化兩次 Reset、camera yaw PI），後 6 秒是 direct presentation event／session locale 的 DEV probe。前段沒有傳送或生命／KO 改值，必須走進兩隊區域，eligible stuck 總時間 ≤1 秒；連續座標容差預先鎖定 `1e-4`，離散欄位完全相同。

Web 參考的前段結果：KO 0、Opening、raw inputNoProgress／eligible stuck／operational idle 各 0 秒；最後 HP 844。只有開場一次 engagement onset `[0]`，intervals `[]`、mean `null`；這條路線無法驗證多次遭遇間隔或主觀節奏品質。自然流程、全部四階段與壓力感受仍需使用者試玩。

profile SHA-256 `8490a542024c444299464af748573c8820cbc8d16a2d6adee5308743b5403577`；asset lock `9ae03b49e5464581124b17744549840eef4c771b043c1d8143033e7e856f9f17`；趙雲 GLB `7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33`。三者未修改，profile 沒有接入 runtime。

工程驗收仍須同版本 Web 回歸、fresh clone Unity 五階段、固定路線影片、獨立 exact-candidate advisory 處置。使用者自然試玩、formal independent APPROVED、push／PR／merge、合併後確認尚未取得；不得標 VERIFIED 或 DONE。

## 已保留的失敗與修正

- 候選 `231437a3`：Unity Edit 164／164，Play 46／47；唯一失敗是 `2 - 1.99 - 0.01` 留下 `8.67e-18` 的精確零假設。分類 TEST_FAILURE，改用可精確表示的 `1.75 + 0.25` 邊界並新增 2.5 秒超時歸零；沒有修改產品計時器。
- 候選 `916116d8`：Web／runner／建置／打包與 Unity Edit 164、Play 47、Windows build 通過；原完整 run `05bf21d5-3a2b-4270-9d04-6b93489c62c7` 的 Player 退出發生 native／Mono crash 並達 120 秒 timeout，原結果保留 BLOCKED。產品或環境根因 UNVERIFIED，不把 runtime 報告的 errorCount 0 當 PASS。
- 同建置獨立 smoke `59c6d10a-5770-457d-a011-e3606c5c7c00` 正常 exit 0，runtime／character／source 與 Player＋六個 managed DLL 雜湊通過；focused=false，只作煙霧補測。不能改寫原 run 為單次五階段 PASS；native 根因仍未知。
- `916116d8` 路線已錄得 450 幀、數據與音訊檢查通過、無 native crash；但實看中英文 phase／half 畫面，診斷面板與橫幅重疊。獨立審查確認 MEDIUM，分類 PRODUCT_FAILURE（提示可讀性），先做上述模式 guard，再以新候選 fresh clone／影片重新驗證。不得沿用舊影片冒充修正後成功。

以上原始結果保留在 `.worktrees/_evidence/e11/`（local_only）；按原始失敗與實際修正輪次追溯，不重設任何預算。診斷面板修正是 E11 第二個來源修正候選；若必要檢查仍失敗，停止自動修正。最終候選、檢查與畫面結論在 commit 外的結案 evidence 登記。

## 回滾

普通 revert 本步 scoped commit，移除新增量測／fixture／測試與 Unity 提示接線，回到 E10 基線。保留 Web、資產、既有交接及驗收產物；不 reset／clean／force-push，不自動回退線上版本。
