# E08 敵群決策與四難度壓力

更新：2026-10-07（Asia/Taipei）。`stepStatus: DONE（限定接受；無 formal independent APPROVED）`；PR #37 合併為 `02a4a7f960568d2f13fab212488da43ab30baa1d`。本檔記錄範圍、設計與驗證方法；各候選 SHA 的實際執行結果記在 PR #37，不寫回本檔以免自我引用。

## 範圍與授權

使用者原文：「可接受,授權下一步」（E07 合併），接著對範圍審查的方向決定：「案照建議; A1, B1, C2」（D 與 ProjectSettings 照建議）。

- **A1 決策分層**：先逐幀照 Web，不做計畫提到的近／中／遠 20／10／2 Hz 分層；分層留到 E12 效能步驟，屆時另訂驗收口徑。
- **B1 對照方式**：以真正的 Web `Battle` 端到端產生對照——小群（6–24 人）、短時間（3–4 s）、四難度、逐幀逐位元；300 人只比每秒摘要（存活、交戰、令牌、攻擊者、KO、狀態分佈、玩家）與不變量。
- **C2 場景**：保留 20 個假人的驗證場景（AI 關閉，當打擊沙盒）；另以 F7 在同一場景生成 Web 戰場佈陣的 300 名士兵（AI 開啟，地面放大 12 倍），F6 循環四難度，HUD 顯示難度、階段、交戰數、攻擊者數。
- **D1 Web 原值**：上級／修羅末期交戰距離 ≥ 脫離距離 42 m（緩衝消失）、March 沒有停止條件、攻擊在同一步玩家命中之後才結算、Recover 結束後可能進入 `engaged=0` 的 Engage，都照 Web 保留，記為已知缺陷。
- 連擊、勝負與慢動作、無雙龍仍不在範圍。不修改 `src/`、`public/models/`、`.blend`，沒有新增套件，沒有付費或生成。

變量 V05／V06／V11／V12；情境 S04／S05 的分層正確性與 S08 的難度子情境。群體／AI 審查者待指定。

## 設計

- **`HitTargets` 補上 AI（`EnemyStore` 的其餘部分）**：狀態 March／Engage／Windup／Strike／Recover（與 Web 同值），欄位 `ring`／`engaged`／`token`／`dist2`（`float`），交戰計時 0.2 s、令牌計時（double，同 Web）。`Step` 的順序照 `update`：清空本步攻擊 → 每 0.2 s `AssignEngagement`（存活者依距離平方穩定排序——Web 的 `sort` 是穩定排序，C# 以索引作次鍵；54 人上限、脫離距離 42 m、九人一環 2.7＋1.25k；少於 20 人交戰時最近的待命兵轉 March）→ 每步 `AssignTokens`（0.2–0.6 s 一枚、8 m 內最近的繞環兵、上限隨難度與階段）→ 逐兵計時與狀態（Formation 煞車面向、March 2.8 m/s、Engage 繞環或有令牌時逼近 1.55 m 並在 1.9 m 內 Windup、Windup 0.55／0.85 s × 難度後 Strike（前衝 2.2 m/s；2.4／2.9 m、高度 < 1.4、角度 < 1 rad 內命中，傷害 26／70 × 難度）、Strike 0.14 s、Recover 0.5 s 後釋放令牌並抽 2.5–5.5 s 冷卻）→ 重建格網 → 互推與場地。受擊釋放令牌；隊長 Windup 中被 flinch 有 50% 免硬直（只在該情況抽亂數）。`AiEnabled=false` 保留 E07 行為（不交戰、不出手、反應結束回站立），E07 對照以此重播。
- **`Difficulty`／`BattleDirector`**：四檔（敵兵傷害、蓄力倍率、隊長血量、攻擊者上限、交戰距離）與階段（KO 60／150／240 加交戰距離 4／8／12、攻擊者 0／1／2）逐值移植。
- **`CastleLayout`**：25 隊中心、`squadSpawns`（每兵依序抽 x、z、yaw 抖動；每三隊一名隊長在前排中央；奇數隊持刀）以 mulberry32(7) 產生，與 Web 每場相同的 300 人佈陣。
- **`CombatSimulation`**：`Battle.step` 的順序——玩家更新 → `UpdatePressure`（以本步之前的 KO 數決定階段，變更送 `Phase` 事件）→ `Targets.Step` → 玩家命中 → 第二來源 → 擊殺 → **本步的敵兵攻擊**依 `resolveStrike` 結算（被擊殺或打斷的兵當步仍會傷到玩家，照 Web）。`SetDifficulty` 立即換用新難度的敵兵傷害與蓄力倍率，隊長血量與壓力值在下一次重新開戰（`Reset`）生效；控制器的 F6 一律重新開戰，所以兩者在遊戲中同時生效。
- **Unity**：`TrainingDummies` 加 `aiEnabled` 與可選的 Web 生成點（有生成點時以 `Reset` 建立，含兵種與隊長血量）；`CrowdSpawner` 在執行期生成 300 個膠囊（隊長 1.22 倍、不同色），由既有 `Show` 逐幀擺放；控制器 F6 循環難度並重新開戰、F7 切換 300 人壓力群；HUD 顯示難度、階段、交戰數、攻擊者／上限、AI 開關。士兵外觀仍是膠囊，城池與 voxel 士兵屬 E10。

