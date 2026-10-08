# Session 紀錄整理與下一步（2026-10-08）

## 結論與範圍

**下一步先恢復趙雲角色品質，再補足 E12 量測能力；E13 與發布仍不可開始。**

本次依使用者要求整理 repo 下的 session log、對談衍生紀錄、交接與驗證結果。只新增整理文件與來源索引，不搬移、刪除原始紀錄，不修改 gameplay、資產、原工程台帳或遠端。這是 2026-10-08 Asia/Taipei 的本機快照，並非新的工程 APPROVED 或 DONE。

讀取範圍包括主目錄 `docs/`、相關 worktree 的 `docs/`、E11/E12 的 local-only evidence 與角色診斷。沒有找到 repo 內的完整聊天逐字稿；使用者決策取自既有文件所保留的原文，不能視為本次取得新的授權。`.claude/` 只有 launch 設定；找到的 JSONL 是 runtime/GPU traces，不是完整對談。未讀全域 Codex/Claude session archive，未查核即時 GitHub、itch.io，也未重新跑遊戲或測試。

## 現況與版本

| 主題 | 本次可核對的狀態 | 依據與限制 |
|---|---|---|
| Web 發布基準 | 本機附註 tag `itch-web-2026-10-02` 指向 `c48ecd9a39abbc42ecf34ed3761248e11af7c29d` | S01 記錄 ZIP 3,012,736 bytes，SHA-256 `93b6d72a6a31760c3c46767635a698a7df0ab9bfaaad022d5cc95a9ca80bdc0a`；本次未下載線上檔案，tag 尚未由本聊天推送 |
| 主目錄 | main `be04336f108db76bb75da31e8b68e065eb182307` | 本機 Git 歷史為 PR #43 merge；origin/main 本機 ref 同 SHA，未 fetch，不作即時遠端主張 |
| E02–E10 | 台帳記為 DONE（限定接受） | S02；不擴張為所有感官、裝置、效能情境通過 |
| E11 | 程式已合併；合併後五階段原始結果全部 code 0／verified true | S03，run `e180ca75-2ffb-498a-86ce-8b68f19cf275`；正式 APPROVED 缺口仍保留，不自行改成正式 VERIFIED/DONE |
| E12 | 本機候選 `3f45d134da9b6ca997e1de0c8b5b2a2eec60c447`，未合併 | `codex/e12-performance`；S04–S07；量測器有實作，正式 benchmark／soak NOT_RUN |
| 角色形變 | 修復需求 PREPARED_NOT_SENT，尚未製作／交付／驗收 | `codex/fix-zhaoyun-deformation`，文件 commit `fb7e7cd7ab8f116530ca488bb020bcb12be2f557`；S08–S10 |
| E13 | 未開始，前置條件未齊 | S02；不以 E11 merge、短 probe 或工程測試替代完整整合驗收 |

## 對談決策的整理

| 先後順序 | 紀錄中保留的決策 | 現在的解讀 |
|---|---|---|
| E11 範圍 | A1 固定 seed 路線、B1 中英提示、C1 通路測試 | S11；不含真正增援、友軍、新劇情、第二角色或新場景 |
| E11 試玩與交付 | 試玩回報「ok/全像通過」；曾授權 push、PR、merge | S12；PASS_USER_REPORTED_LIMITED，未附完整人工操作證據；不是 E12 的外部寫入授權 |
| 正式 review | 選擇保留正式獨立 APPROVED；雲端 review 額度不足；之後準備人工審查入口 | S13；不能把 review 請求、bot 額度回覆、advisory 或作者本人審查當成 GitHub APPROVED |
| E11 合併後 | 「已經合併, 執行 e12」 | S04 與 Git 歷史相符；未找到足以補成正式獨立 APPROVED 的紀錄 |
| 新發現的角色問題 | 插入破圖異動，回報「肢體拉長、折疊或抖動」；保留 E12 目標 | S08；先恢復品質基線，再跑正式效能長測 |
| 本聊天 | 保存最後 itch 網頁發布版本；整理紀錄及下一步 | tag 已本機回讀；本次只整理，不代表授權資產製作、跨 repo 寫入、remote mutation 或發布 |

## 已過期紀錄與尚缺證據

