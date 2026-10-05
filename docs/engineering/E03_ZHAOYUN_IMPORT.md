# E03 趙雲來源保留與執行期匯入

更新：2026-10-05（Asia/Taipei）。`stepStatus: AWAITING_REVIEW`（草稿 PR #20；未取得正式審查）。本檔記錄範圍、來源核對、設計與驗證方法；各候選 SHA 的實際執行結果綁定該 SHA 另行記錄，不寫回本檔以免自我引用。匯入器與套件決策見 [E03_IMPORT_DECISION.md](./E03_IMPORT_DECISION.md)。

## 範圍與授權

使用者原文依序為：「授權合併 PR #15，合併後確認並開始 E03」、核准 glTFast 6.20.0 與內建 mathematics、unitywebrequest 加入政策、「方向 1，照這個範圍開始 E03 實作，不推送。」

範圍：在 Unity 執行期載入既有趙雲 GLB，新角色通過契約前顯示可見回退；四類負例；glTF 轉 Unity 座標的已知點驗證；保留長槍 tip／tipBase 的本地座標意義；Player 真實渲染。不含招式、輸入、程序式姿勢與 IK（E04、E06），不修改 `public/models/`、`src/`、`.blend`，沒有付費或生成。

變量 V04／V09／V12；情境 S07（缺檔、解碼失敗、骨架錯誤、材質缺失、重新載入）與 S03 的骨架／握點前置。技術美術審查者待指定。

## 來源核對

| 來源 | 大小 | SHA-256 | 關係 |
|---|---|---|---|
| 使用者原始 `趙雲.blend`（E00 保存副本 `zhaoyun-original-copy.blend`） | 14,046,009 | `c8dff5bf7d43c04040a5f661b64a8702b5bedaf5fb2f69debd10a626dcc901a9` | manifest `source.sha256`；原檔未修改 |
| 綁骨後副本 `zhaoyun-rigged-copy.blend` | 14,017,996 | `736ef253dde7e82621acaee2076e4f99e79a852284debc3debc4b03db23df5cf` | `scripts/prepare-zhaoyun.py` 於 Blender 4.5.5 的輸出副本 |
| 重新匯出副本 `reexport/zhaoyun-rigged-copy.blend` | 14,017,167 | `91205115583e9f1c495b7def81318079422454d232be0ae11f900a86f47a490c` | E00 重現匯出；兩份 `prepared-audit.json` 數值相同 |
| `public/models/zhaoyun.glb` | 3,706,788 | `7dccbfae4b61280889a7be98370692143898c3eeef8dcd55dfa36ad4b4248a33` | manifest `export.sha256` |

三份 `.blend` 副本的大小與雜湊和 `e00-baseline.snapshot.json` 一致（保存在 E00 工作樹被忽略的 `release/e00/20261002/preserved/`）。授權依 manifest：使用者聲明自行製作並授權整合，未加入第三方素材。

GLB 實讀結果：29,569 三角形（身體 27,710、長槍 1,859）；21 根骨；材質 `MAT_ZhaoYun`（底色、金屬粗糙、法線三張 2048 內嵌 JPEG）與 `MAT_ZhaoYunShaft`（只有係數），皆不透明、雙面；無動畫、無必要擴充、無外部 URI。長槍 `SM_ZhaoYunSpear` 是**未綁骨的獨立根節點**，網格沿本地 +Z 從 -1.05 到 2.7 m；未經姿勢驅動時平放於原點，握在手上屬 E06。

## 設計

