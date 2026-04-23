# The Inn — Implementation Plan 09

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make The Inn a real explorable hub — a 2D grid map with NPCs and a door to the Verdant Forest, fully wired to the Colyseus ExploreRoom so players can walk around, see each other, and interact with entities.

**Architecture:** The Inn map is a static constant defined in `shared-types` (accessible to both client and server). ExploreState grows two new Colyseus schema arrays: `npcs` and `doors`. ExploreRoom loads the Inn on create, validates movement against its walls, and responds to `INTERACT` messages. The client uses a new `useExploreRoom` hook to sync Colyseus state into React, and renders the Inn as a simple 2D tile grid (`InnView`) rather than the BabylonJS board — the 3D view is for biome maps.

**Tech Stack:** Colyseus 0.15, @colyseus/schema, React 18, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared-types/src/inn-map.ts` | Create | `InnMap` types + `THE_INN` constant |
| `packages/shared-types/src/index.ts` | Modify | export from `inn-map` |
| `server/src/schemas/ExploreState.ts` | Modify | Add `NpcEntity`, `DoorEntity` schemas |
| `server/src/rooms/logic/explore-logic.ts` | Modify | Add `isWalkable()`, `isAdjacent()` |
| `server/src/rooms/ExploreRoom.ts` | Modify | Load Inn map, wall validation, `INTERACT` handler |
| `apps/game/src/hooks/useExploreRoom.ts` | Create | Colyseus connection + React state sync |
| `apps/game/src/screens/InnView.tsx` | Create | 2D tile grid renderer |
| `apps/game/src/screens/ExploreScreen.tsx` | Modify | Wire useExploreRoom + InnView + interaction panel |
| `.env.example` | Modify | Add `VITE_SERVER_URL` |

---

## Task 1: Inn Map Types & Data

**Files:**
- Create: `packages/shared-types/src/inn-map.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/__tests__/inn-map.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared-types/src/__tests__/inn-map.test.ts
import { describe, it, expect } from 'vitest'
import { THE_INN } from '../inn-map'

