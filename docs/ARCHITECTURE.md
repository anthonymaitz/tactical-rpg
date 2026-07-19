# Simple Quest Tactics — Architecture Guide

> For new developers. Read this before touching code.

---

## Mental model in one sentence

The game **orchestrates** three external modules — it does not implement rendering, RPG rules, or UI widgets itself. Those belong to the modules. The game's job is to connect them together through a Colyseus server.

---

## Module map

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌──────────────────┐    ┌───────────────────────────┐  │
│  │  SolidJS app     │    │  External web components  │  │
│  │  apps/game/src/  │    │                           │  │
│  │                  │◄──►│  <playsets-board>         │  │
│  │  Screens         │    │    isometric board        │  │
│  │  Hooks           │    │    token movement         │  │
│  │  Components      │◄──►│  <simple-quest>           │  │
│  └──────┬───────────┘    │    RPG HUD (HP/energy)    │  │
│         │ WebSocket      │    abilities, items        │  │
│         │ (Colyseus)     │                           │  │
└─────────┼───────────────►│  <click-comics>           │  │
          │                │    comic-panel cutscenes  │  │
          ▼                └───────────────────────────┘  │
┌─────────────────────────────────────────────────────────┐
│                        Server (Bun)                     │
│                                                         │
│  Colyseus rooms          Hono HTTP routes               │
│  ┌─────────────────┐     ┌──────────────────────────┐   │
│  │ ExploreRoom     │     │ /heroes   /content        │   │
│  │ BiomeRoom       │     │ /inventory /debug         │   │
│  └────────┬────────┘     └──────────┬───────────────┘   │
│           │                         │                   │
│           ▼                         ▼                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │  DB services (server/src/db/)                   │    │
│  │  hero-service  inventory-service  drop-table-   │    │
│  │  sq-content    scene-service      service        │    │
│  └──────────────────────────┬──────────────────────┘    │
│                             ▼                           │
│                   Self-hosted Postgres (homelab)          │
└─────────────────────────────────────────────────────────┘
```

---

## Package roles

| Package | Path | What it owns |
|---------|------|--------------|
| `shared-types` | `packages/shared-types/` | All cross-boundary type definitions: `ActorState`, `CombatState`, `Action`, `Position`, `THE_INN` map, `WEAPON_DAMAGE_BONUSES`, `STAR_UPGRADE_COSTS` |
| `rules-engine` | `packages/rules-engine/` | Pure combat math: `resolveAction`, `applyResult`, dice. No I/O, no DB. |
| `click-comics` | `packages/click-comics/` | `Panel[]` cutscene engine. Used by `ComicPlayer.tsx` for NPC dialogue and combat result screens. |
| `simplequest-hud` | `packages/simplequest-hud/` | SolidJS wrapper for `<simple-quest>`. Re-exports `CharacterData` type. |
| `playsets` | `packages/playsets/` | SolidJS wrapper for `<playsets-board>`. Handles isometric board, token movement, scene data. |
| `server` | `server/` | Colyseus + Hono. Game logic, persistence, auth. |
| `game` | `apps/game/` | SolidJS client. Routing, screen orchestration, hooks. |

---

## Sibling repos

The `simple-quest` and `playsets-board` packages are **not in this repo** — they live next to it:

```
/Users/anthonymaitz/Repositories/
  tactical-rpg/          ← this repo
  simplequest/           ← SimpleQuest web component source
  playsets experiments/  ← Playsets board source
