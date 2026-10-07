# E10 小規模場景資產管線

更新：2026-10-07（Asia/Taipei）。`stepStatus: DONE（限定接受）`；PR [#41](https://github.com/monkey1sai/changshan-longdan/pull/41) 合併為 `d554e25`（2026-10-07），合併後確認：Web 296 tests、Unity 五階段 runId `d1c209b9-f3a5-4fc5-8a3f-0d1041951ec0`。本檔記錄範圍、設計與驗證方法；各候選 SHA 的實際執行結果記在 PR，不寫回本檔以免自我引用。

## 範圍與授權

使用者原文：「推送結案 PR、合併後開始 E10 範圍審查」（E09 結案 PR #40 合併為 `f8448b8`），接著對範圍審查的三個方向決定：A1、B1、C1。

- **A1 資產範圍**：第一批只做一棟營房（牆身與可剖視的屋頂分件）、火盆、燃燒殘骸三種；六棟營房由同一資產實例化；城牆、主堡、城門仍是 E09 的佔位方塊，留後續批次。
- **B1 製作來源**：零付費。美術工程師以 Blender 4.5.5 LTS 程序建模（方塊化造型照 Web `src/world/castle.ts` 的尺寸與調色盤），維持 `externalGenerationEnabled=false`、`spendLimitUsd=0`，不使用 Hyper3D。
- **C1 委派方式**：本 session 在 `C:\Repos\mmo-asset-pipeline` 工作區依 `$art-engineer` 流程接單製作（使用者授權寫入該工作區；該 repo 的 commit／push 另行授權），回到遊戲端匯入驗收。
- 不修改 `src/`、`public/models/`、`.blend`；不新增套件。碰撞仍由 `ArenaLayout`；鏡頭避障與屋頂剖視契約不變。

變量 V07／V08／V09／V10／V12；情境 S03／S06／S07 場景回歸。技術美術／資產審查者待指定。

## 需求與交付（依模型資產協作契約）

- 需求：[`docs/art/requests/cl-barracks-set-v1.md`](../art/requests/cl-barracks-set-v1.md)；美術工作台需求 `mmo-asset-pipeline/requests/cl-barracks-set-v1.json`（request_sha256 `60573438cc8eb6dfca0235fb574e48635b5651a0d8ae870d6c543fcfe7a27ecf`；`validate` 無 pending，`plan` 路線 `generate`）。
- 製作：`assets/raw/cl-barracks-set-v1/v1/make_spec.py` 由 `castle.ts` 的 `buildBarracks`／`roof`／`buildBraziers`／`buildWrecks` 生成 `spec.json`（57 個方塊）→ `tools/blender/build_box_assets.py`（通用：讀規格建方塊網格、純色 Principled 材質、匯出 GLB；不含遊戲專用內容）→ 三個 GLB；`tools/blender/render_preview.py` 固定三視角預覽；`tools/glb_bounds.py` 由 accessor min/max 量節點包圍盒。
- 交付：delivery `cl-barracks-set-v1-d1`（`deliveries/cl-barracks-set-v1/v1/`：`cl-barracks.glb` 25,292 B `9431e8c3…`、`cl-brazier.glb` 4,396 B `a31c49de…`、`cl-wreck.glb` 18,496 B `467f4047…`；manifest、README、`runs/qa/cl-barracks-set-v1/v1/` 的 inventory／bounds／acceptance-evidence／previews）。實測：三角形 360／36／288，材質 8／3／3，無貼圖、無 extensionsRequired、無骨架；營房牆身 12.4×4.75×14.4（矩形內縮 0.3，同 Web）、屋頂外框超出矩形 1.225 m（`BARRACKS_ROOF_OVERHANG`）、脊頂 7.57 m；火盆 1.15×1.32×1.15。`workbench assess`：製作端檢查 pass，`target_environment` 與 `camera-route-regression` 為 not_run，決定 `not_ready`——由本步的 Unity 驗收回填。美術端 `art_match` 為製作者自評（固定視角預覽對照 Web），未經獨立技術美術審查。
- 遊戲端：GLB 複製到 `unity/ChangshanLongdan/Assets/StreamingAssets/Environment/`，雜湊記於 [`assets/art-assets.lock.json`](../../assets/art-assets.lock.json)，交付 manifest 副本在 [`docs/art/deliveries/cl-barracks-set-v1-d1.json`](../art/deliveries/cl-barracks-set-v1-d1.json)；驗收紀錄在 `docs/art/acceptance/cl-barracks-set-v1/cl-barracks-set-v1-d1.md`（驗收完成時建立）。

## 設計

- **`CastleAssets`**：執行期以 glTFast（同 E03 路徑）從 `StreamingAssets/Environment` 載入三個 GLB，先核對位元組數與 SHA-256（`Delivery` 常數＝鎖定清單），解碼或實例化錯誤即 `Failed`；三者全部通過才依 `CastleGeometry` 放置：六棟營房（西側繞 y 轉 180° 讓門朝城內）、16 座火盆、2 處殘骸，並向 `CastlePlaceholders` 登記。`CastlePlaceholders.AttachAssets` 只在 `Ready` 時隱藏被取代的方塊（營房牆身與屋頂板、火盆、殘骸），城牆、主堡、階梯方塊保留；`ShowRoofs` 改驅動資產的 `barracks-roof` 節點。任何失敗保留方塊＝可見回退，並以 `CASTLE_ASSETS_<CODE>` 記錄。
- 面數／材質預算是候選上限，實測遠低於上限；不為湊額度加面數。LOD、碰撞代理與貼圖不在本批（效能驗收屬 E12）。

## 驗證方法

| 檢查 | 內容 |
|---|---|
| Edit Mode `EnvironmentAssetEditTests`（4） | 鎖定清單與出貨檔案、契約常數的位元組數／雜湊一致，交付 manifest 與鎖定清單一致；GLB JSON：營房只有 `barracks-body`／`barracks-roof` 兩個網格節點、三角形 360 ≤ 6000、材質 ≤ 8、無 images、無 extensionsRequired；火盆 36、殘骸 288 與節點名 |
| Play Mode `EnvironmentAssetPlayTests`（4） | 場景：資產載入 Ready，6 棟營房／6 片屋頂／16 火盆／2 殘骸，佔位營房與屋頂板隱藏而城牆保留；營房牆身 12.4×4.75×14.4、屋頂 15.45×17.45、脊頂 7.57（在資產自身座標系量測，場景整體有顯示旋轉）、火盆 1.15 寬並落在碰撞方格中心、牆身落地；站到屋簷下資產屋頂隱藏、離開恢復；負例：資料夾缺檔→`FILE_MISSING`、佔位方塊仍可見且剖視仍驅動方塊；竄改一個位元組→`HASH_MISMATCH`、不放置任何實例；屋頂節點改名（測試自供雜湊）→`NODES_MISSING`、不放置、方塊保留 |
| E09 回歸 | `CameraPlayTests` 的屋頂斷言改用 `CastlePlaceholders.RoofVisible(i)`（資產 Ready 時讀資產屋頂節點，否則讀方塊）並先等載入落定；`RouteRecorder` 在鏡頭路線開始前等 `CastleAssets` 落定、把狀態寫入 route.json `castleAssets`，`record:route --mode e09` 要求 `Ready`（否則 `ROUTE_CASTLE_ASSETS_NOT_READY`），三種解析度重錄 |
| 美術 | 固定視角預覽（美術端）與 Unity Player 截圖／錄影（遊戲端）；視覺可讀性由人工審查 |

## 已知限制

- 純色材質、無貼圖、無 UV；營房無燃燒變體；城牆、主堡、城門、階梯仍是佔位方塊。
- 殘骸視覺散落大於 4.4 m 碰撞矩形（同 Web），不加入碰撞。
- 無 LOD；300 人加城池的效能屬 E12。
- 美術工作台的交付檔案與新工具尚未在該 repo 提交（manifest 記錄 head 與髒工作樹項目）；`library/index.json` 項目狀態 `delivered`。
- Unity Player 五階段的 player 煙霧測試帶 `-e09NoFlow`，不建立 `CastleAssets`；資產在 Player 的證據來自路線錄製（`castleAssets: Ready`）與試玩。
- 計畫列的「重載負例」未做（執行期不提供重載）；LOD／碰撞代理不在本批。advisory 審查延後項：`Sha256`／glTFast 錯誤判定（E03 計 `Assert`、E10 不計）抽共用 helper。

## 回滾

普通 revert 本步提交即可：移除 `CastleAssets`、StreamingAssets 的 GLB、鎖定清單、交付 manifest 與測試；場景回到 E09 的佔位方塊；Web 版、`src/`、`public/models/` 與 `.blend` 未變更。美術端交付包保留在 `mmo-asset-pipeline`。
