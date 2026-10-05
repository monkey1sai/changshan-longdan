# E02 驗證入口與目前界線

2026-10-04 已核准 ADR 方向 1，建立隔離工程與完整 runner；當日兩次真實啟動受共享 Licensing Client IPC／mutex 阻擋。**2026-10-05 起真實 Unity 驗證已可在本機完整執行**：compile、9 Edit Mode、1 Play Mode、Windows build、Player 與 1920×1080 截圖在全新 checkout 一次通過，過程與修正見 [E02_ENGINE_FOUNDATION.md](./E02_ENGINE_FOUNDATION.md) F 節。這是本機引擎證據，不是正式 review 或 E02 DONE。本頁命令是已存在的實作入口；是否通過須讀每次新 `release/e02/<run>/result.json` 與原始證據，最終候選 SHA 的結果記在該步 PR。

```powershell
npm run test:unity-runner
npm run unity:inventory
npm run unity:preflight -- --editor 'C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe' --out 'release/e02/engine-validation-new'
```

`inventory` 預設只回報觀察，成功輸出 JSON 時 exit 0；其中有 `BLOCKED_PRECHECK` 並不表示環境已就緒。`preflight` 在相同 blockers 下 exit 2。invalid arguments／工具本身不能收證是 exit 1。`--execute`／`--run` 不存在且會拒絕；不提供單靠改 JSON 就能啟動引擎的路徑。

版本探測只用 Windows PowerShell 讀 `Unity.exe` 的 PE `ProductVersion`；執行檔路徑作單獨 environment value，`shell:false`、hidden window、15 秒 timeout，不將路徑插入 shell 程式。沒有執行 `Unity.exe -version` 或需要啟用授權的操作。Windows 以外的 PE 探測明確回報工具限制，不冒稱跨平台可執行 Unity。

預檢核對：提案 schema／固定工程界線、精確 Editor version＋revision、Windows playback 目錄、ProjectVersion、固定 package manifest、保留 GLB／manifest hashes、Unity lockfile、全新 `release/e02` 子目錄與 junction／symlink 邊界。只有兩個已知素材路徑可讀；不允許契約改成讀 `.env` 或其他檔案。它沒有檢查 package lock／實際 import、全部專案程序、compile／license 或 GPU 設定；有 lockfile 就拒絕接管，沒有 lockfile也不是沒有其他程序的完整證明。

`decisionStatus:ACCEPTED` 和 decision record 的存在性只是 **宣告資料檢查**，不是經認證的人類核准。使用者接受、獨立正式 review、外部操作 scope 仍由真實授權與證據控制。預檢即使 `ready:true`，結果也只是 `PRECHECK_ONLY`，七項 engine evidence 永遠 `NOT_RUN`，`engineExecutionSupported:false`、`unityProcessStarted:false`。

測試的「ready」正例使用合成檔案、注入 file-version provider 和非正式 decision fixture。正例與負例只支持工具的拒絕／資料檢查邏輯；不是 Unity Test Runner、Editor 編譯、真正 Windows 可執行檔或人類核准。測試暫存只在本工作樹 `release/e02` 下建立，清理前驗證實際絕對目錄仍在任務範圍。

## 真正 Unity 驗證

前置：Windows；符合 package engines 的 Node；已安裝 `6000.6.4f1 / 12bfff696524` 與 Windows Mono module；可用的 Unity 授權服務；本 checkout 的 ADR 接受紀錄、固定 manifest／policy、source／素材相符。下載只限已核准必要官方固定 packages。本次既有 `Temp/UnityLockfile` 不刪除或接管，服務恢復後用全新 task-owned checkout 收證。

```powershell
npm run unity:validate -- --editor 'C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe' --out 'release/e02/engine-validation-fresh-name'
```

runner 為 `scripts/unity-validate.mjs`；工程 `unity/ChangshanLongdan`。先驗完整固定範圍／manifest／policy、所有既有工程寫入樹與 cache 的 links，再取得原子 `.e02-runner.lock`。既有 lock、非固定欄位、extra dependencies／registry、已存在輸出全部拒絕。每個 stage 開始前重新驗 links、UnityLockfile 與 compile 後凍結 source。Editor timeout 最多 15 分鐘，Player 2 分鐘；共享 Licensing Client mutex 錯誤會中止本次 child，沒有自動重試。這些資料檢查不是經認證 approval。

