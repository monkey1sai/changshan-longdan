# 《常山龍膽》可執行工程計畫

日期：2026-10-02（Asia/Taipei）｜計畫版本：1
依據：[工程變量](./MUSOU_VARIABLES.md)、[候選 profile](./musou-profile.proposed.json)、[逐步證據模板](./MUSOU_STEP_RECORD.template.md)。

## 0. 範圍與目前狀態

本節的「本次」與未開始敘述保留 2026-10-02 制定計畫時的歷史時點。後續執行狀態以第 4 節台帳及其固定版本證據為準；2026-10-03 已補登 E00／E01 限定結案與 E02 本機準備，沒有改變其他步驟的驗收門檻。

本文件把 PR #8 的 V01–V12 與 S01–S08 拆成 E00–E13。E 是本計畫的步驟編號，不重新定義既有 P0–P3。來源為 PR #8 head `7724e26252b84ef0b20e0bbfa3315df4fe86935f`；main、其他 PR、CI、素材與本機狀態都必須在執行時重新查核。

**本次只把計畫、證據模板與 AGENTS 入口 commit 到既有 PR #8。沒有執行 E00–E13，沒有建立 Unity runtime、改玩法、合併、發布或付費生成。** 原 profile 的 `runtimeConnected=false`、`observations=null` 與 S01–S08 `not_run` 保持不變。計畫文件審查通過不等於任何遊戲步驟通過。

依原規格第 7 節，後續每個 E 步驟是一個可審查的實作單位，另立相依的實作 PR，正文回連 #8。**不得為方便而把整個引擎遷移塞進這個規格 PR。** 每步可有多筆小 commit，修正必須用新 commit 保留失敗歷史；各實作步驟完成驗證、正式審查、獲准合併並核對合併後基線，才進入下一步。規劃和唯讀盤點不等於跨步實作。本次提交計畫的授權不包含後續 PR 的合併授權。

未來的檔名、型別、Unity 專案目錄與驗證 runner，除明列為既有者外，都是**該步要建立的交付物**，不得當成目前已存在。Unity 版本、渲染管線、硬體、`.blend` 路徑與執行檔仍未確認；E02/E03 負責解析，不憑記憶填值。

## 1. 每一步都要走的閉環

1. **開始前審查**：讀最新 AGENTS、變量規格、該步模板及前一步證據；核對 base/head、依賴、授權、工作樹與來源。指定實作者及不同於實作者的審查者；未知就標記待指定。記下可修改路徑與禁止事項。
2. **最小實作**：只做該步交付；保持對照基準。先寫能抓到原問題的負例或測試，再實作；不先同時調傷害、動畫和敵數。每次修正有界，連續兩輪仍無法通過時停下並記錄阻擋原因，不重設期限無限重試。
3. **本地驗證**：跑共通回歸及該步的正例、負例、邊界、渲染與情境驗證。原始 stdout/stderr、exit code、trace、影片與量測環境都保留；記錄產物 SHA-256。失敗、未執行與工具失敗分開。
4. **形成候選 commit**：只 stage 本步檔案，檢查 diff、秘密與授權，再 commit/push 到該步 PR。允許未通過的工作以 Draft 保留，但不可宣稱 DONE。記錄 base SHA、candidate SHA、profile/asset hashes；禁止 force-push、整包 stage 不相關本機修改或夾帶生成輸出。
5. **同版本最終審查與驗證**：以候選 SHA 跑 CI 和必要的遊玩／渲染測試；若測試是在 commit 前跑，須證明被測內容與候選 commit 完全相同，否則重跑。審查者檢查完整 diff、負例、證據與規格偏差，所有阻擋項關閉且沒有未解決 review threads。修改後必須重新核對新 SHA，不把舊 approval 或舊錄影當成新版本證據。
6. **完成與晉級**：不同於實作者的正式 reviewer 對最終 SHA 給 APPROVED，最新 base 仍相容，所有適用門檻通過後才可標 `VERIFIED`。合併還需使用者授權與實際 GitHub 檢查；合併後保存 merge SHA、CI/相容性回歸才標 `DONE` 並開始下一步。來源或 base 改變時重做影響審查；有內容變更或相關風險就重跑受影響測試。

審查可以使用另一代理或人工，但必須留下真實身分、範圍、來源版本和結論。**自己檢查自己的文件只能寫 self-review；COMMENT、模型評分或「未發現問題」都不是 GitHub 正式 APPROVED。** 沒有 reviewer 或缺必要工具就停在 `AWAITING_REVIEW` / `BLOCKED`，不得冒名批准。

