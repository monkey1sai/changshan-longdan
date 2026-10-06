# E07 打擊回饋與受擊循環

更新：2026-10-06（Asia/Taipei）。`stepStatus: IN_PROGRESS（草稿 PR 審查中）`。本檔記錄範圍、設計與驗證方法；各候選 SHA 的實際執行結果記在 PR，不寫回本檔以免自我引用。

## 範圍與授權

使用者原文：「方向 1，授權合併 PR #30，合併後確認並開始 E07」，接著對範圍審查的三個方向決定：「A1、B1、C1，龍不納入，照建議設計開始 E07，不推送」。

- **A1 範圍邊界**：只移植敵兵的受擊反應狀態機（硬直、浮空、擊退、倒地、起身）、擊退／擊飛數值、隊長倍率、擊殺資料、受擊閃光、互推與場地約束、玩家的受擊循環（受傷、倒地、無敵、格擋、完美格擋、霸體、死亡）、無雙 gain/cost 與呈現用事件流。敵兵不走 AI：不反應時只做 Web `Formation` 狀態的煞車與面向玩家，反應結束回到站立（Web 回到 Engage／March）；攻擊令牌、交戰與 AI 屬 E08。敵兵出手來源在 E08 之前以注入（`InjectStrike`，對應 Web `Battle.debug.injectStrike`）代替。
- **B1 對照精度**：Unity 照 Web 的目標走訪順序（空間格網，格 2 m，格子先 x 後 z、格內依插入順序）與 `Float32Array` 捨入（每次寫入轉成 `float`），亂數照 Web `createRng`（mulberry32，種子 7，`reset` 不重新播種）在相同順序消耗。
- **C1 隊長循環**：保留 Web 原值。Web 空中 launch 沒有套隊長倍率、Down 中再被 knockdown 會重置計時、Getup 沒有無敵，所以 V05「隊長不陷無限浮空」在 Web 本身沒有保證；E07 不改規則，記為已知缺陷待後續決定。
- 無雙龍（`dragon-strike.ts`）不納入。連擊數、戰鬥階段、勝負與慢動作不在本步（`GameClock.StartSlowmo` 仍無呼叫者）。不修改 `src/`、`public/models/`、`.blend`，沒有新增套件，沒有付費或生成。

變量 V03／V05／V11；情境 S02／S04 及 S08 的重置子情境。戰鬥／音效審查者待指定。

## 設計

