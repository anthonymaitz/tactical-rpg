# Inn Scene + Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded THE_INN walls with a Supabase-stored scene, add a `/build/:slug` route where developers can paint walls, place props and tokens, then save.

**Architecture:** SceneData type lives in shared-types. ExploreRoom fetches scene JSON from Supabase on create and sends it to clients via SCENE_STATE. The game app gains @solidjs/router with a BuildScreen at `/build/:slug`. The playsets-board web component gains lazy-loaded builder UI (BuilderRoot + BuilderToolbar + LayerPanel) active only when `mode="build"`, using existing babylon/ manager classes (BuildingManager, PropManager, SpriteManager, DragController, WeatherSystem, LayerBackgroundManager). On Save, the builder fires a `scenechange` CustomEvent; BuildScreen listens and calls upsertScene.

**Tech Stack:** SolidJS, BabylonJS 7, Colyseus 0.15, Supabase, @solidjs/router, shared-types workspace package, vitest

---

## File Map

**New files:**
- `packages/shared-types/src/scene-data.ts` — SceneData interfaces + generateSceneFromInn()
- `packages/shared-types/src/__tests__/scene-data.test.ts` — tests for generateSceneFromInn
- `apps/game/src/session.ts` — module-level token/heroIds signals
- `apps/game/src/services/scene-service.ts` — fetchScene / upsertScene via Supabase
- `apps/game/src/screens/BuildScreen.tsx` — /build/:slug route component
- `playsets experiments/apps/client/src/builder/BuilderRoot.tsx` — lazy-loaded builder parent, wires managers + events
- `playsets experiments/apps/client/src/builder/BuilderToolbar.tsx` — left sidebar: tab strip + tile grid + Save
- `playsets experiments/apps/client/src/builder/LayerPanel.tsx` — bottom bar: layer visibility, background, weather

**Modified files:**
- `packages/shared-types/src/index.ts` — re-export from scene-data.ts
- `apps/game/src/App.tsx` — add @solidjs/router, routes for /inn and /build/:slug
- `apps/game/src/screens/ConnectScreen.tsx` — call navigate('/inn') after connect
- `apps/game/src/screens/ExploreScreen.tsx` — use sceneData from hook, compute sceneJson
- `apps/game/src/hooks/useExploreRoom.ts` — add sceneData signal + SCENE_STATE handler
- `packages/playsets/src/types.ts` — add sceneJson prop to PlaysetBoardProps
- `packages/playsets/src/PlaysetBoard.tsx` — ExploreBoard uses sceneJson when provided
- `playsets experiments/apps/client/src/PlaysetsBoardRoot.tsx` — build mode: skip syncBuildings/syncEntities, instantiate managers, lazy-load BuilderRoot
- `server/src/rooms/ExploreRoom.ts` — fetch scene from Supabase, load tokens from scene_data, send SCENE_STATE

---

## Task 1: SceneData type + generateSceneFromInn in shared-types

**Files:**
- Create: `packages/shared-types/src/scene-data.ts`
- Create: `packages/shared-types/src/__tests__/scene-data.test.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared-types/src/__tests__/scene-data.test.ts
import { describe, it, expect } from 'vitest'
import { generateSceneFromInn } from '../scene-data'
import { THE_INN } from '../inn-map'

describe('generateSceneFromInn', () => {
  it('converts wall cells to SceneBuilding entries', () => {
    const scene = generateSceneFromInn(THE_INN)
    const wallCount = THE_INN.walls.flat().filter(v => v === 1).length
    expect(scene.buildings).toHaveLength(wallCount)
    expect(scene.buildings[0]).toMatchObject({ tileId: 'wall-wood' })
  })

  it('converts npcs to npc tokens', () => {
    const scene = generateSceneFromInn(THE_INN)
    const npcTokens = scene.tokens.filter(t => t.type === 'npc')
    expect(npcTokens).toHaveLength(THE_INN.npcs.length)
    expect(npcTokens[0]).toMatchObject({
      type: 'npc',
      id: THE_INN.npcs[0].id,
      col: THE_INN.npcs[0].x,
      row: THE_INN.npcs[0].y,
      role: THE_INN.npcs[0].role,
      name: THE_INN.npcs[0].name,
    })
  })

  it('converts doors to door tokens', () => {
    const scene = generateSceneFromInn(THE_INN)
    const doorTokens = scene.tokens.filter(t => t.type === 'door')
    expect(doorTokens).toHaveLength(THE_INN.doors.length)
    expect(doorTokens[0]).toMatchObject({
      type: 'door',
      id: THE_INN.doors[0].id,
      biomeId: THE_INN.doors[0].biomeId,
    })
  })

  it('returns defaults for layers, props, weather', () => {
    const scene = generateSceneFromInn(THE_INN)
    expect(scene.layers).toEqual([{ id: 1, background: 'grass' }])
    expect(scene.props).toEqual([])
    expect(scene.weather).toBe('sunny')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter shared-types test
```

Expected: FAIL — "Cannot find module '../scene-data'"

- [ ] **Step 3: Create scene-data.ts**

```typescript
// packages/shared-types/src/scene-data.ts
import type { InnMap } from './inn-map'

export interface SceneBuilding {
  col: number
  row: number
  tileId: string
  instanceId?: string
}

export interface SceneLayer {
  id: number
  background: string
}

export interface SceneProp {
  id: string
  col: number
  row: number
  tileId: string
}

export interface SceneToken {
  id: string
  type: 'npc' | 'door'
  col: number
  row: number
  role?: 'innkeeper' | 'blacksmith' | 'doorkeeper'
  name?: string
  biomeId?: string
  label?: string
}

export interface SceneData {
  buildings: SceneBuilding[]
  layers: SceneLayer[]
  props: SceneProp[]
  tokens: SceneToken[]
  weather: string
}

export function generateSceneFromInn(inn: InnMap): SceneData {
  const buildings: SceneBuilding[] = []
  for (let row = 0; row < inn.walls.length; row++) {
    for (let col = 0; col < (inn.walls[row]?.length ?? 0); col++) {
      if (inn.walls[row][col] === 1) {
        buildings.push({ col, row, tileId: 'wall-wood', instanceId: `${col},${row}` })
      }
    }
  }

  const tokens: SceneToken[] = [
    ...inn.npcs.map(npc => ({
      id: npc.id,
      type: 'npc' as const,
      col: npc.x,
      row: npc.y,
      role: npc.role,
      name: npc.name,
    })),
    ...inn.doors.map(door => ({
      id: door.id,
      type: 'door' as const,
      col: door.x,
      row: door.y,
      biomeId: door.biomeId,
      label: door.label,
    })),
  ]

  return {
    buildings,
    layers: [{ id: 1, background: 'grass' }],
    props: [],
    tokens,
    weather: 'sunny',
  }
}
```

