# Handoff

## State
Sub-project 4 (Combat Integration) is fully implemented and merged into `feature/inn-scene-builder`. 159 tests pass, `pnpm typecheck` clean. All 10 tasks complete: InPlaceCombatEngine, ExploreRoom combat handlers, useExploreRoom signals, ExploreScreen overlays, PlaysetBoard highlights, and playsets-board ghost/highlight rendering (rebuilt `dist/playsets-board.mjs` in sibling repo).

## Next
The session note from before this one mentioned the SimpleQuest HUD component should be driving player actions — that brainstorm was cut short. Pick up: how should `<simple-quest>` HUD wire into the combat action bar (currently raw SolidJS buttons in ExploreScreen)? Check `docs/superpowers/specs/2026-04-25-combat-integration-design.md` for context.

## Context
- Working branch: `feature/inn-scene-builder` (combat-integration merged in via fast-forward)
- Playsets renderer lives in sibling repo `/Users/anthonymaitz/Repositories/playsets experiments/` — changes there require `pnpm --filter playsets-board build:lib` to rebuild `dist/playsets-board.mjs`
- Combat is in-place in ExploreRoom — no separate CombatRoom ever (strong user preference, saved in memory)
- `ACTION_REJECTED` message now sent to client on invalid combat actions
