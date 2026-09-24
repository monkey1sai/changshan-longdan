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

## Coding Style

TypeScript strict mode with `erasableSyntaxOnly` (no enums or parameter properties; use `as const` objects), ES modules, 2-space indentation, LF line endings, UTF-8. Import local modules with the `.ts` extension. Keep game rules in `combat/` and `entities/` free of DOM and WebGL so they stay unit-testable. Avoid per-frame allocations in hot paths; reuse scratch vectors and typed arrays. Place shared world coordinates in `src/world/layout.ts` so rendering and collision cannot drift apart.

## Testing

Add or update Vitest tests for every change to combat, AI, player or layout logic. Visual and feel changes must be checked in a real browser with `npm run dev`; a passing test run is not visual verification. In dev builds `window.__game` exposes `state`, `advance(frames, input)` and other hooks for scripted checks. Chrome pauses `requestAnimationFrame` for hidden or occluded windows, so scripted runs in a background tab are supporting evidence only; confirm frame rate and input feel in a visible window.

## Commits

Use concise imperative subjects, optionally scoped (for example `combat: add jump charge`). Do not commit `node_modules/`, `dist/` or other generated output.
