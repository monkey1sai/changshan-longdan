# E12 分級效能量測契約

## 範圍與版本

基準為 E11 #43 合併 `be04336f108db76bb75da31e8b68e065eb182307`，tree 與候選 `9036d2f6178941e94826ed11886e6489b4165428` 相同。使用者在 2026-10-07 明確要求「已經合併, 執行 e12」。本輪只實作量測與能力探測，不改命中、AI、品質、資產、LOD、陰影或特效策略，不推進 E13。新 E12 push／PR／merge／部署沒有授權。

E11 的 GitHub reviews 仍為空，不能補寫正式 APPROVED。合併後 Unity run `e180ca75-2ffb-498a-86ce-8b68f19cf275` 的 compile／EditMode／PlayMode／build／Player 均 PASS；Web 308 tests、8 parity fixtures、84 runner tests、typecheck/build PASS。原始產物 local_only：`C:\Repos\changshan-longdan\.worktrees\_clones\e11-c\release\e02\e11-postmerge`。這些是合併後相容性結果，不是 E12 效能證據。

獨立開始前審查：native architecture_reviewer `/root/e11_scope_review`，2026-10-07；量測工具／能力探測 accept，正式 benchmark needs-follow-up。正式 APPROVED 尚未取得。

## 重用與缺口

