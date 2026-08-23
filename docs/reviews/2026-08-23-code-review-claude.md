# Tactical RPG — code review

**Commit:** `75d5928884a8` on `feature/biome-entry` · **Date:** 2026-08-23 · **Reviewer:** Claude (worktree `rpg-review-claude`)

A second, independent review of this same commit ran under codex. The two were deliberately
uncorrelated — neither read the other's output — so where they agree you have corroboration and
where they differ you have something worth looking at.

---

## Summary

The code is in better shape than the test results suggest, and in worse shape than the milestone
notes suggest. Typecheck is clean, 157 of 160 tests pass, and the two combat engines, the loot
tables, the star-upgrade economy and the biome map are all really implemented — this is not a
half-built skeleton. But three things are actually broken. First, **the client renders nothing**:
the last commit on this branch (`cd44dc2`, the `playsets-board→playsets` rename) did a
find-and-replace that rewrote the two side-effect imports which register the `<playsets-board>`
and `<simple-quest>` custom elements into imports of the wrapper packages *themselves*. The
production bundle now contains zero `customElements.define` calls, so the board and the HUD — the
entire game screen — are inert unknown elements. The build still succeeds, which is why nothing
caught it. Second, **the server does not validate combat actions at all**: a player can send a
made-up ability in a `PLAYER_ACTION` message and the server executes it verbatim, which I measured
at 1,000,000 damage from 18 tiles away for zero energy, and the same field is an allocation DoS.
Third, **the rooms trust a hero ID the client supplies**, and combat start broadcasts every
participant's real hero UUID to everyone in the room, so one player can play as, read, damage and
lock out another player's hero. Underneath those, the shipped "Biome Entry" economy is largely
cosmetic — star ratings, three of four gear slots, and the 8-hour death penalty are all read by
nothing that affects play — and `/debug/give-items` is mounted in every build with no gate, so any
account can mint unlimited currency anyway. None of this is hard to fix; most of it is a missing
check in a place where the check already exists three lines away in a sibling function.

**If you fix one thing:** the custom-element imports (S1). It is a two-line change and without it
there is no game to look at.

---

## 0. Toolchain — can the suite actually run here?

The brief flagged that `pnpm-workspace.yaml` links `'../simplequest'` and
`'../playsets experiments/apps/client'`, which resolve from `~/projects/tactical-rpg` but not from
`~/.wt/trees/<task>/`. **This turned out not to break the worktree, because those two links do
nothing anywhere.**

| Step | Result |
|---|---|
| `pnpm install` | exit 0, 2.7s. `Scope: all 8 workspace projects` |
| `pnpm typecheck` | **exit 0, no output** |
| `pnpm test` | **23 files, 160 tests, 3 failed / 157 passed** |
| lockfile after install | **unchanged** (`git status` clean apart from a pre-existing untracked file) |

That is an exact match for the baseline measured in the main checkout. The worktree reproduces
main faithfully, so every finding below is measured, not assumed.

Two things worth recording rather than working around:

- **The sibling workspace links are already dead, everywhere.** `pnpm install` reported 8
  projects — `packages/*` (5) + `apps/game` + `server` + root. The two `../` entries contributed
  zero, and pnpm did not warn. The committed `pnpm-lock.yaml` has no importer for either. No
  `package.json` in the repo declares a dependency on `playsets-board` or `simple-quest`. And in
  the **main checkout** (`~/projects/tactical-rpg`), `require.resolve('playsets-board')` and
  `require.resolve('simple-quest')` both fail too. So this is not a worktree portability problem —
  those two lines in `pnpm-workspace.yaml` are vestigial in every environment. That matters
  because it is half the reason S1 below is silent instead of loud.
- **`pnpm` is not on PATH on this host.** I ran everything through `npx pnpm@11.15.0`, matching
  the pinned `packageManager`. Separately, the `wt` container for this task ran `npm install` at
  the repo root before starting, which left an **untracked, un-ignored `package-lock.json`** in the
  tree (see S15). I did not commit it.

**I could not see the app rendered.** `https://rpg-review-claude.wt.maitz.casa/` returns HTTP 403;
the screenshot shows Vite's "Blocked request … not allowed" page. The task container runs bare
`npx vite` from `/app`, where there is no Vite config, so `apps/game/vite.config.ts` — which does
set `allowedHosts: true` — is never loaded. This is a harness/repo-shape mismatch (the repo has no
root `dev` script for a generic runner to find), not an app bug. It does mean S1 below rests on
the built bundle rather than on a screenshot of a blank page.

---

## Findings, most severe first

### S1 — The game renders nothing: the two custom elements are never registered · **verified**

`packages/playsets/src/PlaysetBoard.tsx:2` · `packages/simplequest-hud/src/index.tsx:1`

Commit `cd44dc2` ("Finish playsets-board→playsets, simple-quest→simplequest-hud rename") — the most
recent substantive commit on this branch — renamed the local wrapper packages and swept the old
names out of the source. Two of the lines it caught were not references to the wrappers; they were
**side-effect imports of the external web components**, the lines whose entire job is to run
`customElements.define()`:

