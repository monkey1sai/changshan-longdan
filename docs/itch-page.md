# itch.io 上架資料

itch.io 專案頁的填寫內容與上傳步驟。帳號註冊、上傳與收款設定都要由作者本人操作。

- 遊戲壓縮檔：執行 `npm run package:itch`，產生 `release/changshan-longdan-web.zip`
- 封面與截圖：`release/itch/`（開發版以 `__game` 擺出場面後截圖並裁切；`release/` 不進版控）

## 欄位

| 欄位 | 填寫內容 |
| --- | --- |
| Title | 常山龍膽 Changshan Longdan |
| Project URL | `changshan-longdan` |
| Short description or tagline | 趙雲單騎破魏軍三百｜Zhao Yun vs. 300 soldiers, a PS2-style musou-like brawler（itch.io 以 UTF-8 位元組計算上限 120，中文字每字 3 位元組；此句 87 位元組） |
| Classification | Games |
| Kind of project | HTML |
| Release status | Released |
| Pricing | **$0 or donate**，Suggested donation 填 US$2 |
| Uploads | 上傳 `changshan-longdan-web.zip`，勾選 **This file will be played in the browser** |
| Embed options | Viewport dimensions 960 × 540（配合 itch.io 約 960 px 的頁面欄寬；遊戲會自動適應尺寸）；勾選 Fullscreen button；**不要**勾 Mobile friendly（沒有觸控操作）；**不要**勾 Automatically start on page load（瀏覽器要求點擊後才能播放聲音）；不需要 scrollbars；不勾 SharedArrayBuffer support |
| Genre | Action |
| Tags | action, hack-and-slash, beat-em-up, musou, voxel, three-kingdoms, historical, singleplayer, 3d, webgl |
| Input | Keyboard, Mouse, Xbox／PlayStation controller |
| Generative AI disclosure | 選 **Yes**，勾 **AI Generated Code**（程式碼由 Claude 撰寫）；如果照用本文件的說明文字，另勾 **AI Generated Text & Dialog**。畫面與音效是程式在執行時產生，沒有使用圖像或音訊生成模型 |
| Cover image | `release/itch/cover-dragon-cutin.png`（630 × 500），備選 `cover-dragon-spiral.png` |
| Screenshots | `release/itch/screenshots/` 的五張（1280 × 720） |
| Visibility | 先設 **Draft** 自己試玩，確認無誤再改 **Public** |

## 中文說明

趙雲單騎闖入黃昏中的魏軍城池，眼前是三百名魏兵。

《常山龍膽》是一款在瀏覽器裡就能玩的 3D 動作遊戲，向 PS2 時代的一騎當千致敬：

- 普攻 N1–N6 與蓄力 C1–C6 連段：打出第 k 下普攻後按蓄力，放出第 k+1 式蓄力技
- 跳擊、附無敵時間的閃避、命中停頓與鏡頭震動
- 三百名魏兵同時在場：列陣、包圍、輪流出手，被擊破時炸成體素碎片
- 集滿龍膽氣發動「龍膽亂舞・蒼龍破陣」：青龍繞身盤旋後俯衝撞地，全螢幕轉為金墨色調
- 黃昏城池、飄揚的軍旗、火焰與濃煙、景深與光暈
- 所有模型由程式生成，所有音效與配樂以 WebAudio 即時合成

**操作**（建議使用鍵盤或手把，先點一下遊戲畫面讓它接收鍵盤）

- 鍵盤：移動 WASD／方向鍵、普攻 J／滑鼠左鍵、蓄力 K／滑鼠右鍵、龍膽 L、跳躍 空白鍵、閃避 Shift、視角 Q／E、暫停 Esc
- 手把：□ 普攻、△ 蓄力、○ 龍膽、× 跳躍、R1 閃避

建議使用電腦版 Chrome、Edge 或 Firefox，需要支援 WebGL2，並按右下角的全螢幕按鈕遊玩。遊戲會依效能自動調整渲染解析度。喜歡的話歡迎贊助，是對作者最直接的鼓勵。

使用 Three.js（MIT 授權）。

## English description

Zhao Yun rides alone into a Wei fortress at dusk. Three hundred soldiers stand in his way.

Changshan Longdan is a PS2-style, musou-like action game that runs right in your browser:

- Normal strings N1–N6 and charge attacks C1–C6: after the k-th normal attack, press charge to unleash charge attack C(k+1)
- Jump attacks, a dodge with invincibility frames, hit-stop and screen shake
- 300 soldiers on the field at once: they hold formation, surround you and take turns attacking, then shatter into voxels when defeated
- Fill the Longdan gauge to unleash Longdan Frenzy: Azure Dragon, as a dragon circles you and crashes down while the screen turns to gold and ink
- A castle at dusk with waving banners, fire and smoke, depth of field and bloom
- Every model is procedural, and all sound effects and music are synthesized in real time with WebAudio

**Controls** (keyboard or gamepad recommended; click the game once so it receives keyboard input)

- Keyboard: move WASD / arrow keys, attack J / left click, charge K / right click, Longdan L, jump Space, dodge Shift, camera Q / E, pause Esc
- Gamepad: □/X attack, △/Y charge, ○/B Longdan, ×/A jump, R1/RB dodge

In-game text is in Traditional Chinese; the controls above cover everything you need. Best on desktop Chrome, Edge or Firefox with WebGL2 support, played with the fullscreen button at the bottom right. The game scales its render resolution automatically to keep the frame rate smooth. If you enjoy it, a donation is the most direct way to support the developer.

Built with Three.js (MIT License).

## 上傳步驟

1. 註冊並登入 itch.io，到 Dashboard 選 **Create new project**。
2. 依上方表格填寫欄位，上傳壓縮檔並勾選 **This file will be played in the browser**。
3. 貼上中文或英文說明，上傳封面與截圖。
4. 定價選 **$0 or donate**。要收贊助，需先開通收款：到帳號設定（右上角頭像選單 → Settings）左側 **PUBLISHER** 區塊的 **Get started**（`https://itch.io/user/settings/seller/get-started`），讀完 Publisher Terms of Service 後按 **I accept the Terms of Service for Publishers**，之後才能設定收款方式（PayPal 直接入帳，或由 itch.io 代收後以 PayPal／Payoneer 提領）並完成稅務資料。左側 **PAYMENT** 區塊的 Credit cards 與 Billing address 是自己購買時用的，不是收款設定。
   - Payout mode 選 **Collected by itch.io, paid later**（itch.io 代收、之後再提領，不必連結 PayPal）。
   - 稅務問卷在 **Tax information → Begin Interview**：非美國人在 Tax Status 題選 **No**，會改填 **W-8BEN**（選 Yes 會進到美國人用的 W-9）；台灣個人的 Foreign TIN 就是身分證字號；簽署頁的 email 必須和 itch.io 帳號的 Primary email 相同。
   - 問卷完成後回到 Tax information 按 **Check for completed interview**，itch.io 才會顯示完成。
5. 以 **Draft** 儲存，用 View page 實際試玩：點擊畫面讓遊戲取得焦點，確認音效、鍵盤與全螢幕都正常。
6. 確認無誤後，把 Visibility 改成 **Public**。

## 更新版本

改完遊戲後重新執行 `npm run package:itch`，到專案的 Edit 頁刪掉舊壓縮檔、上傳新檔，並同樣勾選 **This file will be played in the browser**。
