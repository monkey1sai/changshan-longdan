# E06 動畫連貫與雙手持槍

更新：2026-10-06（Asia/Taipei）。`stepStatus: IN_PROGRESS（本機實作；未推送）`。本檔記錄範圍、設計與驗證方法；各候選 SHA 的實際執行結果記在 PR，不寫回本檔以免自我引用。

## 範圍與授權

使用者原文：「手感可接受，授權合併 PR #27，合併後確認並開始 E06」，接著「方向 1，照建議的設計開始 E06 實作，不推送。」，發現 Web 基準本身踩地滑移不合格後：「方向 1，加踩地鎖定層，與 Web 對照改比鎖定前骨架，繼續 E06，不推送。」

核准的設計：Web 版沒有動畫 clip，姿勢由程序式 rig（`PlayerModel` 的姿勢表、混合、兩骨 IK、握槍、披風）驅動，再由 `ZhaoYunSkin` 把 GLB 骨架對到 rig。E06 把這一整套移植成純 C#，Unity 顯示既有匯入的趙雲模型；以未修改的 Web 原始碼在 Node 產生逐幀對照資料；量測計畫的三項門檻；影片由建置後的 Player 逐幀截圖加本機 ffmpeg 產生。不修改 `src/`、`public/models/`、`.blend`，沒有新增套件，沒有付費或生成。

變量 V01／V02／V04／V09；情境 S01／S03。動畫／技術美術審查者待指定。

## 範圍審查發現：Web 基準的腳會滑

照計畫量測 Web rig 本身（60 Hz）：握點誤差 p95 右手 0、左手 0（最大 1.0 cm）；root 跳變 0（root 等於邏輯位置）；**踩地滑移最大 0.50 m，不合格**。滑移來自原地轉向（目標腳位隨身體轉動繞圈）、跑步起步與急停、回到站姿、舉盾，以及前翻 flip = 2π 時 Web 只在 |flip| < 0.05 才解腿 IK、改用正向運動學擺腳。若只做逐幀移植，Unity 會原樣重現這些滑步。

## 設計

- **純 C# 組件 `Changshan.Animation`**（`noEngineReferences`，參照 `Changshan.Combat`）：
  - `ThreeMath`：照 three.js 0.186 語意移植 `Vector3`、`Quaternion`（Euler XYZ／YXZ、`setFromUnitVectors`、`slerp`、`setFromRotationMatrix`）與 `Matrix4`（`compose`／`decompose`，含負縮放、`invert`、`makeBasis`）。
  - `RigNode`：Object3D 子集；世界矩陣每次查詢都由父鏈重算，等同 three.js 每次呼叫 `updateWorldMatrix`。
  - `PlayerPoses`：13 欄姿勢、站姿／跑步／空中／受擊／倒地／翻滾／格擋常數、每招姿勢表與無雙姿勢，照 `playerPoses.ts`。
  - `ProceduralRig`：`PlayerModel` 的驅動骨架（髖、軀幹、頭、腿、槍、雙手、肩、披風 4 節）、交叉淡化、跑步混合、面向平滑、兩骨 IK、`FitWeaponGrip`、披風彈簧；提供 tip／tipBase 給之後的刀光。
  - `SkinBinding`：`ZhaoYunSkin` 的骨架對應（骨盆、脊椎、頭不帶平移、四肢依長度縮放、手以 `SourceShaft` 修正且左手依支撐權重 slerp、腳用髖旋轉、披風兩節）。缺骨、骨長退化、缺身體或缺槍丟出明確錯誤碼（`SKIN_BONE_MISSING`、`SKIN_BONE_LENGTH_INVALID`、`SKIN_BODY_MISSING`、`SKIN_WEAPON_MISSING`）。
- **踩地鎖定（`FootPlant`，與 Web 刻意不同）**：只在地面的移動／格擋狀態啟用。落地的腳鎖在世界座標；Web 目標腳位水平偏離超過 0.12 m 或腿伸不到時，以 0.12 s 抬腳 7 cm 跨到新位置再鎖；Web 已經抬腳（跑步循環）時以 0.05 s 追上。其他狀態（攻擊、閃避、受擊：設計位移）交回 Web rig，0.1 s 內混回。前翻 flip = 2π 視為同一朝向、算在地面。最後以 `ProceduralRig.PlaceFeet` 重新解腿 IK。
- **唯一位移權威**：root 只跟隨邏輯位置（E04／E05 的 `Player`）；動畫不產生 root motion，也不回寫邏輯。
- **Unity 整合（`CharacterAnimation`）**：綁定時把匯入模型的 Transform 樹轉成 `RigNode` 樹（反鏡像回 Web 座標）；每個模擬步依序 `Rig.Update` → `FootPlant.Apply` → `Skin.Update`，再把骨骼與槍鏡像回 Unity（位置 (-x, y, z)、旋轉 (x, -y, -z, w)）。動畫時鐘用 E05 `GameClock` 的 `LastSimDt`／`SimTime`，所以 hit-stop 時姿勢停住。換模型會先拆掉舊的場景與槍；`SkinnedMeshRenderer.updateWhenOffscreen` 打開以免動作超出原始包圍盒被剔除。綁定失敗記錄 `CHARACTER_ANIMATION_BIND_FAILED` 並保留回退，不會每幀重試。沒有模型時 rig 照常運算。

