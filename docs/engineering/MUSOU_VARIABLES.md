# 《常山龍膽》無雙類動作遊戲工程變量

日期：2026-10-02（Asia/Taipei）
狀態：設計提案；尚未套用至 runtime，也不是遊玩驗收報告。
搭配資料：[musou-profile.proposed.json](./musou-profile.proposed.json)。

本文從無雙類動作遊戲工程角度，將「爽快、連貫、百人戰場、漂亮而流暢」拆成可調參數、實測指標與不可破壞的約束。這是本專案的工程提案，不是光榮特庫摩的內部參數或官方製作規格。所有新增門檻都是待實測校準的候選值，不是已達成結果。

## 1. 現況與重構邊界

唯讀基準為 main `a42c9294c32ac8ff566bc019dc5465b9dc7ad1d9`，目前仍是 Three.js / TypeScript / Vite。Unity + Hyper3D + Blender 是本次討論的目標工作流，不能寫成已完成遷移；不能把更換引擎視為自動提升美術品質。

| 來源 | 已確認內容 | 不可擴張的結論 |
|---|---|---|
| main `src/entities/player.ts` | RUN_SPEED=7.4 m/s、BUFFER=0.45 s、DODGE_TIME=0.42 s、PARRY_TIME=0.16 s | 程式常數不是實測操作延遲，也不是平衡已驗收 |
| main `src/combat/moves.ts` | N1–N6、C1–C6、JA、JC、DASH、COUNTER、MUSOU；招式有命中、取消、位移、刀光、音效時間 | 不因前一輪四段連招試作建議而刪掉既有六段招式 |
| main `src/entities/enemies.ts` | MAX_ENGAGED=42、MIN_ENGAGED=20、MAX_ATTACKERS=4、ENGAGE_RANGE=26 m、RELEASE_RANGE=34 m | engaged 數、攻擊者數、可見數、存活數不可混用 |
| main `src/view/camera-rig.ts` | 基礎垂直 FOV=55°、水平距離參數=9.2 m、縮放限制5.5–13 m；已有 clearance | 距離參數不是攝影機到角色的完整3D直線距離；不代表所有屋簷情境通過 |
| PR #3，head `1583ff1c286a7940223e7ee48ec1209c1e699bbc` | Draft、未合併；四難度 profile 與 Director 基礎 | PR 中功能不等於 main 已有，更不等於完整戰場任務系統 |
| PR #7，head `2f14f7038d0f0a99ca94e1295842f32682c04c2a` | Draft、未合併；PR 說明記錄趙雲GLB、骨架驗證、回退、tip/tipBase契約與29,202 triangles | 本次沒有重跑模型檢查或親自驗證線上包；不得把PR描述當成本次實測 |
| PR #5 / #6 | 近期PR分別處理鏡頭遮擋、選單出陣；本文只引用責任範圍 | 不合併、不改寫其他PR，不沿用舊head的驗收替新版本背書 |

使用者已有Blender趙雲來源；實作前核對實際 .blend 路徑、版本、雜湊及其與GLB的關係。不要假定本地檔案已推上GitHub，也不要要求重新生成角色取代既有成果。

## 2. 三種變量必須分開

- **可調參數（K）**：我們主動設定，例如取消時間、敵兵攻擊名額、動畫混合秒數。
- **觀測指標（M）**：必須量出來，例如漏判率、握槍誤差、p95幀時間；未知用null，不用0或PASS。
- **硬約束（G）**：不能以其他分數補償，例如同一命中事件重複扣血、模型載入失敗後角色消失、篡改測試或素材來源不明。

沒有一個「畫質分數」可以抵銷輸入吃鍵或命中錯誤。每項紀錄都要有：名稱、單位、來源/基準、候選值、量測方法、負責模組、驗收狀態。

## 3. 變量矩陣：直接對應本專案

下表的Unity型別名稱是**待建立的設計名稱**，不是現有檔案。

