# Tactical RPG code review — Codex pass

**Reviewed:** commit `75d5928884a849cc0b383cd07bf94e2325cf3307` (`feature/biome-entry`) on 2026-08-23

**Scope:** `server/src`, `packages`, and `apps/game/src`

**Review constraint:** application code was not changed. This is independent of the parallel Claude pass.

## Plain-English summary

The biome-entry milestone has a coherent UI and a recognizable game loop, but it is not safe to treat the server as authoritative yet. A custom client can forge combat abilities, act as another account's hero, mint unlimited progression resources, steal another hero's potions, and replace shared scenes. Ordinary play also has correctness gaps: biome damage is discarded when the next fight starts, a disconnect can freeze combat, and the four-hero party picker produces cosmetic companions while only the first hero participates. The self-hosted auth implementation hashes passwords and fails closed when its signing secret is absent, but long-lived browser tokens, no rate limiting or revocation, explicit signup enumeration, and acceptance of arbitrarily weak secrets leave it under-hardened for a network-reachable service. Before choosing a content milestone, the next work should establish server trust boundaries and make the repository reproducible in its mandated worktree workflow.

## Toolchain baseline — failed before findings

The requested worktree did **not** reproduce the main checkout baseline.

| Check | Actual result in this worktree |
|---|---|
| Commit | Correct: `75d5928884a849cc0b383cd07bf94e2325cf3307` |
| Runtime | Node `v22.22.3`, although the repo requires Node 20 (`AGENTS.md:15-18`) |
| `pnpm install` | Exit 127: `pnpm: command not found` |
| `pnpm typecheck` | Exit 127: `pnpm: command not found` |
| `pnpm test` | Exit 127: `pnpm: command not found` |
| Corepack fallback | Not installed |
| Local `./node_modules/.bin/tsc --noEmit -p tsconfig.check.json` | Exit 2 with missing workspace dependencies (`solid-js`, Hono, Colyseus, Bun types, and others) |
| Local `./node_modules/.bin/vitest run` | Exit 1 before collection: missing `vite-plugin-solid` while loading `packages/playsets/vitest.config.ts` |
| Tests collected | 0 of 160; therefore neither 157 passing nor the expected 3 failures were reproduced |
| Assigned preview | HTTP 403 from `https://rpg-review-codex.wt.maitz.casa/` |

The initial worktree already contained an untracked npm-generated `package-lock.json` and root-only `node_modules` tree timestamped before this review began. None of the commands above changed that lockfile, and it is not part of this review.

The supplied main-checkout reference remains: typecheck exit 0; 23 files / 160 tests / 3 failing. That reference was **not independently re-run here**. Every source finding below is consequently marked runtime-unverified; the cited path is statically complete, but no production state was mutated to demonstrate it.

## Findings, highest severity first

### 1. Critical delivery blocker — the required worktree workflow cannot install or verify the repository

`AGENTS.md:19-24` mandates `wt` worktrees for non-trivial work, while `pnpm-workspace.yaml:5-6` links `../simplequest` and `../playsets experiments/apps/client`. From `~/.wt/trees/rpg-review-codex`, both resolve to nonexistent paths. The documented commands are `pnpm install`, `pnpm test`, and `pnpm typecheck` (`AGENTS.md:55-63`), but this worktree also lacks the pinned `pnpm` executable and runs Node 22 rather than Node 20.

**Failure scenario:** create a task using the repository's required `wt` workflow and run the documented setup. Dependency resolution cannot reach either sibling, and in this task the command cannot even start because `pnpm` is absent. Typecheck and all 160 tests become unavailable, so an agent can neither prove the 157 passing tests remain green nor distinguish new regressions from an incomplete install.

**Runtime status:** verified in this worktree. The preview's HTTP 403 is additional evidence that the promised task environment was not usable.

### 2. Critical — clients can invent abilities, targets, costs, and the actor moved in combat