## 對照資料

`scripts/lib/rig-parity.ts` 以 Web `Player`、`PlayerModel`、`ZhaoYunSkin` 與去除貼圖的趙雲 GLB 逐幀執行，輸出 `unity/ChangshanLongdan/TestData/combat/web-rig.json`（約 4 MB，`.gitattributes` 標為 generated）。12 個情境照計畫路線：跑→急停→180° 轉向、N1–N6、C1／C2、C3、C4、C5、C6、跳躍／JA／JC／落地、閃避／DASH、格擋反擊、受擊／倒地、無雙；30／60／120 Hz。每幀記錄控制、狀態、姿勢、視覺欄位（面向、淡化、跑步混合、雙手握點誤差）、槍尖，60 Hz 記錄 13 個節點、其他頻率 6 個關鍵節點，60 Hz 每 4 幀記錄全部骨骼。數值捨入到 1e-6。Unity 比對的是**鎖定前**的 Web rig 與骨架；鎖定層只在量測與顯示時加上。

## 驗證方法

| 檢查 | 內容 |
|---|---|
| Vitest `rig-parity.test.ts`（3） | fixture 與重新產生逐位元組相同、12 情境 × 3 頻率齊全、60 Hz 下 17 招全部出現 |
| Edit Mode `RigParityEditTests`（12） | 來源雜湊、情境集合、30／60／120 Hz 逐幀比對（控制、狀態、姿勢、視覺欄位、槍尖、節點、骨骼，容許 2e-6，四元數對齊正負號）、17 招全部擺出姿勢、雙手握點 p95 ≤ 3 cm、root 只跟邏輯位置、踩地滑移 ≤ 5 cm（並確認 Web 基準在 run_stop_turn 仍 > 0.3 m 且鎖定後小於其 1/10）、跨步與釋放行為、缺骨與骨長退化負例、鏡像往返 |
| Play Mode `AnimatedCharacterPlayTests`（2） | 場景趙雲由 rig 驅動：轉向、跑、攻擊 140 幀，Unity 骨骼與 rig 位置差 < 1 mm、右手到槍握點 < 3 cm、有跨步；沒有模型時 rig 照常運算 |
| 影片 | `npm run record:route -- --player <ChangshanLongdan.exe> --out release/e02/<名稱>`：Player 以 `-e06Route` 照路線（23.5 s，30 Hz 固定步長）逐幀截圖，本機 ffmpeg 編成 mp4、每 2 秒一格的縮圖表與含 SHA-256 的 manifest；截圖編碼後刪除。沒有 `-e06Route` 時錄製元件不啟動 |

### 量測定義

- **握點誤差**：右手骨到槍握點的距離；左手只在支撐權重 > 0 時量（鬆手招式排除）。門檻 p95 ≤ 3 cm。
- **踩地滑移**：在地面的移動／格擋狀態，同一隻腳連續著地期間最終腳位的最大水平位移。門檻 ≤ 5 cm。空中、倒地、翻滾與攻擊位移排除。
- **root 跳變**：每幀 root 位移減去邏輯位置位移。門檻 ≤ 5 cm（實作上恆為 0）。
- **設計偏差**（只作診斷，不是門檻）：鎖定後腳位與 Web 目標腳位的距離。轉向與閃避時短暫達約 0.4 m，代表鎖腳後與 Web 姿勢的差距，需要視覺審查判斷。

### 輔助證據（不算 Unity 驗收）

同一份 C# 在 .NET 8 上重播：36 組（情境 × 頻率）全部與 Web 一致，最大偏差 5e-7（捨入）。加上踩地鎖定後：滑移最大 0.008 m（Web 基準 0.50 m）、右手 p95 0、左手 p95 ≤ 0.72 cm、root 0。跨步行為：run_stop_turn 跨 16 步、結束時雙腳鎖定；接著攻擊，腳交回 Web 且位置一致。

## 已知限制

- Web 沒有動畫 clip；計畫中的「clip 對應、轉場」在本專案對應為姿勢表與交叉淡化，沒有另外建立 Animator。
- 踩地鎖定是 Web 沒有的行為，轉向與閃避時腳位與 Web 姿勢短暫差約 0.4 m；需要動畫／技術美術審查以慢放確認，數值通過不等於視覺通過。
- 影片只錄單一路線、固定 30 Hz；沒有慢放剪輯與逐關節標註。
- 披風、刀光、受擊反應的視覺屬 E07 以後；龍頭特效尚未移植。
- 動畫／技術美術審查者尚未指定。

## 回滾

普通 revert 本步提交即可：移除 `Changshan.Animation`、`CharacterAnimation`、`RouteRecorder`、fixture 與測試，控制器回到 E05 的靜止姿勢；Web 版、`src/`、`public/models/` 與 `.blend` 未變更。
