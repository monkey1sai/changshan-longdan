# MMORPG 開源原始碼參考清單

開發新系統前先查這份清單，看看既有開源遊戲是否已解決同類問題，避免重新造輪子。原始報告：
[MMORPG_GitHub_Source_Report_20261005.pdf](MMORPG_GitHub_Source_Report_20261005.pdf)
（3 頁，SHA-256 `11e5aca0ab4db13092edee66ae1a7d71677b983b31c5801d60189be5eeebbf40`，2026-10-05 建立）。

## 使用規則

- **只參考設計，不搬程式碼。** 這些專案多為 GPL 系 copyleft 授權（報告只驗證 L2J 三份為 GPLv3，其餘未在本 repo
  逐一核對）。本遊戲以 itch.io 發佈並規劃移植 Unity，直接複製或改寫其程式碼可能使整個遊戲須以相同授權公開。需要引用
  程式碼、資料表或素材時，先讀該倉庫的 `LICENSE`，記錄授權決定並更新 `public/THIRD_PARTY_LICENSES.txt`，取得人工核准後
  才可併入。
- 參考時記下倉庫、分支、檔案路徑與 commit SHA，讓設計來源可追溯。
- 這些倉庫是 fork／鏡像，不會自動同步上游；需要最新行為時以上游為準。
- 報告範圍只到原始碼與 Git 歷史複製驗證；未編譯、啟動或驗收任何遊戲。報告本身的獨立複核因審查服務容量問題未完成
  （`REVIEWER_CAPACITY / BLOCKED`），不視為已通過複核。

## 倉庫清單

全部位於 GitHub 帳號 `monkey1sai`，皆為公開倉庫。分支與標籤數為建立當時的快照。

| 遊戲／專案 | 倉庫 | 上游來源 | 預設分支 | 類型 |
| --- | --- | --- | --- | --- |
| RO／rAthena | [monkey1sai/rathena](https://github.com/monkey1sai/rathena) | rathena/rathena | master | fork |
| RO／Hercules | [monkey1sai/Hercules](https://github.com/monkey1sai/Hercules) | HerculesWS/Hercules | stable | fork |
| 天堂 1／L1J-en Classic | [monkey1sai/classic](https://github.com/monkey1sai/classic) | l1j-en/classic | master | fork |
| 魔獸世界／AzerothCore | [monkey1sai/azerothcore-wotlk](https://github.com/monkey1sai/azerothcore-wotlk) | azerothcore/azerothcore-wotlk | master | fork |
| 魔獸世界／TrinityCore | [monkey1sai/TrinityCore](https://github.com/monkey1sai/TrinityCore) | TrinityCore/TrinityCore | master | fork |
| Ryzom Core | [monkey1sai/ryzomcore](https://github.com/monkey1sai/ryzomcore) | ryzom/ryzomcore | core4 | fork |
| The Mana World／伺服器 | [monkey1sai/tmwa](https://github.com/monkey1sai/tmwa) | themanaworld/tmwa | master | fork |
| The Mana World／Mana 客戶端 | [monkey1sai/mana](https://github.com/monkey1sai/mana) | mana/mana | master | fork |
| Veloren | [monkey1sai/veloren](https://github.com/monkey1sai/veloren) | veloren/veloren（官方 GitHub 鏡像） | master | fork |
| 天堂 2／L2J 登入伺服器 | [monkey1sai/l2j-server-login](https://github.com/monkey1sai/l2j-server-login) | Bitbucket l2jserver/l2j-server-login | master | 鏡像（GPLv3） |
| 天堂 2／L2J 遊戲伺服器 | [monkey1sai/l2j-server-game](https://github.com/monkey1sai/l2j-server-game) | Bitbucket l2jserver/l2j-server-game | develop | 鏡像（GPLv3） |
| 天堂 2／L2J Datapack | [monkey1sai/l2j-server-datapack](https://github.com/monkey1sai/l2j-server-datapack) | Bitbucket l2jserver/l2j-server-datapack | develop | 鏡像（GPLv3） |

Veloren 的 commit SHA 與 GitLab 不同，因為官方 GitHub 鏡像展開了 Git LFS 素材；預設分支程式碼與 GitLab 快照一致。

## 可能相關的參考方向

以下是依專案性質推測的查找起點，尚未實際比對原始碼，使用前須先確認：

| 本遊戲需求 | 可先查看 |
| --- | --- |
| 招式與技能資料化、傷害公式、狀態異常 | rAthena／Hercules 的技能與戰鬥資料庫，TrinityCore／AzerothCore 的 spell 系統 |
| 大量敵兵 AI、腳本化行為 | AzerothCore／TrinityCore 的生物 AI 與腳本框架，L2J 的 AI 與 datapack |
| 空間分割、大量實體更新 | TrinityCore／AzerothCore 的地圖格網，Veloren 的 ECS 架構 |
| 體素世界、程序式動畫與動作戰鬥 | Veloren（Rust、體素、動作戰鬥） |
| 3D 客戶端與資產管線 | Ryzom Core、Mana 客戶端 |

## 本機證據

報告的驗證證據保存在建立者的本機 `C:\.llmcode\mmorpg-github-forks-20261005`（`RESULT.md`、`source-manifest.json`、
`evidence/summary.json`、`native-verification.json`、`mirror-verification.json`、`delivery-review.md`），未納入本 repo。
