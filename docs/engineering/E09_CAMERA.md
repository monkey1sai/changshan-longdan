# E09 鏡頭、遮擋與操作可讀性

更新：2026-10-07（Asia/Taipei）。`stepStatus: DONE（限定接受；無 formal independent APPROVED）`；PR #39 合併為 `bcbf5df1b8f4ec47499bf6131ecbf6a2ded65db3`。本檔記錄範圍、設計與驗證方法；各候選 SHA 的實際執行結果記在 PR #39，不寫回本檔以免自我引用。

## 範圍與授權

使用者原文：「推送結案 PR、合併後開始 E09」（E08 結案 PR #38 合併為 `ce501c6`），接著對範圍審查的三個方向決定：A1、B1、C1。

- **A1 場景幾何**：Unity 驗證場景沒有城池。本步以共用佈局（`src/world/layout.ts`：主堡、階梯、六棟營房與屋簷、火盆、殘骸、城牆）在場景生成素色佔位方塊與可隱藏的屋頂板，讓避障、剖視與路線錄影可驗證；美術資產到 E10 替換，屆時重跑鏡頭路線。
- **B1 模式流程**：移植 `game.ts` 的 title／playing／paused／ended 模式機與 Enter／J／Esc／P／R 映射、失焦暫停、單一出陣流程（標題含四難度選擇、暫停、戰果）；畫面以 IMGUI 呈現，美術化 UI 不在本步。勝負判定（`checkOutcome`）在 E07／E08 未移植，本步補上最小的勝負與戰果（KO、時間、受傷、評等）以支撐 ended 流程；慢動作與連擊仍不在範圍。
- **C1 震動開關**：計畫要求「可關閉震動」，Web 沒有此設定；Unity 在暫停畫面提供切換並以 PlayerPrefs 保存，關閉時 trauma 與 kick 不生效。記為 Unity 超出 Web 的行為，不修改 `src/`。
- 參考距離 9.2 m 是水平 boom 參數（Web `distance`），不是 3D 直線距離。無雙龍未移植，無雙時的鏡頭拉高環繞照 Web 移植但畫面沒有龍。不修改 `src/`、`public/models/`、`.blend`，沒有新增套件，沒有付費或生成。

變量 V01／V08／V11；情境 S06 與 S08 的選單／重試子情境。鏡頭／UX 審查者待指定。

## 設計

- **`Changshan.View`（純 C#，無 Unity 參照）**：`CastleGeometry`（`layout.ts` 的矩形、屋簷常數、城牆尺寸；`ArenaLayout` 的碰撞矩形不變）；`CameraClearance`（`camera-clearance.ts` 的 16 點取樣與屋簷推出）；`RoofCutaway`（進入 0.6 m／退出 1.0 m 的緩衝）；`CameraRig`（`camera-rig.ts` 逐行移植：yaw／距離／focus 的 damp、無雙拉高環繞、標題環繞、避障、lookAt、震動與 kick、fov；輸出位置、四元數、up 與 fov）；`GameModes`（`game.ts` 的模式轉換：標題 Enter／J 出陣、Esc／P 暫停、暫停中 Esc／P／Enter 恢復、戰果顯示後 Enter 重試、失焦暫停）。`ControlComposer` 既有，對應 `toPlayerControls`。
- **Unity**：`CameraRigView` 每幀以 rig 的輸出設定相機（鏡頭由 rig 作為唯一基準，E07 的 `CameraShake` 改為轉接到 rig 的 trauma／kick，不再自行疊加）；`CastlePlaceholders` 於執行期生成佔位方塊與六片屋頂板；`GameFlow` 驅動模式機、IMGUI 畫面（標題與難度、暫停與震動開關、戰果）、戰鬥開始的 `snap`、失焦暫停；控制器只在 playing 模式接受戰鬥輸入，camTurn 只在 playing 生效（照 Web）。
- **錄影**：`record:route --mode e09` 以 `-e09Camera` 跑鏡頭路線（南牆、東牆、營房側邊與角落、穿過營房屋簷、跳躍落地、無雙、震動關閉），分別在 800×600、1440×900、1920×1080 錄製；每幀記錄實際 viewport、render scale、鏡頭位置、避障比例、各屋頂可見性與 focus 投影；腳本核對鏡頭從未進入阻擋矩形或場地外、focus 投影在畫面內、屋簷下屋頂隱藏且離開後恢復、震動關閉段鏡頭無抖動。

## 對照資料

`scripts/lib/camera-parity.ts` 以未修改的 Web `CameraRig`、`cameraClearance`／`clearCameraOverhang`、`updateRoofCutaway` 與 `toPlayerControls` 產生 `unity/ChangshanLongdan/TestData/combat/web-camera.json`：鏡頭情境（開闊轉向縮放回正震動、南牆、東牆、營房屋簷、營房側邊、角落 yaw 掃描、穿過營房、無雙環繞、標題環繞到出陣、跳躍 focus）× 30／60／120 Hz，每幀記 yaw、距離、focus、forward／right、相機位置、四元數、up、fov 與內部 damp 狀態；另記避障取樣、屋簷推出取樣、剖視序列與控制轉換樣本。

## 驗證方法

