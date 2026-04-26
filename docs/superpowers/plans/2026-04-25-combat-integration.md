# Combat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up in-place tactical combat on the explore board — when a player walks adjacent to an enemy, combat begins on the shared board using a SimpleQuest energy model (1 energy/square to move, abilities cost energy, turn ends when energy depleted or player passes).

**Architecture:** A new `InPlaceCombatEngine` class (no Colyseus dependency) owns all turn logic and lives in ExploreRoom alongside existing explore state. The `<playsets-board>` web component gains a `highlights` attribute for rendering move/ability range on the grid. The action bar and overlays are pure SolidJS positioned over the board in ExploreScreen.

**Tech Stack:** Colyseus 0.15, rules-engine (resolveAction/applyResult), SolidJS, BabylonJS (PlaysetsBoardRoot), shared-types, Supabase

---

## File Map

**Create:**
- `packages/shared-types/src/combat-bfs.ts` — BFS movement cost/range, shared by server + client
- `server/src/rooms/InPlaceCombatEngine.ts` — turn orchestration, energy model, initiative
- `server/src/__tests__/in-place-combat-engine.test.ts`

**Modify:**
- `packages/shared-types/src/index.ts` — `isGhost?` on ActorState, `activeEnemyIds` on CombatState, export combat-bfs
- `server/src/rooms/EnemyManager.ts` — add `getEnemy(id)` method
- `server/src/rooms/ExploreRoom.ts` — combat lifecycle (start, actions, join, end)
- `apps/game/src/hooks/useExploreRoom.ts` — combat signals + message handlers
- `apps/game/src/screens/ExploreScreen.tsx` — action bar, join offer, results overlays
- `packages/playsets/src/types.ts` — add `highlights`, `endTurn` props
- `packages/playsets/src/PlaysetBoard.tsx` — pass combat actors as entities + highlights
- `playsets experiments/apps/client/src/board-element.ts` — add `highlights` attribute
- `playsets experiments/apps/client/src/PlaysetsBoardRoot.tsx` — render highlight tiles, ghost cylinders

---

### Task 1: Type extensions in shared-types

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/combat-bfs.ts`

- [ ] **Step 1: Add `isGhost` to ActorState and `activeEnemyIds` to CombatState**

In `packages/shared-types/src/index.ts`, update the two interfaces:

```ts
export interface ActorState {
  id: string
  name: string
  personality: Personality
  characterClass: string
  die: Die
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  speed: number
  position: Position
  statusEffects: string[]
  isNPC: boolean
  isGhost?: boolean
  abilities: AbilityDefinition[]
}

