# Playsets Web Component — Design Spec

**Sub-project 1 of 4** in the Playsets + Inn walking skeleton series.

Sub-projects in order:
1. **This spec** — Playsets Web Component (SolidJS wrapping `babylon/` managers)
2. Inn Scene + Builder — build the inn interactively, save as JSON, load on room join
3. Enemy + Proximity Combat — enemy entity, adjacency detection, transition to CombatScreen
4. Combat Integration — CombatScreen with Playsets + SimpleQuest, rules-engine resolution

---

## Goal

Replace the simple `board-element.ts` (boxes + cylinders) with a full-featured `<playsets-board>` custom element powered by the existing `babylon/` rendering system in the Playsets experiments repo. The component renders isometric scenes from injected JSON data, exposes a builder UI when in build mode, and fires events the game app uses to coordinate multiplayer state.

## Architecture

The `babylon/` managers (BuildingManager, SpriteManager, DragController, LayerManager, PropManager, RoofManager, WeatherManager, etc.) are pure TypeScript classes with no framework dependencies. They stay completely unchanged.

The new work is the SolidJS UI layer that replaces the existing React + Zustand layer in `RoomPage.tsx`.

### File structure (Playsets experiments repo)

```
apps/client/src/
  board-element.ts          ← replaced: bootstraps SolidJS via createRoot
  PlaysetsBoardRoot.tsx     ← SolidJS root component (replaces RoomPage.tsx)
  stores/
    scene.ts                ← { layers, buildings, props, weather }
    entities.ts             ← { entities: Entity[] }
    ui.ts                   ← { mode, selectedTool, selectedTileId }
  ui/
    BuilderToolbar.tsx      ← SolidJS builder overlay (replaces React UI panels)
    TokenPalette.tsx        ← token type picker for builder mode
  babylon/                  ← unchanged (all 20+ manager files)
```

### Custom element bootstrap

`connectedCallback` in `board-element.ts`:
1. Creates an inner `div` container and appends it to the element
2. Calls `render(() => <PlaysetsBoardRoot host={this} />, container)` from `solid-js/web` — returns a `dispose` function stored on the class
3. `observedAttributes` returns `['scene', 'entities', 'mode']`; `attributeChangedCallback` parses the new value and updates the relevant store via a store setter passed as context

`disconnectedCallback`: calls the stored `dispose()` (tears down the SolidJS reactive graph) and calls `dispose()` on all babylon/ managers.

### Reactive wiring in PlaysetsBoardRoot

Babylon/ managers are instantiated in `onMount`. SolidJS effects drive them when stores change:

```typescript
onMount(() => {
  buildingManager = new BuildingManager(scene)
  spriteManager   = new SpriteManager(scene)
  dragController  = new DragController(scene, spriteManager)
  layerManager    = new LayerManager(scene)
  weatherManager  = new WeatherManager(scene)
  propManager     = new PropManager(scene)

  dragController.onCellCross = (id, x, y) =>
    host.dispatchEvent(new CustomEvent('tokendrag', { bubbles: true, detail: { id, x, y } }))

  dragController.onDrop = (id, x, y) =>
    host.dispatchEvent(new CustomEvent('tokenmove', { bubbles: true, detail: { id, x, y } }))
})

createEffect(() => buildingManager?.load(sceneStore.buildings))
createEffect(() => spriteManager?.sync(entityStore.entities))
createEffect(() => weatherManager?.set(sceneStore.weather))
createEffect(() => layerManager?.configure(sceneStore.layers))
createEffect(() => propManager?.load(sceneStore.props))
```

The builder toolbar is a SolidJS component rendered as a DOM overlay on the canvas, visible only when `uiStore.mode === 'build'`. Tile placement mutates the scene store and dispatches `scenechange` on the host element.

---

## External API

### Attributes

| Attribute  | Type   | Updates    | Description |
|------------|--------|------------|-------------|
| `mode`     | string | rarely     | `explore` \| `build` \| `combat` |
| `scene`    | JSON   | rarely     | Full structural definition of the map |
| `entities` | JSON   | frequently | All live tokens and their positions |

