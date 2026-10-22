# SDD ledger — plan: docs/godot/G01_SPEC.md

## 來源與本次範圍

Base`82e98e4ff47523e009e755c8d387fc5e04810cad`；使用者明確要求G01並更新origin/main，刪除舊AGENTS/docs/OpenSpec。本工作尊重該來源，不還原已刪治理；保留獨立審查、安全、來源、品質、有效重試上限與人類驗收。沒有push／PR／merge／公開發布／付費provider授權。

實作者：parent session；獨立實作前review：run`12b5862a-9635-4066-887a-ff45e8653389`，對本base的`G01_SPEC.md`給ACCEPT_SCOPE，沒有實作參與。Requested model Astra；reviewer無獨立backend attestation，結果不冒充GitHub APPROVED或產品驗收。

Pre-flight: runner消費staged-project的10-case JSON，schema/runId/candidate/timestamps在Node與GDScript一致；bootstrap runtime消費runner產生的build_identity.json，export include_filter明列該檔。原Three.js與Unity不變。

## 已驗證的步驟

- 原Web基線：locked `npm ci --ignore-scripts`成功；35 files／308 Vitest tests PASS，無skip。
- Editor來源：固定官方4.7.2 archive的GitHub SHA256與官方SHA512符合；安裝中的exe與archive member逐位元組相同。模板version與8個必要payload hashes固定於toolchain lock，舊下載／解壓證據保留。
- Runner RED：`node-tests-red.log`顯示尚缺模組；最小實作後14 cases GREEN。
- Payload完整性 RED→GREEN：新增dot-directory內容應被manifest檢出，原先只跳過import cache的實作不符合完整包要求。改成只有project快照略過`.godot`；export payload所有dot目錄納入。15 cases GREEN。
- Package adapter RED→GREEN：重用既有`createZip`，新增root-relative真實ZIP roundtrip／overwrite拒絕測試，16 Node cases PASS。無新增依賴。
- 實際inventory PASS、Godot import PASS、SceneTree 8 cases PASS：scene載入、scope可見、初始計數、實際Button signal改可見文字、第二次累加、renderer設定、embedded build identity。
- 原Web最終相容性：`npm run check`（308 tests＋typecheck/build）及`npm run package:itch` PASS。只打包，未上傳；原source／assets／package/lock未改。

上述開發期Godot報告記錄base HEAD及dirty source manifest，沒有假稱新實作已在base commit。正式候選SHA／clean export／QA身份與最終review記在worktree外的不可自引用manifest。

## 第一候選QA與修正輪次

`e72ade6` clean候選實際Windows／Web export、兩平台ZIP與8 cases PASS。Web在headed Chrome的子路徑iframe可見渲染、WebGL2、single-thread、embedded身分與counter 0→1皆已觀察且當時無console errors；但額外按原生Quit後引擎出現`Pages in use exist at exit in PagedAllocator`，不能算整個Web console gate PASS。保留原始console與截圖，產品修正輪1/2：Web不提供原生程式Quit，由host關頁面，Windows保留Quit。先新增兩個UI平台配置cases觀察8/10、2 failed的RED，再加入最小平台配置，下一個clean候選重新export／QA，不能挪用舊包PASS。

Windows普通前景呼叫失敗；診斷確認owned PID不在前景，且後續可見點命中檢查不是owned window，因此沒有送出輸入、沒有拍其他視窗。前景自動化2/2已用盡，維持ENVIRONMENT_FAILURE／未驗；不改ACL、不接管別的視窗、不再自動重試，需操作者解除遮蔽／焦點條件。暫時啟動的舊exe不算QA PASS。盤點當時runtime.log為空；審查時已出現舊candidate的READY與1–8計數，沒有可歸屬的輸入／時間／前景圖或G01_QUIT證據。原件不覆寫，外部`native-log-reconciliation.json`與hash快照補記差異，不能推定操作者或升格為驗收。

## 獨立實作審查與診斷修正

`0a7375c`的fresh Astra reviewer完整讀13檔diff與raw evidence，給implementation OK with notes、G01 acceptance BLOCK／INCOMPLETE，沒有P0/P1。P2成立：版本probe原本只留trimmed版本，遺失stderr/exit等完整process result；postflight也沒有持久化。產品修正輪2/2：先加診斷測試看RED（包含Windows無效exe的同步spawn UNKNOWN），再保存完整`versionProbe`、`postflightInventory`及同步spawn失敗result。Node17/17 GREEN。此修正不碰Godot場景／原Web，修正候選SHA與實際盤點結果另封存外部；後續只做該finding及blast-radius的獨立follow-up，不重做整份scope審查。

reviewer只具唯讀工具，沒有執行命令或自行hash/decompress；報告明列親讀logs／圖片與parent執行證據的差別。不把模型requested名稱當backend attestation、不把implementation判斷當Windows QA或GitHub counted approval。

## 封存前快照／最終結果見外部manifest

- [x] 獨立實作前scope接受與工具來源核對。
- [x] Node17 cases GREEN；Godot10 cases（`0a7375c`）及保留Web308回歸PASS。
- [x] `0a7375c` clean export與完整payload／ZIP CRC/SHA256驗證PASS。
- [x] 同候選Web子路徑iframe可見輸入0→1、WebGL2、console0、完整包身份PASS；只關閉task-owned瀏覽器。
- [ ] 診斷修正候選的exact-head盤點／受影響驗證與獨立finding follow-up。
- [ ] 最新候選Windows前景按鈕與正常退出；焦點budget已用盡，需操作者解除環境阻礙並提供追加額度，未自動重試。

狀態為IN_PROGRESS，不是已merge、已發布或完整移植成功；需要的人類視聽／手把及Jev自然最高S、300兵／17招／四難度／長測都是後續產品驗收，現在NOT_RUN。此candidate不宣稱它們完成，也不自行進G02。

## 證據與保全

本任務外部證據：`C:/Repos/changshan-longdan-godot-evidence/g01-20261021/`。包含baseline／來源hash／RED-GREEN／Godot raw logs與reports；產物不可覆寫，新的run使用新目錄。獨立review需親讀完整diff/source/tests/evidence，區分提供者結果與自行重跑。

TDD預期RED與本任務fixture刪除只涉及本任務新建暫存；無操作舊worktree／原資產／credentials。正式失敗修正最多兩輪，不因換run目錄／方法重計；產品修正輪已用2/2；Windows焦點自動化已用2/2，保留缺口而非換方法重設。若runtime/export有錯先定位，保留raw並依同一上限處置，不無限重跑。

## 下一步與授權

完成當前G01實作／驗證／獨立審查屬有效範圍，無需重問已決定事項。任何push、PR、merge、remote deletion、公開itch、付費／Jev影像傳送仍需具體範圍授權。候選有新變更需更新版本綁定與受影響驗證，不挪用舊SHA PASS；尚未merge的worktree與所有證據保留。
