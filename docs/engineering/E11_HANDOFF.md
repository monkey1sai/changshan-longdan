# E11 交接（Claude → Codex）

建立：2026-10-07（Asia/Taipei）。本檔未提交（untracked），由接手者決定納入 PR 或刪除。接手前先讀 `AGENTS.md`、`docs/engineering/MUSOU_EXECUTION_PLAN.md`（E11 段與台帳）、`docs/engineering/E10_ASSETS.md`、`docs/engineering/E08_CROWD.md`。

## 目標與完成條件（來源：MUSOU_EXECUTION_PLAN.md E11）

「戰場節奏與 Director 基線」：對照 E08 已移植的 Director（KO 0/60/150/240 → Opening/Pressure/Surge/Finale）建立可重現的小戰場量測，記錄遭遇間隔、空跑、堵門、階段切換與壓力；驗證跨階段、死亡、重試、提示更新、必要通路可達、無軟鎖；固定 seed 重播與自然遊玩分開記錄。commit 主題 `feat(battle): validate bounded director encounter loop`。不做：真正增援、友軍、劇情任務、第二角色、新場景位置。

DONE 條件沿用前步：fresh clone Unity 五階段通過＋Web 回歸＋advisory 審查處置＋使用者試玩＋使用者逐項授權 push／PR／merge＋合併後確認＋台帳 DONE（限定接受；GitHub counted approval NONE）。

## 使用者已決定的範圍（2026-10-07）

- **A1**：Unity `RouteRecorder` 新增 e11 模式（固定 seed 腳本路線穿越城池），每幀記錄交戰人數／攻擊者／階段／KO／是否空跑／是否卡住；Web 以相同輸入產生對照 fixture，Edit Mode 比對每秒摘要（同 E08 `web-crowd.json` 作法）。自然遊玩由使用者試玩，另行記錄。
- **B1**：移植 `phase`／`milestone`（每 100 KO）／`halfDefeated` 橫幅到既有 `FeedbackView` 橫幅；文字沿用 Web `src/ui/i18n.ts`（`battle.opening` 魏軍列陣／`battle.pressure` 敵軍壓上！／`battle.surge` 攻勢加劇！／`battle.finale` 最後包圍！，英文同檔 45–48 行；`${ko} 人斬！`／`魏軍 半數潰滅`），Unity 以設定切換語言（可比照 E09 `changshan.shake` 的 PlayerPrefs 鍵與 session 覆寫）。
- **C1**：純邏輯格狀可達性測試（Web Vitest＋C# Edit Mode 各一組）：從起點以角色半徑在 `obstacles()` 矩形上做 BFS，驗證 25 個小隊中心與隊長位置皆可達、最窄通道 ≥ 角色直徑；路線錄影另記錄「有移動輸入卻不前進」的時間。

## 目前狀態

- main `30bdbac`（E10 結案已合併）；worktree `C:\Repos\changshan-longdan\.worktrees\e11-director`，分支 `claude/e11-director`（無新提交，已 `npm ci`）。
- 只做了範圍審查與原始碼盤點，**尚未修改任何程式**。
- 未取得的授權：push／PR／merge（每次都要使用者明確授權）；不得付費生成。

## 盤點結果（已讀，供實作定位）