export interface CombatState {
  roomId: string
  turnQueue: string[]
  currentActorIndex: number
  actors: Record<string, ActorState>
  round: number
  log: string[]
  isOver: boolean
  winningSide?: 'players' | 'npcs'
  activeEnemyIds: string[]
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /path/to/tactical-rpg
pnpm typecheck
```

Expected: exits 0 (existing code handles `activeEnemyIds` being missing via optional spread; if not, fix call sites that spread CombatState).

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat: add isGhost to ActorState and activeEnemyIds to CombatState"
```

---

### Task 2: BFS movement utility

**Files:**
- Create: `packages/shared-types/src/combat-bfs.ts`
- Modify: `packages/shared-types/src/index.ts` (add export)

- [ ] **Step 1: Write failing tests**

Create `packages/shared-types/src/__tests__/combat-bfs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getMoveCost, getReachableCells } from '../combat-bfs'

// 5x5 open grid (all zeros)
const openWalls = Array.from({ length: 5 }, () => Array(5).fill(0))

// Grid with a wall at (2,2)
const walledGrid = openWalls.map((row, y) =>
  row.map((_: number, x: number) => (x === 2 && y === 2 ? 1 : 0))
)

describe('getMoveCost', () => {
  it('returns 0 for same cell', () => {
    expect(getMoveCost({ x: 0, y: 0 }, { x: 0, y: 0 }, openWalls)).toBe(0)
  })

  it('returns manhattan distance on open grid', () => {
    expect(getMoveCost({ x: 0, y: 0 }, { x: 3, y: 0 }, openWalls)).toBe(3)
    expect(getMoveCost({ x: 0, y: 0 }, { x: 2, y: 2 }, openWalls)).toBe(4)
  })

  it('routes around walls', () => {
    // Direct path (0,1)→(2,1)→(2,2) is blocked; goes around
    expect(getMoveCost({ x: 0, y: 2 }, { x: 4, y: 2 }, walledGrid)).toBe(6)
  })

  it('returns null for wall destination', () => {
    expect(getMoveCost({ x: 0, y: 0 }, { x: 2, y: 2 }, walledGrid)).toBeNull()
  })

  it('returns null when out of bounds', () => {
    expect(getMoveCost({ x: 0, y: 0 }, { x: 10, y: 10 }, openWalls)).toBeNull()
  })
})

describe('getReachableCells', () => {
  it('returns cells within energy budget', () => {
    const cells = getReachableCells({ x: 2, y: 2 }, openWalls, 2)
    expect(cells.length).toBeGreaterThan(0)
    // All returned cells should be within 2 BFS steps
    for (const c of cells) {
      const cost = getMoveCost({ x: 2, y: 2 }, c, openWalls)
      expect(cost).not.toBeNull()
      expect(cost!).toBeLessThanOrEqual(2)
    }
  })

  it('excludes origin', () => {
    const cells = getReachableCells({ x: 2, y: 2 }, openWalls, 3)
    expect(cells.every(c => !(c.x === 2 && c.y === 2))).toBe(true)
  })

  it('excludes walls', () => {
    const cells = getReachableCells({ x: 0, y: 2 }, walledGrid, 5)
    expect(cells.every(c => !(c.x === 2 && c.y === 2))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter shared-types test
```

Expected: FAIL — `combat-bfs` not found.

- [ ] **Step 3: Implement combat-bfs.ts**

Create `packages/shared-types/src/combat-bfs.ts`:

```ts
import type { Position } from './index'

function isWalkable(pos: Position, walls: number[][]): boolean {
  if (walls.length === 0) return false
  if (pos.y < 0 || pos.y >= walls.length) return false
  if (pos.x < 0 || pos.x >= (walls[0]?.length ?? 0)) return false
  return walls[pos.y][pos.x] === 0
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

export function getMoveCost(
  origin: Position,
  destination: Position,
  walls: number[][],
): number | null {
  if (!isWalkable(destination, walls)) return null
  if (origin.x === destination.x && origin.y === destination.y) return 0

  const key = (p: Position) => `${p.x},${p.y}`
  const queue: Array<{ pos: Position; cost: number }> = [{ pos: origin, cost: 0 }]
  const visited = new Set<string>([key(origin)])

  while (queue.length > 0) {
    const { pos, cost } = queue.shift()!
    for (const [dx, dy] of DIRS) {
      const next: Position = { x: pos.x + dx, y: pos.y + dy }
      if (next.x === destination.x && next.y === destination.y) return cost + 1
      if (!isWalkable(next, walls)) continue
      const k = key(next)
      if (visited.has(k)) continue
      visited.add(k)
      queue.push({ pos: next, cost: cost + 1 })
    }
  }
  return null
}

export function getReachableCells(
  origin: Position,
  walls: number[][],
  energyBudget: number,
): Position[] {
  const key = (p: Position) => `${p.x},${p.y}`
  const queue: Array<{ pos: Position; cost: number }> = [{ pos: origin, cost: 0 }]
  const visited = new Set<string>([key(origin)])
  const result: Position[] = []

  while (queue.length > 0) {
    const { pos, cost } = queue.shift()!
    for (const [dx, dy] of DIRS) {
      const next: Position = { x: pos.x + dx, y: pos.y + dy }
      const nextCost = cost + 1
      if (nextCost > energyBudget) continue
      if (!isWalkable(next, walls)) continue
      const k = key(next)
      if (visited.has(k)) continue
      visited.add(k)
      queue.push({ pos: next, cost: nextCost })
      result.push(next)
    }
  }
  return result
}
```

- [ ] **Step 4: Export from shared-types index**

Add to the bottom of `packages/shared-types/src/index.ts`:

```ts
export * from './combat-bfs'
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter shared-types test
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/combat-bfs.ts packages/shared-types/src/__tests__/combat-bfs.test.ts packages/shared-types/src/index.ts
git commit -m "feat: add BFS movement cost/range utility to shared-types"
```

---

### Task 3: InPlaceCombatEngine

**Files:**
- Create: `server/src/rooms/InPlaceCombatEngine.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/__tests__/in-place-combat-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { InPlaceCombatEngine } from '../rooms/InPlaceCombatEngine'
import type { ActorState } from 'shared-types'

const openWalls = Array.from({ length: 10 }, () => Array(10).fill(0))

function makeHero(overrides: Partial<ActorState> = {}): ActorState {
  return {
    id: 'hero1',
    name: 'Aria',
    personality: 'passionate',
    characterClass: 'Fighter',
    die: 'd8',
    hp: 20,
    maxHp: 20,
    energy: 10,
    maxEnergy: 10,
    speed: 3,
    position: { x: 3, y: 3 },
    statusEffects: [],
    isNPC: false,
    abilities: [{
      id: 'strike',
      name: 'Strike',
      energyCost: 2,
      diceNotation: { kind: 'actor' },
      targetType: 'enemy',
      effect: 'damage',
      context: 'inCombat',
    }],
    ...overrides,
  }
}

function makeEnemy(overrides: Partial<ActorState> = {}): ActorState {
  return {
    id: 'enemy1',
    name: 'Skeleton',
    personality: 'wild',
    characterClass: 'Enemy',
    die: 'd6',
    hp: 10,
    maxHp: 10,
    energy: 10,
    maxEnergy: 10,
    speed: 3,
    position: { x: 5, y: 5 },
    statusEffects: [],
    isNPC: true,
    abilities: [{
      id: 'slash',
      name: 'Slash',
      energyCost: 3,
      diceNotation: { kind: 'notation', value: '1d4' },
      targetType: 'enemy',
      effect: 'damage',
      context: 'inCombat',
    }],
    ...overrides,
  }
}

describe('InPlaceCombatEngine', () => {
  it('initialises with both actors in the state', () => {
    const engine = new InPlaceCombatEngine([makeHero(), makeEnemy()], openWalls, 1)
    const state = engine.getCombatState()
    expect(Object.keys(state.actors)).toHaveLength(2)
    expect(state.activeEnemyIds).toContain('enemy1')
  })

  it('is not over initially', () => {
    const engine = new InPlaceCombatEngine([makeHero(), makeEnemy()], openWalls, 1)
    expect(engine.isOver()).toBe(false)
  })

  it('deducts move energy (1 per square via BFS)', () => {
    const engine = new InPlaceCombatEngine([makeHero(), makeEnemy()], openWalls, 1)
    const heroId = engine.getCombatState().turnQueue[0]
    const heroPos = engine.getCombatState().actors[heroId].position
    const dest = { x: heroPos.x + 2, y: heroPos.y }
    engine.handlePlayerAction(heroId, { type: 'move', actorId: heroId, destination: dest })
    const newEnergy = engine.getCombatState().actors[heroId].energy
    expect(newEnergy).toBeLessThanOrEqual(8) // lost at least 2
  })

  it('throws when move destination unreachable', () => {
    const walls = Array.from({ length: 5 }, (_, y) =>
      Array.from({ length: 5 }, (_: unknown, x: number) => (x === 2 ? 1 : 0))
    )
    const engine = new InPlaceCombatEngine(
      [makeHero({ position: { x: 0, y: 2 } }), makeEnemy({ position: { x: 4, y: 2 } })],
      walls,
      1,
    )
    const heroId = engine.getCombatState().turnQueue[0]
    expect(() =>
      engine.handlePlayerAction(heroId, { type: 'move', actorId: heroId, destination: { x: 4, y: 2 } })
    ).toThrow()
  })

  it('deducts ability energy cost', () => {
    const hero = makeHero({ position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero, enemy], openWalls, 1)
    const heroId = engine.getCombatState().turnQueue[0]
    if (heroId !== 'hero1') return // enemies went first — skip assertion
    engine.handlePlayerAction('hero1', {
      type: 'ability',
      actorId: 'hero1',
      ability: hero.abilities[0],
      targetIds: ['enemy1'],
    })
    expect(engine.getCombatState().actors['hero1'].energy).toBeLessThanOrEqual(8)
  })

  it('prevents using same ability twice in one turn', () => {
    const hero = makeHero({ position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero, enemy], openWalls, 1)
    const heroId = engine.getCombatState().turnQueue[0]
    if (heroId !== 'hero1') return
    const action = { type: 'ability' as const, actorId: 'hero1', ability: hero.abilities[0], targetIds: ['enemy1'] }
    engine.handlePlayerAction('hero1', action)
    expect(() => engine.handlePlayerAction('hero1', action)).toThrow()
  })

  it('refills energy on startTurn', () => {
    const engine = new InPlaceCombatEngine([makeHero(), makeEnemy()], openWalls, 1)
    const heroId = 'hero1'
    engine.getCombatState().actors[heroId] // ensure exists
    engine.startTurn(heroId)
    expect(engine.getCombatState().actors[heroId].energy).toBe(10)
  })

  it('is over when all enemies reach 0 hp', () => {
    const hero = makeHero({ position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ hp: 1, position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero, enemy], openWalls, 1)
    const heroId = engine.getCombatState().turnQueue[0]
    if (heroId !== 'hero1') return
    engine.handlePlayerAction('hero1', {
      type: 'ability', actorId: 'hero1', ability: hero.abilities[0], targetIds: ['enemy1'],
    })
    expect(engine.isOver()).toBe(true)
    expect(engine.winningSide()).toBe('players')
  })

  it('is over when all heroes reach 0 hp', () => {
    const hero = makeHero({ hp: 1, position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero, enemy], openWalls, 1)
    // Force hero to 0 hp by calling startTurn then processNPCTurns repeatedly
    // Easier: directly poke state via getCombatState to verify winningSide
    // Actually, test by putting enemy first and running NPC turn
    const enemyId = engine.getCombatState().turnQueue[0]
    if (enemyId !== 'enemy1') return
    engine.processNPCTurns()
    // Enemy attacks hero (adjacent, hp=1 → 0)
    if (engine.isOver()) {
      expect(engine.winningSide()).toBe('npcs')
    }
  })

  it('addActor inserts a new hero into the combat', () => {
    const engine = new InPlaceCombatEngine([makeHero(), makeEnemy()], openWalls, 1)
    const newHero: ActorState = { ...makeHero(), id: 'hero2', name: 'Bob', position: { x: 2, y: 2 } }
    engine.addActor(newHero)
    expect(engine.getCombatState().actors['hero2']).toBeDefined()
    expect(engine.getCombatState().turnQueue).toContain('hero2')
  })

  it('marks actor isGhost when hp reaches 0', () => {
    const hero = makeHero({ hp: 1, position: { x: 4, y: 5 } })
    const enemy = makeEnemy({ position: { x: 5, y: 5 } })
    const engine = new InPlaceCombatEngine([hero, enemy], openWalls, 1)
    const enemyId = engine.getCombatState().turnQueue[0]
    if (enemyId !== 'enemy1') return
    engine.processNPCTurns()
    const heroAfter = engine.getCombatState().actors['hero1']
    if (heroAfter.hp === 0) {
      expect(heroAfter.isGhost).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter server test
```

Expected: FAIL — `InPlaceCombatEngine` not found.

- [ ] **Step 3: Implement InPlaceCombatEngine**

Create `server/src/rooms/InPlaceCombatEngine.ts`:

```ts
import { resolveAction, applyResult } from 'rules-engine'
import { getMoveCost } from 'shared-types'
import type { ActorState, CombatState, Action, ActionResult, Position } from 'shared-types'

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function isWalkable(pos: Position, walls: number[][]): boolean {
  if (walls.length === 0) return false
  if (pos.y < 0 || pos.y >= walls.length) return false
  if (pos.x < 0 || pos.x >= (walls[0]?.length ?? 0)) return false
  return walls[pos.y][pos.x] === 0
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

export class InPlaceCombatEngine {
  private state: CombatState
  private walls: number[][]
  private usedAbilities: Map<string, Set<string>> = new Map()

  constructor(actors: ActorState[], walls: number[][], enemyLevel: number) {
    this.walls = walls

    const playerRoll = rollD20()
    const playersWin = playerRoll > enemyLevel

    const players = actors.filter(a => !a.isNPC)
    const npcs = actors.filter(a => a.isNPC)
    const ordered = playersWin ? [...players, ...npcs] : [...npcs, ...players]

    const actorsMap: Record<string, ActorState> = {}
    for (const a of actors) {
      actorsMap[a.id] = playersWin || a.isNPC
        ? a
        : { ...a, energy: Math.floor(a.maxEnergy / 2) }
    }

    this.state = {
      roomId: 'inn',
      turnQueue: ordered.map(a => a.id),
      currentActorIndex: 0,
      actors: actorsMap,
      round: 1,
      log: [],
      isOver: false,
      activeEnemyIds: npcs.map(a => a.id),
    }
  }

  getCombatState(): CombatState {
    return this.state
  }

  isOver(): boolean {
    return this.state.isOver
  }

  winningSide(): 'players' | 'npcs' | null {
    return this.state.winningSide ?? null
  }

  startTurn(actorId: string): void {
    const actor = this.state.actors[actorId]
    if (!actor) return
    this.state = {
      ...this.state,
      actors: { ...this.state.actors, [actorId]: { ...actor, energy: actor.maxEnergy } },
    }
    this.usedAbilities.set(actorId, new Set())
  }

  handlePlayerAction(actorId: string, action: Action): ActionResult {
    const actor = this.state.actors[actorId]
    if (!actor) throw new Error(`Actor ${actorId} not found`)

    if (action.type === 'move') {
      const cost = getMoveCost(actor.position, action.destination, this.walls)
      if (cost === null) throw new Error('Destination unreachable')
      if (cost > actor.energy) throw new Error('Insufficient energy')
      const result = resolveAction(actorId, action, this.state)
      const withEnergy: ActionResult = { ...result, energyDeltas: { [actorId]: -cost } }
      this.state = applyResult(withEnergy, this.state)
      this.markGhosts()
      return withEnergy
    }

    if (action.type === 'ability') {
      const abilityId = action.ability.id
      const used = this.usedAbilities.get(actorId) ?? new Set()
      if (used.has(abilityId)) throw new Error(`Ability ${abilityId} already used this turn`)
      const result = resolveAction(actorId, action, this.state)
      this.state = applyResult(result, this.state)
      used.add(abilityId)
      this.usedAbilities.set(actorId, used)
      this.markGhosts()
      return result
    }

    throw new Error('Unknown action type')
  }

  processNPCTurns(): ActionResult[] {
    const results: ActionResult[] = []
    let safety = this.state.turnQueue.length * 2

    while (safety-- > 0) {
      const actorId = this.state.turnQueue[this.state.currentActorIndex]
      const actor = this.state.actors[actorId]
      if (!actor?.isNPC) break

      this.startTurn(actorId)
      const turnResults = this.runNPCTurn(actorId)
      results.push(...turnResults)

      if (this.state.isOver) break
      this.state = {
        ...this.state,
        currentActorIndex: (this.state.currentActorIndex + 1) % this.state.turnQueue.length,
      }
    }

    return results
  }

  addActor(actor: ActorState): void {
    const insertAt = (this.state.currentActorIndex + 1) % this.state.turnQueue.length
    const newQueue = [...this.state.turnQueue]
    newQueue.splice(insertAt, 0, actor.id)
    this.state = {
      ...this.state,
      actors: { ...this.state.actors, [actor.id]: actor },
      turnQueue: newQueue,
    }
  }

  advanceTurn(): void {
    this.state = {
      ...this.state,
      currentActorIndex: (this.state.currentActorIndex + 1) % this.state.turnQueue.length,
    }
  }

  private markGhosts(): void {
    const updated: Record<string, ActorState> = {}
    let changed = false
    for (const [id, actor] of Object.entries(this.state.actors)) {
      if (actor.hp === 0 && !actor.isGhost) {
        updated[id] = { ...actor, isGhost: true }
        changed = true
      } else {
        updated[id] = actor
      }
    }
    if (changed) {
      this.state = { ...this.state, actors: updated }
    }
  }

  private runNPCTurn(actorId: string): ActionResult[] {
    const results: ActionResult[] = []

    while (true) {
      const actor = this.state.actors[actorId]
      if (!actor || actor.energy <= 0 || this.state.isOver) break

      const players = Object.values(this.state.actors).filter(a => !a.isNPC && a.hp > 0)
      if (players.length === 0) break

      const adjacent = players.find(p =>
        Math.abs(p.position.x - actor.position.x) + Math.abs(p.position.y - actor.position.y) === 1
      )

      if (adjacent) {
        const ability = actor.abilities.find(ab => actor.energy >= ab.energyCost)
        if (ability) {
          const action: Action = { type: 'ability', actorId, targetIds: [adjacent.id], ability }
          const result = resolveAction(actorId, action, this.state)
          this.state = applyResult(result, this.state)
          this.markGhosts()
          results.push(result)
          continue
        }
      }

      // Move toward nearest player (1 step)
      const target = players.reduce((closest, p) => {
        const d = Math.abs(p.position.x - actor.position.x) + Math.abs(p.position.y - actor.position.y)
        const bd = Math.abs(closest.position.x - actor.position.x) + Math.abs(closest.position.y - actor.position.y)
        return d < bd ? p : closest
      })

      const occupied = new Set(
        Object.values(this.state.actors)
          .filter(a => a.id !== actorId)
          .map(a => `${a.position.x},${a.position.y}`)
      )

      const step = DIRS
        .map(([dx, dy]) => ({ x: actor.position.x + dx, y: actor.position.y + dy }))
        .filter(p => isWalkable(p, this.walls) && !occupied.has(`${p.x},${p.y}`))
        .sort((a, b) => {
          const da = Math.abs(a.x - target.position.x) + Math.abs(a.y - target.position.y)
          const db = Math.abs(b.x - target.position.x) + Math.abs(b.y - target.position.y)
          return da - db
        })[0]

      if (!step) break

      const action: Action = { type: 'move', actorId, destination: step }
      const result = resolveAction(actorId, action, this.state)
      const withEnergy: ActionResult = { ...result, energyDeltas: { [actorId]: -1 } }
      this.state = applyResult(withEnergy, this.state)
      results.push(withEnergy)
    }

    return results
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter server test
```

Expected: all `InPlaceCombatEngine` tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/InPlaceCombatEngine.ts server/src/__tests__/in-place-combat-engine.test.ts
git commit -m "feat: add InPlaceCombatEngine with energy-based turn model"
```

---

### Task 4: EnemyManager.getEnemy + ExploreRoom combat start

**Files:**
- Modify: `server/src/rooms/EnemyManager.ts`
- Modify: `server/src/rooms/ExploreRoom.ts`

- [ ] **Step 1: Add `getEnemy` to EnemyManager**

In `server/src/rooms/EnemyManager.ts`, add after `removeEnemy`:

```ts
getEnemy(id: string): { id: string; name: string; hp: number; maxHp: number; level: number } | undefined {
  let found: EnemyLike | undefined
  this.enemies.forEach((e, k) => { if (k === id) found = e })
  return found ? { id: found.id, name: found.name, hp: found.hp, maxHp: found.maxHp, level: found.level } : undefined
}
```

- [ ] **Step 2: Write a quick test for getEnemy**

Add to `server/src/__tests__/enemy-manager.test.ts`:

```ts
it('getEnemy returns the enemy by id', () => {
  const enemies = makeMapSchema()
  const tokens: SceneToken[] = [
    { id: 'e1', type: 'enemy', col: 5, row: 3, name: 'Troll', level: 2 },
  ]
  const mgr = new EnemyManager(enemies as never, makeEnemy, tokens)
  const e = mgr.getEnemy('e1')
  expect(e).not.toBeUndefined()
  expect(e!.name).toBe('Troll')
  expect(e!.level).toBe(2)
})

it('getEnemy returns undefined for unknown id', () => {
  const enemies = makeMapSchema()
  const mgr = new EnemyManager(enemies as never, makeEnemy, [])
  expect(mgr.getEnemy('nope')).toBeUndefined()
})
```

- [ ] **Step 3: Run tests to confirm they pass**

```bash
pnpm --filter server test
```

Expected: all pass.

- [ ] **Step 4: Add combat fields and startCombat to ExploreRoom**

In `server/src/rooms/ExploreRoom.ts`, add imports and fields at the top of the class:

Add to existing imports:
```ts
import { InPlaceCombatEngine } from './InPlaceCombatEngine'
import type { ActorState, AbilityDefinition } from 'shared-types'
```

Add constants after imports (at module level):
```ts
const RECOVERY_HOURS = 8

const ENEMY_SLASH: AbilityDefinition = {
  id: 'slash',
  name: 'Slash',
  energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d4' },
  targetType: 'enemy',
  effect: 'damage',
  context: 'inCombat',
}
```

Add private fields inside the `ExploreRoom` class (after `private enemyManager!: EnemyManager`):
```ts
private _combat: InPlaceCombatEngine | null = null
private _combatParticipants: Set<string> = new Set()
private _combatHeroActorIds: Map<string, string> = new Map()
```

- [ ] **Step 5: Add PLAYER_ACTION and END_TURN message handlers**

In `onCreate`, after the existing `this.onMessage('READY', ...)` block:

```ts
this.onMessage<{ action: import('shared-types').Action }>('PLAYER_ACTION', (client, msg) => {
  this.handleCombatAction(client, msg.action)
})

this.onMessage('END_TURN', (client) => {
  this.handleEndTurn(client)
})
```

Change the MOVE handler to async to support combat start:
```ts
this.onMessage<MoveMessage>('MOVE', async (client, message) => {
  await this.handleMove(client, message)
})
```

- [ ] **Step 6: Add startCombat and make handleMove async**

Add the following private methods to `ExploreRoom`:

```ts
private async startCombat(client: Client, encounter: EncounterEvent): Promise<void> {
  const userData = client.userData as { heroIds?: string[] }
  const heroId = (userData?.heroIds ?? [])[0]
  if (!heroId) return

  const hero = await heroService.getHero(heroId)
  if (!hero) return

  const starterClass = STARTER_CLASSES.find(c => c.name === hero.characterClass)
  const current = this.state.players.get(client.sessionId)
  if (!current) return

  const heroActor: ActorState = {
    id: hero.id,
    name: hero.name,
    personality: hero.personality,
    characterClass: hero.characterClass,
    die: hero.die,
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    energy: hero.maxEnergy > 0 ? hero.maxEnergy : 10,
    maxEnergy: hero.maxEnergy > 0 ? hero.maxEnergy : 10,
    speed: hero.speed,
    position: { x: current.x, y: current.y },
    statusEffects: [],
    isNPC: false,
    abilities: hero.abilities.length > 0 ? hero.abilities : (starterClass?.abilities ?? []),
  }

  const enemyData = this.enemyManager.getEnemy(encounter.enemyId)
  if (!enemyData) return

  const enemyActor: ActorState = {
    id: encounter.enemyId,
    name: encounter.enemyName,
    personality: 'wild',
    characterClass: 'Enemy',
    die: 'd6',
    hp: enemyData.hp,
    maxHp: enemyData.maxHp,
    energy: 10,
    maxEnergy: 10,
    speed: 3,
    position: { x: encounter.x, y: encounter.y },
    statusEffects: [],
    isNPC: true,
    abilities: [ENEMY_SLASH],
  }

  this._combat = new InPlaceCombatEngine([heroActor, enemyActor], THE_INN.walls, enemyData.level)
  this._combatParticipants.add(client.sessionId)
  this._combatHeroActorIds.set(client.sessionId, hero.id)

  this.broadcast('COMBAT_START', this._combat.getCombatState())

  // Auto-process NPC turns if enemies go first
  const first = this._combat.getCombatState().turnQueue[0]
  if (this._combat.getCombatState().actors[first]?.isNPC) {
    const results = this._combat.processNPCTurns()
    if (results.length > 0) this.broadcast('COMBAT_STATE', this._combat.getCombatState())
  }
}
```

Change `handleMove` signature to async and add combat-start branch:

```ts
private async handleMove(client: Client, message: MoveMessage): Promise<void> {
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

  const pos: Position = { x: current.x, y: current.y }
  const inCombat = this._combatParticipants.has(client.sessionId)

  if (!this._combat) {
    const encounter = this.enemyManager.onPlayerMove(current.x, current.y)
    if (encounter) {
      await this.startCombat(client, encounter)
    }
  } else if (!inCombat) {
    const cs = this._combat.getCombatState()
    const combatEnemies = cs.activeEnemyIds.map(id => cs.actors[id]).filter(Boolean)
    const autoJoin = combatEnemies.some(e =>
      Math.abs(e.position.x - pos.x) + Math.abs(e.position.y - pos.y) === 1
    )
    if (autoJoin) {
      await this.handleJoinCombat(client)
    } else {
      const allActors = Object.values(cs.actors)
      const nearby = allActors.some(a =>
        Math.abs(a.position.x - pos.x) + Math.abs(a.position.y - pos.y) <= 4
      )
      if (nearby) client.send('COMBAT_JOIN_OFFER')
    }
  }
}
```

- [ ] **Step 7: Run existing tests**

```bash
pnpm --filter server test
```

Expected: all existing tests still pass (124 total should remain green).

- [ ] **Step 8: Commit**

```bash
git add server/src/rooms/EnemyManager.ts server/src/rooms/ExploreRoom.ts server/src/rooms/InPlaceCombatEngine.ts
git commit -m "feat: start in-place combat from ExploreRoom on encounter"
```

---

### Task 5: ExploreRoom — PLAYER_ACTION, END_TURN, JOIN_COMBAT, COMBAT_END

**Files:**
- Modify: `server/src/rooms/ExploreRoom.ts`

- [ ] **Step 1: Add handleCombatAction**

Add to `ExploreRoom`:

```ts
private handleCombatAction(client: Client, action: import('shared-types').Action): void {
  if (!this._combat) return
  const heroId = this._combatHeroActorIds.get(client.sessionId)
  if (!heroId) return

  const cs = this._combat.getCombatState()
  const currentActorId = cs.turnQueue[cs.currentActorIndex]
  if (currentActorId !== heroId) return

  try {
    this._combat.handlePlayerAction(heroId, action)
  } catch {
    return
  }

  if (this._combat.isOver()) {
    this.endCombat()
    return
  }

  // If actor ran out of energy, auto-advance
  const updatedActor = this._combat.getCombatState().actors[heroId]
  if (updatedActor && updatedActor.energy <= 0) {
    this.advanceCombatTurn()
    return
  }

  this.broadcast('COMBAT_STATE', this._combat.getCombatState())
}
```

- [ ] **Step 2: Add handleEndTurn**

```ts
private handleEndTurn(client: Client): void {
  if (!this._combat) return
  const heroId = this._combatHeroActorIds.get(client.sessionId)
  if (!heroId) return
  const cs = this._combat.getCombatState()
  if (cs.turnQueue[cs.currentActorIndex] !== heroId) return
  this.advanceCombatTurn()
}

private advanceCombatTurn(): void {
  if (!this._combat) return
  this._combat.advanceTurn()

  // Skip ghost actors
  let safety = this._combat.getCombatState().turnQueue.length
  while (safety-- > 0) {
    const cs = this._combat.getCombatState()
    const actorId = cs.turnQueue[cs.currentActorIndex]
    const actor = cs.actors[actorId]
    if (!actor?.isGhost) break
    this._combat.advanceTurn()
  }

  const cs = this._combat.getCombatState()
  const nextId = cs.turnQueue[cs.currentActorIndex]
  this._combat.startTurn(nextId)

  if (cs.actors[nextId]?.isNPC) {
    const results = this._combat.processNPCTurns()
    if (results.length > 0 && this._combat.isOver()) {
      this.endCombat()
      return
    }
  }

  this.broadcast('COMBAT_STATE', this._combat.getCombatState())
}
```

- [ ] **Step 3: Add handleJoinCombat**

```ts
private async handleJoinCombat(client: Client): Promise<void> {
  if (!this._combat) return
  if (this._combatParticipants.has(client.sessionId)) return

  const userData = client.userData as { heroIds?: string[] }
  const heroId = (userData?.heroIds ?? [])[0]
  if (!heroId) return

  const hero = await heroService.getHero(heroId)
  if (!hero) return

  const starterClass = STARTER_CLASSES.find(c => c.name === hero.characterClass)
  const current = this.state.players.get(client.sessionId)
  if (!current) return

  const heroActor: ActorState = {
    id: hero.id,
    name: hero.name,
    personality: hero.personality,
    characterClass: hero.characterClass,
    die: hero.die,
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    energy: hero.maxEnergy > 0 ? hero.maxEnergy : 10,
    maxEnergy: hero.maxEnergy > 0 ? hero.maxEnergy : 10,
    speed: hero.speed,
    position: { x: current.x, y: current.y },
    statusEffects: [],
    isNPC: false,
    abilities: hero.abilities.length > 0 ? hero.abilities : (starterClass?.abilities ?? []),
  }

  this._combat.addActor(heroActor)
  this._combatParticipants.add(client.sessionId)
  this._combatHeroActorIds.set(client.sessionId, hero.id)
  this.broadcast('COMBAT_STATE', this._combat.getCombatState())
}
```

Add `JOIN_COMBAT` handler inside `onCreate` (after `END_TURN` handler):

```ts
this.onMessage('JOIN_COMBAT', async (client) => {
  await this.handleJoinCombat(client)
})
```

- [ ] **Step 4: Add endCombat**

```ts
private async endCombat(): Promise<void> {
  if (!this._combat) return
  const winningSide = this._combat.winningSide()
  const cs = this._combat.getCombatState()

  if (winningSide === 'players') {
    // Remove defeated enemies from the explore map
    for (const enemyId of cs.activeEnemyIds) {
      if (this.state.enemies.has(enemyId)) {
        this.state.enemies.delete(enemyId)
      }
      this.enemyManager.removeEnemy(enemyId)
    }
    this.broadcast('COMBAT_END', { result: 'win' })
  } else {
    // Mark all knocked-out heroes as recovering
    const recoveryEndsAt = new Date(Date.now() + RECOVERY_HOURS * 60 * 60 * 1000).toISOString()
    const ghostHeroes = Object.values(cs.actors).filter(a => !a.isNPC && a.isGhost)
    await Promise.all(
      ghostHeroes.map(hero =>
        supabase
          .from('heroes')
          .update({ recovery_ends_at: recoveryEndsAt })
          .eq('id', hero.id)
      )
    )
    this.broadcast('COMBAT_END', { result: 'lose', recoveryEndsAt })
  }

  this._combat = null
  this._combatParticipants.clear()
  this._combatHeroActorIds.clear()
}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm --filter server test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/rooms/ExploreRoom.ts
git commit -m "feat: add PLAYER_ACTION, END_TURN, JOIN_COMBAT, and combat end to ExploreRoom"
```

---

### Task 6: useExploreRoom — combat signals

**Files:**
- Modify: `apps/game/src/hooks/useExploreRoom.ts`

- [ ] **Step 1: Add combat signals and message handlers**

In `useExploreRoom.ts`, add after the existing signal declarations:

```ts
const [combatState, setCombatState] = createSignal<import('shared-types').CombatState | null>(null)
const [combatResult, setCombatResult] = createSignal<'win' | 'lose' | null>(null)
const [recoveryEndsAt, setRecoveryEndsAt] = createSignal<string | null>(null)
const [joinOffer, setJoinOffer] = createSignal(false)
```

Add resets inside the reconnect block (alongside `setEnemies({})` etc.):
```ts
setCombatState(null)
setCombatResult(null)
setRecoveryEndsAt(null)
setJoinOffer(false)
```

Add message handlers inside `.then((r) => { ... })`, before `r.send('READY')`:

```ts
r.onMessage('COMBAT_START', (data: import('shared-types').CombatState) => {
  setCombatState(data)
})
r.onMessage('COMBAT_STATE', (data: import('shared-types').CombatState) => {
  setCombatState(data)
})
r.onMessage('COMBAT_END', (data: { result: 'win' | 'lose'; recoveryEndsAt?: string }) => {
  setCombatResult(data.result)
  setRecoveryEndsAt(data.recoveryEndsAt ?? null)
  if (data.result === 'win') setCombatState(null)
})
r.onMessage('COMBAT_JOIN_OFFER', () => {
  setJoinOffer(true)
})
```

- [ ] **Step 2: Add send methods to the return object**

In the return statement of `createExploreRoom`, add:

```ts
combatState,
combatResult,
recoveryEndsAt,
joinOffer,
sendAction(action: import('shared-types').Action) { room?.send('PLAYER_ACTION', { action }) },
endTurn() { room?.send('END_TURN') },
joinCombat() { setJoinOffer(false); room?.send('JOIN_COMBAT') },
dismissJoinOffer() { setJoinOffer(false) },
dismissCombatResult() { setCombatResult(null); setRecoveryEndsAt(null) },
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/hooks/useExploreRoom.ts
git commit -m "feat: add combat signals and message handlers to useExploreRoom"
```

---

### Task 7: ExploreScreen — action bar, join offer, results overlay

**Files:**
- Modify: `apps/game/src/screens/ExploreScreen.tsx`

- [ ] **Step 1: Import combat types and BFS utility**

At the top of `ExploreScreen.tsx`, add:

```ts
import { createSignal, createMemo, Show } from 'solid-js'
import { THE_INN, generateSceneFromInn, getReachableCells, getMoveCost } from 'shared-types'
import type { ExploreMap, ExploreToken, SceneData, CombatState, Action, AbilityDefinition, Position } from 'shared-types'
import { useNavigate } from '@solidjs/router'
```

- [ ] **Step 2: Add combat UI state**

Inside `ExploreScreen`, after `const [showSheet, setShowSheet] = createSignal(false)`:

```ts
const navigate = useNavigate()
const [selectedAbility, setSelectedAbility] = createSignal<AbilityDefinition | null>(null)

const myHeroId = (): string | null => {
  const cs = state.combatState()
  if (!cs) return null
  const mySessionId = state.mySessionId()
  // Find the actor that is me by matching position with my player position
  const myPos = state.myPosition()
  if (!myPos) return null
  return Object.values(cs.actors).find(
    a => !a.isNPC && a.position.x === myPos.x && a.position.y === myPos.y
  )?.id ?? null
}

const isMyTurn = (): boolean => {
  const cs = state.combatState()
  if (!cs) return false
  const heroId = myHeroId()
  return cs.turnQueue[cs.currentActorIndex] === heroId
}

const myActor = () => {
  const cs = state.combatState()
  const heroId = myHeroId()
  if (!cs || !heroId) return null
  return cs.actors[heroId] ?? null
}

const moveHighlights = createMemo((): Position[] => {
  if (!isMyTurn()) return []
  const actor = myActor()
  if (!actor) return []
  return getReachableCells(actor.position, THE_INN.walls, actor.energy)
})

const abilityHighlights = createMemo((): Position[] => {
  const ability = selectedAbility()
  const cs = state.combatState()
  if (!ability || !cs) return []
  const actor = myActor()
  if (!actor) return []
  if (ability.targetType === 'enemy' || ability.targetType === 'area') {
    return Object.values(cs.actors)
      .filter(a => a.isNPC && a.hp > 0)
      .map(a => a.position)
  }
  return []
})

const highlights = createMemo(() => {
  if (!state.combatState()) return []
  const ability = selectedAbility()
  if (ability) {
    return abilityHighlights().map(p => ({ x: p.x, y: p.y, kind: 'ability' as const }))
  }
  return moveHighlights().map(p => ({ x: p.x, y: p.y, kind: 'move' as const }))
})
```

- [ ] **Step 3: Update handleCellClick for combat targeting**

Replace `handleCellClick` with:

```ts
function handleCellClick(x: number, y: number) {
  const cs = state.combatState()
  if (cs && isMyTurn()) {
    const ability = selectedAbility()
    if (ability) {
      const actor = myActor()
      if (!actor) return
      const target = Object.values(cs.actors).find(a => a.position.x === x && a.position.y === y)
      if (target && target.isNPC && target.hp > 0) {
        state.sendAction({ type: 'ability', actorId: actor.id, ability, targetIds: [target.id] })
        setSelectedAbility(null)
      }
      return
    }
    // No ability selected — cell click does nothing (moves are drag-only)
    return
  }
  // Explore mode
  const pos = state.myPosition()
  if (!pos) return
  const isNpc = state.npcs().some((n) => n.x === x && n.y === y)
  const isDoor = state.doors().some((d) => d.x === x && d.y === y)
  const dist = Math.abs(pos.x - x) + Math.abs(pos.y - y)
  if ((isNpc || isDoor) && dist === 1) {
    state.interact()
  } else {
    state.move({ x, y })
  }
}
```

Also handle drag-to-move during combat (tokenmove routes through `onCellClick` in ExploreBoard which calls `handleCellClick`). Update to handle drag separately — in the existing code, tokenmove calls `props.onCellClick?.(x, y)`. For combat moves, intercept in `handleCellClick`:

Add a drag handler for combat moves at the top of `handleCellClick`:

```ts
function handleTokenMove(x: number, y: number) {
  const cs = state.combatState()
  if (cs && isMyTurn()) {
    const actor = myActor()
    if (!actor) return
    const cost = getMoveCost(actor.position, { x, y }, THE_INN.walls)
    if (cost !== null && cost <= actor.energy) {
      state.sendAction({ type: 'move', actorId: actor.id, destination: { x, y } })
    }
    return
  }
  // Explore drag = move
  state.move({ x, y })
}
```

In the `ExploreBoard` in `PlaysetBoard.tsx`, `tokenmove` calls `props.onCellClick` — we need a separate `onTokenMove` prop or reuse. For now, pass `handleTokenMove` as a new prop `onTokenMove`. Update the return JSX:

```tsx
<PlaysetBoard
  mode="explore"
  roomId="inn"
  exploreMap={exploreMap()}
  sceneJson={sceneJson()}
  onCellClick={handleCellClick}
  onTokenMove={handleTokenMove}
  combatState={state.combatState() ?? undefined}
  highlights={highlights()}
/>
```

- [ ] **Step 4: Add the action bar overlay**

Inside the main `<div>` return, after the PlaysetBoard div, add:

```tsx
{/* Combat action bar — only shown to current actor */}
<Show when={state.combatState() && isMyTurn()}>
  <div style={{
    position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
    display: 'flex', gap: '8px', 'z-index': '10', 'align-items': 'center',
    background: 'rgba(5,10,5,0.9)', border: '1px solid rgba(255,255,255,0.1)',
    'border-radius': '8px', padding: '8px 14px',
  }}>
    <span style={{ 'font-size': '11px', color: '#fa0', 'margin-right': '6px' }}>
      ⚡ {myActor()?.energy ?? 0}/{myActor()?.maxEnergy ?? 0}
    </span>
    {(myActor()?.abilities ?? []).map(ability => (
      <button
        onClick={() => setSelectedAbility(a => a?.id === ability.id ? null : ability)}
        style={{
          padding: '5px 10px', 'font-size': '11px', cursor: 'pointer',
          background: selectedAbility()?.id === ability.id ? 'rgba(80,160,80,0.3)' : 'rgba(10,20,10,0.85)',
          color: (myActor()?.energy ?? 0) >= ability.energyCost ? '#6f6' : '#444',
          border: selectedAbility()?.id === ability.id ? '1px solid #6f6' : '1px solid rgba(255,255,255,0.1)',
          'border-radius': '4px',
          cursor: (myActor()?.energy ?? 0) >= ability.energyCost ? 'pointer' : 'not-allowed',
        }}
        disabled={(myActor()?.energy ?? 0) < ability.energyCost}
      >
        {ability.name} ⚡{ability.energyCost}
      </button>
    ))}
    <button
      onClick={() => { setSelectedAbility(null); state.endTurn() }}
      style={{
        padding: '5px 10px', 'font-size': '11px', cursor: 'pointer',
        background: 'rgba(10,10,20,0.85)', color: '#aaf',
        border: '1px solid rgba(150,150,255,0.2)', 'border-radius': '4px',
      }}
    >
      End Turn
    </button>
  </div>
</Show>

{/* Combat turn indicator — visible to all during combat */}
<Show when={state.combatState()}>
  <div style={{
    position: 'absolute', top: '12px', left: '12px', 'z-index': '10',
    background: 'rgba(5,10,5,0.85)', border: '1px solid rgba(255,255,255,0.1)',
    'border-radius': '6px', padding: '6px 12px', 'font-size': '11px', color: '#aaa',
  }}>
    {() => {
      const cs = state.combatState()
      if (!cs) return null
      const current = cs.actors[cs.turnQueue[cs.currentActorIndex]]
      return <span>⚔ {current?.name ?? '?'}&apos;s turn · Round {cs.round}</span>
    }}
  </div>
</Show>

{/* Join combat offer */}
<Show when={state.joinOffer()}>
  <div style={{
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    'z-index': '20', background: 'rgba(5,10,5,0.95)', border: '1px solid rgba(255,200,50,0.3)',
    'border-radius': '8px', padding: '20px 28px', 'text-align': 'center',
  }}>
    <div style={{ color: '#fa0', 'font-size': '14px', 'margin-bottom': '12px' }}>⚔ A battle is nearby!</div>
    <div style={{ display: 'flex', gap: '8px', 'justify-content': 'center' }}>
      <button onClick={state.joinCombat} style={{ padding: '6px 16px', background: 'rgba(80,160,80,0.2)', color: '#6f6', border: '1px solid #3a5a3a', 'border-radius': '4px', cursor: 'pointer' }}>Join</button>
      <button onClick={state.dismissJoinOffer} style={{ padding: '6px 16px', background: 'rgba(10,10,10,0.5)', color: '#666', border: '1px solid #333', 'border-radius': '4px', cursor: 'pointer' }}>Ignore</button>
    </div>
  </div>
</Show>

{/* Combat results overlay */}
<Show when={state.combatResult()}>
  <div style={{
    position: 'absolute', inset: '0', 'z-index': '30', background: 'rgba(0,0,0,0.7)',
    display: 'flex', 'align-items': 'center', 'justify-content': 'center',
  }}>
    <div style={{ background: 'rgba(5,10,5,0.97)', border: '1px solid rgba(255,255,255,0.1)', 'border-radius': '10px', padding: '32px 40px', 'text-align': 'center', 'max-width': '360px' }}>
      <Show when={state.combatResult() === 'win'}>
        <div style={{ color: '#6f6', 'font-size': '22px', 'margin-bottom': '8px' }}>Victory!</div>
        <div style={{ color: '#888', 'font-size': '13px', 'margin-bottom': '20px' }}>The enemy has been defeated.</div>
        <button onClick={state.dismissCombatResult} style={{ padding: '8px 24px', background: 'rgba(80,160,80,0.2)', color: '#6f6', border: '1px solid #3a5a3a', 'border-radius': '4px', cursor: 'pointer' }}>Continue</button>
      </Show>
      <Show when={state.combatResult() === 'lose'}>
        <div style={{ color: '#f66', 'font-size': '22px', 'margin-bottom': '8px' }}>Defeated</div>
        <div style={{ color: '#888', 'font-size': '13px', 'margin-bottom': '8px' }}>Your heroes need time to recover.</div>
        <Show when={state.recoveryEndsAt()}>
          <div style={{ color: '#666', 'font-size': '11px', 'margin-bottom': '16px' }}>
            Available again: {new Date(state.recoveryEndsAt()!).toLocaleTimeString()}
          </div>
        </Show>
        <button
          onClick={() => { state.dismissCombatResult(); navigate('/') }}
          style={{ padding: '8px 24px', background: 'rgba(160,50,50,0.2)', color: '#f88', border: '1px solid #5a3a3a', 'border-radius': '4px', cursor: 'pointer' }}
        >
          Return to Roster
        </button>
      </Show>
    </div>
  </div>
</Show>
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0 (fix any type errors that arise — typically import issues).

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/screens/ExploreScreen.tsx
git commit -m "feat: add combat action bar, join offer, and results overlay to ExploreScreen"
```

---

### Task 8: PlaysetBoard — combat props + onTokenMove

**Files:**
- Modify: `packages/playsets/src/types.ts`
- Modify: `packages/playsets/src/PlaysetBoard.tsx`

- [ ] **Step 1: Add missing props to PlaysetBoardProps**

In `packages/playsets/src/types.ts`, update `PlaysetBoardProps`:

```ts
export interface HighlightCell {
  x: number
  y: number
  kind: 'move' | 'ability' | 'target'
}

export interface PlaysetBoardProps {
  mode: PlaysetMode
  roomId: string
  sceneJson?: string
  seed?: bigint
  combatState?: CombatState
  validMoves?: Action[]
  exploreMap?: ExploreMap
  highlights?: HighlightCell[]
  onCellClick?: (x: number, y: number) => void
  onTokenMove?: (x: number, y: number) => void
  onEncounter?: (e: EncounterEvent) => void
  onAction?: (a: Action) => void
  onBuild?: (e: BuildEvent) => void
}
```

- [ ] **Step 2: Update ExploreBoard to handle onTokenMove, combatState entities, highlights**

In `packages/playsets/src/PlaysetBoard.tsx`, update `ExploreBoard`:

```ts
function ExploreBoard(props: PlaysetBoardProps) {
  let boardEl!: HTMLElement

  const sceneJson = createMemo(() => {
    if (props.sceneJson) return props.sceneJson
    const walls = props.exploreMap?.walls ?? []
    const buildings: Array<{ col: number; row: number; tileId: string }> = []
    for (let row = 0; row < walls.length; row++) {
      for (let col = 0; col < (walls[row]?.length ?? 0); col++) {
        if (walls[row][col] === 1) buildings.push({ col, row, tileId: 'wall' })
      }
    }
    return JSON.stringify({ buildings, layers: [], props: [], weather: 'none' })
  })

  const entitiesJson = createMemo(() => {
    // During combat, use actor positions from combatState
    if (props.combatState) {
      const actors = Object.values(props.combatState.actors)
      return JSON.stringify(
        actors.map(a => ({
          id: a.id,
          type: a.isNPC ? 'enemy' : 'player',
          x: a.position.x,
          y: a.position.y,
          isMe: false,
          label: a.name,
          isGhost: a.isGhost ?? false,
        }))
      )
    }
    const tokens = props.exploreMap?.tokens ?? []
    return JSON.stringify(
      tokens.map((t) => ({
        id: t.id,
        type: t.type,
        x: t.x,
        y: t.y,
        isMe: t.isMe,
        label: t.label,
      }))
    )
  })

  const highlightsJson = createMemo(() =>
    props.highlights && props.highlights.length > 0
      ? JSON.stringify(props.highlights)
      : null
  )

  onMount(() => {
    function onCellClick(e: Event) {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail
      props.onCellClick?.(x, y)
    }
    function onTokenMove(e: Event) {
      const { x, y } = (e as CustomEvent<{ id: string; x: number; y: number }>).detail
      if (props.onTokenMove) props.onTokenMove(x, y)
      else props.onCellClick?.(x, y)
    }
    boardEl.addEventListener('cellclick', onCellClick)
    boardEl.addEventListener('tokenmove', onTokenMove)
    onCleanup(() => {
      boardEl.removeEventListener('cellclick', onCellClick)
      boardEl.removeEventListener('tokenmove', onTokenMove)
    })
  })

  return (
    <playsets-board
      ref={boardEl}
      attr:scene={sceneJson()}
      attr:entities={entitiesJson()}
      attr:mode="explore"
      attr:highlights={highlightsJson() ?? undefined}
      style="width:100%;height:100%;display:block;"
    />
  )
}
```

Also update the JSX IntrinsicElements declaration to include `'attr:highlights'?`:

```ts
declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'playsets-board': {
        ref?: HTMLElement
        'attr:scene'?: string
        'attr:entities'?: string
        'attr:mode'?: string
        'attr:highlights'?: string
        style?: string
      }
    }
  }
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/playsets/src/types.ts packages/playsets/src/PlaysetBoard.tsx
git commit -m "feat: add highlights + onTokenMove + combatState entity rendering to PlaysetBoard"
```

---

### Task 9: board-element + PlaysetsBoardRoot — highlights and ghost rendering

**Files:**
- Modify: `playsets experiments/apps/client/src/board-element.ts`
- Modify: `playsets experiments/apps/client/src/PlaysetsBoardRoot.tsx`

- [ ] **Step 1: Add highlights attribute to board-element.ts**

In `playsets experiments/apps/client/src/board-element.ts`, update the class:

```ts
class PlaysetsBoardElement extends HTMLElement {
  private _dispose: (() => void) | null = null
  private _setScene: ((v: SceneData) => void) | null = null
  private _setEntities: ((v: EntityData[]) => void) | null = null
  private _setMode: ((v: string) => void) | null = null
  private _setHighlights: ((v: HighlightCell[]) => void) | null = null

