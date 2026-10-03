# E02 本機準備紀錄

日期：2026-10-03（Asia/Taipei）。`stepVerdict: BLOCKED_PENDING_ADR_DECISION`；已開始準備，未完成 E02，`nextStepAllowed:false`、`mergeSha:null`、`releaseOrPaidActionPerformed:false`。

## A. 來源與授權

- 起始主線 `8932ee47b1e902c1d858b9f1b4a1733657c04a8a`，tree `1c1d1aa5034b428473021f76754b478e9fd24843`。
- 前置 [E01／PR #13](https://github.com/monkey1sai/changshan-longdan/pull/13) 限定 DONE；規格 [PR #8](https://github.com/monkey1sai/changshan-longdan/pull/8) head `389a9a657edbdc94da18c7bdb75d62081787b54d`。
- 使用者「E01 commi push;開始e02」授權本機開始 E02；隔離分支 `codex/e02-unity-foundation`。E01 文件推送是另一個分支／scope，不包含 E02 推送、CI dispatch、merge、發布、下載／付費或素材／玩法移植。
- 實作者為本工作階段協調者；不同實作者的開始前 reviewer 為 `/root/e01_architecture_review`，advisory `ALLOW_E01_CLOSURE_DOCS_AND_E02_LOCAL_PREPARATION`。requested Astra/high；此分派沒有實際 runtime 讀回，actual runtime `UNVERIFIED`，不是 GitHub 正式 approval。

## B. 本機候選範圍

已建立 [ADR 提案](./E02_UNITY_ADR.md)、[資料提案](./e02-unity.proposed.json)、[驗證入口](./E02_UNITY_VALIDATION.md)、唯讀 preflight library／CLI 及 Node 負例測試。package scripts 只新增這三個本機工具入口；沒有新依賴或 lockfile、沒有建立 Unity project／C#／生效渲染設定，沒有變更 Web source／素材／profile。

環境觀察與成本界線見 ADR；Unity 精確檔案／module 存在性與硬體盤點不代表可編譯／可用 license。`e02-unity.proposed.json` 為 `PROPOSED`，`acceptedDecisionRecord:null`，不自我接受。

## C. 驗證紀錄

原始 logs／exit／候選 source hashes 保存於本工作樹 `release/e02/preparation-20261003/`，為 `local_only`，不隨 Git push 分享。

先寫測試的基線結果是 `ERR_MODULE_NOT_FOUND`（runner 尚不存在），exit 1；它是預期 test-first 基線，不宣稱 Unity 失敗。實作後的 runner 測試、實機 inventory／預期 blocked preflight、Web 回歸及完整 diff 檢查另保存原始結果；尚未執行的項目不能記 PASS。

已執行結果：

- 工具首輪 26／27：合成 junction 的父目錄不存在，使 mock 未被呼叫，為 `TEST_FAILURE`；只補正 fixture 後 27／27 通過，兩份 logs 保留。
- 交付審查指出斷裂連結及普通檔案作輸出父目錄的預檢假陽性；兩個新增負例在修正前均失敗，為預檢工具缺陷，不是遊戲 runtime 故障。只將路徑檢查改為直接 `lstat`、只有 `ENOENT` 可當缺少元件、中間元件須為目錄；修正後 29／29 工具測試通過，舊失敗保留。
- 實機 inventory exit 0；修正前／後 preflight 均 exit 2，只有 `ADR_NOT_ACCEPTED`、`DECISION_RECORD_MISSING`、`PROJECT_MISSING`。ProductVersion 精確相符，兩個保留素材 hashes 相符，沒有啟動 Unity。
- 本工作樹 Web 回歸：22 檔／227 tests、TypeScript／build 通過，打包 3,014,494 bytes，SHA-256 `79fd2220cad31e29ef0a47d4dfb778d3bd177758514637b09a013aabf444c871`，與已接受 E01 包相同，沒有上傳。路徑修正只影響未被 Web 匯入的預檢 library；Web／package／lock／Vite 來源核對相符，未重跑原 GPU／Web 瀏覽器 suite。
- 三份 Node 工具檔 `node --check`、完整 staged diff／相對來源核對與文件連結檢查須綁定最後本機候選；候選 SHA／檔案 hashes 放 ignored 交付紀錄，避免自我引用 commit SHA。

| E02 必要證據 | 本候選的界線 |
|---|---|
| 缺 Editor／錯版本／revision／project／module／package／素材、路徑與既有輸出負例 | 29 項本機工具測試 PASS；不啟動 Unity |
| 真實 Editor compile／Edit Mode／Play Mode／build | NOT_RUN：決策未接受、工程／execution runner 未建立 |
| Player 啟動關閉／真實畫面 | NOT_RUN：沒有 Unity build |
| 新 checkout 同版重現 | 尚未具備 Unity 工程，只可重現本頁工具 |
| 人類平台決策／正式同 SHA review／merge後確認 | 尚未齊備；不沿用原三個固定候選的例外 |

## D. 審查與停止

交付前以本候選完整 diff／hashes、實際 logs 和 Web 相容性提交獨立 advisory 審查。模型 runtime 未讀回與 formal review 仍是缺口，不得以角色名稱／CLI 成功補成 APPROVED。真實 Unity 執行沒有起步，因此沒有重設或消耗 E01 原 GPU 重試額度。

## E. 下一步與回滾

先由使用者對 ADR 三個方向選定平台／管線及對應下載範圍；方向 1 接受後再建立精確隔離工程、完整 execution runner／最小 Unity tests 與可啟動 Windows build。E02 尚須它自己的正式 review、必要畫面、Web 回歸、另行授權合併及合併後確認，完成前不開始 E03。

回滾僅移除或普通 revert 本任務預檢／提案檔案與 package scripts，保留原始 Web、素材與失敗紀錄；不 reset／clean 根工作區、不刪或接管未知 Unity 程序、不發布回滾版。
