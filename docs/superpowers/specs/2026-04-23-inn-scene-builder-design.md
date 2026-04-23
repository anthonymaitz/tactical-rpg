# Inn Scene + Builder — Design Spec

**Sub-project 2 of 4** in the Playsets + Inn walking skeleton series.

Sub-projects in order:
1. Playsets Web Component — done
2. **This spec** — Inn Scene + Builder
3. Enemy + Proximity Combat — enemy entity, adjacency detection, transition to CombatScreen
4. Combat Integration — CombatScreen with Playsets + SimpleQuest, rules-engine resolution

---

## Goal

Replace the hardcoded `THE_INN.walls` scene with a designer-authored scene stored in Supabase. Add an in-game builder route (`/build/:slug`) where developers (and eventually players) can paint walls, place props, configure layers and weather, then save. ExploreRoom loads the saved scene on join and sends it to clients.

---

## Architecture overview

```
BuildScreen (/build/:slug)
  └─ PlaysetBoard mode="build"
       └─ playsets-board web component (mode="build")
            ├─ PlaysetsBoardRoot  ← canvas + babylon managers
            └─ BuilderRoot (lazy) ← SolidJS overlay UI
                 ├─ BuilderToolbar  (tile/prop picker)
                 └─ LayerPanel      (layer visibility + background)

ExploreScreen
  └─ PlaysetBoard mode="explore"
       └─ playsets-board web component (mode="explore")
            └─ PlaysetsBoardRoot  ← canvas only, no builder code loaded
```

---

## Data model

### Supabase — `scenes` table

```sql
CREATE TABLE scenes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        UNIQUE NOT NULL,
  scene_data JSONB       NOT NULL DEFAULT '{}',
  created_by UUID        REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Read: any authenticated user
-- Write: row owner only (created_by = auth.uid())
CREATE POLICY "scenes_read"  ON scenes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "scenes_write" ON scenes FOR ALL    USING (created_by = auth.uid());
```

`scene_data` shape (extends sub-project 1 spec with `tokens`):
```json
{
  "buildings": [{ "col": 0, "row": 0, "tileId": "wall-wood" }],
  "layers":    [{ "id": 1, "background": "grass" }],
  "props":     [{ "id": "door-1", "col": 5, "row": 3, "tileId": "door-wood" }],
  "weather":   "sunny",
  "tokens": [
    { "id": "innkeeper",   "type": "npc",  "role": "innkeeper",  "name": "Innkeeper",        "col": 10, "row": 2 },
    { "id": "door-forest", "type": "door", "biomeId": "verdant-forest", "label": "Verdant Forest", "col": 16, "row": 12 }
  ]
}
```

`tokens` entries carry enough data for both rendering (position) and ExploreRoom entity setup (role, biomeId, label). NPC and door positions are no longer hardcoded in `THE_INN` — they come from the saved scene.

Slugs are human-readable identifiers: `"inn-main"`, `"forest-clearing"`, `"dungeon-entrance"`. The inn uses `"inn-main"` by default.

---

## Routing

The game app currently has no URL router. Add `@solidjs/router` to `apps/game/`:
- `/` → ConnectScreen (existing)
- `/inn` → ExploreScreen (existing flow, post-connect)
- `/build/:slug` → BuildScreen (new, auth-gated)

URL routing is needed so the builder can be bookmarked and later shared with players. `App.tsx` is refactored to use `<Router>` from `@solidjs/router`.

---

## New files

### `apps/game/src/`
```
services/scene-service.ts     ← fetchScene(slug), upsertScene(slug, data)
screens/BuildScreen.tsx        ← builder route component
```

### `packages/playsets experiments/apps/client/src/`
```
builder/
  BuilderRoot.tsx              ← lazy-loaded parent, wires toolbar + managers
  BuilderToolbar.tsx           ← left sidebar: tile/prop picker
  LayerPanel.tsx               ← bottom panel: layer + weather
```

---

## Web component builder UI

### Lazy loading

`PlaysetsBoardRoot` dynamically imports `BuilderRoot` only when `mode === 'build'`:

```tsx
const BuilderRoot = lazy(() => import('./builder/BuilderRoot'))

<Show when={props.mode === 'build'}>
  <Suspense>
    <BuilderRoot host={props.host} scene={props.scene} bjsScene={bjsScene} ... />
  </Suspense>
</Show>
```

Explorer and combat sessions never load builder code.

### Babylon managers in build mode

In addition to `BuildingManager` (already present in explore mode), build mode initialises:

- `PropManager` — click-to-place props (furniture, decorations)
- `SpriteManager` — place and render NPC/door tokens as sprites
- `DragController` — drag any placed sprite or prop to reposition it
- `LayerBackgroundManager` — layer backgrounds driven by LayerPanel
- `WeatherSystem` — weather selection

These are instantiated in `onMount` and passed to `BuilderRoot` as props, only when `mode === 'build'`. They are disposed in `onCleanup`.

`DragController` is wired with:

- `onDragDrop(instanceId, col, row)` → updates the token/prop position in the builder's in-memory state
- `canDrop(col, row)` → returns true only for walkable cells (no walls)

**Not in scope for sub-project 2:** `RoofManager`.

### BuilderToolbar

Left sidebar overlay (positioned `absolute` over the canvas via CSS). Contains:

- Tab strip: Walls | Floors | Props | Tokens
- Tile/token grid: thumbnails from the tile manifest JSON (embedded in the bundle)
- Selected item highlighted; clicking a canvas cell places it
- Tokens tab lists placeable NPC types (innkeeper, blacksmith, doorkeeper) and door — clicking places a sprite via `SpriteManager`; dragging a placed token repositions it via `DragController`

### LayerPanel