```diff
- import 'playsets-board'     // registered <playsets-board>
+ import 'playsets'           // packages/playsets importing ITSELF

- import 'simple-quest'       // registered <simple-quest>
+ import 'simplequest-hud'    // packages/simplequest-hud importing ITSELF
```

From inside `packages/playsets`, `require.resolve('playsets')` returns
`packages/playsets/src/index.tsx` — the wrapper's own barrel. ESM resolves the cycle by handing
back the partially-initialised module, so **nothing throws**. The element is simply never defined.

Evidence — I built the client (`VITE_API_URL=… VITE_SERVER_URL=… pnpm --filter game build`,
exit 0, 5.26 MB bundle) and searched it:

```
customElements.define calls in bundle:  0
"playsets-board" occurrences:           1   (the JSX tag the app tries to render)
"simple-quest"   occurrences:           1   (same)
```

Zero registrations of any web component. `<playsets-board>` and `<simple-quest>` render as inert
unknown HTML elements: no isometric board, no RPG HUD. That is the whole play screen and the whole
sidebar.

Two corroborating traces that this was a mechanical sweep rather than a decision:

- `packages/simplequest-hud/src/index.tsx:12` still reads
  `export type { SimpleQuestContent, CharacterData } from 'simple-quest'` — the *old* name. The
  rename missed it, so the file now names both. It survives `tsc` only because
  `packages/simplequest-hud/src/simple-quest.d.ts` declares the module; a type-only export is
  erased at build time, so it never reaches the bundler either.
- The same commit deleted `export { sampleContent } from 'simple-quest'` — a *value* export —
  rather than repointing it.
- `packages/playsets/src/__tests__/PlaysetBoard.test.tsx:5` contains `vi.mock('playsets', () => ({}))`.
  The suite stubs the self-import, which is precisely why 157 tests pass over a client that cannot draw.

**Why it is silent rather than loud:** because the sibling packages are not in the dependency graph
at all (Section 0), `import 'playsets-board'` would now *fail to resolve* and break the build. The
rename replaced a hard build error with a silently blank screen. Fixing S1 properly therefore means
both restoring the import names *and* getting those two packages into the dependency graph — either
as real workspace members that resolve, or as declared dependencies.

**Failure scenario:** load the app at `/inn`. The Solid tree mounts, `useExploreRoom` connects to
`ExploreRoom`, `SCENE_STATE` and `HERO_STATE` arrive and the signals populate — and the page shows
an empty `<playsets-board>` box and an empty `<simple-quest>` box. No error in the console, because
unknown elements are legal HTML.

---

### S2 — Combat actions are not validated: a client can send any ability it invents · **verified**

`packages/rules-engine/src/actions.ts:35-62` · `server/src/rooms/InPlaceCombatEngine.ts:90-101` ·
`server/src/rooms/ExploreRoom.ts:86-88` · `server/src/rooms/BiomeRoom.ts:116-118`

`PLAYER_ACTION` carries the whole `Action` object, including `action.ability`, straight from the
client to `resolveAction`. The only checks on the ability path are (a) it is your turn, and (b) you
have not already used an ability with that `id` **this turn** — and the client chooses the `id`.
Nothing checks that the ability is one of `actor.abilities`, that `energyCost` is the real cost,
that `diceNotation` is the real notation, or that the target is in range.

I ran this against the repo's own installed `rules-engine`:

```
forged ability, hero.abilities = [], enemy 18 tiles away, energyCost: 0
  → damage dealt: 1,000,000 | energy delta: -0 | enemy hp 30 → 0 | combat over: true | winner: players

forged self-heal, energyCost: 0
  → hero hp 1 → 12 (full)
```

Four separate consequences from the one gap:

1. **Arbitrary damage.** `diceNotation: {kind:'notation', value:'1d1+999999'}` one-shots anything.
2. **Arbitrary healing.** `effect:'heal'`, `targetType:'self'` — full heal, free.
3. **Unlimited actions per turn.** With `energyCost: 0`, energy never drops, so the auto-advance at
   `ExploreRoom.ts:391` never fires; and since the client picks the `id`, the used-this-turn set
   never collides. Send `id:"a1","a2","a3"…` and act forever.
4. **Remote allocation DoS.** `rollDice` (`packages/rules-engine/src/dice.ts:14`) does
   `Array.from({length: count})` with no cap. Measured: `2000000d6` builds a 2,000,000-element
   array in 91 ms. `100000000d6` is a legal array length and would block the event loop for
   seconds while allocating ~800 MB — from a single WebSocket message. (`100000000000d6` throws
   `Invalid array length`, which the room's `try/catch` absorbs; the damaging range is the one that
   allocates successfully.) *The 100M extrapolation is linear from the measured 2M figure, not
   separately measured.*

**Failure scenario:** any authenticated player, on their own turn in the Inn or a biome, sends one
`PLAYER_ACTION` with a hand-written `ability` object. They win instantly, or they hang the server
for every other connected player.

**Note on where the fix belongs:** `getValidActions` (`packages/rules-engine/src/valid-actions.ts:25-32`)
already enumerates the legal actions correctly. The server just never compares the incoming action
against it.

---

