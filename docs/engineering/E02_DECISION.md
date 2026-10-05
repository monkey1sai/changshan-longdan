# E02 決策接受與執行範圍

2026-10-04（Asia/Taipei）使用者原文：**「方向 1，核准 ADR 與固定官方套件下載」**。

接受的提案來源為本機 `45d763b9660a72f386a873a99db6bdeb9069b06d`，base `8932ee47b1e902c1d858b9f1b4a1733657c04a8a`。接受前 ADR SHA-256 `82973499a72d046e164e25b9f863bf2e78fef57ffec9e1c9c302e0aea547f85a`；資料提案 SHA-256 `9792f602d99a1c97ad17676bad63db61e41f879352f17bb5bb6e5c4347c1bfc6`。本頁記錄真實對話授權；檔案存在本身不構成人類身分認證，也不是最終 implementation approval。

固定：Unity `6000.6.4f1 / 12bfff696524`、URP `17.6.0`、Test Framework `1.8.0`、Windows x64 Mono、Direct3D11、Linear、1920×1080、renderScale 1、targetFrameRate 60、VSync 1。工程只放 `unity/ChangshanLongdan`；保留 Web、原 GLB／manifest、單位與唯一 gameplay 位移權威，不開始 E03。

## Authorization Envelope

- **Destination**：本機隔離工作樹；已安裝固定 Editor；Unity 官方 `packages.unity.com`／`download.packages.unity.com` 及其實讀的 checksum-addressed `cdn.packages.unity.com` 回覆，必要時 Editor 正常授權服務。
- **Purpose**：建立最小工程、固定必要官方相依，執行本機 compile／Edit Mode／Play Mode／Windows build／Player 啟閉及空場景渲染收證。
- **Allowed operations**：先查已安裝 packages，再由官方來源取得固定缺包；寫本工作樹 source／ignored cache、logs、build；啟動並正常關閉本次建立的 Editor／Player。可保存本機 commit。
- **Data being transmitted**：公開套件名稱、固定版本、正常 Editor 啟動所需的服務請求。沒有私有 source tree、素材、證據、credentials 的自行上傳。
- **Forbidden operations**：新 Editor／平台、其他 registry、付費／生成、讀印授權檔或憑證、E02 push／PR／CI dispatch／merge／發布、停止未知 Unity 程序、ACL／sandbox／TLS／Git 信任修改、玩法或資產移植。
- **Stop conditions**：固定版本不可取得、非官方來源、付款／新登入要求、未知 lock、非零 exit、timeout、缺／零測試／不一致結果或未核准設定變更。保留原因与已產生證據；不自動換版或重試。

未指定的外部操作採保守預設：只做本機工程與必要官方固定下載，不推送、合併或發布。

## 套件解析界線

已安裝 Editor 的 `BuiltInPackages` 實讀 URP `17.6.0`、TF `1.8.0`。URP 所需 core／shadergraph／config `17.6.0` 均內附。此 Editor 內附 Burst `2.0.0`、Collections／Performance tests `6.6.0`，其 transitive requirement 字串是最低相容版本；實際來源與版本須由 lock 及 PackageInfo 讀回，不能把 requirement 字串當成已下載版本。

缺少且必要的官方固定相依為 Profiling Core `1.0.3`、Searcher `4.9.5`、Mono Cecil `1.11.6`。工程 manifest 明列這三項以固定解析，並加入內建 ScreenCapture `1.0.0` 作本步空場景收證。IMGUI／JSON module 由 TF 相依帶入。完整允許集合在 `unity/ChangshanLongdan/e02-package-policy.json`；不加入 AI／collab／IDE／inputsystem／timeline／visualscripting 或模板其他功能。

本機驗證與獨立 advisory review 不能替代 E02 最終 SHA 的正式人類 review、另行合併授權或合併後確認。E02 完成前不進 E03。