### 狀態與證據規則

`NOT_STARTED → IN_PROGRESS → AWAITING_REVIEW → VERIFIED → DONE`；任何階段都可進入 `BLOCKED`。測試結果另用 `PASS / FAIL / NOT_RUN / TOOL_FAILURE / NOT_APPLICABLE`，不可用整體狀態蓋掉失敗。

`NOT_APPLICABLE` 必須有理由與 reviewer 同意；已承諾的核心功能、指定的 S 情境、缺設備、工具逾時或沒有人測不能用它豁免。`DONE` 必須綁定實作、驗證、審查、合併後確認四類證據。只完成某步所列的 S 子情境，不能把整個 S01–S08 提早標 PASS；E13 才檢查完整矩陣。

每一候選 SHA 的最終驗證與審查證據放在**可存取的 PR 評論／review／CI artifact**，引用該 SHA，避免把「本 commit 的 SHA」寫回本 commit 造成無窮改版。大型影片與 `.blend` 不直接塞進文件 PR；本機路徑只能標 `local_only`，未提供 reviewer 可讀產物時不可通過。模板不是來源真實性的自動保證，reviewer 必須實際打開產物。

## 2. 指令與證據入口

### 已存在的 Web 回歸指令（在實作儲存庫執行）

下面是一組 runner 清單，不是一條會忽略錯誤的串接腳本；每條 exit code 非 0 就停止，不執行後面的 commit/push。

```text
node --version
git status --short
git rev-parse HEAD
git diff --check
npm ci
npm run check
npm run package:itch
```

Node 必須符合現有 `package.json` 的 engines。`npm run check` 已包含 Vitest 與 build；package 命令只驗證打包，不授權發布。規格文件的結構檢查和遊戲的上述回歸是兩件事。尚未有本地 clone 或依賴時記 `NOT_RUN`，不能抄前一次 CI 當本次執行。

### 必須先建立的 Unity 驗證入口

E02 的交付必須包含一個可重跑的本機 runner 及其 README：解析已安裝的 Unity 執行檔與專案位置，鎖版本，執行編譯／Edit Mode／Play Mode／目標平台 build，收集 exit code、測試結果與 Editor log。runner 的**實際路徑、完整命令和前置條件**必須寫入 E02 證據；後續步驟沿用它。

此刻沒有提供虛構的 `npm run unity:test` 或假造已存在的 C# test 名稱。runner 未建立、授權或顯示環境不可用就阻擋相應測試。MCP 是操作方式而非門檻：引擎 MCP、runner 或桌面操作能交出同等證據即可；headless 不替代畫面、自然遊玩、聽感或實體手把。

## 3. E00–E13 執行順序

以下每一節都強制套用第 1 節閉環及證據模板；各節的 commit subject 是未來建議，不表示已提交。

### E00 — 凍結可回復的既有版本

- **依賴／變量／情境**：先有 PR #8 已審查的規格基準；V12；盤點 S01–S08 的既有證據，不繼承 PASS。
- **實作與交付**：唯讀查 main、PR #3/#5/#6/#7 最新 base/head、Draft/merge/review/CI，列出已上線、main、候選及本機未提交成果的差異。列出 17 個既有 MoveId、趙雲來源與輸出是否存在、tip/tipBase、可見載入回退及 Web/itch.io 保存策略。建立帶 SHA 的基線與回滾清單，不搬動或覆蓋未提交作品。
- **驗證**：對選定且可回復的 Web 基線跑第 2 節回歸；核對相依 PR 是否已完成原本 P0 門檻及正式核准。若須合併既有 PR，先依原流程取得授權，合併後再測，不由本計畫自動代做。
- **審查**：版本／整合 reviewer 對照 GitHub 原始回覆及產物雜湊，確認沒有把 PR 說明、舊 head 或線上資產誤當 main；必要角色與修復未保存即阻擋 E01。
- **commit／退出**：`docs(baseline): pin recoverable musou source snapshot`；基線清單、實際測試、正式 review 與本步合併後確認齊備才 DONE。
- **停止／回滾**：存在未保存作品、依賴缺證據或來源不一致時 BLOCKED；只撤回本步文件，不 reset/clean/force-push 工作樹，不自動回退線上版本。

### E01 — 建立不改玩法的基準量測