## 對照資料

`scripts/lib/crowd-parity.ts` 直接建立 Web `Battle`（`Arena(PLAY_LIMIT, obstacles())`、玩家起點 `PLAYER_START`、容量 = 人數、種子 7），逐幀 `step` 並讀取 `EnemyStore` 的內部欄位，輸出 `unity/ChangshanLongdan/TestData/combat/web-crowd.json`（約 5.5 MB，`.gitattributes` 標為 generated）。Web `Battle` 在建構時會先 `reset` 一次（normal），開戰時再 `reset(difficulty)` 一次，士兵的亂數流已被抽過兩輪；Unity 重播同樣 `Reset` 兩次。11 個情境：

| 情境 | 內容 |
|---|---|
| `six_idle_{beginner,normal,hard,chaos}` | 6 人（含刀兵與隊長）逼近、繞環、出手打站著不動的玩家；攻擊者上限 2／4／5／6 |
| `six_guard_normal` | 玩家舉盾：格擋與隊長重擊穿透 |
| `six_attack_normal` | 玩家 N 連段打逼近的兵：硬直釋放令牌、擊殺計入 KO |
| `eighteen_march_normal` | 12 人在交戰距離外：最近的兵行軍直到至少 20 人交戰 |
| `twentyfour_rings_chaos` | 三個環、修羅 6 枚令牌 |
| `six_walk_hard` | 玩家穿過人群，環重新成形 |
| `castle_{normal,chaos}_idle` | 300 人正式佈陣 6 s，只記每秒摘要（60 Hz） |

小群情境 30／60／120 Hz（120 Hz 每兩步記錄一次），每幀記玩家 10 欄、hit-stop、攻擊者數、KO、事件（命中、擊殺、攻擊、完美格擋、格擋、受傷、階段）與每個士兵 18 欄（E07 的 14 欄加 engaged、token、ring、cooldown）。fixture 記錄 13 個 Web 來源檔雜湊；`npm run parity:write`／`parity:check` 同時處理五份 fixture。

## 驗證方法

| 檢查 | 內容 |
|---|---|
| Vitest `crowd-parity.test.ts`（2） | fixture 逐位元組相同；11 情境齊全、四難度都出現 Engage／Windup／Strike／Recover 且攻擊者不超過上限、格擋／擊殺／硬直／行軍／三環各自出現、城池摘要 300 人與上限 |
| Edit Mode `CrowdParityEditTests`（15） | 來源雜湊、情境集合、30／60／120 Hz 小群逐幀比對（玩家、hit-stop、攻擊者、KO、事件逐筆、士兵 18 欄；離散值完全相同，連續值 1e-4）、城池每秒摘要逐值相同、難度表、導演階段、300 個生成點與 Web 相同、等距離排序穩定、令牌上限與受擊釋放、單兵逼近出手、AI 關閉保持站立、四難度的攻擊傷害與隊長血量 |
| Play Mode `CrowdPlayTests`（2） | 場景：假人 AI 關閉；F7 生成 300 人（9 名隊長）、十秒內有人行軍、交戰、蓄力、出手打到玩家，攻擊者不超過上限，膠囊跟著邏輯位置，關閉後回到 20 假人；F6 循環難度且隊長血量與攻擊者上限隨之改變、四次回到普通 |
| E05／E07 既有 | `HitParity`（`Static`）與 `ReactionParity`（`AiEnabled=false`）照常一致 |

### 輔助證據（不算 Unity 驗收）

同一份 C# 在 .NET 8 重播：29 組（9 情境 × 3 頻率 ＋ 2 個城池摘要）5,134 幀全部一致，最大偏差 5e-7；300 人城池 6 秒的每秒摘要（含狀態分佈）逐值相同；每步約 0.3 ms。E07 的 48 組與 E05 的 22 個情境在加入 AI 後仍全部一致。

## 併入 E07 補件與審查處置

2026-10-07 把 main（E07 補件 PR #35、結案 PR #36）併入本分支：`CombatEventType` 同時保留 `Phase` 與 `MusouReady`，`StepOnce` 依 `Battle.step` 先結算敵兵攻擊再發 `MusouReady`；runner 清單與對照 fixture 兩邊都登記。