### S3 — Rooms trust a client-supplied hero ID, and then broadcast everyone's hero UUIDs · **code-verified**

`server/src/rooms/ExploreRoom.ts:173-183, 313` · `server/src/rooms/BiomeRoom.ts:180-189, 311`

`onJoin` verifies the token and gets a real `userId` — and then does this:

```ts
const heroIds = options.heroIds ?? []      // straight from the client
client.userData = { userId, heroIds }      // stored without ever checking ownership
```

Every downstream use resolves the hero by that ID with **no ownership check**:

| Site | What it does with a hero you may not own |
|---|---|
| `ExploreRoom.ts:152-169` (`READY`) | `getHero(heroIds[0])` → sends you its full `HERO_STATE`: name, class, personality, profession, gear, star rating — and calls `restoreHp` on it |
| `ExploreRoom.ts:263`, `BiomeRoom.ts:255` (`startCombat`) | builds the combat actor from that hero — you play as it |
| `ExploreRoom.ts:462`, `BiomeRoom.ts:500` (`endCombat`, win) | `updateCurrentHp(a.id, a.hp)` — persists damage to it |
| `ExploreRoom.ts:471`, `BiomeRoom.ts:516` (`endCombat`, loss) | `updateRecoveryEndsAt(...)` — locks it out for 8 hours |
| `BiomeRoom.ts:456-464` (`USE_POTION`) | consumes a potion from that hero's inventory |

**Where the attacker gets a hero ID — this is the part that makes it practical.** `startCombat`
ends with `this.broadcast('COMBAT_START', this._combat.getCombatState())`
(`ExploreRoom.ts:313`, `BiomeRoom.ts:311`). `getCombatState().actors` is keyed by `hero.id`, the
real database UUID, and `broadcast` goes to **every client in the room**. The client stores it —
`useExploreRoom.ts:225` sets it into a signal. So simply standing in the Inn while somebody else
fights hands you their hero's primary key. IDs are `gen_random_uuid()` and unguessable, but they
are not secret.

Supplying them is trivial: `apps/game/src/session.ts:11` reads `heroIds` from
`sessionStorage['tactical-rpg-hero-ids']`, and `useExploreRoom.ts:147` passes them to
`joinRoom('ExploreRoom', { token, heroIds })`. Edit the key in devtools, reload.

**Failure scenario:** B watches A fight in the Inn and reads A's hero UUID off `COMBAT_START`. B
writes that UUID into `sessionStorage`, reloads, and joins. B now sees A's full character sheet,
plays as A's hero, and on a loss writes an 8-hour `recovery_ends_at` onto it — A's hero is bricked
for the rest of the evening and A never touched anything.

**The fix shape:** `onJoin` already has the authenticated `userId`. Intersecting the requested
`heroIds` with `listHeroes(userId)` closes all six sites at once. `ExploreRoom.ts:144-149` already
does the DB lookup when the client sends *no* heroIds — it just trusts them when they are present.

---

### S4 — `/inventory/move-potion` has no hero-ownership check: steal another player's potions · **code-verified**

`server/src/routes/inventory.ts:24-37` · `server/src/db/inventory-service.ts:82-107`

`movePotion(userId, heroId, direction)` takes the `userId` from the token (correct) and the
`heroId` from the request body (unchecked). With `direction: 'to-stash'` it credits **your** stash
and debits **that hero's** inventory:

```ts
sql`update player_inventory set health_potions = ${inv.healthPotions + 1} where user_id = ${userId}`,
sql`update hero_inventory  set health_potions = ${heroInv.healthPotions - 1} where hero_id = ${heroId}`,
```

Two lines above in the same file, `upgradeHeroStar` **does** check:
`if (heroRow.user_id !== userId) throw new Error('Not your hero')` (`inventory-service.ts:112`).
`routes/heroes.ts:67` checks. `routes/debug.ts:40,55` check. So this is an oversight in one
function, not a policy.

It composes with `GET /inventory/hero/:heroId` (`routes/inventory.ts:17-20`), which is behind auth
but likewise unchecked — so the attacker can read the victim's potion count first and know exactly
how many times to loop.