- **`HitTargets`（純 C#，`src/entities/enemies.ts` `EnemyStore` 去掉 AI）**：SoA `float` 陣列（位置、速度、朝向、血量、狀態時間、閃光、旋轉、旋轉速度、冷卻、相位、體型、側向）、`EnemyState`（Idle 與 Web 同值的 Flinch 6／Air 7／Knockback 8／Down 9／Getup 10／Dead 11）、`EnemyKind`（Spear／Sword／Captain）。`Reset(spawns)` 照 Web `reset` 的亂數順序（血量 40–52、狀態時間、相位、冷卻、側向、體型 0.96–1.04；隊長 230 血、1.22 倍體型）；`Add` 保留 E05 的靜態假人（不消耗亂數）。`Step(dt, 玩家位置, arena)` = Web `update` 去掉交戰與令牌：閃光每秒衰減 9、狀態計時、各狀態的煞車與計時（Flinch 0.42 s、Knockback 0.4 s、Down 1.15 s、Getup 0.5 s；Air 自行積分重力 25、落地時水平速度 ×0.35 進 Down）、重建格網、`separate`（著地的兵互推、與玩家保持 0.95 m、場地約束）。`Damage(i, window, dir)` = Web `damage`：扣血、閃光、面向攻擊來源、五種反應（隊長 push ×0.6、地面 lift ×0.7；空中 flinch 給 3.2 上升、launch 取 lift×0.75、knockback 2.5、knockdown 以 −10 砸下並減半推力）、擊殺記錄 `KillInfo`（飛散速度 push×0.8＋原速度×0.3、上升 max(lift, 2.5)×0.8）。`Static` 旗標給 E05 對照（Web 的命中 harness 從不呼叫 `update`）。
- **`SpatialHash`／`Mulberry32`**：`spatial-hash.ts` 與 `createRng` 的逐位元移植；`HitResolver.Apply` 以格網順序走訪候選（E05 的去重規則不變），`HitTargets.Nearest` 也照 Web 走格網。
- **`CombatSimulation`**：`Battle.step` 的順序——時鐘、玩家更新、`Targets.Step`（Web 在玩家命中前先跑 `soldiers.update`）、玩家判定窗命中（反應在命中當下套用）、第二來源回呼、`ResolveKills`。每步產生 `CombatEvent`（Hit 含來源與窗、Kill、EnemyStrike、Parry、GuardBlock、Hurt），`Hits` 每筆含命中位置與方向（火花用），`Kills` 含 `KillInfo`。`InjectStrike` 照 `Battle.resolveStrike`：完美格擋要求 0.06 s hit-stop、格擋事件帶穿透傷害、受傷事件帶來源位置；累計 `DamageSum`、`KoCount`。
- **Unity 呈現（`Changshan.Character`）**：`TrainingDummies.Show` 每幀依目標狀態擺放膠囊——位置（含高度）、面向、`soldier-view.ts` 的姿勢（硬直前傾 −0.45·sin、擊退前傾 −0.4、空中依 spin 翻滾、倒地 −π/2 並下沉 0.74 m、起身以 smoothstep 回正）、受擊閃光以 `MaterialPropertyBlock` 把底色混向白色；死亡隱藏，重試回到原始生成點。`CameraShake`（`camera-rig.ts` 的震動）：trauma 平方決定位移與滾轉、每秒衰減 1.5；重擊 kick 收縮視野 4°、每秒衰減 6；在 `LateUpdate` 疊在當幀鏡頭之上。控制器把事件轉成回饋（`presentation.ts` 的鏡頭部分）：命中 trauma = shake ×（>3 人 1.15）、重擊 kick 0.5、受傷 0.45／0.25、完美格擋 0.12、格擋 0.04、shockwave 特效 0.3、blast 特效 trauma 1＋kick 1、無雙開始 0.35、重落地 0.15；玩家事件只在有前進的幀播放（hit-stop 期間 Web 不播任何事件，而 `Player.Events` 仍保有凍結那一步的事件，審查發現）；HUD 顯示血量、KO 數與最後一筆事件；F4／F5 注入輕／重攻擊（開發用，距玩家正前方 2 m）。火花、塵土、碎片、刀光與音效尚未移植。

## 對照資料

`scripts/lib/reaction-parity.ts` 以未修改的 Web `Player`、`EnemyStore` 與 `MOVES` 逐幀執行，輸出 `unity/ChangshanLongdan/TestData/combat/web-reactions.json`（約 4.7 MB，`.gitattributes` 標為 generated）。敵兵更新直接呼叫 `EnemyStore` 的 private `step`／`rebuildHash`／`separate`：不反應的兵以 `Formation` 狀態執行 `step`，`recover()` 回到的 Engage／March 立刻改回 `Formation`（Unity 的 Idle），與 A1 的 Unity 行為一一對應。16 個情境 × 30／60／120 Hz（120 Hz 每兩步記錄一次，有事件的步必記）：

| 情境 | 內容 |
|---|---|
| `flinch_twice`、`captain_flinch_push` | 第二來源窗打 5 人：硬直、硬直中再被打；隊長推力 ×0.6 |
| `launch_juggle_land` | C1 浮空 → 空中被 N1（上升 3.2）→ 空中被 C3:1（lift×0.75）→ 落地 → 倒地 → 起身 |
| `knockback_crowd` | N5 徑向擊退 20 人：互推與場地約束 |
| `blowaway_captain_and_soldier` | N6 吹飛隊長與士兵：lift×0.7 |
| `knockdown_cycles`、`getup_flinch` | 倒地中再 knockdown 重置、倒地中被 launch 再浮空、空中 knockdown 砸下；起身中被打 |
| `kill_velocities` | 10 血士兵被 C2／N5 擊殺：`KillInfo` 速度 |
| `n6_string_crowd`、`c5_crowd`、`musou_crowd` | 玩家實際出招打 5／20 人：命中順序、反應與亂數消耗順序照格網 |
| `hurt_light`、`hurt_heavy_down_invuln`、`guard_parry_then_block`、`armor_half_damage`、`death` | 注入攻擊：受傷 0.4 s、重擊倒地 1.3 s 與 1.6 s 無敵、完美格擋（+12 無雙、0.06 s hit-stop）與格擋（重擊 45%）、C4 霸體半傷不硬直、死亡 |

