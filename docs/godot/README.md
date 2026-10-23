# Godot 原生工程

## 從這裡開發

- 匯入 `godot/ChangshanLongdan/project.godot`，Godot **4.7.2 / GDScript / Compatibility**。
- **F5 → `scenes/game.tscn` → 選難度 → To Battle / Enter / J**。Windows原生開發優先；相同工程保留單執行緒Web preset。
- `scenes/bootstrap.tscn`仍是G01診斷，不再是主要遊戲。
- G02：原17招／300兵／四難度／蒼龍／HP、無雙、連擊、KO、原評級，接上原生輸入、鏡頭、HUD、暫停、失焦、結果延遲與重試。
- G03本機候選：原趙雲GLB／貼圖與21骨蒙皮、來源17招／空中變體及移動等44組動作取樣；槍尖／trail與root仍由呈現層對位。城池、MultiMesh敵軍及龍頭仍為程序化呈現，敵軍增加肢體動作及攻擊預警。原模型載入或姿勢失敗會顯示fallback。
- 15個本機合成PCM資產包含戰鬥音樂與命中／招架／跳躍等音效，標題與暫停選單可切換音訊。按出陣開始音訊；暫停凍結、重試清除；保留靜音設定。來源音階／節奏相同，音色為Godot移植近似，未做人耳驗收。
- 粒子384、衝擊圈24、槍光點24、音效聲部12固定上限，使用獨立呈現RNG；不以特效或動畫決定戰鬥。

## 控制

WASD／方向鍵移動；J／左鍵按住連攻（0.18s）；K／右鍵蓄力（抑制普攻repeat 0.48s）；L無雙；Space跳；Shift閃避；F防禦／成功招架後J反擊。Q/E鏡頭旋轉，滾輪縮放5.5–13，R回正。Esc/P暫停，Enter繼續／開始／結算後重試。失焦自動暫停並清pending input。

標準手把：左搖桿移動，右搖桿水平轉鏡；X/□普攻、Y/△蓄力、B/○無雙、A/×跳躍／確認、RB/R1或RT/R2閃避、LB/L1防禦、Start暫停、右搖桿按下回正。採Godot原生語義enum（不是照抄瀏覽器數字index）；實體硬體仍NOT_RUN。

Web隱藏原生Quit；關閉頁面由host處理。Windows有原生Quit，不在Web呼叫SceneTree.quit。

## 規則／呈現分離

- `core/*.gd`：RefCounted純模擬；不用物理body／動畫決定傷害。
- `scripts/game*.gd`、`camera_rig.gd`：原生輸入／Node3D／MultiMesh／Camera3D／Control適配。正式主場景是真的遊戲接線，不載入Three.js或WebView。
- `data/reference.json`：由不可改的舊TS產生的17招、難度、300兵、layout、原規則常數；兩個export preset都明確包含 `data/*.json`。
- `tests/reference_cases.json`：舊TS先產生的golden traces；只做測試，不匯入遊戲payload。Godot不產生自己的expected。
- RNG跨constructor／首次開始／retry共用；格網cell-X/cell-Z/insertion順序、單一last-stamp與原事件順序都保留。

## 本機確定性檢查

Node v22.22.0可用現有type stripping讀舊TS，不新增npm依賴：

```sh
node --test scripts/tests/godot-reference.node.mjs scripts/tests/godot-execution.node.mjs
node --experimental-strip-types scripts/godot-reference.mjs --check
node --test scripts/tests/godot-presentation.node.mjs
node --experimental-strip-types scripts/godot-presentation.mjs --check
```

產生reference僅在source契約確實變更時手動 `--write`；原 `src/`、`tests/`、`public/` 與package/lock不動。

```sh
node scripts/godot-validate.mjs --mode inventory --godot <Godot-4.7.2-exe> --project godot/ChangshanLongdan --templates <4.7.2.stable-dir> --lock godot/toolchain.json --out <fresh-external-dir>
node scripts/godot-validate.mjs --mode tests --godot <Godot-4.7.2-exe> --project godot/ChangshanLongdan --templates <4.7.2.stable-dir> --lock godot/toolchain.json --out <fresh-external-dir>
node scripts/godot-validate.mjs --mode export --godot <Godot-4.7.2-exe> --project godot/ChangshanLongdan --templates <4.7.2.stable-dir> --lock godot/toolchain.json --out <fresh-external-dir>
```

交付前先freeze乾淨候選；Runner記錄HEAD／dirty狀態，仍鎖版本／exe與templates雜湊、fresh外部輸出、完整payload清單與bounded subprocess。僅明確允許bootstrap與game兩個main scene，不放寬成任意路徑；game必須在兩preset包含runtime JSON及build identity。

## 證據界線

Headless能證明source對照、引擎解析／import、場景接線與GUI訊號／合成輸入事件；**不能證明可見自然操作、手感、音畫、手把、performance或Jev自然勝利**。既有原生foreground失敗／額度不重置；本次不新增native/browser focus嘗試，也不公開部署／上傳。

最終Jev／雙平台驗收仍須自然合法操作、`win=true`、實際`ko=300`、原`rank=S`（`seconds<300`、`damage<400`），無DEV清場／補值／timeScale救援。小場fixture勝利不算。

範圍／證據索引：`G03_SPEC.md`、`G03_PROGRESS.md`；玩法基準：`G02_SPEC.md`、`G02_PLAN.md`、`G02_PROGRESS.md`。G01歷史文件／review仍為歷史工具鏈證據，不當作完整玩法移植驗收。
