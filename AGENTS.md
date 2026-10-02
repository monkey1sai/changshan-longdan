# Repository Guidelines

## Project Structure

A PS2-style musou action game for the browser (Zhao Yun vs. 300 Wei soldiers), built with Vite, TypeScript and Three.js. All models are procedural voxels and all audio is synthesized with WebAudio; the repository contains no binary assets.

- `index.html` — page shell, HUD markup and title/pause/result screens.
- `src/main.ts` — entry point; `src/game.ts` — main loop, mode switching and system wiring.
- `src/combat/` — move data (hit windows, damage, reactions), combo rules, hit shapes. Pure logic.
- `src/entities/` — player state machine, enemy AI/physics in SoA typed arrays, arena collision. Pure logic.
- `src/core/` — math, input, spatial hash, two-bone IK.
- `src/world/` — castle layout (shared by rendering and collision), geometry, sky, flags, fire, lights, textures.
- `src/view/`, `src/fx/`, `src/render/`, `src/audio/`, `src/ui/` — rendering, effects, post-processing, audio, DOM UI.
- `tests/` — Vitest tests for the pure-logic modules.

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

TypeScript strict mode with `erasableSyntaxOnly` (no enums or parameter properties; use `as const` objects), ES modules, 2-space indentation, LF line endings, UTF-8. Import local modules with the `.ts` extension. Keep game rules in `combat/` and `entities/` free of DOM and WebGL so they stay unit-testable. Avoid per-frame allocations in hot paths; reuse scratch vectors and typed arrays. Place shared world coordinates in `src/world/layout.ts` so rendering and collision cannot drift apart.

## Testing

Add or update Vitest tests for every change to combat, AI, player or layout logic. Visual and feel changes must be checked in a real browser with `npm run dev`; a passing test run is not visual verification. In dev builds `window.__game` exposes `state`, `advance(frames, input)` and other hooks for scripted checks. Chrome pauses `requestAnimationFrame` for hidden or occluded windows, so scripted runs in a background tab are supporting evidence only; confirm frame rate and input feel in a visible window.

## Model Asset Collaboration

- 需要新增、替換或修改模型、材質、骨架、動畫、碰撞代理或 LOD 時，預設先向 `mmo-asset-pipeline` 美術工程師提出需求，依 [模型資產協作契約](docs/art/asset-collaboration.md) 取得交付、在遊戲內驗收並回饋修改。
- 缺少美術工作區時，依契約安全 clone 已確認來源；不得覆寫既有工作。美術流程保持通用，遊戲風格、引擎與玩法要求由需求傳入。
- [既有美術 SOP](docs/art/README.md) 的製作與 QA 閘門繼續適用；本契約補充跨 repo 委託、交付與追溯責任。既有程序式 voxel 說明是目前實作描述，不是禁止依本契約委託新資產。
- 收到模型不代表完成；此規則不授予付費生成、私有資料外傳、push、merge 或部署權限。

## Commits

Use concise imperative subjects, optionally scoped (for example `combat: add jump charge`). Do not commit `node_modules/`, `dist/` or other generated output.
