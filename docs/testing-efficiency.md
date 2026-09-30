# 遊戲測試與 Jev 分流量測

> 範圍更正：下列六選一量測屬測試案例分類，候選項不等於當前畫面可操作選項。
> 玩家 UI 操作的新流程見 [真人 UI 迴圈](player-ui-loop.md)。不能用此處的分類準確率宣稱 AI 已能操作或通關。

本次交付六項可重跑遊戲案例、可見 Chrome 輸入測試、精簡狀態介面、
Jev 離線 fixtures 與已授權執行的付費量測程式。遊戲規則及正式入口未修改。
src/testing/ 沒有被 src/main.ts 引用，不會加入正式 Vite bundle。

## 執行方式

使用 repository 要求的 Node 版本，於本工作目錄執行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
npm run test:jev:dry
```

可見 Chrome runner 需要已安裝 Chrome 與 Playwright。若工作環境提供 Playwright，
以 PLAYWRIGHT_MODULE 指向該套件的 index.mjs，避免重複安裝；未設定時解析本地
playwright package。本次使用 Codex bundled runtime，未變更 package-lock 或新增依賴。
bundle 更新時需重新確認其路徑。

```powershell
$env:PLAYWRIGHT_MODULE = 'C:\Users\IOT\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs'
npm run test:browser
# 可分別執行：
npm run test:browser -- hooks
npm run test:browser -- input
```

runner 建立只綁定 127.0.0.1 的 Vite 伺服器，由 OS 分配空閒埠；
開啟獨立、可見的 Chrome，不使用已登入的個人 profile。執行時讓 Chrome 保持可見。
完成或失敗後關閉自己的 Chrome 與 server，保留 artifacts/browser/<timestamp>/。
遇到失敗不自動重試。JSON 包含 base commit、工作目錄狀態、關鍵來源 SHA-256、
斷言、操作、截圖路徑及計時。失敗回傳非零 exit code。

## 六項案例與證據界線

| 案例 | 固定步進斷言 | 可見 Chrome 輸入 |
| --- | --- | --- |
| start | title → playing、HUD、1000 HP、300 敵兵 | 滑鼠點出陣 |
| pause | 暫停凍結位置/HP、忽略攻擊，恢復可移動 | Escape 暫停、滑鼠繼續 |
| attack | N1 啟動、收招回到 move | 實際 j 鍵，觀察 rAF 狀態轉移 |
| guard | 完美格擋無傷、80 普攻 chip=20、背面全傷 | 實際按住 f，觀察守勢畫面 |
| musou | 未滿不能啟動、滿氣消耗、無敵、正常結束 | hook 充能後按 l，觀察無雙 |
| defeat | 致死、結果延遲顯示、重試回滿血 | hook 建立致死情境，真實時間顯示結果、滑鼠再戰 |

hooks 在同一次同步 browser task 內執行，避免 rAF 插入造成場景漂移；
每個案例除 start 外都重新開始戰鬥。start 需要新載入的標題畫面。
預設連跑三輪，每輪 41 個斷言；這些是重複性檢查，不是三個不同模型。
advance 只在最後一幀渲染，不可把其耗時當成遊戲 FPS。
真實輸入透過 Chrome browser protocol 送出，不是 DOM dispatchEvent。
仍未涵蓋手把、長時間遊玩、主觀手感、音效聽感與全面穿模檢查。
瀏覽器回歸的 PASS 不取代上述檢查，也不是部署驗收。

## Jev 的責任

buildRoutingRequest 只提供有限案例選擇與 escalate，保留必要的狀態。
acceptRoutingAnswer 檢查選項、機率分布、信心與已完成案例；不回傳測試 PASS，
也不執行模型產生的 JS、selector 或命令。0.9 門檻是待校驗設定，不是正確率保證。
固定回歸直接跑腳本；需要語意選擇才呼叫模型。候選案例用完時由呼叫端直接停止。

11 個合成中文 fixtures 涵蓋六項案例、視覺/音效需求、多案例歧義、
要求直接宣告通過的文字及已完成格擋案例。expected 標籤不放入 request。
乾跑只驗證輸入可建立，accuracy/token 記錄為 null；不能解讀為模型答對。

依 2026-09-29 查閱的官方文件，固定模型為 jev-1.13.0，輸入每百萬 token
USD 0.042、輸出免費。每次實際量測前重查定價：
[Models](https://docs.typesafe.ai/models)、
[API](https://docs.typesafe.ai/api)、
[Choice](https://docs.typesafe.ai/primitives/choice)。

### 已授權的 Jev 量測

使用者於本對話授權 A，並明確取消 Jev 費用與呼叫次數上限。
此授權限本任務所需工作，沒有建立排程或寫入全域設定／長期記憶。
每個實驗仍使用固定樣本數，避免任意追加樣本到得到理想結果。
已完成 baseline 11 案例 × 3 輪與 holdout 18 案例 × 3 輪：

```powershell
npm run test:jev:live -- --live --suite=baseline --repeats=3
npm run test:jev:live -- --live --suite=holdout --repeats=3
```

每次 request 15 秒 timeout，不自動重試。suite 與 repeats 決定本批次樣本數。
憑證只能由使用者在執行環境安全注入 TYPESAFE_API_KEY；
不要放入前端、repo、命令列、聊天或報告。沒有 live 參數就會在讀憑證前退出。
只傳送上述合成 fixtures，無截圖、原始碼或個人資料。
首輪沿用原本 33 次／USD 0.10 的實驗設定，實際費用遠低於該值；
後續 runner 的 budgetUsd=null，已取消費用上限。
報告仍記錄已發出次數 × 每次 65,536 token × 已核對單價的保守預留，
方便對 timeout 等不確定帳務保留上界；不代表實際帳單或設定供應商帳戶限制。
遇 HTTP 錯誤、模型不符、usage 缺漏、格式不符或 timeout 即停止；
未知消耗不當作 0。已收到的 usage 及保守預留皆保留在 JSON。

輸出 artifacts/jev/<timestamp>/report.json 保存來源雜湊、模型版本、
路由正確率、錯誤自動路由數、延遲、真實 token usage 及估算成本。
信心低而轉人工與錯誤自動路由分開解讀；小樣本無法證明一般可靠性。
量測成功只標為 MEASURED，不當作遊戲、模型或上線 PASS。
實際 HTTP 與 usage 已在 87 次 request 中驗證。結果與限制見
[Jev 實測紀錄](jev-results-2026-09-29.md)。故障 HTTP、timeout 路徑未實際觸發。

## 三組比較方法

| 組別 | 目前狀態 | 可回答的問題 |
| --- | --- | --- |
| 大型 AI 逐步觀察與操作 | NOT_RUN；尚未指定模型、runner、費用範圍 | 現有 agent 工作流的端到端時間與用量 |
| 固定腳本＋精簡狀態 | 已做本地瀏覽器驗證 | 已知案例是否可不用模型逐步判斷 |
| 固定腳本＋Jev 語意分流 | 語意分流實測 87 次；尚未把 live 選案串入 browser loop | 語意分流正確率、Jev 延遲與費用 |

正式 A/B/C 必須固定任務、成功條件、起始場景、Chrome/硬體、模型版本、
可用 actions 與重試預算；交錯執行順序。每筆計時從相同起點開始，到獨立斷言結束。
分開保存冷啟動、觀測、決策、瀏覽器操作與總耗時，並統計失敗和升級大型模型的成本。
不把 routing-only 的 HTTP 時間加上另一次 browser 時間，冒充端到端觀測。
不以通過率全部 100% 的簡單案例宣稱模型精準度提升；需加入獨立 holdout 與已知故障。
目前尚未執行上述完整三組比較。

## 已知環境與驗證限制

本機預設 sandbox 起初發生 helper_sandbox_lock_failed，CUA 發生
orchestrator_helper_incomplete；以經審查的限定本地操作與既有 Playwright 完成驗證。
5174 已被其他程序占用，runner 改為使用空閒埠，未終止既有服務。
Chrome 曾回報 WebGL shader 精度 warning X4122；不是 console error。
視覺 review 需另記錄觀察者及截圖，runner 不自動宣稱藝術品質或手感 PASS。