The rooms accept the client's full `Action` object (`server/src/rooms/ExploreRoom.ts:86-88`, `server/src/rooms/BiomeRoom.ts:116-118`). `InPlaceCombatEngine.handlePlayerAction` checks whose turn it is outside the engine, but for an ability it trusts `action.ability` and `action.targetIds`; it only tracks the supplied ability ID for once-per-turn use (`server/src/rooms/InPlaceCombatEngine.ts:74-100`). `resolveAction` then trusts the supplied dice notation, energy cost, effect, and every target ID (`packages/rules-engine/src/actions.ts:35-60`). Dice count and sides have no upper bound (`packages/rules-engine/src/dice.ts:3-17`). For movement, reachability is calculated from the authenticated hero, but `applyResult` moves `result.action.actorId`, which is still client supplied (`server/src/rooms/InPlaceCombatEngine.ts:78-85`, `packages/rules-engine/src/actions.ts:85-88`).

**Failure scenario:** on the attacker's turn, send an ability with a new ID, `energyCost: 0`, `effect: "damage"`, `diceNotation: { kind: "notation", value: "1d1000000" }`, and every enemy ID in `targetIds`. The server rolls it and applies the damage to every target, granting normal victory and loot. Repeating with fresh IDs bypasses the used-ability set. A very large dice count also asks the server to allocate a correspondingly large array. Alternatively, send a legal nearby destination but set the move action's `actorId` to another hero or enemy; the attacker pays the cost and the other actor is relocated.

**Runtime status:** unverified at runtime; confirmed by the unchecked message-to-state code path. There is no server-side lookup of the submitted ability against `actor.abilities`, no target-type validation, and no energy sufficiency check for client abilities.

### 3. Critical — room join options can select and persist another account's hero

Both rooms verify the bearer token but then store client-supplied `heroIds` without comparing them with the JWT subject (`server/src/rooms/ExploreRoom.ts:173-183`, `server/src/rooms/BiomeRoom.ts:180-189`). The READY fallback queries owned heroes only when the supplied array is empty; otherwise it loads the supplied first ID directly (`server/src/rooms/ExploreRoom.ts:139-156`, `server/src/rooms/BiomeRoom.ts:150-163`). Combat start and join repeat `getHero(heroId)` without ownership or recovery checks (`server/src/rooms/ExploreRoom.ts:258-285`, `server/src/rooms/BiomeRoom.ts:250-277`). Combat states broadcast real hero IDs to room peers, so IDs are not necessarily secret.

**Failure scenario:** user B observes user A's hero UUID in a shared combat state, reconnects with B's valid token and `heroIds: [A_UUID]`, and sends READY. B receives A's full hero state and can fight as A. Winning writes A's HP; losing writes A's eight-hour recovery timestamp (`server/src/rooms/BiomeRoom.ts:497-518`); joining the inn can restore A's HP (`server/src/rooms/ExploreRoom.ts:98-118`). Supplying one's own recovering hero also bypasses the client-only `isRecovering` selection rule.

**Runtime status:** unverified at runtime; confirmed by the absence of an ownership/recovery check on every supplied-ID path.

### 4. High — authenticated production users can mint unlimited progression resources

`createHttpApp` always mounts `/debug` (`server/src/http-app.ts:24-29`); no environment or role gate exists. Authentication is the only guard (`server/src/routes/debug.ts:6-12`). `give-items` accepts arbitrary numeric quantities, clamps only the lower bound, and passes them into persistent inventory (`server/src/routes/debug.ts:14-28`). The shipping UI also exposes `/debug` in the router and roster (`apps/game/src/App.tsx:13-18`, `apps/game/src/screens/ConnectScreen.tsx:201-206`).

**Failure scenario:** any newly signed-up account posts `{ "gold": 1000000, "healthPotions": 1000000, "starFragments": 1000000, "decorShards": 1000000 }` to `/debug/give-items`. Those values are added to its real stash, allowing all star upgrades and bypassing the loot loop. Values beyond PostgreSQL `integer` range instead turn the endpoint into a repeatable error path.

**Runtime status:** unverified at runtime; route mounting and lack of a non-debug gate are confirmed statically.

