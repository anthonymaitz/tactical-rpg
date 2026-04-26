# Enemy + Proximity Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fixed and spawn-point enemies to the explore world; fire an `ENCOUNTER` message when a player steps adjacent to one, displayed via ComicPlayer as a placeholder for sub-project 4 combat.

**Architecture:** `EnemyManager` encapsulates enemy loading (fixed tokens) and spawn-point triggering (proximity-based), then checks adjacency after every player move. `ExploreRoom` delegates to it after updating position and sends `ENCOUNTER` to the specific moving client. Client wires up the `ENCOUNTER` message to a SolidJS signal and renders via the existing `ComicPlayer` path. Builder gains `enemy:skeleton` and `spawn-point:` token types in `BuilderToolbar`.

**Tech Stack:** Colyseus 0.15 schema (MapSchema, @type decorators), Bun server, vitest (node), SolidJS, click-comics, shared-types

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/shared-types/src/scene-data.ts` |
| Modify | `server/src/schemas/ExploreState.ts` |
| Create | `server/src/rooms/EnemyManager.ts` |
| Create | `server/src/__tests__/enemy-manager.test.ts` |
| Modify | `server/src/rooms/ExploreRoom.ts` |
| Modify | `apps/game/src/hooks/useExploreRoom.ts` |
| Modify | `apps/game/src/screens/ExploreScreen.tsx` |
| Modify | `playsets experiments/apps/client/src/builder/BuilderToolbar.tsx` |

---

## Task 1: Extend shared-types — SceneToken and EncounterEvent

**Files:**
- Modify: `packages/shared-types/src/scene-data.ts`

- [ ] **Step 1: Add `'enemy'` and `'spawn-point'` to `SceneToken.type`, plus `level` and `spawnRadius` fields; add `EncounterEvent` interface**

Replace the `SceneToken` interface in `packages/shared-types/src/scene-data.ts`:

```ts
export interface SceneToken {
  id: string
  type: 'npc' | 'door' | 'enemy' | 'spawn-point'
  col: number
  row: number
  role?: 'innkeeper' | 'blacksmith' | 'doorkeeper'
  name?: string
  biomeId?: string
  label?: string
  level?: number
  spawnRadius?: number
}
```

Add after the `SceneToken` interface (before `SceneData`):

```ts
export interface EncounterEvent {
  enemyId: string
  enemyName: string
  x: number
  y: number
}
```

Update the `SceneData` interface to keep `tokens` typed correctly (no change needed — it references `SceneToken[]` which already picks up the new type union automatically).

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter shared-types typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
git add packages/shared-types/src/scene-data.ts
git commit -m "feat(shared-types): add enemy/spawn-point token types and EncounterEvent"
```

---

## Task 2: Add EnemyEntity schema to ExploreState

**Files:**
- Modify: `server/src/schemas/ExploreState.ts`

- [ ] **Step 1: Add `EnemyEntity` class and `enemies` MapSchema to `ExploreState`**

Open `server/src/schemas/ExploreState.ts`. Add the new class and update `ExploreState`:

```ts
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema'

export class PlayerPosition extends Schema {
  @type('number') x: number = 0
  @type('number') y: number = 0
  @type('string') characterId: string = ''
}

export class NpcEntity extends Schema {
  @type('string') id: string = ''
  @type('string') name: string = ''
  @type('string') role: string = ''
  @type('number') x: number = 0
  @type('number') y: number = 0
}

export class DoorEntity extends Schema {
  @type('string') id: string = ''
  @type('string') biomeId: string = ''
  @type('string') label: string = ''
  @type('number') x: number = 0
  @type('number') y: number = 0
}

export class EnemyEntity extends Schema {
  @type('string') id: string = ''
  @type('string') name: string = ''
  @type('number') x: number = 0
  @type('number') y: number = 0
  @type('number') hp: number = 10
  @type('number') maxHp: number = 10
  @type('number') level: number = 1
  @type('boolean') fromSpawnPoint: boolean = false
}

export class ExploreState extends Schema {
  @type({ map: PlayerPosition }) players = new MapSchema<PlayerPosition>()
  @type([NpcEntity]) npcs = new ArraySchema<NpcEntity>()
  @type([DoorEntity]) doors = new ArraySchema<DoorEntity>()
  @type({ map: EnemyEntity }) enemies = new MapSchema<EnemyEntity>()
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter server typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
git add server/src/schemas/ExploreState.ts
git commit -m "feat(server): add EnemyEntity schema and enemies MapSchema to ExploreState"
```