- 重用既有 `unity-validate.mjs`、`unity-execution.mjs` 的 immutable head、source snapshot、建置雜湊、Unity tests 與 Player 啟停，不新增依賴或原生 plugin。
- 用 Unity 6000.6 `ProfilerRecorder` 列舉 counter 與實際單位，Windows WMI 每 PID GPUProcessMemory 記錄各 adapter instance。formatted provider 沒有時間戳，本輪改用 `Win32_PerfRawData_GPUPerformanceCounters_GPUProcessMemory`，先核對 65792 raw gauge，保留 Sys100NS 的原始字串及獨立 UTC。可用 API 不等於實測能力。[Microsoft raw counter 定義](https://learn.microsoft.com/en-us/windows/win32/wmisdk/noncomputational-counter-types)。
- RouteRecorder 固定 30 Hz、逐幀 PNG、忽略失焦，不能作效能 runner。Gameplay dt 有 50ms cap，不能作 wall interval。
- `PerformanceProbe` 只跑 3 秒暖機＋10 秒能力探測。它以 Stopwatch 實測 wall interval，保留原始 recorder 值、前景 PID、focus、記憶體與四種敵數。`visible` 無遮擋／pixel 證據時保留 null；frustum 另列。
- Probe 起始 20 人／seed 7、normal、現有 capsule 兵；不是 300 人高品質骨架敵兵驗收。保持正常 controller Update、真實 dt、失焦行為；沒有固定模擬時鐘或無敵／補血／補兵注入。未固定正式 workload，不聲稱交戰與無雙峰值覆蓋。
- Probe roster 為完整 castle roster 的 nearest-first 巢狀子集；排序只在 probe 路徑生效。spawn 與初次 AI 建構使用同 seed；一般場景 default 7 與 retry 延續 RNG stream 保持原契約。

## 正式驗收契約（能力未齊備前 NOT_RUN）

20→50→100→200→300；每級 seed 7／11／23 各自重新建構、暖機 30 秒、真實時間採樣 180 秒。20 人三 seed 全部通過才進 50 人，以此類推；任一必要能力未知或級別失敗停止下一級。另做 30 分鐘 soak。缺樣、重複或不連續 frame、失焦不靜默排除。

E02 硬體：Windows 11 Pro、i5-13500、RTX 4060 Ti、63.75 GiB RAM；本次唯讀 CIM 確認 driver `32.0.15.8097`、1920×1080、60 Hz。Player 仍為 Unity 6000.6.4f1、Mono、D3D11、Linear、URP17.6、Development build、renderScale 1、VSync 1、targetFrameRate 60。實際 Player readback 必須一致。

nearest-rank 分位數：排序後索引 `ceil(q*n)-1`，不插值。不先四捨五入再判 gate；`wallMs > 50` 嚴格計算。main active 與 render active 各 p95≤16.67ms，`cpuActiveGateMs=max(p95(main),p95(render))`；GPU p95≤16.67ms；wall p99≤25ms；>50ms 比例≤0.001。CPU 與 GPU 不相加。

CPU counter 已扣除等待，不再次扣等待。Recorder `TimeNanoseconds` / 1e6 → ms；未知單位、無樣本、零 timing 均 null。FrameTiming API 的 ms 不套用此換算。[Unity 6000.6 counter 定義](https://docs.unity3d.com/6000.6/Documentation/Manual/frame-timing-manager-counter-reference.html)。短 probe 的 profiler samples 是回傳幀資料，尚未建立正式逐幀 timing timestamp 對齊／去重／收尾契約。

## 跑前記憶體允收界線

以下為上述 reviewer 在任何 probe 結果出現前提出、主控採納的工程 budget；2026-10-07 契約修訂接受 dedicated 2 GiB 固定上限。不是實測成績。

| 指標 | 絕對上限 | soak 最後與最初完整 60 秒中位數差 | 最後 20 分鐘的每分鐘中位數成長斜率 |
|---|---:|---:|---:|
| 程序 Private Bytes | 4 GiB | ≤max(64 MiB, 起始值 5%) | ≤1 MiB/min |
| GC used | 尚未另定絕對上限，reserved 另記 | ≤max(16 MiB, 起始值 5%) | ≤0.5 MiB/min |
| 程序 dedicated VRAM | 2 GiB | ≤max(32 MiB, 起始值 5%) | ≤0.5 MiB/min |

暖機後每秒採 raw bytes；相同 workload cycle 比較，不強制 GC。超限阻擋並分析，不逕稱 leak。working set、Unity used/reserved、GC collections／alloc、shared／committed 分列。OS budget／occupancy 保留 null，不宣稱 budget pressure 或 paging 已驗收。

VRAM provider 必須保留 PID、程序啟動時間、各 adapter instance 名稱、provider timestamp、bytes、查詢失敗。以 Player 自己回報的 processStart 核對外部 helper 身分；provider UTC 相對獨立 query start/end 最多落後 2 秒，future tolerance 250ms，query duration≤2 秒。只有整筆有效 sample 才推進各 instance 已接受的高水位；invalid／相等／倒退均不能降低或重設它。只聚合該 Player 的 dedicated；shared／committed 不混加。缺 instance 或 stale data 是 UNKNOWN。正式每幀與每秒 sample 對齊仍需實作。

建置 runner 在 build 完成時保存完整 Player payload 的 SHA-256／bytes，啟動前後重讀核對，包含 managed DLL、資料與模型；不能只用 EXE hash 代表完整 build。Probe output 與 build 必須分別位於 resolved release/e12、release/e02 子目錄，拒絕 traversal／既存 output；失敗報告只寫本次建立的新目錄。launcher 把同一 UUID 傳入 `-e12RunId`，再核對 Player report 的 UUID／PID。

## 當前停止條件與回滾

真正可見數尚缺 per-frame camera-specific occlusion/pixel 判定來源；不能將視錐計數、影子或其他攝影機 visibility 冒充它。此缺口阻擋正式 benchmark 和 soak，但不阻擋能力探測、確定性測試及量測器實作。

後續先依 raw probe 決定最小能力補足範圍，再審查固定 workload、timing 對齊、量測額外成本與真正可見數方法。任何資料不足保留 BLOCKED；不得拿短 probe 的診斷分位數作正式 PASS。E12 全級別、soak、回歸及正式審查完成前，不標 VERIFIED／DONE。

普通 revert 本步量測 commit 即回到 E11；不 reset、force-push、刪除證據或更改遠端。既有 E11 native exit 歷史問題原因 UNKNOWN，未因本輪宣稱修復。
