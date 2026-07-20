# Tactical RPG (Simple Quest Tactics) — Agent Instructions

Shared homelab dev conventions first, then project-specific detail.

<!-- baseline:start -->
## Homelab dev environment

This repo runs on the homelab dev server, not a laptop.

- **Running it:** the dev server is a container in the `personal-projects` stack
  (`~/projects/docker-compose.yml`), viewable LAN/Tailscale-only at `<host>.maitz.casa`.
  Do NOT run the dev server as a raw host process — the host firewall (nftables,
  default-deny) drops arbitrary ports; only Traefik's 80/443 are open. Restart after a
  config change: `docker compose -p personal-projects restart <service>`.
- **Package manager:** pnpm — pinned via `packageManager` in package.json. Don't switch
  managers or mix lockfiles.
- **Node 20** (`.nvmrc`) — matches the container runtime; install under it to keep native
  modules ABI-compatible with what the containers run.
- **Isolated tasks (`wt`):** for any non-trivial task — and always when several agents work at
  once — spin up a worktree instead of editing the main checkout. From the repo run
  `wt new <task> --agent opencode|claude`: it creates a git worktree, its own dev container, a
  live preview at `https://<task>.wt.maitz.casa`, and opens the agent in a tmux window scoped to
  that worktree. `wt ls` lists tasks, `wt rm <task>` tears one down. Parallel work never collides
  in one checkout, and every task gets a URL you can open to *see* it.
- **Secrets:** never read, print, or echo `.env` / key / token *values* — diagnose from
  variable names and metadata only. `.env` is gitignored; never stage it.
- **Remote:** GitHub-only (`origin`); PRs via `gh`.
<!-- baseline:end -->

---

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
- SimpleQuest HUD: locked during play, Postgres is source of truth for all SQ content
- Hero creation: class/profession/personality from DB, abilities seeded from simplequest sample content
- Ability targeting, used-state (resets with energy), floating doobers on damage/heal
- BuildScreen (`/build/:slug`) for designer-authored scenes saved via the server's `/scenes` API

## Milestone status — Biome Entry (complete)

All biome entry features are shipped:

1. ✅ Doorkeeper party selection → biome transition
2. ✅ Biome map (handcrafted starting map)
3. ✅ Post-combat loot drops (gold, potions, star fragments, decor shards, builder props)
4. ✅ Hero inventory (potions carried per hero, move to/from stash)
5. ✅ Star upgrade system (spend star fragments at InventoryPanel)
6. ✅ Debug tooling (`/debug` route — give items, equip debug sword)

Specs: `docs/superpowers/specs/2026-04-20-game-design.md`

## Next milestone — TBD

## Self-hosted backend

Postgres + auth are self-hosted (no Supabase, no Railway) as of 2026-07-19.

- **Database**: plain Postgres, reachable at `postgres:5432/tactical_rpg` on the homelab's shared instance (one DB per service, same as outline/authentik/opencut). `server/src/db/pg.ts` wraps the `postgres` client; db-service files use raw SQL, no PostgREST/auto-API layer.
- **Auth**: the Hono server issues its own HS256 JWTs (`server/src/auth.ts`, `jose` + `Bun.password` for hashing) against a `users` table — no external identity provider. `POST /auth/signup`, `POST /auth/login`.
- **Env vars** (server only, loaded from `.env` at the repo root via the `server/.env -> ../.env` symlink — Bun only auto-loads `.env` from cwd): `DATABASE_URL`, `AUTH_JWT_SECRET`. See `.env.example`.
- **Schema**: `server/src/db/migrations/003_self_hosted_bootstrap.sql` is the full schema for a fresh instance (001/002 only ever ran against the retired Supabase project and rely on `auth.uid()`, so they aren't replayed here).
- Client no longer imports `@supabase/supabase-js` at all — `apps/game/src/lib/auth.ts` mirrors the bit of the `supabase.auth` interface the app used, backed by the two endpoints above.

## pnpm workspace links

- `'../simplequest'` — SimpleQuest web component
- `'../playsets experiments/apps/client'` — Playsets board (package name: `playsets-board`)
