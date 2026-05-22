# Secondary Class UI Design

## Goal

Allow heroes to choose (and later re-choose) a secondary class by visiting the Sage NPC in the Inn. The secondary class system is already fully implemented server-side; this spec covers the client-side surface.

## Architecture

Sage NPC added to the Inn → existing NPC interaction system triggers comic dialog → `handleInteractionComplete` opens `SecondaryClassModal` → modal fetches class options from a new REST endpoint → user picks and confirms → `SET_SECONDARY_CLASS` Colyseus message (already implemented) → server responds with updated `HERO_STATE` now carrying `level` + `secondaryClass`.

## Components

### 1. Sage NPC token — `packages/shared-types/src/inn-map.ts`

Add `'sage'` to the `NpcRole` union. Add a sage NPC entry to `THE_INN.npcs` at position (7, 4).

### 2. `GET /api/classes` — `server/src/routes/content.ts` + `server/src/db/sq-content.ts`

First, add `listSqClasses()` to `sq-content.ts`:

```ts
export async function listSqClasses(): Promise<{ id: string; name: string; firstAbility: SqAbility | null }[]>
```

Queries `sq_classes`, then for each fetches the first ability via `getSqClassAbilities(class.id)`.

New route on the existing content router:

```http
GET /api/classes
→ { classes: Array<{ name: string; ability: { id: string; name: string; description: string } }> }
```

Maps `listSqClasses()` results, filters out classes with no ability. Register in `server/src/http-app.ts` under `/api`.

### 3. `HERO_STATE` additions — `server/src/rooms/ExploreRoom.ts`

All three `HERO_STATE` send-sites add two fields:

- `level: hero.level` (number)
- `secondaryClass: hero.secondaryClass` (string | null)

### 4. `useExploreRoom` additions — `apps/game/src/hooks/useExploreRoom.ts`

Add a `heroMeta` signal separate from `heroState` (which is typed as `CharacterData` from the SimpleQuest HUD package and must not be extended):

```ts
const [heroMeta, setHeroMeta] = createSignal<{ level: number; secondaryClass: string | null }>({ level: 1, secondaryClass: null })
```

In the `HERO_STATE` handler, populate both signals from the same message payload.

Add `setSecondaryClass(className: string)` to the return object — sends `SET_SECONDARY_CLASS` via the Colyseus room.

### 5. `SecondaryClassModal` — `apps/game/src/components/SecondaryClassModal.tsx`

New SolidJS component. Props:

```ts
{
  heroMeta: Accessor<{ level: number; secondaryClass: string | null }>
  onSend: (className: string) => void
  onClose: () => void
}
```

Behavior:

- On mount: `fetch(`${import.meta.env.VITE_API_URL}/api/classes`)` → display class cards
- Each card: class name + borrowed ability name and description
- If `heroMeta().secondaryClass` is already set, that card is highlighted as current selection
- Selecting a card that differs from current activates the Confirm button
- Confirm → calls `onSend(selectedClass)` → the parent watches `heroMeta()` and closes the modal when `secondaryClass` changes in the next `HERO_STATE`
- Server `ERROR` response surfaced as inline error text; modal stays open
- Loading and error states handled

### 6. `ExploreScreen` additions — `apps/game/src/screens/ExploreScreen.tsx`

Two sage panel variants in `NPC_PANELS`:

- `sage_locked`: single panel — "Return when you've proven yourself in battle." (level < 5)
- `sage_unlocked`: single panel — "Your spirit is ready. Choose a second path." (level ≥ 5)

When a Sage interaction starts, pick the variant based on `heroMeta().level`.

`handleInteractionComplete`:

- `sage_locked` role: no-op (dialog just closes)
- `sage_unlocked` role: set `showSecondaryModal(true)`

`SecondaryClassModal` rendered when `showSecondaryModal()` is true. Closes when `heroMeta().secondaryClass` changes or user dismisses.

## Future: cost to switch

Re-choosing a secondary class will eventually cost a resource (gold, star fragments, or a new currency). The server-side `SET_SECONDARY_CLASS` handler is the right place to enforce this — gate on a resource check before calling `setSecondaryClass`. The client modal will need to display the cost and deduct it from the inventory display. This is not in scope for this implementation.

## What this does NOT include

- Secondary ability display in the combat HUD — the ability already gets merged into `ActorState.abilities[]` at combat start, so it will appear in SimpleQuest HUD automatically
- Class XP display — future milestone
- Sage NPC sprite — uses existing NPC token placeholder
