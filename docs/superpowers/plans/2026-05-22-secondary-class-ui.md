# Secondary Class UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sage NPC to the Inn that lets heroes choose (or re-choose) a secondary class via a modal picker, wired to the already-complete server-side implementation.

**Architecture:** Sage NPC token added to `THE_INN` map → existing proximity interaction system fires `INTERACTION_START` → `handleInteractionComplete` in ExploreScreen opens `SecondaryClassModal` → modal fetches class options from `GET /content/classes` REST endpoint → user picks and confirms → `SET_SECONDARY_CLASS` Colyseus message (already implemented) → server responds with updated `HERO_STATE` now carrying `level` and `secondaryClass`.

**Tech Stack:** SolidJS (client), Colyseus 0.15 (WebSocket), Hono (HTTP server), Supabase JS (DB queries), Vitest (tests), pnpm workspaces.

---

## File Map

| File | Change |
|------|--------|
| `packages/shared-types/src/inn-map.ts` | Add `'sage'` to `NpcRole`; add sage NPC token at (7, 4) |
| `server/src/db/sq-content.ts` | Add `listSqClasses()` |
| `server/src/routes/content.ts` | Add `GET /classes` route |
| `server/src/rooms/ExploreRoom.ts` | Add `level` + `secondaryClass` to all 3 `HERO_STATE` sends |
| `apps/game/src/hooks/useExploreRoom.ts` | Add `heroMeta` signal; add `setSecondaryClass` method |
| `apps/game/src/components/SecondaryClassModal.tsx` | New component — class picker modal |
| `apps/game/src/screens/ExploreScreen.tsx` | Add sage panels; wire `SecondaryClassModal` |

---

## Task 1: Add Sage NPC to Inn map

**Files:**
- Modify: `packages/shared-types/src/inn-map.ts:3`

- [ ] **Step 1: Add `'sage'` to `NpcRole` and the sage token**

Replace the current content of `packages/shared-types/src/inn-map.ts` lines 1–12 and 75–79:

```ts
// Line 3: add 'sage'
export type NpcRole = 'innkeeper' | 'blacksmith' | 'doorkeeper' | 'sage'
```

Add the sage entry at the end of the `npcs` array (line 78, after the doorkeeper entry):

```ts
{ id: 'sage', name: 'Sage', role: 'sage', x: 7, y: 2, direction: 's' },
```

The full `npcs` array should now be:

```ts
npcs: [
  { id: 'innkeeper',         name: 'Innkeeper',        role: 'innkeeper',  x: 10, y: 2, direction: 's' },
  { id: 'blacksmith',        name: 'Blacksmith',        role: 'blacksmith', x: 4,  y: 7, direction: 'e' },
  { id: 'doorkeeper-forest', name: 'Forest Doorkeeper', role: 'doorkeeper', x: 16, y: 7, direction: 'w' },
  { id: 'sage',              name: 'Sage',              role: 'sage',       x: 7,  y: 2, direction: 's' },
],
```

- [ ] **Step 2: Run typecheck to verify no new errors**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm typecheck
```

Expected: exits 0. (If TypeScript complains about unhandled `'sage'` in a switch/exhaustive check elsewhere, fix those too.)

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/inn-map.ts
git commit -m "feat: add Sage NPC to Inn map"
```

---

## Task 2: Add `listSqClasses()` and `GET /content/classes`

**Files:**
- Modify: `server/src/db/sq-content.ts` (append after `getSqClassAbilities`)
- Modify: `server/src/routes/content.ts`

The Supabase `sq_classes` table stores class IDs like `"Fighter"`, `"Mage"`, etc. The class `id` doubles as its display name.

- [ ] **Step 1: Add `listSqClasses` to `server/src/db/sq-content.ts`**

Append this function after the closing brace of `getSqClassAbilities`:

