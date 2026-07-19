import { createSignal, createEffect, on, onCleanup } from 'solid-js'
import { joinRoom } from './useGameServer'
import type { Room } from 'colyseus.js'
import { THE_INN } from 'shared-types'
import type { Position, SceneData, EncounterEvent, CombatState, Action, ActionResult } from 'shared-types'
import type { CharacterData } from 'simplequest-hud'
import { auth } from '../lib/auth'

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
  | { type: 'npc'; id: string; name: string; role: string; biomeId?: string }
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
  const [actionResult, setActionResult] = createSignal<ActionResult | null>(null)
  const [emoteEvent, setEmoteEvent] = createSignal<{ id: string; emote: string } | null>(null)
  const [speechEvent, setSpeechEvent] = createSignal<{ id: string; speech: string } | null>(null)
  const [actionEvent, setActionEvent] = createSignal<{ id: string; action: string } | null>(null)

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

    auth.getSession().then(({ data }) => {
      const freshToken = data.session?.access_token ?? t
      return joinRoom<ExploreState>('ExploreRoom', { token: freshToken, heroIds: ids })
    }).then((r) => {
        room = r
        setMySessionId(r.sessionId)
        setConnected(true)

        // Schema onAdd callbacks kept for diagnostics — fires only if binary schema sync works
        r.state.players.onAdd((player: PlayerPosition, sessionId: string) => {
          console.log('[useExploreRoom] schema onAdd player', sessionId)
          setPlayers((prev) => ({ ...prev, [sessionId]: { x: player.x, y: player.y, characterId: player.characterId, direction: player.direction } }))
          player.onChange(() => {
            setPlayers((prev) => ({ ...prev, [sessionId]: { x: player.x, y: player.y, characterId: player.characterId, direction: player.direction } }))
          })
        })
        r.state.players.onRemove((_: unknown, sessionId: string) => {
          setPlayers((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
        })
        r.state.npcs.onAdd((npc: NpcEntity) => {
          console.log('[useExploreRoom] schema onAdd npc', npc.id)
          setNpcs((prev) => [...prev, { id: npc.id, name: npc.name, role: npc.role, x: npc.x, y: npc.y, direction: npc.direction }])
        })
        r.state.doors.onAdd((door: DoorEntity) => {
          console.log('[useExploreRoom] schema onAdd door', door.id)
          setDoors((prev) => [...prev, { id: door.id, biomeId: door.biomeId, label: door.label, x: door.x, y: door.y }])
        })
        r.state.enemies.onAdd((enemy: EnemyEntity, id: string) => {
          console.log('[useExploreRoom] schema onAdd enemy', id)
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
          // Add self player at spawn if schema onAdd never fired
          setPlayers((prev) => {
            if (prev[r.sessionId]) return prev
            return { ...prev, [r.sessionId]: { x: THE_INN.spawnX, y: THE_INN.spawnY, characterId: r.sessionId, direction: 's' } }
          })
        })
        r.onMessage('SCENE_STATE', (data: SceneData) => {
          setSceneData(data)
          // Populate static entities directly from scene JSON (bypasses schema binary sync)
          const sceneNpcs = (data.tokens ?? [])
            .filter((t) => t.type === 'npc')
            .map((t) => ({ id: t.id, name: t.name ?? '', role: t.role ?? '', x: t.col, y: t.row, direction: t.direction ?? 's' }))
          const sceneDoors = (data.tokens ?? [])
            .filter((t) => t.type === 'door')
            .map((t) => ({ id: t.id, biomeId: t.biomeId ?? '', label: t.label ?? '', x: t.col, y: t.row }))
          if (sceneNpcs.length > 0) setNpcs(sceneNpcs)
          if (sceneDoors.length > 0) setDoors(sceneDoors)
        })
        // JSON position updates — used when binary schema sync is unavailable
        r.onMessage('PLAYER_LIST', (data: Array<{ sessionId: string; x: number; y: number; direction: string }>) => {
          setPlayers((prev) => {
            const updates: Record<string, PlayerState> = {}
            for (const p of data) {
              updates[p.sessionId] = { x: p.x, y: p.y, characterId: p.sessionId, direction: p.direction }
            }
            return { ...updates, ...prev }
          })
        })
        r.onMessage('PLAYER_MOVED', (data: { sessionId: string; x: number; y: number; direction: string }) => {
          setPlayers((prev) => ({
            ...prev,
            [data.sessionId]: { x: data.x, y: data.y, characterId: prev[data.sessionId]?.characterId ?? data.sessionId, direction: data.direction },
          }))
        })
        r.onMessage('PLAYER_LEFT', (data: { sessionId: string }) => {
          setPlayers((prev) => { const next = { ...prev }; delete next[data.sessionId]; return next })
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
        r.onMessage('COMBAT_END', (data: { result: 'win' | 'lose' | 'cancelled'; recoveryEndsAt?: string }) => {
          if (data.result === 'cancelled') { setCombatState(null); return }
          setCombatResult(data.result)
          setRecoveryEndsAt(data.recoveryEndsAt ?? null)
          if (data.result === 'win') setCombatState(null)
        })
        r.onMessage('COMBAT_JOIN_OFFER', () => {
          setJoinOffer(true)
        })
        r.onMessage('EMOTE_EVENT', (data: { id: string; emote: string }) => {
          setEmoteEvent({ id: data.id, emote: data.emote })
        })
        r.onMessage('SPEECH_EVENT', (data: { id: string; speech: string }) => {
          setSpeechEvent({ id: data.id, speech: data.speech })
        })
        r.onMessage('ACTION_EVENT', (data: { id: string; action: string }) => {
          setActionEvent({ id: data.id, action: data.action })
        })
        r.onMessage('ACTION_RESULT', (data: ActionResult) => {
          setActionResult(data)
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
    actionResult,
    emoteEvent,
    speechEvent,
    actionEvent,
    move(destination: Position) { room?.send('MOVE', { destination }) },
    face(direction: string) { room?.send('FACE', { direction }) },
    rest() { room?.send('REST') },
    dismissInteraction() { setInteraction(null) },
    dismissEncounter() { setEncounter(null) },
    sendAction(action: Action) { room?.send('PLAYER_ACTION', { action }) },
    endTurn() { room?.send('END_TURN') },
    joinCombat() { setJoinOffer(false); room?.send('JOIN_COMBAT') },
    dismissJoinOffer() { setJoinOffer(false) },
    dismissCombatResult() { setCombatResult(null); setRecoveryEndsAt(null) },
    emote(emote: string) { room?.send('EMOTE', { emote }) },
    speech(speech: string) { room?.send('SPEECH', { speech }) },
    action(action: string) { room?.send('TOKEN_ACTION', { action }) },
  }
}
