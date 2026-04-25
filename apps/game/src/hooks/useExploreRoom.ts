import { createSignal, createEffect, on, onCleanup } from 'solid-js'
import { joinRoom } from './useGameServer'
import type { Room } from 'colyseus.js'
import type { Position, SceneData, EncounterEvent, CombatState, Action } from 'shared-types'
import type { CharacterData } from 'simplequest-hud'
import { supabase } from '../lib/supabase'

type PlayerPosition = { x: number; y: number; characterId: string; direction: string; onChange: (cb: () => void) => void }
type NpcEntity = { id: string; name: string; role: string; x: number; y: number; direction: string }
type DoorEntity = { id: string; biomeId: string; label: string; x: number; y: number }
type EnemyEntity = { id: string; name: string; x: number; y: number; hp: number; maxHp: number; level: number }
type ExploreState = {
  players: { onAdd: (cb: (player: PlayerPosition, id: string) => void) => void; onRemove: (cb: (val: unknown, id: string) => void) => void }
  npcs: { onAdd: (cb: (npc: NpcEntity) => void) => void }
  doors: { onAdd: (cb: (door: DoorEntity) => void) => void }
  enemies: { onAdd: (cb: (enemy: EnemyEntity, id: string) => void) => void; onRemove: (cb: (val: unknown, id: string) => void) => void }
}

export type PlayerState = { x: number; y: number; characterId: string; direction: string }
export type NpcState = { id: string; name: string; role: string; x: number; y: number; direction: string }
export type DoorState = { id: string; biomeId: string; label: string; x: number; y: number }
export type EnemyState = { id: string; name: string; x: number; y: number }
export type InteractionEvent =
  | { type: 'npc'; id: string; name: string; role: string }
  | { type: 'door'; id: string; biomeId: string; label: string }

export function createExploreRoom(token: () => string | null, heroIds: () => string[]) {
  let room: Room<ExploreState> | undefined

  const [connected, setConnected] = createSignal(false)
  const [mySessionId, setMySessionId] = createSignal<string | null>(null)
  const [players, setPlayers] = createSignal<Record<string, PlayerState>>({})
  const [npcs, setNpcs] = createSignal<NpcState[]>([])
  const [doors, setDoors] = createSignal<DoorState[]>([])
  const [enemies, setEnemies] = createSignal<Record<string, EnemyState>>({})
  const [interaction, setInteraction] = createSignal<InteractionEvent | null>(null)
  const [encounter, setEncounter] = createSignal<EncounterEvent | null>(null)
  const [heroState, setHeroState] = createSignal<CharacterData | null>(null)
  const [sceneData, setSceneData] = createSignal<SceneData | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [combatState, setCombatState] = createSignal<CombatState | null>(null)
  const [combatResult, setCombatResult] = createSignal<'win' | 'lose' | null>(null)
  const [recoveryEndsAt, setRecoveryEndsAt] = createSignal<string | null>(null)
  const [joinOffer, setJoinOffer] = createSignal(false)
  const [actionError, setActionError] = createSignal<string | null>(null)

  createEffect(on([token, heroIds] as const, ([t, ids]) => {
    room?.leave()
    room = undefined
    setConnected(false)
    setMySessionId(null)
    setError(null)
    setPlayers({})
    setNpcs([])
    setDoors([])
    setEnemies({})
    setInteraction(null)
    setEncounter(null)
    setHeroState(null)
    setSceneData(null)
    setCombatState(null)
    setCombatResult(null)
    setRecoveryEndsAt(null)
    setJoinOffer(false)
    setActionError(null)

    if (!t) return

    supabase.auth.getSession().then(({ data }) => {
      const freshToken = data.session?.access_token ?? t
      return joinRoom<ExploreState>('ExploreRoom', { token: freshToken, heroIds: ids })
    }).then((r) => {
        room = r
        setMySessionId(r.sessionId)
        setConnected(true)

        r.state.players.onAdd((player: PlayerPosition, sessionId: string) => {
          setPlayers((prev) => ({ ...prev, [sessionId]: { x: player.x, y: player.y, characterId: player.characterId, direction: player.direction } }))
          player.onChange(() => {
            setPlayers((prev) => ({ ...prev, [sessionId]: { x: player.x, y: player.y, characterId: player.characterId, direction: player.direction } }))
          })
        })
        r.state.players.onRemove((_: unknown, sessionId: string) => {
          setPlayers((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
        })
        r.state.npcs.onAdd((npc: NpcEntity) => {
          setNpcs((prev) => [...prev, { id: npc.id, name: npc.name, role: npc.role, x: npc.x, y: npc.y, direction: npc.direction }])
        })
        r.state.doors.onAdd((door: DoorEntity) => {
          setDoors((prev) => [...prev, { id: door.id, biomeId: door.biomeId, label: door.label, x: door.x, y: door.y }])
        })
        r.state.enemies.onAdd((enemy: EnemyEntity, id: string) => {
          setEnemies((prev) => ({ ...prev, [id]: { id: enemy.id, name: enemy.name, x: enemy.x, y: enemy.y } }))
        })
        r.state.enemies.onRemove((_: unknown, id: string) => {
          setEnemies((prev) => { const next = { ...prev }; delete next[id]; return next })
        })
        r.onMessage('INTERACTION_START', (data: InteractionEvent) => {
          setInteraction(data)
        })
        r.onMessage('HERO_STATE', (data: CharacterData) => {
          setHeroState(data)
        })
        r.onMessage('SCENE_STATE', (data: SceneData) => {
          setSceneData(data)
        })
        r.onMessage('ENCOUNTER', (data: EncounterEvent) => {
          setEncounter(data)
        })
        r.onMessage('COMBAT_START', (data: CombatState) => {
          setCombatState(data)
        })
        r.onMessage('COMBAT_STATE', (data: CombatState) => {
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
        r.onMessage('ACTION_REJECTED', (data: { reason?: string }) => {
          setActionError(data.reason ?? 'Action not allowed')
          setTimeout(() => setActionError(null), 3000)
        })
        r.onMessage('MOVE_REJECTED', (data: { reason?: string }) => {
          setActionError(data.reason ?? 'Cannot move there')
          setTimeout(() => setActionError(null), 3000)
        })

        r.send('READY')
      })
      .catch((e: Error) => setError(e.message))
  }))

  onCleanup(() => room?.leave())

  const myPosition = () => {
    const id = mySessionId()
    return id ? (players()[id] ?? null) : null
  }

  return {
    connected,
    error,
    myPosition,
    mySessionId,
    players,
    npcs,
    doors,
    enemies,
    interaction,
    encounter,
    heroState,
    sceneData,
    combatState,
    combatResult,
    recoveryEndsAt,
    joinOffer,
    actionError,
    move(destination: Position) { room?.send('MOVE', { destination }) },
    interact() { room?.send('INTERACT') },
    dismissInteraction() { setInteraction(null) },
    dismissEncounter() { setEncounter(null) },
    sendAction(action: Action) { room?.send('PLAYER_ACTION', { action }) },
    endTurn() { room?.send('END_TURN') },
    joinCombat() { setJoinOffer(false); room?.send('JOIN_COMBAT') },
    dismissJoinOffer() { setJoinOffer(false) },
    dismissCombatResult() { setCombatResult(null); setRecoveryEndsAt(null) },
  }
}