```ts
export async function listSqClasses(): Promise<Array<{ id: string; firstAbility: SqAbility | null }>> {
  const { data, error } = await supabase
    .from('sq_classes')
    .select('id')
    .order('id', { ascending: true })
  if (error) throw error
  const results = await Promise.all(
    (data ?? []).map(async (cls) => {
      const abilities = await getSqClassAbilities(cls.id)
      return { id: cls.id, firstAbility: abilities[0] ?? null }
    })
  )
  return results
}
```

- [ ] **Step 2: Add `GET /classes` to `server/src/routes/content.ts`**

The full updated file should be:

```ts
import { Hono } from 'hono'
import { getSqContent, listSqClasses } from '../db/sq-content'

export const contentRoutes = new Hono()

contentRoutes.get('/', async (c) => {
  const content = await getSqContent()
  return c.json(content)
})

contentRoutes.get('/classes', async (c) => {
  const classes = await listSqClasses()
  return c.json({
    classes: classes
      .filter((cls) => cls.firstAbility !== null)
      .map((cls) => ({
        name: cls.id,
        ability: {
          id: cls.firstAbility!.id,
          name: cls.firstAbility!.title,
          description: cls.firstAbility!.body,
        },
      })),
  })
})
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Smoke-test the endpoint**

Start the server in a separate terminal:

```bash
pnpm --filter server dev
```

Then:

```bash
curl http://localhost:3000/content/classes
```

Expected: JSON like `{"classes":[{"name":"Fighter","ability":{"id":"...","name":"...","description":"..."}},...]}`. If the array is empty, the Supabase `sq_classes` table may be empty — that's a data issue, not a code issue.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/sq-content.ts server/src/routes/content.ts
git commit -m "feat: add listSqClasses and GET /content/classes"
```

---

## Task 3: Add `level` and `secondaryClass` to `HERO_STATE`

**Files:**
- Modify: `server/src/rooms/ExploreRoom.ts`

There are three places that call `client.send('HERO_STATE', {...})`:
1. After `REST` message (~line 110)
2. After `SET_SECONDARY_CLASS` success (~line 140)
3. After `READY` message (~line 195)

Each needs two new fields added.

- [ ] **Step 1: Update REST handler HERO_STATE send (~line 110)**

Find the `HERO_STATE` send inside `this.onMessage('REST', ...)`. Add `level` and `secondaryClass` to the payload:

```ts
client.send('HERO_STATE', {
  name: hero.name,
  class: hero.characterClass,
  personality: hero.personality,
  profession: hero.profession ?? '',
  die: hero.die,
  hp: maxHp,
  maxHp,
  combat: 'inGeneral',
  energy: Array(10).fill(true) as boolean[],
  starRating: hero.starRating ?? 0,
  gear: hero.gear ? { weapon: hero.gear.weapon ?? null, weaponBonus: weaponDamageBonus(hero.gear.weapon) } : undefined,
  level: hero.level,
  secondaryClass: hero.secondaryClass,
})
```

- [ ] **Step 2: Update SET_SECONDARY_CLASS handler HERO_STATE send (~line 140)**

Same addition inside the `try` block of `SET_SECONDARY_CLASS` handler:

```ts
client.send('HERO_STATE', {
  name: updated.name,
  class: updated.characterClass,
  personality: updated.personality,
  profession: updated.profession ?? '',
  die: updated.die,
  hp: maxHp,
  maxHp,
  combat: 'inGeneral',
  energy: Array(10).fill(true) as boolean[],
  starRating: updated.starRating ?? 0,
  gear: updated.gear ? { weapon: updated.gear.weapon ?? null, weaponBonus: weaponDamageBonus(updated.gear?.weapon) } : undefined,
  level: updated.level,
  secondaryClass: updated.secondaryClass,
})
```

- [ ] **Step 3: Update READY handler HERO_STATE send (~line 195)**

Same addition in the `READY` handler send:

