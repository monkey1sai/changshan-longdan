# E02 驗證入口與目前界線

目前是 **唯讀預檢工具，沒有 Unity 編譯／測試／build 功能**。下列指令已建立於本機 E02 隔離工作樹；需要 `package.json` 規定的 Node。工具不建立 Unity project、不啟動 Unity、不寫輸出、不下載相依或讀取 credentials。

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

目前實機預期 blockers：ADR 尚 `PROPOSED`、缺 accepted decision record、`unity/ChangshanLongdan` 尚未建立。這是 E02 決策／準備狀態，不是遊戲產品故障，不自動修正或開啟 Unity 下一輪。

決策接受後才新增完整 execution runner，README 再補 **已存在** 的每階段命令與原始輸出位置。目前不能把本頁 `npm` 指令當成 `compile / Edit Mode / Play Mode / Windows build` 的替代證據。