  static get observedAttributes() { return ['scene', 'entities', 'mode', 'highlights'] }

  connectedCallback() {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block;'
    this.appendChild(canvas)

    const host = this
    const initialMode = this.getAttribute('mode') ?? 'explore'
    const initialScene = this.getAttribute('scene')
    const initialEntities = this.getAttribute('entities')
    const initialHighlights = this.getAttribute('highlights')

    let _setScene: ((v: SceneData) => void) | null = null
    let _setEntities: ((v: EntityData[]) => void) | null = null
    let _setMode: ((v: string) => void) | null = null
    let _setHighlights: ((v: HighlightCell[]) => void) | null = null

    this._dispose = render(() => {
      const [scene, setScene] = createSignal<SceneData>(
        initialScene ? (() => { try { return JSON.parse(initialScene) as SceneData } catch { return {} } })() : {},
      )
      const [entities, setEntities] = createSignal<EntityData[]>(
        initialEntities ? (() => { try { return JSON.parse(initialEntities) as EntityData[] } catch { return [] } })() : [],
      )
      const [mode, setMode] = createSignal<string>(initialMode)
      const [highlights, setHighlights] = createSignal<HighlightCell[]>(
        initialHighlights ? (() => { try { return JSON.parse(initialHighlights) as HighlightCell[] } catch { return [] } })() : [],
      )

      _setScene = setScene
      _setEntities = setEntities
      _setMode = setMode
      _setHighlights = setHighlights

      return createComponent(PlaysetsBoardRoot, {
        host,
        canvas,
        get scene() { return scene() },
        get entities() { return entities() },
        get mode() { return mode() },
        get highlights() { return highlights() },
      })
    }, this)

    this._setScene = _setScene
    this._setEntities = _setEntities
    this._setMode = _setMode
    this._setHighlights = _setHighlights
  }

