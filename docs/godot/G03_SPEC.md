# G03：角色、動作與戰鬥音畫整合

本次依據：使用者在 G02 狀態回報後要求「好，請接著做」，接續角色／敵兵呈現、動畫、音效與戰鬥特效整合。Base `d85b60aa7b96041f3c55a950e218c1a14ce43e06`；本 session 專屬 worktree `.worktrees/godot-presentation-20261022`。不以本階段代表整體移植完成。

## 可觀察成果

- 主場景使用原有、使用者授權的 `public/models/zhaoyun.glb` 複本，包含材質／貼圖與 21 骨蒙皮。失敗保留原 fallback 並回報失敗狀態，fallback 不算模型成功。
- 原 Three.js `PlayerModel`、`ZhaoYunSkin`、程序姿勢、握槍與腳底 IK 離線產生來源動作取樣；Godot 原生播放 17 招及移動／跳躍／防禦／閃避／受傷／倒地／死亡。這是既有程序動作的來源取樣移植，不是新增作者動畫片段或完整最終動畫驗收。
- 所有骨架及武器變換在呈現層；玩家位置、命中形狀／時窗、敵軍 AI、難度、KO、傷害與評級完全不變，無 root motion。
- 敵軍沿用容量 320 的 MultiMesh，增加動作肢體及攻擊預警；不實例化 300 個蒙皮角色。
- 正式戰鬥事件驅動有界刀光、火花、塵土、衝擊波及擊破碎片；重試清除，暫停不重播事件，無雙效果不決定傷害。
- 原音效類型、D 小調音階／138 BPM 音樂結構以本機合成 PCM 接入 Godot，聲部有上限、可靜音、暫停／重試有明確生命週期。不冒稱與 WebAudio 完全同音色或人耳驗收通過。

## 來源與範圍

採用既有 GLB、manifest、`src/view/player-model.ts`、`player-poses.ts`、`zhaoyun-adapter.ts`、`weapon-grip.ts`、`core/ik.ts`、`src/audio/` 與 `presentation.ts`，原檔 byte identity 保留。只新增 Godot assets/data/scripts/tests、離線 exporter／相關測試、G03 文件，最小修改現有 game/view 與 smoke 接線及操作說明。不改 `core/` 模擬或舊 source/tests/public/package/lock。

離線 exporter 的 adapter no-op 僅停用瀏覽器非同步載入；模型解析時只在記憶體移除材質／影像，骨架與網格保持原資料。實際 Godot 模型保留完整原 GLB。來源 hash、資產 hash、track 時間及骨名、取樣率、坐標基準與音訊合成方式均記 manifest；`--check` 拒絕過期來源及輸出。驗證原始綁定空間與 Godot skeleton 空間，不能只測骨名。

取樣維度：每招地面／空中兩種（依原 `pos.y > 0.25`）、3.7／7.4 移速與 idle、前滾／後閃各自保存。中間移速採取樣檔與 phase 對位，是呈現近似；披風是原程序演算的烘焙歷史，加 0.08 秒 loop 尾端銜接，並非 Godot 即時布料。額外無雙段落邊界以零 dt 取姿勢，不額外積分原披風。離取樣點的角色與槍身比較使用獨立重播來源；披風歷史以固定步進及 loop／有限數值另驗。

新增測試的呈現誤差界限為位置 0.025m、basis 向量 0.08、槍尖／trail 0.04m；原 combat 的容差不變。來源矩陣含非均勻縮放造成的 shear，不能先 decompose 再假稱 exact；adapter 須保留原蒙皮變形，或明確記錄仍未滿足的差異。

取樣保存完整3×3 basis與origin。body先以1920Hz單調取樣，額外點dt=0；來源decompose跳點以最多三輪8分細化保留兩側，再以位置0.002m／basis0.015的離散誤差篩選額外點，固定120Hz與無雙段落knots保留。此誤差只針對評估過的離散點；真正跳點的極短區間仍是取樣近似，不能宣稱連續時間全域上界。跨狀態以完整affine混合；近奇異basis取較近來源basis，避免塌縮，這也是呈現近似。

Godot一般bone pose會拆成TRS。每個mesh因此複製獨立Skin，保存不可變原bind B，以實際Godot骨矩陣A、來源完整D計算修正bind `A^-1 * D * B`；驗最終CPU蒙皮矩陣 `A * correctedBind == D * B`、原bind與來源相符、每角色隔離及Skin.changed接線。headless Dummy renderer無有效skeleton RID，實際render readback列NOT_RUN，不以CPU公式冒充GPU／可見蒙皮通過。

## 驗證與交付條件

1. 先執行未改動 baseline；再以故意缺少 G03 資源／模組的測試觀察 RED。
2. 用獨立來源時間點確認 17 招取樣、骨架／槍尖／雙手／腳底、有限數值、狀態切換、simDt=0 freeze 及重試；場景確實使用 ready 原模型。
3. 驗事件只消費一次、VFX 上限／回收、音訊非靜音／格式／聲部上限／靜音與 pause/reset；保留既有 1155 項測試，修改舊 fallback-only assertion 時保留 fallback 的失敗測試。
4. 既有 runner 的版本／hash／fresh output／stderr／report／payload 門檻完整保留，凍結候選後測試與 Windows/Web 匯出；必要獨立前置及完成 code review。
5. 本機 code/source、引擎無畫面測試、匯出、可見操作、視覺／人耳／實體手把／效能及自然 Jev 300KO/S 分別列證。G03 不重開既有 foreground 或 F1 修正預算，不做 provider／付費／發布／推送／merge。

未有可見操作、實體手把與人耳／效能證據時標 NOT_RUN。這些缺口不阻止獨立的本機實作，但不把 headless PASS 稱為最終產品 PASS。
