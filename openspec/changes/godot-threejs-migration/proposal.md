## Why

使用者明確停止 Unity 路線，要求將現有 Three.js 遊戲直接移植到 Godot，且 Windows 與 Web／itch.io 都要交付。需要獨立 Godot 決策與可追溯的雙平台驗收，不能繼承 Unity 的 PASS 或把更換引擎當成美術／效能問題已解決。

## What Changes

- **BREAKING（開發路線，不變更現有公開遊戲）**：Godot 取代 Unity 作為後續引擎；Unity ADR、E00–E13 及 follow-up 留作歷史，不再是新開發的待辦順序。未完成事項不改勾、不倒填完成。
- 直接以 main `034e27052f02967d55241abae80659f2c64ded78` 的 TypeScript／Three.js 規則、資料與資產為來源，保留原 Web source、發布版本與回滾點。
- 提案採 GDScript、Compatibility renderer、單執行緒 Web，從同一 Godot 工程輸出 Windows x64 及 Web HTML5 ZIP。
- 分 G00 決策、G01 雙平台工具鏈、G02 可玩切片、G03 完整玩法、G04 雙平台品質／效能／可玩驗收；各期獨立 gate，不以核准方向自動授權全部實作或遠端操作。
- 本次 G00 僅文件與既有資源唯讀盤點；不建立 Godot runtime、不下載、不修改素材、不發布。

## Capabilities

### New Capabilities

- `godot-threejs-port`: Godot 雙平台移植、規則對照、來源保全、S01–S08 與分期交付契約。

### Modified Capabilities

無既有 `openspec/specs/` 主規格。`unity-migration-followup` 是保留的歷史 change，以前綴停用通知指向本 change，不改寫其原 requirement 或 task 歷史。

## Impact

G00 涉及 AGENTS／README／工程決策／計畫及 OpenSpec 文件。後續 G01 預計新增 `godot/ChangshanLongdan/`、Godot runner、測試及 package 流程；此處路徑是規劃不是現有功能。保留 `src/`、`public/`、package/lock、原 itch 流程及 Unity 工程不動。所有 V01–V12、S01–S08 在 Godot 新版本重新驗證；重用原始資料不重用跨引擎 PASS。無付費生成、全域 Jev 配置或外部寫入授權。