| ID / 工程目標 | 主要可調參數 K | 必須觀察 M / 保護 G | 現有落點 → Unity目標 |
|---|---|---|---|
| V01 操作回應 | inputBufferSec、runSpeedMps、turnRate、dodgeDurationSec、parryWindowSec、cancel條件 | 合法輸入到狀態開始的延遲；hit-stop不吃鍵；暫停/失焦後不誤出招；防禦角度有效 | `src/entities/player.ts`、`src/core/input.ts` → PlayerTuning + InputAdapter |
| V02 招式節奏 | startup、active interval、duration、comboCancel、dodgeCancel、damage、lunge、moveSpeedScale | 六段普攻與蓄力分支可達；取消不能重複啟動同一招；30/60/120Hz邊界結果一致 | `src/combat/moves.ts`、`combo.ts` → MoveDefinition + CombatStateMachine |
| V03 命中可信度 | line/arc/circle形狀、range、width/halfAngle、yMin/yMax、target selection、hitWindow ID | 同一attackInstance × hitWindow × enemy只扣一次；多段招仍可各命中一次；高速槍尖不穿透漏判；範圍/高度負例不得命中 | `src/combat/hitshape.ts`、`stamp.ts`、`src/entities/enemies.ts` → HitResolver |
| V04 動作連貫 | clip mapping、transition duration/offset、IK weight、root-motion policy、playback speed、layer mask | 腳接觸地面期間滑動、手到指定握點誤差、非預期root跳變、T-pose、槍脫手；外觀與判定同一招式時間軸 | `src/view/player-model.ts`；PR #7 `character-skin.ts`/`player-equipment.ts` → Animator + Rig + WeaponSockets |
| V05 打擊回饋與受擊 | hitstop、shake、push Mps、lift Mps、stagger/getup時間、霸體/破防、無雙gain/cost、浮空衰減 | 槍擊/扣血/音效/VFX同步；20人同中不把停頓乘20；可讀的受擊反應；隊長不陷無限浮空；普通兵不成海綿 | `moves.ts`、`enemies.ts`、`game.ts`、`src/fx/`、`src/audio/` → ImpactProfile + ReactionController |
| V06 敵群壓力 | alive population、visible population、engaged cap、attack tokens、engage/release範圍、兵種比例、windup、AI tick tiers | 每秒對玩家的有效攻擊、預警可讀性、被包圍/無法移動時間、螢幕外傷害；遠兵升級近戰時不得漏掉攻擊狀態 | `enemies.ts`；PR #3 difficulty/director → CrowdDirector + EnemyArchetype |
| V07 戰場節奏 | 隊長/小隊位置、壓力階段、KO節點、任務半徑、增援數量/冷卻、可通行寬度 | 空跑時間、決策頻率、遭遇間隔、任務可達性、軟鎖/堵門；畫面人多不代表戰場有目標 | `src/world/layout.ts`；PR #3 `battle-director.ts` → EncounterDefinition；新任務/友軍/真正增援另立功能PR |
| V08 鏡頭與可讀性 | vertical FOV、boom、height、follow damping、collision radius、cutaway hysteresis、shake scale | 貼牆/屋簷/跳躍/無雙時主角與威脅可见；鏡頭不進角色/屋頂；可關震動且不改戰鬥規則 | `camera-rig.ts`、`camera-clearance.ts`；PR #5 → CameraProfile + obstacle solver |
| V09 模型與資產品質 | triangles、material slots、texture dimensions、deform bones、LOD、scale/pivot、collision proxy、透明層 | 實際匯入後成本、關節變形、法線/材質正確、載入時間、角色辨識度；來源、版本、授權可追溯 | `docs/art/`；PR #7 `art-source/`與GLB → AssetManifest + ImportValidation |
| V10 效能與穩定性 | 可見數、AI/animation更新頻率、shadow distance、active VFX、pool limits、渲染縮放 | CPU/GPU工作時間分開、wall frame p50/p95/p99、>50ms幀、draw calls、三角數、配置/GC、記憶體/VRAM、載入峰值 | `game.ts`、`src/render/`、`src/view/` → Profiler markers + Benchmark scene |
| V11 平衡與玩家體驗 | 傷害/血量倍率、token數、windup倍率、資源回復、掉落/獎勵（後續功能） | 普通兵/隊長TTK、無雙充能時間、傷害來源、勝敗原因、人類可理解性；不同玩家/裝置分開報告 | PR #3 `src/core/difficulty.ts` → DifficultyProfile + Playtest report |
| V12 可重現與製作成本 | seed、build/profile/asset版本、生成嘗試上限、API預算、重試上限 | exact head、原始trace/影片、素材accept/reject原因、來源雜湊；工具失敗不得記PASS；付費API預設禁用 | `tests/`、`docs/art/`、CI → EvidenceManifest + Asset provenance |

