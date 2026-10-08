## Context

現況與版本見 [移植盤點](../../../docs/engineering/UNITY_MIGRATION_RECONCILIATION_2026-10-08.md)。main 已有 Unity 工程與 E11；E12 工具在未合併分支。需求是整理後續，不重新移植全部功能，也不把歷史限定接受提升成完整 VERIFIED。

## Goals / Non-Goals

**Goals:** 明確工程／美術責任，恢復 E12 量測可信度，形成固定品質基線，再以同一版本完成效能和可玩版本驗收。

**Non-Goals:** 本次 runtime 或資產實作、Unity WebGL／其他平台／IL2CPP／Editor 升級、新戰役／新玩法、付費生成、全域 Jev 改動、發布。保留 TS/Web、既有授權及證據。

## Decisions

### 1. 沿用工程與分步契約

Adopt 現有 Unity 6000.6.4f1／URP17.6／Windows x64 Mono／D3D11、`unity-validate.mjs`／`unity-execution.mjs`、parity、step record；Extend 既有 E12 量測候選。重新建引擎或新增原生 plugin 並未解決已知缺口，亦增加依賴。`.codex` 設定與候選 profile 不改，文件不是執行強制控制。

### 2. 能力工程與品質交付分開，但正式 benchmark 有共同前置條件

先做 E12 新證據／受審查方案，核對候選與 main 差异，不盲目 cherry-pick；再最小範圍修正量測與測試。此單元可用清楚標示的既有／佔位資產檢驗工具，產出 CAPABILITY_PROBE；不能宣稱正式效能或品質 PASS。

美術工程師負責角色製作端，工程主控負責匯入、蒙皮 bridge、載入 fallback、玩法與視覺驗收。需求 packet 核對 request_id、指定工程師／工作區／傳輸資料、來源可取得性與授權後才送出；沒有送達／接單機制不稱背景製作。狀態區分 PREPARED_NOT_SENT、已送達／IN_PROGRESS、DELIVERED、INTEGRATING、ACCEPTED；交付自評不是遊戲驗收。

修復資產與可能 runtime 修正同一整合單元，完整 rendered／自然操作／review gate 前不合併穩定基準。保留 21 骨、17 招式、4 influences、root-motion=false、tip/tipBase、FootPlant、可見 fallback；material count 從鎖定 GLB 實際盤點，不從缺欄位 manifest 推定。

### 3. 補足量測的來源語義

VRAM 保留 raw timestamp／query start-end／PID／processStart／adapter，先證明時鐘基準和 UTC 轉換。沿用 sample lag≤2s、future≤250ms、query≤2s、有效高水位；失敗不回填 0、不降低 freshness。Counter 必須完整 category/name/unit 匹配，無資料為 null。GPU／CPU delayed sample 要定義 frame identity、latency、重複、暖機、收尾；有 gaps 不靜默剔除。

真正可見數方法在實作前評估 camera-specific occlusion/pixel 來源與額外成本，保留 alive／engaged／attackers／frustum／visible 各自語義。前景 PID、focus、minimized 與實際 render 對齊。固定 workload 用合法玩法與固定 seeds 涵蓋交戰、無雙、倒地峰值，DEV 補血／無敵／teleport 不能冒充自然操作。

### 4. 延續數值 gate 與版本綁定

正式 20→50→100→200→300、seed7/11/23，各暖機30s＋採樣180s，再30min soak。1080p、renderScale1、實際 Player readback 的硬體／driver／VSync／refresh／frame cap／build flags 與固定版本一併登錄。nearest-rank `ceil(q*n)-1`，不先四捨五入；CPU active=`max(p95(main),p95(render))`≤16.67ms，GPU p95≤16.67ms，wall p99≤25ms，wall>50ms 比例≤0.001；CPU/GPU 不相加。CPU counter 已扣等待不再次扣，ns→ms與FrameTiming ms分列。

沿用原跑前 memory budgets：Private Bytes≤4GiB，dedicated VRAM≤2GiB；soak 首尾完整60s中位數差 Private≤max(64MiB,5%)、GCused≤max(16MiB,5%)、VRAM≤max(32MiB,5%)；最後20min每分鐘中位數 slope 分別≤1／0.5／0.5MiB/min。GC absolute cap 尚未另定，不能 invent；OS budget／paging 未有來源保持 UNKNOWN。任何必要來源未知或級別 FAIL 停止升級。

### 5. 同版本 E13 與每單元退出

每單元先 scope review、精確允許檔案、V/S、正負邊界測試與raw evidence，再獨立 exact-head review、該單元 merge 授權與 postmerge compatibility；缺門檻不開始下一單元。E13 freeze code/profile/asset/full build hashes，從輸出 Windows 包測全部 S01–S08、四難度、自然勝敗、重試／暫停／失焦、音效、實體手把與效能；不同舊 SHA 的 PASS 不拼接。明列目前城池佔位範圍，未承諾改造不暗加，未驗收不冒稱最終美術完成。

## Risks / Trade-offs

- 既有 E11 formal review 缺口 → 保留歷史限定接受和缺口，實作前明示可接受前置狀態，不自我批准。
- E12 原兩輪 budget 用完 → 先新定位證據與方案審查，不重設，保留原失敗產物。
- 美術交付未送达、source不可取得 → 阻擋相應資產品質單元，推進獨立工具工程；正式 benchmark 不繞過品質。
- 可見數／GPU timing instrumentation 可能擾動效能 → 跑前登錄成本對照方法，未知保持 BLOCKED。
- 外部人類 reviewer／實體裝置尚未齊備 → 保留 NOT_RUN，草案 advisory 不能替代正式 APPROVED。

## Migration Plan

本次只建立文件 checkpoint。後續每單元使用隔離 worktree／feature branch，保留 Web；普通 revert 該單元提交回復上一已驗證基準。保存失敗 trace、來源 GLB 與版本化候選；不 reset、clean、force-push 或刪除證據。發布需獨立授權與真站／輸出包驗收。

## Open Questions

- 新 timestamp 根因證據、真正可見數來源、timing frame mapping 與量測成本的具體方案待能力單元先行審查。
- 美術工程師接單目的地、受控 `.blend`、交付時間與實際 packet 送達尚未核對。
- 正式 reviewer、固定品質候選、workload cycle／自然操作路線、同版本裝置／感官驗收負責人待登錄。未知是執行前置條件，不阻止本次 spec 草案交付。