**`scene` shape:**
```json
{
  "layers":    [{ "id": 1, "background": "grass" }],
  "buildings": [{ "col": 0, "row": 0, "tileId": "wall-ns" }],
  "props":     [{ "id": "door-1", "col": 5, "row": 3, "tileId": "door" }],
  "weather":   "none"
}
```

**`entities` shape:**
```json
[
  { "id": "session-abc", "type": "player", "x": 10, "y": 7, "isMe": true },
  { "id": "innkeeper",   "type": "npc",    "x": 4,  "y": 2, "label": "Innkeeper" },
  { "id": "goblin-1",   "type": "enemy",  "x": 12, "y": 5, "label": "Goblin" }
]
```

### Events

| Event         | Detail              | When |
|---------------|---------------------|------|
| `cellclick`   | `{ x, y }`          | Player clicks a floor tile |
| `tokendrag`   | `{ id, x, y }`      | Token crosses a new grid cell mid-drag (once per cell, not per frame) |
| `tokenmove`   | `{ id, x, y }`      | Drag resolves on drop (authoritative move request) |
| `scenechange` | `{ scene }`         | Builder modifies the map; full scene JSON in detail |
| `error`       | `{ reason }`        | WebGL unavailable or unrecoverable failure |

### Real-time drag flow

`tokendrag` is fire-and-forget — the game app sends `DRAG_UPDATE` to Colyseus, the server broadcasts to all clients, each client updates its `entities` attribute with the dragging token's current position. No validation.

`tokenmove` goes through the existing MOVE validation on the server. If rejected, the schema sync snaps the token back to the authoritative position.

### Encounter detection

`encounter` detection is **not** in the component. The game app's `MOVE` handler on the server detects when a player moves adjacent to an enemy entity and fires `ENCOUNTER` back to the client. The component only renders what it is given.

---

## Lib build

The component continues to build as a Vite library (`vite.lib.config.ts`) producing `dist/playsets-board.mjs`. The game app imports it as a workspace package.

**Game app changes required (in `packages/playsets/src/PlaysetBoard.tsx`):**

- Rename `attr:walls` → `attr:scene` (JSON shape changes from `number[][]` to the full scene object)
- Rename `attr:tokens` → `attr:entities` (JSON shape changes from the old Token array to the new Entity array)
- Add `attr:mode` binding
- The `ExploreBoard` component in `PlaysetBoard.tsx` constructs the scene and entities JSON from the Colyseus room state and `THE_INN` data

**DRAG_UPDATE Colyseus handler** (required for real-time tokendrag): ExploreRoom needs `onMessage('DRAG_UPDATE', (client, { id, x, y }) => this.broadcast('DRAG_UPDATE', { id, x, y }, { except: client }))`. This is a game-side task included in this sub-project's scope since tokendrag is part of the component API.

---

## Testing

The store layer and event dispatching are testable without WebGL:
- Mock all babylon/ managers with vitest stubs
- Mount the component in jsdom, set attributes via `setAttribute`
- Assert stores updated and the correct manager method was called with the correct arguments
- Assert CustomEvents dispatched with the correct detail payloads

Visual correctness is verified manually by running the Playsets demo app and the game app in dev mode.

---

## Error handling

- Invalid JSON in `scene` or `entities` → `console.warn`, keep previous store state
- WebGL unavailable → dispatch `error` event with `{ reason: 'webgl-unavailable' }` so the game app can show a fallback
- Builder produces disconnected rooms → existing `buildings.ts` connectivity check shows an inline warning in the builder overlay; no event dispatched to the host (internal builder concern)

---

## What is not in scope

- Inn scene data definition (sub-project 2)
- Enemy entity placement (sub-project 3)
- Combat integration (sub-project 4)
- Persistence of scene data (sub-project 2)
- Server-side proximity detection (sub-project 3)
