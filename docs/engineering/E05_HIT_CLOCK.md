# E05 命中去重與遊戲時鐘

更新：2026-10-05（Asia/Taipei）。`stepStatus: IN_PROGRESS`（本機實作；未推送、未建立 PR、未審查）。本檔記錄範圍、設計與驗證方法；各候選 SHA 的實際執行結果綁定該 SHA 另行記錄，不寫回本檔以免自我引用。

## 範圍與授權

使用者原文：「手感可接受，授權合併 PR #24，合併後確認並開始 E05」，接著「方向 1，照建議的設計開始 E05 實作，不推送。」

核准的設計：純 C# 的命中解析與時鐘；20 個靜態假人（扣血、死亡後不再被命中照 Web；擊退與受擊反應屬 E07，敵兵 AI 屬 E08）；以未修改的 Web 原始碼產生對照資料，涵蓋 N1、N4、C5、MUSOU 打 1／5／20 人、距離／寬度／角度／高度邊界、取消、死亡、步長大於判定窗、hit-stop 內輸入；交錯判定情境記錄 Unity 與 Web 的刻意差異；Unity 場景加入假人與除錯文字；Web 缺陷只開 issue，不改 `src/`。

變量 V02／V03／V05／V12；情境 S02 與 S01 的停頓／取消邊界。碰撞／測試審查者待指定。

## 範圍審查發現：Web 單一 stamp 去重

`EnemyStore.applyHit` 每個士兵只記住最後一個 stamp（`hitStamp[i]`）。無雙時玩家判定窗與龍頭判定（`dragonStamp`，每 0.12 秒換新）若在相鄰幀交錯打到同一士兵，玩家那個判定窗會再次命中。直接以 Node 呼叫 Web `EnemyStore.applyHit`（P、D、P）重現：同一個 P 扣了兩次血。對照 harness 中以每幀插入的第二來源重現時，玩家判定窗每幀重複命中並每幀重新觸發 hit-stop。實際遊玩中無雙龍與玩家判定是否同幀打到同一人，以及其頻率，尚未在完整遊戲中重現（推論，未驗證）。

## 設計

- **時鐘（`GameClock`）**：把 `Game.simulate` 的三種時間寫成明確物件。真實／輸入時鐘每個渲染幀前進，上限 0.05 s，輸入每幀輪詢並在 hit-stop 中照常排入；遊戲時鐘（`SimTime`）只在模擬前進時累加，hit-stop 時凍結，慢動作時乘 0.3；動畫時鐘（E06）以 `SimTime` 驅動，所以姿勢會跟著 hit-stop 停住。hit-stop 與慢動作都以真實時間倒數，與 Web 相同。`PlayerDriver` 改用 `GameClock`，E04 行為不變（E04 對照重跑全數一致）。
- **命中目標（`HitTargets`）**：`EnemyStore` 中接收命中的部分（位置、尺寸、血量、存活），SoA 陣列；血量是單精度，與 Web `Float32Array` 相同的捨入。身體半徑 0.42 × scale；自動瞄準 `Nearest` 照 `EnemyStore.nearest`（嚴格小於、略過死亡）。
- **命中解析（`HitResolver`）**：照 `applyHit` 的高度（預設 −0.6／+2.6，相對攻擊者腳底）、形狀、徑向方向與扣血。身分改為「判定實例 × 目標」：每個 (stamp, 目標) 最多命中一次；stamp 由每個判定窗開始時發出，等於 attackInstance × hitWindow。某個 stamp 在上一個模擬步沒有被套用就視為判定窗結束並忘記，記憶量只跟進行中的判定窗有關。hit-stop 期間不前進，所以不會誤判結束。
- **整合（`CombatSimulation`）**：時鐘決定是否前進；前進時玩家更新、每個啟動中的判定窗打目標、有命中的判定窗要求 hit-stop（時鐘取最大）並依 `Game.onHits` 給無雙量 `min(9, 命中數 × 1.4)`；其他來源（之後的龍）在同一步之後以 `ApplyExternal` 加入，不給 hit-stop 與無雙量。每個命中寫成 `HitEvent`（步數、遊戲時間、來源、stamp、招式、判定窗、目標、傷害、剩餘血量、是否擊殺、方向）。
- **Unity**：控制器改用 `CombatSimulation`，自動找場景中的 `TrainingDummies`；假人死亡即隱藏，重試全部復原（保留同一個 `Player`）。`CharacterSetup` 在驗證場景加入 20 個膠囊假人（2.8 m 12 個、4.2 m 8 個，避開角色正前方 120° 以免擋住驗證鏡頭）與材質；控制器以 IMGUI 顯示狀態、招式、命中數、hit-stop 與剩餘假人（F3 切換）。Foundation 說明文字改為涵蓋 E04／E05。

