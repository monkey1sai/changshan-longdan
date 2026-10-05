# E04 輸入、完整招式與設定對應

更新：2026-10-05（Asia/Taipei）。`stepStatus: IN_PROGRESS`（本機實作；未推送、未建立 PR、未審查）。本檔記錄範圍、設計與驗證方法；各候選 SHA 的實際執行結果綁定該 SHA 另行記錄，不寫回本檔以免自我引用。

## 範圍與授權

使用者原文：「授權合併 PR #20，合併後確認並開始 E04」，接著「方向 1，照建議的設計開始 E04 實作，不推送。」

核准的設計：純 C# 邏輯（不引用 UnityEngine、double 精度、數值與 Web 相同）；邏輯保留 Web 世界座標，只在顯示層把 X 取負，與 glTFast 一致；以 Node 腳本從未修改的 Web 原始碼產生只含玩家的對照軌跡，存成 repo 內的 fixture，並以測試檢查 fixture 與來源同步，Unity 測試重播比對；鍵盤與滑鼠走既有 Legacy Input Manager（不新增套件），手把延後；只在本機進行。

範圍內：PlayerTuning、MoveDefinition、每個角色獨立的執行期狀態；移植 N1–N6、C1–C6、JA、JC、DASH、COUNTER、MUSOU 共 17 招，保留 450 ms buffer 及既有 cancel、duration、位移，不重新平衡；Unity 角色控制器。不含命中去重與遊戲時鐘（E05）、動畫與持槍（E06）、鏡頭（E07 以後）、敵兵。不修改 `src/`、`public/models/`、`.blend`，沒有新增套件，沒有付費或生成。

變量 V01／V02／V11／V12；情境 S01（招式路線與時序）與 S08 的輸入／暫停子情境。戰鬥／輸入審查者待指定。

## 設計

- **單一真實來源**：`scripts/lib/combat-parity.ts` 直接 import Web 的 `Player`、`Input`、`Arena`、`MOVES` 與 layout，用合成事件逐幀驅動，依 `Game.simulate` 的順序（hit-stop 期間只 `queue`，否則 `update`，最後 arena 約束）輸出 `unity/ChangshanLongdan/TestData/combat/web-parity.json`。fixture 內含 Web 來源 9 個檔案的 SHA-256；Vitest 每次重新產生並要求逐位元組相同，Unity Edit Mode 也重算雜湊，Web 一改 fixture 就會失效。產生：`npm run parity:write`；檢查：`npm run parity:check`。
- **fixture 內容**：22 個玩家情境 × 30／60／120 Hz（每幀的控制、操作、21 個狀態欄位、事件、啟動中的命中窗口），6 個輸入情境 × 3 種頻率（鍵盤事件、`poll` 結果、兩種鏡頭 yaw 的合成移動），17 招完整資料、場地邊界與 26 個障礙物。原始 JSON 1,835,074 bytes，gzip 後約 193 KB；標記為 `linguist-generated -diff`。
- **`Changshan.Combat`**（`noEngineReferences: true`）：`CombatMath`（含與 V8 相同的 `Math.hypot` 演算法，正規化結果逐位元相同）、`HitShape`、`MoveDefinition`／`HitWindow`／`Lunge`（建構時複製陣列，對外唯讀）、`Moves`、`Combo`、`Arena`／`ArenaLayout`、`PlayerTuning`、`Player`、`PlayerDriver`、`InputMapper`、`ControlComposer`。敘述順序照 Web，方便逐幀比對。
- **PlayerTuning**：預設值就是 Web 常數。必須宣告 `schemaVersion = 1` 與單位 `meters,seconds,radians`，否則以 `TUNING_SCHEMA_VERSION`／`TUNING_UNITS` 拒絕；非有限值為 `TUNING_NOT_FINITE`，非正值、防禦半角 ≥ π、DASH 取消時間不早於閃避結束為 `TUNING_OUT_OF_RANGE`。沒有 JSON adapter，`musou-profile.proposed.json` 仍未接入 runtime。
- **狀態隔離**：每個 `Player` 擁有自己的血量、buffer、hit stamp 來源；沒有任何 static 可變狀態。Web 的 `nextStamp` 是全域計數器，這裡改為每個模擬一個 `HitStampSource`，需要共用時明確傳入；stamp 的生命週期與去重屬 E05。
- **座標**：邏輯保留 Web 數值（右手系、公尺、facing 0 為 +Z）。`LogicDisplayMapping` 把 X 取負，再以場景錨點的位置與 yaw 放置起點，所以 E03 驗證場景的姿勢（(0, −1, 4.2)、yaw 160°）不變；角色的左右不會被鏡射。鏡頭方向反向換算成邏輯 yaw 後套用 Web 的 `forward = (sin, cos)`、`right = (−cos, sin)`。
- **控制器**：`ZhaoYunController` 放在趙雲 prefab 根節點：Legacy 輸入 → `InputMapper` → 鏡頭相對控制 → `PlayerDriver` → 把邏輯位置顯示到 transform。邏輯位置是唯一位移權威；專案未啟用動畫模組，不會有 root motion。每幀 dt 上限 0.05 s（同 Web）。滑鼠按鍵依 Web 編號對應（Unity 右鍵 1 → Web 2），滾輪方向取反。
- **失焦**：與 Web blur 相同，清掉按住的鍵與尚未執行的單次輸入並停止模擬。Web 失焦後停在暫停選單；Unity 尚無暫停選單，焦點回來即恢復。
- **既有 prefab**：`CharacterSetup` 原本只建立缺少的 prefab；E04 加上「已存在但缺控制器時補上一次」，已有控制器則不動。

