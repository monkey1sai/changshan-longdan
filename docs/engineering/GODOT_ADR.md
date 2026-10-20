# Godot 引擎替代決策（G00）

## 狀態與依據

`directionStatus: USER_APPROVED`；`formalIndependentApproval: PENDING`；`deliveryStatus: NOT_MERGED`。使用者先要求不再使用 Unity、全面改 Godot，明確以 Three.js 為移植來源、Windows 及 Web 都要，並對 [完整設計](./GODOT_MIGRATION_DESIGN.md) 及先進行決策／雙平台基礎回覆「同意」。

這是新方向核准，不是工具安裝、遠端寫入、正式審查或品質已通過。scope advisory reviewer run `575e775d-5971-4e8c-b2f2-42c68235d0cf` 接受 G00 文件範圍；其結果不是 GitHub APPROVED。

## 決策

- 停止新的 Unity 開發；直接以 main `034e27052f02967d55241abae80659f2c64ded78` 的 Three.js／TypeScript source 作基準。新 Godot 工程預定 `godot/ChangshanLongdan/`，Windows x64 與 Web／itch.io 來自同一 source/profile/assets。
- 採 GDScript、Compatibility renderer、單執行緒 Web。不採 Godot C#（Godot 4 Web export 不支援）、非官方 TS runtime、Unity 中轉或先只完成 Windows 再補 Web。效能目標仍須實測，不能以語言／引擎選擇宣稱達標。
- 戰鬥規則、資料、事件、顯示分離；保留 17 招、300 兵、四難度、原 controller 位移權威、模型來源及 tip/tipBase、可見載入 fallback。不改候選 profile 的 runtimeConnected，不新增平衡、美術方向或付費生成。
- 保留 Three.js、Unity 工程、發布紀錄、資產及失敗證據。舊 E02 ADR 和 Unity follow-up 加歷史通知而非重寫 ACCEPTED／task 歷史；不要求完成舊 Unity E12。品質缺口在 Godot 重新驗證，舊 PASS 不移植。
- 原 Unity E12 已用完的兩輪同一問題預算不重設；Godot 不執行該 WMI／PDH 恢復方案。若新平台量測需要實驗，G01/G04 必須先審查具體新問題、方法、額度及停止條件，不能借改名重跑舊問題。

## 版本與本機盤點（僅觀察）

- `godot --version`：`4.7.2.stable.official.ed1daf0bf`。
- WinGet link 解析至 `C:/Users/IOT/AppData/Local/Microsoft/WinGet/Packages/GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe/Godot_v4.7.2-stable_win64.exe`。
- 當前 executable SHA-256：`ab1824f85bfd8e0e4128182c000c4003a3e042245b2967848d089b2a04b22424`。hash 只識別本機檔案，尚未比對下載 archive 與官方 checksum／供應鏈。
- 已列舉 `C:/Users/IOT/AppData/Roaming/Godot/export_templates`：空目錄。沒有安裝或匯出嘗試；G01 缺 matching templates。下載需另取得範圍授權，保存固定版本官方 URL／archive hash／checksum 及實際模板版本。
- G01 優先驗證既有 4.7.2；只有來源、版本、template 契約鎖定且實際 import／Windows／Web 測試通過，才可標工具鏈驗證通過。CLI 存在不等於全部可用。

## 執行與退出

G00–G04 順序見 [tasks](../../openspec/changes/godot-threejs-migration/tasks.md)，規範見 [SPEC](../../openspec/changes/godot-threejs-migration/specs/godot-threejs-port/spec.md)。G00 僅文件，沒有 Godot 工程、compile、render、遊玩或 export。每期有獨立正式審查、具體 merge 授權、實際 remote merge 與 post-merge／cleanup 才 DONE。G01 不因使用者選定方向或 OpenSpec artifacts complete 而提前開始。

回滾以普通 revert 撤回該期變更；本 ADR 回滾不自動授權恢復 Unity 開發或修改線上包。發布 itch、傳送素材、安裝工具、付費及刪除其他 worktree 均另授權。

## 官方參考及限制

- [Godot 4.7.2 release](https://godotengine.org/article/maintenance-release-godot-4-7-2/)：線上搜尋支持版本／commit，未代替本機 archive checksum 比對。
- [Web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)：Compatibility/WebGL2、GDScript、單執行緒、index.html 與 hosting/音效限制；G01 須對鎖定版本核對。
- [MultiMesh](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html)：整批剔除而非逐 instance；需空間分批與 Web 實測，不以 renderer instance 數當實際可見數。