### 5. High — combat completion is re-entrant and can award the same loot multiple times

When a winning action makes combat over, both room handlers call the asynchronous `endCombat()` without awaiting it or first marking combat as finalizing (`server/src/rooms/ExploreRoom.ts:365-384`, `server/src/rooms/BiomeRoom.ts:361-379`). `_combat` is not cleared until after drop rolls and persistence finish (`server/src/rooms/BiomeRoom.ts:468-524`). During those awaits, the message handler still accepts actions; `InPlaceCombatEngine.handlePlayerAction` does not reject an already-over state (`server/src/rooms/InPlaceCombatEngine.ts:74-104`). Every overlapping `endCombat` invocation independently rolls and persists loot (`server/src/rooms/BiomeRoom.ts:479-507`).

**Failure scenario:** send a legitimate or forged killing action, then immediately send additional ability messages while the first drop-table/DB work is pending. Each message sees non-null, already-over combat, invokes another `endCombat`, and awards another independently rolled drop to the participant before the first invocation clears the room. This remains an economy exploit even after `/debug` is gated.

**Runtime status:** unverified at runtime; confirmed by the asynchronous finalization window and missing finalized-state guard.

### 6. High — inventory endpoints expose and transfer potions for arbitrary hero UUIDs

`GET /inventory/hero/:heroId` passes the URL ID directly to the service without reading the authenticated user (`server/src/routes/inventory.ts:16-20`). `POST /inventory/move-potion` passes `userId` and an arbitrary `heroId`, but the service never joins that hero to its owner (`server/src/routes/inventory.ts:22-36`, `server/src/db/inventory-service.ts:82-107`). This contrasts with star upgrades, which correctly compare `heroes.user_id` with the token subject (`server/src/db/inventory-service.ts:109-120`).

**Failure scenario:** user B obtains A's hero UUID from shared combat, reads A's potion count, then repeatedly posts `{ "heroId": A_UUID, "direction": "to-stash" }`. Each call decrements A's hero inventory and increments B's stash. The reverse direction lets B place items on A's hero as a griefing or state-manipulation action.

**Runtime status:** unverified at runtime; the missing ownership predicate is confirmed, with the star-upgrade path serving as a positive control.

### 7. High — any authenticated user can overwrite shared designer scenes, including the inn

The save route authenticates a user but performs no creator/role check (`server/src/routes/scenes.ts:14-21`). The upsert conflict clause updates by globally unique slug and ignores both existing and incoming `created_by` ownership (`server/src/db/scene-service.ts:9-14`). ExploreRoom loads `inn-main` on creation (`server/src/rooms/ExploreRoom.ts:18-35`). The request body is only checked for truthiness, not structural limits or a schema.

**Failure scenario:** any account sends `PUT /scenes/inn-main` with a malformed, empty, or maliciously huge scene. New ExploreRoom instances use the attacker's shared inn (or fall back inconsistently if tokens are empty), affecting every player and potentially making room initialization expensive or unusable. The original `created_by` remains in the row, obscuring who last changed it.

**Runtime status:** unverified at runtime; confirmed by the unconditional slug upsert.

### 8. High — the network-facing auth path lacks abuse controls and durable session invalidation

There are good foundations: passwords use `Bun.password`, login returns a generic credential error, JWT verification checks signature/expiry, and startup fails if `AUTH_JWT_SECRET` is missing (`server/src/auth.ts:4-7,23-46`). The remaining boundary is weak: issued tokens last 30 days (`server/src/auth.ts:10-16`), any non-empty signing secret is accepted, and tokens carry no issuer, audience, token ID, or server-side session record. The browser stores the bearer token in `localStorage` (`apps/game/src/lib/auth.ts:12-27`), while signout only deletes local state (`apps/game/src/lib/auth.ts:67-70`). No rate limiter wraps signup/login, and signup explicitly returns `Email already registered` (`server/src/auth.ts:19-21`, `server/src/routes/auth.ts:6-28`). The combined sign-in/sign-up UI turns a wrong password for an existing account into that enumeration response (`apps/game/src/screens/ConnectScreen.tsx:44-60`).