```

The monorepo links to them via pnpm workspace. **After editing either sibling, run `pnpm run build` in that repo before changes appear in the game.**

---

## Server architecture

### Colyseus rooms

All real-time game state flows through Colyseus rooms over WebSocket.

**ExploreRoom** — the Inn hub
- Players walk around `THE_INN` map
- NPC proximity triggers `INTERACTION_START` (dialog)
- Enemy proximity triggers `ENCOUNTER` → in-place turn-based combat
- Auto-heals heroes to full on every entry (Rest mechanic)
- Sends `HERO_STATE` on connect and after REST

**BiomeRoom** — the outdoor exploration map
- Larger open map (100×100), no walls for combat
- Same combat system as ExploreRoom
- Awards loot on combat win via `dropTableService.rollDrops()`
- Tracks `_combatEnemySlugs` to know which drop table each enemy uses

**InPlaceCombatEngine** — shared combat state machine
- Used by both ExploreRoom and BiomeRoom
- Holds `CombatState` (actors, turn queue, round counter)
- Methods: `handleAction`, `endTurn`, `advanceTurn`, `applyHeal`, `getCombatState`, `winningSide`
- Passes through to `resolveAction` in `rules-engine` for damage/heal math

**BaseRoom** — shared auth + JWT verification
- Both ExploreRoom and BiomeRoom extend this
- Provides `verifyToken(token)` helper

### Combat constants (`rooms/combat-constants.ts`)
Shared between ExploreRoom and BiomeRoom:
- `ENEMY_SLASH` — the ability definition every NPC uses
- `weaponDamageBonus(weapon)` — looks up `WEAPON_DAMAGE_BONUSES` from shared-types

### HTTP routes (Hono)

All routes require a Bearer JWT issued by this server's own `/auth/login` or `/auth/signup` (verified via `authMiddleware` from `server/src/middleware.ts`).

| Route | Purpose |
|-------|---------|
| `GET /heroes` | List authenticated user's heroes |
| `POST /heroes` | Create hero (validates class/personality/profession against SQ content) |
| `PATCH /heroes/:id/gear` | Equip/unequip a gear slot |
| `GET /content` | SQ content (classes, abilities, personalities, etc.) |
| `GET /inventory` | Player stash (gold, potions, fragments, shards) |
| `GET /inventory/hero/:heroId` | Hero's carried inventory |
| `POST /inventory/move-potion` | Move potion between stash ↔ hero |
| `POST /inventory/upgrade-star` | Spend star fragments to raise hero star rating |
| `POST /debug/give-items` | Dev-only: add resources to stash |
| `POST /debug/equip-weapon` | Dev-only: equip debug sword on hero |
| `POST /debug/unequip-weapon` | Dev-only: remove weapon |

---

## Client architecture

### Routing (`App.tsx`)

```
/              → ConnectScreen  (auth + hero roster)
/inn           → ExploreScreen  (inn hub)
/biome/:id     → BiomeScreen    (outdoor map)
/build/:slug   → BuildScreen    (designer tool)
/debug         → DebugScreen    (dev tools)
```

### Screen pattern

Each screen follows the same structure:

```
ExploreScreen / BiomeScreen
  ├── createExploreRoom() / createBiomeRoom()   ← Colyseus hook
  │     Returns: signals for all server state
  │     Sends:   player actions via room.send()
  │
  ├── <PlaysetBoard>              ← isometric board rendering
  │     Receives: scene JSON, token list, highlights
  │     Emits: tokenclick, tokenmove, tokenface, tokenemote, tokenspeech
  │
  ├── <SimpleQuestHUD>            ← RPG HUD
  │     Receives: character JSON (name, class, HP, energy, combat state)
  │     Emits: abilityactivate, itemactivate, characterchange
  │
  └── <ComicPlayer>              ← NPC dialog / cutscenes
        Receives: Panel[] array
        Used for: NPC dialogue, combat results