---

## Task 3: Create EnemyManager with TDD

**Files:**
- Create: `server/src/rooms/EnemyManager.ts`
- Create: `server/src/__tests__/enemy-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/__tests__/enemy-manager.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { EnemyManager } from '../rooms/EnemyManager'
import type { SceneToken, EncounterEvent } from 'shared-types'

// Minimal stand-ins — EnemyManager only calls .set() and iterates via forEach
function makeMapSchema() {
  const store = new Map<string, ReturnType<typeof makeEnemy>>()
  return {
    set(id: string, e: ReturnType<typeof makeEnemy>) { store.set(id, e) },
    delete(id: string) { store.delete(id) },
    forEach(cb: (v: ReturnType<typeof makeEnemy>, k: string) => void) { store.forEach(cb) },
    get size() { return store.size },
  }
}

function makeEnemy(partial: {
  id?: string; name?: string; x?: number; y?: number
  hp?: number; maxHp?: number; level?: number; fromSpawnPoint?: boolean
}) {
  return {
    id: partial.id ?? '',
    name: partial.name ?? 'Enemy',
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    hp: partial.hp ?? 10,
    maxHp: partial.maxHp ?? 10,
    level: partial.level ?? 1,
    fromSpawnPoint: partial.fromSpawnPoint ?? false,
  }
}

describe('EnemyManager — fixed enemies', () => {
  it('loads enemy tokens into the MapSchema on construction', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 3, name: 'Skeleton', level: 2 },
    ]
    new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(enemies.size).toBe(1)
  })

  it('returns ENCOUNTER when player moves adjacent to a fixed enemy', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 5, name: 'Goblin', level: 1 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    const result = mgr.onPlayerMove(4, 5)
    expect(result).not.toBeNull()
    expect(result!.enemyId).toBe('e1')
    expect(result!.enemyName).toBe('Goblin')
  })

  it('returns null when player is not adjacent to any enemy', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 5, name: 'Goblin', level: 1 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(mgr.onPlayerMove(10, 10)).toBeNull()
  })

  it('returns null when player is on the same cell as an enemy (dist 0)', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 5, name: 'Goblin', level: 1 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(mgr.onPlayerMove(5, 5)).toBeNull()
  })
})

describe('EnemyManager — spawn points', () => {
  it('does not pre-populate enemies from spawn-point tokens', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 3 },
    ]
    new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(enemies.size).toBe(0)
  })

  it('spawns an enemy when player enters spawn radius', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 3 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    mgr.onPlayerMove(10, 12) // dist = 2, within radius 3
    expect(enemies.size).toBe(1)
  })

  it('does not spawn twice from the same spawn point', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 3 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    mgr.onPlayerMove(10, 12)
    mgr.onPlayerMove(10, 12)
    expect(enemies.size).toBe(1)
  })

  it('does not spawn when player is outside radius', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 3 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    mgr.onPlayerMove(10, 20) // dist = 10, outside radius 3
    expect(enemies.size).toBe(0)
  })

  it('returns ENCOUNTER when player moves adjacent to a spawned enemy', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'sp1', type: 'spawn-point', col: 10, row: 10, spawnRadius: 5 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    mgr.onPlayerMove(10, 8) // triggers spawn at (10,10), dist=2, not adjacent
    const result = mgr.onPlayerMove(10, 9) // adjacent to (10,10), dist=1
    expect(result).not.toBeNull()
    expect(result!.enemyId).toBe('spawned-sp1')
  })
})

describe('EnemyManager — removeEnemy', () => {
  it('removes an enemy from the map', () => {
    const enemies = makeMapSchema()
    const tokens: SceneToken[] = [
      { id: 'e1', type: 'enemy', col: 5, row: 5, name: 'Goblin', level: 1 },
    ]
    const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
    expect(enemies.size).toBe(1)
    mgr.removeEnemy('e1')
    expect(enemies.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter server test -- --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../rooms/EnemyManager'`.