**Failure scenario:** an attacker can enumerate registered addresses through signup and make unlimited password guesses through login. A bearer token copied by browser compromise continues to authorize HTTP and room access for up to 30 days after the user signs out; there is no server-side mechanism to revoke it. A deployment accidentally configured with a guessable non-empty secret accepts attacker-forged tokens until the secret is rotated.

**Runtime status:** unverified at runtime. No secret value was read; the weak-secret case is conditional on configuration.

### 9. Medium — persisted biome damage is discarded at the start of the next fight

Biome READY correctly displays `hero.currentHp` when present (`server/src/rooms/BiomeRoom.ts:159-176`), and combat victory persists remaining HP (`server/src/rooms/BiomeRoom.ts:497-507`). But every biome combat actor is created with `hp: hero.maxHp` (`server/src/rooms/BiomeRoom.ts:250-277`), not the persisted value.

**Failure scenario:** a 20-HP hero wins a fight with 3 HP. The DB stores 3 and the exploration HUD can show 3, but approaching the next enemy creates a 20-HP actor. Attrition and between-fight potion decisions disappear, contradicting the persisted-HP loop.

**Runtime status:** unverified at runtime; confirmed by the save/read/start assignments.

### 10. Medium — disconnecting the active participant can freeze room-wide combat

`onLeave` removes only the position and broadcasts departure (`server/src/rooms/ExploreRoom.ts:185-190`, `server/src/rooms/BiomeRoom.ts:191-196`). It does not remove the session from `_combatParticipants`, remove its hero from the turn queue, advance the turn, or cancel combat. Only the mapped session may act or end its hero's turn (`server/src/rooms/ExploreRoom.ts:365-405`, `server/src/rooms/BiomeRoom.ts:361-400`), and the in-place rooms have no turn timer.

**Failure scenario:** two players join one combat; player A closes the tab while A is current. Player B's action and END_TURN are rejected because current actor is still A. No client remains that can advance A, `_combat` stays non-null, and the entire room is prevented from starting another encounter.

**Runtime status:** unverified at runtime; confirmed by lifecycle and turn-ownership paths.

### 11. Medium — inventory writes are read/modify/write pairs without transactions or atomic increments

`addLoot` reads a snapshot and writes absolute totals (`server/src/db/inventory-service.ts:36-56`). Potion transfer and star upgrade use `Promise.all` for independent updates rather than a database transaction (`server/src/db/inventory-service.ts:82-107,109-127`). There are also no non-negative CHECK constraints in the bootstrap schema (`server/src/db/migrations/003_self_hosted_bootstrap.sql:45-59`).

**Failure scenario:** two simultaneous `+100 gold` awards both read 0 and both write 100, so the expected 200 becomes 100. During potion transfer or star upgrade, one update can commit while the other rejects or the connection drops, leaving resources removed without the corresponding hero change (or vice versa).

**Runtime status:** unverified at runtime; the non-atomic SQL structure is confirmed.

### 12. Medium — the advertised four-hero party is only one server actor plus cosmetic followers

PartyPicker advertises and returns up to four selected IDs (`apps/game/src/components/PartyPicker.tsx:5-25,64-77`), and ExploreScreen stores the complete selection before entering the biome (`apps/game/src/screens/ExploreScreen.tsx:497-510`). Both rooms consistently use only `heroIds[0]` for state and combat (`server/src/rooms/ExploreRoom.ts:258-264`, `server/src/rooms/BiomeRoom.ts:250-256`). The client renders IDs after the first as follower tokens (`apps/game/src/screens/ExploreScreen.tsx:259-289`), but they never become combat actors, take damage, consume potions, recover, or earn a persisted result.

**Failure scenario:** select four heroes and enter a biome. Four tokens appear while exploring, but the first encounter contains only the first hero. The other three cannot take turns and are unaffected by victory or defeat, so the shipped party-selection milestone overstates the implemented game loop.