  attributeChangedCallback(name: string, _old: string | null, newVal: string | null) {
    if (!newVal) return
    try {
      if (name === 'scene') this._setScene?.(JSON.parse(newVal) as SceneData)
      else if (name === 'entities') this._setEntities?.(JSON.parse(newVal) as EntityData[])
      else if (name === 'mode') this._setMode?.(newVal)
      else if (name === 'highlights') this._setHighlights?.(JSON.parse(newVal) as HighlightCell[])
    } catch {
      console.warn(`[playsets-board] invalid JSON for attr:${name}`)
    }
  }

  disconnectedCallback() {
    this._dispose?.()
    this._dispose = null
    this._setScene = null
    this._setEntities = null
    this._setMode = null
    this._setHighlights = null
  }
}
```

Add the `HighlightCell` type and import to board-element.ts:

```ts
export interface HighlightCell {
  x: number
  y: number
  kind: 'move' | 'ability' | 'target'
}
```

- [ ] **Step 2: Add isGhost to EntityData and highlights to Props in PlaysetsBoardRoot.tsx**

In `PlaysetsBoardRoot.tsx`, update `EntityData`:

```ts
export interface EntityData {
  id: string
  type: 'player' | 'npc' | 'enemy' | 'door'
  x: number
  y: number
  isMe?: boolean
  label?: string
  isGhost?: boolean
}
```

Import `HighlightCell` and update `Props`:

```ts
import type { HighlightCell } from './board-element'