Web：
- `src/entities/battle.ts`：`updatePressure()`（324–329）推 `phase` 事件；`resolveKills()`（378–392）推 `milestone`（`KO_MILESTONE = 100`）與 `halfDefeated`（`spawnCount/2`，向上取整）；`checkOutcome()`；`Battle.step` 回傳 dt。
- `src/entities/battle-director.ts`（44 行）：`PHASES` 表與 `update(ko, profile)`。
- `src/entities/castle-setup.ts`：`squadSpawns(SQUADS, createRng(7))`，`CASTLE_CAPACITY = 320`。
- `src/entities/enemies.ts:587`：`squadSpawns`——每小隊 3×4，`s % 3 === 0 && row === 2 && col === 1` 為隊長（隊長 HP 230×captainHp、重擊 70）。
- `src/world/layout.ts`：`SQUADS`（4 列 × 5 行 + 5 個額外中心）、`obstacles()` = KEEP、STAIRS、BARRACKS×6、WRECKS、BRAZIERS(±0.6)；`PLAYER_START {0, 42, π}`；`PLAY_LIMIT = 55`；`GATE_HALF = 6`（城門只在視覺，邏輯層無牆內通道限制）。
- `src/entities/arena.ts`：`constrain(p, radius)` 矩形推出。角色半徑請查 `src/entities/player.ts`／`src/core` 的常數（未查）。
- `src/presentation.ts:140–152`：`hud.showBanner(() => t('battle.<id>'), 2)`、milestone 金色 2 s、halfDefeated 2 s。
- `src/ui/i18n.ts`：`Locale = 'zh-Hant' | 'en'`、`t()`、`translate(zh, en)`；語言由 `#language-select`（`src/ui/interface.ts`）切換。
- fixture 產生器：`scripts/combat-parity.mjs`（`npm run parity:write`／`parity:check`）＋ `scripts/lib/crowd-parity.ts`（城池每秒摘要的既有範例，E08）。

Unity（`unity/ChangshanLongdan/Assets`）：
- `Combat/Runtime/Difficulty.cs`：`DifficultyProfile`、`BattlePhase`、`BattlePressure`、`BattleDirector`（`Phases` 規則表）。
- `Combat/Runtime/CombatSimulation.cs`：`Director`、`Phase`、`KoCount`、`DamageSum`、`Events`（`CombatEventType.Phase` 已存在，**Milestone／HalfDefeated 事件尚未存在**）、`Restart()`、`SetDifficulty()`。
- `Combat/Runtime/HitTargets.cs`：`AliveCount`、`Attackers`、`EngageRange`、`MaxAttackers`、`Reset(spawns)`、`DefaultSeed = 7`；交戰人數請查其 `Engaged`／狀態陣列（未查確切屬性名）。
- `Combat/Runtime/CastleLayout.cs`：`Squads`、`SquadSpawns`、`Spawns()`（Mulberry32 seed 7）；`Combat/Runtime/Arena.cs`：`ArenaLayout.Obstacles()`、`CreateArena()`、`Arena.Constrain(ref x, ref z, radius)`。
- `Character/Runtime/ZhaoYunController.cs`：`UsePressureCrowd(bool)`（E08 城池人群，F 鍵？請查 dev keys）、`StartBattle(difficulty)`、`CheckOutcome()`（257）、`Restart()`／`ResetFight()`（360–378）、`PlayFeedback()`（275–295，事件 switch 只更新 `LastHit` 除錯字串）。
- `Character/Runtime/FeedbackView.cs`：`BannerText`／`BannerLeft`（34–35），IMGUI 繪製於 381–384，`PlayStep/PlayStrike` 內設定橫幅（請查哪些 cue 會設橫幅）；橫幅文字目前無 i18n。
- `Character/Runtime/GameFlow.cs`：IMGUI 標題／暫停／結果（雙語 inline 字串）、`SelectedDifficulty`、`Ended()`、`StartRequested()` 重試。
- `Character/Runtime/RouteRecorder.cs`（353 行）：三個模式以 `-e06Route`／`-e07Feedback`／`-e09Camera <dir>` 啟動；`RouteFrame`／`RouteLog` 可序列化欄位；每幀 `controller.Tick(FrameSeconds)`、截圖、離線混音；E09 用 `CameraSegments` 傳送角色。e11 可比照新增 `-e11Director <dir>`：啟動 `UsePressureCrowd(true)`＋`GameFlow` 開戰（確保 seed 7 與 Web 相同），路線以 WASD 穿越數個小隊（例如起點 (0,42) 往北經 z=24、10、−4 列），記錄 `engaged`／`attackers`／`phase`／`ko`／`alive`／`idle`（engaged=0）／`stuck`（有移動鍵但位移 < 門檻）。
- `scripts/record-route.mjs`（179 行）：`--mode` 白名單、每模式的檢查與 manifest；e11 需加模式、檢查（階段至少進入 Pressure？視路線擊殺數而定；無 stuck 連續 > N 秒；idle 總時間上限）與 `camera`／`feedback` 類似的 `director` 摘要。
- `scripts/unity-validate.mjs` `testInventory`：新增測試類別必須登記確切數量（否則 `TEST_SET_INCOMPLETE`）；Player 階段帶 `-e09NoFlow`。
- 既有測試：`Foundation/Tests/EditMode/CrowdParityEditTests.cs`（`DirectorPhasesFollowTheKills`、`CastleSpawnsMatchWeb`…）、`PlayMode/CrowdPlayTests.cs`（`PressureCrowdEngagesAndStrikesThePlayer`、`DifficultyCyclesWithAFreshFight`）。