**Runtime status:** unverified at runtime; confirmed by selection, rendering, and room construction paths.

### 13. Low — random initiative lets important combat tests pass without asserting

`InPlaceCombatEngine` rolls initiative with `Math.random` in its constructor (`server/src/rooms/InPlaceCombatEngine.ts:14-38`). Several tests return early when the desired side does not win initiative rather than controlling randomness (`server/src/__tests__/in-place-combat-engine.test.ts:101-124,135-157,168-178`).

**Failure scenario:** a regression breaks ability energy deduction or win detection, but the corresponding test run rolls enemies first and returns before its assertion. The file remains green nondeterministically, weakening the meaning of the reported 157 passing tests.

**Runtime status:** unverified in this worktree because Vitest did not collect; the vacuous-pass branches are confirmed statically.

## Diagnosis of the three known failing tests

These diagnoses use the supplied main-checkout failures plus static implementation history; this worktree could not execute them.

1. **`PlaysetBoard.test.tsx` — “renders in combat mode with combatState”: stale test.** The assertion still requires a `<canvas>` (`packages/playsets/src/__tests__/PlaysetBoard.test.tsx:46-59`), but `PlaysetBoard` deliberately routes both `explore` and `combat` modes to `ExploreBoard`, which renders `<playsets-board>` (`packages/playsets/src/PlaysetBoard.tsx:38-41,150-159`). That matches the documented in-place-combat architecture and actual game screens.
2. **`PlaysetBoard.test.tsx` — “calls onAction when provided”: stale and non-behavioral test.** It supplies `onAction` but never dispatches an event or asserts the spy; its only assertion is the same obsolete canvas check (`packages/playsets/src/__tests__/PlaysetBoard.test.tsx:61-65`). `onAction` is not wired by `ExploreBoard`; current game screens use `onCellClick`/`onTokenMove` and send room actions themselves.
3. **`enemy-manager.test.ts` — same-cell distance 0: stale test.** The expectation says distance 0 should return null (`server/src/__tests__/enemy-manager.test.ts:63-70`), while EnemyManager intentionally triggers at any distance `<= 3` (`server/src/rooms/EnemyManager.ts:87-95`). Both game screens use the same `<= 3` encounter highlight (`apps/game/src/screens/ExploreScreen.tsx:200-203`, `apps/game/src/screens/BiomeScreen.tsx:182-186`), and the architecture describes proximity rather than adjacency. Same-cell overlap is allowed by exploration movement because walkability checks walls/bounds, not enemy occupancy, so returning an encounter is the safer current behavior.

## Recommended next decision

Do not start with more biome content. Queue separate implementation tasks in this order:

1. Make rooms authoritative: bind owned/non-recovering heroes to JWT subjects and convert client actions into IDs/coordinates that the server resolves and validates.
2. Remove or role/environment-gate debug mutation, enforce inventory/scene ownership, and make persistence mutations transactional and atomic.
3. Harden auth with rate limits, normalized identities, minimum secret strength, shorter/revocable sessions, and tests for enumeration and abuse cases.
4. Restore a worktree-portable pinned Node/pnpm install and make the 160-test baseline reproducible; replace the three stale tests and deterministic-control initiative tests.
5. Then choose whether to complete true multi-hero parties and biome attrition, or explicitly narrow the product to one active hero before building the next milestone.

## Coverage and limits

I read the production auth/middleware/HTTP routes, DB services and bootstrap schema, all Colyseus room and combat-authority paths, the rules engine action/target/dice paths, the Playsets/SimpleQuest/ClickComics wrappers, and the game auth/session/room/inventory/scene/screens involved in the reported scenarios. I inspected the focused tests for auth, HTTP, combat, PlaysetBoard, and EnemyManager. I did not inspect sibling-repository implementation, secret values, retired migrations 001/002 in depth, generated source maps, or visual WebGL output. No live API exploit was attempted because the preview returned 403 and doing so could mutate shared player data.