| 檢查 | 內容 |
|---|---|
| Vitest `camera-parity.test.ts` | fixture 逐位元組相同；每個情境在三種頻率齊全；避障情境確實收短、屋簷情境相機在外側、剖視序列進出緩衝 |
| Edit Mode `CameraParityEditTests` | 來源雜湊、逐幀對照（離散值相同，連續值 1e-6；四元數以點積比對）、避障／推出／剖視／控制樣本；模式機正負例（標題 J 出陣、戰鬥中 J 不觸發模式、暫停中 Enter 恢復、失焦只在 playing 暫停、戰果未顯示時 Enter 無效）；震動關閉時 trauma 無位移；Web 的 `camera-rig.test.ts` 六組情境以 C# 重述 |
| Play Mode `CameraPlayTests` | 場景：佔位城池存在且屋頂六片；鏡頭跟隨角色並在營房旁收短、不進入方塊；走到屋簷下屋頂隱藏、離開恢復；標題→出陣→暫停→恢復→戰果→重試的流程；震動開關保存並生效；失焦暫停 |
| 錄影 | 三種解析度的鏡頭路線影片與逐幀 trace（人工觀看才算視覺證據） |

## 驗證輪次與審查處置

Unity 失敗輪次（候選與原因，皆保留證據）：`baefe62` `Rect` 與 `UnityEngine.Rect` 同名；`2286795` 佔位方塊用了 Physics 模組的 `Collider`、錄影器參照 URP 命名空間（改以內建網格建方塊、經 `Foundation` 讀 render scale）；`5f4c98e` 兩個 Play 斷言錯（標題環繞以顯示空間量距、重擊無敵未等完）。錄影檢查修正：要求的狀態寫成 `Hurt`（重擊是 `Down`）；出陣後的標題 swoop（Web 的 title 混合以 2.2/s 衰減，約 3 s）被場地檢查誤判，改為前 4 s 豁免並記錄；錄影把「震動關閉」寫進 PlayerPrefs 使後續 Player 以關閉啟動（改為只改本次設定並在開始時強制開啟，已清除本機殘留值）。

獨立 advisory 審查 1 輪（Claude code-reviewer 子代理，唯讀，候選 `2219f97`；不是 formal APPROVED）：無 blocker。已處置：HIGH R 回正未接線（接上並補 Play 正例）；HIGH 錄影路線在該版本無法通過（三項：swoop 豁免、營房段因 `Snap` 固定用起始朝向而碰巧走對方向——`Snap` 改用角色朝向並把營房段改為 S／W、第二次重擊移到無敵之後）；MEDIUM 暫停時表現層與程序動畫仍以上一步的 simDt 積分（改傳 0，補斷言）；MEDIUM 錄影的 `clearance` 量測無意義（改記 boom 收短量與「鏡頭在阻擋內」旗標）；MEDIUM runner 的 Player 截圖變成標題畫面（Player 階段加 `-e09NoFlow`，截圖維持驗證姿勢；標題由錄影覆蓋）；MEDIUM PlayerPrefs 污染（如上）；LOW 失焦旗標、開發鍵繞過模式機、IMGUI 每幀配置、測試強度（加右側投影與阻擋集合斷言）、地面縮放疊乘與材質釋放、`StartBattle` 多餘的清輸入。延後：fixture 直接記錄事件以免兩處重述、`Snap` 後一幀才套用、音效 pan 改用 `Rig.Right`、`CastleGeometry` 與 `ArenaLayout` 重複矩形、IMGUI 字型在 Player 的 CJK 顯示未驗證。

## 合併與合併後確認

使用者試玩候選 `298ae30` 的 Player（標題→出陣、轉鏡／縮放／回正、暫停與震動開關、戰果）後原文：「試玩後非常棒, 可接受PR39」，視為限定接受與合併授權。合併前即時核對：head `4f976eafa50b2740f16aa7e07d33fa94e1151995` 與本機相同，兩項 CI 綁定 head 成功，review comments 0，auto-merge 關閉，草稿先標記 ready 再以一般合併提交。**GitHub 上沒有任何 review approval**，依使用者授權合併，屬限定接受；advisory 子代理審查 1 輪不是 formal APPROVED；鏡頭／UX 審查者未指定。

- merge commit `bcbf5df1b8f4ec47499bf6131ecbf6a2ded65db3`（2026-10-07 13:08 +08:00，一般合併，父提交 `ce501c6`、`4f976ea`）；tree 與 head 相同；來源分支保留。
- 合併後確認（merge SHA，全新 clone）：本機 Unity 五階段通過（runId `d2f6e5d2-2ee9-47ee-910d-b6b3176f2e54`，2026-10-07 13:08–13:14 +08:00；compile、Edit 146/146、Play 39/39、Windows build、Player）；Web Vitest 33 files／296 tests、typecheck、build、`parity:check` 七份一致、runner 65/65；main 的 Game CI（run 37574865181）success。
- E09 以限定接受標 DONE：V01／V08／V11 與 S06／S08 子情境在佔位城池上的程式、對照與錄影證據齊備；真實建築的視覺可讀性、鏡頭／UX 正式審查、手把與多裝置仍待後續。

## 已知限制

- 場景是佔位方塊，沒有真實建築、城門與材質；視覺可讀性（主角與威脅可辨識）要到 E10 才有意義的畫面。
- 無雙龍未移植，無雙鏡頭拉高環繞時畫面沒有龍；慢動作、連擊與小地圖不在範圍。
- IMGUI 畫面只有文字與按鈕；語言切換未移植（固定繁中加英文標註）。
- runner 的 Player 階段以 `-e09NoFlow` 啟動，截圖仍是 E03 驗證姿勢；從輸出包直接啟動則進標題畫面（錄影與試玩走這條）。出陣後鏡頭從標題環繞 swoop 進場約 3 s，是 Web 原行為。

## 回滾

普通 revert 本步提交即可：移除 `Changshan.View`、`CameraRigView`、`CastlePlaceholders`、`GameFlow`、fixture 與測試；相機回到 E02 的固定視角；Web 版、`src/`、`public/models/` 與 `.blend` 未變更。
