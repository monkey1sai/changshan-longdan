# E00 前置 P0 整合：使用者人工審查交接

2026-10-02，Asia/Taipei。狀態：**AWAITING_USER_REVIEW；本機候選與部分驗證已完成，P0／E00 尚未 DONE，E01 尚未開始。**

本輪依使用者「請解決阻礙，然後持續開發」準備必要 P0 修復；依「由我人工審查，你先做驗證再給我審查」把審查交給使用者。此指定解決了審查人選與本機原始證據交接方式，尚不是對候選的審查結論、GitHub 計數核准或合併授權。

## 1. 範圍與版本

| 項目 | 固定來源／結果 |
| --- | --- |
| main／角色基準 | `c48ecd9a39abbc42ecf34ed3761248e11af7c29d`，包含 PR #9 使用者趙雲 |
| PR #8 規格 | `389a9a657edbdc94da18c7bdb75d62081787b54d`；[執行計畫](https://github.com/monkey1sai/changshan-longdan/blob/389a9a657edbdc94da18c7bdb75d62081787b54d/docs/engineering/MUSOU_EXECUTION_PLAN.md) |
| PR #3 | `1583ff1c286a7940223e7ee48ec1209c1e699bbc`：四難度、Director 壓力、隊長 HUD |
| PR #5 | `05294f17ad54b47fad122963380c0274768626b6`：鏡頭 clearance、營房屋頂剖視 |
| PR #6 | `38a5f42ef8e215242041b8bbfbb602457f4dfae5`：難度選單 Enter／J 出陣 |
| 本機程式候選 | `3a27331e688633896a914c8ab441bc0025e73bb3`；三筆普通 merge 均無衝突 |
| 工作樹／分支 | `C:/Repos/changshan-longdan/.worktrees/p0-current-zhaoyun-integration`；`codex/p0-current-zhaoyun-integration` |
| 最終交接版本 | 文件 commit 的 SHA、檔案 hashes、完整 diff 與 advisory 在 ignored `release/p0-20261002/handoff/`；避免 SHA 回寫自身 |

只有 PR #3/#5/#6 的必要功能整合。本輪沒有接入候選 profile、改動 17 招時序、建立 E01 trace runner、安裝 Unity、上傳 itch.io、變更權限或合併遠端 PR。

### PR #7 衝突的處置

PR #7 `2f14f7038d0f0a99ca94e1295842f32682c04c2a` 使用舊 Quaternius 角色；與 c48 的實際 merge-tree 有 8 項衝突，包含 GLB add/add 與 `player-model.ts`。**選取舊素材解衝突會覆蓋現行使用者模型，屬 HIGH 影響。** 本輪排除 PR #7，而由 c48 的載入回退與 tip／tipBase 契約及本輪驗證承接必要角色要求。這是整合處置提案，待使用者審查；PR #7 沒有被關閉、推送或合併。

兩個 commit 的檔案直接比較不能證明真正合併會刪除新 main 的獨有檔案。PR #3/#5/#6 的實際來源 delta 均未修改 `player-model.ts`，三方合併已保留現行角色；不採用初次 scope advisory 的兩點 diff 誤判。

### 角色保存

每次 merge 後核對 8 個固定檔案：GLB、manifest、player-model、zhaoyun-adapter、weapon-grip、zhaoyun tests、prepare-zhaoyun、verify-player-animation。全部與 c48 bytes／SHA-256 相同，原始清單在 `release/p0-20261002/locked-character.json`。

GLB：3,706,788 bytes，SHA-256 `7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33`。正常瀏覽器角色 ID `user-zhaoyun-c8dff5`、state `ready`、29,569 triangles；沒有更換來源 Blender。

## 2. 本輪驗證與原始證據

所有下列產物保存在本機 ignored `release/p0-20261002/`，使用者在同一台電腦可直接開啟。尚未上傳私有 source、bundle、模型或截圖；使用者是否實際開啟證據仍待審查時記錄。