## 與 Web 的已知差異

| 項目 | Web | Unity E04 |
|---|---|---|
| 手把 | `navigator.getGamepads` | 延後，未實作 |
| 焦點在表單元件、標題畫面快捷鍵 | DOM 專屬 | 不適用 |
| 失焦後 | 進入暫停選單 | 焦點回來即恢復 |
| OS 按鍵重複 | `repeat` keydown 會重新標記按住 | Legacy Input 不產生重複事件；失焦後仍按著的鍵要重新按下 |
| 自動瞄準 `aim` | 依敵兵位置 | 沒有敵兵，固定不瞄準 |
| slowmo、debug 時間倍率 | 勝敗演出 | 不在範圍（E05 時鐘） |
| 鏡頭 | 跟隨鏡頭 | 驗證場景固定鏡頭，角色可能走出畫面 |

## 驗證方法

| 檢查 | 內容 |
|---|---|
| Vitest | 新增 `combat-parity.test.ts`：fixture 與重新產生的結果逐位元組相同、17 招都被情境打出、三種頻率都有 |
| Node runner | 測試清單依類別計數（Edit 新增 21 項、Play 新增 5 項） |
| Edit Mode `CombatParityEditTests`（10） | 來源雜湊、場地、17 招逐欄位、玩家軌跡 30／60／120 Hz、輸入軌跡、每個頻率都打出 17 招、跨頻率路線相同且時間差在宣告範圍內、buffer 改 0.40 s 必被抓到 |
| Edit Mode `CombatRuleEditTests`（8） | 預設值等於 Web 常數、版本／單位／非有限／超出範圍負例、兩個玩家不共用血量／buffer／stamp、招式資料建構後不可改、stamp 溢位跳過 0 |
| Edit Mode `LogicDisplayMappingEditTests`（3） | 起點對到場景錨點、面向與左右在鏡射後不變、鏡頭相對輸入在畫面上的方向 |
| Play Mode `ZhaoYunControllerPlayTests`（5） | 場景角色保持 E03 姿勢並帶有控制器、W／D 依鏡頭方向移動、J 出 N1 後 K 接 C2 且 transform 每幀等於邏輯位置、失焦清空按住與待執行輸入並停止模擬、重試還原 |

比對容許誤差在比對前宣告：離散值（狀態、招式、事件、命中窗口、計數）必須完全相同；連續值容許 1e-6（sin、cos、exp、atan2 在不同執行環境可能差最後一位）。跨頻率不要求幀序號相同：第 k 次出招的時間差上限為 2(k+1)/30 s，因為每一環最多因按鍵所在幀與等待的門檻（cancel、跳躍高度、計時器）各晚一個 30 Hz 幀。

輔助證據（不算 Unity 驗收）：同一份 C# 原始碼與對照程式在 .NET 8 上重播，玩家 9,282 幀與輸入 1,302 幀全部一致，最大數值偏差 1.3e-15；buffer 改 0.40 s 時出現 227 處不一致。離線編譯以 Unity 內附編譯器與上次 Unity 實際使用的參考組件編譯 7 個組件，`Changshan.Combat` 在不提供任何 UnityEngine 參考的情況下通過。

## 已知限制

- 沒有動畫：角色以靜止姿勢滑行與升降，招式只能從位置、朝向與事件觀察；動畫屬 E06。
- 實際手感、輸入延遲與畫面需要人在可見視窗操作確認；自動測試只證明邏輯與 Web 一致。
- 命中判定（`ActiveHits`）已移植並比對窗口，但沒有敵兵可打；去重與 hit-stop 來源屬 E05。
- 跨頻率的時序差異是 Web 本身的取樣行為，E04 照搬，不修正。

## 回滾

普通 revert 本步提交即可：移除 `Assets/Combat/`、控制器、測試、fixture 與產生器，並還原 prefab 與 runner 清單；Web 版、`src/`、`public/models/` 與 `.blend` 未變更，E03 資產保留。
