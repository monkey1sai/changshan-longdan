# Three.js → Godot 雙平台遷移設計

狀態：使用者已確認設計方向並同意先進行引擎決策更新與雙平台基礎；G00 獨立 scope advisory ACCEPT_SCOPE（reviewer run `575e775d-5971-4e8c-b2f2-42c68235d0cf`）。正式 exact-head 審查／合併仍待取得；不是 runtime 或驗收證據。

## 需求、來源與授權

使用者指示：「不要用unity了, 全面改成godot引擎」、「將thress.js 移植過來」，並對 Windows 與瀏覽器／itch.io 回覆「都要」。因此來源是現有 Three.js 版，不是 Unity 版；停止規劃新的 Unity 實作。來源基準 `034e27052f02967d55241abae80659f2c64ded78`。後續使用者回覆「同意」，批准此設計方向及先進行引擎決策更新與雙平台基礎；目前僅執行首個 eligible 單元 G00。沒有 push、PR、merge、上傳 itch、付費、刪除舊工程或安裝新工具授權。

完整產品目標是同一 Godot 專案輸出 Windows x64 與 Web／itch.io，保留既有玩法，而非空場景或縮減版 demo。既有 Three.js source、公開版本、Unity source 及其失敗／驗收紀錄保留作追溯與回滾；保留 Unity 歷史不代表繼續開發或要求完成其 E12。

## 架構建議（工程師提案，非使用者已指定）

- 工程預定 `godot/ChangshanLongdan/`；GDScript、Compatibility renderer；先採 Web 單執行緒，Windows 使用同一套玩法與渲染基線，不先分叉 Forward+。若 300 人成本不符門檻，保存結果並另審最佳化方案，不降低兵力宣稱完成。
- 本機 `godot --version` 實際回傳 `4.7.2.stable.official.ed1daf0bf`。此為可用 CLI 證據，非版本鎖定、export templates、編輯器啟動或匯出成功；開始實作前固定 executable/template 版本、來源與 hashes。
- Godot 4 C# Web export 目前不支援，故不採 C#；不引入非官方 TypeScript runtime。TypeScript 規則以 GDScript 重實作，保留原 TS 作對照測試 oracle。
- 資料／規則／顯示分離：`Battle`、玩家狀態機、命中、敵群 SoA、Director 與難度不依賴 SceneTree 決定結果；Node 顯示層消費戰鬥事件，不反向裁決傷害。
- meters、seconds、radians 及原 facing 公式保留；用已知點測試 Godot camera／模型朝向、骨架、mesh winding，禁止猜測整體 Z 反轉。位移只由 gameplay controller／招式曲線決定，動畫不再疊加 root motion。
- 不把 renderer 的固定 physics tick 直接當作原作時間語義；先記錄原 Battle.step、輸入緩衝、hit-stop、pause、animation 與 unscaled time 契約，再用 30/60/120 Hz 對照。RNG、數值精度與命中邊界明確驗證，不宣稱跨引擎天然 bit-identical。

## 移植對照與重用界線

| 現有來源 | Godot 接替方式 |
|---|---|
| `src/combat/`、`src/entities/`、`src/core/` | 移植規則、資料、RNG 與 SoA；重用既有測試案例／trace，不保留 Three.js runtime 相依 |
| `scripts/lib/*-parity.ts`、`tests/` | 重用 combat/hit/crowd/camera/reaction/rig/director/presentation fixture 語義；明確記錄 source 與 tolerance；禁止改 golden 迎合錯誤實作 |
| `public/models/zhaoyun.glb` 與 manifest、`src/view/zhaoyun-adapter.ts` | 原 GLB／來源 hashes 不變；Godot import adapter 驗骨架、握點、tip/tipBase、動畫與 fallback；GLB 匯入成功不等於品質通過 |
| `src/view/soldier-view.ts` 的 InstancedMesh | 評估 MultiMeshInstance3D 實作原有分件／程序動畫；先驗證材質、instance flash、包圍盒／剔除與 Web 成本，不以靜態 instancing 宣稱任意骨架群集可行 |
| `src/world/layout.ts`、castle、voxel-builder | 保留單一 layout 資料來源，生成 Godot mesh 與碰撞；程序場景不是 Unity 場景搬遷 |
| `src/view/camera-*`、roof-cutaway | 移植鏡頭與 clearance/cutaway 規則，保留邊界測試與真實渲染驗收 |
| `src/presentation.ts`、`src/fx/`、`src/render/` | 以 Godot mesh／shader／粒子／事件 sinks 重實作，先維持原風格與回饋，不趁換引擎改美術方向 |
| `src/audio/` WebAudio 合成音效／音樂 | 另評估 AudioStreamGenerator 或可追溯離線合成素材；音色、節拍、hit-stop 與播放延遲需兩平台實聽；不假定可直接使用 AudioContext |
| `index.html`、`src/ui/`、`src/core/input.ts` | Control UI、InputMap／gamepad、原中英文字串／字型、三出陣入口、難度、暫停、失焦、結果與重試 |

