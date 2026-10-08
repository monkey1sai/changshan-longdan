## Context

基準為 PR44 merge `805db86f67ab2be152dea8abe57ca47f4e735fb7`。Jev 僅提供 advisory 路由設定，未修復模型或變更 gameplay。現有 `public/models/zhaoyun.manifest.json` 定義 GLB／來源 hash、21 骨、最大 4 influences、29,569 triangles、3 張 2048 貼圖、1 LOD、0 authored clips、17 MoveId 及 rootMotion=false。

既有形變需求位於另一個 worktree 的 `docs/art/requests/cl-zhaoyun-deformation-v1.md`（commit `fb7e7cd7…`），保留 E12 b Player 截圖與 Web CPU 頂點診斷：fresh／bind-only 正常，idle 後大幅拉伸。這是歷史證據，本次未重新跑畫面或 CPU 診斷。`scripts/prepare-zhaoyun.py` 有 boundary holes_fill 與空間配重分支；`SkinBinding` 使用骨長 scale，Unity `CharacterAnimation.Step` 註解指出非均勻縮放／shear 與 Unity quaternion 正規化的差異。這些是定位入口，尚不是根因結論。

## Goals / Non-Goals

**Goals:**

- 用同資產、同時間與同姿勢對照，區分錯接拓撲／配重、程序姿勢與 Unity 顯示橋接的影響。
- 證據確認後只修已定位原因；資產版本化、runtime 修復分開，保留歷史與可回滾基準。
- 定義雙引擎 render、玩法保護、fallback、自然操作與人類視覺驗收，形成後續 E12 的新品質基線。

**Non-Goals:**

- 本次 spec 不修改 code／模型，不授權另一 repo 寫入、訊息傳送、外部上傳、付費生成、push／PR／merge 或 deploy。
- 不換角色設計／骨架契約、不新增 root motion／動畫 clips，不改攻擊判定、傷害、AI、camera tuning 或 E12 量測器。
- 不把 spec validation、CPU 摘要或既有不同 SHA 的測試當成修復 PASS；不開始 E12 長測或 E13。

## Decisions

### 1. 重用現有診斷能力，再補缺口

採用 existing `rig-parity.ts::textureFreeGlb`、GLTFLoader、PlayerModel、ZhaoYunSkin、C# rig／import tests 與 Unity validator。texture-free 只用於 CPU 診斷，實際 render 必須帶正式貼圖。舊 `release/skin-diagnosis/probe.ts` 先核對 hash 與內容，不直接當正式工具；補全異常 edge/triangle/influence 的區域定位與 Unity palette／vertex 比較，不另裝新依賴。

不先生成替代角色，也不直接全域平滑 weights；這兩種方式會失去原模型辨識度或掩蓋錯接面。若診斷已能證明某一路徑無異常，記錄負例並縮限後續修改。

### 2. 診斷矩陣分離資產與 runtime

固定一份輸入資產及 pose/time，分 A fresh import、B bind-only、C 一次 idle、D 連續 idle／短動作。保存 bind matrices、joint palette、mesh-local/world vertices、bone scale／rotation、索引／influences 與有限值檢查。

Web／Unity 先核對座標與 logic-display mapping，再比較；共享 rig 數值相等不代表 mesh 正確。加入未驅動來源 bind pose、局部已知配重反例及可定位錯接面，避免雙引擎共享同一錯誤而得到假 parity。所有 tolerances、抽樣規則、tiny-edge 排除及動作時間窗在候選測量前經 review 登錄；4 倍邊長及舊 p99 只作診斷，不能直接定為品質門檻。

### 3. 按既有美術協作契約交付

先由遊戲端形成可定位、可去敏的 request packet；美術製作預設交給 mmo-asset-pipeline 工程師。只有指定 workspace／engineer／資料與動作範圍後才交付需求或修改來源。本 change 準備需求不等於已送出。

若確認拓撲錯接，先修 topology 再 weights；若 topology 無問題，僅修已定位 weights。獨立 runtime 問題另做 scoped commit，不混入資產製作。delivery 保留新的 id、來源及 GLB hash、exporter/version、bone contract、technical QA；舊資產與 source 不覆寫。

### 4. 將品質與效能驗收分離

主要回歸 S01／S03／S07；S02 驗證權威 tip/tipBase 與命中契約，S06／S08 覆蓋顯示及自然操作。依 V04／V09／V12 保存各候選證據。任何可見尖三角、跨部位拉伸、衣料裂開或持續抖動都 FAIL，即使 unit/parity 通過。

候選保留技術預算上限，記錄模型／render 成本；S05 完整效能及 soak 必須在品質通過後以新 build 重跑 E12。本提案不能以品質驗收豁免效能，也不能重設已用完的 E12 correction budget。

## Risks / Trade-offs

- [共享 rig 導致同錯誤 parity] → 以來源 bind pose、局部可定位反例、完整 palette 與 render 交叉確認。
- [靜態畫面不能證明抖動] → D 階段連續錄影、逐幀 transforms 與自然操作分列。
- [修 weights 掩蓋錯接 topology] → 先定位異常面與 influence，確認順序再修。
- [換資產使舊索引失效] → 每份診斷綁定 asset hash；新 asset 重新定位，保留舊證據。
- [檔案只在 local ignored release] → 實作前指定 evidence 目的地，保存清單與 hash；沒有備份證據就不宣稱已保管。
- [必要 reviewer、來源檔或工具缺失] → BLOCKED；不以 Jev confidence、自審或 placeholder PASS 替代。

## Migration Plan

1. spec scope review：確認本修復是 E12 正式長測前的插入品質工作；不改 E00–E13 已有 gate。
2. 第一個 eligible 實作單位只做同版本診斷及 acceptance protocol；經驗證、獨立審查與相應合併門檻後再進資產／runtime 修復。
3. 版本化 delivery、scoped runtime 修復與候選 integration／品質驗收屬同一修復整合單位（tasks 第 3／4 組），在隔離工作區從新 build 做完整品質回歸；必要 render／自然操作／正式 review gate 前不得將候選資產或 runtime 合併到穩定基準。失敗保留原候選紀錄。
4. 通過品質後登錄新程式／profile／asset／build hashes，返回 E12；不沿用舊 benchmark 結果。

回滾：保留基準 commit、原 GLB／manifest／source 與鎖定 hash；資產候選不覆寫來源。已授權的後續 integration 以 scoped revert 恢復原版本，原版本仍保留已知形變狀態，不標記為修復；不 reset／clean、遠端刪除或自動回退 itch。

## Open Questions

- 原始 .blend 的受控位置與 hash 能否由指定製作端核對？目前只有 manifest 身分，未取得製作授權。
- 哪些異常面由融合／封孔而來，哪些只是配重斷界？尚需局部原始 topology 對照。
- Unity palette／GPU vertex 與同姿勢 Web 的差異是否仍有獨立原因？精確誤差允收須在測量前經獨立 review。
- 後續實作的 reviewer、證據保管位置及跨 repo 動作範圍待指定；本次提案仍 DRAFT，不視為正式實作 APPROVED。
