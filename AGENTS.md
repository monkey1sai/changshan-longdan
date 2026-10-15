# Repository Guidelines

## 主工作區、隔離開發與完工清理

- 主工作區 `C:\Repos\changshan-longdan` 固定使用 `main`，與最新 `origin/main` 同步。開始任務及遠端合併後先核對分支、HEAD、tracked／untracked／ignored 狀態，再 `git fetch --no-tags origin main`，只允許以 `git merge --ff-only origin/main` 更新主工作區；核對兩者 SHA 相同。若有分歧、修改或路徑衝突會被覆寫，保留現況並回報阻礙，不以 reset、clean、stash 或強制切換消除問題。
- 任何檔案修改都必須先建立本任務專用的 Git worktree 與 feature branch（預設 `codex/` 前綴），從已更新的 `origin/main` 開始；程式、測試、文件、治理、設定與驗收記錄均適用。主工作區僅供唯讀檢查與上述同步，不直接編輯、stage、commit 或開發；任務產物放在隔離 worktree 或指定的外部證據位置。臨時 clone 或直接在主工作區開 feature branch 不能替代 worktree 隔離。
- 工作順序為：同步與狀態盤點 → 建立隔離 worktree → 修改及適用驗證 → 必要獨立審查與授權 → 合併至遠端 `origin/main` → 同步主工作區 → 保全證據並清理本任務 worktree。既有 SPEC、同版本驗收、必要人類核准、branch protection 與有效重試上限繼續適用。
- **完工的必要條件是變更已 merge 到遠端 `origin/main`**；本地 commit／merge、push、PR 建立或 CI 通過均不算完工。以遠端讀回、更新後的 `origin/main` 及合併結果核對實際交付版本；squash／rebase merge 核對 PR 的 merged 狀態、合併 SHA 與交付內容，不只檢查原 feature HEAD 的 ancestry。合併不取代任務的測試、產品驗收與 post-merge 檢查；報告只有在這些條件及收尾清理完成後才可標示「已完成」。
- 每個已合併的任務 worktree 都必須收尾清理，不能把「已合併但 worktree 尚未處理」當作完成。移除前重新核對完整路徑、HEAD、分支、狀態、遠端合併證據與備份；比對本次核准的清理範圍，有新變動即保留並列為待處理。
- 清理須盤點 staged、unstaged、untracked 及 ignored 內容，包括驗收證據與未提交成果；Git commit／bundle 不能代替未追蹤或 ignored 檔案的備份。需保留的內容先存到待刪目錄以外，記錄原路徑、版本與雜湊並驗證可還原；備份不足或無法驗證時保留 worktree、回報清理受阻。既有共享驗收證據、還原備份與其他任務的 dirty 內容不得隨 worktree 刪除。
- 僅在上述檢查通過後，以不帶 `--force` 的 `git worktree remove <本任務完整路徑>` 移除本任務 worktree，核對目錄已移除及 `git worktree list` 已無該項，並再次確認主工作區與最新 `origin/main` 同步。只在已授權範圍內清理本地任務分支；不得順帶刪除其他 worktree／clone、其他分支、遠端分支、tag、共享證據或還原備份。
- 這些規則定義開發與收尾要求，不擴大任何任務的 push、PR、merge、遠端刪除或其他外部寫入授權；缺少具體授權或必要審查時，保留隔離 worktree，清楚列出尚未合併／尚未清理及下一步，不冒稱完工。

## Project Structure

A PS2-style musou action game (Zhao Yun vs. 300 Wei soldiers) with a retained Vite/TypeScript/Three.js web implementation and an isolated Unity project at `unity/ChangshanLongdan`. The web source map below describes that implementation; inspect the current source for the assigned target rather than treating it as a complete Unity inventory. Web audio is synthesized with WebAudio.

## Task Scope And Completion