- [ ] **Step 4: Export from shared-types index**

In `packages/shared-types/src/index.ts`, add at the bottom:
```typescript
export * from './scene-data'
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter shared-types test
```

Expected: All tests PASS

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types/src/scene-data.ts packages/shared-types/src/__tests__/scene-data.test.ts packages/shared-types/src/index.ts
git commit -m "feat: add SceneData types and generateSceneFromInn to shared-types"
```

---

## Task 2: Supabase scenes table (manual)

**No code.** Run in the Supabase SQL editor at https://supabase.com/dashboard/project/rmmdtegsomzejjioolre/sql/new

- [ ] **Step 1: Create table and RLS policies**

```sql
CREATE TABLE IF NOT EXISTS scenes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        UNIQUE NOT NULL,
  scene_data JSONB       NOT NULL DEFAULT '{}',
  created_by UUID        REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenes_read"
  ON scenes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "scenes_write"
  ON scenes FOR ALL
  USING (created_by = auth.uid());
```

- [ ] **Step 2: Verify table exists**

In Supabase Table Editor, confirm `scenes` table is present with columns: id, slug, scene_data, created_by, updated_at.

---

## Task 3: scene-service.ts in game app

**Files:**
- Create: `apps/game/src/services/scene-service.ts`

- [ ] **Step 1: Create scene-service.ts**

```typescript
// apps/game/src/services/scene-service.ts
import { supabase } from '../lib/supabase'
import type { SceneData } from 'shared-types'

export async function fetchScene(slug: string): Promise<SceneData | null> {
  const { data, error } = await supabase
    .from('scenes')
    .select('scene_data')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return data.scene_data as SceneData
}

