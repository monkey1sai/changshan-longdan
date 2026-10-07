# 需求 cl-barracks-set-v1：營房、火盆、殘骸（E10 第一批）

需求版本：1。狀態：DELIVERED（美術端 delivery `cl-barracks-set-v1-d1`）→ INTEGRATING（遊戲端 E10）。對應美術工作台需求：`mmo-asset-pipeline/requests/cl-barracks-set-v1.json`（request_sha256 `60573438cc8eb6dfca0235fb574e48635b5651a0d8ae870d6c543fcfe7a27ecf`）。

## 目的與責任

- 目的：E10（小規模場景資產管線）以共用佈局 `src/world/layout.ts` 的尺寸替換 Unity 驗證場景中 E09 的佔位方塊；驗證來源→Blender→匯出→Unity 匯入→manifest→視覺 QA 的管線。
- 使用場景：Unity 驗證場景（六棟營房由同一資產實例化、16 座火盆、2 處燃燒殘骸）；鏡頭避障與屋頂剖視的契約不變（屋頂是獨立節點，由遊戲端隱藏）。
- 優先順序：E10 第一批。整合與驗收負責人：Claude（本 session，遊戲端）；製作：同一 session 依 `$art-engineer` 流程在 `C:\Repos\mmo-asset-pipeline` 製作（使用者決定 A1／B1／C1）。

## 風格與參考

風格化三國，延續 Web 版 voxel 城池：方塊化體積、線性 sRGB 調色盤（`src/world/castle.ts` 的 `P`／`GLOW`）；參考 `docs/art/art-bible/ENVIRONMENT.md`、`MATERIAL.md`。使用權：原創程序建模，無第三方素材。資料分級 internal。可接受差異：殘骸散落為固定種子程序排列；營房只有一般版本（無燃燒變體）。

## 引擎與技術

- Unity 6000.6.4f1、URP 17.6.0、glTFast 6.20.0；GLB；公尺、+Y 上、+Z 前；原點在腳印中心 y=0；Web 右手座標直接對應 glTF，由 `LogicDisplayMapping` 鏡射到顯示空間。
- 尺寸：營房牆身 12.4×4.75×14.4（矩形 13×15 內縮 0.3）、屋頂外框超出矩形 1.225 m、脊頂 7.57 m；火盆 1.15×1.32×1.15；殘骸約 5.5×1.3×5.8。
- 材質：純色 PBR，無貼圖、無 UV；自發光炭火／餘燼。骨架／動畫：不適用。碰撞：不交付（邏輯層 `ArenaLayout`）。LOD：不交付（E12 再議）。
- 預算：營房 ≤ 6,000 三角形、火盆 ≤ 600、殘骸 ≤ 900；材質 ≤ 8；效能門檻屬 E12，本步只量實際值。

## 驗收

- 場景：Unity 驗證場景；鏡頭：E09 鏡頭路線（`record:route --mode e09`，三種解析度）；操作：出陣後沿路線行走、穿過營房屋簷。
- 必須保留：`ArenaLayout` 碰撞、`CameraClearance`／`RoofCutaway` 行為、E03–E09 Play 測試。
- 證據：載入成功（三個 GLB、節點名稱）、實例數（6／16／2）、包圍盒對照 layout（±0.1／±0.05）、屋頂節點可隱藏、鏡頭路線三種解析度通過；載入失敗保留佔位方塊（可見回退）。
- 失敗標準：任一 GLB 載入失敗或雜湊不符、尺寸超出容許、屋頂無法獨立隱藏、鏡頭路線檢查失敗。

## 交付與授權

原始檔：`mmo-asset-pipeline/assets/raw/cl-barracks-set-v1/v1/{make_spec.py,spec.json}`；執行用檔：`deliveries/cl-barracks-set-v1/v1/*.glb`（複製到本 repo `unity/ChangshanLongdan/Assets/StreamingAssets/Environment/`，雜湊記於 `assets/art-assets.lock.json`）。外部服務：無；付費額度：0（`externalGenerationEnabled=false`、`spendLimitUsd=0`）；私有資料傳輸：無。