```

### Hook pattern (`hooks/useExploreRoom.ts`, `hooks/useBiomeRoom.ts`)

Each hook:
1. Connects to the Colyseus room using `joinRoom()`
2. Registers all `onMessage` listeners before sending `READY`
3. Returns reactive SolidJS signals for all server state
4. Exposes methods (e.g. `move()`, `sendAction()`, `endTurn()`) that call `room.send()`

**Critical:** The `READY` message must be sent AFTER all `onMessage` listeners are registered. The server sends init data (`HERO_STATE`, `SCENE_STATE`) only in response to `READY` — not in `onJoin` — because messages sent during `onJoin`'s async `.then()` are silently dropped by Colyseus.

### characterJson pattern

Both screens build a `characterJson()` derived signal to drive the SimpleQuest HUD. During combat, it reads from the actor state (HP, energy, selected ability, round). Outside combat, it reads from `heroState` (the last `HERO_STATE` message). The two are merged so the HUD always shows the most current data.

---

## Data flow: Hero joins the inn

```
1. Client: ConnectScreen authenticates → navigates to /inn with token + heroIds in session
2. Server: ExploreRoom.onJoin stores userId + heroIds in client.userData
3. Client: useExploreRoom registers all onMessage listeners → sends READY
4. Server: READY handler fetches hero from DB, restores HP, sends HERO_STATE
5. Client: setHeroState(data) — signals update, SimpleQuestHUD re-renders with hero name/class/HP
6. Server: sends SCENE_STATE — PlaysetBoard renders the inn scene
7. Server: ExploreState Colyseus schema syncs player position — PlaysetBoard places hero token
```

## Data flow: Combat

```
1. Hero moves near enemy → server proximity check triggers ENCOUNTER
2. Client: setEncounter(data) → ExploreScreen shows encounter panel
3. Player accepts → server startCombat() → InPlaceCombatEngine constructed
4. Server: broadcasts COMBAT_START with full CombatState
5. Client: setCombatState(data) → screen switches to combat UI
6. Client: player selects ability + target → sends PLAYER_ACTION
7. Server: InPlaceCombatEngine.handleAction → rules-engine resolveAction → broadcasts COMBAT_STATE
8. Client: setCombatState(data) → HUD updates (HP, energy, action results)
9. When all enemies dead → server broadcasts COMBAT_END { result: 'win', loot }
10. Client: BiomeScreen shows CombatResultModal with loot chips
```

## Data flow: Inventory

```
Client → GET /inventory → inventoryService.getOrCreate(userId) → PlayerInventory
Client → GET /inventory/hero/:id → inventoryService.getHeroInventory(heroId) → { healthPotions }

Move potion:
Client → POST /inventory/move-potion { heroId, direction: 'to-hero' | 'to-stash' }
       → inventoryService.movePotion (concurrent UPDATE on both tables)

Upgrade star:
Client → POST /inventory/upgrade-star { heroId }
       → inventoryService.upgradeHeroStar (validates cost, UPDATE heroes.star_rating, deduct fragments)