## 建議實作順序（可調整，不改目標）

1. **事件**：`CombatSimulation` 依 Web `resolveKills` 推 `Milestone(ko)`／`HalfDefeated`（需 spawnCount）；Edit 測試對照 Web（含 100 KO 與半數同時達成時 Web 只推 milestone 的分支）。
2. **橫幅／語言**：`FeedbackView` 新增 `ShowBanner(text, seconds, gold)`；`ZhaoYunController.PlayFeedback` 接 Phase／Milestone／HalfDefeated；新增小型 `Strings`（zh-Hant／en 表，鍵名同 Web i18n）＋ PlayerPrefs `changshan.locale`＋ session 覆寫；Play 測試驗證三種橫幅文字與時長、語言切換。
3. **可達性**：Web `tests/layout-reachability.test.ts`（Vitest；用 `obstacles()`、角色半徑、格距 0.25 m BFS）與 C# `LayoutReachabilityEditTests`；斷言 25 中心＋隊長位置可達、最窄通道寬度。
4. **路線與 fixture**：`RouteRecorder` e11 模式；`scripts/lib/director-parity.ts` 以 Web `Battle`＋`castleSetup()` 跑同一輸入序列產生 `unity/.../Fixtures/web-director.json`（每秒 engaged／attackers／phase／ko／alive／player x,z；含死亡與重試一段）；Edit 測試回放比對；`record-route.mjs --mode e11` 檢查。
5. **死亡／重試／跨階段**：Play 測試——注入致死傷害 → `GameFlow` 結果 → 重試後 `Phase == Opening`、KO 0、士兵回到 spawn（Web 重試不重新播種，沿用）。
6. 文件 `docs/engineering/E11_DIRECTOR.md`＋台帳列 IN_PROGRESS → AWAITING_REVIEW；PR 內附步驟紀錄（`MUSOU_STEP_RECORD.template.md`）。

## 驗證迴圈（沿用 E07–E10）

- Web：`npx vitest run --exclude "release/**"`、`npm run typecheck`、`npm run parity:check`、`npm run test:unity-runner`。
- Unity fresh clone：`git clone --no-hardlinks --no-checkout ./.worktrees/e11-director .worktrees/_clones/e11-a && git -C .worktrees/_clones/e11-a checkout --detach <sha>`，複製 `.worktrees/_clones/e10-a/release/e02/{official-package-cache,upm-cache}` 到 clone 的 `release/e02/`，`npm ci`，然後 PowerShell（機器＋使用者 PATH）：`npm run unity:validate -- --editor "C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe" --out release/e02/e11-a`；結果 `result.json`／`*/tests.xml`。
- 錄影：`node scripts/record-route.mjs --mode e11 --player <clone>\release\e02\<run>\build\player\ChangshanLongdan.exe --out release/e02/<dir> --ffmpeg "C:\Windows\ffmepg\bin\ffmpeg.exe"`（路徑 `ffmepg` 為機器上的實際拼法）。
- 證據封存：`.worktrees/_evidence/e11/`（本機、不入 Git）。
- advisory 審查：唯讀 code-reviewer 一輪，處置 HIGH／MEDIUM，LOW 記錄延後。

## 限制與注意

- 提交訊息結尾 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 是 Claude 的規則；Codex 依自身規則署名。PR 需附步驟紀錄與實際 run ID。
- 不修改 `src/`（Web 行為是基線；只允許新增 scripts／tests／fixtures）。若 E11 量測發現 Web 本身的節奏缺陷，記錄為發現，不在本步修。
- E08 已知限制仍在：重試不重播種、`engaged=0` 的 Engage 漏狀態、300 人效能屬 E12。
- 美術端 `C:\Repos\mmo-asset-pipeline` 與本步無關。