不重生或修改模型／材質／骨架／動畫來源；若實際匯入需要資產修復，依 `docs/art/asset-collaboration.md` 委託，不把歷史形變缺口當作換引擎自動解決。

## 交付與驗收

- 同一 code/profile/asset 版本的 Windows 完整可執行包及 Godot HTML5 ZIP；各自保存完整 payload hashes、引擎／template／瀏覽器版本、輸出指令、raw logs 與測試結果。
- Web 以 `index.html` 匯出，測 localhost 及可代表 itch iframe／子路徑的環境；相對資源載入、WASM MIME、WebGL2、焦點／pointer capture、全螢幕、首次互動解鎖音效、背景切回、儲存可用性及錯誤提示均需驗證。不沿用 Vite 的 `base:'./'` 設定冒充 Godot 匯出設定。
- 重用 S01–S08 的完整驗收情境：17 招、判定／多段去重、持槍與腳植、受擊／起身、300 兵、鏡頭／屋簷、可見資產回退、四難度與自然勝敗；不能把 20 人初期切片當最終交付。
- 效能沿用既有可比較門檻與 20→50→100→200→300 分級／固定 seeds／長測，為每平台先審量測方法與支援矩陣。瀏覽器拿不到 GPU／VRAM 等數據時明記 UNKNOWN／BLOCKED，不能填零、借用 Windows 結果或暗刪門檻；若需變更驗收契約，另提出明確差異供審查。
- unit/headless、真實 render、自然操作、實體手把與使用者視聽確認分開；build、截圖及模型評分都不能替代完整遊玩。Godot 與新資產證據不能沿用 Unity 的 PASS。

## 分期與必要決策

1. **G00 決策／基準**：確認本設計、獨立審查替代引擎決策；更新 AGENTS／README／execution plan 路由及新 Godot SPEC/tasks，明示 Unity follow-up 已停用／被取代的範圍，不勾完成舊任務，不刪歷史缺口；鎖版本、template、來源 hashes 與測試基準。
2. **G01 雙平台基礎**：最小 Godot 工程、CLI runner、正負邊界測試，實際 Windows／Web 匯出與前景啟動。空場景只驗工具鏈。
3. **G02 可玩切片**：原趙雲、原場景局部、移動／鏡頭／完整輸入與一招對一敵，先驗規則、座標、持槍、回退及雙平台成本。
4. **G03 玩法完整性**：全部招式、受擊、無雙、敵群／Director、四難度、完整地圖、UI、VFX、音樂音效與流程；逐模組做 TS parity 與真實玩法驗收。
5. **G04 雙平台交付**：全部 S01–S08、分級效能／長測、Windows 包及 Web iframe 相容性、使用者體驗確認。

每期只在已授權範圍內執行；適用測試、實際證據、exact-head 獨立審查、必要人類批准、另行 merge 授權與 post-merge 檢查齊備才進下一實作期。沿用適用的兩輪失敗上限，不因換工具或分支重設同一問題預算。公開 itch 上傳另需授權。

目前只完成來源盤點、CLI 版本讀取與 G00 文件準備，沒有 Godot 工程、玩法或雙平台匯出。唯讀列舉 `C:/Users/IOT/AppData/Roaming/Godot/export_templates` 為空；匹配模板取得需要另行下載授權。G00 不以此宣稱 runtime PASS；G01 開始前仍需鎖定版本特定契約與模板來源。原 Unity E12 兩輪修正額度已用完，換引擎不自動重開同一量測問題的額度。

## 來源

- 本輪使用者指示與來源 SHA 如上；`src/entities/battle.ts`、`src/entities/player.ts`、`src/view/soldier-view.ts`、`src/audio/`、`package.json`、`scripts/combat-parity.mjs`。
- `docs/engineering/MUSOU_VARIABLES.md`、`musou-profile.proposed.json`：保留基準／提案／實測分離及 S01–S08；提案 JSON 尚未接入 runtime。
- `docs/engineering/E02_UNITY_ADR.md`：歷史 ACCEPTED 決策待新決策正式替代，不原地抹除歷史。
- Godot 官方 Web export： https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html （WebGL2/Compatibility、C# 限制、single-thread、index.html）；stable 文件仍須與最終鎖定版本核對。
