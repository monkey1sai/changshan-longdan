# Jev 讀圖實玩與 Web 發布驗證

本工具是開發／驗收端的讀圖決策器，不隨 Web 遊戲發送，也不在玩家瀏覽器存放 API key。遊戲維持既有戰鬥、難度與評分規則。

## 使用方式與邊界

`scripts/jev-vision-player.py` 接收一張核准遊戲頁面的截圖及可見操作描述，使用固定 `jev-1.14.0` 回傳下一個有界 action ID。執行器須先確認截圖只含遊戲，再讀回當前 UI，將 ID 映射到固定、限時的真實鍵盤／滑鼠操作；不得執行模型文字、shell、`window.__game` 或其他隱藏狀態操作。

```powershell
python -B scripts/jev-vision-player.py --image <game-frame.png> --observation <observation.json> --out <session-directory>/decision-000.json --authorize-game-image
python -B -m unittest discover -s scripts/tests -p test_jev_vision_player.py
```

`observation.json` 僅包含三個欄位：

```json
{
  "goal": "Use legal visible controls to win at the existing highest S rank",
  "visible": "Current game HUD and observed controls only",
  "actions": {"attack": "Hold left mouse for at most 6 seconds, then pause", "inspect": "Remain paused; request a fresh observation"}
}
```

固定 HTTPS endpoint 為 `https://api.typesafe.ai/v1/systemone`。憑證僅由既有 `TYPESAFE_API_KEY` 環境／Windows 使用者 provider 取得；不得輸出、放入工作區或前端。送出 image 須已有明確授權；不傳帳戶介面、私有檔案或程式碼。功能仍屬 [TypeSafe experimental images](https://docs.typesafe.ai/images)，模型選擇的合法動作也可能無效，confidence 不代表破關機率。

同一任務固定使用同一 session directory；不得藉更換目錄重設預算。上限為 80 次請求、2,000,000 input tokens。每次請求在網路動作前持久預留 64,000 tokens（[官方一般 context 上限](https://docs.typesafe.ai/models)），成功後也不退回預留額度，因此可能較早停止。session lock 排除並行；未完成 attempt、模型不符、usage 無效或連線失敗立即停止，無自動重試。不得自行刪除 lock／attempt 解除限制；先保全證據並釐清用量與原授權。

## 2026-10-19 同版本實玩紀錄

目標來源：使用者指定目前 main Web 版，要求 Jev 讀圖遊玩、取得既有最高 S，再更新既有 itch.io 專案。遊戲來源 commit：`1553dcbc40eb644987e8f4ddbca591f123f75bd2`；`src/`、`public/`、頁面、Vite 設定與 dependency lock 未修改。

| 項目 | 結果 |
| --- | --- |
| 執行版本 | production build，Chrome 可見頁面 `http://127.0.0.1:5187/` |
| 難度 | 一般／Normal |
| 第一次嘗試 | FAIL：0 KO、最大連擊 7、0:30、受傷 1000、D；早期鍵盤焦點／輸入路徑無效，保留失敗證據 |
| 第二次嘗試 | PASS：完全勝利、300 KO、最大連擊 558、1:59、受傷 117、S |
| 操作 | Jev 讀截圖與可見 HUD 選擇限時移動、滑鼠普攻、K 蓄力、L 龍膽；每步使用正常暫停觀察，非不中斷操作影片 |
| 評分依據 | 既有 `src/entities/battle.ts`：勝利、戰鬥時間 <300 秒且受傷 <400；最終可見結算確認 S |
| 模型／用量 | `jev-1.14.0`，39 次成功、122,805 input tokens；依當時 US$0.042／M 估算 US$0.00515781，不等同帳單核銷 |
| 自動檢查 | 35 個 Vitest files／308 tests、typecheck、production build PASS；讀圖 helper 10 tests PASS |
| 獨立審查 | `security_auditor`，實際 `gpt-6-astra`／high；修正第 1 輪後 accept，僅涵蓋 helper 安全與打包邊界 |

helper 最終候選 SHA-256：`38F32ECAA6A44932DBFD9329E870FE9519C20AFF549EDDCDFC19EC390E48ECF0`；test：`9EF747C3285C8C2A80F2AD6DF71C31F764662529C45EEF2908CD62A1D950DE7B`。原第 1 輪審查通過後另補了結果檔名與 ledger 檔名隔離的邊界修正；同一獨立審查者已針對這組最終雜湊續審 accept，另做 6 個檔名邊界與保留預算邊界檢查，外部證據分別保留歷史與最終接受紀錄。

證據保存在 repo 外任務目錄 `jev-vision-play-itch-20261019-v1`：逐步 frame／observation／decision／execution、`attempt-1-defeat.png`、`attempt-2-victory-S.png`、`attempt-2-result.json`。缺少 decision-007 是截圖步驟失敗，尚未呼叫 API；另一次 provider 不可用也是取得憑證前停止。兩者不能當成遊戲 PASS。

## 發布與限制

`npm run package:itch` 只打包 `dist/`，本工具及憑證不包含在 ZIP。套件為 6 個檔案、3,015,735 bytes、SHA-256 `284fc08df83ecb32a715b3c28c23133680994d2abfb1895f123c27c95c1ed315`。上傳與正式站驗收狀態以 [itch 發布紀錄](../itch-page.md) 為準；本機 S 結算不代表正式站發布完成。

既有 `source-map-js@1.2.1` 開發依賴存在 [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) HIGH DoS 公告；production dependency audit 為 0。此任務未改 lock，未證明漏洞可到達靜態遊戲 runtime；開發工具修補另案處理，期間避免處理不可信 source map。

本次沒有宣稱 Unity 階段、全部 S01–S08、手把、音效主觀聽感、低階硬體或長時穩定性驗收完成。沿用既有缺口，保留所有舊證據與備份。
