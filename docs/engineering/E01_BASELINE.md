# E01 本機基準量測候選

日期：2026-10-02（Asia/Taipei）。目前狀態：`BLOCKED`，尚未完成 E01；不得進入 E02。

## 1. 來源、前一步與授權

- 規格：[PR #8](https://github.com/monkey1sai/changshan-longdan/pull/8)，實際鎖定 head `389a9a657edbdc94da18c7bdb75d62081787b54d`。規格中的歷史 head 不取代這次查核的版本。
- E00 完成基線：main `ac47b84d18a82f7f4e3f501f96ef3020520275fd`。使用者同意先合併 #11、同步並驗證 #10，再回歸 main；亦核准 #8 作執行基準，尚未逐項驗證的體驗／裝置情境列作後續驗收。
- [PR #11](https://github.com/monkey1sai/changshan-longdan/pull/11) merge `bdd5665824d3be87a083601c805a3288c605e4c6`；[PR #10](https://github.com/monkey1sai/changshan-longdan/pull/10) merge `ac47b84d18a82f7f4e3f501f96ef3020520275fd`。完成證據包含 final main 19 檔／156 tests、Windows／Ubuntu main CI、109 個 tracked 檔案的 bundle 還原核對及可見 Chrome 的出陣／普攻／暫停／恢復。
- E00 原文件是當時的凍結快照，內含當時的 `BLOCKED`。後續 E00 `DONE` 以 #10 更新正文與 `e00-main-validation/release/e00-post-merge/e00-completed.json` 為準；不把凍結快照重寫為當時已完成。
- 本步在 `codex/e01-baseline-traces` 的隔離工作樹實作。已授權本機開發、驗證與保存候選；E01 推送、新 Draft PR、合併與發布均尚未取得授權。
- 實作者：此工作階段協調者。獨立開始前／架構審查：`/root/e01_architecture_review`，Astra/high，唯讀；結論允許本機候選與診斷實作，完整 E01 退出仍 HELD。代理意見不是 GitHub 正式 `APPROVED`。

## 2. 實作範圍與重現入口

只新增本機 runner、測試、診斷頁、文件與 CI 證據入口。`src/`、`public/`、正式 `index.html`、套件依賴、玩法數值與角色素材均未修改。`musou-profile.proposed.json` 未接入 runtime。

使用符合 `package.json` engines 的 Node；本機已使用 Node `v22.22.0`。從此工作樹根目錄執行：

```text
npm ci --no-audit --no-fund
npm run check
npm run package:itch
npm run trace:baseline -- --out release/e01/review-a
npm run trace:baseline -- --out release/e01/review-b
```

`--out` 必須是 `release/e01/` 下的新子目錄。runner 拒絕越界、符號連結／junction、既有產物目錄及 30/60/120 以外的 `--hz`，保留前次證據。每個輸出目錄含 `manifest.json`、`effective-profile.json` 與 21 份 trace；CPU 經過時間留在 manifest，確定性的 trace 不混入 CPU 時間。

產物是 `local_only`，不 commit `release/`。候選 SHA、完整原始 log、exit code、檔案雜湊與最終審查另放交付資料夾，避免把本 commit 的 SHA 寫回本 commit。CI 已加入兩個作業系統的 CLI trace 與保留 7 天的 artifact 設定；未推送前 CI 為 `NOT_RUN`。此變更修改驗證流程，沒有部署、API、環境變數、migration 或外部遙測。

## 3. 核心 runner 的口徑與限制

`scripts/lib/baseline-harness.ts` 重用正式 `Game.tick/simulate/onHits/setPaused`、`Player`、`EnemyStore`、`Input.poll`、Arena、Director 與 CameraRig。為讓 Node 可執行，constructor 未執行；UI、WebGL、聲音和特效是明列的 stub，鏡頭數學仍使用正式實作。因此這是正式戰鬥核心的合成 fixture，不能當作完整 Game constructor 或自然重試的驗收。

| 情境 | 輸入／fixture | 本步觀察 |
|---|---|---|
| `early_combo` | J 於 0／0.08 秒 | 早按緩衝可到 N2；保存原始事件與取樣 tick |
| `hitstop_input` | J 於 0 秒、K 於 0.14 秒，近身單敵 | K 位於實際 hit-stop；simClock 不推進，恢復後到 C2 |
| `pause_buffer` | J、K、Esc 暫停及恢復 | 已排隊的 charge 清空；暫停期間 simClock 不推進 |
| `blur_buffer` | J、K、合成 blur/focus、Enter | 重用正式失焦 listener 順序及清空流程；不是 OS 真失焦證據 |
| `hit_1/5/20` | 正式 `startMove(C4)` 的 DEV fixture | 只觀察 C4 第一窗口；0.32 秒結束，未宣稱完整 C4／自然接招 |

三種 Hz 各跑上述七情境。hit 以 move 啟動時的 stamp 對應 `attackOrdinal × moveId × windowIndex × enemy id`，在正式 `onHits` 接受命中時複製 shared array；不從 tick 後的 move 推測舊窗口歸屬。同 tick 由 N2 接 N3 的負例防止命中誤標。hit-stop 不重記 Player 留下的舊 events／activeHits。

時鐘分別保存 runner 的 `tickStartSec/tickEndSec`、Game `clock`、`simClock`、`battleTime` 與 hitstop。Game.clock 每 tick 起首增加；simClock 在 simulate 返回後增加；onHits 發生於兩者之間。暫停保持的是 simClock，Game.clock 仍會走。

原始輸入排程只能在下一 tick 採樣：單一輸入採樣上限 `1/Hz`，狀態觀察同樣 `1/Hz`，合計量化界限 `2/Hz`。取消窗口等待、hit-stop 與暫停不屬於此量化誤差；它不是 input-to-photon 的上限。

核心 trace 分列 `alive`、`engaged`、`tokenAttackers`、`visible:null`；另有明確名稱的球形視錐 `frustumProxy`。engaged 只計 alive，alive token 總數須等於正式 attackerCount。未知可見數不替換成 0 或 proxy。固定敵人 seed 7、回饋 seed 99、固定出生座標；fixture 僅 reset 一次，與自然首戰／重試 RNG 歷史不同。原始 stamp 保留，僅在最終比較正規化程序全域 ID 的 offset。

儀表開關對照僅證明這些 fixture 的被比較最終 snapshot／敵人欄位相同；不宣稱所有私有狀態、中間 tick、render 或 RNG closure 相同。105 組交錯順序 CPU 樣本各包含 fixture 建立、記錄配置、snapshot 與結果建立，稱為「完整 harness run 經過時間／增量」；不能當作每幀 gameplay CPU、GPU active 或原遊戲 FPS。

`baseline-profile.ts` 從此 runner 的同一 checkout 讀實際數字宣告、指定 call、Input 的兩個條件式 repeat 規則、17 招 MOVES、DIFFICULTIES 與指定 layout。缺失、重複、非有限值、未知條件、未支援運算式或不同 checkout 都明確失敗。profile 列有 `notCovered`，沒有宣稱完整掃描全部 private 預設、AI 分支 literal、guard cosine、GPU 設定或 retry RNG。

## 4. 本機可見人口診斷與目前阻擋

本機診斷入口（只支援 Vite DEV）為：

```text
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
http://127.0.0.1:5176/scripts/baseline-view.html?evidence=/release/e01/review-a/manifest.json
```

診斷頁沿用正式 HTML、介面、Game constructor 與 rAF；與正式遊戲入口分開，未加入正式 build。它先核對同版本 profile、指定來源／runner 與角色資產 hashes。角色須 ready，頁面須 visible，自測須 PASS，且已出陣，才允許讀取快照。

候選口徑 `sceneDepthEnemyIdPixels`：指定 framebuffer 與正式 CameraRig 相機，在同一固定場景下，存活敵人的正式 SoldierView 身體／裝備至少 1 個像素通過不透明／alpha-test 世界、玩家及其他敵人的深度遮擋。先以原材質完成深度，再保留 depth 畫 enemy ID；旗幟的 alpha-test／頂點變形、趙雲蒙皮與屋頂 visibility 由原材質保留。ID pass 關閉 blending、MSAA、tone mapping 與色彩轉換；雙腿／雙臂每敵人 2 instances，其餘每敵人 1 instance。

此口徑排除 depthWrite=false 的透明效果、後製、HUD／選單和人的辨識能力；single-sample 邊緣與正式 4× MSAA 不同。保存各 ID pixelCount、完整 alive IDs、camera matrices、framebuffer、原始 ID PNG／bytes hash、CPU 提交／readback 等待／解碼經過時間，GPU active 保持 null。診斷前後須 gameplay／instance matrices 相同，render target、viewport/scissor、clear、材質及 shader error handler 須恢復；中途 throw 也走 finally。

**目前沒有成功的正式場景 visible 樣本。**

| 瀏覽器輪次 | 實際結果 | 處理與未驗證事項 |
|---|---|---|
| 1 | `FAIL`：GLSL3 的 `gl_FragColor` 未宣告 | 原始候選與 error 保留；改用明確 fragment output，compile failure 直接使量測失敗，不能當作 0 visible |
| 2 | `FAIL`：前兵完全遮後兵預期 `[0]`，實際 `[0,1]` | 自測 setMatrixAt 後未標 instanceMatrix.needsUpdate；ID clone 取新 CPU 矩陣，原 depth mesh 用舊 GPU buffer。已補 self-test upload marker；正式 SoldierView 原本有此 marker，沒有改正式渲染 |

第二輪在第四項才拋錯，因此前三項未拋錯；當時沒有逐項保存的結果，不補造逐項 PASS 紀錄。兩份原始失敗 JSON、當時 runner hashes、console 與截圖保存在 `release/e01/`。後續修正已加入逐項紀錄與自測未 PASS 時禁用快照。

PR #8 第 1 節要求「連續兩輪仍無法通過時停下並記錄阻擋原因」。兩輪已用完，未自動重設額度，**尚未執行修正後第三輪**；增加一輪須由使用者決定。這是 `TEST_FAILURE`（診斷 fixture），目前沒有證據指向正式玩法失敗。仍待同版本敵人互遮、死亡／視錐外、alpha 缺口、例外恢復、正式角色場景四數與診斷後正常畫面；亦不能回填 21 份無 WebGL trace 的 visible。

## 5. 審查、退出與回滾

完整 diff、負例、trace、profiling 口徑、失敗歷史與精確候選須交獨立 reviewer；其來源審查與允許修正不等於像素實測 PASS。即使本機 21 traces、unit tests、build／package 與封包相同核對通過，E01 仍 `BLOCKED`；額外瀏覽器驗證、可讀交付、CI、正式同版本人工結論、明確合併授權及合併後回歸未齊。

不得把 E00 的 scoped 人工接受、其他 PR 的核准、綠色 CLI 或 GitHub bot 意見移作 E01 的 APPROVED。沒有開始 E02、下載／安裝 Unity、付費製造、發布或改線上服務。

撤回時只普通 revert 本步 commits，移除 runner／診斷／CI入口與測試。保留 E00 基線、Web 程式、GLB／Blender 來源與失敗產物，不 reset/clean/force-push，不自動撤回線上版本。