| 檢查 | 本輪結果 | 原始產物 |
| --- | --- | --- |
| 依賴 | Node v22.22.0、npm 11.6.2；offline npm ci exit 0 | `npm-ci.log` |
| 每步回歸 | PR #3：48 tests；#5：42 tests；#6：34 tests；皆 exit 0，非互不重疊總數 | `pr3-tests.log`、`pr5-tests.log`、`pr6-tests.log` |
| 整合回歸 | PASS：19 檔、156 tests；TypeScript／Vite build exit 0 | `check.log` |
| 封裝 | PASS：6 entries、3,014,494 bytes；relative asset checks 通過 | `package.log`、`environment-package.json`、`release/changshan-longdan-web.zip` |
| 四難度入口 | PASS：4×3 共 12 個唯一入口；按鈕、原生 Enter／J；selected 正確、mode playing、角色 ready | `browser/entrances.json`、`battle-*.png` |
| 實際視窗 | 已檢視 1440×900、800×600 CSS viewport；DPR 1.100000023841858；小視窗無水平溢位，操作表可垂直捲動 | `browser/browser-context.json`、`07-small-title-english.png` |
| 暫停／語言 | PASS 已觀察：Esc paused、Resume playing；paused 中英切換 HP／KO 不變；語言選單 Enter 沒有出陣 | `browser/pause.json`、`responsive-pause-language.json`、`08-small-paused-english.png` |
| 正常載入 console | 捕獲時 error／warning 0；不是全程／所有操作零錯誤宣稱 | `browser/normal-console.json` |
| 真實載入失敗 | 精確阻擋本機 GLB 請求；Network loadingFailed、角色 failed、fallback 可見；原生 J 觸發 N1，沒有 DEV start／heal／teleport／清場 | `browser/fallback.json`、`fallback-console.json`、`04-fallback-title.png`、`06-fallback-input.png` |
| 隔離移動 | UNVERIFIED：受擊／N1 前進混入位移，兩份原始嘗試保留，不列 PASS | `browser/fallback-attempt1.json`、`fallback-attempt2.json` |
| 真實失焦 | UNVERIFIED／TOOL_FAILURE：切頁觀測不同步；about:blank 的 CDP context 不可用；沒有繞過工具安全限制 | `browser/blur-attempt1.json`、`blur-tool-limitation.json`；`blur.json` 的 passed=false |
| 最終候選 CI | NOT_RUN：此分支未推送，舊 PR 或 E00 的成功 CI 不移作本候選證據 | 本機交接 manifest |
| 公開站／部署 | NOT_RUN：本輪只驗收本機整合版；未更新公開站 | — |

遊戲 ZIP SHA-256：`79fd2220cad31e29ef0a47d4dfb778d3bd177758514637b09a013aabf444c871`。此 ZIP 對應程式候選 3a27331；後續文件變更不影響 runtime，交接時另核對 tracked runtime bytes。

環境：Windows 11 Pro 10.0.26100、Chrome 154.0.0.0、RTX 4060 Ti、驅動 32.0.15.8097。部分戰鬥觀測 FPS 24–40、動態倍率降至約 0.55；不是穩態效能量測或 60 FPS PASS。標題 FPS 60 不能代表 300 人戰鬥性能。硬體回覆的 AdapterRAM 不當作實際 VRAM 容量結論。

### 失敗與證據限制

`browser/harness-failures.json` 保存 AX 差異缺控制項、觀測早於 rAF、錯誤英文 locator、unsupported raw CDP input、位移混因與焦點工具限制。失敗沒有改寫成首次通過，沒有藉此修改產品程式。

`09-small-battle-chinese.png` 實際是中文暫停畫面，名稱保留原始捕獲；不能用它證明持續可見遊玩。入口中的 DOM focus 欄位亦不單獨證明 OS 焦點。截圖與 read-only 狀態支持各自觀察到的結果，不替代自然通關、公平性、聽感或連續路線影片。