- **依賴／變量／情境**：E00 DONE；V01/V02/V03/V10/V12；S01/S02 的 Web 基準與時序子情境。
- **實作與交付**：建立本地可重跑的 trace runner，輸出原始輸入、state/move/hit、四種敵數、seed、effective profile 與版本。只讀出實際常數，不把 `musou-profile.proposed.json` 偷接到 runtime，不改平衡或引入外部遙測。
- **驗證**：固定輸入測 30/60/120Hz，包括 hit-stop 內輸入、早按接招、暫停／失焦；保存 1/5/20 人命中 trace。量測與既有測試不得改變玩法結果；若發現既有缺陷原樣記 FAIL，修正須在明確範圍後重測，不能用建立儀表宣稱遊戲已通過。
- **審查**：測試 reviewer 查時鐘、事件定義、採樣精度、instrumentation 成本、數值來源及失敗樣本；合成輸入不是 input-to-photon 或自然通關證據。
- **commit／退出**：`test(baseline): capture reproducible input and combat traces`；runner、負例、可讀 trace 及正式 review 通過才 DONE。
- **停止／回滾**：量測改變遊戲結果或來源值不符時停下；普通 revert 移除本步 hooks/runner，恢復 E00 基線。

### E02 — 鎖定 Unity 決策並建立隔離工程

- **依賴／變量／情境**：E01 DONE；V09/V10/V12；S05/S07/S08 的工具及平台前置，不宣告玩法通過。
- **實作與交付**：建立並核准架構決策紀錄：Unity 確切版本、渲染管線、Windows 試作目標、參考 CPU/GPU/RAM、解析度、Web 保留方式、單位／座標／位移權威、專案目錄與資產策略。核對本機現有工程再建隔離骨架；不得刪除 TS/Web。建立第 2 節 Unity runner、最小測試、可啟動 build，記錄安裝／授權與成本；需要下載、付費或改平台範圍時先取得對應授權。
- **驗證**：新 checkout 可依 README 使用同一版本重現；編譯、Edit Mode、Play Mode、啟動／關閉與平台 build 留 log；錯誤版本／缺執行檔必須明確失敗。Web 回歸仍通過。必要情境應有真實畫面，不以空場景證明戰鬥。
- **審查**：架構 reviewer 查遷移邊界、依賴、座標/時間單位、可回滾性與 runner 真實路徑；使用者批准平台／美術管線決策後才能進入功能移植。
- **commit／退出**：`build(unity): establish reviewed isolated project and validation runner`；ADR、可啟動工程、負例與正式 review 齊備才 DONE。
- **停止／回滾**：Unity、硬體或 Web 保留決策未定即 BLOCKED；revert 隔離工程與本步新增設定，不破壞 Web 發布。

### E03 — 保留趙雲來源並驗證資產匯入

- **依賴／變量／情境**：E02 DONE；V04/V09/V12；S07 與 S03 骨架／握點前置。
- **實作與交付**：核對使用者實際 `.blend`、GLB/FBX 的版本關係與 SHA-256、授權、骨架、比例、pivot、材質和握點；找不到就記缺失，不自行生成替身。沿既有 `docs/art/` 製造流程，建立可重現匯出設定、匯入報告、角色 prefab 與可見回退；保留 tip/tipBase 的世界座標意義。
- **驗證**：正常匯入與重新載入，以及檔案不存在、解碼失敗、必要骨骼缺失、材質缺失四類負例；新角色 ready 前回退角色仍可見可玩。核對匯入後面數/材質/骨骼、有限座標、比例與基本姿勢，保留真實渲染。
- **審查**：技術美術 reviewer 查來源對應、匯出再現性、授權與回退時序；資產預算是候選上限，不要求加面數湊額度。
- **commit／退出**：`feat(character): preserve source rig and validate import fallback`；來源/輸出 manifest、正負例、渲染與正式 review 齊備才 DONE。
- **停止／回滾**：來源不明、槍座標偏移或角色消失即阻擋；回復前版匯出與 prefab，不覆蓋原始 `.blend`，不用付費生成掩蓋缺檔。

### E04 — 移植輸入、完整招式與設定對應

