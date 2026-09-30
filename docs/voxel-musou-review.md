# voxel-musou 對照與採用紀錄（2026-09-30）

上游：https://github.com/mike007jd/voxel-musou  
授權：MIT（Copyright (c) 2026 BubuAi）

## 結論

兩個專案都是瀏覽器 Three.js 的 musou-like，且都以大量體素士兵、固定時間步、資料驅動招式與 WebAudio 為核心。《常山龍膽》不是基礎功能落後，而是目前更集中在「單角色、單戰場、戰鬥深度與工程驗證」；voxel-musou 已往「多角色、劇情戰役、戰場導演」擴張。

## 已有能力，不應重搬

- 300 名敵兵、SoA typed arrays、空間格網與 InstancedMesh。
- N1–N6 / C1–C6、跳攻、閃避、無雙、hit-stop、擊飛與碎片。
- 攻擊 token / 包圍 AI；《常山龍膽》另已有防禦、精準格擋、反擊與疾風突。
- 手把、固定 60 Hz 模擬、WebAudio。
- HDR、DOF、bloom、調色、動態解析度。
- 程序體素角色、城池、火焰、旗幟、青龍 VFX。

## voxel-musou 目前領先／值得補的部分

1. **劇情戰役層**：Chapter I、序章、對話、目標、城門、結果流程。
2. **多角色架構**：趙雲與黃忠各自 kit、武器、招式與無雙；《常山龍膽》目前只有趙雲。
3. **戰場導演**：squad march/halt/charge、reinforcement waves、友軍、敵將、戰場事件。
4. **難度系統**：四檔難度，不只加血，而是調敵人壓力、敵將韌性與受擊代價。
5. **鏡頭遮擋處理**：boom clearance / lens clear，避免牆與近鏡碎片破壞構圖。
6. **遠程戰鬥**：弓箭、瞄準、扇射、箭雨、火箭與 projectile pipeline。
7. **內容 UI**：角色選擇、劇情文字、目標、敵將名稱/HP、章節解鎖。

## 建議優先順序

### P0：立即採用
- [x] 戰鬥鏡頭 obstacle-aware boom clearance（本分支已用 TypeScript 重寫並加測試）。
- [ ] 敵將名稱 + HP 標籤。
- [ ] 難度 profile（AI pressure / officer HP / damage / wind-up）。

### P1：形成真正「戰場」
- [ ] Battle Director：小隊進軍、停陣、衝鋒、增援波次。
- [ ] Officer entity：與普通兵分離的招式/韌性/掉落。
- [ ] Story objective state machine：目標、事件、城門、勝敗條件。
- [ ] Shu ally slots：少量友軍與敵兵交戰，製造戰線而非 300 人只追玩家。

### P2：增加內容寬度
- [ ] CharacterKit 介面，把趙雲 moves/model/musou 從 Game 拆出。
- [ ] 第二可玩角色；優先選與趙雲玩法差異大的遠程或重武器角色。
- [ ] Projectile subsystem。
- [ ] 角色選擇與章節選擇。

### P3：視覺與內容製作
- [ ] lens-clear shader，避免碎片/大型 VFX 貼鏡頭黑屏。
- [ ] 以 visual benchmark 截圖做回歸比較。
- [ ] Art Bible + reference board；若未來導入外部 GLB/PBR 資產，與目前 procedural voxel 模式做可切換品質層。

## 程式碼採用原則

不整包 vendor voxel-musou。只有在「本專案缺少、MIT 可用、能用現有架構重寫/隔離、可測試」四項都成立時採用。直接複製 substantial upstream code 時必須保留 MIT copyright/license；概念重寫仍在本文件保留來源與設計脈絡。
