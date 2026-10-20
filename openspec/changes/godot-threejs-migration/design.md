## Context

使用者批准直接移植 Three.js 至 Godot，Windows 與瀏覽器／itch.io 都要；不是 Unity source port。來源 SHA `034e27052f02967d55241abae80659f2c64ded78`。完整來源對照見 [設計](../../../docs/engineering/GODOT_MIGRATION_DESIGN.md)，決策及目前環境見 [ADR](../../../docs/engineering/GODOT_ADR.md)。G00 scope advisory 已接受，formal APPROVED／merge／post-merge 未完成。

## Goals / Non-Goals

**Goals:** 同一 Godot project 的 Windows x64 與 Web；保留全部原玩法、300 兵、模型、流程及 S01–S08；明確 TS 對照、資產 provenance、測試與人類驗收。先驗雙平台工具鏈再加 gameplay。

**Non-Goals:** 繼續 Unity E12、刪舊工程、改美術或平衡、新玩法、Godot C# 或非官方 TypeScript runtime、付費、全域 Jev 配置、發布。本單元 G00 不建立 runtime 或下載 templates。

## Decisions

1. **Adopt Godot 官方 GDScript／Compatibility／single-thread Web**，避免 C# 無法 Web export；Windows 同基線，先不分叉 Forward+。Godot 4.7.2 是既有 executable 觀察值，非完整供應鏈驗證，templates 尚缺。
2. **Port 規則，重用資料及測試語義**：Battle／玩家／命中／EnemyStore SoA／Director 不依賴呈現裁決；presentation 消費事件。沿用 `scripts/lib/*-parity.ts`、tests 及 layout 資料，不把 Three.js runtime 嵌進 Godot。RNG、float 精度、facing 與不同頻率的邊界容差先定義再跑，不改 golden 迎合實作。
3. **唯一 controller 位移權威**：保留 meter/second/radian 與原移動曲線、hit-stop/input/game/animation 時鐘；已知點測 Godot 朝向及模型邊界，不整世界任意翻 Z。
4. **重用現有資產而非重製**：GLB／manifest／來源 hashes、程序士兵、城池 layout。MultiMesh 按空間分批，驗包圍盒、instance flash、動畫與 Web 成本；骨架或蒙皮缺陷交回美術契約，不隱藏或當成引擎替換已修復。Control/InputMap/音訊適配取代 DOM/WebAudio；AudioStreamGenerator 與離線合成方案待實際時序／延遲驗證，不增加音樂授權風險。
5. **Evidence first**：Windows full package 與 Web ZIP 均鎖 code/profile/asset/full-build hashes；Windows 自然操作不代表 Web iframe 通過。原 Web 交付持續可重現，舊 Unity PASS 不作 Godot 證據。
6. **Jev最高評級自然破關為硬gate**：依新增SPEC，Windows／Web各至少一場同版輸出包，由Jev依合法遊戲畫面選動作、實際executor操作，正常結算win=true、實際ko=300、既有rank=S（battle seconds<300且damage<400）。沒有數值總分，不新增計分系統；300KO獨立於rank函式核對。這是額外完成條件，不替代四難度／S01–S08、品質／效能／人工感官或正式交付gates，也不默認每難度各一場S。
7. **跑前protocol與完整證據**：鎖定難度／seed／effective設定／完整包hash、model/helper/executor、state freshness／前景、固定有界合法action、battle與wall／pause時間語義、實際request/token/cost/attempt上限及停止條件；待eligible階段另核准provider／遊戲影像傳送／cost，現在不呼叫。連續session影片含setup與觀察暫停，保存有序frame／observation／decision／execution／outcome、terminal結算及stderr/失敗attempt/hash。禁止DEV/debug、health/musou/state注入、強制清場、timeScale／改分、hidden-state觀察、人工戰鬥代打或主控替換Jev決策；setup-only援助另記。不可用／非S／缺鏈／預算用盡皆不通過，不以confidence判PASS、不跨平台或目錄重開同任務預算。

## Risks / Trade-offs

- Web 單執行緒 300 兵 CPU 成本 → G02 即開始代表性測量，G04 逐級量測；不減兵或換不可見窗口過關。
- Compatibility 對原後製視覺不同 → 明列 VFX/shader 對照與真實 render／使用者確認；不保證 pixel-identical。
- GC、GPU active、VRAM API 跨平台不等價 → 先審來源、單位、frame identity、latency、dedup/drain、記憶體時間對齊與成本；無來源為 UNKNOWN/BLOCKED。Godot 非託管 VM 不偽稱 .NET GC 指標，對等 managed/script allocation 語義需獨立接受；未接受不視為原指標 PASS。
- Godot executable 有而 matching templates 缺失 → G01 缺項阻擋，另請固定版本下載授權，不安裝最新版本碰碰運氣。
- 舊 Unity E12 兩輪用盡 → 保存原預算不執行其復原方法；新方法需具體範圍審查與額度，不自動重試。

## Migration Plan

G00 決策與 SPEC → G01 雙平台工具鏈 → G02 一招對一敵可玩切片 → G03 完整規則／視聽／UI／300 兵 → G04 固定版本完整驗收。每期 DONE 後才進下一期；G00 plan 可描述 G01，但不能在其 gates 前建立工程。每期 ordinary revert、保留 raw evidence；不改公開版本／不刪舊 source。CI、正式 review、merge 及 post-merge 分列。

## Open Questions

- G01 尚缺固定官方 templates 的下載授權與 archive/executable checksum 對照；不能以本機 CLI 版本替代。
- G02/G03 音訊合成方案、實際材質／MultiMesh 實作、字型供應由相應 scoped 實作及證據決定，不影響已批准的平台／來源方向。
- G04 的 Web GPU/VRAM 與非 .NET allocation 對照尚未證明；必要數據不齊時保持 BLOCKED，改驗收契約須另行 review／人類批准。
- Jev最高S自然破關已是強制最終條件，保留「Choice不等於執行器／PASS」。現有`jev-vision-player.py`／`jev-1.14.0`契約及歷史Web S僅供重用／方法參考；Godot Windows／Web executor、模型實際能力／版本、跑前難度／seed／暫停協議及獨立task預算尚待eligible階段核對與批准，不能借舊紀錄當Godot PASS或自行重設已用預算。缺能力不刪此gate，保持BLOCKED。不要求開Unity、不修改全域設定、不讀出credentials或擅自呼叫provider。