- **依賴／變量／情境**：E03 DONE；V01/V02/V11/V12；S01 與 S08 輸入／暫停子情境。
- **實作與交付**：建立 PlayerTuning、MoveDefinition 與獨立 runtime 狀態；移植 N1–N6、C1–C6、JA、JC、DASH、COUNTER、MUSOU 共 17 招。以 E01 effective profile 為基線，保留 450ms buffer、既有 cancel/duration/位移；若建立 JSON adapter，另用明確生效的設定，不修改候選檔來假裝接入。
- **驗證**：所有路線可達、早按/晚按/連按、長按與 charge 優先序、失焦清空、hit-stop 輸入保留、重試還原；測 30/60/120Hz 窗口邊界，按事件時間與預先聲明的取樣誤差比對，不要求不同 dt 的 frame index 相同。設定單位/版本錯誤、共享血量或共享 buffer 必須被負例抓到。
- **審查**：戰鬥/輸入 reviewer 比對 17 招資料、每角色狀態隔離和 Web trace；不得把播放 crossfade 當作玩法取消，或把緩衝時長當輸入延遲。
- **commit／退出**：`feat(combat): port source moves and buffered input without rebalance`；資料讀回、正負例、路線 trace 與正式 review 通過才 DONE。
- **停止／回滾**：漏招、吃鍵、數值漂移或兩套位移同時生效即停下；revert 本步 adapter/state machine，保留 E03 資產。

### E05 — 鎖定命中去重與遊戲時鐘

- **依賴／變量／情境**：E04 DONE；V02/V03/V05/V12；S02 及 S01 停頓/取消邊界。
- **實作與交付**：明確 game/animation/input 時鐘；建立 attackInstance × hitWindow × enemy 去重與可追蹤命中事件，保留 line/arc/circle 的設計語義。群體 hit-stop 同 tick 取最大而非逐人相加，多段窗口仍獨立有效。
- **驗證**：N1、N4、C5、MUSOU 分別打 1/5/20 人；同 window 跨幀不重複扣血、不同 window 合法多段保留。測距離/角度/高度內外邊界、高速跨窗口、取消/死亡後 pending hit、停頓內輸入與恢復後單次消耗；扣血事件與判定影片/trace對齊。
- **審查**：碰撞/測試 reviewer 查時間區間跨越、stamp 生命週期與負例；範圍技不用逐三角形武器碰撞，但動作/特效必須可讀且符合設計。
- **commit／退出**：`fix(combat): enforce hit-window identity and bounded hit-stop`；每個正負例有三元組 trace，跨幀結果一致且正式 review 通過才 DONE。
- **停止／回滾**：重複傷害、漏多段、20 人停頓乘 20 即阻擋；revert HitResolver 與時鐘變更，不改傷害把問題遮掉。

### E06 — 完成動畫連貫與雙手持槍

- **依賴／變量／情境**：E05 DONE；V01/V02/V04/V09；S01/S03。
- **實作與交付**：建立完整 clip 對應、轉場、IK、握點/換握/foot plant 標記及唯一位移權威。先試一般移動/接招 80–120ms，受擊/閃避/無雙各自設計；動畫跟隨 E04/E05 時序，不反過來偷偷更改命中或取消。
- **驗證**：跑→急停→180°轉向→N1–N6、C 分支、跳躍/落地、閃避、格擋反擊、無雙，30/60/120Hz trace 加完整影片；指定握點誤差 p95≤3cm、plant 滑移≤5cm、扣除設計位移的 root 跳變≤5cm，依原規格排除鬆手/空中/刻意滑步。無 T-pose、槍脫手或重複位移；數值通過仍須視覺審查。
- **審查**：動畫/技術美術 reviewer 慢放檢查關節、槍軌跡、腳接觸、anticipation/recovery與握點標記；不得用過長混合掩蓋姿勢或 root 錯誤。
- **commit／退出**：`feat(animation): validate full-moveset continuity and spear grips`；標記、誤差序列、可讀影片、正式 review 齊備才 DONE。
- **停止／回滾**：缺 clip、來源不符或門檻未過即 BLOCKED；回復已驗證動畫/權重版本，保留失敗影片與原資產。

### E07 — 完成打擊回饋與受擊循環

- **依賴／變量／情境**：E06 DONE；V03/V05/V11；S02/S04 及 S08 資源/重置子情境。
- **實作與交付**：接上 hit-stop、音效、刀光、受擊閃光/鏡頭事件、擊退/擊飛/倒地/起身、霸體與無雙 gain/cost；先保留原數值，先定義優先序再調手感。普通兵與隊長規則分開。
- **驗證**：命中、扣血、聲音/VFX時點有共同trace；60fps影片±1 frame只作視覺同步門檻，不宣稱毫秒級聽感。測連續浮空、死亡、取消、重試清除 token/pending hit，無穿地或永久倒地；1/5/20人仍遵守E05。實際聽感另請人確認，缺聽感證據就保留缺口。
- **審查**：戰鬥/音效 reviewer 檢查受擊可讀性、隊長可脫離循環、音量/VFX不掩盖預警；不得靠降低傷害或刪掉測試達標。
- **commit／退出**：`feat(impact): synchronize feedback and complete reaction recovery`；狀態與資源負例、影音、適用感官證據、正式 review 齊備才 DONE。
- **停止／回滾**：永久控制、受擊後token洩漏或不可讀即阻擋；revert本步reaction/FX配置，不撤掉E05的去重保護。