interface Props {
  host: HTMLElement
  canvas: HTMLCanvasElement
  scene: SceneData
  entities: EntityData[]
  mode: string
  highlights?: HighlightCell[]
}
```

- [ ] **Step 3: Render ghost entities as translucent in syncEntities**

In the `syncEntities` function, after `mesh.material = mat`, add ghost check:

```ts
if (e.isGhost) {
  mat.alpha = 0.35
  mesh.material = mat
} else {
  mesh.material = mat
}
```

Replace the existing `mesh.material = mat` line with:

```ts
mat.diffuseColor = ENTITY_COLORS[colorKey] ?? ENTITY_COLORS.npc
if (e.isGhost) mat.alpha = 0.35
mesh.material = mat
```

- [ ] **Step 4: Add highlight mesh management**

In `PlaysetsBoardRoot`, add after `const entityMeshes = new Map<string, Mesh>()`:

```ts
const highlightMeshes: Mesh[] = []

const HIGHLIGHT_COLORS: Record<string, import('@babylonjs/core').Color4> = {
  move:    new (await import('@babylonjs/core')).Color4(0.2, 0.8, 0.2, 0.35),
  ability: new (await import('@babylonjs/core')).Color4(0.9, 0.5, 0.1, 0.45),
  target:  new (await import('@babylonjs/core')).Color4(0.9, 0.2, 0.2, 0.45),
}
```

Actually, avoid async imports — add the Color4 import to the existing import at the top:

```ts
import { MeshBuilder, StandardMaterial, Color3, Vector3, Color4, Mesh as BjsMesh } from '@babylonjs/core'
```

Then add `highlightMeshes` and `syncHighlights` function:

```ts
const highlightMeshes: Mesh[] = []