- [ ] **Step 3: Implement EnemyManager**

Create `server/src/rooms/EnemyManager.ts`:

```ts
import type { SceneToken, EncounterEvent } from 'shared-types'

interface EnemyLike {
  id: string
  name: string
  x: number
  y: number
  hp: number
  maxHp: number
  level: number
  fromSpawnPoint: boolean
}

interface EnemyMapLike {
  set(id: string, e: EnemyLike): void
  delete(id: string): void
  forEach(cb: (v: EnemyLike, k: string) => void): void
}

interface SpawnPoint {
  id: string
  x: number
  y: number
  radius: number
  triggered: boolean
}

export class EnemyManager {
  private spawnPoints: SpawnPoint[] = []

  constructor(
    private enemies: EnemyMapLike,
    private makeEnemy: (partial: Partial<EnemyLike>) => EnemyLike,
    tokens: SceneToken[],
  ) {
    for (const t of tokens) {
      if (t.type === 'enemy') {
        const level = t.level ?? 1
        this.enemies.set(t.id, makeEnemy({
          id: t.id,
          name: t.name ?? 'Enemy',
          x: t.col,
          y: t.row,
          level,
          hp: level * 10,
          maxHp: level * 10,
          fromSpawnPoint: false,
        }))
      } else if (t.type === 'spawn-point') {
        this.spawnPoints.push({
          id: t.id,
          x: t.col,
          y: t.row,
          radius: t.spawnRadius ?? 5,
          triggered: false,
        })
      }
    }
  }

  onPlayerMove(px: number, py: number): EncounterEvent | null {
    for (const sp of this.spawnPoints) {
      if (sp.triggered) continue
      const dist = Math.abs(px - sp.x) + Math.abs(py - sp.y)
      if (dist <= sp.radius) {
        sp.triggered = true
        const id = `spawned-${sp.id}`
        this.enemies.set(id, this.makeEnemy({
          id,
          name: 'Enemy',
          x: sp.x,
          y: sp.y,
          level: 1,
          hp: 10,
          maxHp: 10,
          fromSpawnPoint: true,
        }))
      }
    }

    let found: EncounterEvent | null = null
    this.enemies.forEach((enemy) => {
      if (found) return
      const dist = Math.abs(px - enemy.x) + Math.abs(py - enemy.y)
      if (dist === 1) {
        found = { enemyId: enemy.id, enemyName: enemy.name, x: enemy.x, y: enemy.y }
      }
    })
    return found
  }

  removeEnemy(id: string): void {
    this.enemies.delete(id)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter server test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all EnemyManager tests pass (12 tests). Existing explore-logic tests also pass.

- [ ] **Step 5: Typecheck server**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter server typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
git add server/src/rooms/EnemyManager.ts server/src/__tests__/enemy-manager.test.ts
git commit -m "feat(server): add EnemyManager with spawn-point and adjacency detection (TDD)"
```

---

## Task 4: Wire EnemyManager into ExploreRoom

**Files:**
- Modify: `server/src/rooms/ExploreRoom.ts`

- [ ] **Step 1: Import EnemyManager and EnemyEntity; add field; construct in onCreate; call in handleMove**

Open `server/src/rooms/ExploreRoom.ts`.

Add to imports:
```ts
import { EnemyManager } from './EnemyManager'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity, EnemyEntity } from '../schemas/ExploreState'
```