每幀記錄玩家狀態（含血量、無敵）、hit-stop、事件（命中：窗名、目標、擊殺、剩餘血量、位置、方向；擊殺：`KillInfo`；攻擊：來源與結果）與每個士兵的 14 個欄位。fixture 記錄 9 個 Web 來源檔雜湊；`npm run parity:write`／`parity:check` 同時處理四份 fixture。`tests/reaction-parity.test.ts` 另以真正的 `Battle`（一名遠處隊長、`debug.injectStrike`）重跑五個攻擊情境，核對玩家狀態、血量、無雙與事件順序，證明 harness 手寫的 `resolveStrike` 鏡像與 Battle 一致（勝負事件不在範圍，比對時排除）。

## 驗證方法

| 檢查 | 內容 |
|---|---|
| Vitest `reaction-parity.test.ts`（3） | fixture 逐位元組相同；16 情境 × 3 頻率齊全、七種敵兵狀態都出現、各情境的關鍵狀態與事件；攻擊情境與真正的 `Battle` 一致 |
| Edit Mode `ReactionParityEditTests`（13） | 來源雜湊、情境集合、30／60／120 Hz 逐幀比對（玩家 10 欄、hit-stop、事件逐筆、每個士兵 14 欄；狀態、存活、血量、命中名單完全相同，連續值容許 1e-4，見下）、七種狀態都在 Unity 出現、mulberry32 前四個值、命中順序照格網、隊長倍率與空中 knockdown、各反應計時回到站立、互推與與玩家距離、擊殺資料、注入攻擊只能在步外且照 Battle 規則、fixture 狀態覆蓋 |
| Play Mode `ReactionPlayTests`（3） | 場景：N1 打中假人後假人硬直、前傾、閃白、鏡頭有 trauma，0.42 s 後回正站地；JA 命中（同一步帶 shockwave 特效）後 hit-stop 凍結的幀不再增加 trauma；F4／F5 注入：受傷 0.4 s、重擊倒地與無敵、無敵中攻擊無效、倒地 1.3 s 後起身、trauma 隨真實時間衰減 |
| E05 既有 | `HitParity` 以 `Static` 重播：命中去重與 hit-stop 規則不變（士兵不移動） |

### 容許誤差

離散值（狀態、存活、血量、命中名單、事件型別）完全相同；玩家連續值 1e-6；士兵連續值與事件中的位置／方向 1e-4。原因：`atan2`／`exp` 在不同執行環境差一個 ULP，徑向命中與互推的 `dx / d` 在 d 很小時把 1 個 ULP 的位置差放大進速度，`musou_crowd` 四秒後位置最多差 4.5e-5 m（.NET 重播量得）；其餘情境 ≤ 1e-5。

### 輔助證據（不算 Unity 驗收）

同一份 C# 在 .NET 8 重播：48 組（16 情境 × 3 頻率）6,076 幀全部一致，最大偏差 4.5e-5；E05 的 22 個命中情境在新的 `HitTargets` 上重播仍全部一致。

## 已知限制

- 火花、塵土、碎片、刀光與音效未移植：事件流已含所需資料（命中位置、方向、`KillInfo`、sfx 種類），呈現留待特效步驟；計畫要求的「命中、扣血、聲音／VFX 時點共同 trace」目前只有命中與扣血（事件）與鏡頭震動。實際聽感無證據，保留缺口。
- 敵兵不出手（E08）；玩家受擊循環只能以注入攻擊驗證。
- Web 允許無限浮空／倒地循環（C1），隊長在 Web 只有 Windup 中 50% 免硬直，沒有真正的霸體／破防；E07 原樣保留，A1 下 Windup 不存在所以該機率路徑不會發生。
- 連擊、`comboBreak`、戰鬥階段、勝負與慢動作、無雙龍未移植。
- 假人姿勢是膠囊的傾斜與翻滾，不是士兵模型（倒地時以膠囊半徑貼地，不照 Web 的 0.74 m 下沉）；數值通過不等於視覺通過，需要戰鬥／音效審查。
- 鏡頭震動在 `LateUpdate` 先撤銷上一幀的位移再疊加，前提是沒有其他元件在幀間絕對設定鏡頭姿勢；之後接鏡頭 rig 時要改為由 rig 每幀重設基準。
- `Separate` 讀取 float 時先轉 double 再相減（Web 在 double 相減是精確的）；其餘運算都已混入 double 或在存入時轉 float。
- 重試照 Web 不重新播種亂數：第二場的體型與冷卻與第一場不同。