export async function upsertScene(slug: string, sceneData: SceneData): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('scenes').upsert(
    { slug, scene_data: sceneData, created_by: user?.id, updated_at: new Date().toISOString() },
    { onConflict: 'slug' },
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/services/scene-service.ts
git commit -m "feat: add scene-service for Supabase scene fetch/upsert"
```

---

## Task 4: Add @solidjs/router + session store + refactor App.tsx

**Files:**
- Create: `apps/game/src/session.ts`
- Modify: `apps/game/src/App.tsx`
- Modify: `apps/game/src/screens/ConnectScreen.tsx`

- [ ] **Step 1: Install @solidjs/router**

```bash
pnpm --filter game add @solidjs/router
```

Expected: package added, `package.json` updated

- [ ] **Step 2: Create session store**

```typescript
// apps/game/src/session.ts
import { createRoot, createSignal } from 'solid-js'

const { token, setToken, heroIds, setHeroIds } = createRoot(() => {
  const [token, setToken] = createSignal<string | null>(null)
  const [heroIds, setHeroIds] = createSignal<string[]>([])
  return { token, setToken, heroIds, setHeroIds }
})

export { token, setToken, heroIds, setHeroIds }
```

- [ ] **Step 3: Rewrite App.tsx with router**

Replace the entire contents of `apps/game/src/App.tsx`:

```typescript
import { lazy } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { ConnectScreen } from './screens/ConnectScreen'
import { ExploreScreen } from './screens/ExploreScreen'

const BuildScreen = lazy(() => import('./screens/BuildScreen'))

export default function App() {
  return (
    <Router>
      <Route path="/" component={ConnectScreen} />
      <Route path="/inn" component={ExploreScreen} />
      <Route path="/build/:slug" component={BuildScreen} />
    </Router>
  )
}
```

- [ ] **Step 4: Update ConnectScreen to use session store + navigate**

In `apps/game/src/screens/ConnectScreen.tsx`, find the `onConnect` prop usage. Replace the component signature and connect callback:

Find the prop type at the top:
```typescript
type Props = { onConnect: (token: string, heroIds: string[]) => void }
```

Replace with:
```typescript
import { useNavigate } from '@solidjs/router'
import { setToken, setHeroIds } from '../session'
```

Change the component signature and find where `props.onConnect` is called (in the "Go to Inn" or login success handler). Replace every call to `props.onConnect(tok, ids)` with:
```typescript
setToken(tok)
setHeroIds(ids)
navigate('/inn')
```

Add `const navigate = useNavigate()` inside the component body.

Remove the `Props` type and `props` parameter from the function signature:
```typescript
export function ConnectScreen() {
  const navigate = useNavigate()
  // ... rest unchanged ...
}
```

- [ ] **Step 5: Update ExploreScreen to read from session store**

In `apps/game/src/screens/ExploreScreen.tsx`, change the component signature:

Find:
```typescript
interface ExploreScreenProps {
  token?: string | null
  heroIds?: string[]
}

export function ExploreScreen(props: ExploreScreenProps) {
  const state = createExploreRoom(
    () => props.token ?? null,
    () => props.heroIds ?? [],
  )
```

Replace with:
```typescript
import { token, heroIds } from '../session'

export function ExploreScreen() {
  const state = createExploreRoom(token, heroIds)
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0. Fix any remaining type errors from the prop removal.

- [ ] **Step 7: Run tests**

```bash
pnpm test
```

Expected: all tests pass. The `App.test.tsx` may need updating if it mounts `<App />` directly — verify and update if needed.

- [ ] **Step 8: Commit**

```bash
git add apps/game/src/session.ts apps/game/src/App.tsx apps/game/src/screens/ConnectScreen.tsx apps/game/src/screens/ExploreScreen.tsx apps/game/package.json pnpm-lock.yaml
git commit -m "feat: add @solidjs/router with /inn and /build/:slug routes"
```

---

## Task 5: BuildScreen.tsx

**Files:**
- Create: `apps/game/src/screens/BuildScreen.tsx`

- [ ] **Step 1: Create BuildScreen**

```typescript
// apps/game/src/screens/BuildScreen.tsx
import { createSignal, onMount } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { token } from '../session'
import { fetchScene, upsertScene } from '../services/scene-service'
import 'playsets-board'
import type { SceneData } from 'shared-types'
import { generateSceneFromInn } from 'shared-types'
import { THE_INN } from 'shared-types'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'playsets-board': {
        ref?: HTMLElement
        'attr:scene'?: string
        'attr:entities'?: string
        'attr:mode'?: string
        style?: string
      }
    }
  }
}

export default function BuildScreen() {
  const params = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [saveStatus, setSaveStatus] = createSignal<'idle' | 'saving' | 'saved'>('idle')
  const [sceneJson, setSceneJson] = createSignal<string>(
    JSON.stringify(generateSceneFromInn(THE_INN)),
  )
  let boardEl!: HTMLElement

  onMount(async () => {
    if (!token()) {
      navigate('/')
      return
    }

    const data = await fetchScene(params.slug)
    if (data) {
      setSceneJson(JSON.stringify(data))
    }

    boardEl.addEventListener('scenechange', async (e: Event) => {
      const { scene } = (e as CustomEvent<{ scene: SceneData }>).detail
      setSaveStatus('saving')
      await upsertScene(params.slug, scene)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    })
  })

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div style={{ position: 'absolute', top: '8px', right: '12px', 'z-index': '10', color: '#fff', 'font-size': '12px' }}>
        {saveStatus() === 'saving' ? 'Saving…' : saveStatus() === 'saved' ? 'Saved ✓' : `Editing: ${params.slug}`}
      </div>
      <playsets-board
        ref={boardEl}
        attr:scene={sceneJson()}
        attr:entities="[]"
        attr:mode="build"
        style="width:100%;height:100%;display:block;"
      />
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/screens/BuildScreen.tsx
git commit -m "feat: add BuildScreen at /build/:slug"
```

---

## Task 6: PlaysetsBoardRoot — build mode managers + lazy BuilderRoot

**Files:**
- Modify: `playsets experiments/apps/client/src/PlaysetsBoardRoot.tsx`

The goal: when `mode === 'build'`, skip syncBuildings/syncEntities (BuilderRoot owns rendering), instantiate all build managers, and render BuilderRoot lazily. Keep explore mode unchanged.

- [ ] **Step 1: Read current PlaysetsBoardRoot.tsx**

Read `playsets experiments/apps/client/src/PlaysetsBoardRoot.tsx` to confirm current state before editing.

- [ ] **Step 2: Replace PlaysetsBoardRoot.tsx**

Write the new content:

```tsx
// playsets experiments/apps/client/src/PlaysetsBoardRoot.tsx
import { createEffect, on, onMount, onCleanup, lazy, Suspense, Show } from 'solid-js'
import { PointerEventTypes } from '@babylonjs/core'
import type { Scene, Engine, ArcRotateCamera, Mesh } from '@babylonjs/core'
import { MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core'
import { createScene } from './babylon/scene'
import { createGrid, worldToCell } from './babylon/grid'
import { BuildingManager } from './babylon/buildings'
import { PropManager } from './babylon/props'
import { SpriteManager } from './babylon/sprites'
import { DragController } from './babylon/drag'
import { WeatherSystem } from './babylon/weather'
import { LayerBackgroundManager } from './babylon/layers'
import type { SceneData } from 'shared-types'

const BuilderRoot = lazy(() => import('./builder/BuilderRoot'))

export interface EntityData {
  id: string
  type: 'player' | 'npc' | 'enemy' | 'door'
  x: number
  y: number
  isMe?: boolean
  label?: string
}

interface Props {
  host: HTMLElement
  canvas: HTMLCanvasElement
  scene: SceneData
  entities: EntityData[]
  mode: string
}

const ENTITY_COLORS: Record<string, Color3> = {
  player_me: new Color3(1.0, 0.60, 0.0),
  player:    new Color3(0.29, 0.50, 0.76),
  npc:       new Color3(0.29, 0.50, 0.76),
  enemy:     new Color3(0.88, 0.33, 0.33),
  door:      new Color3(0.30, 0.69, 0.31),
}

const WALL_COLOR = new Color3(0.5, 0.42, 0.35)
const FLOOR_COLOR = new Color3(0.72, 0.65, 0.52)

export interface BuildManagers {
  buildingManager: BuildingManager
  propManager: PropManager
  spriteManager: SpriteManager
  dragController: DragController
  weatherSystem: WeatherSystem
  layerBackgroundManager: LayerBackgroundManager
  bjsScene: Scene
  bjsCamera: ArcRotateCamera
}

export function PlaysetsBoardRoot(props: Props) {
  let bjsEngine: Engine | null = null
  let bjsScene: Scene | null = null
  let bjsCamera: ArcRotateCamera | null = null
  let buildingMeshes = new Map<string, Mesh>()
  const entityMeshes = new Map<string, Mesh>()
  let buildManagers: BuildManagers | null = null
  let dragging: { entityId: string; lastCol: number; lastRow: number } | null = null

  function syncBuildings(sceneData: SceneData) {
    if (!bjsScene) return
    for (const m of buildingMeshes.values()) { m.material?.dispose(); m.dispose() }
    buildingMeshes.clear()
    for (const b of sceneData.buildings ?? []) {
      const key = b.instanceId ?? `${b.col},${b.row}`
      const isWall = !b.tileId.includes('floor')
      const mesh = MeshBuilder.CreateBox(
        `building-${key}`,
        { width: 1, height: isWall ? 2 : 0.1, depth: 1 },
        bjsScene,
      )
      mesh.position = new Vector3(b.col, isWall ? 1 : 0, b.row)
      mesh.isPickable = false
      const mat = new StandardMaterial(`bmat-${key}`, bjsScene)
      mat.diffuseColor = isWall ? WALL_COLOR : FLOOR_COLOR
      mesh.material = mat
      buildingMeshes.set(key, mesh)
    }
  }

  function syncEntities(entities: EntityData[]) {
    if (!bjsScene) return
    const seen = new Set<string>()
    for (const e of entities) {
      seen.add(e.id)
      let mesh = entityMeshes.get(e.id)
      if (!mesh) {
        mesh = MeshBuilder.CreateCylinder(
          `entity-${e.id}`,
          { diameter: 0.6, height: 0.7, tessellation: 12 },
          bjsScene,
        )
        const mat = new StandardMaterial(`emat-${e.id}`, bjsScene)
        const colorKey = e.type === 'player' && e.isMe ? 'player_me' : e.type
        mat.diffuseColor = ENTITY_COLORS[colorKey] ?? ENTITY_COLORS.npc
        mesh.material = mat
        mesh.metadata = { entityId: e.id, draggable: e.type === 'player' && e.isMe }
        entityMeshes.set(e.id, mesh)
      }
      mesh.position = new Vector3(e.x, 0.45, e.y)
    }
    for (const [id, mesh] of entityMeshes) {
      if (!seen.has(id)) { mesh.material?.dispose(); mesh.dispose(); entityMeshes.delete(id) }
    }
  }

  onMount(() => {
    try {
      const ctx = createScene(props.canvas)
      bjsEngine = ctx.engine
      bjsScene = ctx.scene
      bjsCamera = ctx.camera

      const ground = createGrid(bjsScene)

      if (props.mode !== 'build') {
        syncBuildings(props.scene)
        syncEntities(props.entities)
      } else {
        // Instantiate build mode managers
        const bm = new BuildingManager(bjsScene)
        const pm = new PropManager(bjsScene)
        const sm = new SpriteManager(bjsScene, bjsCamera)
        const ws = new WeatherSystem(bjsScene, ground, ctx.ambientLight, bjsCamera)
        const lm = new LayerBackgroundManager(bjsScene, {})
        ws.setWeather((props.scene.weather ?? 'sunny') as Parameters<WeatherSystem['setWeather']>[0])

        const dc = new DragController(bjsScene, sm, bjsCamera, {
          onDragMove: () => {},
          onDragDrop: (instanceId, col, row) => {
            props.host.dispatchEvent(
              new CustomEvent('tokenmove', { bubbles: true, detail: { id: instanceId, x: col, y: row } }),
            )
          },
          onSpriteClick: () => {},
        })

        buildManagers = { buildingManager: bm, propManager: pm, spriteManager: sm, dragController: dc, weatherSystem: ws, layerBackgroundManager: lm, bjsScene: bjsScene!, bjsCamera: bjsCamera! }

        onCleanup(() => {
          dc.dispose()
          bm.dispose()
          sm.dispose()
          lm.dispose()
        })
      }

      // Ground click — fire cellclick in both modes; entity drag only in explore mode
      bjsScene.onPointerObservable.add((info) => {
        if (props.mode === 'build') {
          // DragController handles all pointer events; just fire cellclick on up
          if (info.type === PointerEventTypes.POINTERUP) {
            const dc = buildManagers?.dragController
            if (dc?.consumeJustDropped()) return
            const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
            if (pick?.hit && pick.pickedPoint) {
              const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
              props.host.dispatchEvent(new CustomEvent('cellclick', { bubbles: true, detail: { x: col, y: row } }))
            }
          }
          return
        }

        // Explore mode pointer logic (unchanged)
        if (info.type === PointerEventTypes.POINTERUP) {
          if (dragging) {
            bjsCamera?.attachControl(true, false, 0)
            const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
            if (pick?.hit && pick.pickedPoint) {
              const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
              props.host.dispatchEvent(new CustomEvent('tokenmove', { bubbles: true, detail: { id: dragging.entityId, x: col, y: row } }))
            }
            dragging = null
          } else {
            const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
            if (pick?.hit && pick.pickedPoint) {
              const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
              props.host.dispatchEvent(new CustomEvent('cellclick', { bubbles: true, detail: { x: col, y: row } }))
            }
          }
          return
        }
        if (info.type === PointerEventTypes.POINTERDOWN) {
          const pickResult = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => !!(m.metadata?.draggable))
          if (pickResult?.pickedMesh?.metadata?.entityId) {
            const entityId = pickResult.pickedMesh.metadata.entityId as string
            const mesh = entityMeshes.get(entityId)
            if (mesh) {
              const { col, row } = worldToCell(mesh.position.x, mesh.position.z)
              dragging = { entityId, lastCol: col, lastRow: row }
              bjsCamera?.detachControl()
            }
          }
          return
        }
        if (info.type === PointerEventTypes.POINTERMOVE && dragging) {
          const pick = bjsScene!.pick(bjsScene!.pointerX, bjsScene!.pointerY, (m) => m.name === 'ground')
          if (pick?.hit && pick.pickedPoint) {
            const { col, row } = worldToCell(pick.pickedPoint.x, pick.pickedPoint.z)
            if (col !== dragging.lastCol || row !== dragging.lastRow) {
              dragging.lastCol = col; dragging.lastRow = row
              props.host.dispatchEvent(new CustomEvent('tokendrag', { bubbles: true, detail: { id: dragging.entityId, x: col, y: row } }))
            }
          }
        }
      })

      const handleResize = () => bjsEngine?.resize()
      window.addEventListener('resize', handleResize)
      onCleanup(() => {
        window.removeEventListener('resize', handleResize)
        for (const m of buildingMeshes.values()) { m.material?.dispose(); m.dispose() }
        buildingMeshes.clear()
        for (const m of entityMeshes.values()) { m.material?.dispose(); m.dispose() }
        entityMeshes.clear()
        bjsEngine?.dispose()
        bjsEngine = null
        bjsScene = null
      })
    } catch {
      props.host.dispatchEvent(new CustomEvent('error', { bubbles: true, detail: { reason: 'webgl-unavailable' } }))
    }
  })

  createEffect(on(() => props.scene, (sceneData) => {
    if (props.mode !== 'build') syncBuildings(sceneData)
  }, { defer: true }))

  createEffect(on(() => props.entities, (entities) => {
    if (props.mode !== 'build') syncEntities(entities)
  }, { defer: true }))

  return (
    <>
      <Show when={props.mode === 'build' && buildManagers !== null}>
        <Suspense>
          <BuilderRoot
            host={props.host}
            scene={props.scene}
            managers={buildManagers!}
          />
        </Suspense>
      </Show>
    </>
  )
}
```

**Note:** `createGrid` currently returns `void`. Check `babylon/scene.ts` for what it exports and whether it returns the ground mesh. If `createGrid` doesn't return the ground, add `const ground = bjsScene.getMeshByName('ground') as Mesh` after calling `createGrid`. Also check that `createScene` returns `ambientLight`; if not, access it from the scene or pass `null` to WeatherSystem.

- [ ] **Step 3: Fix createScene return type if needed**

Read `playsets experiments/apps/client/src/babylon/scene.ts`. If it doesn't return `ambientLight`, either:
a) Add it to the return object, or
b) Change WeatherSystem constructor call to pass `scene.getLightByName('ambient') as HemisphericLight`

Read `playsets experiments/apps/client/src/babylon/grid.ts`. If `createGrid` returns void, change the call to:
```typescript
createGrid(bjsScene)
const ground = bjsScene.getMeshByName('ground') as Mesh
```

- [ ] **Step 4: Check PropManager constructor**

Read `playsets experiments/apps/client/src/babylon/props.ts` top 10 lines to confirm constructor signature is `constructor(private scene: Scene)`. Adjust instantiation if different.

- [ ] **Step 5: Build the library**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments/apps/client"
pnpm build:lib
```

Expected: `dist/playsets-board.mjs` rebuilt with no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
git add -p  # stage PlaysetsBoardRoot.tsx changes
git commit -m "feat: add build mode manager setup to PlaysetsBoardRoot"
```

---

## Task 7: BuilderRoot.tsx

**Files:**
- Create: `playsets experiments/apps/client/src/builder/BuilderRoot.tsx`

BuilderRoot owns in-memory state, handles cellclick for tile/token placement, and dispatches `scenechange` on save.

- [ ] **Step 1: Create BuilderRoot.tsx**

```tsx
// playsets experiments/apps/client/src/builder/BuilderRoot.tsx
import { createSignal, onMount, onCleanup } from 'solid-js'
import type { SceneData, SceneToken, SceneBuilding } from 'shared-types'
import type { BuildManagers } from '../PlaysetsBoardRoot'
import type { BuildingTile } from '../types'
import { BuilderToolbar } from './BuilderToolbar'
import { LayerPanel } from './LayerPanel'

export type ToolTab = 'wall' | 'floor' | 'prop' | 'token'

interface Props {
  host: HTMLElement
  scene: SceneData
  managers: BuildManagers
}

const NPC_COLOR_MAP: Record<string, string> = {
  innkeeper: '#2d7a2d',
  blacksmith: '#c07020',
  doorkeeper: '#6040c0',
}

function tokenDataUri(type: string, role?: string): string {
  const color = type === 'door' ? '#cc4444' : (NPC_COLOR_MAP[role ?? ''] ?? '#4488cc')
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96"><rect width="64" height="96" rx="8" fill="${color}"/></svg>`)}`
}

export function BuilderRoot(props: Props) {
  const [selectedTab, setSelectedTab] = createSignal<ToolTab>('wall')
  const [selectedTileId, setSelectedTileId] = createSignal('wall-wood')
  const [buildings, setBuildings] = createSignal<BuildingTile[]>([])
  const [tokens, setTokens] = createSignal<SceneToken[]>([])
  const [weather, setWeather] = createSignal(props.scene.weather ?? 'sunny')

  function isWall(col: number, row: number): boolean {
    return buildings().some(b => b.col === col && b.row === row && b.tileId.includes('wall'))
  }

  onMount(() => {
    const { buildingManager, spriteManager, weatherSystem } = props.managers

    // Load initial scene
    const initBuildings: BuildingTile[] = (props.scene.buildings ?? []).map(b => ({
      instanceId: b.instanceId ?? `${b.col},${b.row}`,
      tileId: b.tileId,
      col: b.col,
      row: b.row,
    }))
    buildingManager.loadSnapshot(initBuildings)
    setBuildings(initBuildings)

    for (const t of props.scene.tokens ?? []) {
      spriteManager.place(
        { instanceId: t.id, spriteId: `tokens/${t.type}`, col: t.col, row: t.row, placedBy: 'builder' },
        tokenDataUri(t.type, t.role),
      )
    }
    setTokens(props.scene.tokens ?? [])

    weatherSystem.setWeather(weather() as Parameters<typeof weatherSystem.setWeather>[0])

    // Wire DragController canDrop
    // DragController was created with empty callbacks; update via onDragDrop on host
    props.host.addEventListener('tokenmove', handleTokenMove)

    // Ground click → place tile or token
    props.host.addEventListener('cellclick', handleCellClick)

    onCleanup(() => {
      props.host.removeEventListener('cellclick', handleCellClick)
      props.host.removeEventListener('tokenmove', handleTokenMove)
    })
  })

  function handleCellClick(e: Event) {
    const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail
    const { buildingManager, spriteManager } = props.managers
    const tab = selectedTab()

    if (tab === 'wall' || tab === 'floor') {
      const instanceId = `${x},${y}`
      const tileId = selectedTileId()
      const existing = buildings().find(b => b.col === x && b.row === y)
      if (existing) buildingManager.removeTile(existing.instanceId)
      const tile: BuildingTile = { instanceId, tileId, col: x, row: y }
      buildingManager.placeTile(tile, tileId)
      setBuildings(prev => [...prev.filter(b => !(b.col === x && b.row === y)), tile])
    } else if (tab === 'token') {
      if (isWall(x, y)) return
      const tileId = selectedTileId()
      const [tokenType, tokenRole] = tileId.split(':') as [string, string?]
      const id = `${tokenType}-${x}-${y}`
      const existing = tokens().find(t => t.col === x && t.row === y)
      if (existing) {
        spriteManager.remove(existing.id)
        setTokens(prev => prev.filter(t => t.id !== existing.id))
      }
      const token: SceneToken = {
        id,
        type: tokenType as 'npc' | 'door',
        col: x,
        row: y,
        role: tokenRole as SceneToken['role'],
        name: tokenRole,
      }
      spriteManager.place(
        { instanceId: id, spriteId: `tokens/${tokenType}`, col: x, row: y, placedBy: 'builder' },
        tokenDataUri(tokenType, tokenRole),
      )
      setTokens(prev => [...prev.filter(t => !(t.col === x && t.row === y)), token])
    }
  }

  function handleTokenMove(e: Event) {
    const { id, x, y } = (e as CustomEvent<{ id: string; x: number; y: number }>).detail
    if (isWall(x, y)) return
    setTokens(prev => prev.map(t => t.id === id ? { ...t, col: x, row: y } : t))
  }

  function handleWeatherChange(w: string) {
    setWeather(w)
    props.managers.weatherSystem.setWeather(w as Parameters<typeof props.managers.weatherSystem.setWeather>[0])
  }

  function handleSave() {
    const sceneData: SceneData = {
      buildings: buildings().map(b => ({ col: b.col, row: b.row, tileId: b.tileId, instanceId: b.instanceId })),
      layers: props.scene.layers ?? [],
      props: props.scene.props ?? [],
      tokens: tokens(),
      weather: weather(),
    }
    props.host.dispatchEvent(new CustomEvent('scenechange', { bubbles: true, detail: { scene: sceneData } }))
  }

  return (
    <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', 'pointer-events': 'none' }}>
      <BuilderToolbar
        selectedTab={selectedTab()}
        onSelectTab={setSelectedTab}
        selectedTileId={selectedTileId()}
        onSelectTileId={setSelectedTileId}
        onSave={handleSave}
      />
      <LayerPanel
        weather={weather()}
        onWeatherChange={handleWeatherChange}
        layerManager={props.managers.layerBackgroundManager}
      />
    </div>
  )
}
```

