# 真人可見 UI 的可重用遊玩迴圈

已驗證兩個完整通關情境，數據、截圖與失敗紀錄見 [2026-09-29 實測報告](player-ui-loop-results-2026-09-29.md)。

此流程專供「真人在網頁上看得到、按得到」的功能驗證。舊的六項案例分類與使用 debug hooks 的固定回歸，仍是不同證據；不能把它們的準確率解讀為此流程的操作成功率。

## 執行

需要符合 package.json 的 Node 版本、可見 Chrome、Playwright，以及執行環境提供的 TYPESAFE_API_KEY。憑證不放入情境 JSON、前端或測試報告。本對話已授權本任務使用付費 Jev；執行器仍要求明確 --live，沒有排程。

```powershell
npm test
npm run build
# 若 Playwright 由環境提供，先將 PLAYWRIGHT_MODULE 指向其 index.mjs。
npm run test:player:loop -- --live --scenario=tests/scenarios/victory.json
npm run test:player:loop -- --live --scenario=tests/scenarios/pause-resume-victory.json
```

腳本啟動專用 loopback Vite 與獨立可見 Chrome。執行時保持視窗可見且有焦點；結束時關閉自己建立的 browser/server。不要用另一個程式切換視窗，否則遊戲會自動暫停，測試亦會停止或依當前情境的合法選項處理。

## 迴圈

1. 讀取當前可見按鈕、HUD、招式提示及小地圖已畫出的像素。主畫面的操作說明經實際捲動讀取，作為後續記住的操作知識。
2. 從這些證據建立當前合法的動作登錄表。標題頁只有觀察到的按鈕；戰鬥時才提供已讀過提示的按鍵；無雙只有畫面顯示就緒時提供。
3. 以情境目標、當前階段、距離類別、血量風險及可用動作詢問 Jev。Jev 選一個登錄表 ID，不能提供任意 JS、selector、命令或直接回報 PASS。
4. API 回覆須通過模型、候選 ID、機率分布及門檻驗證。網路等待後重讀畫面；決策條件已變則丟棄，不執行過期動作。
5. 經 Chrome protocol 實際點擊或按鍵。每個連續動作有有限時間，按住的鍵在 finally 釋放。
6. 再讀畫面，由程式檢查階段條件。全部必要階段通過，且沒有瀏覽器錯誤才 PASS；戰敗、逾時、無進展、缺少證據或不接受的決策均留下失敗報告。300 擊破後可先短暫等待結算頁；過場本身不等於所有驗收條件通過。

小地圖辨識只拿玩家綠色標記及敵方紅／金色標記的像素位置。它不讀遊戲角色位置、敵人陣列或碰撞資料。方向先用實際 W、D 移動的畫面差異校準。沒有從源碼硬編敵軍位置或通關路線。

## 改題目時改什麼

情境檔包含 goal、依序執行的 stages，以及每個階段的 goal / until / 可選 allowed。until 中的條件必須全部成立。allowed 是目前動作的篩選器，不能創造網頁不存在的動作。

例如在出陣與通關之間插入：

```json
{
  "id": "pause",
  "goal": "按 Esc 暫停並驗證暫停畫面",
  "allowed": ["pause"],
  "until": [{ "field": "mode", "op": "eq", "value": "paused" }]
}
```

再加入只允許 click_resume 的「繼續」階段，最後仍要求 victory 與 300 擊破。這樣使用同一執行器驗證新條件。

目前可驗證的欄位：mode、ko、remaining、hpRatio、musouReady、moveName、moveHint、resultText。運算為 eq、gte、lte、contains；無證據的 null 不會通過。

戰鬥結束覆蓋畫面後，不讀被遮住的 HUD 數字。勝利須從實際結果標題辨識，300 擊破取自結果統計。若新功能沒有出現在上述觀察欄位，必須先擴充可見 UI 擷取器與測試，不能只改一句題目就宣稱有驗證。

目前操作庫包含已觀察按鈕、普攻、蓄力、防禦、暫停、無雙、方向校準、接近標記及脫離障礙。這是合法操作的子集，並非承諾窮舉全頁所有控制項；例如手把、語言切換及攝影機測試需新增對應操作與觀察。

## 效率與限制

相同目標、階段、精簡局面與選項會重用同一次已接受的 Jev 決策。每步實際移動方向仍以新小地圖重建；就緒條件及畫面模式改變會使快取失效。

完整可見觀察保存在 trace.jsonl；送給模型的是決策所需摘要。要新增需要更多資訊的題目，應擴充決策欄位及快取失效條件，不能沿用省略該資訊的摘要。快取次數只是避免重複呼叫的量測，不是對所有未來題目的正確率或 token 改善保證。

confidenceThreshold 預設 0.6，是本地低風險遊戲操作的可調保守門檻，尚未校準成正確率。可用動作與驗收條件由程式約束，不能以高信心取代結果檢查。maxSteps、maxDurationMs、noProgressMs 是單次執行的停止條件，不是費用授權上限。

尚未覆蓋：手把、主觀手感、音效、全部招式、所有碰撞路徑與不同 GPU / 視窗尺寸。這是本機可見 Chrome 的功能證據，沒有部署，也不代表線上版本通過。

## 證據

artifacts/player-loop/<timestamp>/ 包含：

- report.json：情境、來源雜湊、完成階段、Jev usage、費用估計、錯誤及結果。
- trace.jsonl：每次模型請求／回覆、過期決策丟棄，以及動作前、按住期間（需要時）、操作後的可見觀察。
- observed-instructions.txt：實際讀到的操作提示。
- 階段、途中及結尾的截圖。

失敗不自動重開遊戲；要依據具體證據修正假設再跑。測試控制器失敗、遊戲產品缺陷、環境故障要分開判讀。價格估計依本次核對的 Jev 每百萬 input token USD 0.042，非供應商帳單。
