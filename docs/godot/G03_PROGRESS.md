# G03 — 本機角色／音畫候選

本次目標來自使用者於2026-10-22要求接續遊戲開發。Base `d85b60aa7b96041f3c55a950e218c1a14ce43e06`，分支 `codex/godot-presentation-20261022`；只在本 session 專屬 `.worktrees/godot-presentation-20261022` 寫入。範圍及驗收界線見 [G03_SPEC.md](G03_SPEC.md)。

## 已實作

- 原趙雲GLB逐byte保留，Godot匯入21骨、原貼圖與長槍；原TS程序姿勢／雙手／腳底IK產生44組來源動作取樣（17招各地面／空中＋10種狀態）。玩家根位置、朝向與所有判定仍由原戰鬥核心決定。
- 完整affine骨架取樣＋每mesh獨立Skin bind residual保留來源shear，不以正規化骨架或放寬測試掩蓋變形；有finite／近奇異guard與失敗fallback。
- 來源decompose跳點細化，獨立off-grid、無雙分段及C5／DASH跳點附近probes；披風仍固定120Hz歷史、額外body樣本dt=0。
- 敵軍沿用320容量MultiMesh，增加腿／武器動作與攻擊前圈；城池／敵軍／龍頭仍為程序化呈現。
- 真實hit／kill等事件驅動粒子、槍光、塵土／圈及本機合成音訊。粒子384、圈24、trail24、音效12聲部固定上限；獨立RNG，不改combat亂數。
- 出陣／暫停／失焦／重試／靜音生命週期已接線；step後只消費一次事件，pause不重播舊buffer，retry清除效果並保留mute。

## 本機證據

本次證據根目錄：`C:/Repos/changshan-longdan/.worktrees/_evidence/g03-presentation-20261022/`。每次用全新子目錄，既有失敗原樣保留。

| 證據 | 結果／意義 |
|---|---|
| `baseline-pinned/` | PASS：未修改基準1155項；鎖定原4.7.2 exe/hash。先前`baseline/`用錯console wrapper被hash gate正確阻擋，沒有改lock |
| 初始Node測試 | RED：缺少exporter／模型／manifest；新增後GREEN |
| `presentation-regressions/`、`skin-space-fix/` | FAIL保留：暴露TRS丟失shear，分別971／892 fail；獨立診斷後改完整affine＋獨立bind，而非放寬容差 |
| `affine-skin/` | 3671/3677 PASS：CPU蒙皮已修正，尚有6個來源decompose跳點取樣差異 |
| `render-bind/` | FAIL保留：真實readback不可用＋上述6個取樣差異。當次binary確認headless／無有效skeleton RID；Dummy不提供實際render矩陣 |
| `adaptive-body/` | 5453/5453 PASS，stderr空；自適應取樣＋CPU資源接線 |
| `boundary-final/` | **5872/5872 PASS，0 fail、0 skip，stderr空**；原1155項加4717項呈現檢查，180組來源probes；新增中斷、真實小場命中／擊破、runtime fallback |
| `full-basis/` | 5872/5872 PASS，stderr空；補齊來源basis第三軸比較，三軸皆維持原0.08門檻 |
| `frozen-export/` | 首次乾淨候選`aca749d950e3e636c10cdf134df31f167fc4ebd2`雙平台匯出PASS，5872項；`packaged-startup.json`實際Windows包headless啟動PASS。最終測試補強後以以下新凍結證據為準 |
| Node suites | `node --test scripts/tests/godot-reference.node.mjs scripts/tests/godot-execution.node.mjs scripts/tests/godot-presentation.node.mjs`：25項；原runner guards不變 |
| 來源保護 | `git diff --exit-code -- src tests public package.json package-lock.json godot/ChangshanLongdan/core godot/toolchain.json scripts/lib/godot-execution.mjs`無差異；原combat、TS、資產及工具鏈保護未改 |

`godot-presentation.mjs --check`重播來源並逐byte檢查18個產物；`godot-reference.mjs --check`維持原combat oracle。manifest記錄全部來源hash、原inverse bind、44組時間、音訊格式及hash；音訊是原音階／138 BPM結構的PCM近似，非相同WebAudio音色。

## 凍結交付的讀回位置

候選形成乾淨本機commit後，使用同一釘選runner寫入全新 `frozen-export-final/`。最終head、dirty狀態、sourceTree／toolchain hash、測試、Windows／Web payload與ZIP均以其`run.json`及manifest讀回；若該目錄不存在、非PASS或identity不符，不能算匯出完成。獨立完成審查記在證據根目錄的`review-final.md`，必須綁定完整base/head；沒有ACCEPT不算review完成。匯出原生包的無畫面啟動另記`packaged-startup-final.json`，不冒充可見遊玩。

## 未驗及保留項目

- **NOT_RUN**：真實render／GPU蒙皮、可見玩家操作、畫面／人耳／手感、實體手把、長測與效能、兩平台Jev合法自然300KO／最高S。小場fixture只驗接線，不是自然破關。
- CPU `A * correctedBind == D * originalBind`、原bind／每角色Skin隔離／Skin.changed與SkinReference為PASS；headless Dummy的RenderingServer readback為NOT_RUN，另有明確stdout標記，沒有把它列成render PASS。
- 中間移速採walk／run band與phase對位、跨狀態混合、披風loop尾段及來源跳點極短區間為呈現近似；沒有宣稱連續時間全域幾何誤差保證。
- `title.wav`保留來源標題樂曲烘焙資產，目前沒有標題播放呼叫路徑；實際接線為出陣後的戰鬥音樂／音效。
- 原foreground焦點2＋1與舊F1 3/3預算原樣保留，未新增前台嘗試。沒有provider／付費／push／PR／merge／deploy／遠端寫入。
- 本機候選worktree與分支仍需供開發／驗收，尚未合併，保留它們及本次外置證據；主控負責後續交付。原main未知`.claude/`、`.codex/config.toml`及其他worktrees未動；無寫入subagent worktree需清理。