**Failure scenario:** B obtains A's hero UUID (S3 — it is broadcast). `GET /inventory/hero/<A's hero>`
returns `{healthPotions: 6}`. B `POST`s `/inventory/move-potion {heroId: "<A's hero>", direction: "to-stash"}`
six times. A's hero is out of potions mid-biome; B's stash is up six.

---

### S5 — `/debug/*` is mounted in every build with no gate · **code-verified**

`server/src/http-app.ts:27` · `server/src/routes/debug.ts`

```ts
app.route('/debug', debugRoutes)   // unconditional
```

There is no environment check anywhere in the server — `grep -rniE "NODE_ENV|rate.?limit|helmet|throttle" server/src`
returns **nothing**. `debug.ts` requires auth and correctly restricts you to your *own* stash and
your *own* hero, so this is not a cross-user hole. It is an economy hole: any registered account
can mint unlimited gold, potions, star fragments and decor shards against the production database.

That voids the entire shipped "Biome Entry" milestone — loot tables, drop weights and the
star-upgrade cost curve all become decorative, because `POST /debug/give-items {"starFragments": 999999}`
is one request away.

Input handling is also thin: `Math.max(0, body.gold ?? 0)` (`debug.ts:21-24`) clamps negatives but
does not check for integers or an upper bound. `{"gold": 1.5}` and `{"gold": "abc"}` (→ `NaN`) both
reach an `integer` column; the columns are int4, so `{"gold": 2000000000}` twice overflows. Each of
those surfaces as an unhandled DB error rather than a 400.

**Failure scenario:** sign up with any email, `POST /debug/give-items {"gold": 999999999, "starFragments": 999999}`,
and you are at ★5 on every hero with no gameplay.

---

### S6 — Any authenticated user can overwrite any designer scene · **code-verified**

`server/src/routes/scenes.ts:15-21` · `server/src/db/scene-service.ts:9-14`

`PUT /scenes/:slug` is behind `authMiddleware`, and then:

```sql
insert into scenes (slug, scene_data, created_by, updated_at) values (...)
on conflict (slug) do update set scene_data = excluded.scene_data, updated_at = now()
```

The conflict branch never compares `created_by`. The `scenes` table has it
(`003_self_hosted_bootstrap.sql:69`) and the function is *passed* the `userId` — it just uses it
only on insert.

This is not only a vandalism concern: `ExploreRoom.onCreate` boots the Inn from
`fetchScene('inn-main')` (`ExploreRoom.ts:32`). Overwriting that slug reshapes the Inn — NPCs,
doors, enemy placements — for everyone.

**Failure scenario:** any account sends `PUT /scenes/inn-main {"sceneData": {"tokens": []}}`. The
next `ExploreRoom` instance boots an Inn with no innkeeper, no doorkeeper and no doors, and
`created_by` still names the original author.

---

### S7 — Hand-rolled auth: enumeration, leaked internals, no revocation, no key floor

`server/src/auth.ts` · `server/src/routes/auth.ts` · `server/src/middleware.ts`

The core is sound — `jose` for HS256, `Bun.password` (argon2 by default) for hashing, parameterised
`postgres` templates throughout, `sub` taken from the token and never from the body in
`authMiddleware`. **Negative control, verified: `alg: none` is rejected** (`jose` refuses a
`Uint8Array` key for `none`), so there is no algorithm-confusion path here. The problems are around
the edges:

**a. Signup enumerates registered emails · code-verified.** `signup` throws
`'Email already registered'` (`auth.ts:21`) and `routes/auth.ts:15` returns `e.message` verbatim.
`POST /auth/signup {"email":"x@y.com","password":"anything123"}` answers
`{"error":"Email already registered"}` for a real account and `201` for a new one. Unlimited, no
rate limit (confirmed: no throttling anywhere in `server/src`).

**b. Login leaks the same fact by timing · code-verified, not benchmarked.** `login` returns early
when `!user` (`auth.ts:35`) without a dummy `Bun.password.verify`. A miss costs one indexed lookup;
a hit costs an argon2 verify. I did not measure the gap in this environment — labelled
**unverified** — but the asymmetric code path is unambiguous.

**c. Internal errors are returned to the client · code-verified.** `routes/auth.ts:15` returns any
`Error.message` as the response body. Two concrete leaks:
  - `AUTH_JWT_SECRET` unset → `secret()` throws (`auth.ts:6`) → the client is told
    `{"error":"AUTH_JWT_SECRET is not set"}`.
  - Two concurrent signups for the same email race past the `select` at `auth.ts:20` and one hits
    the `users_email_key` unique constraint → the raw Postgres constraint message is returned.

**d. A failed signup can strand an account · code-verified.** `signup` **inserts the user first**
(`auth.ts:24-27`) and issues the token afterwards (`auth.ts:28`). If `issueToken` throws — the
unset-secret case above — the row is already committed. The caller gets a 400, has no token, and
every retry now answers `'Email already registered'`. That email is unusable, and there is no
password reset and no account deletion in the codebase.

**e. 30-day tokens, no revocation, no key floor.** `issueToken` sets `30d` (`auth.ts:15`). There is
no session table, no `jti`, no token version — nothing can invalidate an issued token before it
expires. There is also no password-change endpoint, so a leaked token is good for 30 days, full
stop. And `secret()` accepts any non-empty string: **verified — I signed and verified a 30-day
token with the 4-character secret `"abcd"`.** Nothing enforces a minimum length, so a weak
`AUTH_JWT_SECRET` yields brute-forceable tokens with no warning.

**f. Misconfiguration presents as "everyone's token is invalid".** `secret()` throws at *request*
time, not boot. With `AUTH_JWT_SECRET` unset the server starts, `/health` returns `ok`, and
`authMiddleware`'s bare `catch` (`middleware.ts:10-12`) turns the config error into
`401 Invalid token` for every user. That is a misleading signal to debug from.

**g. The whole authorization surface is untested.** `server/src/__tests__/auth.test.ts` covers
`verifyToken` well (5 cases). `http-app.test.ts` covers `/health` and a 404. **No test anywhere
exercises an authenticated route, and no test asserts an ownership check** — which is why S4 and
S6 are invisible to the suite. `signup`/`login` are additionally *untestable as written* under
`pnpm test`: they call `Bun.password` (`auth.ts:23,35`) and vitest runs on Node, where `Bun` is
undefined.

---

### S8 — Every inventory and hero mutation is a non-atomic read-modify-write · **code-verified**

`server/src/db/inventory-service.ts:36-57, 82-107, 109-128` · `server/src/db/hero-service.ts:64-78`

Each of these reads a value into JS and writes back an **absolute** result rather than a relative
`SET x = x - 1`, with no transaction:

```ts
const inv = await this.getOrCreate(userId)                    // read
sql`update player_inventory set health_potions = ${inv.healthPotions - 1} …`   // absolute write
```

`movePotion` compounds it: the two updates go out in a `Promise.all` (`inventory-service.ts:94-97`),
so there is no transaction spanning the debit and the credit.

**Failure scenarios:**
- *Duplication.* Stash has 1 potion. Fire two `to-hero` requests together: both read `1`, both
  write stash `0` and hero `+1`. Hero gains 2, stash loses 1.
- *Free upgrade.* 6 star fragments, two heroes each costing 6. Two concurrent `upgrade-star` calls
  both pass `inv.starFragments < cost` and both write `0`. Two upgrades, paid once.
- *Lost loot.* Two combats resolving together in a biome: both `addLoot` read the same base and the
  second write discards the first.
- *Torn transfer.* If the hero-side update in `movePotion` fails after the stash-side succeeds, the
  potion is destroyed. Nothing rolls back.

Related, in `BiomeRoom.handleUsePotion` (`BiomeRoom.ts:462-464`): the heal is applied to combat
state **before** `useHeroPotion` is awaited, and there is no rollback if it throws. Two rapid
`USE_POTION` messages on a hero with 1 potion both pass the `<= 0` guard at `BiomeRoom.ts:457`,
both heal to full, and the second `useHeroPotion` throws inside an `async` `onMessage` handler that
nothing catches — an unhandled rejection, and a free heal.

---

### S9 — Loot is paid in full to every participant, and anyone can join your fight · **code-verified**

`server/src/rooms/BiomeRoom.ts:486-509, 231-246`

`endCombat` rolls the drop table once and then awards **that same `loot` object** to every
participant (`BiomeRoom.ts:501-506`). Five participants means five times the loot from one enemy.
Whether that is intended as a party share is a design call — but it combines badly with the join
rule: `handleMove` offers `COMBAT_JOIN_OFFER` to anyone who wanders within 4 tiles
(`BiomeRoom.ts:242-245`), `handleJoinCombat` accepts unconditionally, and there is no contribution
check at payout.

**Failure scenario:** A pulls a Forest Spirit. B walks within 4 tiles, gets the offer, sends
`JOIN_COMBAT`, and stands still. A kills it. B receives the full drop-table roll — including star
fragments — for zero risk and zero actions.

Two related gaps in the same function:
- On a **loss**, hero HP is never persisted (`BiomeRoom.ts:512-519` only writes `recovery_ends_at`),
  while on a **win** it is. Survivors of a losing fight come back at full health.
- On a **win**, downed allies are persisted at `hp: 0` (`updateCurrentHp` runs for every non-NPC,
  ghosts included) but get **no** recovery timer — recovery is only set on the loss branch. That
  hero is at 0 HP and not recovering, a state nothing else in the codebase expects.

---

### S10 — The shipped economy is largely cosmetic · **code-verified**

The "Biome Entry" milestone lists star upgrades, hero inventory and loot as complete. The
persistence and the UI are there; the *effects* mostly are not. I grepped for every consumer of
each field:

| Feature | What reads it | Verdict |
|---|---|---|
| `starRating` | `hero-service` (row mapping), `upgradeHeroStar` (writes), `HERO_STATE` payloads, `InventoryPanel` (label) | **Never read by `rules-engine`, `InPlaceCombatEngine`, or the `ActorState` construction at `ExploreRoom.ts:269-285` / `BiomeRoom.ts:261-277`.** 360 star fragments to reach ★5 changes a label and nothing else. |
| `isRecovering` | `PartyPicker.tsx:20`, `ConnectScreen.tsx:84` | **Client-side only.** No server code checks it. `ExploreRoom.READY` even resolves heroIds via `listHeroes` (`ExploreRoom.ts:145`), which does not filter recovering heroes. The 8-hour death penalty is advisory. |
| `gear.offhand` / `.armor` / `.trinket` | `PATCH /heroes/:id/gear` accepts them; `GearSlots` declares them; the DB stores them | **Nothing ever reads them.** Write-only. |
| `gear.weapon` | `weaponDamageBonus` → `WEAPON_DAMAGE_BONUSES` | That map has **exactly one entry**: `'debug-sword': 1` (`packages/shared-types/src/inventory.ts:35-37`). |

**Failure scenario (recovery):** a hero dies in a biome and gets an 8-hour lockout. The player
clears `tactical-rpg-hero-ids` in sessionStorage and reloads — `ExploreRoom.READY` resolves heroIds
from the DB, picks `heroes[0]` regardless of recovery state, and play continues immediately. Even
without that, `PATCH`ing gear or sending heroIds directly bypasses the two client-side guards.

**Failure scenario (gear):** `PATCH /heroes/<id>/gear {"slot":"weapon","item":"vorpal-blade-of-doom"}`
is accepted — `item` is an unvalidated string — and then does nothing, because the name is not in
`WEAPON_DAMAGE_BONUSES`.

---

### S11 — The killing blow never reaches the client · **code-verified**

`server/src/rooms/ExploreRoom.ts:382-385` · `server/src/rooms/BiomeRoom.ts:377-380`

```ts
if (this._combat.isOver()) {
  this.endCombat()
  return                       // ← the ACTION_RESULT for this hit is never broadcast
}
this.broadcast('ACTION_RESULT', actionResult)
```

The final hit's `ActionResult` is computed and then discarded. `ExploreScreen.tsx:66-88` spawns the
floating damage doobers from `state.actionResult()`, so the shot that actually wins the fight shows
no damage number and no roll — the enemy just disappears as `COMBAT_END` arrives.

**Failure scenario:** enemy at 3 HP, you hit for 7. You see no `-7` doober, no dice roll, and the
victory modal. Every other hit in the fight animates.

---

### S12 — Room message handlers have no error handling · **code-verified**

`server/src/rooms/ExploreRoom.ts:82-96, 98-119` · `server/src/rooms/BiomeRoom.ts:112-130`

Every `async` `onMessage` handler awaits database work with no `try/catch`: `MOVE` → `startCombat`
→ `heroService.getHero`; `READY` → `listHeroes` + `getHero` + `restoreHp`; `JOIN_COMBAT`;
`USE_POTION`; `REST`. Colyseus does not catch rejections from these callbacks.

Worse, `handleMove` mutates and broadcasts the player's position (`ExploreRoom.ts:204-207`)
*before* the DB work. A Postgres blip therefore leaves the world half-updated: the client sees
`PLAYER_MOVED` and moves, the encounter that the move should have triggered never starts, and the
only trace is an unhandled rejection in the server log.

**Failure scenario:** Postgres restarts. A player walks toward a wolf. Their token moves. No
`ENCOUNTER`, no `COMBAT_START`, no `ACTION_REJECTED` — the game just stops responding to that
mechanic, silently, until the room is recreated.

---

### S13 — Dead code, and one dead path that is also an unauthenticated surface

**`TurnRoom` and `CombatRoom` are defined but never joined — and neither authenticates.**
`game-server.ts:14-15` registers both. The client only ever joins `ExploreRoom` and `BiomeRoom`
(`useExploreRoom.ts:147`, `useBiomeRoom.ts:77`). Unlike those two, `TurnRoom.onJoin`
(`TurnRoom.ts:41`) **never calls `verifyToken`** — any WebSocket client can
`joinOrCreate('TurnRoom', {actors: […], roomId: 'x'})` with a hand-authored actor list. Worse,
`handlePlayerAction` (`TurnRoom.ts:49-52`) ignores its `_client` argument entirely and executes
whatever action arrives for whoever's turn it currently is — so any connected client can act on
any player's turn. Impact today is contained (neither room touches the database), but it is live,
reachable and unauthenticated.

Two more real bugs live in that dead path, worth knowing before it is revived:
`CombatRoom.onLeave` (`CombatRoom.ts:27-29`) clears the *shared* turn timer, so one player leaving
stalls combat for everyone; and `getValidActions` (`valid-actions.ts:14-23`) generates move
destinations **without any wall check**, so `TurnRoom`'s NPCs walk through walls — while
`InPlaceCombatEngine`'s own NPC mover (`InPlaceCombatEngine.ts:216`) does check. The two combat
engines do not follow the same rules.

**Unreachable UI code.** `apps/game/src/screens/CombatScreen.tsx` and
`apps/game/src/screens/InnView.tsx` have zero references — neither is routed in `App.tsx`.
`PlaysetBoard.tsx:39` routes both `'explore'` and `'combat'` to `ExploreBoard`, so `BattleBoard` is
reachable only via `mode="vtt"`, which nothing passes — taking `SceneManager`, `ActorRenderer` and
`GridRenderer` with it. That dead path is why `@babylonjs/core` is a dependency and why
`apps/game/vite.config.ts:18` pre-bundles it; the BabylonJS texture-loader chunks are visible in
the 5.26 MB build output. `GridRenderer.test.ts`'s 6 passing tests test dead code.

**Two parallel state-sync mechanisms.** The server maintains a full Colyseus `ExploreState` schema
*and* hand-broadcasts JSON duplicates of the same data (`SCENE_STATE`, `PLAYER_LIST`,
`PLAYER_MOVED`, `PLAYER_LEFT`). The client's own comments say why — "fires only if binary schema
sync works" (`useExploreRoom.ts:153`), "bypasses schema binary sync" (`:193`), "used when binary
schema sync is unavailable" (`:203`). **Enemies are the one entity with no JSON fallback**
(`useExploreRoom.ts:172-178`); they come only from the schema `onAdd`. So enemy rendering depends
on the single mechanism the surrounding code treats as unreliable.

*Whether binary sync is actually broken is **unverified** — I could not run the stack.* Against it:
the resolved versions match (`@colyseus/schema` 2.0.37 on both sides; `colyseus.js` 0.15.28 bundles
the same 2.0.37), so there is no version skew to explain a failure. **How to settle it in one
minute:** run the server, join the Inn, and watch for the `[useExploreRoom] schema onAdd player`
console line at `useExploreRoom.ts:155`. If it never prints, sync is dead and enemies are invisible;
if it prints, the entire JSON layer is removable debt.

---

### S14 — There is no way to sign out, and two session stores disagree · **code-verified**

`apps/game/src/lib/auth.ts` vs `apps/game/src/session.ts`

The app keeps the session in two places at once:

| | store | key | written by |
|---|---|---|---|
| `lib/auth.ts:26` | **localStorage** | `tactical-rpg-session` | `signUp` / `signInWithPassword` |
| `session.ts:16` | **sessionStorage** | `tactical-rpg-token` | `ConnectScreen.tsx:95,103` |

`useExploreRoom.ts:145-147` reads both — it keys the effect on the sessionStorage token, then
prefers the localStorage one, falling back with `?? t`.

`auth.signOut()` (`lib/auth.ts:67`) clears only localStorage — and **`grep` finds no caller
anywhere in the app**. There is no sign-out UI at all. `onAuthStateChange` and `getUser` are
likewise never called. So: the localStorage session persists indefinitely with a 30-day
non-revocable token (S7e), while the sessionStorage token dies on tab close, meaning the two stores
routinely disagree about whether you are logged in. On a shared machine, closing the tab looks like
logging out and is not.

---

### S15 — Repository hygiene (low, but it is what "untouched for a month" looks like)

- **`package-lock.json` is untracked and un-ignored.** `git check-ignore` does not match it; the
  `wt` container's startup command is `npm install … && npx vite`, which generated it. In a pnpm
  repo, `.gitignore` should cover `package-lock.json` so a stray `npm install` cannot be committed.
  I did **not** commit it, and `pnpm install` left `pnpm-lock.yaml` untouched.
- **`patches/bun-serve-express@1.0.5.patch` is orphaned.** `package.json` has `"pnpm": {}` with no
  `patchedDependencies`, the package is not in the lockfile, and nothing imports it. The patch has
  never been applied.
- **`vitest.workspace.js` and `vitest.workspace.ts` both exist** with identical content — the `.js`
  is a compiled artifact checked in beside its source.
- **The preview serves the wrong directory.** No root `dev` script, so a generic runner does
  `npx vite` at the repo root and misses `apps/game/vite.config.ts` (Section 0).
- **Placeholder copy contradicts shipped features.** `ExploreScreen.tsx:36` still says
  *"Biome exploration is coming in the next update"* and `:23` *"when gear equipping arrives"* —
  both shipped.
- **Biome rooms are not filtered by biome.** `game-server.ts:13` defines `BiomeRoom` with no
  `filterBy`, and `onCreate` takes `biomeId` from whichever client created the room
  (`BiomeRoom.ts:79`). A second player asking for a different biome joins the *existing* room and
  silently lands in someone else's biome.
- **Spawn points never respawn.** `EnemyManager.onPlayerMove` sets `sp.triggered = true`
  permanently (`EnemyManager.ts:71`) and defeated enemies are removed. After the five Verdant
  Forest spawns are cleared, the biome is empty for the life of that room instance.
- **Movement is client-paced.** `handleMove` validates range per message but there is no cooldown,
  so a client that sends `MOVE` in a loop crosses the 100×100 biome as fast as it can send.

---

## The three failing tests, diagnosed

### 1 & 2 · `PlaysetBoard.test.tsx` — "renders in combat mode with combatState" / "calls onAction when provided" → **stale tests**

Both assert `document.querySelector('canvas')` is not null for `mode="combat"`. `PlaysetBoard.tsx:39`
now reads:

```ts
if (props.mode === 'explore' || props.mode === 'combat') return <ExploreBoard {...props} />
return <BattleBoard {...props} />
```

`ExploreBoard` renders `<playsets-board>`, not `<canvas>`. `git log -S` pins the change to commit
**`ea76207`** ("feat: inn gameplay — encounter panel, innkeeper rest, HP persistence, **combat
mode**"), which deliberately moved combat rendering off the BabylonJS canvas and onto the web
component. The tests were not updated.

**Verdict: stale, not a regression.** The correct fix is to assert on `playsets-board` — but note
that doing so makes them assert the *element the app never registers* (S1), so they would pass
while the feature is broken. These two tests are also the only coverage `BattleBoard` had; deleting
them without deleting `BattleBoard` leaves ~120 lines of dead BabylonJS code with none.

### 3 · `enemy-manager.test.ts` — "returns null when player is on the same cell as an enemy (dist 0)" → **stale test, over a genuinely unhandled state**

The original implementation used exact adjacency:

```ts
if (dist === 1) { found = { … } }        // commit 2c4c9b8
```

Under that rule, `dist === 0` returned `null` for free, and the test recorded it. Commit
**`cc27721`** changed it to `if (dist <= 3)` — its own message says *"Encounter radius expanded
from 1 to 3"*. That is deliberate; the test was not updated. **Verdict: stale.**

But the assertion was asking a real question that the code no longer answers. `dist <= 3` has no
lower bound, and nothing stops a player standing *on* an enemy: `isWalkable`
(`explore-logic.ts:12-16`) checks walls only, never occupancy, and `handleMove` checks nothing else.
So dist 0 is reachable in play, and `startCombat` then places both actors on the same cell
(`ExploreRoom.ts:280` uses the player's position, `:301` the enemy's — identical).

I traced what actually happens rather than assuming a crash: nothing crashes. `getValidActions`
excludes occupied cells (`valid-actions.ts:19`) and the NPC mover excludes them too
(`InPlaceCombatEngine.ts:208-216`), and the NPC attack check requires `dist === 1`
(`InPlaceCombatEngine.ts:185`) — so an enemy sharing your cell **can never attack you**. It looks
for an adjacent player, finds none, and walks away. The game degrades oddly rather than failing.

**Recommendation:** decide the rule first. If standing on an enemy should not trigger an encounter,
`dist > 0 && dist <= 3` plus an occupancy check in `handleMove` restores the test's intent. If it
should, delete the test. Either way it is a decision, not a repair.

---

## Coverage — what I read and what I did not

**Read in full:** all of `server/src` (`auth.ts`, `middleware.ts`, `http-app.ts`, `index.ts`,
`game-server.ts`, every file in `routes/`, `db/`, `rooms/`, `rooms/logic/`, `schemas/`, and
`003_self_hosted_bootstrap.sql`); all of `packages/rules-engine`; `packages/shared-types`
(`index.ts`, `combat-bfs.ts`, `inventory.ts`, `hero-persistence.ts`);
`packages/playsets/src/PlaysetBoard.tsx` and `types.ts`; `packages/simplequest-hud/src/index.tsx`;
`apps/game/src/lib/auth.ts`, `session.ts`, `App.tsx`, `hooks/useGameServer.ts`,
`hooks/useExploreRoom.ts`, `screens/CombatScreen.tsx`, `screens/DebugScreen.tsx`; and the
`server/src/__tests__` auth/http-app tests plus both failing test files.

**Read partially:** `apps/game/src/screens/ExploreScreen.tsx` (first ~120 of 609 lines, plus
targeted greps); `packages/click-comics/src/click-comic.ts` (first ~60 lines).

**Not read — I am not claiming these are clean, only that I did not look:**
`apps/game/src/screens/BiomeScreen.tsx` (531 lines), `ConnectScreen.tsx`, `BuildScreen.tsx`,
`InnView.tsx`; the components `InventoryPanel`, `PartyPicker`, `CombatResultModal`, `ComicPlayer`;
the hooks `useBiomeRoom`, `useInventory`, `useHeroes`, `useContent`; `services/scene-service.ts`,
`lib/sprites.ts`; the rest of `packages/click-comics`; `packages/playsets`' `SceneManager.ts`,
`ActorRenderer.ts`, `GridRenderer.ts`; `shared-types`' `inn-map.ts`, `scene-data.ts`,
`explore-map.ts`, `ability-types.ts`; and the 18 passing test files I did not open.
`BiomeScreen.tsx` is the largest single gap — I reached it only by grep, and it is the screen where
the shipped milestone lives.

**Verification method.** Findings marked *verified* were executed. I wrote a throwaway vitest file
against the repo's own installed `rules-engine` and `jose`, ran it, and deleted it — the tree was
clean afterwards (`git status` showed only the pre-existing untracked `package-lock.json`). It
confirmed: the forged-ability damage figure, the forged self-heal, the `rollDice` allocation
measurement, the 4-character-secret acceptance, **and one negative control that came back negative**
(`alg: none` is rejected, so there is no algorithm-confusion vulnerability here). S1 was verified by
building the client and searching the bundle. Findings marked *code-verified* were established by
reading the code path end to end but not executed, because they need a live Postgres and a running
Colyseus server. Two things are explicitly **unverified** and labelled as such in place: the login
timing gap (b in S7), and whether Colyseus binary schema sync actually works (S13).

## Suggested order of work

1. **S1** — restore the two custom-element imports and get those packages into the dependency
   graph. Nothing else is observable until this is done.
2. **S2** — validate incoming abilities against `actor.abilities`, and cap `rollDice`'s count.
   Both are small; `getValidActions` already knows the right answer.
3. **S3** — intersect client-supplied `heroIds` with `listHeroes(userId)` in both rooms' `onJoin`.
   One check closes six sites.
4. **S4, S6** — add the ownership check that the sibling functions already have.
5. **S5** — gate `/debug` behind an environment flag.
6. **S7** — generic signup response, stop returning `Error.message` to clients, issue the token
   before committing the user row, add a minimum secret length, shorten the token lifetime.
7. **S8** — relative SQL updates (`SET x = x - 1`) inside transactions.
8. Then decide about S10 (make stars and recovery mean something, or drop them) and S13 (pick one
   state-sync mechanism and delete the other) — those are design calls, not repairs.