## 4. 第一版候選值：先保留手感，再測品質

以下是提案而非業界標準；精確機器規格與Unity版本/管線仍待實作前登錄。profile的 `runtimeConnected=false` 不得更名掩蓋為已啟用。

| 項目 | 已讀基準 | 第一版策略/候選 |
|---|---|---|
| 輸入緩衝 | 450ms | 先保留；若要縮短，必須同步重做取消時窗、輸入保存策略與連招回歸，不能直接改成150ms |
| N1第一槍 | duration420ms；active100–160ms；combo cancel200ms；range3.4m、width1.3m、damage14 | 當遷移基線；此判定是設計的line，不是逐三角形槍碰撞。動畫需配合判定時間，不可只換clip |
| N5旋槍 | cancel360ms；hitstop60ms | 用於長取消窗口/多目標停頓驗證，不刪除 |
| 動畫轉場 | 本次未量測 | locomotion/一般接招先試80–120ms；100ms為起始值，不套用所有狀態；受擊、閃避、無雙各自定義 |
| 握槍 / 足部 / root | 本次未量測 | 指定握點誤差p95≤3cm；指定plant窗口每次支撐滑移≤5cm；扣除設計位移後的非預期root跳變≤5cm；均需30/60/120Hz重播與影片 |
| 四難度攻擊者數 | PR #3 初/普/上/修=2/4/5/6 | 先保留候選，沒有把四難度公平性判PASS |
| 高品質敵群試作 | repo宣告300人設計；高品質骨架敵群尚未驗收 | 20→50→100→200→300分級測；這是新資產壓測，不把現有300人玩法砍成20人 |
| 敵人決策更新 | 本次未逐段審查 | 候選近/中/遠20/10/2Hz；僅指決策層，近身命中、攻擊時間軸與碰撞不能降到2Hz；LOD層不是engage範圍 |
| 第一版資產預算 | PR #7報告主角29,202 triangles（未重測） | 暫設主角LOD0≤60k、材質≤4；普通兵LOD0≤8k、材質≤2，貼圖單張≤2K/1K；不是要求把舊主角增面數 |
| 性能目標 | 本次無實測硬體/trace | Windows候選1920×1080、60fps；CPU active與GPU各自p95≤16.67ms；wall frame p99≤25ms；>50ms幀率≤0.1%；最低硬體未定故不可宣稱達標 |
| 付費生成 | 未執行 | externalGenerationEnabled=false、spendLimitUsd=0；先檢查現有資產，不自動呼叫Hyper3D或購買素材 |

### 為什麼不能孤立調一個數字？

**輸入 × 取消 × 動畫。** 現有N5最早360ms可接招；按鍵很早輸入且buffer縮短後可能在取消窗口前過期。Unity Animator的exit time、duration、interruption也會影響外觀，不能把動畫crossfade當作玩法取消規則。選定可執行動作後才測「輸入到狀態開始」延遲；不能把設計中的前搖或等待合法取消窗口統計成引擎故障。

**攻擊範圍 × 擊退 × 敵兵間距。** N1擊退太大，N2可能打不到；範圍放大又可能打穿身後/牆壁。保留技能有意義的空間差異，同時測正例、角度/高度/距離負例與多人分佈。區分hurtbox命中與spear-tip接觸；設計的範圍技不必逐面吻合，但必須有一致可讀的動作或特效。

**停頓 × 目標數 × 時鐘。** 群體命中建議同一simulation tick以最大hitstop聚合，不逐敵累加；多段技能的後續hit window仍可另行觸發。定義game time、animation time、unscaled input time，測試停頓期間輸入保存、恢復後只消耗一次，以及VFX/音效究竟跟隨哪個時鐘。

**敵兵數 × 預警 × 傷害。** PR #3修羅不只damage×1.55，還有windup×0.8與6名攻擊者；合成壓力不能用單一倍率推算。先逐軸A/B，再測組合；調難度時記錄每秒被命中、可反應的預警與失敗原因，不能只看勝率。

**資產品質 × 同屏密度 × 幀時間。** CPU與GPU通常重疊工作，不把兩者時間直接相加當成整幀；必須分辨同步等待與實際工作。不能把一般靜態mesh instancing當成骨架群集問題已解決，也不能靠隱藏窗口/減少真正可見敵人通過高密度測試。

## 5. Unity + Hyper3D + Blender責任界面

