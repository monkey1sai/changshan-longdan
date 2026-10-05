# E03 趙雲 GLB 匯入途徑決策

日期：2026-10-05（Asia/Taipei）。`decisionStatus: ACCEPTED`（只涵蓋匯入器與套件範圍，不是 E03 的實作核准）。

## 使用者原文

- 選擇方向：「方向 1，先唯讀查 glTFast 的相容版本與相依清單，列給我核准後再下載。」
- 核准範圍：「核准 com.unity.cloud.gltfast 6.20.0（SHA-1 11ddc243…）與內建 mathematics 1.4.0、modules.unitywebrequest 1.0.0 加入政策，只下載這一個套件，不推送。」

## 為什麼是 glTFast

Unity `6000.6.4f1` 的 150 個內建套件沒有 glTF 匯入器，FBX 才是 Editor 原生格式。三個方向中選擇以官方 `com.unity.cloud.gltfast` 直接匯入既有 GLB：

- 不產生衍生資產。`public/models/zhaoyun.glb`（SHA-256 `7dccbfae…`）與 manifest 仍是唯一來源，對應 E03「保留趙雲來源」。
- 能在執行期載入並回報失敗，對應 Web 版「新角色 ready 前保留可見回退」的語意，四類負例（檔案不存在、解碼失敗、缺骨骼、缺材質）可直接重現。
- 未採用的方向：由 Blender 匯出 FBX（產生第二份資產與座標換算，需走 `mmo-asset-pipeline` 交付）；先只建期望值契約（今天不會有任何東西進到 Unity）。

## 版本與相依

中繼資料來源 `https://packages.unity.com/com.unity.cloud.gltfast`。終端機的 `curl` 被使用者全域設定明確禁止，改以 Claude Code 的 WebFetch 讀取；該工具經模型整理內容，所以 SHA-1 的正確性由 runner 在下載時驗證（官方轉址必須指向含該 SHA-1 的 CDN 位置，下載檔的 SHA-1 必須相符），不依賴整理結果。

| 版本 | 最低 Unity | 發布 | 判斷 |
|---|---|---|---|
| `7.0.0-exp.1` | 6000.0 | 2026-08-28 | registry `latest` 標籤指向它，但屬實驗版，不採用 |
| `6.20.0` | 6000.0 | 2026-08-27 | **採用**：最新正式版 |
| `6.19.0` | 6000.0 | 2026-05-19 | 前一個正式版 |

`6.20.0` 宣告的相依：Burst `1.8.30`、Collections `2.6.8`、Mathematics `1.3.3`、`modules.jsonserialize` `1.0.0`、`modules.unitywebrequest` `1.0.0`。對照本機 Editor 內建版本後，套件政策由 17 項變為 20 項：

| 套件 | 版本 | 來源 | 變更 |
|---|---|---|---|
| `com.unity.cloud.gltfast` | 6.20.0 | registry，SHA-1 `11ddc2436f976fb498cfe518dd0ef7af58654d3a` | 新增；唯一需要下載的檔案 |
| `com.unity.mathematics` | 1.4.0 | Editor 內建 | 新增 |
| `com.unity.modules.unitywebrequest` | 1.0.0 | Editor 內建模組 | 新增 |
| Burst 2.0.0、Collections 6.6.0、`modules.jsonserialize` 1.0.0 | — | Editor 內建 | 已在政策內 |

遞移相依都已在原政策內。`Packages/packages-lock.json` 依 Unity 的規則手動更新：`depth` 為離 manifest 的最短距離（此規則以 E02 由 Unity 產生的鎖定檔 17 項驗證過），項目依名稱排序且 `com.unity.modules.*` 置後。加入 glTFast 後 Burst、Collections 的 depth 由 2 變 1，`test-framework.performance` 由 3 變 2。若與 Unity 實際寫出的內容不同，runner 會以 `SOURCE_CHANGED_DURING_RUN` 擋下。

## 已知風險

- **大版本落差**：glTFast 宣告的最低版本是 Burst 1.8.30／Collections 2.6.8，Editor 內建的是 2.0.0／6.6.0。Unity 會使用內建版本，API 是否相容只能由實際編譯確認。
- **網路模組進入 Player**：`unitywebrequest` 會隨建置進入 Player。本專案只從本機檔案載入。
- **授權條款**：下載後先讀套件內的授權檔，條款不適用即停止整合並回報。
- Burst AOT 已在 E02 的建置中實際執行過（Player 含 `lib_burst_generated.dll`），不是新的工具鏈需求。

## Authorization Envelope

- **Destination**：本機 E03 工作樹與 task-owned clone；`download.packages.unity.com` 及其轉址的 checksum CDN，只取 `com.unity.cloud.gltfast-6.20.0.tgz`。
- **Purpose**：加入匯入器並以五階段 runner 確認相依可編譯、建置與啟動。
- **Allowed operations**：本機修改與提交；runner 既有的下載與驗證流程；讀取套件授權檔。
- **Data being transmitted**：公開套件名稱與版本；沒有上傳私有來源或資產。
- **Forbidden operations**：其他套件下載、push／PR、修改全域設定、付費或生成。
- **Stop conditions**：SHA-1 或轉址不符、授權不適用、任一階段失敗；最多兩輪修正。

## 尚未完成

本紀錄只決定匯入器。GLB 匯入、匯入報告、角色 prefab、可見回退、四類負例與真實渲染仍是 E03 的實作與驗收項目；policy 與 runner 的檔名保留 `e02` 前綴，內容自本步起同時涵蓋 E03。