describe('THE_INN', () => {
  it('has valid dimensions', () => {
    expect(THE_INN.walls.length).toBe(THE_INN.height)
    THE_INN.walls.forEach(row => expect(row.length).toBe(THE_INN.width))
  })

  it('has a walkable spawn point', () => {
    expect(THE_INN.walls[THE_INN.spawnY][THE_INN.spawnX]).toBe(0)
  })

  it('all NPC positions are on walkable tiles', () => {
    for (const npc of THE_INN.npcs) {
      expect(THE_INN.walls[npc.y][npc.x]).toBe(0)
    }
  })

  it('all door positions are on walkable tiles', () => {
    for (const door of THE_INN.doors) {
      expect(THE_INN.walls[door.y][door.x]).toBe(0)
    }
  })

  it('border tiles are all walls', () => {
    const lastRow = THE_INN.height - 1
    const lastCol = THE_INN.width - 1
    THE_INN.walls[0].forEach(t => expect(t).toBe(1))
    THE_INN.walls[lastRow].forEach(t => expect(t).toBe(1))
    THE_INN.walls.forEach(row => {
      expect(row[0]).toBe(1)
      expect(row[lastCol]).toBe(1)
    })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /path/to/worktree
pnpm --filter shared-types test --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `inn-map` module not found.

- [ ] **Step 3: Create `inn-map.ts`**

```typescript
// packages/shared-types/src/inn-map.ts

export type NpcRole = 'innkeeper' | 'blacksmith' | 'sage' | 'doorkeeper'

export type InnNpc = {
  id: string
  name: string
  role: NpcRole
  x: number
  y: number
}

export type InnDoor = {
  id: string
  biomeId: string
  label: string
  x: number
  y: number
}

export type InnMap = {
  width: number
  height: number
  spawnX: number
  spawnY: number
  /** 0 = floor, 1 = wall. Indexed as walls[y][x]. */
  walls: number[][]
  npcs: InnNpc[]
  doors: InnDoor[]
}

// prettier-ignore
const W = 1, F = 0

// prettier-ignore
export const THE_INN: InnMap = {
  width: 20,
  height: 14,
  spawnX: 10,
  spawnY: 7,
  walls: [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  ],
  npcs: [
    { id: 'innkeeper',         name: 'Innkeeper',          role: 'innkeeper',  x: 10, y: 2  },
    { id: 'blacksmith',        name: 'Blacksmith',          role: 'blacksmith', x: 4,  y: 7  },
    { id: 'doorkeeper-forest', name: 'Forest Doorkeeper',   role: 'doorkeeper', x: 16, y: 7  },
  ],
  doors: [
    { id: 'door-forest', biomeId: 'verdant-forest', label: 'Verdant Forest', x: 16, y: 12 },
  ],
}
```

- [ ] **Step 4: Export from shared-types index**

Add to the bottom of `packages/shared-types/src/index.ts`:

```typescript
export * from './inn-map'
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter shared-types test --reporter=verbose
```

Expected: all inn-map tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/inn-map.ts packages/shared-types/src/index.ts packages/shared-types/src/__tests__/inn-map.test.ts
git commit -m "feat(shared-types): add InnMap types and THE_INN constant"
```

---

## Task 2: ExploreState Schema Extension

**Files:**
- Modify: `server/src/schemas/ExploreState.ts`

No separate unit test needed — schema declarations are exercised by ExploreRoom tests. Typecheck is sufficient.

- [ ] **Step 1: Read current `ExploreState.ts`**

Read the file first so you understand what to add to.

- [ ] **Step 2: Replace `ExploreState.ts` with the extended version**

```typescript
// server/src/schemas/ExploreState.ts
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

export class ExploreState extends Schema {
  @type({ map: PlayerPosition }) players = new MapSchema<PlayerPosition>()
  @type([NpcEntity]) npcs = new ArraySchema<NpcEntity>()
  @type([DoorEntity]) doors = new ArraySchema<DoorEntity>()
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add server/src/schemas/ExploreState.ts
git commit -m "feat(server): add NpcEntity and DoorEntity to ExploreState"
```

---

## Task 3: ExploreRoom Logic — Wall Validation & INTERACT

**Files:**
- Modify: `server/src/rooms/logic/explore-logic.ts`
- Modify: `server/src/rooms/ExploreRoom.ts`
- Test: `server/src/__tests__/explore-logic.test.ts` (add new cases)

- [ ] **Step 1: Write failing tests for new logic functions**

Open `server/src/__tests__/explore-logic.test.ts`. Add these new test cases after the existing ones:

```typescript
import { THE_INN } from 'shared-types'
import { isWalkable, isAdjacent } from '../rooms/logic/explore-logic'

describe('isWalkable', () => {
  it('returns true for a floor tile', () => {
    expect(isWalkable(THE_INN, { x: 10, y: 7 })).toBe(true)
  })

  it('returns false for a wall tile', () => {
    expect(isWalkable(THE_INN, { x: 0, y: 0 })).toBe(false)
  })

  it('returns false for out-of-bounds position', () => {
    expect(isWalkable(THE_INN, { x: -1, y: 0 })).toBe(false)
    expect(isWalkable(THE_INN, { x: 0, y: 100 })).toBe(false)
  })
})

describe('isAdjacent', () => {
  it('returns true for orthogonally adjacent positions', () => {
    expect(isAdjacent({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe(true)
    expect(isAdjacent({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe(true)
    expect(isAdjacent({ x: 5, y: 5 }, { x: 4, y: 5 })).toBe(true)
  })

  it('returns false for diagonal positions', () => {
    expect(isAdjacent({ x: 5, y: 5 }, { x: 6, y: 6 })).toBe(false)
  })

  it('returns false for same position', () => {
    expect(isAdjacent({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })

  it('returns false for positions 2 steps away', () => {
    expect(isAdjacent({ x: 5, y: 5 }, { x: 7, y: 5 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter server test --reporter=verbose 2>&1 | grep -E "isWalkable|isAdjacent|FAIL"
```

Expected: FAIL — `isWalkable` and `isAdjacent` not found.

- [ ] **Step 3: Add `isWalkable` and `isAdjacent` to `explore-logic.ts`**

```typescript
// server/src/rooms/logic/explore-logic.ts
import type { Position } from 'shared-types'
import type { InnMap } from 'shared-types'

export function getManhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function isValidMove(current: Position, destination: Position, speed: number): boolean {
  const dist = getManhattanDistance(current, destination)
  return dist > 0 && dist <= speed
}

export function isWalkable(map: InnMap, pos: Position): boolean {
  if (pos.x < 0 || pos.y < 0 || pos.y >= map.walls.length || pos.x >= map.walls[0].length) return false
  return map.walls[pos.y][pos.x] === 0
}

export function isAdjacent(a: Position, b: Position): boolean {
  return getManhattanDistance(a, b) === 1
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter server test --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 5: Update `ExploreRoom.ts` to use the Inn map**

```typescript
// server/src/rooms/ExploreRoom.ts
import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity } from '../schemas/ExploreState'
import { BaseRoom } from './BaseRoom'
import { isValidMove, isWalkable, isAdjacent } from './logic/explore-logic'
import { THE_INN } from 'shared-types'
import type { Position } from 'shared-types'

interface MoveMessage {
  characterId: string
  destination: Position
  speed: number
}

export class ExploreRoom extends BaseRoom<ExploreState> {
  onCreate(): void {
    this.setState(new ExploreState())

    for (const npc of THE_INN.npcs) {
      const entity = new NpcEntity()
      entity.id = npc.id
      entity.name = npc.name
      entity.role = npc.role
      entity.x = npc.x
      entity.y = npc.y
      this.state.npcs.push(entity)
    }

    for (const door of THE_INN.doors) {
      const entity = new DoorEntity()
      entity.id = door.id
      entity.biomeId = door.biomeId
      entity.label = door.label
      entity.x = door.x
      entity.y = door.y
      this.state.doors.push(entity)
    }

    this.onMessage<MoveMessage>('MOVE', (client, message) => {
      this.handleMove(client, message)
    })

    this.onMessage('INTERACT', (client) => {
      this.handleInteract(client)
    })
  }

  onJoin(client: Client, options: { token?: string; heroIds?: string[] }): void {
    const pos = new PlayerPosition()
    pos.x = THE_INN.spawnX
    pos.y = THE_INN.spawnY
    pos.characterId = client.sessionId
    this.state.players.set(client.sessionId, pos)
    client.userData = { ...(client.userData ?? {}), heroIds: options.heroIds ?? [] }
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId)
  }

  private handleMove(client: Client, message: MoveMessage): void {
    const current = this.state.players.get(client.sessionId)
    if (!current) return

    const currentPos: Position = { x: current.x, y: current.y }

    if (!isValidMove(currentPos, message.destination, message.speed)) {
      client.send('MOVE_REJECTED', { reason: 'out_of_range' })
      return
    }

    if (!isWalkable(THE_INN, message.destination)) {
      client.send('MOVE_REJECTED', { reason: 'blocked' })
      return
    }

    current.x = message.destination.x
    current.y = message.destination.y
  }

  private handleInteract(client: Client): void {
    const pos = this.state.players.get(client.sessionId)
    if (!pos) return

    const playerPos: Position = { x: pos.x, y: pos.y }

    for (const npc of this.state.npcs) {
      if (isAdjacent(playerPos, { x: npc.x, y: npc.y })) {
        client.send('INTERACTION_START', { type: 'npc', id: npc.id, name: npc.name, role: npc.role })
        return
      }
    }

    for (const door of this.state.doors) {
      if (isAdjacent(playerPos, { x: door.x, y: door.y })) {
        client.send('INTERACTION_START', { type: 'door', id: door.id, biomeId: door.biomeId, label: door.label })
        return
      }
    }
  }
}
```

- [ ] **Step 6: Typecheck and run tests**

```bash
pnpm typecheck && pnpm test
```

Expected: exits 0, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/rooms/logic/explore-logic.ts server/src/rooms/ExploreRoom.ts server/src/__tests__/explore-logic.test.ts
git commit -m "feat(server): Inn map loading, wall validation, INTERACT handler"
```

---

## Task 4: `useExploreRoom` Hook

**Files:**
- Create: `apps/game/src/hooks/useExploreRoom.ts`

- [ ] **Step 1: Create `useExploreRoom.ts`**

```typescript
// apps/game/src/hooks/useExploreRoom.ts
import { useState, useEffect, useRef } from 'react'
import { useGameServer } from './useGameServer'
import type { Room } from 'colyseus.js'
import type { Position } from 'shared-types'

export type PlayerState = { x: number; y: number; characterId: string }
export type NpcState = { id: string; name: string; role: string; x: number; y: number }
export type DoorState = { id: string; biomeId: string; label: string; x: number; y: number }
export type InteractionEvent =
  | { type: 'npc'; id: string; name: string; role: string }
  | { type: 'door'; id: string; biomeId: string; label: string }

export function useExploreRoom(token: string | null, heroIds: string[]) {
  const { joinRoom } = useGameServer()
  const roomRef = useRef<Room | null>(null)
  const [connected, setConnected] = useState(false)
  const [mySessionId, setMySessionId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Record<string, PlayerState>>({})
  const [npcs, setNpcs] = useState<NpcState[]>([])
  const [doors, setDoors] = useState<DoorState[]>([])
  const [interaction, setInteraction] = useState<InteractionEvent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let room: Room

    joinRoom<{ players: unknown; npcs: unknown; doors: unknown }>('ExploreRoom', { token, heroIds })
      .then((r) => {
        room = r as Room
        roomRef.current = r as Room
        setMySessionId(r.sessionId)
        setConnected(true)

        r.state.players.onAdd((player: PlayerState & { onChange: (cb: () => void) => void }, sessionId: string) => {
          setPlayers((prev) => ({ ...prev, [sessionId]: { x: player.x, y: player.y, characterId: player.characterId } }))
          player.onChange(() => {
            setPlayers((prev) => ({ ...prev, [sessionId]: { x: player.x, y: player.y, characterId: player.characterId } }))
          })
        })
        r.state.players.onRemove((_: unknown, sessionId: string) => {
          setPlayers((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
        })

        r.state.npcs.onAdd((npc: NpcState) => {
          setNpcs((prev) => [...prev, { id: npc.id, name: npc.name, role: npc.role, x: npc.x, y: npc.y }])
        })

        r.state.doors.onAdd((door: DoorState) => {
          setDoors((prev) => [...prev, { id: door.id, biomeId: door.biomeId, label: door.label, x: door.x, y: door.y }])
        })

        r.onMessage('INTERACTION_START', (data: InteractionEvent) => {
          setInteraction(data)
        })
      })
      .catch((e: Error) => setError(e.message))

    return () => {
      room?.leave()
      roomRef.current = null
      setConnected(false)
      setPlayers({})
      setNpcs([])
      setDoors([])
    }
  }, [token])

  function move(destination: Position) {
    roomRef.current?.send('MOVE', { destination, speed: 3 })
  }

  function interact() {
    roomRef.current?.send('INTERACT')
  }

  function dismissInteraction() {
    setInteraction(null)
  }

  const myPosition = mySessionId ? (players[mySessionId] ?? null) : null

  return { connected, error, myPosition, mySessionId, players, npcs, doors, interaction, move, interact, dismissInteraction }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/hooks/useExploreRoom.ts
git commit -m "feat(game): add useExploreRoom hook"
```

---

## Task 5: InnView Component

**Files:**
- Create: `apps/game/src/screens/InnView.tsx`

- [ ] **Step 1: Create `InnView.tsx`**

```typescript
// apps/game/src/screens/InnView.tsx
import type { InnMap } from 'shared-types'
import type { PlayerState, NpcState, DoorState } from '../hooks/useExploreRoom'

const CELL_SIZE = 36

type Props = {
  map: InnMap
  players: Record<string, PlayerState>
  mySessionId: string | null
  npcs: NpcState[]
  doors: DoorState[]
  onCellClick: (x: number, y: number) => void
}

export function InnView({ map, players, mySessionId, npcs, doors, onCellClick }: Props) {
  const npcsByPos = Object.fromEntries(npcs.map((n) => [`${n.x},${n.y}`, n]))
  const doorsByPos = Object.fromEntries(doors.map((d) => [`${d.x},${d.y}`, d]))
  const playersByPos = Object.fromEntries(
    Object.entries(players).map(([sid, p]) => [`${p.x},${p.y}`, { ...p, isMe: sid === mySessionId }])
  )

  return (
    <div style={{ display: 'inline-block', border: '2px solid #333' }}>
      {map.walls.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {row.map((isWall, x) => {
            const key = `${x},${y}`
            const npc = npcsByPos[key]
            const door = doorsByPos[key]
            const player = playersByPos[key]

            let bg = isWall ? '#2a2a2a' : '#d4c5a0'
            let label = ''
            let color = '#000'
            let title = ''

            if (npc)    { bg = '#4a7fc1'; label = npc.name[0];  color = '#fff'; title = npc.name }
            if (door)   { bg = '#4caf50'; label = 'D';           color = '#fff'; title = door.label }
            if (player) { bg = player.isMe ? '#e05555' : '#ff9800'; label = '@'; color = '#fff' }

            return (
              <div
                key={x}
                title={title}
                onClick={() => !isWall && onCellClick(x, y)}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  background: bg,
                  border: '1px solid rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 'bold',
                  color,
                  cursor: isWall ? 'default' : 'pointer',
                  userSelect: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {label}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/screens/InnView.tsx
git commit -m "feat(game): add InnView 2D grid renderer"
```

---

## Task 6: ExploreScreen Wiring

**Files:**
- Modify: `apps/game/src/screens/ExploreScreen.tsx`

- [ ] **Step 1: Read the current `ExploreScreen.tsx`**

Read `apps/game/src/screens/ExploreScreen.tsx` first.

- [ ] **Step 2: Replace `ExploreScreen.tsx`**

```typescript
// apps/game/src/screens/ExploreScreen.tsx
import { THE_INN } from 'shared-types'
import { useExploreRoom } from '../hooks/useExploreRoom'
import { InnView } from './InnView'

interface ExploreScreenProps {
  token?: string | null
  heroIds?: string[]
}

export function ExploreScreen({ token = null, heroIds = [] }: ExploreScreenProps) {
  const {
    connected,
    error,
    myPosition,
    mySessionId,
    players,
    npcs,
    doors,
    interaction,
    move,
    interact,
    dismissInteraction,
  } = useExploreRoom(token, heroIds)

  function handleCellClick(x: number, y: number) {
    if (!myPosition) return
    const isNpc = npcs.some((n) => n.x === x && n.y === y)
    const isDoor = doors.some((d) => d.x === x && d.y === y)
    const dist = Math.abs(myPosition.x - x) + Math.abs(myPosition.y - y)
    if ((isNpc || isDoor) && dist === 1) {
      interact()
    } else {
      move({ x, y })
    }
  }

  if (error) {
    return <div style={{ padding: 20, color: 'red' }}>Connection error: {error}</div>
  }

  if (!connected) {
    return <div style={{ padding: 20 }}>Connecting to The Inn…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, background: '#111', minHeight: '100vh', color: '#fff' }}>
      <h2 style={{ marginBottom: 16 }}>The Inn</h2>

      <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
        Click an adjacent NPC or door to interact · Click a floor tile to move
      </div>

      <InnView
        map={THE_INN}
        players={players}
        mySessionId={mySessionId}
        npcs={npcs}
        doors={doors}
        onCellClick={handleCellClick}
      />

      {myPosition && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#555' }}>
          ({myPosition.x}, {myPosition.y})
        </div>
      )}

      {interaction && (
        <div style={{
          marginTop: 20,
          padding: 20,
          background: '#1a1a2a',
          border: '1px solid #444',
          borderRadius: 8,
          maxWidth: 320,
          width: '100%',
        }}>
          {interaction.type === 'npc' && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 16 }}>{interaction.name}</div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 16 }}>
                {interaction.role === 'innkeeper'  && 'Welcome to the Inn! Your heroes rest and recover here between runs.'}
                {interaction.role === 'blacksmith' && 'I can help you equip your heroes when gear equipping arrives.'}
                {interaction.role === 'doorkeeper' && 'Ready to venture out? Walk up to the door when your party is ready.'}
              </div>
            </>
          )}
          {interaction.type === 'door' && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 16 }}>
                Enter {interaction.label}?
              </div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 16 }}>
                Biome exploration is coming in the next update.
              </div>
            </>
          )}
          <button onClick={dismissInteraction} style={{ padding: '6px 20px', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: all tests pass. (Note: App.test.tsx mocks the screen components so ExploreScreen changes don't break it.)

- [ ] **Step 5: Commit**

```bash
git add apps/game/src/screens/ExploreScreen.tsx
git commit -m "feat(game): wire ExploreScreen to Colyseus ExploreRoom with InnView"
```

---

## Task 7: Environment — Add VITE_SERVER_URL

**Files:**
- Modify: `.env.example`
- Modify: `apps/game/.env` (manual step for the developer — not committed)

- [ ] **Step 1: Add `VITE_SERVER_URL` to `.env.example`**

Open `.env.example`. Add after the existing `VITE_API_URL` line:

```bash
# Colyseus WebSocket server URL
VITE_SERVER_URL=ws://localhost:2567
```

- [ ] **Step 2: Add to local game env**

The developer must add this to `apps/game/.env` (not committed):

```bash
VITE_SERVER_URL=ws://localhost:2567
```

- [ ] **Step 3: Typecheck and full test run**

```bash
pnpm typecheck && pnpm test
```

Expected: exits 0, all tests pass.

- [ ] **Step 4: Manual smoke test**

Start both servers:
```bash
# Terminal 1
cd /path/to/repo && pnpm --filter server dev

# Terminal 2
cd /path/to/repo && pnpm --filter game dev
```

Open `http://localhost:5173`. Sign in. Select a hero. Click "Enter The Inn".

You should see:
1. The 2D grid of The Inn (20×14 tiles, dark walls, tan floor)
2. Your player `@` marker at position (10, 7)
3. Three NPCs labeled `I` (Innkeeper), `B` (Blacksmith), `F` (Forest Doorkeeper) in blue
4. One door `D` in green at (16, 12)
5. Clicking a floor tile moves your character
6. Clicking a cell adjacent to an NPC or door shows the interaction panel

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "chore: add VITE_SERVER_URL to env example"
```

---

## Self-Review

**Spec coverage:**

From `docs/superpowers/specs/2026-04-20-game-design.md`:

| Spec requirement | Task |
|---|---|
| The Inn is an explorable map using ExploreRoom | Task 6 (ExploreScreen connects to ExploreRoom) |
| NPCs: Innkeeper, Blacksmith, Doorkeeper | Task 1 (Inn map data), Task 3 (ExploreRoom loads them) |
| Biome door per biome | Task 1 (one Forest door), Task 3 (DoorEntity in state) |
| Walk-up interaction with NPCs | Task 3 (INTERACT handler), Task 6 (handleCellClick) |
| Party selection before entering biome | ⏭ Deferred — biomes are Plan 10. Door interaction shows placeholder. |
| Blacksmith equip gear | ⏭ Deferred — gear equipping is Plan 11. Dialog placeholder only. |
| Sage upgrades | ⏭ Deferred — upgrade tree is a later plan. |

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:**
- `NpcState`, `DoorState`, `PlayerState` defined in Task 4 (`useExploreRoom`), consumed in Tasks 5 and 6
- `InnMap`, `InnNpc`, `InnDoor` defined in Task 1, imported in Tasks 3, 5, 6
- `NpcEntity`, `DoorEntity` defined in Task 2, used in Task 3
- `isWalkable(map, pos)` and `isAdjacent(a, b)` defined in Task 3, used in Task 3 — consistent