**Hyper3D：候選資產製造。** 保存模型版本/tier、prompt/reference雜湊、seed、mesh_mode、輸出格式、目標面數與貼圖設定、task ID、實際花費、拒收原因。官方提供這些生成/輸出控制不代表每個結果已符合遊戲預算。T/A pose conditioning不等於通過骨架、權重或連段驗收。

**Blender：可交付的資產來源。** 核對趙雲來源版本；處理拓樸、UV、骨架、權重、比例/pivot、LOD、握點、动画與匯出。這是分工提案，不是宣稱本次已操作Blender。保留source與export雜湊；兵器握點和tip/tipBase的世界座標語義不得隨意改。材質匯出後要在目標引擎比較，不能以Blender預覽替代Unity結果。

**Unity：玩法、渲染與量測。** MoveDefinition / PlayerTuning / DifficultyProfile / CrowdProfile / CameraProfile / AssetBudget / BenchmarkProfile可設計成ScriptableObject；這些型別尚未建立。血量、buffer、攻擊stamp等每個角色的可變狀態放在runtime instance，不共享寫回設定資產。JSON是可攜設計資料，必須有adapter、單位轉換、版本驗證和讀回effective profile的測試後，才能稱為已接入。

**位移權威只能有一個。** 起步建議以現有玩法位移/招式曲線為基線，動畫跟隨；將來採root motion時，逐招明確指定由controller或animation提供位移。不可同時累加兩套位移，不可只靠更長crossfade遮住瞬移。

**引擎移轉另立決策紀錄。** 先鎖Unity版本、渲染管線、目標平台、目前網頁/itch.io交付的保留方式和回滾點。Windows試作不是默默取消Web版；本文件不授權刪除TypeScript或重新開始整個遊戲。

## 6. 驗收情境與證據

以下全部為待執行，沒有任何一項因本文件存在而通過。腳本/引擎測試、真實渲染、自然遊玩與人類聽感分開記錄。MCP是操作途徑，不是驗收標準；能以引擎MCP或測試runner得到相同證據就不限定桌面點擊。無畫面測試不能替代外觀與感官驗收。

| ID | 情境 | 必要證據/判定 |
|---|---|---|
| S01 | 跑→急停→轉身→N1–N6；另走C1–C6、空中、閃避、格擋反擊、無雙 | raw input與state/move/hit trace；30/60/120Hz重播；完整錄影；無錯招、T-pose、槍脫手 |
| S02 | 同一招打1/5/20人；N4/C5等多段招；距離/高度/角度負例 | attackInstance/hitWindow/enemy三元組；每window每enemy最多1筆傷害；合法多段沒有被錯誤去重；同tick停頓不乘人數 |
| S03 | 骨架、持槍與位移連貫 | 每幀root/手/foot contact/握點world transform、已設計位移、對齊影片；滑步與握點誤差依第4節；明確標記plant與換握窗口 |
| S04 | 普通兵受擊、擊飛、落地、起身；隊長霸體/破防 | state trace、影片；不穿地、不永久卡浮空/倒地；重置/死亡清除attack token及pending hit |
| S05 | 20/50/100/200/300人 + 衝刺進出決策LOD + 無雙特效峰值 | 每階至少3個固定seed、各暖機30s後180s；可見/存活/engaged/attackers四數分開；性能原始序列；30分鐘另測記憶體穩定性 |
| S06 | 牆角、營房屋簷、跳躍、無雙鏡頭；關閉震動 | 真實viewport與UI scale；800×600及1440×900回歸；1080p候選另測；主角/威脅可辨識、屋頂進出可恢復 |
| S07 | 資產缺失/解碼失敗/骨架錯誤/材質缺失/重新載入 | asset hash/import log、錯誤事件與錄影；回退可見且可玩；不得在新角色ready前把舊模型隱藏 |
| S08 | 四難度、三種出陣入口、重試、失焦/暫停、自然勝敗 | exact difficulty/effective profile；自然輸入和DEV注入分開；實體手把與實際聽感由人驗收；不能以模型評分代替 |

### 計算口徑