## 對照資料

`scripts/lib/hit-parity.ts` 以 Web `Player` 與 `EnemyStore`（只呼叫 `reset` 與 `applyHit`，不呼叫 `update`，士兵不動）依 `Game.simulate` 的順序逐幀執行，輸出 `unity/ChangshanLongdan/TestData/combat/web-hits.json`。按鍵依遊戲狀態觸發（第 k 次按鍵在第 k 招開始並經過指定時間後），因為命中造成的 hit-stop 會延後連段；產生器要求出招序列完全相同，否則失敗。Web stamp 是全域計數器，兩邊以出現順序命名（P1、P2…，第二來源 F1…）比對。21 個情境：N1／N4／C5／MUSOU × 1／5／20 人、射程／寬度／角度／高度掃描（橫向掃描以正前方錨點固定自動瞄準）、C5 被閃避取消、低血量擊殺後不再被打、20 Hz 下比 C5 刺擊窗口更長的步長、hit-stop 中按蓄力只消耗一次、交錯第二來源；30／60／120 Hz（步長情境為 20／60 Hz）。fixture 記錄 9 個 Web 來源檔雜湊；`npm run parity:write`／`parity:check` 同時處理 E04 與 E05 兩份 fixture。

## 驗證方法

| 檢查 | 內容 |
|---|---|
| Vitest `hit-parity.test.ts`（4） | fixture 與重新產生逐位元組相同、21 個情境齊全、只有交錯情境出現 Web 重複命中、邊界掃描跨越邊界且 hit-stop 不超過最長要求 |
| Edit Mode `HitParityEditTests`（16） | 來源雜湊、情境集合、20／30／60／120 Hz 逐幀比對（狀態、位置、無雙量、hit-stop、命中名單、擊殺、單精度血量）、交錯情境每組只命中一次且命中集合與 Web 相同、每個判定實例對每人最多一次、hit-stop 取最大（含 20 人同中單元測試）、擊殺後不再被打、步長大於判定窗仍命中、邊界跨越、取消後終結技不命中、結束的判定窗被遺忘、時鐘凍結與慢動作、最近目標選擇 |
| Play Mode `ZhaoYunHitPlayTests`（3） | 場景 20 個假人的位置與血量、N1 命中假人一次且 hit-stop 凍結遊戲時間、擊殺後隱藏且不再被打、重試復原 |
| Edit／Play 既有 | E04 的對照與控制器測試照常；控制器測試明確不使用假人 |

比對容許誤差：離散值（狀態、招式、命中名單、擊殺）與單精度血量完全相同；連續值 1e-6。

輔助證據（不算 Unity 驗收）：同一份 C# 與對照程式在 .NET 8 上重播，62 組（情境 × 頻率）全部一致；E04 對照在新的 `PlayerDriver` 下仍全部一致。在暫存副本植入 3 個錯誤（hit-stop 改為相加、死亡目標可被命中、高度下限 −0.7）各自被抓到 168、132、12 行不一致。

## 已知限制

- 假人不動、不反應：擊退、浮空、受擊硬直、隊長倍率屬 E07；敵兵 AI 與空間格網屬 E08（目前逐一檢查，20 人足夠）。
- 計畫要求的「扣血事件與判定影片對齊」：本機只能提供 trace 與截圖，沒有錄影工具，影片列為缺口。
- 龍頭（無雙特效）尚未移植；交錯情境以模擬的第二來源證明去重規則。
- Web 單一 stamp 缺陷只記錄，不修改 `src/`。
- 自動瞄準在距離完全相同時，Web 依空間格網順序、Unity 依索引順序選擇；對照情境刻意避免平手。

## 回滾

普通 revert 本步提交即可：移除命中解析、時鐘、假人、fixture 與測試，`PlayerDriver` 回到 E04 版本；Web 版、`src/`、`public/models/` 與 `.blend` 未變更。
