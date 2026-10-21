# G01：Godot 雙平台最小工具鏈

狀態：SPEC範圍已獨立接受；G01尚未完成，Windows前景驗收仍HELD；不是已完成遊戲。Base：`82e98e4ff47523e009e755c8d387fc5e04810cad`。

## 來源、範圍與授權

使用者已要求直接將 Three.js 移植至 Godot、Windows 與 Web 都要，並明確要求開始 G01、先 SPEC 後獨立 subagent 審查再實作。最新 main 的 `82e98e4` 由使用者刪除舊 AGENTS／docs／OpenSpec；本工作沿用目前來源與仍有效的直接需求，不還原已刪除治理條款，不將歷史缺口偽填 GitHub APPROVED。

本次只建立最小 Godot 工程、測試／匯出 runner、完整輸出包與可重現證據。不移植戰鬥或變更原 Three.js、角色／美術來源、評分、相依 lock、Unity 工程。沒有 push／PR／merge／公開發布／provider影像傳送或付費授權。

最終完整移植仍必須保留原有17招、300兵、四難度、來源與tip/tipBase、可見fallback，並有同版 Windows／Web 的完整玩法／品質／效能與人工視聽／手把驗收。另必須兩平台各至少一場 Jev 合法可見輸入自然破關、實際300KO與既有最高S（battle time<300秒、damage<400），保留決策／執行／影片／結果與預算；不改分、不用DEV注入／改速／人工代打。這些是後續移植完成條件，不是G01空場景PASS。

## 實作決策

- 固定現有 Godot `4.7.2.stable.official.ed1daf0bf`，GDScript、Compatibility／`gl_compatibility`、Windows x64及single-thread Web，原Web保留。
- 一個最小可辨識3D場景：地面、方塊、相機／光照、清楚標示G01工具鏈／非完整遊戲的UI，按鈕只增加可見計數及輸出marker，驗真實輸入，不虛構角色／敵兵／勝利。
- 不新增npm依賴；使用Node built-ins及Godot內建SceneTree測試。重用既有測試／artifact的驗證模式，不引入Unity套件／runner耦合。
- 已安裝模板的version／必要檔案hash需實際重讀；CLI存在不等於測試、render或匯出通過。正式來源資訊與hash記錄在toolchain lock，未知不填PASS。

## 檔案與介面

允許新增：
- `godot/ChangshanLongdan/project.godot`、`export_presets.cfg`、`scenes/bootstrap.tscn`、`scripts/bootstrap.gd`、`tests/smoke.gd`及必要Godot生成的script UID。
- `godot/toolchain.json`：精確版本、executable／模板hash與官方來源；不放個人路徑或credentials。
- `scripts/lib/godot-execution.mjs`、`scripts/godot-validate.mjs`、`scripts/tests/godot-execution.node.mjs`及窄測試fixture。
- `docs/godot/G01_SPEC.md`、`G01_PROGRESS.md`、`README.md`：本次規格、TDD／風險／審查與可重現指令。
允許修改：`.gitignore`只忽略Godot import cache及生成輸出。其餘既有source、資產與dependencies不動。

API：
- `inspectGodot({executable, project, templates, lockPath}) -> Promise<Inventory>`。
- `validateGodot({mode, executable, project, templates, lockPath, output, timeoutMs}) -> Promise<RunResult>`；mode=`inventory|tests|export`。
- CLI：`node scripts/godot-validate.mjs --mode <mode> --godot <exe> --project <dir> --templates <dir> --lock <json> --out <new-external-directory>`。

Inventory必含ready、blockers、實際版本／exe hash／template version及必要檔案、project／renderer／preset設定。RunResult必含runId、candidate身份（或明記dirty content manifest）、mode、起訖、exit／timeout、測試數與狀態、完整artifact檔案樹bytes/SHA256、source/toolchain身分。inventory PASS只表示盤點，不暗升為tests/export PASS。

## 硬性驗證與停止條件

1. 先寫Node測試看RED，再實作最小GREEN，證據輸出repo外，不覆寫舊run。測試必須涵蓋缺exe、錯版／hash、缺或錯templates／檔案、輸出已存在／在repo內／路徑symlink、timeout／非零exit、缺／錯runId／陳舊報告、零／失敗／跳過測試，以及輸出payload被改後hash不符。
2. 所有process用argument array、`shell:false`；不執行模型文字或任意shell，不讀credentials。timeout只處理本runner啟動的process，不關未知Editor。資源限制／錯誤一律非PASS並保留stdout/stderr/exit。
3. Godot import、SceneTree test、Windows與Web export分列。測試報告必有runId/candidate與正確testCount、failed/skipped=0及時間新鮮度；stdout宣稱成功或空報告不能通過。
4. 兩平台實際產物保存完整payload hash，不只Windows exe。Web以index.html命名，資源與Godot版本完整保留，驗子路徑／iframe、WASM MIME、WebGL2及console/error；不得上傳itch。
5. 可見Windows與Web正常啟動、實際按鈕互動、計數marker與正常退出／關閉保存證據；MCP smoke、headless不代替畫面／輸入。這個button不是gameplay或Jev勝利。
6. 原Web以現有locked dependencies執行`npm test`、typecheck/build及package:itch，保存原始結果；未知或失敗不算PASS，不順帶改依賴或修不相關漏洞。
7. 實作後以未參與修正的獨立Astra reviewer審查exact candidate／source/tests/raw evidence；owner接受與外部操作授權分列，GitHubreview狀態如實。既有兩輪失敗修正上限、來源保全、品質及必要人類驗收保留；不得自批或以更換工具重開同一問題額度。

## 完成判定與執行順序

- [x] 獨立實作前SPEC審查接受範圍。
- [x] runner TDD RED→GREEN與Node正負邊界測試通過。
- [ ] 同版Godot import／SceneTree tests／Windows與Web export完成，有完整logs與payload manifest。
- [ ] 前景Windows／Web UI互動及Web iframe／子路徑驗證，有版本／畫面／輸入證據。
- [ ] 原Web回歸、來源未變及完整獨立最終審查通過；任何缺項如實NOT_RUN／FAIL／HELD。

本地候選交付不等於已merge、已發布或完整移植成功；本次不自行合併／刪分支或跨入後續玩法階段。舊文件／失敗原件仍可從Git歷史與外部備份查閱，但不是目前被刪除規則的復活。