**Note:** Check that `SpriteManager` has a `remove(instanceId: string)` method. If not, use `SpriteManager.getMesh(instanceId)?.dispose()` and call `spriteManager['meshes'].delete(instanceId)` — or add a `remove` method to sprites.ts if it's missing.

- [ ] **Step 2: Run typecheck in playsets experiments**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments/apps/client"
npx tsc --noEmit
```

Expected: no errors. Fix any missing methods or type mismatches from the actual SpriteManager API.

- [ ] **Step 3: Commit**

```bash
git add "playsets experiments/apps/client/src/builder/BuilderRoot.tsx"
git commit -m "feat: add BuilderRoot with tile/token placement and scenechange dispatch"
```

---

## Task 8: BuilderToolbar.tsx

**Files:**
- Create: `playsets experiments/apps/client/src/builder/BuilderToolbar.tsx`

- [ ] **Step 1: Create BuilderToolbar.tsx**

```tsx
// playsets experiments/apps/client/src/builder/BuilderToolbar.tsx
import { For } from 'solid-js'
import type { ToolTab } from './BuilderRoot'

interface TileEntry { id: string; label: string; color: string }

const WALL_TILES: TileEntry[] = [
  { id: 'wall-wood', label: 'Wood Wall', color: '#8B4513' },
  { id: 'wall-stone', label: 'Stone Wall', color: '#888' },
]