1. 主目錄 S02 的 E11 列仍寫「尚未建立 PR／尚未合併」，E12 寫 NOT_STARTED。Git 歷史、S03 與 E12 worktree 表明這些描述已過期。S11 建檔時的「尚未修改」也屬歷史時點。應新增後續結案狀態，保留原紀錄，不能直接把所有步驟標 DONE。
2. S12 的 OPEN/Draft、未合併描述早於 main merge，不能當目前 PR 狀態。E11 的正式 APPROVED、人工審查完整範圍、gate 例外依據仍需查核；合併事實與審查合規分開。
3. E12_STEP_RECORD 的部分矩陣仍寫 c 的 Unity/probe NOT_RUN；較晚的 S06/S07 已有實跑。S05 是 source 內的歷史記錄，c 的實際結果應引用 immutable evidence，而非為了填 SHA 不斷修改候選。
4. `.worktrees/_evidence/` 與多個 `release/` 的原始結果主要是 local_only。Git branch／commit 不會保存 ignored release、未提交診斷 JSON、影片與完整 build；tag 只保存來源 commit，不包含發布 ZIP。後續保管需先盤點、雜湊及指定目的地，本次不刪檔或宣稱已完成備份。

## E12 為何受阻

本次直接讀取 S06：probe run `ec66ead4-c89d-4cf2-9270-2947fffd282f`，sourceHead `3f45d134…`，601 frames，15 GPU memory samples，**有效樣本 0**，`status=BLOCKED_CAPABILITY_PROBE`、`benchmarkAllowed=false`、`formalBenchmark=NOT_RUN`。

短探測 timing 診斷為 PASS_METRICS_ONLY，不能證明 300 人效能完成。S07 保留的必要缺口：

- 真正 camera-specific pixel／occlusion 可見人數；frustum 不可替代。
- 固定完整 workload、交戰與無雙／倒地峰值、正式 timing 對齊及量測額外成本。
- 同版本 Player 前景、非最小化與實際可見性證據。
- VRAM raw provider 時間戳與獨立 query UTC 相差約 8 小時；freshness validator 正確拒收。根因未確認，不能直接加減時區後宣稱修復。
- Draw Calls Count 選到 UI Toolkit 同名 counter，需精確 category／name／unit 綁定與 duplicate-name 反例。
- 正式 20→50→100→200→300、每級 seeds 7/11/23、暖機 30 秒＋採樣 180 秒與 30 分鐘 soak。

S07 記錄兩輪 correction 預算已用完。本次不啟動第三輪修正或重試；後續須先提交新的定位證據與受審查方案，清楚處理既有停止條件，不能改名候選或切工具重設預算。

## 趙雲問題與修復邊界

本次查看 S09 的實際 Player 圖，衣料確有大片尖三角與拉伸；靜態圖不能證明抖動頻率。S10 SHA-256 重算為 `26e6e545a4f90486d1a75865075e22f226cc20922f1d6b230aefbcf73aa4b7ee`，與 S08 一致。

S08/S10 的 CPU 診斷：fresh import 與 bind-only 邊長比皆 1；單次 idle 後 p99 約 15.622、最大約 70.922、2,847 條獨立邊超過 4 倍。這支持 Web CPU skinning 也有異常，不能把所有問題歸因於 Unity 橋接。配重斷界、跨部位拓撲、姿勢重定向／非均勻縮放屬待分離的原因，尚未完成完整 Unity palette 與同姿勢 GPU 比較。

修復必須沿用 S08 與資產協作契約：先定位 topology／weights，再區分獨立 runtime 問題；保留現有骨架名稱、weapon tip／tipBase、招式與風格；候選資產另給 delivery_id／manifest，不覆寫原 GLB。新資產收到後仍需 Web／Unity 實際 render、動作回歸、自然操作與使用者視覺確認。

## 建議執行順序與退出條件

| 優先 | 工作與負責方 | 最小可驗證下一步 | 完成條件／授權界線 |
|---|---|---|---|
| 1 | 維護者整理 E11 結案與 source of truth | 以 main merge、S03、正式 review 紀錄及實際人工決策補齊台帳；確認 remote 最新狀態 | 已合併與正式 APPROVED 分欄；找不到例外／核准就保留缺口，不自行豁免 |
| 2 | 遊戲維護者＋mmo-asset-pipeline 美術工程師處理角色 | 從 S08 的已定位邊／三角形核對錯接面與跨部位配重，補全異常區域；另做 Unity fresh／bind／idle／短序列比較 | 新 delivery 及同資產 Web／Unity 工程、畫面、自然操作驗收；製作端、跨 repo／對外動作範圍先具體確認 |
| 3 | 效能維護者＋獨立 reviewer 補量測能力 | 先提出 VRAM provider 時間語義、counter 身分、foreground／visible、timing alignment 的定位與最小修正方案 | 不重設兩輪預算；能力資料完整、負例守門與 exact-candidate 審查完成；新角色版本須重建基線 |
| 4 | 效能維護者執行 E12 正式量測 | 品質與能力都齊備後從 20 人三 seeds 開始，通過才進下一級 | 完成逐級與 soak、相關回歸及正式 review；任何必要值 UNKNOWN 或某級 FAIL 就停止，不降門檻 |
| 5 | 整合維護者＋使用者做 E13 | E12 完成後凍結單一候選，重跑 S01–S08，從輸出 Windows 包啟動 | 四難度、自然勝敗、重試／暫停／失焦、音效、實體手把與效能證據各自登錄；不能拼接不同 SHA 的 PASS |
| 保管 | 維護者保存 Web tag 與 evidence | 遠端 tag 推送及 evidence 備份先指定目的地／範圍；不要清理仍唯一的原始結果 | 本聊天未授權 push `origin` 的 tag、PR、merge、發布、外部備份或刪除；必要時提出固定清單 |