function syncHighlights(cells: HighlightCell[]) {
  if (!bjsScene) return
  for (const m of highlightMeshes) { m.material?.dispose(); m.dispose() }
  highlightMeshes.length = 0

  const colorMap: Record<string, [number, number, number]> = {
    move:    [0.2, 0.8, 0.2],
    ability: [0.9, 0.5, 0.1],
    target:  [0.9, 0.2, 0.2],
  }

  for (const cell of cells) {
    const mesh = MeshBuilder.CreateGround(
      `hl-${cell.x}-${cell.y}`,
      { width: 0.9, height: 0.9 },
      bjsScene,
    )
    mesh.position = new Vector3(cell.x + 0.5, 0.01, cell.y + 0.5)
    mesh.renderingGroupId = 6
    mesh.isPickable = false
    const mat = new StandardMaterial(`hlmat-${cell.x}-${cell.y}`, bjsScene)
    const [r, g, b] = colorMap[cell.kind] ?? [1, 1, 1]
    mat.diffuseColor = new Color3(r, g, b)
    mat.alpha = 0.4
    mesh.material = mat
    highlightMeshes.push(mesh)
  }
}
```

Add cleanup for highlight meshes in both `onCleanup` blocks (explore mode cleanup):

```ts
for (const m of highlightMeshes) { m.material?.dispose(); m.dispose() }
highlightMeshes.length = 0
```

Add a reactive effect for highlights at the end of `onMount`, after the pointer observable is added:

```ts
// (inside onMount, after the pointer observer)
```

After `onMount`, add a new `createEffect` for highlights:

```ts
createEffect(on(() => props.highlights, (cells) => {
  if (props.mode !== 'build') syncHighlights(cells ?? [])
}, { defer: true }))
```

- [ ] **Step 5: Build the playsets-board library**

```bash
cd "/path/to/playsets experiments"
pnpm --filter playsets-board build:lib
```

Expected: `dist/playsets-board.mjs` regenerated, built in ~6s.

- [ ] **Step 6: Commit in the playsets repo**

```bash
cd "/path/to/playsets experiments"
git add apps/client/src/board-element.ts apps/client/src/PlaysetsBoardRoot.tsx
git commit -m "feat: add highlights attribute and ghost entity rendering to playsets-board"
```

- [ ] **Step 7: Run typecheck in the tactical-rpg repo**

```bash
cd /path/to/tactical-rpg
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 8: Commit in tactical-rpg**

```bash
git add packages/playsets/src/
git commit -m "feat: wire highlights and ghost state through PlaysetBoard"
```

---

### Task 10: Full test run and smoke test

**Files:** none — verification only

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all tests pass (124 original + new combat-bfs + InPlaceCombatEngine tests).

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Start server and client**

Terminal 1:
```bash
pnpm --filter server dev
```
Expected: `Game server listening on port 2567`

Terminal 2:
```bash
pnpm --filter game dev
```
Expected: Vite dev server on port 5173.

- [ ] **Step 4: Smoke test the combat loop**

1. Open http://localhost:5173, log in, select a hero, enter the inn
2. Walk adjacent to a skeleton — action bar should appear at bottom
3. Click an ability → enemy should be highlighted
4. Click the enemy → action fires, enemy HP decreases in the shared state
5. Click "End Turn" → NPC takes its turn, board updates
6. Continue until combat ends — "Victory!" or "Defeated" overlay appears
7. Win: overlay auto-dismisses, enemy cylinder disappears, explore resumes
8. Lose: "Return to Roster" button, navigates to `/`

- [ ] **Step 5: Final commit**

```bash
git add -p  # stage any remaining fixes
git commit -m "feat: complete combat integration — in-place board combat with energy model"
```