### E08 — 敵群決策與四難度壓力

- **依賴／變量／情境**：E07 DONE；V05/V06/V11/V12；S04/S05 的分層正確性、S08 難度子情境。
- **實作與交付**：分開 alive/visible/engaged/attackers，建立攻擊名額與距離進出緩衝；以重新核對的PR #3 profile為候選基線。近/中/遠決策先試20/10/2Hz；明確界定距離閾值與立即升級條件，不把命中時間軸、近身碰撞降到2Hz。
- **驗證**：四難度資料讀回、攻擊者2/4/5/6候選上限、windup與傷害實際效果、死亡/重試釋放名額；跑進/離開層級邊界不瞬間偷打或卡住。分開測每一軸，再測組合；收集螢幕外傷害、包圍、預警與實際遊玩壓力，不只看勝率。全規模長測留E12。
- **審查**：AI/玩法reviewer查狀態升降級、預警、攻擊token與四數口徑；不得把低頻背景兵當作完整近戰，也不得把倍率存在當難度公平已驗收。
- **commit／退出**：`feat(crowd): validate attack tokens difficulty and decision tiers`；邊界負例、effective profile、壓力證據與正式review通過才DONE。
- **停止／回滾**：瞬間無預警攻擊、層級漏狀態或重試沿用token即阻擋；回復前版敵群profile/決策策略，不砍敵數冒充優化。

### E09 — 鏡頭、遮擋與操作可讀性

- **依賴／變量／情境**：E08 DONE；V01/V08/V11；S06 與 S08 選單/重試子情境。
- **實作與交付**：移植並驗證跟隨、避障、屋頂剖視與退出緩衝；保留可關閉震動、重置鏡頭與單一出陣流程。參考距離9.2m是水平參數，不直接當作3D直線距離；實際參數以新基線校準。
- **驗證**：800×600、1440×900、1920×1080記錄真正viewport/render scale；全部相關營房/牆角、進出/返回、跳躍/落地、無雙與震動關閉連續錄影。四難度入口、重試、選單焦點與失焦恢復依平台映射驗證；Web Enter/J行為仍做回歸。主角與威脅可辨識、屋頂恢復、無鏡頭鑽入角色。
- **審查**：鏡頭/UX reviewer查正反方向、屋簷幾何、切換緩衝與震動可及性；只有漂亮單張截圖不可通過。
- **commit／退出**：`fix(camera): validate obstruction handling and readable combat views`；完整路線影片、幾何/輸入負例與正式review通過才DONE。
- **停止／回滾**：角色被遮、鏡頭夾入、剖視不恢復即阻擋；revert本步鏡頭改動，保留邏輯碰撞與E08資料。

### E10 — 小規模場景資產管線

- **依賴／變量／情境**：E09 DONE；V07/V08/V09/V10/V12；S03/S06/S07 場景回歸。
- **實作與交付**：在既有Art Bible內選小範圍建築/道具/裝備，走來源→Blender修整→匯出→Unity匯入→manifest→視覺QA；記錄面數、材質、貼圖、骨架、LOD、碰撞proxy與載入預算。Hyper3D僅作可選素材來源；使用既有或自製資產也能完成本步，不能把API訂閱變成不必要依賴。
- **驗證**：匯入後實際成本對照候選budget；比例/材質/碰撞/陰影一致，LOD切換、缺材質、檔案缺失與重載有負例；新場景不得破壞握槍/鏡頭路線/命中可讀性。涉及生成才另外保存prompt/reference hash、版本、seed、task ID、花費與拒收原因。
- **審查**：技術美術/資產reviewer查來源授權、風格、交付格式與預算。沒有付費授權時維持externalGenerationEnabled=false和spendLimitUsd=0；不用取得訂閱也可審查既有資產路線。
- **commit／退出**：`feat(art): validate bounded environment asset pipeline`；manifest、正負例、場景前後比較與正式review通過才DONE。
- **停止／回滾**：來源不明、資產超預算未審核或動作/鏡頭回歸即阻擋；撤回本批asset/prefab與manifest版本，不重生趙雲、不擴大地圖掩蓋問題。

### E11 — 戰場節奏與 Director 基線