- 審查延後項目（LOW／NIT）見 issue #34：容忍度對 Float32 寫入的直接斷言、反應 harness 對真 `EnemyStore.update` 的交叉驗證、`CameraShake` 前提、`Restart` 不重設目標、`rngHp` 比對。

## 補件：回饋呈現（特效與音效）

PR #33 已合併（`dfc71890699959ad6e63d724ae8f26d864e3f2ce`），但計畫 E07 交付的音效、刀光與「命中、扣血、聲音／VFX 時點共同 trace」沒有完成，所以 E07 不標 DONE。使用者決定：「補做 VFX＋音效」（選項說明：在 Unity 移植火花、塵土、刀光與合成音效，命中／扣血／聲音／VFX 共同 trace，跑完五階段後請使用者試玩，之後才以限定接受結案）。

### 開始前範圍審查

```text
stepId: E07（補件）
status: IN_PROGRESS
implementationPr: null（未獲推送授權前只在本機分支 claude/e07-feedback）
implementer: Claude（Opus 5.5）
independentReviewer: 待指定（戰鬥／音效審查者仍未指定；advisory 審查不是 formal APPROVED）
sourceBaseSha: dfc71890699959ad6e63d724ae8f26d864e3f2ce
changedVariableIds: [V03, V11]
requiredScenarioIdsAndSubcases: [S02 回饋時點, S04 群體命中回饋, S08 重置清除]
allowedPaths: [scripts/, tests/, unity/ChangshanLongdan/, docs/engineering/, package.json, .gitattributes]
forbiddenChanges: [src/, public/models/, .blend, 新套件, 付費或生成, 推送／PR／合併（未授權）]
```

- **交付**：Web 的 `Presentation.play`（`src/presentation.ts`）對 E07 已有事件的部分（揮擊、跳躍、落地、閃避、無雙開始、地面特效、命中、擊殺、敵兵出手、完美格擋、格擋、受傷、無雙就緒）以純 C# 移植成 `FeedbackDirector`；火花（`sparks.ts`）、塵土（`dust.ts`）、衝擊波環與光柱（`shockwave.ts`）、體素碎片（`fragments.ts`）、槍尖刀光（`trail.ts`）的模擬以純 C# 移植，Unity 只負責繪製；`audio-engine.ts` 的對應音效以純 C# 離線合成，Unity 以 `OnAudioFilterRead` 混音播放。亂數照 Web `createRng(99)`，在相同順序消耗。
- **對照**：新增 `scripts/lib/presentation-parity.ts`，以未修改的 Web `Battle`、`Presentation` 與特效類別逐幀執行，記錄每幀輸入事件、各輸出端呼叫（含音效參數與聲道）、亂數消耗數與特效狀態；`TrailRibbon` 以合成的槍尖軌跡對照 Web `Trail`。Unity Edit Mode 逐幀比對。
- **共同 trace**：每幀記錄模擬步、遊戲時間、命中與扣血、發出的音效與特效；音效另記混音器實際開始播放的取樣位置。Play Mode 驗證命中、火花、音效指令同一幀，聲音在一個 DSP 緩衝內開始。路線錄影加上離線混音的音軌。
- **不納入（照 A1 與既有範圍）**：無雙龍（`dragonHit`、龍吼、龍身光點）、音樂與環境音、連擊／里程碑／階段／勝負橫幅與音效、後製（色差、徑向模糊、閃白、bloom）與無雙切入畫面；事件仍記入 trace，畫面不呈現。Web 的動態壓縮器與迴響以近似演算法實作（WebAudio 原生節點在 Unity 沒有對應），差異保留為已知限制。
- **驗證**：Web Vitest、`parity:check`、runner 正負例；Unity 五階段於候選 SHA；路線影音；使用者試玩與聽感。缺聽感證據就保留缺口，不以數值通過代替。
- **回滾**：revert 本補件提交，回到 PR #33 的狀態（只有鏡頭震動）。

## 回滾

普通 revert 本步提交即可：`HitTargets` 回到 E05 的靜態版本、`CombatSimulation` 回到無事件流版本，移除 `EnemyTypes`、`Mulberry32`、`SpatialHash`、`CombatEvents`、`CameraShake`、fixture 與測試；Web 版、`src/`、`public/models/` 與 `.blend` 未變更。
