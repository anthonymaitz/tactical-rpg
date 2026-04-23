# Inn End-to-End Systems Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 2D InnView grid with a 3D PlaysetBoard renderer, wire NPC/door dialog through the click-comics engine, and verify all Inn systems work end-to-end.

**Architecture:** ExploreScreen assembles an `ExploreMap` from Colyseus room state and passes it to PlaysetBoard via a new `exploreMap` prop. PlaysetBoard gains an explore renderer that builds wall/floor meshes from the walls grid and places colored cylinder tokens for players, NPCs, and doors. Tile clicks fire `onCellClick(x, y)` back to ExploreScreen, which routes to move or interact. NPC/door interactions render click-comics panels as an overlay.

**Tech Stack:** BabylonJS 7, SolidJS, Colyseus 0.15, click-comics engine (packages/click-comics), packages/playsets (PlaysetBoard)

---

## ExploreMap Type

Defined in `packages/shared-types/` and consumed by both `packages/playsets/` and `apps/game/`.

```typescript
export type ExploreToken = {
  x: number
  y: number
  type: 'player' | 'npc' | 'door'
  id: string
  label: string
  isMe?: boolean  // true only for the local player's token
}

export type ExploreMap = {
  walls: boolean[][]
  tokens: ExploreToken[]
}
```

---

## PlaysetBoard Changes (`packages/playsets/`)

### New props added to `PlaysetBoardProps` in `packages/playsets/src/types.ts`

`'explore'` already exists in `PlaysetMode`. Add two new optional props:

```typescript
// Add to existing PlaysetBoardProps interface:
exploreMap?: ExploreMap         // required when mode === 'explore'
onCellClick?: (x: number, y: number) => void
```

Full interface after change (existing props preserved):

```typescript
export interface PlaysetBoardProps {
  mode: PlaysetMode               // 'explore' | 'combat' | 'vtt'
  roomId: string
  seed?: bigint
  combatState?: CombatState
  validMoves?: Action[]
  exploreMap?: ExploreMap         // NEW
  onCellClick?: (x: number, y: number) => void  // NEW
  onEncounter?: (e: EncounterEvent) => void
  onAction?: (a: Action) => void
  onBuild?: (e: BuildEvent) => void
}
```

### Two-effect pattern (unchanged structure)

**Effect 1 — scene init** (tracks `mode` + `seed`):
- When `mode === 'explore'`: iterate `exploreMap.walls`, create a flat floor mesh for every `false` cell and a wall box mesh for every `true` cell. Use fixed colors: floor `#d4c5a0`, wall `#2a2a2a`.
- Register a BabylonJS `ActionManager` on each floor mesh to fire `onCellClick(x, y)` on pick.

**Effect 2 — token sync** (tracks `exploreMap.tokens`):
- Dispose all existing token meshes.
- For each token, create a `MeshBuilder.CreateCylinder` at `(x, y)` with color:
  - `player + isMe`: red (`#e05555`)
  - `player`: orange (`#ff9800`)
  - `npc`: blue (`#4a7fc1`)
  - `door`: green (`#4caf50`)
- Scale tokens to fit within a single grid cell, slightly elevated above the floor.

### No camera changes
Use the existing BabylonJS camera setup. A fixed overhead or slight isometric angle is fine for this milestone.

---

## ExploreScreen Changes (`apps/game/`)

### Replace `<InnView>` with `<PlaysetBoard>`

```typescript
// Derive ExploreMap from room state (reactive)
const exploreMap = (): ExploreMap => ({
  walls: THE_INN.walls,
  tokens: [
    ...Object.entries(state.players()).map(([id, p]) => ({
      x: p.x, y: p.y,
      type: 'player' as const,
      id,
      label: id,
      isMe: id === state.mySessionId(),
    })),
    ...state.npcs().map((n) => ({
      x: n.x, y: n.y,
      type: 'npc' as const,
      id: n.name,
      label: n.name,
    })),
    ...state.doors().map((d) => ({
      x: d.x, y: d.y,
      type: 'door' as const,
      id: d.label,
      label: d.label,
    })),
  ],
})

// In JSX:
<PlaysetBoard
  mode="explore"
  roomId="inn"
  exploreMap={exploreMap()}
  onCellClick={handleCellClick}
/>
```

`handleCellClick` logic is unchanged — check adjacency, route to `state.move()` or `state.interact()`.

### NPC/Door dialog via click-comics

Define `Panel[]` arrays for each NPC and the door in ExploreScreen (plain static data, no server round-trip):

```typescript
const NPC_PANELS: Record<string, Panel[]> = {
  innkeeper: [
    { speaker: 'Innkeeper', text: 'Welcome to the Inn! Your heroes rest and recover here between runs.' },
  ],
  blacksmith: [
    { speaker: 'Blacksmith', text: 'I can help you equip your heroes when gear equipping arrives.' },
  ],
  doorkeeper: [
    { speaker: 'Doorkeeper', text: 'Ready to venture out? Walk up to the door when your party is ready.' },
  ],
}

const DOOR_PANELS: Panel[] = [
  { speaker: 'Door', text: 'Biome exploration is coming in the next update.' },
]
```

On `state.interaction()` becoming non-null:
- Look up the NPC role or door label → get `Panel[]`
- Render `<ComicPlayer panels={...} onComplete={state.dismissInteraction} />` as an overlay above the board

Remove the existing inline interaction dialog JSX from ExploreScreen.

---

## click-comics Integration

`ComicPlayer` already exists in `apps/game/src/components/ComicPlayer.tsx`. It accepts `panels: Panel[]` and renders them via the click-comics engine. No changes needed to ComicPlayer itself.

`Panel` type from `packages/click-comics/`:
```typescript
type Panel = {
  image?: string
  text: string
  speaker?: string
  duration?: number
  choices?: Choice[]  // unused for linear dialog
}
```

---

## InnView Removal

Delete `apps/game/src/screens/InnView.tsx` once PlaysetBoard explore mode is working and verified in browser.

---

## Testing

**`packages/playsets/` unit tests:**
- Given a 3×3 walls grid with corners true, assert 5 floor meshes and 4 wall meshes are created
- Given 2 tokens, assert 2 cylinder meshes exist after token sync effect

**`apps/game/` unit tests:**
- `exploreMap()` derivation: given mock players/npcs/doors state, assert correct `ExploreToken[]` output
- NPC_PANELS: assert each key has at least one panel with non-empty `text`

**Manual smoke test in browser:**
- Player visible on 3D board, moves on tile click
- Adjacent NPC click opens comic panel, close button dismisses
- Adjacent door click opens comic panel, close button dismisses
- Character sheet toggle still works

---

## Out of Scope

- Sprite/image assets for tokens (colored primitives only for this milestone)
- Asset management system (separate design needed)
- Camera rotation controls
- Multi-story / layer system (being developed in parallel playsets session)
- Branching dialog choices
