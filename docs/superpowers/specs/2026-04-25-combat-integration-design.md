# Combat Integration — In-Place Combat on the Explore Board

## Goal

When a player walks adjacent to an enemy on the inn board, combat begins in-place on the same shared board. Other players in the room can see the fight, voluntarily join if in range, or be pulled in automatically if they walk adjacent to a combat enemy. Energy drives all actions — movement and abilities draw from the same pool. Combat ends when all enemies or all participating heroes are knocked out.

## Architecture

**Tech stack**: Colyseus (ExploreRoom), rules-engine, SolidJS (useExploreRoom + ExploreScreen), BabylonJS (PlaysetsBoardRoot combat overlay)

### Server

A new `InPlaceCombatEngine` class in `server/src/rooms/InPlaceCombatEngine.ts` owns all turn logic. It has no Colyseus dependency — constructed from actors and walls, fully unit-testable (same pattern as `EnemyManager`).

```ts
class InPlaceCombatEngine {
  constructor(actors: ActorState[], walls: number[][])
  getCombatState(): CombatState
  handlePlayerAction(actorId: string, action: Action): ActionResult
  processNPCTurns(): ActionResult[]
  addActor(actor: ActorState): void        // for JOIN_COMBAT
  startTurn(actorId: string): void         // refills energy
  isOver(): boolean
  winningSide(): 'players' | 'npcs' | null
}
```

**ExploreRoom changes:**

- `private _combat: InPlaceCombatEngine | null = null`
- `private _combatParticipants: Set<string> = new Set()` — session IDs of players in the fight
- When adjacency triggers an encounter (existing `EnemyManager.onPlayerMove` path):
  - Fetch hero from Supabase (`heroService.getHero(heroIds[0])`)
  - Build `ActorState` for hero + enemy (enemy abilities: `slash` 1d4 damage, 2 energy cost, for all levels)
  - Roll initiative: D20 vs enemy level — if player wins, players go first with full energy; if enemy wins, players start with half energy
  - Create `InPlaceCombatEngine`, broadcast `COMBAT_START` with initial `CombatState` to **all clients**
- New message handlers:
  - `PLAYER_ACTION`: validate actor is current turn, delegate to engine, deduct energy, broadcast `COMBAT_STATE`; when energy hits 0 auto-advance turn
  - `END_TURN`: advance turn to next actor, refill next actor's energy, run NPC turns if needed, broadcast `COMBAT_STATE`
  - `JOIN_COMBAT` (voluntary): add hero to engine, insert into initiative queue after current actor
- Only one combat can be active at a time. Move handler checks adjacency — if `_combat` is active and the adjacent enemy is a combat participant, auto-join. If adjacent to a non-combat enemy while a combat is active, no new combat is started.
- Proximity offer: after each MOVE, if `_combat` is active and moving player is within 4 tiles of any combat actor and not yet a participant → send `COMBAT_JOIN_OFFER` to that client only
- On combat end:
  - **Win**: remove defeated enemies from `state.enemies`, null out `_combat`, broadcast `COMBAT_END { result: 'win' }`
  - **Lose**: write `recovery_ends_at = now + 8 hours` to Supabase for each knocked-out hero, broadcast `COMBAT_END { result: 'lose', recoveryEndsAt }`

**Actor assembly:**
- Hero `ActorState`: built from `HeroRecord` (id, name, characterClass, personality, die, hp=maxHp, energy=maxEnergy, abilities, position=current player grid position, isNPC=false). `speed` field retained on the type but not used for movement range.
- Enemy `ActorState`: from `EnemyEntity` (id, name, hp, maxHp, level, position=enemy grid position, isNPC=true, energy=10, maxEnergy=10, abilities=[`slash`])

**Energy and movement:** Movement costs 1 energy per square. Server receives `{ type: 'move', destination }`, calculates BFS path cost through non-wall cells, validates player has enough energy, deducts cost, updates actor position. Abilities deduct their `energyCost`. Regular abilities are flagged used after first use in a turn (tracked in engine). Energy refills fully at the start of each actor's turn.

**Ghost state:** When an actor reaches 0 HP they are marked `isGhost: true` on their `ActorState`. Ghost actors still take turns; their action is a placeholder skip for now. All ghost heroes = loss condition.

### Client

