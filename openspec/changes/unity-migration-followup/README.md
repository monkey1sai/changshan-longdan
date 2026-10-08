# Unity 移植後續 SPEC

本 change 承接既有 E02–E13 工程規格，整理已移植功能與剩餘能力／品質／效能／整合驗收。趙雲資產製作交美術工程師；Unity runtime、量測、匯入與驗收由遊戲工程負責。

- [現況盤點](../../../docs/engineering/UNITY_MIGRATION_RECONCILIATION_2026-10-08.md)
- [提案](proposal.md)、[設計](design.md)、[正式要求](specs/unity-migration-completion/spec.md)、[工作清單](tasks.md)

目前U1 tasks1.1／1.2完成本機盤點、raw保全與定位證據；task1.3完成方法獨立審查、可見數工程語義及限定新範圍批准，task1.4正式approval／獨立merge授權／postmerge仍缺。總進度3/22（13.6%，任務計數）；runtime工程、正式E12／E13尚未開始。方法與診斷紀錄見 [能力方案](../../../docs/engineering/UNITY_E12_CAPABILITY_PLAN.md) 及 [U1 step record](../../../docs/engineering/UNITY_E12_CAPABILITY_STEP_RECORD.md)。

OpenSpec artifacts complete 不等於正式批准或Unity移植完成。原角色修復草案與來源紀錄保留，本change不刪除或自動archive它們。兩個診斷腳本僅供受審查的本機方法驗證，既有採樣額度已用完，不因本PR送審而取得再執行權。
