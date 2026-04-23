# Simple Quest Tactics — tactical-rpg monorepo

A tactical RPG. Three external web component modules (Playsets, SimpleQuest, ClickComics) are imported and coordinated by this game app. The game app does NOT implement rendering or game rules — those live in the modules.

## Sibling repos

| Repo | Purpose |
|------|---------|
| `/Users/anthonymaitz/Repositories/playsets experiments/` | Playsets — isometric board, tokens, builder (`playsets-board` package) |
| `/Users/anthonymaitz/Repositories/simplequest/` | SimpleQuest — RPG HUD web component |

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| `shared-types` | `packages/shared-types/` | ActorState, CombatState, Action, Position, THE_INN map |
| `rules-engine` | `packages/rules-engine/` | Combat resolution, dice, NPC AI |
| `click-comics` | `packages/click-comics/` | Comic panel cutscene engine |
| `simplequest-hud` | `packages/simplequest-hud/` | SolidJS wrapper for `<simple-quest>` web component |
| `playsets` | `packages/playsets/` | SolidJS wrapper for `<playsets-board>` web component |
| `server` | `server/` | Colyseus 0.15 + Hono; ExploreRoom, TurnRoom, CombatRoom |
| `game` | `apps/game/` | SolidJS + Vite client — ConnectScreen, ExploreScreen, CombatScreen |

## Running the project

```bash
pnpm install
pnpm test              # all packages
pnpm typecheck         # all packages
pnpm --filter game dev      # client (port 5173)
pnpm --filter server dev    # server (WS: 2567, HTTP: 3000)
```

## Key constraints

- **SolidJS everywhere in UI** — never React. Use `createSignal`/`createEffect`/`onMount`/`onCleanup`, `<For>`/`<Show>`/`<Switch>`.
- **Never destructure SolidJS props at top level** — breaks reactivity. Use `props.x` or `splitProps`.
- **Custom elements need `attr:` prefix in SolidJS JSX** — forces `setAttribute` so `attributeChangedCallback` fires. Without it, SolidJS uses property assignment and the callback is silently skipped.
- **SolidJS sets attributes after DOM insertion** — design custom elements to handle empty initial attributes and re-initialize on `attributeChangedCallback`.
- **Colyseus: never call `super.onLeave()`** — causes TS2722.
- **READY handshake** — client sends `READY` after all `onMessage` listeners registered. Server sends init data (HERO_STATE, etc.) in the READY handler, NOT in `onJoin` — messages sent during `onJoin` are dropped because `.then()` runs after.
- **BabylonJS needs WebGL** — mock `@babylonjs/core` in vitest.
- **Server runs via Bun**: `bun run src/index.ts`; use `/// <reference types="bun-types" />` in index.ts.
- **@colyseus/schema** requires `experimentalDecorators: true` and `emitDecoratorMetadata: true`.
- **Port 2567 can get stuck** — kill with `lsof -ti:2567 | xargs kill -9`.

## Foundation status

Plans 01–07 complete. 124 tests pass. `pnpm typecheck` exits 0.

## Walking skeleton — next work

Sub-project 1 spec: `docs/superpowers/specs/2026-04-23-playsets-web-component-design.md`

Replace `board-element.ts` (simple boxes placeholder) with a SolidJS web component wrapping the full `babylon/` isometric renderer. API: `attr:mode`, `attr:scene`, `attr:entities`. Events: `cellclick`, `tokendrag`, `tokenmove`, `scenechange`, `error`.

Four sub-projects to full game loop:
1. Playsets Web Component ← NEXT
2. Inn Scene + Builder (builder saves JSON to Supabase)
3. Enemy + Proximity Combat (server detects adjacency → ENCOUNTER)
4. Combat Integration (CombatScreen + SimpleQuestHUD)

## Supabase

URL: `https://rmmdtegsomzejjioolre.supabase.co`
Credentials: `.env` (monorepo root) and `apps/game/.env`
JWT: ES256 asymmetric — use `createRemoteJWKSet` from `jose`, NOT `SUPABASE_JWT_SECRET`.
Email confirmation: disable in Supabase dashboard for local dev.

## pnpm workspace links

- `'../simplequest'` — SimpleQuest web component
- `'../playsets experiments/apps/client'` — Playsets board (package name: `playsets-board`)