```

---

## Database

Self-hosted Postgres — one database (`tactical_rpg`) on the homelab's shared instance. Migrations are in `server/src/db/migrations/`; `003_self_hosted_bootstrap.sql` is the full schema for a fresh instance (001/002 only ever ran against the retired Supabase project).

| Table | Purpose |
|-------|---------|
| `users` | Self-hosted auth — email + password hash. |
| `heroes` | One row per hero. Owns class stats, gear, recovery timer, star rating. |
| `player_inventory` | One row per user. Gold, potions, star fragments, decor shards, builder props. |
| `hero_inventory` | One row per hero. Potions carried in the field. |
| `sq_abilities` | Seeded ability cards (title, body, dice notation, energy cost, context). |
| `sq_classes` | Class stat blocks (die, maxHp, maxEnergy, speed). |
| `sq_metadata` | Key-value store for SQ content arrays (personalities, professions, etc.). |
| `drop_tables` | Loot tables by slug. Entries are JSONB `{ item, weight, min_qty, max_qty }`. |
| `scenes` | Designer-authored scene data (from BuildScreen), served via `/scenes/:slug`. |

**No RLS.** Ownership is enforced in the server's route/service layer (e.g. `heroRoutes` checks `hero.userId === userId` before mutating) — there's no PostgREST auto-API exposing tables directly, so RLS doesn't apply the way it did under Supabase.

**Seed data:** Run `bun run server/scripts/seed-sq-content.ts` to populate `sq_abilities`, `sq_classes`, `sq_metadata`. `drop_tables` (`wolf`, `bandit`, `forest-spirit`, `boss`) and the `inn-main` scene were migrated once from the old Supabase project's hand-authored data — see `server/src/db/migrations/003_self_hosted_bootstrap.sql`'s comment for context; there's no seed script for them since they were one-time content, not generated data.

---

## SolidJS rules (critical)

These are non-negotiable. Breaking them causes silent reactivity failures.

1. **Never destructure props** — `const { foo } = props` breaks reactivity. Always use `props.foo`.
2. **Use `attr:` prefix on custom elements** — `attr:character={json}` forces `setAttribute()` so `attributeChangedCallback` fires. Without it, SolidJS assigns the property and the web component never sees the change.
3. **Custom elements handle empty attributes on mount** — The `simple-quest` and `playsets-board` elements receive empty strings initially; they re-initialize when attributes change.
4. **Reactive reads must happen inside reactive contexts** — Read signals inside `createMemo`, `createEffect`, or JSX. Reading a signal in a plain function called outside a reactive context creates no subscription.

---

## External module contracts

### `<simple-quest>` (SimpleQuest HUD)

Controlled via two attributes:
- `attr:character` — JSON string matching `CharacterData` from `simplequest-hud`
- `attr:content` — JSON string matching `SimpleQuestContent`
- `attr:locked` — `"true"` disables editing (used during active play)

Emits custom events:
- `abilityactivate` — `{ detail: { title, energyCost } }`
- `itemactivate` — `{ detail: { id, name } }`
- `characterchange` — `{ detail: CharacterChangeData }` (used on hero creation screen)

### `<playsets-board>` (isometric board)

Controlled via `attr:scene` (JSON scene data) and `attr:tokens` (JSON token array).

Emits custom events for token interactions: `tokenclick`, `tokenmove`, `tokenface`, `tokenemote`, `tokenspeech`, `tokenaction`.

The `PlaysetBoard` SolidJS wrapper in `packages/playsets/` handles all event binding.

### `<click-comics>` (ComicPlayer)

Receives a `Panel[]` array prop. Each panel has `{ speaker, text, image? }`. The `ComicPlayer.tsx` component wraps it and calls `onDone()` when the player advances through all panels.

---

## Running locally

```bash
# Install
pnpm install

# Start both dev servers (two terminals)
pnpm --filter server dev    # Bun, WS on :2567, HTTP on :3000
pnpm --filter game dev      # Vite, browser on :5173

# Typecheck
pnpm typecheck

# Tests
pnpm test

# If port 2567 is stuck
lsof -ti:2567 | xargs kill -9
```

Environment variables required in `.env` (repo root — `server/.env` symlinks to it) and `apps/game/.env`:
```
DATABASE_URL=postgres://postgres:...@localhost:5432/tactical_rpg   # server only
AUTH_JWT_SECRET=...                                                # server only
VITE_API_URL=http://localhost:3000
VITE_SERVER_URL=ws://localhost:2567
```

---

## Common gotchas

| Symptom | Cause | Fix |
|---------|-------|-----|
| SimpleQuest HUD doesn't update | Missing `attr:` prefix | Change `character={json}` to `attr:character={json}` |
| Server init messages lost | Sent in `onJoin` instead of READY handler | Move sends to the `onMessage('READY', ...)` handler |
| Combat ends but HUD stuck | `'cancelled'` result not handled | Both hooks handle it now — clears `combatState` |
| Port 2567 already in use | Previous server didn't exit | `lsof -ti:2567 | xargs kill -9` |
| Simplequest changes not reflected | Dist not rebuilt | `cd ../simplequest && pnpm run build` |
| Type errors about HeroRecord | Missing column in type | Check `hero-persistence.ts` in `shared-types` |
