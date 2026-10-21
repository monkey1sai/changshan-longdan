# SDD ledger — plan: docs/godot/G01_SPEC.md

## 來源與本次範圍

Base`82e98e4ff47523e009e755c8d387fc5e04810cad`；使用者明確要求G01並更新origin/main，刪除舊AGENTS/docs/OpenSpec。本工作尊重該來源，不還原已刪治理；保留獨立審查、安全、來源、品質、有效重試上限與人類驗收。沒有push／PR／merge／公開發布／付費provider授權。

實作者：parent session；獨立實作前review：run`12b5862a-9635-4066-887a-ff45e8653389`，對本base的`G01_SPEC.md`給ACCEPT_SCOPE，沒有實作參與。Requested model Astra；reviewer無獨立backend attestation，結果不冒充GitHub APPROVED或產品驗收。

Pre-flight: runner消費staged-project的8-case JSON，schema/runId/candidate/timestamps在Node與GDScript一致；bootstrap runtime消費runner產生的build_identity.json，export include_filter明列該檔。原Three.js與Unity不變。

## 已驗證的步驟

- 原Web基線：locked `npm ci --ignore-scripts`成功；35 files／308 Vitest tests PASS，無skip。
- Editor來源：固定官方4.7.2 archive的GitHub SHA256與官方SHA512符合；安裝中的exe與archive member逐位元組相同。模板version與8個必要payload hashes固定於toolchain lock，舊下載／解壓證據保留。
- Runner RED：`node-tests-red.log`顯示尚缺模組；最小實作後14 cases GREEN。
- Payload完整性 RED→GREEN：新增dot-directory內容應被manifest檢出，原先只跳過import cache的實作不符合完整包要求。改成只有project快照略過`.godot`；export payload所有dot目錄納入。15 cases GREEN。
- Package adapter RED→GREEN：重用既有`createZip`，新增root-relative真實ZIP roundtrip／overwrite拒絕測試，16 Node cases PASS。無新增依賴。
- 實際inventory PASS、Godot import PASS、SceneTree 8 cases PASS：scene載入、scope可見、初始計數、實際Button signal改可見文字、第二次累加、renderer設定、embedded build identity。
- 原Web最終相容性：`npm run check`（308 tests＋typecheck/build）及`npm run package:itch` PASS。只打包，未上傳；原source／assets／package/lock未改。

上述開發期Godot報告記錄base HEAD及dirty source manifest，沒有假稱新實作已在base commit。正式候選SHA／clean export／QA身份與最終review記在worktree外的不可自引用manifest。

## 待驗證／候選狀態

- [x] 獨立實作前scope接受與工具來源核對。
- [x] Node16 cases與實際headless8 cases、保留Web回歸。
- [ ] 固定clean candidate後實際Windows／Web export與完整payload／ZIP驗證。
- [ ] Windows前景按鈕與正常退出；Web子路徑iframe前景輸入、WebGL2、console/network與實際包身份。
- [ ] 未參與實作的獨立final exact-head review與問題處置。

狀態為IN_PROGRESS，不是已merge、已發布或完整移植成功；需要的人類視聽／手把及Jev自然最高S、300兵／17招／四難度／長測都是後續產品驗收，現在NOT_RUN。此candidate不宣稱它們完成，也不自行進G02。

## 證據與保全

本任務外部證據：`C:/Repos/changshan-longdan-godot-evidence/g01-20261021/`。包含baseline／來源hash／RED-GREEN／Godot raw logs與reports；產物不可覆寫，新的run使用新目錄。獨立review需親讀完整diff/source/tests/evidence，區分提供者結果與自行重跑。

TDD預期RED與本任務fixture刪除只涉及本任務新建暫存；無操作舊worktree／原資產／credentials。正式失敗修正最多兩輪，不因換run目錄／方法重計；目前無正式候選修正輪次。若runtime/export有錯先定位，保留raw並依同一上限處置，不無限重跑。

## 下一步與授權

完成當前G01實作／驗證／獨立審查屬有效範圍，無需重問已決定事項。任何push、PR、merge、remote deletion、公開itch、付費／Jev影像傳送仍需具體範圍授權。候選有新變更需更新版本綁定與受影響驗證，不挪用舊SHA PASS；尚未merge的worktree與所有證據保留。