- profile中的frame work p95是CPU active與GPU各自的分位數；wall frame p99是呈現/幀間隔序列，另記VSync、幀率上限、refresh rate與測量工具，不把不同口徑混合。
- 影像同步先以60fps影片±1 frame作可視檢查（16.67ms）；更精確的命中時序用引擎trace。60fps影片不能證明1ms精度或完整input-to-photon延遲。
- 握點誤差僅在該隻手應握住該socket的標記窗口計算；換手/鬆手不混入。腳滑以plant開始位置為基準量切平面位移；排除設計中的滑步、擊退、空中姿態。
- 延遲指標必須寫清楚開始/結束事件。合成輸入→state開始不是實體按鍵→螢幕發光；後者需要對應外部量測，未知保留null。
- CI/數值回歸PASS、渲染PASS、playtest PASS、human approval是不同欄位；INCOMPLETE/TOOL_FAILURE不能轉成PASS。保留失敗樣本，不降低門檻來追求全綠。

每輪報告至少保存：commit SHA、PR/base/head、profile hash、asset hashes、seed、場景/難度、硬體CPU/GPU/RAM、OS/驅動、引擎/瀏覽器版本、viewport/render scale、VSync、時間範圍、輸入方法、原始trace/影片位置、結果、缺口。缺少硬體或渲染情境時不得宣稱1080p60達標。

## 7. 實施次序

1. 本PR只放變量規格、候選JSON和AGENTS入口，不修改runtime、不合併其他PR、不發布。
2. 先完成既有PR的exact-head驗收/審查/合併；本規格不得成為繞過P0門檻的理由。每一P的實作仍循PR→完整測試/實際證據→review→merge，完成後再進下一P。
3. 後續單獨建立基準/telemetry PR，保持既有數值不變；輸出effective profile和S01/S02基線。不得將檔案存在宣稱為參數已接入。
4. 完成趙雲動作/資產連貫S03、受擊S04、鏡頭S06與回退S07後，才大量製造新兵種或場景。更新既有 `docs/art/` manifest與Visual QA，不另起互相矛盾的美術標準。
5. 高品質敵群按S05分級擴張；每次只調一組變量，保留對照組，再測交互作用。任務/友軍/真正增援另開PR，不把壓力橫幅稱為增援實作。
6. Unity遷移要先有批准的架構決策與隔離試作。最終須交付可執行版本與自然遊玩證據，不是只交C#或Animator截图。

## 8. 來源與適用範圍

Repo數值來自以下固定版本；PR描述中的驗證屬既有作者報告，不是本次重測。

- [main/player.ts](https://github.com/monkey1sai/changshan-longdan/blob/a42c9294c32ac8ff566bc019dc5465b9dc7ad1d9/src/entities/player.ts)
- [main/moves.ts](https://github.com/monkey1sai/changshan-longdan/blob/a42c9294c32ac8ff566bc019dc5465b9dc7ad1d9/src/combat/moves.ts)
- [main/enemies.ts](https://github.com/monkey1sai/changshan-longdan/blob/a42c9294c32ac8ff566bc019dc5465b9dc7ad1d9/src/entities/enemies.ts)
- [main/camera-rig.ts](https://github.com/monkey1sai/changshan-longdan/blob/a42c9294c32ac8ff566bc019dc5465b9dc7ad1d9/src/view/camera-rig.ts)
- [PR3/difficulty.ts](https://github.com/monkey1sai/changshan-longdan/blob/1583ff1c286a7940223e7ee48ec1209c1e699bbc/src/core/difficulty.ts)；[PR3](https://github.com/monkey1sai/changshan-longdan/pull/3)；[PR7](https://github.com/monkey1sai/changshan-longdan/pull/7)

官方文件僅支持工具功能/時序語義，不支持本文自訂性能或品質數字；查核日2026-10-02。

- [Unity Animator transitions](https://docs.unity3d.com/cn/current/Manual/class-Transition.html)：duration、exit time與interruption是不同控制。
- [Unity ScriptableObject](https://docs.unity3d.com/6000.0/Documentation/Manual/class-ScriptableObject.html)：共享設計資料；本專案對應型別尚待建立。
- [Unity Profiler Highlights](https://docs.unity3d.com/cn/6000.0/Manual/ProfilerHighlights.html)：CPU/GPU各自工作預算與同步等待。
- [Unity FrameTiming](https://docs.unity3d.com/cn/6000.0/ScriptReference/FrameTiming.html)：各幀時序量測欄位與限制。
- [Hyper3D Rodin Gen-2.5](https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5)：生成設定、格式、seed與pose conditioning；不得把官方輸出上限當遊戲資產預算。