const FLOOR_TILES: TileEntry[] = [
  { id: 'floor-wood', label: 'Wood Floor', color: '#c8a05a' },
  { id: 'floor-stone', label: 'Stone Floor', color: '#aaa' },
]

const PROP_TILES: TileEntry[] = [
  { id: 'bartop', label: 'Bar Top', color: '#7b4f1a' },
  { id: 'rug', label: 'Rug', color: '#8b2020' },
]

const TOKEN_TILES: TileEntry[] = [
  { id: 'npc:innkeeper', label: 'Innkeeper', color: '#2d7a2d' },
  { id: 'npc:blacksmith', label: 'Blacksmith', color: '#c07020' },
  { id: 'npc:doorkeeper', label: 'Doorkeeper', color: '#6040c0' },
  { id: 'door:', label: 'Door', color: '#cc4444' },
]

const TABS: { id: ToolTab; label: string }[] = [
  { id: 'wall', label: 'Walls' },
  { id: 'floor', label: 'Floors' },
  { id: 'prop', label: 'Props' },
  { id: 'token', label: 'Tokens' },
]

function tilesForTab(tab: ToolTab): TileEntry[] {
  if (tab === 'wall') return WALL_TILES
  if (tab === 'floor') return FLOOR_TILES
  if (tab === 'prop') return PROP_TILES
  return TOKEN_TILES
}

