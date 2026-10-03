# E01 限定結案紀錄

更新：2026-10-03（Asia/Taipei）。`stepVerdict: DONE_SCOPED_WITH_RECORDED_LIMITATIONS`。

本紀錄保存已合併 E01 的結果，讓新 checkout 能找到結案依據。[原候選紀錄](./E01_BASELINE.md)的 `BLOCKED`、失敗與當時未授權敘述是歷史快照，繼續保留。這次文件 commit 沒有重跑原 GPU suite，沒有變更玩法、素材、runner、CI 或驗收標準。

## A. 來源、範圍與授權

| 項目 | 固定來源／結果 |
|---|---|
| 執行規格 | [PR #8](https://github.com/monkey1sai/changshan-longdan/pull/8)，head `389a9a657edbdc94da18c7bdb75d62081787b54d` |
| E00 主線 | `ac47b84d18a82f7f4e3f501f96ef3020520275fd`；#11／#10 結案正文 |
| E01 實作 | [PR #13](https://github.com/monkey1sai/changshan-longdan/pull/13)，head `6967386bf46f5c7d94472f2a2f6280ef5e052c75` |
| 治理相依 | [PR #14](https://github.com/monkey1sai/changshan-longdan/pull/14)，head `c1daf7c0b5c683e0a041a85e5e324525b8662b6c` |
| 實際主線 | `8932ee47b1e902c1d858b9f1b4a1733657c04a8a`，tree `1c1d1aa5034b428473021f76754b478e9fd24843` |
| 人類接受 | `SCOPED_HANDOFF_REPORT`／`ACCEPTED_WITH_RECORDED_LIMITATIONS`；使用者接受已記錄限制並授權固定分支推送、限定 CI 與上述三項合併 |
| 正式核准口徑 | GitHub counted approval `NONE`；使用者親閱原件清單 `NOT_ITEMIZED_BY_USER`。本次限定路徑只適用上述三個固定 head，不授予新 E02 或其他 PR 核准例外 |

這次「E01 commi push;開始e02」授權補存 E01 結案文件並正常推送文件分支，以及開始 E02 本機準備。預設不合併這個新文件分支、不修改 PR、不推送 E02、不下載或付費、不發布。E02 的平台／管線決策依其規格另行形成可審查提案。

## B. 已解除的 E01 阻礙

- 原修正的同版收證：候選 `6967386` 的 round4 保存六個 GPU fixture 的預期／實際 IDs、原始像素與影像，以及第七例實際預期錯誤和 renderer 恢復紀錄。六例 IDs 分別為 `[0]`、`[]`、`[0]`、`[0]`、`[0]`、`[0]`；獨立解碼與原始 RGBA 相符。第七例是 `exceptionReport`，`gpuReadback:false`、IDs `null`，不算第七張 GPU 測量圖。
- 正式場景人口樣本：原候選保存 `300 alive / 238 sceneDepthEnemyIdPixels / 36 engaged / 0 tokenAttackers`，球形視錐 proxy 為 `250`；framebuffer `1665×949`。238 個 IDs 合計 118,755 pixels，RGBA SHA-256 `e26372265cdfb81d20c6174c7f4a3cf22ec29e59da6f5462767940fba8abbde5`。這是已暫停 constructor 場景的限定樣本，不是所有遊玩過程可見數。
- 跨平台與合併相容性：Windows／Ubuntu 主線 CI、主線本機檢查、21 本機與 42 CI 原始 traces 相符核對已完成；原 runner／素材與量測候選銜接可追溯。
- 可讀交付、限定人類接受、獨立 advisory 審查、獲准正常合併及合併後 Web 操作回歸已保存。#8／#14／#13 最終正文已更新並逐份讀回相符。

原核心 21 traces 的 `visible` 仍是 `null`。上面的真實像素數不得回填為未執行 WebGL 的核心 trace 可見數，也不能稱為在合併主線重新量測 GPU。

## C. 合併與驗證證據

| PR | 實際 merge SHA |
|---|---|
| #8 | `cbc174f8241469046449094e353693f5c89c87e0` |
| #14 | `41d8b6b36edc20da61b4ef9a115e08d33c842c9c` |
| #13 | `8932ee47b1e902c1d858b9f1b4a1733657c04a8a` |

可由 GitHub 查核的結果：[主線 CI 37031262811](https://github.com/monkey1sai/changshan-longdan/actions/runs/37031262811)，head `8932ee47…`，Windows 與 Ubuntu jobs 均 `SUCCESS`；三個 PR 的結案正文提供限定範圍與來源。CI artifacts 保留 7 天，過期後不能假定仍可下載。

本機保存的原始結果：22 檔／227 tests、typecheck／build／package 通過；63 份 raw traces 與原候選相符；交付 ZIP 為 3,014,494 bytes，SHA-256 `79fd2220cad31e29ef0a47d4dfb778d3bd177758514637b09a013aabf444c871`，與原候選包相同，沒有上傳。

合併後可見 Chrome 操作支持標題、出陣、再戰、暫停與恢復。保存的五張原圖實際為 1514×863 JPEG，原 `.png` 副檔名誤標已記錄，另保存相同 bytes 的 `.jpg` 副本；沒有重編碼或覆寫原件。首次暫停前已敗走，該項 `NOT_OBSERVED` 保留；再戰後暫停／恢復成功。

以下位置是 **local_only 原件索引，沒有隨 Git push 上傳**：

- E01 來源工作樹的 `release/e01/land-authorized-20261002/`：`e01-completed.json`、`main-compatibility-proof.json`、`final-main-ci.log`、`independent-post-merge-review.md`、`final-body-readback-proof.json`。
- 主線驗證工作樹的 `release/e01/post-merge-8932ee4/`：`local-main-result.json`、`check.log`、`browser-smoke-record.json`、`screenshot-original-format-copies.json`、`cleanup.json`。
- E01 來源工作樹的 `release/e01/handoff/`：source bundle SHA-256 `29139cc5fa924ee2e7c0874fff6bdb84f5ab2e64e0de972591e8c8e8e8ac9f18`；recording review ZIP `43876876abc71d1fdefc2d913802e87b69c3138aaa80e0f00d855ded67607a3e`；round4 ZIP `a9fbbe2026cb911ae8d4c1c0ed76b479478e19f30000a999fea574759941f1c6`。

新 checkout 可直接讀取本紀錄與 GitHub 證據；需要上述本機原件時，由持有人提供受限存取，不把 ignored 路徑誤稱為已分享的 artifact。

## D. 審查與保留限制

獨立合併後 advisory 結論為 `ALLOW_SCOPED_E01_DONE_WITH_RECORDED_LIMITATIONS`；它是原件與相容性審查，不是 GitHub 正式人類 `APPROVED`。本次文件補登仍須其自身 diff／來源核對，不能借舊候選 CI 宣稱新文件 commit 已跑 CI。

- 原 round4 console 保存區間及主線 cursor 25→63 區間沒有觀察到 error／warning；初始 navigation 覆蓋不完整，應用 listener 的 `consoleCoverage:NOT_CAPTURED` 保留。不得推論所有歷史零錯誤。
- JSON 下載逾時為 `TOOL_FAILURE`，下載 UX `UNVERIFIED`；manifest 的 `ERR_BLOCKED_BY_CLIENT` 原因未確認。後續同源 JS／CSS／GLB／manifest bytes 相符不是初始網路載入 body 全覆蓋。
- 兩次離線 helper 的 `Title not observed`／`Not a PNG: title.png` 保持 `TEST_FAILURE`；DOM facade 的 `document.hasFocus is not a function` 保持 `TOOL_FAILURE`。獨立原件檢視支持 UI 子結論，不追認失敗 helper 為 PASS。
- 完整招式／自然勝敗與重試矩陣、四難度公平性、人類手感／聽感、實體手把、GPU active、input-to-photon、全規模 FPS／長測仍未驗收。核心合成 fixture 的 CPU 經過時間不等於遊戲效能。

上述限制是已接受的 E01 限定量測邊界，不是 E02–E13 的通過證據。`musou-profile.proposed.json` 繼續 `runtimeConnected:false`，觀測未知保持 `null`。

## E. 下一步與回滾

E01 的已接受量測範圍已結案；現在可依使用者新授權開始 E02 的隔離本機準備。E02 仍須核准 Unity 精確版本、渲染管線、平台／硬體、Web 保留、單位座標、唯一位移權威及資產策略，再取得真實 Unity 編譯／Edit Mode／Play Mode／build／啟動關閉、負例、Web 回歸、必要畫面及同版本正式 review；不直接標 `DONE`，不開始 E03。

撤回本次文件補登時只普通 revert 文件 commit；不 reset／clean 既有工作樹，不改凍結證據、不刪 GLB／Blender 來源、不上傳回滾版。