- For non-trivial work, record the user's goal, authorized scope, completion conditions and sources. The user assigns the task; applicable SPEC clauses supply intended acceptance within that scope; the plan is the method; source/tests/runtime supply observed state. Without a SPEC, derive explicit conditions from the request.
- After a checkpoint, continue necessary authorized work whose prerequisites and phase gates hold. Close against this task's conditions, without silently extending a one-phase commission to the whole SPEC. Missing evidence remains a completion gap; independent authorized work may continue while an affected action is blocked.
- Security, source preservation, quality thresholds and required independent review are binding. Workflow defaults may be refined without waiving them. A material unresolved choice, missing authorization, concrete blocker or user stop request ends the affected action; report the required next step and actual options.
- Targeted entry points: web behavior uses the source/commands below; engine changes use [accepted Unity ADR](docs/engineering/E02_UNITY_ADR.md); migration acceptance uses [Unity follow-up SPEC](openspec/changes/unity-migration-followup/specs/unity-migration-completion/spec.md) and its [tasks](openspec/changes/unity-migration-followup/tasks.md); asset work uses the collaboration contract below. Load the relevant workflow, not every production process for a documentation change.

## Web Source Map

- `index.html` — page shell, HUD markup and title/pause/result screens.
- `src/main.ts` — entry point; `src/game.ts` — main loop, mode switching and wiring; `src/presentation.ts` — turns `BattleEvent`s into sound, effects, camera shake and HUD banners through narrow sinks.
- `src/combat/` — move data (hit windows, damage, reactions), combo rules, hit shapes. Pure logic.
- `src/entities/` — battle rules (`battle.ts`: one fight's step, events, outcome, difficulty and battle-phase pressure), player state machine, enemy AI/physics in SoA typed arrays, the musou dragon strike, arena collision. Pure logic.
- `src/core/` — math, input, spatial hash, two-bone IK.
- `src/world/` — castle layout (shared by rendering and collision), geometry, sky, flags, fire, lights, textures.
- `src/view/`, `src/fx/`, `src/render/`, `src/audio/`, `src/ui/` — rendering, effects, post-processing, audio, DOM UI.
- `tests/` — Vitest tests for the pure-logic modules.
- `public/models/` — Zhao Yun GLB and provenance manifest; `src/view/zhaoyun-adapter.ts` centralizes inspected asset and bone mappings.
- `CONTEXT.md` — domain glossary; use its terms in code, tests and docs.

## Commands

Run from the repository root with Node.js `^22.12.0 || ^24.0.0 || >=26.0.0`:

- `npm install` — install dependencies.
- `npm run dev` — start the dev server at http://localhost:5173.
- `npm test` — run Vitest once.
- `npm run typecheck` — type-check `src/` and `tests/`.
- `npm run build` — type-check, then build to `dist/`.
- `npm run preview` — serve the `dist/` build.
- `npm run package:itch` — build, check itch.io HTML5 limits and write `release/changshan-longdan-web.zip` (ignored by Git).

Builds must keep relative asset paths (`base: './'`) because itch.io serves games from a subdirectory inside an iframe. Keep `public/THIRD_PARTY_LICENSES.txt` in sync with bundled third-party code. Store-page copy, upload settings and the current itch.io release record live in `docs/itch-page.md`; update the record (file size, SHA-256, source commit) whenever a new build is uploaded.

## Coding Style

TypeScript strict mode with `erasableSyntaxOnly` (no enums or parameter properties; use `as const` objects), ES modules, 2-space indentation, LF line endings, UTF-8. Import local modules with the `.ts` extension. Keep game rules in `combat/` and `entities/` free of DOM and WebGL so they stay unit-testable; `game.ts` and `presentation.ts` react to `BattleEvent`s and must not decide combat outcomes themselves; change hit feel in `presentation.ts` and cover it in `tests/presentation.test.ts`. Avoid per-frame allocations in hot paths; reuse scratch vectors and typed arrays. Place shared world coordinates in `src/world/layout.ts` so rendering and collision cannot drift apart.

## Testing

Add or update Vitest tests for every change to combat, AI, player, battle or layout logic; test battle rules through `Battle` with a small `BattleSetup`. Visual and feel changes must be checked in a real browser with `npm run dev`; a passing test run is not visual verification. In dev builds `window.__game` exposes `state`, `advance(frames, input)` and other hooks for scripted checks. Chrome pauses `requestAnimationFrame` for hidden or occluded windows, so scripted runs in a background tab are supporting evidence only; confirm frame rate and input feel in a visible window.

## Model Asset Collaboration

- 需要新增、替換或修改模型、材質、骨架、動畫、碰撞代理或 LOD 時，預設先向 `mmo-asset-pipeline` 美術工程師提出需求，依 [模型資產協作契約](docs/art/asset-collaboration.md) 取得交付、在遊戲內驗收並回饋修改。
- 缺少美術工作區時，依契約安全 clone 已確認來源；不得覆寫既有工作。美術流程保持通用，遊戲風格、引擎與玩法要求由需求傳入。
- [既有美術 SOP](docs/art/README.md) 的製作與 QA 閘門繼續適用；本契約補充跨 repo 委託、交付與追溯責任。既有程序式 voxel 說明是目前實作描述，不是禁止依本契約委託新資產。
- 收到模型不代表完成；此規則不授予付費生成、私有資料外傳、push、merge 或部署權限。

## Commits

Use concise imperative subjects, optionally scoped (for example `combat: add jump charge`). Do not commit `node_modules/`, `dist/` or other generated output.

## Musou Engineering Variables

Before changing combat, animation, crowd AI, camera, assets, performance or engine architecture, read `docs/engineering/MUSOU_VARIABLES.md` and `docs/engineering/musou-profile.proposed.json` alongside the existing `docs/art/` workflow.

Keep source baselines, proposed tuning and measured results separate. The proposed profile is NOT connected to runtime; do not claim that creating or editing it changes gameplay. Preserve existing moves, character assets, visible load-failure fallback and weapon tip/tipBase contracts. Unity's accepted direction is recorded in [E02_UNITY_ADR.md](docs/engineering/E02_UNITY_ADR.md); changes to that decision require separate review. Preserve web delivery and the existing TypeScript implementation. The [migration reconciliation](docs/engineering/UNITY_MIGRATION_RECONCILIATION_2026-10-08.md) is a dated inventory with explicit gaps; verify current ancestry/source and same-version evidence before claiming phase readiness or completion.

For each implementation PR, identify changed variable groups and affected S01-S08 acceptance scenarios. Record exact commit/profile/asset versions and distinguish unit tests, rendered checks, natural play and human sensory review. Engine MCP or test runners are valid when they provide equivalent evidence; desktop clicking is not intrinsically required. Never substitute headless results, a screenshot or CI success for complete visual/feel acceptance. Preserve missing evidence and failures. Complete each implementation phase with tests, actual evidence, review and merge before proceeding to the next. No paid asset generation without explicit authorization.

### Executable Step Plan

Follow `docs/engineering/MUSOU_EXECUTION_PLAN.md` (E00-E13) and copy `docs/engineering/MUSOU_STEP_RECORD.template.md` into each implementation PR. PR #8 is the historical specification/plan baseline; plan text and dated ledgers do not establish current readiness or completed gameplay. Reconcile the assigned step with the applicable follow-up SPEC, current ancestry/source and evidence. Implement only the first eligible authorized step, with pre-implementation scope review, positive/negative/boundary tests, applicable rendered/play evidence, scoped commits and independent final review of the exact candidate SHA.

Do not self-approve or carry CI/review/video evidence from an older candidate. Record actual reviewer identity, accessible artifacts, base/head/profile/asset hashes, failures and rollback. Missing tools or evidence must block completion; NOT_APPLICABLE needs a reviewed reason and cannot waive promised acceptance. Mark VERIFIED only after same-version validation and formal independent APPROVED; mark DONE only after an authorized merge and post-merge compatibility checks. Stop after two unsuccessful correction rounds, record the blocker, and never proceed to the next step, merge, publish or spend without the required gates and authorization. Preserve the applicable cap and actual consumed rounds across tools, branches, new hypotheses and resumed sessions; new evidence alone does not grant extra rounds. Retain all S01-S08 scenarios, numeric thresholds and phase gates in their canonical specifications.
