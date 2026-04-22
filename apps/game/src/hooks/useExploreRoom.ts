import { useState, useEffect, useRef } from 'react'
import { useGameServer } from './useGameServer'
import type { Room } from 'colyseus.js'
import type { Position } from 'shared-types'

// Schema types from ExploreState
type PlayerPosition = { x: number; y: number; characterId: string; onChange: (cb: () => void) => void }
type NpcEntity = { id: string; name: string; role: string; x: number; y: number }
type DoorEntity = { id: string; biomeId: string; label: string; x: number; y: number }
type ExploreState = { players: { onAdd: (cb: (player: PlayerPosition, id: string) => void) => void; onRemove: (cb: (val: unknown, id: string) => void) => void }; npcs: { onAdd: (cb: (npc: NpcEntity) => void) => void }; doors: { onAdd: (cb: (door: DoorEntity) => void) => void } }

export type PlayerState = { x: number; y: number; characterId: string }
export type NpcState = { id: string; name: string; role: string; x: number; y: number }
export type DoorState = { id: string; biomeId: string; label: string; x: number; y: number }
export type InteractionEvent =
  | { type: 'npc'; id: string; name: string; role: string }
  | { type: 'door'; id: string; biomeId: string; label: string }

export function useExploreRoom(token: string | null, heroIds: string[]) {
  const { joinRoom } = useGameServer()
  const roomRef = useRef<Room<ExploreState> | null>(null)
  const [connected, setConnected] = useState(false)
  const [mySessionId, setMySessionId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Record<string, PlayerState>>({})
  const [npcs, setNpcs] = useState<NpcState[]>([])
  const [doors, setDoors] = useState<DoorState[]>([])
  const [interaction, setInteraction] = useState<InteractionEvent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let room: Room<ExploreState>

    joinRoom<ExploreState>('ExploreRoom', { token, heroIds })
      .then((r) => {
        room = r
        roomRef.current = r
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
      })
      .catch((e: Error) => setError(e.message))

    return () => {
      room?.leave()
      roomRef.current = null
      setConnected(false)
      setPlayers({})
      setNpcs([])
      setDoors([])
    }
  }, [token])

  function move(destination: Position) {
    roomRef.current?.send('MOVE', { destination })
  }

  function interact() {
    roomRef.current?.send('INTERACT')
  }

  function dismissInteraction() {
    setInteraction(null)
  }

  const myPosition = mySessionId ? (players[mySessionId] ?? null) : null

  return { connected, error, myPosition, mySessionId, players, npcs, doors, interaction, move, interact, dismissInteraction }
}
