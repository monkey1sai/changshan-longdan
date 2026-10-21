# Godot G01 工具鏈

這是雙平台工具鏈場景，**不是移植完成的遊戲**。只有3D方塊、可見G01範圍提示與輸入計數按鈕，沒有角色、敵兵、戰鬥或分數。

範圍：[G01_SPEC.md](G01_SPEC.md)；進度與限制：[G01_PROGRESS.md](G01_PROGRESS.md)。既有Three.js source與package/lock保留。沒有恢復使用者於`82e98e4`刪除的舊治理文件。

## 前置

Node符合根目錄package.json；Godot與模板必須完全匹配`godot/toolchain.json`。使用實際exe，不能把可變的WinGet symlink當固定執行檔。工具不下載、安裝、登入或讀credentials；不匹配就BLOCKED。

PowerShell範例（自行替換實際exe及外部證據位置）：

```powershell
$Godot = 'C:/path/to/Godot_v4.7.2-stable_win64.exe'
$Templates = "$env:APPDATA/Godot/export_templates/4.7.2.stable"
$Out = "C:/task-evidence/g01-$([Guid]::NewGuid())"
node --test scripts/tests/godot-execution.node.mjs
node scripts/godot-validate.mjs --mode export --godot $Godot --project godot/ChangshanLongdan --templates $Templates --lock godot/toolchain.json --out $Out
```

Modes：
- `inventory`：實際版本、exe／template hashes、renderer／preset盤點，**不代表測試或匯出已通過**。
- `tests`：再執行import與SceneTree測試，驗fresh run/candidate-bound JSON及非零、無failed/skipped的實際cases。
- `export`：先完成上述步驟，再輸出Windows x64、single-thread Web與各自ZIP；保存完整payload SHA-256 manifest。

`--timeout-ms`可指定1–600000毫秒，每個owned process單獨有界。PASS exit0、執行失敗／BLOCKED exit1、參數／安全路徑錯誤exit2。輸出目錄必須是**不存在的repo外路徑**；任何現有run、symlink/junction或repo內路徑均拒絕，不覆寫證據。

## 產物與身份

runner將project複製到新證據目錄的`staged-project`，驗source hashes後只在副本寫入`build_identity.json`及custom-template絕對路徑，確保匯出使用已hash的指定模板。source與cache不混，原工程不被import/export重寫。

輸出有`run.json`、每階stdout/stderr、`godot-tests.json`、`windows/`、`web/`、`windows.zip`、`web.zip`。`inventory.versionProbe`保存完整版本探測stdout/stderr/exit/timeout/error；postflight盤點在檢查前保存於`postflightInventory`，失敗也不丟棄診斷。runtime輸出`G01_READY`／`G01_COUNTER`／`G01_QUIT`的JSON，含embedded run/candidate/source/lock身分，用來綁定畫面／輸入與真正輸出包。

若checkout尚有修改，`run.json`明記dirty status及project source hashes，不能僅用HEAD當作新檔案已提交的證據；正式候選以clean commit再跑export與獨立review。GitHub實際review狀態照實，不偽造approval。

## 真實QA不等於headless

Windows需從此run的exe前景開啟、按「Verify input」看計數變化，再按Quit正常退出；記實際PID／完整payload身份與截圖／logs。Web需從loopback HTTP正確MIME提供`web/`，在子路徑iframe測WebGL2、正常啟動及同一按鈕，保存console/network／畫面／readback。不用日常登入瀏覽器、不接管未知視窗、不上傳itch。

原生Quit只在Windows顯示；Web由iframe host／使用者關頁面結束，避免Godot Web的原生退出路徑產生worker allocator錯誤。已知Windows焦點限制與未完成驗證見progress，不以Web輸入成功替代Windows PASS。

G01可見輸入計數不是自然戰鬥；最終移植仍須同版雙平台完整玩法／資產／品質／效能與人類裝置驗收，另有Jev合法操作自然300KO勝利且最高S（time<300、damage<400）的證據與預算。此工具鏈不呼叫Jev或任何付費provider。
