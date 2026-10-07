# 驗收紀錄：cl-barracks-set-v1-d1

- 需求：[`docs/art/requests/cl-barracks-set-v1.md`](../../requests/cl-barracks-set-v1.md)（request_sha256 `60573438cc8eb6dfca0235fb574e48635b5651a0d8ae870d6c543fcfe7a27ecf`）
- 交付：delivery `cl-barracks-set-v1-d1`，manifest 副本 [`docs/art/deliveries/cl-barracks-set-v1-d1.json`](../../deliveries/cl-barracks-set-v1-d1.json)，鎖定清單 [`assets/art-assets.lock.json`](../../../../assets/art-assets.lock.json)
- 驗收者：Claude（coordinator，依 E10 範圍）；技術美術獨立審查：未指定（缺口）
- 遊戲端候選：`3d725df6392c6a55120ae8872c7bc25f278dcaab`（分支 `claude/e10-assets`）
- 日期：2026-10-07（Asia/Taipei）

## 檢查結果

| 檢查 | 結果 | 證據 |
|---|---|---|
| 鎖定清單／manifest／出貨檔案雜湊一致 | pass | Edit Mode `EnvironmentAssetEditTests`（4/4） |
| 節點名、三角形、材質、無貼圖、無必要擴充 | pass | 同上：360／36／288 三角形，材質 8／3／3 |
| Unity 6000.6.4f1 glTFast 執行期載入與實例化 | pass | Play Mode `EnvironmentAssetPlayTests`（4/4）：Ready，6 營房／6 屋頂／16 火盆／2 殘骸 |
| 尺寸與落點對照 `layout.ts` | pass | 牆身 12.4×4.75×14.4、屋頂 15.45×17.45、脊頂 7.57、火盆 1.15 寬，均在容差內 |
| 屋頂剖視（E09 契約） | pass | Play `CameraPlayTests`（屋簷下隱藏、離開恢復）；路線錄影 roofCutFrames 74（11.8–14.3 s） |
| 失敗回退 | pass | 缺檔／雜湊竄改／節點改名三個負例，方塊保留、不放置實例 |
| 鏡頭路線回歸（三種解析度） | pass | `record:route --mode e09`：800×600／1440×900／1920×1080 皆 `castleAssets: Ready`、unframedFrames 0、鏡頭未進建築 |
| Unity 五階段（fresh clone） | pass | runId `cadd076e-277b-4ab7-ada6-214a317de419`：Edit 150、Play 43、build、player |
| 視覺可讀性（人工） | 製作者／coordinator 目視錄影幀：營房、火盆可辨識、風格同 Web 方塊造型 | 使用者試玩通過（「是玩通過」，2026-10-07）；未經獨立技術美術審查 |

證據封存：`.worktrees/_evidence/e10/unity-3d725df/`、`.worktrees/_evidence/e10/route-3d725df/`（本機，未入 Git）。

## 限制

- 純色材質、無貼圖；無 LOD、無碰撞代理（碰撞沿用邏輯層 `ArenaLayout`）。
- 城牆、主堡、城門、階梯仍為佔位方塊。
- 效能（300 人加城池）屬 E12，本紀錄不主張。

## 回饋給美術端

- 無需修改；`target_environment` 與 `camera-route-regression` 證據已回填至 `mmo-asset-pipeline/runs/qa/cl-barracks-set-v1/v1/game/`。