Add private field to the class (after `private _sceneData`):
```ts
private enemyManager!: EnemyManager
```

In `onCreate`, after the `for (const token of ...)` loop that loads NPCs and doors (after the closing `}`), add:
```ts
this.enemyManager = new EnemyManager(
  this.state.enemies,
  (partial) => Object.assign(new EnemyEntity(), partial),
  this._sceneData.tokens ?? [],
)
```

In `handleMove`, after `current.x = message.destination.x; current.y = message.destination.y`, add:
```ts
const encounter = this.enemyManager.onPlayerMove(current.x, current.y)
if (encounter) {
  client.send('ENCOUNTER', encounter)
}
```

The complete updated `handleMove` method:
```ts
private handleMove(client: Client, message: MoveMessage): void {
  const current = this.state.players.get(client.sessionId)
  if (!current) return
  const currentPos: Position = { x: current.x, y: current.y }
  if (!isValidMove(currentPos, message.destination, INN_MOVE_SPEED)) {
    client.send('MOVE_REJECTED', { reason: 'out_of_range' })
    return
  }
  if (!isWalkable(THE_INN, message.destination)) {
    client.send('MOVE_REJECTED', { reason: 'blocked' })
    return
  }
  current.x = message.destination.x
  current.y = message.destination.y
  const encounter = this.enemyManager.onPlayerMove(current.x, current.y)
  if (encounter) {
    client.send('ENCOUNTER', encounter)
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter server typecheck
```

Expected: exits 0.

- [ ] **Step 3: Run all server tests**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter server test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
git add server/src/rooms/ExploreRoom.ts
git commit -m "feat(server): wire EnemyManager into ExploreRoom — send ENCOUNTER on adjacency"
```

---

## Task 5: Client — encounter signal in useExploreRoom

**Files:**
- Modify: `apps/game/src/hooks/useExploreRoom.ts`

- [ ] **Step 1: Add encounter signal and ENCOUNTER message handler**

Open `apps/game/src/hooks/useExploreRoom.ts`.

Add `EncounterEvent` to the shared-types import:
```ts
import type { Position, SceneData, EncounterEvent } from 'shared-types'
```

After the `interaction` signal declaration (line 31), add:
```ts
const [encounter, setEncounter] = createSignal<EncounterEvent | null>(null)
```

In the `createEffect` reset block (where signals are cleared on reconnect), add after `setInteraction(null)`:
```ts
setEncounter(null)
```

After `r.onMessage('SCENE_STATE', ...)` and before `r.send('READY')`, add:
```ts
r.onMessage('ENCOUNTER', (data: EncounterEvent) => {
  setEncounter(data)
})
```

In the returned object, add after `dismissInteraction`:
```ts
encounter,
dismissEncounter() { setEncounter(null) },
```

The complete updated return statement:
```ts
return {
  connected,
  error,
  myPosition,
  mySessionId,
  players,
  npcs,
  doors,
  interaction,
  encounter,
  heroState,
  sceneData,
  move(destination: Position) { room?.send('MOVE', { destination }) },
  interact() { room?.send('INTERACT') },
  dismissInteraction() { setInteraction(null) },
  dismissEncounter() { setEncounter(null) },
}
```

- [ ] **Step 2: Typecheck the game package**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter game typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
git add apps/game/src/hooks/useExploreRoom.ts
git commit -m "feat(game): add encounter signal and ENCOUNTER message handler to useExploreRoom"
```

---

## Task 6: Client — render encounter via ComicPlayer in ExploreScreen

**Files:**
- Modify: `apps/game/src/screens/ExploreScreen.tsx`

- [ ] **Step 1: Add encounterPanels helper and a second Show block**

Open `apps/game/src/screens/ExploreScreen.tsx`.

After the `interactionPanels` function (around line 79), add:

```ts
const encounterPanels = (): Panel[] | null => {
  const ev = state.encounter()
  if (!ev) return null
  return [{ speaker: ev.enemyName, text: 'Blocks your path! Combat coming soon.' }]
}
```

