# E00：可回復版本基線與逐步證據紀錄

日期：2026-10-02（Asia/Taipei）。狀態：**BLOCKED；本機準備已完成，尚未通過 E00 完成門檻，不可進入 E01。**

依據 [PR #8 的執行計畫](https://github.com/monkey1sai/changshan-longdan/blob/389a9a657edbdc94da18c7bdb75d62081787b54d/docs/engineering/MUSOU_EXECUTION_PLAN.md) 與 [逐步模板](https://github.com/monkey1sai/changshan-longdan/blob/389a9a657edbdc94da18c7bdb75d62081787b54d/docs/engineering/MUSOU_STEP_RECORD.template.md)。機器可讀版本、完整 SHA-256 與原始產物索引在 [e00-baseline.snapshot.json](./e00-baseline.snapshot.json)。本文件只保存來源、回復方式與本輪證據；未接入候選 profile，未修改玩法、模型或其他 PR。

## A. 開始前範圍審查

| 欄位 | 本輪紀錄 |
| --- | --- |
| stepId / 變量 | E00 / V12 |
| implementationPr | null；尚未推送或建立實作 PR |
| implementer | 本次 Codex 主代理 |
| independentReviewer | 本次獨立唯讀 `e00_review` reviewer；範圍盤點屬 advisory，非 GitHub APPROVED |
| reviewedPlanSha | `389a9a657edbdc94da18c7bdb75d62081787b54d`；規格仍 Draft，未正式核准 |
| sourceBaseSha | `c48ecd9a39abbc42ecf34ed3761248e11af7c29d` |
| requiredScenarioIdsAndSubcases | S01–S08 既有證據盤點；不繼承歷史 PASS |
| allowedPaths | 本文件、snapshot JSON；ignored `release/e00/20261002/` 保存本機原始證據 |
| forbiddenChanges | runtime、候選 profile、來源 Blender、既有 worktree、其他 PR、發布、付費、權限與憑證 |
| preImplementationReview | 已完成唯讀範圍盤點，允許本機準備；完整候選審查另記錄 |
| mergeAuthorization / paidActionAuthorization | null / null |

已存在 runner：`npm run check`、`npm run package:itch`、`git bundle verify`。本步不建立 Unity、trace 或新 gameplay runner。獨立 scope reviewer 指出的 bundle、同輪回歸與最新 source manifest，均在本輪準備中補齊；正式核准與前置 P0 缺口仍保留。

### 即時版本盤點

以下為本輪讀取 GitHub 與 Git 的結果；PR 回覆的 base SHA 都是 `a42c9294c32ac8ff566bc019dc5465b9dc7ad1d9`，不得與即時 main 混用。原始 JSON 與各 head 的 check-runs 均已保存。

| 來源 | 固定 SHA | 本輪可確認狀態 |
| --- | --- | --- |
| 即時 main／選定 Web 基線 | `c48ecd9a39abbc42ecf34ed3761248e11af7c29d` | PR #9 merge；已保存並本輪重測 |
| 主 checkout／PR #8 原規格基準 | `a42c9294c32ac8ff566bc019dc5465b9dc7ad1d9` | 本機 main 未移動；與新 main 分開保存 |
| PR #3 | `1583ff1c286a7940223e7ee48ec1209c1e699bbc` | OPEN / Draft；Windows、Ubuntu CI success；reviews 空 |
| PR #5 | `05294f17ad54b47fad122963380c0274768626b6` | OPEN / Draft；兩平台 CI success；reviews 空 |
| PR #6 | `38a5f42ef8e215242041b8bbfbb602457f4dfae5` | OPEN / Draft；兩平台 CI success；reviews 空 |
| PR #7 | `2f14f7038d0f0a99ca94e1295842f32682c04c2a` | OPEN / Draft；兩平台 CI success；reviews 空 |
| PR #8 | `389a9a657edbdc94da18c7bdb75d62081787b54d` | OPEN / Draft；兩平台 CI success；只有作者 COMMENTED |
| PR #9 | `7f9a0692bccdde938be7e117984a2fab628d7d8f` | MERGED，merge 為 c48；兩平台 CI success；reviews 空 |
| 本機 P0 整合候選 | `c69474c74f29bb15122c23cc265592799d0aa1cd` | 本機分支，不是 main，也未發布 |
| 本機角色／發布紀錄分支 | `b29ee87591263b0828d90295ea48da0f21c831e8` | 本機分支，不當作新 main 或本輪正式核准 |

PR #9 已合併使用者趙雲，故不能直接套用 PR #8 的舊角色基準。PR #7 的另一份角色與舊 P0 整合候選仍分開保存，沒有將其合併入本步。PR #9 記錄的歷史 P0 豁免不是本次 E00/E01 門檻豁免。

八個已登記 worktree 的 tracked 修改均空。主 checkout 另有五個 `%SystemDrive%/ProgramData/Microsoft/Windows/Caches/` 未追蹤檔；它們未移動、未讀取內容或刪除。本次隔離 worktree 位於 `.worktrees/e00-recoverable-baseline`，在主 checkout 亦呈未追蹤；僅以確切檔案路徑 stage，禁止整包加入。

## B. 候選版本、角色與輸出

本步分支：`codex/e00-recoverable-baseline`。candidate SHA 與被測檔案的 commit 位元組一致性另存 `release/e00/20261002/candidate-record.json`，避免把本 commit SHA 回寫自身造成重複提交。此檔是 local_only，不是正式 PR 或 CI artifact。

Node `v22.22.0`、npm `11.6.2`；選定來源為 c48。畫面使用可見 Chrome 的公開 iframe；本輪未量測硬體／驅動、1080p60、GPU 或 soak。CPU/GPU/RAM、VSync、完整感官及手把欄位仍為未知，不宣告 NOT_APPLICABLE 或 PASS。

既有招式共 17 個：`N1–N6`、`C1–C6`、`JA`、`JC`、`DASH`、`COUNTER`、`MUSOU`，直接對照 `src/combat/moves.ts` 的 `MoveId` 與 `MOVES`。`src/view/player-model.ts` 保留世界座標 `tip` / `tipBase`，局部 Z 分別為 2.7m / 1.25m；`src/game.ts` 仍以它們更新 trail。

`src/view/zhaoyun-adapter.ts` 在網格、武器與必要骨骼驗證後才隱藏 fallback 並進入 ready；失敗維持程序角色並回報 error。這是 source 契約確認；本輪未做真實 network-failure 回退驗收。

| 保存產物 | 本輪核對 |
| --- | --- |
| 使用者原始 Blender 及來源副本 | 14,046,009 bytes；SHA-256 `c8dff5bf7d43c04040a5f661b64a8702b5bedaf5fb2f69debd10a626dcc901a9`；原始來源與副本雜湊相同，未修改 |
| 骨架整理副本與最後 reexport 副本 | 兩份 `.blend` 及 prepared-audit 均另行複製保存；各自 hash 在 snapshot 中；未重新匯出 |
| c48 GLB | 3,706,788 bytes；SHA-256 `7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33`；與 manifest、公开 HTTP 讀回一致 |
| 本輪重建 ZIP | 3,012,736 bytes；6 entries；SHA-256 `93b6d72a6a31760c3c46767635a698a7df0ab9bfaaad022d5cc95a9ca80bdc0a`；與先前下載保存的發布 ZIP 一致 |
| 前版回滾 ZIP | 4,389,170 bytes；SHA-256 `df5d6af7dbbee3e120faffe6ad53acb4f199eada0876e3b68306cda6709238b7`；已保存副本並核對 |
| source.bundle | 10,049,450 bytes；SHA-256 `0d2a5a4cc241bc28316f6d3b1e3b6d66ce2d75ab53a0fadc83dafa9d961e8bfd`；完整歷史、7 refs；10 個選定 commit 可讀回 |
| proposed profile 參考 | SHA-256 `8490a542024c444299464af748573c8820cbc8d16a2d6adee5308743b5403577`；`runtimeConnected=false`、`observations=null`、S01–S08 `not_run` 保持不變 |

來源 `.blend` 及影片不加入 Git 或公開資源；它們和原始 HTTP/GitHub 回覆、截圖與 logs 保存在 ignored 的 `release/e00/20261002/`。來源關係沿用既有 author audit，再由本輪核對 bytes；未重新執行 Blender，故幾何／骨架細節不冒稱本輪重新製作驗收。

### 公開版本與 Web 保留

本輪可見 Chrome 開啟 [正式頁](https://monkey1sai.itch.io/changshan-longdan)，按 Run game → To Battle → Esc，觀察到標題、300 remaining 的戰鬥畫面及 Paused。截圖：`live-title.png`、`live-battle.png`；本次 tab 已捕获 console error/warning 均為 0。這只支持載入與出陣；不是完整操作／手感／自然通關驗收。

實際 iframe 為 `https://html-classic.itch.zone/html/19513683/index.html?v=1790910799`。另外 HTTP GET 保存 HTML、JS、CSS、GLB、manifest、license；後五類資產與本輪 c48 build 雜湊相同。itch 注入的 HTML 與本機 HTML 不做錯誤的 bytes-equal 宣稱。線上 source commit 由相同資產推定（INFERRED），沒有內嵌 SHA 直接證明。保存的發布 ZIP 是先前下載件，本轮沒有重新下載當前 ZIP。

保留 Three.js／TypeScript／Vite、`base: './'`、license、現行 Web 與 itch.io delivery；不安裝 Unity、不上傳、不修改商店。`docs/itch-page.md` 的歷史上架表不當作本輪發布證據。

## C. 驗證矩陣

所有 gameplay checks 受測來源均為 `c48ecd9a39abbc42ecf34ed3761248e11af7c29d`；各產物完整 SHA-256 與可存取本機路徑見 snapshot 的 `artifacts`。

| 檢查 | 完整命令／方法 | 本輪結果與原始證據 |
| --- | --- | --- |
| 鎖定依賴 | `npm ci --offline --no-audit --no-fund --logs-dir release/e00/20261002/npm-logs` | exit 0 / PASS；`npm-ci.log`。離線使用既有 npm cache，沒有變更 lockfile |
| 共通回歸 | `npm run check` | exit 0 / PASS；15 檔 103 tests、typecheck、build；`check.log` |
| 封裝 | `npm run package:itch` | exit 0 / PASS；6 entries、relative asset checks；`package.log`、本輪 ZIP |
| 保存正例 | `git bundle verify release/e00/20261002/source.bundle` | exit 0 / PASS；完整歷史、7 refs；`bundle-verify.log` |
| 獨立還原 | `git clone --no-checkout --no-hardlinks release/e00/20261002/source.bundle release/e00/20261002/restore-check`；在新 clone checkout c48 | clone/checkout exit 0；10 commit 均可讀；92 個選定 tracked 檔與來源 bytes 相同；`restore*.log/json` |
| 負例 | `git bundle verify release/e00/20261002/invalid.bundle` | 預期 exit 1，被拒絕；`negative-bundle.log`。沒有破壞原 bundle |
| 版本邊界 | 正式 main、舊 main、相依 PR、未發布整合分支分開固定；公開資產與本輪 build 比對 | PASS 此保存範圍；不替代各 PR 的 P0／正式 review |
| 可見公開載入 | Chrome Run game → To Battle → Esc；無 DEV 注入 | 已觀察 startup；兩張截图；完整 rendered scenarios / 連續影片仍 NOT_RUN |
| 自然勝敗／聽感／手把／效能 | 本輪未執行 | NOT_RUN；不從舊 PR 複製 PASS |
| S01–S08 完整情境 | 盤點而非執行 | 全部保持 not_run；沒有晉級 E01 |

第一次還原 object check 手抄 PR #6 SHA 少了 `df`，對 `38a5f42ef8e215242041b8bbfbb602457f4ae5` 回報 `fatal: Not a valid object name ...`、exit 128，分類 TEST_FAILURE。bundle 沒有變更。改以原始 PR JSON 讀出正確 40 位 SHA 後，第二次 10/10 commit 全部成功；保留失敗原因及 `restore-objects-2.json`，沒有抹除失敗或宣稱初次通過。

沙箱初次 Git 回報 `fatal: detected dubious ownership`，GitHub socket 查詢亦受限，分別分類 ENVIRONMENT_FAILURE / NETWORK_FAILURE。主機唯讀核對 `jacks` SID 結尾 1001 與 folder owner 相符後，對具體 Git／網路命令逐次使用自動審核的主機執行；一般 npm／測試／建置均在沙箱成功。未修改 `safe.directory`、ACL 或其他保護。

## D. Commit 與審查閉環

| 輪次 | 候選 | 已完成／仍缺少 |
| --- | --- | --- |
| 本輪 E00 準備 | SHA 另存 candidate-record.json | 本地基線回歸、恢復及負例已記錄；完整候選 advisory review 另記錄；正式 APPROVED、candidate CI、review threads 均未取得 |

scope reviewer 與實作者不同，但 session advisory 不是 GitHub 計數核准。本地自檢不能授予正式 APPROVED；PR #8 的作者 COMMENT 不移用到本候選。未以其他 PR 的 head CI 當作 E00 candidate CI。

`formalIndependentReview: NOT_RUN`；`formalReviewCommitSha: null`；`formalReviewUrlOrId: null`；`latestCiHeadShaAndResults: null`；`unresolvedReviewThreads: null`；`finalSameVersionVerdict: BLOCKED`。本地 snapshot 只能供本機 reviewer 閱讀，尚未提供外部可讀的大型證據產物。

## E. 停止、回滾與下一步門檻

`stepVerdict: BLOCKED`；`nextStepAllowed: false`；`mergeSha: null`；`postMergeValidationAndCompatibility: NOT_RUN`；`releaseOrPaidActionPerformed: false`。

剩餘阻礙：PR #8 的規格尚無獨立正式核准；PR #3/#5/#6/#7 仍 Draft，正式核准與 P0 證據未齊；E00 未推送、未建立實作 PR、無候選 CI／正式 APPROVED／threads 查核／合併授權／合併後確認。不得因新 main 或 PR #9 的歷史豁免而自行刪除這些門檻。

回復 source 的程序已在新的 task-owned clone 實測；要自行檢查可在**新的空目錄**執行：

```powershell
git clone --no-checkout --no-hardlinks '<保存位置>/source.bundle' '<新的空目錄>/restored'
git -C '<新的空目錄>/restored' checkout --detach c48ecd9a39abbc42ecf34ed3761248e11af7c29d
```

先依 snapshot 核對 bundle SHA-256，再執行。這是建立新 checkout，不是覆蓋目前作品。GLB 已包含於 bundle；Blender source 與前版 ZIP 由 `preserved/` 的相應 hash 找回。若撤回本步，僅對 E00 文件 commit 做普通 revert；不 reset/clean 既有工作樹、不刪原始 `.blend`、不自動上傳回滾版。

需要使用者授權本步推送／Draft PR，以及由合格獨立 reviewer 處理正式核准與相依 P0 缺口。實作 PR 的說明需回連 #8；E00 在同版本門檻、授權合併與合併後查核全部齊備才 DONE，之後才開始 E01。本機準備沒有授予後續階段、其他 PR 合併或發布權限。
