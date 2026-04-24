import { createSignal, createEffect, on, onCleanup } from 'solid-js'
import { joinRoom } from './useGameServer'
import type { Room } from 'colyseus.js'
import type { Position, SceneData } from 'shared-types'
import type { CharacterData } from 'simplequest-hud'

type PlayerPosition = { x: number; y: number; characterId: string; onChange: (cb: () => void) => void }
type NpcEntity = { id: string; name: string; role: string; x: number; y: number }
type DoorEntity = { id: string; biomeId: string; label: string; x: number; y: number }
type ExploreState = {
  players: { onAdd: (cb: (player: PlayerPosition, id: string) => void) => void; onRemove: (cb: (val: unknown, id: string) => void) => void }
  npcs: { onAdd: (cb: (npc: NpcEntity) => void) => void }
  doors: { onAdd: (cb: (door: DoorEntity) => void) => void }
}

export type PlayerState = { x: number; y: number; characterId: string }
export type NpcState = { id: string; name: string; role: string; x: number; y: number }
export type DoorState = { id: string; biomeId: string; label: string; x: number; y: number }
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
  const [interaction, setInteraction] = createSignal<InteractionEvent | null>(null)
  const [heroState, setHeroState] = createSignal<CharacterData | null>(null)
  const [sceneData, setSceneData] = createSignal<SceneData | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  createEffect(on([token, heroIds] as const, ([t, ids]) => {
    room?.leave()
    room = undefined
    setConnected(false)
    setMySessionId(null)
    setError(null)
    setPlayers({})
    setNpcs([])
    setDoors([])
    setInteraction(null)
    setHeroState(null)

    if (!t) return

    joinRoom<ExploreState>('ExploreRoom', { token: t, heroIds: ids })
      .then((r) => {
        room = r
        setMySessionId(r.sessionId)
        setConnected(true)

        r.state.players.onAdd((player: PlayerPosition, sessionId: string) => {
          setPlayers((prev) => ({ ...prev, [sessionId]: { x: player.x, y: player.y, characterId: player.characterId } }))
          player.onChange(() => {
            setPlayers((prev) => ({ ...prev, [sessionId]: { x: player.x, y: player.y, characterId: player.characterId } }))
          })
        })
        r.state.players.onRemove((_: unknown, sessionId: string) => {
          setPlayers((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
        })
        r.state.npcs.onAdd((npc: NpcEntity) => {
          setNpcs((prev) => [...prev, { id: npc.id, name: npc.name, role: npc.role, x: npc.x, y: npc.y }])
        })
        r.state.doors.onAdd((door: DoorEntity) => {
          setDoors((prev) => [...prev, { id: door.id, biomeId: door.biomeId, label: door.label, x: door.x, y: door.y }])
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
    interaction,
    heroState,
    sceneData,
    move(destination: Position) { room?.send('MOVE', { destination }) },
    interact() { room?.send('INTERACT') },
    dismissInteraction() { setInteraction(null) },
  }
}