- **依賴／變量／情境**：E10 DONE；V06/V07/V11；S05 的遭遇內容、S08 自然流程子情境。
- **實作與交付**：對照PR #3已核定的Director與KO 0/60/150/240壓力階段，建立可重現的小戰場與隊長位置；記錄遭遇間隔、空跑/堵門、階段切換與壓力。真正增援、友軍、劇情任務與第二角色仍非本基線範圍，需求另立已批准PR，不把橫幅稱成增援。
- **驗證**：跨階段、死亡、重試、語言/提示更新、所有必要通路可達、沒有軟鎖；固定seed重播與自然遊玩分開記錄。變更場景位置後再跑S06遮擋與S02近牆命中情境。
- **審查**：關卡/玩法reviewer查移動理由、目標清楚度與Director對實際壓力的影響；檢查只移植承諾功能、未偷加新戰役範圍。
- **commit／退出**：`feat(battle): validate bounded director encounter loop`；固定場景、路徑/重試負例、遊玩記錄與正式review通過才DONE。
- **停止／回滾**：任務/路線軟鎖或未核准擴充即停止；revert本步配置，恢復E10可玩場景。

### E12 — 分級效能與穩定性驗收

- **依賴／變量／情境**：E11 DONE；V06/V09/V10/V12；S05，加跑S01/S02/S03/S06/S07優化回歸。
- **實作與交付**：建立可重跑benchmark，20→50→100→200→300人逐級驗證；每級seed 7/11/23，各暖機30秒後採樣180秒；另做30分鐘soak。記錄四種敵數、CPU active/GPU、wall frame、draw calls、配置/GC、RAM/VRAM及無雙/倒地峰值；一次只改一組LOD/動畫/陰影/特效策略。
- **驗證**：在E02登錄的硬體與1080p/renderScale=1下，候選60fps、CPU/GPU各p95≤16.67ms、wall frame p99≤25ms、>50ms幀比例≤0.1%；CPU/GPU不可直接相加。若量測工具不支援某值就記未知，不能填0。soak檢查崩潰、停滯和持續性記憶體增長；記憶體具體允收界線須在跑前經review登錄。任何候選數值變更先審查，不看完結果再降門檻。
- **審查**：效能reviewer查原始序列/分位數算法、VSync/refresh/frame cap、前景渲染、真正可見數與對照組；優化不得改命中、預警、角色品質或用背景窗口減負載。
- **commit／退出**：`perf(crowd): validate staged populations with reproducible traces`；所有承諾級別及soak、相關回歸、正式review通過才DONE。某級失敗停在該級，不能用20人結果宣稱300人完成。
- **停止／回滾**：缺硬體上下文、性能/品質回歸或持續記憶體增長即阻擋；revert本輪單一優化，保存失敗trace與上一級結果。

### E13 — 完整整合與可玩版本驗收

- **依賴／變量／情境**：E12 DONE；V01–V12；S01–S08完整矩陣。
- **實作與交付**：凍結候選build、程式/profile/asset hashes，交付可啟動Windows版本、完整驗證報告、Web保留證據與回滾包。重新填整個S矩陣，不把前步各自不同SHA的PASS拼成一份最终結果。發布仍需另外授權。
- **驗證**：最終整合版本重跑適用回歸、動作/命中/回退/鏡頭/四難度、自然勝敗、重試/暫停/失焦、音效聽感、實體手把與性能矩陣。DEV注入或腳本測試作支持證據單列，不能冒充自然通關；每個實測難度、裝置、解析度清楚登錄。檢查從輸出包啟動而非只有Editor可玩。
- **審查**：獨立整合reviewer逐項開啟產物，核對全部V/S、目前base/head、最新CI、零未解決threads、正式APPROVED；使用者確認實際體驗。缺任何承諾的感官/裝置/情境證據即保留缺口，不自動豁免。
- **commit／退出**：`test(acceptance): pin integrated playable build and complete evidence matrix`；正式review、獲准合併及合併後建置/相容性確認才DONE。此狀態是工程驗收完成，不是已部署；上傳itch.io、購買或變更定價另行授權。
- **停止／回滾**：任一核心門檻失敗即阻擋發布；記錄失敗版本並透過普通revert PR恢復已驗證來源，不自動替換線上包。

## 4. 執行台帳

更新：2026-10-06（Asia/Taipei）。前六步 `DONE` 只涵蓋已記錄的人類限定接受；完整體驗／裝置／效能仍待後續驗收。E05 已依使用者授權合併並完成合併後確認，GitHub 上沒有 counted approval。E06 已依使用者授權合併並完成合併後確認，GitHub 上沒有 counted approval；視覺審查缺口延後。E07 的 PR #33 已合併並完成合併後確認；計畫要求的音效、刀光與共同 trace 由補件處理（本機驗證通過，待審查、推送授權與使用者試玩），E07 仍未 DONE。