```ts
client.send('HERO_STATE', {
  name: hero.name,
  class: hero.characterClass,
  personality: hero.personality,
  profession: hero.profession ?? '',
  die: hero.die,
  hp: maxHp,
  maxHp,
  combat: 'inGeneral',
  energy: Array(10).fill(true) as boolean[],
  starRating: hero.starRating ?? 0,
  gear: hero.gear ? { weapon: hero.gear.weapon ?? null, weaponBonus: weaponDamageBonus(hero.gear.weapon) } : undefined,
  level: hero.level,
  secondaryClass: hero.secondaryClass,
})
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/ExploreRoom.ts
git commit -m "feat: add level and secondaryClass to HERO_STATE message"
```

---

## Task 4: Add `heroMeta` and `setSecondaryClass` to `useExploreRoom`

**Files:**
- Modify: `apps/game/src/hooks/useExploreRoom.ts`

`CharacterData` (from `simplequest-hud`) must not be extended — it drives the SimpleQuest HUD component. Store game-specific hero state in a separate `heroMeta` signal, populated from the same `HERO_STATE` message payload.

- [ ] **Step 1: Add `heroMeta` signal and reset it in the cleanup block**

Add after the existing signal declarations (~line 48), alongside the other `createSignal` calls:

```ts
const [heroMeta, setHeroMeta] = createSignal<{ level: number; secondaryClass: string | null }>({ level: 1, secondaryClass: null })
```

In the cleanup block (the section beginning around line 54 where all signals are reset on token/heroIds change), add:

```ts
setHeroMeta({ level: 1, secondaryClass: null })
```

- [ ] **Step 2: Update the `HERO_STATE` message handler**

The current handler (~line 112):

```ts
r.onMessage('HERO_STATE', (data: CharacterData) => {
  setHeroState(data)
  ...
})
```

Change the type annotation and add `setHeroMeta`:

```ts
r.onMessage('HERO_STATE', (data: CharacterData & { level?: number; secondaryClass?: string | null }) => {
  setHeroState(data)
  setHeroMeta({ level: data.level ?? 1, secondaryClass: data.secondaryClass ?? null })
  // Add self player at spawn if schema onAdd never fired
  setPlayers((prev) => {
    if (prev[r.sessionId]) return prev
    return { ...prev, [r.sessionId]: { x: THE_INN.spawnX, y: THE_INN.spawnY, characterId: r.sessionId, direction: 's' } }
  })
})
```

- [ ] **Step 3: Export `heroMeta` and `setSecondaryClass` in the return object**

Add to the return object at the end of `createExploreRoom`:

```ts
heroMeta,
setSecondaryClass(className: string) { room?.send('SET_SECONDARY_CLASS', { className }) },
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/game/src/hooks/useExploreRoom.ts
git commit -m "feat: add heroMeta signal and setSecondaryClass to useExploreRoom"
```

---

## Task 5: Create `SecondaryClassModal` component

**Files:**
- Create: `apps/game/src/components/SecondaryClassModal.tsx`

This is a SolidJS modal. It fetches `/content/classes` on mount, shows class cards with the borrowed ability name and description, and sends `SET_SECONDARY_CLASS` on confirm.

Key SolidJS rules to follow:
- Never destructure props at the top level — use `props.heroMeta`, `props.onSend`, `props.onClose`
- Use `createResource` for the fetch (handles loading/error states automatically)
- All inline styles use the object syntax like the rest of this codebase

- [ ] **Step 1: Create the file**

Create `apps/game/src/components/SecondaryClassModal.tsx`:

```tsx
import { createSignal, createResource, For, Show } from 'solid-js'
import type { Accessor } from 'solid-js'

type ClassOption = {
  name: string
  ability: { id: string; name: string; description: string }
}

interface Props {
  heroMeta: Accessor<{ level: number; secondaryClass: string | null }>
  onSend: (className: string) => void
  onClose: () => void
}

async function fetchClasses(): Promise<ClassOption[]> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/content/classes`)
  // VITE_API_URL = http://localhost:3000 (set in apps/game/.env)
  if (!res.ok) throw new Error(`Failed to load classes: ${res.status}`)
  const json = await res.json() as { classes: ClassOption[] }
  return json.classes
}