固定依賴先核對內附包／已保存官方 archive cache；缺 archive 才向官方 download 取得並確認**完全相同的 checksum-addressed Unity CDN**，拒絕其他重新導向。SHA-1 對照固定官方 metadata，另記 SHA-256／package manifest。實際 lock 與 PackageInfo 必須對照 policy。Unity 6000.6 實測會把內附與 registry 套件都安裝到工程的 `Library/PackageCache`，並在 `package.json` 寫入 `_fingerprint`（內建 module 不寫）；因此安裝後 manifest 除 `_fingerprint` 外須與 Editor 內附或已驗 archive 的 manifest 逐欄相同，目錄後綴須為該指紋前 12 碼，registry 包的指紋須等於固定 SHA-1；尚未逐檔核對載入套件的全部程式 bytes，保留此来源限制。不加入其他模板功能。

| 階段 | 真實執行與必要結果 |
|---|---|
| compile | 固定 Editor `-batchmode -projectPath <absolute> -buildTarget StandaloneWindows64 -force-d3d11 -quit -executeMethod Changshan.Foundation.Editor.FoundationBuild.Configure`；新 `compile.json` 讀回 revision、packages、URP／Mono／D3D11／Linear／解析度，exit 0 與 source hashes 齊備才通過 |
| Edit Mode | 同 Editor／project／target，`-runTests -testPlatform EditMode -assemblyNames Changshan.Foundation.EditTests -testResults <fresh>/tests.xml`；**不加 `-quit`**；實際 9 個固定 cases 全部 Passed |
| Play Mode | 同上，`-testPlatform PlayMode -assemblyNames Changshan.Foundation.PlayTests`；1 個固定空場景 boot case，至少跨 frame，無 skip／inconclusive／錯誤 |
| Windows build | `-quit -executeMethod Changshan.Foundation.Editor.FoundationBuild.BuildWindows`；成功 build report、零 errors、正 bytes、實際 exe／SHA-256 與設定讀回 |
| Player | 本次 build exe，windowed 1920×1080、D3D11、runId 與 fresh output；實際 120 frames、runtime settings、零報告 errors、完成的 1920×1080 PNG 與正常 exit |

完整 argv／exe／project／PID／runId／起訖／timeout／exit 在各 stage 的 `command.json`、`started.json`、`exit.json`，共用 `start.json`／`result.json`。保存 `Editor.log`、NUnit XML、build report、`Player.log`／`runtime.json`／`scene.png`。缺欄位、零測試、XML parse failure、非零 exit、compile errors、設定／package／source drift、缺／不完整 PNG 全部停止。`verified` 只在全部 postconditions 通過後標記。

新 checkout 重現程序：保存本機 candidate SHA，以 `git clone --no-hardlinks --no-checkout '<本機 E02 checkout>' '<新的空目錄>'` 建立 task-owned clone，再 `git -C '<新的空目錄>' checkout --detach '<candidate SHA>'`。從新 clone 執行上面的 Node tests／preflight／validate；Unity runner 不依賴 Web node_modules。Web 回歸另用固定 npm lock。2026-10-05 實測的兩項啟動環境限制：新 clone 的路徑要短（`release/e02/` 內層的 clone 讓 URP core 檔案超過 Windows 260 字元上限而匯入失敗），且 `tar.exe` 必須解析到 `C:\Windows\System32\tar.exe`（Git Bash 的 GNU tar 不接受 `C:\` 路徑），從 Git Bash 啟動時改用機器＋使用者的原生 `PATH`。2026-10-05 已依此程序在新 clone 完成全部 Unity stages；每個候選 SHA 仍須各自重跑，不沿用舊候選的結果。

工程內的場景、URP 設定、`.meta` 與 `ProjectSettings` 已入版控（取自一次完整建置後的狀態），新 checkout 的 compile 到 build 各階段因此不再改寫來源；URP 會在建置時重寫 pipeline asset 的 prefiltering 欄位，未入版控時會觸發 `EFFECTIVE_SOURCE_CHANGED_AFTER_COMPILE`。`npm test` 會收集 `release/` 下證據 clone 內的測試副本；本機留有這類 clone 時以 `npx vitest run --exclude "release/**"` 取得候選自身的結果。

2026-10-04 的首次實際 compile attempt 在 `release/e02/import-20261004-cdn-verified/`：Licensing channel refused、mutex 已被既有 client 持有；主控核對本輪 UUID／project／exe／父 Node 後，只停止 Editor PID 37816，exit `4294967295`，runner exit 2。沒有 `compile.json`／XML／build／圖片，失敗和 partial settings 均保存。完整結果見 [E02_ENGINE_FOUNDATION.md](./E02_ENGINE_FOUNDATION.md)。

空場景圖片將只證明引擎渲染；不證明自然遊玩、角色匯入、手感、效能達標或發布。正式同版本人類審查、合併授權及合併後確認仍未完成，E03 不開始。
