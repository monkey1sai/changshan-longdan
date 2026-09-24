# Repository Guidelines

## Project Structure

A browser game built with Vite, TypeScript and the Canvas 2D API; no game engine.

- `index.html` — page shell and the `#game` canvas.
- `src/main.ts` — entry point; wires canvas, input and the game loop.
- `src/game.ts` — game state and `update()`; pure functions with no DOM access.
- `src/input.ts` — keyboard input.
- `src/render.ts` — Canvas 2D drawing.
- `tests/` — Vitest tests.
- `public/` — static assets served as-is (create it when needed).

## Commands

Run from the repository root with Node.js `^22.12.0 || ^24.0.0 || >=26.0.0`:

- `npm install` — install dependencies.
- `npm run dev` — start the dev server at http://localhost:5173.
- `npm test` — run Vitest once.
- `npm run typecheck` — type-check `src/` and `tests/`.
- `npm run build` — type-check, then build to `dist/`.
- `npm run preview` — serve the `dist/` build.

## Coding Style

TypeScript strict mode, ES modules, 2-space indentation, LF line endings, UTF-8. Import local modules with the `.ts` extension. Keep game rules in pure functions that take state and return new state; keep DOM, canvas and input code in thin modules around them.

## Testing

Add or update Vitest tests in `tests/` for every change to game logic. Rendering and input are verified by running `npm run dev` and playing in a browser; a passing test run is not visual verification.

## Commits

Use concise imperative subjects, optionally scoped (for example `game: add enemy spawning`). Do not commit `node_modules/`, `dist/` or other generated output.