`useExploreRoom` additions:
```ts
const [combatState, setCombatState] = createSignal<CombatState | null>(null)
const [combatResult, setCombatResult] = createSignal<'win' | 'lose' | null>(null)
const [joinOffer, setJoinOffer] = createSignal(false)

onMessage('COMBAT_START', (state) => setCombatState(state))
onMessage('COMBAT_STATE', (state) => setCombatState(state))
onMessage('COMBAT_END', ({ result, recoveryEndsAt }) => {
  setCombatResult(result)
  setRecoveryEndsAt(recoveryEndsAt ?? null)
  if (result === 'win') setCombatState(null)
})
onMessage('COMBAT_JOIN_OFFER', () => setJoinOffer(true))

sendAction(action: Action): void   // room?.send('PLAYER_ACTION', { action })
endTurn(): void                    // room?.send('END_TURN')
joinCombat(): void                 // room?.send('JOIN_COMBAT')
dismissJoinOffer(): void           // setJoinOffer(false)
```

`ExploreScreen` passes `combatState()` and `sendAction`/`endTurn` to `PlaysetBoard`. The `exploreMap()` memo continues feeding enemy tokens for non-combat display; when `combatState` is present, actor positions from `combatState.actors` are used for rendering instead.

**Join offer UI**: small prompt overlay ("A battle is nearby — Join?") with Accept/Ignore buttons. Shown when `joinOffer()` is true.

**Results overlay**: shown when `combatResult()` is set. Win: brief "Victory!" auto-dismisses after 3 seconds. Lose: "Your heroes need time to recover" with a dismiss button that navigates to `/`.

### Playsets Renderer (combat mode)

`PlaysetsBoardRoot` receives a new `combatState?: CombatState` prop alongside the existing `entities` and `scene` props. When `combatState` is present, an additional combat layer renders on top of the explore scene — buildings, NPCs, and other players remain visible.

**Combat rendering additions:**
- Actor cylinders positioned at `actor.position` (col+0.5, 0.45, row+0.5), renderingGroupId=6
- Ghost actors: translucent cylinder (alpha 0.4)
- Current actor: brighter emissive ring or highlight beneath cylinder
- **My turn — move range**: BFS from hero position through non-wall cells up to `remainingEnergy` squares highlighted in green. Updates live as energy is spent.
- **My turn — ability selected**: valid targets highlighted in orange (enemies in range); cells in range for area abilities highlighted in blue
- **Target-first**: tap an enemy cylinder → highlight abilities in the action bar that can reach it
- **Turn/energy HUD** (bottom of screen, visible to all): turn order strip, current actor name, energy bar for current actor
- **Action bar** (bottom of screen, interactive only for current actor): ability buttons showing name + energy cost + "used" state, End Turn button

**Interaction:**
- Drag hero cylinder to a green cell → `sendAction({ type: 'move', actorId, destination })`
- Tap ability button → enters targeting mode
- Tap valid target/cell in targeting mode → `sendAction({ type: 'ability', actorId, targetIds, ability })`
- Tap enemy → highlights reachable abilities in action bar
- Tap End Turn → `endTurn()`

NPC turns: server processes automatically and broadcasts `COMBAT_STATE` after each NPC action. Client shows actors moving/animating between states (position updates via reactive effect, same as explore mode).

## Data model changes

`ActorState` gains one field:
```ts
isGhost?: boolean   // true when HP = 0, actor still participates as ghost
```

`CombatState` gains:
```ts
activeEnemyIds: string[]   // which enemies are in this combat (subset of board enemies)
```

These are additions — no existing fields removed.

## Testing

- `InPlaceCombatEngine` unit tests (no Colyseus): initiative roll, player action resolves + energy deducted, auto-end turn on 0 energy, NPC turn processing, win/loss detection, addActor for join, ghost state
- `ExploreRoom` integration: ENCOUNTER starts combat, PLAYER_ACTION during combat, END_TURN advances, JOIN_COMBAT adds actor, COMBAT_END on all-ghost
- Existing 124 tests must continue passing

## Post-combat flows

**Win**: `COMBAT_END { result: 'win' }` → enemy removed from `state.enemies` → board resumes explore mode → brief "Victory!" overlay auto-dismisses.

**Lose**: `COMBAT_END { result: 'lose' }` → `recovery_ends_at` written to Supabase → "Heroes recovering" overlay with dismiss → navigate to `/` → `isRecovering()` gates hero selection in ConnectScreen (already implemented).

**Recovery duration**: `RECOVERY_HOURS = 8` constant in ExploreRoom, configurable.