Bottom bar overlay. Controls:
- Layer visibility toggles (layers 1–9)
- Layer background selector (grass / dirt / transparent)
- Weather dropdown (sunny / cloudy / night / rain)

### scenechange event

Fired when the user clicks **Save** in the builder toolbar. The builder assembles the current state from all managers into the `scene_data` shape and dispatches:

```typescript
host.dispatchEvent(new CustomEvent('scenechange', {
  bubbles: true,
  detail: { scene: { buildings, layers, props, tokens, weather } },
}))
```

The game app's `BuildScreen` listens for this event and calls `upsertScene`.

---

## `scene-service.ts`

```typescript
import { supabase } from '../lib/supabase'

export async function fetchScene(slug: string): Promise<SceneData | null>
export async function upsertScene(slug: string, data: SceneData): Promise<void>
```

Both functions use the existing Supabase client already configured in the game app.

---

## `BuildScreen.tsx`

```
/build/:slug  (e.g. /build/inn-main)
```

1. On mount: calls `fetchScene(slug)` → sets `scene()` signal (empty `{}` if not found)
2. Renders `<playsets-board>` web component directly (no `PlaysetBoard` SolidJS wrapper — the builder needs no mode switching between explore/combat/build)
3. Listens for `scenechange` on the board element ref
4. On `scenechange`: calls `upsertScene(slug, detail.scene)`, shows "Saving…" / "Saved ✓" status
5. Auth gate: if no token in context, redirects to `/` (ConnectScreen)

The slug comes from `useParams()` from `@solidjs/router`.

---

## ExploreRoom changes

The slug is hardcoded in `ExploreRoom` for sub-project 2 (`'inn-main'`). Future rooms pass their slug via room definition config in `game-server.ts`, not from the client (clients must not control which scene loads — that is a security boundary).

```typescript
// onCreate — fetch scene by slug using the server-side Supabase client (db/supabase.ts)
const SCENE_SLUG = 'inn-main'
const { data } = await supabase.from('scenes').select('scene_data').eq('slug', SCENE_SLUG).single()
this._sceneData = data?.scene_data ?? generateSceneFromInn(THE_INN)
```

`generateSceneFromInn(inn: InnMap): SceneData` converts `THE_INN.walls`, `.npcs`, and `.doors` to the full `scene_data` format — the fallback if Supabase has no saved scene yet. Lives in `server/src/rooms/logic/scene-utils.ts`.

`ExploreRoom.onCreate` populates `ExploreState` NPCs and doors from `scene_data.tokens` instead of `THE_INN.npcs` / `THE_INN.doors`:

```typescript
for (const token of this._sceneData.tokens) {
  if (token.type === 'npc') {
    const entity = new NpcEntity()
    entity.id = token.id; entity.name = token.name ?? ''; entity.role = token.role ?? ''
    entity.x = token.col; entity.y = token.row
    this.state.npcs.push(entity)
  } else if (token.type === 'door') {
    const entity = new DoorEntity()
    entity.id = token.id; entity.biomeId = token.biomeId ?? ''; entity.label = token.label ?? ''
    entity.x = token.col; entity.y = token.row
    this.state.doors.push(entity)
  }
}
```

The hardcoded `THE_INN.npcs` / `THE_INN.doors` loops in `onCreate` are removed.

```typescript
// READY handler — send alongside HERO_STATE
client.send('SCENE_STATE', this._sceneData)
```

No schema changes to `ExploreState` — scene data is a one-time message, not ongoing state.

---

## `useExploreRoom` changes

Add a `sceneData` signal. Handle `SCENE_STATE` message:

```typescript
const [sceneData, setSceneData] = createSignal<SceneData | null>(null)

r.onMessage('SCENE_STATE', (data: SceneData) => {
  setSceneData(data)
})
```

Return `sceneData` from the hook.

---

## `ExploreScreen` changes

`exploreMap()` currently hard-codes `THE_INN.walls` for buildings. After this change:

```typescript
const sceneJson = createMemo(() => {
  const sd = state.sceneData()
  if (sd) return JSON.stringify(sd)
  // fallback: generate from THE_INN until SCENE_STATE arrives
  return generateSceneFromInn(THE_INN)
})
```

Pass `sceneJson()` to `<PlaysetBoard attr:scene={sceneJson()} />`. The entities (players, NPCs, doors) continue to come from Colyseus state.

---

## `SceneData` type — shared-types

Both the game app and server reference `SceneData`. It is added to `packages/shared-types/src/`:

```typescript
export interface SceneBuilding { col: number; row: number; tileId: string; instanceId?: string }
export interface SceneLayer    { id: number; background: string }
export interface SceneProp     { id: string; col: number; row: number; tileId: string }
export interface SceneToken {
  id: string
  type: 'npc' | 'door'
  col: number
  row: number
  // npc fields
  role?: 'innkeeper' | 'blacksmith' | 'doorkeeper'
  name?: string
  // door fields
  biomeId?: string
  label?: string
}

export interface SceneData {
  buildings: SceneBuilding[]
  layers:    SceneLayer[]
  props:     SceneProp[]
  tokens:    SceneToken[]
  weather:   string
}
```

`PlaysetsBoardRoot.tsx`'s existing `SceneData` interface is replaced with an import from `shared-types`.

---

## PlaysetBoard / web component attr changes

`ExploreBoard` in `PlaysetBoard.tsx` already has `attr:scene` from sub-project 1. No changes needed there. `PlaysetBoard.tsx` does not get a build mode — `BuildScreen` uses the web component directly.

---

## What is not in scope

- Roof placement (RoofManager) — deferred
- Player access to builder — RLS policy change only, no code work when the time comes
- Procedural generation — sub-project 3+
- Multiple scenes per room instance — slug is static config for now
