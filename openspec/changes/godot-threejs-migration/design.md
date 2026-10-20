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
- 歷史 Jev 支援驗收保留「Choice 不等於執行器／PASS」原則；Godot 最終驗收若沿用，需確認可用且獲授權的實際 executor/state/choice/outcome，不要求開啟 Unity、不修改全域設定或擅自產生 provider 呼叫。