- **單一來源**：`Assets/StreamingAssets/Characters/zhaoyun.glb` 與 `public/models/zhaoyun.glb` 位元組相同（Git blob 相同，不增加儲存）。Vitest、Node 與 Edit Mode 測試都檢查兩者一致且雜湊等於 manifest；runner 另驗 Player 內的副本。
- **執行期匯入**（`ZhaoYunCharacter`）：回退從第一幀可見；glTFast 讀入後在**隱藏容器**實例化，通過 `ZhaoYunContract`（21 根骨名與順序、材質名稱、3 張 2048×2048 貼圖、三角形數、身體站在 y=0 且高 1.8495 m、長槍 Z 範圍）且 glTFast 沒有記錄任何錯誤，才顯示並隱藏回退。失敗即丟棄實例、保留回退，並以 `CHARACTER_LOAD_FAILED <原因>` 記錄：`FILE_MISSING`、`DECODE_FAILED`、`IMPORT_ERRORS`、`INSTANTIATE_FAILED`、`REQUIRED_BONE_MISSING`、`SKELETON_MISMATCH`、`MATERIAL_MISSING`、`TEXTURE_MISSING`、`MESH_MISMATCH`、`BOUNDS_INVALID`、`WEAPON_MISMATCH`。glTFast 對部分失敗（例如圖片格式無法辨識）仍回報成功，所以有任何錯誤就判失敗；JPEG 標頭完好但內容損毀時 glTFast 不檢查 `LoadImage` 也不記錄錯誤，因此另以貼圖尺寸檢查。重新載入時舊模型保留到新模型通過驗證，重載失敗則保留舊模型；較新的載入會取代未完成的舊載入。模型上場後，寫報告失敗只記錄錯誤，不再撤下模型。glTFast 的載入訊息收進報告；其 JSON 解析失敗路徑會另外直接寫主控台。
- **座標**：glTFast 將 glTF 的 X 取負。glTF 角色面向 +Z、左側在 +X；Unity 面向 +Z、左側在 -X，所以角色的左右不會被鏡射。長槍本地 Z 不受影響，tip（z=2.7）與 tipBase（z=1.25）沿用 Web 的 `spearTipZ`、`spearTrailBaseZ`。**後續注意**：Web 世界座標若以相同數值放進 Unity，畫面會是左右鏡像；E04 移植位移與鏡頭時需決定是否同樣取負。
- **Player 材質**：執行期材質的 shader 變體必須被建進 Player。Configure 以同一個 glTFast 材質產生器載入 GLB，把兩個材質（清除貼圖參照）存到 `Assets/Character/Resources/ZhaoYunShaderVariants/`；Play Mode 測試比對執行期材質與這些佔位材質的 shader、關鍵字與 render queue 必須相同。
- **只保留執行期匯入**：`GLTFAST_EDITOR_IMPORT_OFF` 讓 glTFast 不在編輯器另外匯入 StreamingAssets 內的 GLB（其 `.meta` 為 `DefaultImporter`）。
- **回退與場景**：`Assets/Character/ZhaoYun.prefab` 的回退是三個 URP Lit 幾何體（身體、頭、沿 +Z 的長槍），不是 Web 的程序式 voxel 角色。驗證場景加入角色（3/4 角度朝向相機）、主光與地面。
- **截圖閘門**：Foundation 新增 `CaptureGate`；角色載入期間持有，截圖等到角色進入最終狀態（上限 20 秒），`runtime.json` 的 `pendingCaptureGates` 必須為 0。截圖改為只在 Player 執行，編輯器 Play Mode 測試不再寫入 runner 目錄或呼叫結束。
- **Player 報告**：自動載入的角色在 Player 驗證執行時寫 `character.json`；runner 要求 READY、無失敗碼、來源雜湊與位元組數、骨名順序等於直接讀 GLB 的結果、三角形數、長槍範圍與 tip、有限的世界座標、回退已隱藏、模型可見、glTFast 錯誤為 0。

## 驗證方法

| 檢查 | 內容 |
|---|---|
| Vitest | 23 files／228 tests（新增 GLB 副本一致性） |
| Node runner | 65 項；新增測試清單依類別計數、`character.json`、截圖閘門、GLB 骨名、副本一致性的正負例 |
| Edit Mode | 原 11 項＋`CharacterSourceEditTests` 5 項：副本位元組、契約對 manifest、GLB 骨名／材質／內嵌資料、佔位材質 shader、prefab 回退 |
| Play Mode | 原 1 項＋`CharacterImportPlayTests` 14 項：真實載入只在通過後取代回退（載入中只有回退在渲染）、已知點座標（21 根骨的本地位置與身體不對稱的 X 範圍）、長槍 tip／tipBase、材質變體一致、缺檔、截斷、等長改名 `hand_l`、等長改名 `MAT_ZhaoYunShaft`、內嵌圖片標頭損毀（`IMPORT_ERRORS`）、缺少全尺寸貼圖（`TEXTURE_MISSING`）、較新載入取代未完成載入、重載失敗保留舊模型、重新載入只留一個模型、場景中的角色變為 READY |
| Windows build／Player | build 內的 GLB 副本雜湊；Player 的 `character.json`；截圖等角色就緒後拍攝 |

離線編譯檢查：以 Unity 內附編譯器與上一次 Unity 實際使用的參考組件，先編譯 6 個 C# 組件確認沒有錯誤，再進入 Unity。產生檔（`.meta`、佔位材質、prefab、場景變更）取自一次計畫內的 Unity 執行，該次在 compile 後依預期以 `SOURCE_CHANGED_DURING_RUN` 停下，compile 本身 exit 0 且設定與 20 個套件讀回通過。

## 已知限制

- 回退是簡單幾何體，不是 Web 的 voxel 回退；E03 只要求可見。
- 長槍未接在手上，角色沒有姿勢或動畫（E04、E06）。
- 佔位材質只保證本資產用到的關鍵字組合；之後的資產若用到發光、遮蔽等功能需重新產生。材質變體的一致性在編輯器內比對；Player 端沒有開啟 Strict Shader Variant Matching，變體若被剝除會以最接近的變體顯示而不報錯，仍需以截圖人工確認。
- glTFast 的文件範例與匯出組件也被建進 Player（約 116 KB），用不到但無害。
- Player 在執行期解碼三張 2048 貼圖，載入時間與記憶體尚未量測。

## 回滾

普通 revert 本步提交即可；Web 版、`public/models/` 與 `.blend` 未變更。glTFast 套件政策的回滾另見 [E03_IMPORT_DECISION.md](./E03_IMPORT_DECISION.md)。