In the JSX, after the closing `</Show>` for the interaction comic panel, add a second `Show` block:

```tsx
{/* Encounter comic panel — bottom center overlay */}
<Show when={encounterPanels()}>
  {(panels) => (
    <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
      <ComicPlayer panels={panels()} onComplete={state.dismissEncounter} />
    </div>
  )}
</Show>
```

The encounter panel renders in the same position as the interaction panel. Since only one can be shown at a time (you can't interact with an NPC while an encounter dialog is showing), this is fine.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter game typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
git add apps/game/src/screens/ExploreScreen.tsx
git commit -m "feat(game): show ENCOUNTER dialog via ComicPlayer in ExploreScreen"
```

---

## Task 7: Builder — add enemy and spawn-point token types, rebuild library

**Files:**
- Modify: `playsets experiments/apps/client/src/builder/BuilderToolbar.tsx`

- [ ] **Step 1: Add enemy and spawn-point entries to TOKEN_TILES**

Open `playsets experiments/apps/client/src/builder/BuilderToolbar.tsx`.

In `TOKEN_TILES`, append two entries after the existing `door:` entry:

```ts
const TOKEN_TILES: TileEntry[] = [
  { id: 'npc:innkeeper', label: 'Innkeeper', color: '#2d7a2d' },
  { id: 'npc:blacksmith', label: 'Blacksmith', color: '#c07020' },
  { id: 'npc:doorkeeper', label: 'Doorkeeper', color: '#6040c0' },
  { id: 'door:', label: 'Door', color: '#cc4444' },
  { id: 'enemy:skeleton', label: 'Skeleton', color: '#8a8a8a' },
  { id: 'spawn-point:', label: 'Spawn Pt', color: '#cc6600' },
]
```

No logic changes needed — `BuilderRoot.handleTokenClick` already splits the token id on `:` to extract `type` and `role`. A placed skeleton token will be saved as `{ id, type: 'enemy', col, row, role: 'skeleton', name: 'Skeleton' }`; a spawn point as `{ id, type: 'spawn-point', col, row }`.

- [ ] **Step 2: Rebuild the playsets-board library**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments/apps/client"
pnpm vite build --config vite.lib.config.ts
```

Expected: build completes without errors, `dist/` updated.

- [ ] **Step 3: Typecheck playsets experiments client**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments/apps/client"
pnpm typecheck 2>&1 | tail -10
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments/apps/client"
git add src/builder/BuilderToolbar.tsx
git commit -m "feat(builder): add enemy:skeleton and spawn-point token types to BuilderToolbar"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| SceneToken — add `enemy`, `spawn-point` types, `level`, `spawnRadius` | Task 1 |
| EncounterEvent interface | Task 1 |
| EnemyEntity Colyseus schema + enemies MapSchema | Task 2 |
| EnemyManager — load fixed enemies from tokens | Task 3 |
| EnemyManager — spawn-point triggering | Task 3 |
| EnemyManager — adjacency detection → EncounterEvent | Task 3 |
| EnemyManager — removeEnemy | Task 3 |
| ExploreRoom onCreate — construct EnemyManager | Task 4 |
| ExploreRoom handleMove — call onPlayerMove, send ENCOUNTER to specific client | Task 4 |
| useExploreRoom — encounter signal + dismissEncounter | Task 5 |
| ExploreScreen — encounterPanels → ComicPlayer | Task 6 |
| Builder — enemy:skeleton and spawn-point: token types | Task 7 |
| Rebuild playsets-board library after builder change | Task 7 |

**Type consistency check:** `EncounterEvent` defined in Task 1, imported in EnemyManager (Task 3), imported in useExploreRoom (Task 5). `EnemyEntity` defined in Task 2, used in ExploreRoom (Task 4). All field names consistent (`enemyId`, `enemyName`, `x`, `y`).

**Placeholder scan:** No TBDs, TODOs, or vague requirements found.