E12 的既定 gates 沿用 S04：1080p／renderScale 1；main/render active 各 p95≤16.67ms，GPU p95≤16.67ms，wall p99≤25ms，>50ms 比例≤0.001；CPU/GPU 不相加。記憶體與硬體條件詳見 S04，不能看完結果才改允收界線。

## 來源索引與保管方式

所有下列路徑相對 `C:/Repos/changshan-longdan`。同目錄 `SESSION_RECONCILIATION_2026-10-08.sources.json` 記錄實際讀取檔案的 bytes／SHA-256；它是來源快照索引，未複製原始 evidence。若來源更新或被刪除，摘要不自動變成新真相。

| ID | 路徑 | 用途 |
|---|---|---|
| S01 | `docs/itch-page.md` | 最後有紀錄的 Web 發布與 ZIP hash |
| S02 | `docs/engineering/MUSOU_EXECUTION_PLAN.md` | E00–E13 意圖、台帳與退出門檻 |
| S03 | `.worktrees/_clones/e11-c/release/e02/e11-postmerge/result.json` | main merge 同 SHA 五階段原始結果 |
| S04 | `.worktrees/e12-performance/docs/engineering/E12_PERFORMANCE.md` | E12 範圍、量測契約、硬體與預算 |
| S05 | `.worktrees/e12-performance/docs/engineering/E12_STEP_RECORD.md` | 原始實作／修正／審查歷史 |
| S06 | `.worktrees/_clones/e12-a/release/e12/probe-c/result.json` | E12 c probe 原始 blocker |
| S07 | `.worktrees/e12-performance/release/e12/c-outcome.md` | c 工程結果、raw 缺口與停止條件 |
| S08 | `.worktrees/fix-zhaoyun-deformation/docs/art/requests/cl-zhaoyun-deformation-v1.md` | 角色修復需求與驗收範圍 |
| S09 | `.worktrees/_clones/e12-a/release/e02/e12-b/player/scene.png` | 本次實看衣料異常的靜態圖 |
| S10 | `.worktrees/fix-zhaoyun-deformation/release/skin-diagnosis/web-vertices.json` | CPU 診斷資料，非 GPU／runtime PASS |
| S11 | `docs/engineering/E11_HANDOFF.md` | 歷史 A1／B1／C1 決策 |
| S12 | `.worktrees/_evidence/e11/remote-9036d2f/REMOTE_CLOSEOUT.md` | 歷史授權、試玩回報與審查缺口 |
| S13 | `.worktrees/_evidence/e11/remote-9036d2f/CLOUD_REVIEW_RESULT.md` | review 額度阻礙與正式 review 未完成 |
| S14 | `.worktrees/_clones/e12-a/release/e02/e12-c/result.json` | c 工程五階段原始結果 |

## 本次驗證與停點

- VERIFIED／PASS：本機 main／worktree candidate／tag 指向查核；S03/S14 的五階段 exit code 0、無 timeout、verified true；S06 的 BLOCKED 及 0 有效 VRAM samples；S10 hash；S09 畫面讀取。這是既有證據的核對，未重新執行工程測試。
- INFERRED：角色根因可能涉及拓撲／配重與姿勢縮放，尚待分離；下一步優先修角色的建議符合 S08 的既有順序。
- NOT_RUN／UNVERIFIED：即時遠端狀態、完整逐字對談、原始全部影片與 log、正式獨立 APPROVED、角色修復、正式 E12、E13、現站重驗及 evidence 外部備份。
- 本次文件整理完成後停止；沒有啟動背景 Player、錄影、benchmark、agent 或自動化。實作、資產製作及外部動作不在本次整理內。