interface Props {
  selectedTab: ToolTab
  onSelectTab: (tab: ToolTab) => void
  selectedTileId: string
  onSelectTileId: (id: string) => void
  onSave: () => void
}

export function BuilderToolbar(props: Props) {
  return (
    <div style={{
      position: 'absolute', top: '0', left: '0', height: '100%', width: '160px',
      background: 'rgba(20,20,20,0.88)', display: 'flex', 'flex-direction': 'column',
      'pointer-events': 'all', 'z-index': '10',
    }}>
      <div style={{ display: 'flex', 'border-bottom': '1px solid #444' }}>
        <For each={TABS}>
          {(tab) => (
            <button
              onClick={() => { props.onSelectTab(tab.id); props.onSelectTileId(tilesForTab(tab.id)[0]?.id ?? '') }}
              style={{
                flex: '1', padding: '6px 2px', 'font-size': '10px', cursor: 'pointer',
                background: props.selectedTab === tab.id ? '#444' : 'transparent',
                color: '#fff', border: 'none',
              }}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      <div style={{ flex: '1', overflow: 'auto', padding: '8px', display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
        <For each={tilesForTab(props.selectedTab)}>
          {(tile) => (
            <button
              onClick={() => props.onSelectTileId(tile.id)}
              style={{
                padding: '6px', display: 'flex', 'align-items': 'center', gap: '6px',
                background: props.selectedTileId === tile.id ? '#555' : '#333',
                border: props.selectedTileId === tile.id ? '1px solid #aaa' : '1px solid transparent',
                color: '#fff', cursor: 'pointer', 'border-radius': '4px',
              }}
            >
              <div style={{ width: '20px', height: '20px', background: tile.color, 'border-radius': '3px', 'flex-shrink': '0' }} />
              <span style={{ 'font-size': '11px' }}>{tile.label}</span>
            </button>
          )}
        </For>
      </div>

      <div style={{ padding: '8px', 'border-top': '1px solid #444' }}>
        <button
          onClick={props.onSave}
          style={{
            width: '100%', padding: '8px', background: '#2d6a2d', color: '#fff',
            border: 'none', cursor: 'pointer', 'border-radius': '4px', 'font-size': '13px',
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build and typecheck**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments/apps/client"
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "playsets experiments/apps/client/src/builder/BuilderToolbar.tsx"
git commit -m "feat: add BuilderToolbar with Walls/Floors/Props/Tokens tabs"
```

---

## Task 9: LayerPanel.tsx

**Files:**
- Create: `playsets experiments/apps/client/src/builder/LayerPanel.tsx`

- [ ] **Step 1: Create LayerPanel.tsx**

```tsx
// playsets experiments/apps/client/src/builder/LayerPanel.tsx
import { createSignal, For } from 'solid-js'
import type { LayerBackgroundManager } from '../babylon/layers'
import type { LayerBackground } from '../types'

interface Props {
  weather: string
  onWeatherChange: (w: string) => void
  layerManager: LayerBackgroundManager
}

const WEATHER_OPTIONS = ['sunny', 'cloudy', 'night', 'rain']
const BG_OPTIONS: LayerBackground[] = ['transparent', 'grass', 'dirt']
const LAYER_COUNT = 9

export function LayerPanel(props: Props) {
  const [layerVisibility, setLayerVisibility] = createSignal<boolean[]>(Array(LAYER_COUNT).fill(true))
  const [layerBg, setLayerBg] = createSignal<LayerBackground[]>(Array(LAYER_COUNT).fill('transparent' as LayerBackground))

  function toggleLayer(i: number) {
    setLayerVisibility(prev => {
      const next = [...prev]
      next[i] = !next[i]
      props.layerManager.setVisible(i + 1, next[i])
      return next
    })
  }

  function changeBackground(i: number, bg: LayerBackground) {
    setLayerBg(prev => {
      const next = [...prev]
      next[i] = bg
      props.layerManager.updateLayer(i + 1, { background: bg })
      return next
    })
  }

  return (
    <div style={{
      position: 'absolute', bottom: '0', left: '160px', right: '0',
      background: 'rgba(20,20,20,0.88)', padding: '8px', display: 'flex',
      gap: '12px', 'align-items': 'center', 'pointer-events': 'all', 'z-index': '10',
    }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '4px' }}>
        <span style={{ color: '#aaa', 'font-size': '11px' }}>Weather:</span>
        <select
          value={props.weather}
          onChange={e => props.onWeatherChange(e.currentTarget.value)}
          style={{ background: '#333', color: '#fff', border: '1px solid #555', 'border-radius': '3px', padding: '2px 4px', 'font-size': '11px' }}
        >
          <For each={WEATHER_OPTIONS}>
            {(w) => <option value={w}>{w}</option>}
          </For>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '6px', 'overflow-x': 'auto', flex: '1' }}>
        <For each={Array.from({ length: LAYER_COUNT }, (_, i) => i)}>
          {(i) => (
            <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '2px' }}>
              <span style={{ color: '#888', 'font-size': '9px' }}>L{i + 1}</span>
              <input
                type="checkbox"
                checked={layerVisibility()[i]}
                onChange={() => toggleLayer(i)}
              />
              <select
                value={layerBg()[i]}
                onChange={e => changeBackground(i, e.currentTarget.value as LayerBackground)}
                style={{ background: '#333', color: '#fff', border: '1px solid #555', 'font-size': '9px', width: '52px' }}
              >
                <For each={BG_OPTIONS}>
                  {(bg) => <option value={bg}>{bg}</option>}
                </For>
              </select>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build the library**

```bash
cd "/Users/anthonymaitz/Repositories/playsets experiments/apps/client"
pnpm build:lib
```

Expected: `dist/playsets-board.mjs` rebuilt. No errors.

- [ ] **Step 3: Commit**

```bash
git add "playsets experiments/apps/client/src/builder/LayerPanel.tsx"
git commit -m "feat: add LayerPanel for layer visibility/background/weather"
```

---

## Task 10: ExploreRoom — load from Supabase + tokens from scene_data

**Files:**
- Modify: `server/src/rooms/ExploreRoom.ts`

- [ ] **Step 1: Read current ExploreRoom.ts to confirm the state**

Read `server/src/rooms/ExploreRoom.ts` to see the full current contents before editing.

- [ ] **Step 2: Rewrite ExploreRoom.ts**

Replace the entire file:

```typescript
import type { Client } from '@colyseus/core'
import { ExploreState, PlayerPosition, NpcEntity, DoorEntity } from '../schemas/ExploreState'
import { BaseRoom } from './BaseRoom'
import { isValidMove, isWalkable, isAdjacent } from './logic/explore-logic'
import { heroService } from '../db/hero-service'
import { supabase } from '../db/supabase'
import { THE_INN, STARTER_CLASSES, generateSceneFromInn } from 'shared-types'
import type { Position, SceneData } from 'shared-types'

interface MoveMessage {
  destination: Position
}

const INN_MOVE_SPEED = 3
const SCENE_SLUG = 'inn-main'

export class ExploreRoom extends BaseRoom<ExploreState> {
  private _sceneData: SceneData = generateSceneFromInn(THE_INN)

  async onCreate(): Promise<void> {
    this.setState(new ExploreState())

    const { data } = await supabase
      .from('scenes')
      .select('scene_data')
      .eq('slug', SCENE_SLUG)
      .single()

    if (data?.scene_data) {
      this._sceneData = data.scene_data as SceneData
    }

    for (const token of this._sceneData.tokens ?? []) {
      if (token.type === 'npc') {
        const entity = new NpcEntity()
        entity.id = token.id
        entity.name = token.name ?? ''
        entity.role = token.role ?? ''
        entity.x = token.col
        entity.y = token.row
        this.state.npcs.push(entity)
      } else if (token.type === 'door') {
        const entity = new DoorEntity()
        entity.id = token.id
        entity.biomeId = token.biomeId ?? ''
        entity.label = token.label ?? ''
        entity.x = token.col
        entity.y = token.row
        this.state.doors.push(entity)
      }
    }

    this.onMessage<MoveMessage>('MOVE', (client, message) => {
      this.handleMove(client, message)
    })

    this.onMessage('INTERACT', (client) => {
      this.handleInteract(client)
    })

    this.onMessage<{ id: string; x: number; y: number }>('DRAG_UPDATE', (client, message) => {
      this.broadcast('DRAG_UPDATE', message, { except: client })
    })

    this.onMessage('READY', async (client) => {
      client.send('SCENE_STATE', this._sceneData)

      const userData = client.userData as { heroIds?: string[] }
      const heroIds = userData?.heroIds ?? []
      if (heroIds.length === 0) return
      const hero = await heroService.getHero(heroIds[0])
      if (!hero) return
      const starterClass = STARTER_CLASSES.find((c) => c.name === hero.characterClass)
      const hp = hero.maxHp > 0 ? hero.maxHp : (starterClass?.maxHp ?? 10)
      client.send('HERO_STATE', {
        name: hero.name,
        class: hero.characterClass,
        personality: hero.personality,
        profession: '',
        die: hero.die,
        hp,
        combat: 'inGeneral',
        energy: Array(10).fill(true) as boolean[],
      })
    })
  }

  async onJoin(client: Client, options: { token?: string; heroIds?: string[] }): Promise<void> {
    await this.verifyToken(options.token)
    const pos = new PlayerPosition()
    pos.x = THE_INN.spawnX
    pos.y = THE_INN.spawnY
    pos.characterId = client.sessionId
    this.state.players.set(client.sessionId, pos)
    const heroIds = options.heroIds ?? []
    client.userData = { ...(client.userData ?? {}), heroIds }
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId)
  }

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

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0. Note: `onCreate` is now `async` — check if `BaseRoom` supports this. If `BaseRoom.onCreate` is typed as `(): void`, change the override to remove the `async` keyword and use `.then()` instead. If it supports `Promise<void>`, leave as is.

- [ ] **Step 4: Run server tests**

```bash
pnpm --filter server test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/ExploreRoom.ts
git commit -m "feat: ExploreRoom loads scene from Supabase and sends SCENE_STATE on READY"
```

---

## Task 11: useExploreRoom — add sceneData signal + SCENE_STATE handler

**Files:**
- Modify: `apps/game/src/hooks/useExploreRoom.ts`

- [ ] **Step 1: Add sceneData signal to createExploreRoom**

In `apps/game/src/hooks/useExploreRoom.ts`, add these changes inside `createExploreRoom`:

After the existing signal declarations, add:
```typescript
const [sceneData, setSceneData] = createSignal<SceneData | null>(null)
```

Add the import at the top:
```typescript
import type { SceneData } from 'shared-types'
```

Inside the `.then((r) => { ... })` block, after `r.onMessage('HERO_STATE', ...)`, add:
```typescript
r.onMessage('SCENE_STATE', (data: SceneData) => {
  setSceneData(data)
})
```

In the returned object, add:
```typescript
sceneData,
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/game/src/hooks/useExploreRoom.ts
git commit -m "feat: useExploreRoom handles SCENE_STATE and exposes sceneData signal"
```

---

## Task 12: ExploreScreen + PlaysetBoard — use sceneData for scene rendering

**Files:**
- Modify: `apps/game/src/screens/ExploreScreen.tsx`
- Modify: `packages/playsets/src/types.ts`
- Modify: `packages/playsets/src/PlaysetBoard.tsx`

- [ ] **Step 1: Add sceneJson prop to PlaysetBoardProps**

In `packages/playsets/src/types.ts`, add `sceneJson?: string` to `PlaysetBoardProps`:

Find:
```typescript
export interface PlaysetBoardProps {
  mode: PlaysetMode
  roomId: string
```

Change to:
```typescript
export interface PlaysetBoardProps {
  mode: PlaysetMode
  roomId: string
  sceneJson?: string
```

- [ ] **Step 2: Update ExploreBoard to use sceneJson when provided**

In `packages/playsets/src/PlaysetBoard.tsx`, update `ExploreBoard`'s `sceneJson` memo.

Find:
```typescript
  const sceneJson = createMemo(() => {
    const walls = props.exploreMap?.walls ?? []
    const buildings: Array<{ col: number; row: number; tileId: string }> = []
    for (let row = 0; row < walls.length; row++) {
      for (let col = 0; col < (walls[row]?.length ?? 0); col++) {
        if (walls[row][col] === 1) buildings.push({ col, row, tileId: 'wall' })
      }
    }
    return JSON.stringify({ buildings, layers: [], props: [], weather: 'none' })
  })
```

Replace with:
```typescript
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
```

- [ ] **Step 3: Update ExploreScreen to use sceneData**

In `apps/game/src/screens/ExploreScreen.tsx`, add imports:

```typescript
import { generateSceneFromInn } from 'shared-types'
import type { SceneData } from 'shared-types'
import { createMemo } from 'solid-js'
```

After `const state = createExploreRoom(token, heroIds)`, add:

```typescript
  const sceneJson = createMemo(() => {
    const sd: SceneData | null = state.sceneData()
    if (sd) return JSON.stringify(sd)
    return JSON.stringify(generateSceneFromInn(THE_INN))
  })
```

In the JSX, update the `<PlaysetBoard>` to pass `sceneJson`:

Find:
```typescript
              <PlaysetBoard
                mode="explore"
                roomId="inn"
                exploreMap={exploreMap()}
                onCellClick={handleCellClick}
              />
```

Replace with:
```typescript
              <PlaysetBoard
                mode="explore"
                roomId="inn"
                exploreMap={exploreMap()}
                sceneJson={sceneJson()}
                onCellClick={handleCellClick}
              />
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/playsets/src/types.ts packages/playsets/src/PlaysetBoard.tsx apps/game/src/screens/ExploreScreen.tsx
git commit -m "feat: ExploreScreen uses SCENE_STATE data for scene rendering"
```

---

## Task 13: End-to-end smoke test

**No new files.**

- [ ] **Step 1: Start the game client**

```bash
pnpm --filter game dev
```

Navigate to `http://localhost:5173`. Log in, enter the inn. Verify the board renders with the wall layout from THE_INN (fallback before any scene is saved).

- [ ] **Step 2: Navigate to the builder**

In browser address bar, go to `http://localhost:5173/build/inn-main`. Verify:
- Builder toolbar appears on the left (Walls / Floors / Props / Tokens tabs)
- LayerPanel appears at the bottom
- The canvas renders with the fallback scene

- [ ] **Step 3: Paint walls and save**

Select the Walls tab, click several cells on the canvas to paint walls. Click Save. Verify "Saving…" → "Saved ✓" status appears.

- [ ] **Step 4: Verify scene persists**

Reload the `/build/inn-main` page. The walls you painted should still be there (loaded from Supabase).

- [ ] **Step 5: Verify inn loads saved scene**

Navigate back to `http://localhost:5173`. Log in. The inn should now render with the saved scene (walls from Supabase instead of THE_INN.walls). The NPC and door positions from the saved scene should be active.

- [ ] **Step 6: Place tokens in builder**

Navigate to `/build/inn-main`. Switch to Tokens tab. Click a cell to place an Innkeeper. Save. Return to the inn and verify the Innkeeper appears at the new position.

- [ ] **Step 7: Test token drag**

In the builder, click and drag a token to a new cell. Verify it snaps to the new position. Click Save and verify the new position is stored.

- [ ] **Step 8: Final commit**

```bash
pnpm test
pnpm typecheck
git add -A
git commit -m "feat: complete Inn Scene + Builder (sub-project 2)"
```

---

## Self-Review

**Spec coverage:**
- Supabase scenes table ✓ (Task 2)
- scene_data JSONB with buildings/layers/props/tokens/weather ✓ (Task 1)
- SceneData type in shared-types ✓ (Task 1)
- fetchScene / upsertScene ✓ (Task 3)
- @solidjs/router with /build/:slug ✓ (Task 4)
- BuildScreen auth gate + scenechange listener ✓ (Task 5)
- PlaysetsBoardRoot build mode managers ✓ (Task 6)
- BuilderRoot with placement logic ✓ (Task 7)
- BuilderToolbar tabs ✓ (Task 8)
- LayerPanel ✓ (Task 9)
- DragController wired in build mode ✓ (Task 6 + 7)
- ExploreRoom loads from Supabase, fallback to generateSceneFromInn ✓ (Task 10)
- ExploreRoom loads tokens from scene_data.tokens ✓ (Task 10)
- SCENE_STATE sent on READY ✓ (Task 10)
- useExploreRoom sceneData signal ✓ (Task 11)
- ExploreScreen uses sceneData ✓ (Task 12)

**Out of scope (confirmed):**
- RoofManager — deferred
- Player access to builder — RLS policy change only, no code
- Procedural generation
- Multiple scenes per room
