# Enemy + Proximity Combat — Design

**Goal:** Add enemies to the explore world — fixed builder-placed enemies and on-demand spawn-point enemies — and fire an `ENCOUNTER` message when a player steps adjacent to one, displayed via click-comics as a placeholder for sub-project 4 combat.

**Architecture:** `EnemyManager` encapsulates all enemy state and logic (loading, spawning, proximity); `ExploreRoom` delegates to it after each move. Builder gains enemy and spawn-point token types following the existing `type:role` convention. Client renders encounter dialogs through the existing `ComicPlayer` path.

**Tech Stack:** Colyseus 0.15 schema, Bun server, SolidJS client, click-comics, shared-types

---

## Section 1: Data Model

### 1a. `shared-types` — SceneToken and EncounterEvent

**Extend `SceneToken.type`:**
```ts
// packages/shared-types/src/index.ts (or scene-data.ts)
export interface SceneToken {
  id: string
  type: 'npc' | 'door' | 'enemy' | 'spawn-point'
  col: number
  row: number
  role?: string
  name?: string
  biomeId?: string
  label?: string
  level?: number        // enemy tokens
  spawnRadius?: number  // spawn-point tokens, default 5
}
```

**Add `EncounterEvent`:**
```ts
export interface EncounterEvent {
  enemyId: string
  enemyName: string
  x: number
  y: number
}
```

### 1b. `ExploreState` — EnemyEntity schema

`server/src/rooms/ExploreState.ts` — add `EnemyEntity` class and `enemies` MapSchema:

```ts
@Schema()
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

// In ExploreState class:
@type({ map: EnemyEntity }) enemies = new MapSchema<EnemyEntity>()
```

---

## Section 2: EnemyManager

**File:** `server/src/rooms/EnemyManager.ts`

```ts
import { MapSchema } from '@colyseus/schema'
import type { EnemyEntity } from './ExploreState'
import type { SceneToken, EncounterEvent } from 'shared-types'

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
    private enemies: MapSchema<EnemyEntity>,
    private makeEnemy: (partial: Partial<EnemyEntity>) => EnemyEntity,
    tokens: SceneToken[],
  ) {
    for (const t of tokens) {
      if (t.type === 'enemy') {
        const e = makeEnemy({
          id: t.id, name: t.name ?? 'Enemy',
          x: t.col, y: t.row,
          level: t.level ?? 1,
          hp: (t.level ?? 1) * 10, maxHp: (t.level ?? 1) * 10,
          fromSpawnPoint: false,
        })
        this.enemies.set(t.id, e)
      } else if (t.type === 'spawn-point') {
        this.spawnPoints.push({
          id: t.id, x: t.col, y: t.row,
          radius: t.spawnRadius ?? 5,
          triggered: false,
        })
      }
    }
  }

  /** Call after every player move. Returns an EncounterEvent or null. */
  onPlayerMove(px: number, py: number): EncounterEvent | null {
    // 1. Trigger nearby spawn points (approach radius)
    for (const sp of this.spawnPoints) {
      if (sp.triggered) continue
      const dist = Math.abs(px - sp.x) + Math.abs(py - sp.y)
      if (dist <= sp.radius) {
        sp.triggered = true
        const id = `spawned-${sp.id}`
        const e = this.makeEnemy({
          id, name: 'Enemy',
          x: sp.x, y: sp.y,
          level: 1, hp: 10, maxHp: 10,
          fromSpawnPoint: true,
        })
        this.enemies.set(id, e)
      }
    }

    // 2. Check adjacency with live enemies
    for (const [, enemy] of this.enemies) {
      const dist = Math.abs(px - enemy.x) + Math.abs(py - enemy.y)
      if (dist === 1) {
        return { enemyId: enemy.id, enemyName: enemy.name, x: enemy.x, y: enemy.y }
      }
    }

    return null
  }

  removeEnemy(id: string): void {
    this.enemies.delete(id)
  }
}
```

---

## Section 3: ExploreRoom Changes

**File:** `server/src/rooms/ExploreRoom.ts`

`onCreate` — after loading `sceneTokens`, construct the manager:
```ts
this.enemyManager = new EnemyManager(
  this.state.enemies,
  (partial) => Object.assign(new EnemyEntity(), partial),
  sceneTokens,
)
```

`handleMove` — after updating player position:
```ts
const encounter = this.enemyManager.onPlayerMove(newX, newY)
if (encounter) {
  const client = this.clients.find(c => c.sessionId === sessionId)
  client?.send('ENCOUNTER', encounter)
}
```

No other changes to ExploreRoom.

---

## Section 4: Builder Changes

**File:** `playsets experiments/apps/client/src/builder/BuilderToolbar.tsx`

Add to `TOKEN_TILES`:
```ts
{ id: 'enemy:skeleton', label: 'Skeleton', color: '#8a8a8a' },
{ id: 'spawn-point:', label: 'Spawn Pt', color: '#cc6600' },
```

`BuilderRoot.handleTokenClick` already splits `id` on `:` to produce `type` and `role` — no logic changes needed. The saved `SceneToken` for a skeleton: `{ id, type: 'enemy', col, row, role: 'skeleton', name: 'Skeleton' }`. For a spawn point: `{ id, type: 'spawn-point', col, row }`.

After adding: rebuild `playsets-board` library (`pnpm vite build --config vite.lib.config.ts` in `playsets experiments/apps/client`).

---

## Section 5: Client — Encounter via ComicPlayer

**File:** `apps/game/src/hooks/useExploreRoom.ts`

Add alongside the existing `interaction` signal:
```ts
const [encounter, setEncounter] = createSignal<EncounterEvent | null>(null)

// In READY handler, after existing onMessage registrations:
room.onMessage('ENCOUNTER', (data: EncounterEvent) => setEncounter(data))

// Expose:
return {
  ...existing,
  encounter,
  dismissEncounter: () => setEncounter(null),
}
```

**File:** `apps/game/src/screens/ExploreScreen.tsx`

Wire up panels — `encounterPanels` feeds the existing `ComicPlayer`:
```ts
const encounterPanels = (): Panel[] | null => {
  const ev = state.encounter()
  if (!ev) return null
  return [{ speaker: ev.enemyName, text: 'Blocks your path! Combat coming soon.' }]
}
```

In the JSX, add a second `Show` for encounter below the existing interaction Show:
```tsx
<Show when={encounterPanels()}>
  {(panels) => (
    <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
      <ComicPlayer panels={panels()} onComplete={state.dismissEncounter} />
    </div>
  )}
</Show>
```

The board stays fully visible. No navigation occurs.

---

## Testing Notes

- `EnemyManager` is fully unit-testable: pass a mock MapSchema, mock `makeEnemy`, and a token list. Test fixed enemy adjacency, spawn radius trigger, and already-triggered spawn points being skipped.
- `ExploreRoom` integration: verify `ENCOUNTER` is sent only to the moving player, not broadcast.
- Builder: place a skeleton token and a spawn-point token, save scene, verify `SceneToken` type fields are correct in Supabase.