| 步驟 | 依賴 | 狀態 | 實作 PR / candidate SHA | 驗證證據 | 正式 review | merge SHA / 合併後確認 |
|---|---|---|---|---|---|---|
| E00 | 已審查的PR #8基準 | DONE（限定接受） | [#11](https://github.com/monkey1sai/changshan-longdan/pull/11)、[#10](https://github.com/monkey1sai/changshan-longdan/pull/10) | #10 結案正文；歷史 [E00 快照](./E00_BASELINE.md)保留 | 使用者限定接受；未逐項體驗／裝置情境後續驗收 | `ac47b84d18a82f7f4e3f501f96ef3020520275fd`；19 檔／156 tests、兩平台 CI、可見操作回歸 |
| E01 | E00 | DONE（限定接受） | [#13](https://github.com/monkey1sai/changshan-longdan/pull/13) / `6967386bf46f5c7d94472f2a2f6280ef5e052c75` | [固定 E01 結案文件](https://github.com/monkey1sai/changshan-longdan/blob/3ff380d3b89d31ad78c89bebd4a4323458b3ea43/docs/engineering/E01_COMPLETED.md) | 固定三個候選的人類限定接受；GitHub counted approval NONE，不延伸至 E02 | `8932ee47b1e902c1d858b9f1b4a1733657c04a8a`；22 檔／227 tests、兩平台 CI、63 raw traces 相符 |
| E02 | E01 | DONE（限定接受） | [#15](https://github.com/monkey1sai/changshan-longdan/pull/15) / `8cfa1f965e429807d2d1aaf40d352e3b99a771d3` | [E02 工程／驗證紀錄](./E02_ENGINE_FOUNDATION.md) F–H 節：compile、11 Edit、1 Play、Windows build、Player／1920×1080 PNG；59 項工具正負例、227 Web tests、包 hash 相符 | 使用者授權合併；GitHub counted approval NONE；獨立 advisory 審查 1 輪已處置，延後項目 #16–#18；安全邊界審查未進行（#19） | `24ce10c33316544669b0e825a9edc3ff9d2e4d2a`；tree 與候選相同；22 檔／227 tests、兩平台 CI、本機 Unity 五階段於合併 SHA 重跑通過 |
| E03 | E02 | DONE（限定接受） | [#20](https://github.com/monkey1sai/changshan-longdan/pull/20) / `9405518aa927f0469cabcaad0ecbf5db3dde1e8f` | [E03 紀錄](./E03_ZHAOYUN_IMPORT.md)：compile、16 Edit、17 Play（六類負例、座標已知點、長槍 tip、材質變體）、Windows build、Player 載入與截圖；Web 228 tests | 使用者授權合併；GitHub counted approval NONE；獨立 advisory 審查 2 輪已處置，延後 #21–#23；技術美術審查未進行（#23） | `a568896456e8a36ce7d1a6fece7c9fedd5944342`；tree 與候選相同；Web 228 tests、兩平台 CI、本機 Unity 五階段於合併 SHA 重跑通過 |
| E04 | E03 | DONE（限定接受） | [#24](https://github.com/monkey1sai/changshan-longdan/pull/24) / `ff20810e631be7b879cb4c49b11613c4dca55071` | [E04 紀錄](./E04_INPUT_MOVES.md)：compile、39 Edit（Mono 對 Web 逐幀一致，最大偏差 7.1e-15；命中形狀 17,424 筆）、22 Play、Windows build、Player；Web 232 tests；使用者在 Unity 可見視窗限定試玩 | 使用者授權合併；GitHub counted approval NONE；獨立 advisory 審查 2 輪已處置，延後 #25 | `0db9668f97c454835c33c3e000503fcf8f85e6a6`；tree 與候選相同；Web 232 tests、兩平台 CI、本機 Unity 五階段於合併 SHA 重跑通過 |
| E05 | E04 | DONE（限定接受） | [#27](https://github.com/monkey1sai/changshan-longdan/pull/27) / `4910312dfb4d4f285fcce2e23edb819868abcbbb` | [E05 紀錄](./E05_HIT_CLOCK.md)：compile、57 Edit（命中對照 20／30／60／120 Hz 全部一致，最大偏差 7.1e-15；完整 MUSOU 20 窗）、25 Play、Windows build、Player；Web 237 tests；使用者限定試玩 | 使用者授權合併；GitHub counted approval NONE；獨立 advisory 審查 2 輪已處置，延後 #29；Web 去重缺陷 #26 | `246760970adebf1ed4a33de3e6668673713d817c`；tree 與候選相同；Web 237 tests、CI success、本機 Unity 五階段於合併 SHA 重跑通過 |
| E06 | E05 | DONE（限定接受） | [#30](https://github.com/monkey1sai/changshan-longdan/pull/30) / `0e28fb93463623ce8ac8e3b6f10afbb12238e8e9` | [E06 紀錄](./E06_ANIMATION.md)：compile、70 Edit（rig 對照 30／60／120 Hz 全部一致，最大偏差 5e-7；握點 p95 ≤ 0.72 cm、踩地滑移 ≤ 0.8 cm）、27 Play、Windows build、Player；路線影片 23.5 s 經 `route.json` 核對；Web 266 tests；使用者限定試玩「手感良好」 | 使用者授權合併；GitHub counted approval NONE；獨立 advisory 審查 1 輪已處置，延後 #32；動畫／技術美術視覺審查未進行 | `fee50bb26c1923d31f9a1a78c3f43141af095e9c`（父提交 `5acc14b` 含 #31、`0e28fb9`）；`src/` 與 main 相同；Web 287 tests、CI success、本機 Unity 五階段於合併 SHA 重跑通過（runId `d7872a42…`） |
| E07 | E06 | IN_PROGRESS（PR #33 已合併；補件待審查與試玩） | [#33](https://github.com/monkey1sai/changshan-longdan/pull/33) / `f0326d6e54caac403290ee397b21ed423d12dcdd`；補件本機分支 `claude/e07-feedback`（未推送） | [E07 紀錄](./E07_IMPACT.md)：#33 合併後確認通過；補件的候選 SHA、runId 與影音記在補件 PR | advisory 審查 1 輪已處置，延後 #34；補件審查進行中；戰鬥／音效審查者待指定 | `dfc71890699959ad6e63d724ae8f26d864e3f2ce`；Web 290 tests、CI success、本機 Unity 五階段於合併 SHA 重跑通過（runId `796992af…`） |
| E08 | E07 | NOT_STARTED | — | — | — | — |
| E09 | E08 | NOT_STARTED | — | — | — | — |
| E10 | E09 | NOT_STARTED | — | — | — | — |
| E11 | E10 | NOT_STARTED | — | — | — | — |
| E12 | E11 | NOT_STARTED | — | — | — | — |
| E13 | E12 | NOT_STARTED | — | — | — | — |

台帳每次更新都指向該步PR證據，不複寫虛構摘要。若目前只完成部分驗證，就列出哪些子情境已測、哪些尚未測，整步仍不得DONE。

## 5. 給執行代理的單步指令

> 先讀AGENTS、MUSOU_VARIABLES、候選profile、本計畫與證據模板，重新讀取GitHub目前狀態。找第一個尚未DONE且前置條件已完成的E步驟，只實作這一步。先登錄範圍、審查者、基準SHA、驗證方案和回滾。只使用該步已驗證存在的命令；所需runner若不存在，先建立並測試，不假造通過。每次變更都保留正負例、原始log與適用畫面/遊玩證據，提交到該步Draft PR並回連#8。完成後請不同於實作者的reviewer審查最終SHA；修正後重跑受影響測試和最新CI。沒有正式核准、必要證據或合併授權就停在真實狀態，不進下一步、不合併、不發布、不付費、不自我批准。

## 6. 來源與計畫審查邊界

本文件是對PR #8既有規格的**執行分解**。命名、先後依賴、逐步commit、review分工與台帳是本次新增的計畫設計，不是聲稱儲存庫已有這些功能。招式、候選數字、V/S定義與未決事項沿用來源，不另宣稱廠商標準或實測成果。

- PR #8 固定來源：`7724e26252b84ef0b20e0bbfa3315df4fe86935f` 下的 `docs/engineering/MUSOU_VARIABLES.md`、`musou-profile.proposed.json`、`AGENTS.md`。
- 現有指令來源：同SHA的 `package.json`；Unity指令須E02確認本機版本後另行建立。
- 本次計畫可檢查：E00–E13是否完整、有無每步驗證/審查/commit/回滾、V/S覆蓋、依賴順序、候選與量測分離、未開始台帳及禁止自我批准。
- 本次不能以文件檢查證明：遊戲可玩、Unity可啟動、模型來源已核對、自然通關、音效/手把、1080p60或14步已完成。