本輪沙箱啟動回報 `sandbox provisioning failed`（ENVIRONMENT_FAILURE）；對已檢視的具體本機命令使用逐次核准的主機執行。沒有改 sandbox、ACL、safe.directory、hooks 或秘密。

## 3. 請使用者實際審查的範圍

先開本機遊戲 `http://127.0.0.1:5174/` 與交接 manifest，確認顯示的是本候選。服務是 task-owned local Vite，不是部署。若已停，從上列工作樹執行 `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`。

1. 對照完整 diff 與 8 檔保存清單，確認保留使用者趙雲、#3/#5/#6 整合範圍，以及排除 #7 舊素材的處置。
2. 開啟上述原始 logs／JSON／截圖，記錄實際開啟的證據；不要只引用摘要。
3. 實際遊玩四難度，確認預警／傷害／包圍壓力可辨識且公平；測靠近、離開、擊敗隊長及階段橫幅中英切換。
4. 走完整營房／牆角進出路線，確認角色／威脅可讀、屋頂恢復；測移動、普攻／蓄力、防禦、失焦返回、自然勝敗及重試保留難度。
5. 記錄聽感、裝置、實際 viewport、幀率問題。實體手把尚未使用；不能以映射測試宣稱實體驗收。

目前未執行的項目仍是必要缺口；使用者可直接回報問題，由實作者修復後再提供新 SHA。只指定審查者不表示上述項目全部通過。

## 4. 人工審查路徑修訂提案（尚待核准）

原 PR #8 要求最終 SHA 的 GitHub 正式 APPROVED；目前可用帳號只有 PR 作者 `monkey1sai`，GitHub 作者不能自我 APPROVE。使用者選擇親自人工審查，與實作代理為不同審查人；此真實人工結論仍須與 GitHub 計數 review 分開。

為使這條已指定路徑具體可審查，提出只適用本次 #8 規格、E00 #10 與此 P0 整合候選的修訂：

- 使用者實際開啟同版本原始證據、審查完整 diff／適用情境，留下身分、固定 base／head、已開證據與明確結論；由實作者如實記錄原文與引用。
- 欄位使用 `ownerManualReview` 與 `ownerManualReviewSha`；GitHub 計數欄位保持實際狀態，不偽填 APPROVED，不代發 owner-consent comment，不冒用其他帳號。
- 規格修訂本身也必須經使用者審查，並在經授權的 PR 交付中留下可回溯紀錄；不能因提出本文件就生效。
- 兩平台同 SHA CI、必要 P0／情境證據、零未解決 threads、最新 base 相容、明確合併授權及合併後回歸仍保留；不更改 GitHub 保護、權限、CODEOWNERS 或任何安全控制。
- 若未核准此修訂，維持原正式核准規則；不把 owner 人工審查轉稱 GitHub APPROVED。此提案也沒有授權關閉／合併 #3/#5/#6/#7、推送本分支或發布。

`ownerManualReview: PENDING`；`reviewerOpenedArtifacts: PENDING`；`githubCountedApproval: NONE`；`reviewRuleAmendment: PROPOSED`；`mergeAuthorization: NONE`。

## 5. 後續與回滾

本輪交接是具體人工審查候選，尚不能宣布 P0 或 E00 DONE。審查回饋先修復並重驗，授權推送後取得最終 SHA 的 Windows／Ubuntu CI；規則與規格審查完成、必要驗證齊備、獲授權合併及合併後確認，才結案 E00，再執行 E01。發布另行授權。

候選是隔離本機分支，root checkout 與公開遊戲未改。撤回單筆 merge 時使用普通 `git revert -m 1 <merge SHA>`，撤回文件使用普通 revert；不 force-push、不 reset／clean 其他工作樹、不刪原始 Blender、不自動上傳回滾版。