Unity 失敗輪次（候選與原因）：`6000f29` Play `PressureCrowdEngagesAndStrikesThePlayer` 要求城池人群出現 March，但 Web `castle_normal_idle` 摘要開場即 36 人交戰（≥ 20）、六秒內 March 為 0，斷言改為不含 March；`853e5f4` 同測試把膠囊 y 歸零卻與錨點 y = −1 的邏輯點比距離（診斷輸出 xz 完全相同），改為只比水平距離。兩者都是測試錯，AI 與顯示和 Web 一致。

獨立 advisory 審查 1 輪（Claude code-reviewer 子代理，唯讀；不是 formal APPROVED）：無 blocker／HIGH。已處置：MEDIUM 階段壓力接線沒有測試（新增 `PressureFollowsTheKillsInsideTheSimulation`：70 KO 當步仍 Opening、下一步 Pressure 且交戰距離 +4、160 KO 後 Surge 攻擊者 +1、Restart 回 Opening）；MEDIUM 穩定排序測試無法失敗（改為斷言邊界對 4／14 與每對順序）；LOW 兩個對照 harness 的 `Collect` 補上忽略 `MusouReady`／`Phase`；文件修正測試數、`SetDifficulty` 生效時機、階段橫幅與隊長膠囊高度列入已知限制。延後：壓力群材質未釋放、`order.Sort(Comparison)` 每 0.2 s 的小配置、`CastleLayout.Capacity` 與 `candidates` 死碼、`RingsSeen` 未斷言。

## 合併與合併後確認

使用者原文：「試玩可以, 合併 #37」（試玩 300 人壓力群與難度切換，限定接受；候選 Player 為 `45308db` 的 build）。合併前即時核對：head `39cdc06ce2bc7237c643111dfeaa7604b6982160` 與本機相同，兩項 CI 綁定 head 成功，review comments 0，auto-merge 關閉，草稿先標記 ready 再以一般合併提交。**GitHub 上沒有任何 review approval**，依使用者授權合併，屬限定接受；advisory 子代理審查 1 輪不是 formal APPROVED；群體／AI 審查者未指定。

- merge commit `02a4a7f960568d2f13fab212488da43ab30baa1d`（2026-10-07 11:00 +08:00，一般合併，父提交 `6ca60b5`、`39cdc06`）；tree 與 head 相同；來源分支保留。
- 合併後確認（merge SHA，全新 clone）：本機 Unity 五階段通過（runId `1dfaa617-b2d5-48e1-8acb-d9d45ce708fe`，2026-10-07 11:00–11:06 +08:00；compile、Edit 122/122、Play 36/36、Windows build、Player）；Web Vitest 32 files／294 tests、typecheck、build、`parity:check` 六份一致、runner 65/65；main 的 Game CI（run 37564694593）success。
- E08 以限定接受標 DONE：V05／V06／V11／V12 與 S04／S05／S08 子情境的程式與對照證據齊備；決策分層（A1）、全規模長測與效能屬 E12，正式感官與獨立審查仍待後續。

## 已知限制

- 階段變更的橫幅未移植（Web 顯示 2 秒 banner）；Unity 只有除錯 HUD 的階段欄位，F3 隱藏後沒有提示。
- 隊長膠囊 1.22 倍高但以固定高度擺放，視覺上下沉約 0.2 m；壓力群每次開啟複製兩個材質，關閉時未釋放（Editor 內到 domain reload 才回收）。

- 決策分層（A1）未做；300 人每步做互推查詢與每 0.2 s 一次排序，效能驗收屬 E12。
- D1 保留的 Web 行為：緩衝反轉、March 無停止條件、攻擊晚一步結算、`engaged=0` 的 Engage 漏狀態。
- 300 人互推屬混沌系統，逐位元一致只在短時間小群驗證；城池只比每秒摘要，6 s 內逐值相同不代表更長時間仍相同。
- 「可見人數」在 Web 邏輯層不存在，S05 的四數只有存活／交戰／攻擊者。
- 士兵仍是膠囊、無城池、無特效與音效；敵兵出手沒有預警動畫（只有 HUD 與受傷回饋）。
- 重試照 Web 不重新播種亂數。群體／AI 審查者未指定。

## 回滾

普通 revert 本步提交即可：`HitTargets` 回到 E07 的無 AI 版本、`CombatSimulation` 去掉導演與攻擊結算、移除 `Difficulty`、`CastleLayout`、`CrowdSpawner`、fixture 與測試；Web 版、`src/`、`public/models/` 與 `.blend` 未變更。
