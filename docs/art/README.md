# AI Game Art Pipeline

本目錄把《常山龍膽》的美術工作從「把畫面做漂亮」改成可重複、可審查的製作流程。

## Vertical Slice
第一個視覺基準：**趙雲進入黃昏中的三國村莊**。先把小範圍做到一致，再擴充全遊戲。

## Pipeline
1. Visual target：先收集參考，定義玩家第一眼焦點。
2. Art Bible：角色、環境、材質、燈光、鏡頭遵守同一規格。
3. Asset intake：記錄來源、授權、格式、比例與效能預算。
4. Integration：Model → Texture/Material → Rig/Animation → LOD → Three.js。
5. Scene dressing：前景/中景/遠景、道路、建築、植被、道具。
6. Lighting/VFX/Post：先可讀性，再氣氛與華麗度。
7. Visual QA：固定鏡頭截圖，與 reference 比較，記錄差距再迭代。

## 目錄
- `art-bible/`：不可由 coding agent 任意猜測的視覺規格。
- `reference/`：合法取得的參考圖；不要提交來源不明或未授權素材。
- `asset-manifest.example.json`：素材進場紀錄格式。
- `visual-qa-template.md`：每輪截圖驗收。

## Definition of Done
功能測試通過不等於美術完成。視覺變更至少要確認：角色 silhouette、前中後景、材質一致性、光向/陰影、色彩焦點、三國辨識度、HUD 可讀性、效能與授權。