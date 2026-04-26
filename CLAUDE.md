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

Walking skeleton complete (plans 01–09 + all 4 sub-projects). `pnpm typecheck` exits 0.

### What's working end-to-end

- Inn hub: heroes walk, NPC dialog on landing, door placeholders
- In-place combat: proximity → ENCOUNTER → turn-based combat in ExploreRoom
- SimpleQuest HUD: locked during play, Supabase is source of truth for all SQ content
- Hero creation: class/profession/personality from DB, abilities seeded from simplequest sample content
- Ability targeting, used-state (resets with energy), floating doobers on damage/heal
- BuildScreen (`/build/:slug`) for designer-authored scenes saved to Supabase

## Next milestone — Biome Entry

Game loop requires players to leave the Inn and enter a biome map. Current state: doors show a placeholder panel ("coming in next update").

Priority order:

1. **Doorkeeper party selection** — clicking doorkeeper NPC opens a party picker (choose available heroes), then transitions to biome
2. **Biome map** — a real explorable map (can start with a handcrafted map, procedural later)
3. **Post-combat rewards** — XP earned, loot drops, hero scrolls
4. **Return/extract mechanic** — walk back to spawn pad or use recall item

Specs: `docs/superpowers/specs/2026-04-20-game-design.md`

## Supabase

URL: `https://rmmdtegsomzejjioolre.supabase.co`
Credentials: `.env` (monorepo root) and `apps/game/.env`
JWT: ES256 asymmetric — use `createRemoteJWKSet` from `jose`, NOT `SUPABASE_JWT_SECRET`.
Email confirmation: disable in Supabase dashboard for local dev.

## pnpm workspace links

- `'../simplequest'` — SimpleQuest web component
- `'../playsets experiments/apps/client'` — Playsets board (package name: `playsets-board`)