export function SecondaryClassModal(props: Props) {
  const [classes] = createResource(fetchClasses)
  const [selected, setSelected] = createSignal<string | null>(null)
  const [sendError, setSendError] = createSignal<string | null>(null)

  const currentClass = () => props.heroMeta().secondaryClass
  const effectiveSelected = () => selected() ?? currentClass()

  function handleConfirm() {
    const cls = effectiveSelected()
    if (!cls) return
    setSendError(null)
    props.onSend(cls)
  }

  return (
    <div style={{
      position: 'absolute', inset: '0', 'z-index': '40',
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', 'align-items': 'center', 'justify-content': 'center',
    }}>
      <div style={{
        background: 'rgba(5,10,5,0.98)',
        border: '1px solid rgba(255,255,255,0.1)',
        'border-radius': '10px',
        padding: '28px 32px',
        'max-width': '480px',
        width: '90%',
        'max-height': '80vh',
        overflow: 'auto',
      }}>
        <div style={{ color: '#ccc', 'font-size': '16px', 'font-weight': '700', 'margin-bottom': '6px' }}>
          Choose Secondary Class
        </div>
        <div style={{ color: '#555', 'font-size': '11px', 'margin-bottom': '20px' }}>
          You will borrow one ability from this class in combat.
        </div>

        <Show when={classes.loading}>
          <div style={{ color: '#555', 'font-size': '12px', 'text-align': 'center', padding: '20px' }}>
            Loading classes…
          </div>
        </Show>

        <Show when={classes.error}>
          <div style={{ color: '#f88', 'font-size': '12px', 'text-align': 'center', padding: '20px' }}>
            Could not load classes. Try again.
          </div>
        </Show>

        <Show when={classes()}>
          {(list) => (
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '10px', 'margin-bottom': '20px' }}>
              <For each={list()}>
                {(cls) => {
                  const isSelected = () => effectiveSelected() === cls.name
                  return (
                    <button
                      onClick={() => setSelected(cls.name)}
                      style={{
                        background: isSelected() ? 'rgba(80,160,80,0.15)' : 'rgba(255,255,255,0.03)',
                        border: isSelected() ? '1px solid rgba(100,200,100,0.4)' : '1px solid rgba(255,255,255,0.07)',
                        'border-radius': '7px',
                        padding: '12px',
                        cursor: 'pointer',
                        'text-align': 'left',
                      }}
                    >
                      <div style={{ color: isSelected() ? '#9f9' : '#ccc', 'font-size': '13px', 'font-weight': '600', 'margin-bottom': '4px' }}>
                        {cls.name}
                      </div>
                      <div style={{ color: '#888', 'font-size': '11px', 'font-weight': '600', 'margin-bottom': '3px' }}>
                        {cls.ability.name}
                      </div>
                      <div style={{ color: '#555', 'font-size': '10px', 'line-height': '1.4' }}>
                        {cls.ability.description}
                      </div>
                    </button>
                  )
                }}
              </For>
            </div>
          )}
        </Show>

        <Show when={sendError()}>
          <div style={{ color: '#f88', 'font-size': '11px', 'margin-bottom': '12px' }}>
            {sendError()}
          </div>
        </Show>

        <div style={{ display: 'flex', gap: '8px', 'justify-content': 'flex-end' }}>
          <button
            onClick={props.onClose}
            style={{
              padding: '6px 18px', 'font-size': '12px', cursor: 'pointer',
              background: 'transparent', color: '#555',
              border: '1px solid rgba(255,255,255,0.08)', 'border-radius': '5px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!effectiveSelected() || effectiveSelected() === currentClass()}
            style={{
              padding: '6px 18px', 'font-size': '12px', 'font-weight': '600', cursor: 'pointer',
              background: 'rgba(80,160,80,0.2)', color: '#6f6',
              border: '1px solid #3a5a3a', 'border-radius': '5px',
              opacity: (!effectiveSelected() || effectiveSelected() === currentClass()) ? '0.4' : '1',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/components/SecondaryClassModal.tsx
git commit -m "feat: add SecondaryClassModal component"
```

---

## Task 6: Wire Sage into ExploreScreen

**Files:**
- Modify: `apps/game/src/screens/ExploreScreen.tsx`

This task:
1. Adds sage panel variants to `NPC_PANELS`
2. Updates `interactionPanels()` to pick the right sage panel based on `heroMeta` level
3. Adds `showSecondaryModal` signal
4. Adds sage case to `handleInteractionComplete`
5. Auto-closes the modal when `heroMeta().secondaryClass` changes
6. Renders `SecondaryClassModal` in JSX

- [ ] **Step 1: Add `SecondaryClassModal` import**

Add to the imports at the top of `ExploreScreen.tsx` alongside the other component imports:

```ts
import { SecondaryClassModal } from '../components/SecondaryClassModal'
```

- [ ] **Step 2: Add sage panels to `NPC_PANELS`**

The current `NPC_PANELS` constant (lines 18–28). Add two sage variants:

```ts
const NPC_PANELS: Record<string, Panel[]> = {
  innkeeper: [
    { speaker: 'Innkeeper', text: 'Welcome back! Rest up — your heroes are fully restored.' },
  ],
  blacksmith: [
    { speaker: 'Blacksmith', text: 'I can help you equip your heroes when gear equipping arrives.' },
  ],
  doorkeeper: [
    { speaker: 'Doorkeeper', text: 'Ready to venture out? Choose your party and I\'ll open the way.' },
  ],
  sage_locked: [
    { speaker: 'Sage', text: 'Return when you\'ve proven yourself in battle. Secondary paths open at level 5.' },
  ],
  sage_unlocked: [
    { speaker: 'Sage', text: 'Your spirit is ready. Choose a second path — one ability from another class will join your arsenal.' },
  ],
}
```

- [ ] **Step 3: Add `showSecondaryModal` signal**

Add with the other `createSignal` declarations near the top of `ExploreScreen` (e.g. after `sidebarTab`):

```ts
const [showSecondaryModal, setShowSecondaryModal] = createSignal(false)
```

- [ ] **Step 4: Update `interactionPanels()` to handle sage**

The current implementation (~line 313):

```ts
const interactionPanels = (): Panel[] | null => {
  const ev = state.interaction()
  if (!ev) return null
  if (ev.type === 'npc') return NPC_PANELS[ev.role] ?? null
  if (ev.type === 'door') return DOOR_PANELS
  return null
}
```

Replace with:

```ts
const interactionPanels = (): Panel[] | null => {
  const ev = state.interaction()
  if (!ev) return null
  if (ev.type === 'npc') {
    if (ev.role === 'sage') {
      return state.heroMeta().level >= 5 ? NPC_PANELS['sage_unlocked'] : NPC_PANELS['sage_locked']
    }
    return NPC_PANELS[ev.role] ?? null
  }
  if (ev.type === 'door') return DOOR_PANELS
  return null
}
```

- [ ] **Step 5: Update `handleInteractionComplete()` to handle sage**

Current implementation (~line 321):

```ts
function handleInteractionComplete() {
  const ev = state.interaction()
  if (ev?.type === 'npc' && ev.role === 'innkeeper') state.rest()
  if (ev?.type === 'npc' && ev.role === 'doorkeeper' && ev.biomeId) {
    void heroRoster.refresh()
    setPartyPickerBiomeId(ev.biomeId)
  }
  state.dismissInteraction()
}
```

Add the sage case:

```ts
function handleInteractionComplete() {
  const ev = state.interaction()
  if (ev?.type === 'npc' && ev.role === 'innkeeper') state.rest()
  if (ev?.type === 'npc' && ev.role === 'doorkeeper' && ev.biomeId) {
    void heroRoster.refresh()
    setPartyPickerBiomeId(ev.biomeId)
  }
  if (ev?.type === 'npc' && ev.role === 'sage' && state.heroMeta().level >= 5) {
    setShowSecondaryModal(true)
  }
  state.dismissInteraction()
}
```

- [ ] **Step 6: Add effect to auto-close modal when secondaryClass changes**

Add after the other `createEffect` calls:

```ts
createEffect(on(() => state.heroMeta().secondaryClass, () => {
  setShowSecondaryModal(false)
}, { defer: true }))
```

The `{ defer: true }` option prevents the effect from running on initial render (which would immediately close a freshly-opened modal if secondaryClass is already set).

- [ ] **Step 7: Render `SecondaryClassModal` in JSX**

Inside the outer `<Show when={state.connected()}>` block, add the modal render alongside the other overlays (e.g. after the `CombatResultModal`):

```tsx
<Show when={showSecondaryModal()}>
  <SecondaryClassModal
    heroMeta={state.heroMeta}
    onSend={(className) => state.setSecondaryClass(className)}
    onClose={() => setShowSecondaryModal(false)}
  />
</Show>
```

- [ ] **Step 8: Run typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add apps/game/src/screens/ExploreScreen.tsx
git commit -m "feat: wire Sage NPC and SecondaryClassModal into ExploreScreen"
```

---

## Task 7: Integration test — walk through the full flow

This task verifies the feature end-to-end in the running game. No automated test is practical here.

- [ ] **Step 1: Start server and client**

In two terminal tabs:

```bash
pnpm --filter server dev   # port 2567 (WS) + 3000 (HTTP)
pnpm --filter game dev     # port 5173
```

- [ ] **Step 2: Verify Sage appears on the board**

Open `http://localhost:5173` in the browser. In the Inn, a Sage token should appear at roughly the upper-left quadrant of the map (grid position 7, 2). If it doesn't appear, check the browser console for SCENE_STATE token data.

- [ ] **Step 3: Test locked state (hero level < 5)**

Walk your hero into the Sage's front cell (7, 3). The comic panel dialog should appear with: *"Return when you've proven yourself in battle. Secondary paths open at level 5."* Click through — no modal should open.

- [ ] **Step 4: Set hero to level 5 for testing**

Use the debug route to give your hero enough XP or directly update via Supabase dashboard. Alternatively, temporarily lower the level gate in `ExploreRoom.ts` from `5` to `1` for testing, then revert.

```sql
-- In Supabase SQL editor:
UPDATE heroes SET level = 5 WHERE id = '<your-hero-id>';
```

Then re-enter the Inn (disconnect and reconnect) so the READY handler sends updated HERO_STATE with `level: 5`.

- [ ] **Step 5: Test unlocked state**

Walk into the Sage again. Dialog should read: *"Your spirit is ready. Choose a second path…"* Click through — `SecondaryClassModal` should open showing class cards with ability previews.

- [ ] **Step 6: Test class selection**

Select a class card (different from your hero's primary class). Confirm button should become active. Click Confirm — modal should close automatically when the server responds with updated HERO_STATE. Open browser devtools Network tab to verify `SET_SECONDARY_CLASS` was sent and a new `HERO_STATE` message arrived with `secondaryClass` set.

- [ ] **Step 7: Test re-choose**

Walk into the Sage again (hero is level 5). Modal opens. The previously chosen class card should be highlighted. Select a different class and confirm — modal should update correctly.

- [ ] **Step 8: Verify secondary ability in combat**

Start a combat encounter. The secondary ability should appear in the SimpleQuest HUD ability list alongside the primary class abilities.
