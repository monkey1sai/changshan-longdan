# itch.io 上架資料

itch.io 專案頁的填寫內容與上傳步驟。更新既有遊戲需作者明確授權；帳號註冊、定價、收款與稅務設定不包含在一般版本更新範圍內。

- 遊戲壓縮檔：執行 `npm run package:itch`，產生 `release/changshan-longdan-web.zip`
- 封面與截圖：`release/itch/`（開發版以 `__game` 擺出場面後截圖並裁切；`release/` 不進版控）

## 上架狀態

| 項目 | 內容 |
| --- | --- |
| 專案頁 | https://monkey1sai.itch.io/changshan-longdan |
| 編輯頁 | https://itch.io/game/edit/5071537 |
| 公開 | Public，2026-09-29 起 |
| 定價 | $0 or donate，建議贊助 US$2 |
| 收款 | Collected by itch.io, paid later；稅務問卷已於 2026-09-29 完成 |
| 目前上傳檔 | `changshan-longdan-web.zip`，188,446 bytes，SHA-256 `e8c731d28b5954a4306bc595ed955a2218a48eb7606edd536f413d2cd1d0a796`，由 source commit `ca0205e5e5acca0a199186edc25788b776b7859f` 建置，2026-09-29 上傳 |
| 實際驗證 | 2026-09-29 使用可見 Chrome 在公開頁按 Run game，切換英文 → To Battle，以鍵盤普攻／蓄力／暫停；中英切換保持 HP，重新載入 iframe 保留英文偏好。實際 iframe 960×540，無水平溢位，console error 0；下載伺服器 ZIP 的 bytes／SHA-256 與本機成品一致 |
| 本版變更 | `118f241` 戰鬥操作與場景辨識改善；`ca0205e` 即時中英文介面。商店中英操作說明已更新並重新載入核對 |
| 前版回滾 | source `cfa1696`，180,847 bytes，SHA-256 `ef88ab6981fc347f421fd4c2b5b5f1fc36845e68d63c1aed8b617a012a84c8aa`；原檔已下載核對並保存在本機 `release/rollback/changshan-longdan-cfa1696.zip`（不進版控） |

本版封裝包含 4 個檔案：根目錄 `index.html`、`THIRD_PARTY_LICENSES.txt`、CSS 與 JS。正式頁載入 `assets/index-2GF4U9GT.js`，與本機封裝相符。上傳後保留 Public、$0 or donate／建議 US$2、960×540、Fullscreen button 設定；未修改收款、稅務或帳號權限。公開頁驗證截圖與 JSON 存在本次工作附件 `bilingual-release/`；本機 DEV 結算情境與正式站驗收分開記錄。

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
- 趙雲採用 Quaternius CC0 人物底模並以 Blender 改造，士兵與場景由程式生成；所有音效與配樂以 WebAudio 即時合成
- 右上角即時切換繁體中文／English；記住偏好，戰鬥不中斷
- 按住普攻自動連段、閃避突進與精準格擋反擊，搭配即時招式指南

**操作**（建議使用鍵盤或手把，先點一下遊戲畫面讓它接收鍵盤）

- 鍵盤：移動 WASD／方向鍵、按住 J／滑鼠左鍵普攻、蓄力 K／滑鼠右鍵、龍膽 L、跳躍 空白鍵、閃避 Shift、防禦 F、精準格擋後 J 反擊、Shift → J 突進、視角 Q／E、R 回正、暫停 Esc
- 手把：□ 普攻、△ 蓄力、○ 龍膽、× 跳躍、R1 閃避、L1 防禦、右搖桿按下回正

建議使用電腦版 Chrome、Edge 或 Firefox，需要支援 WebGL2，並按右下角的全螢幕按鈕遊玩。遊戲會依效能自動調整渲染解析度。喜歡的話歡迎贊助，是對作者最直接的鼓勵。

使用 Three.js（MIT 授權）；人物底模來自 Quaternius Universal Base Characters（CC0 1.0）。

## English description

Zhao Yun rides alone into a Wei fortress at dusk. Three hundred soldiers stand in his way.

Changshan Longdan is a PS2-style, musou-like action game that runs right in your browser:

- Normal strings N1–N6 and charge attacks C1–C6: after the k-th normal attack, press charge to unleash charge attack C(k+1)
- Jump attacks, a dodge with invincibility frames, hit-stop and screen shake
- 300 soldiers on the field at once: they hold formation, surround you and take turns attacking, then shatter into voxels when defeated
- Fill the Longdan gauge to unleash Longdan Frenzy: Azure Dragon, as a dragon circles you and crashes down while the screen turns to gold and ink
- A castle at dusk with waving banners, fire and smoke, depth of field and bloom
- Zhao Yun uses a Quaternius CC0 character base customized in Blender; soldiers and environments are procedural, and all sound effects and music are synthesized in real time with WebAudio
- Switch between English and Traditional Chinese at the top right, with a saved preference and no battle restart
- Hold Attack for combos, dash out of a dodge, or counter after a perfect guard; an in-battle move guide shows follow-ups

**Controls** (keyboard or gamepad recommended; click the game once so it receives keyboard input)

- Keyboard: move WASD / arrow keys, hold J / left click to attack, charge K / right click, Longdan L, jump Space, dodge Shift, guard F, J after a perfect guard to counter, Shift then J to dash, camera Q / E, recenter R, pause Esc
- Gamepad: □/X attack, △/Y charge, ○/B Longdan, ×/A jump, R1/RB dodge, L1/LB guard, press right stick to recenter

Choose English or Traditional Chinese from the Language menu at the top right. Best on desktop Chrome, Edge or Firefox with WebGL2 support, played with the fullscreen button at the bottom right. The game scales its render resolution automatically to keep the frame rate smooth. If you enjoy it, a donation is the most direct way to support the developer.

Built with Three.js (MIT License). Character base: Quaternius Universal Base Characters (CC0 1.0).

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

先提交遊戲原始碼，再執行 `npm run package:itch`。到既有專案的 Edit 頁更新 browser build，保留公開狀態、定價、收款與嵌入設定；新檔需勾選 **This file will be played in the browser**。上傳並實際在公開頁驗證後，才更新上方「上架狀態」表的檔案大小、SHA-256 與 source commit。保留前一版 release metadata 以供回滾。
