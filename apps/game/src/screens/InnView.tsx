import type { InnMap } from 'shared-types'
import type { PlayerState, NpcState, DoorState } from '../hooks/useExploreRoom'

const CELL_SIZE = 36

type Props = {
  map: InnMap
  players: Record<string, PlayerState>
  mySessionId: string | null
  npcs: NpcState[]
  doors: DoorState[]
  onCellClick: (x: number, y: number) => void
}

export function InnView({ map, players, mySessionId, npcs, doors, onCellClick }: Props) {
  const npcsByPos = Object.fromEntries(npcs.map((n) => [`${n.x},${n.y}`, n]))
  const doorsByPos = Object.fromEntries(doors.map((d) => [`${d.x},${d.y}`, d]))
  const playersByPos = Object.fromEntries(
    Object.entries(players).map(([sid, p]) => [`${p.x},${p.y}`, { ...p, isMe: sid === mySessionId }])
  )

  return (
    <div style={{ display: 'inline-block', border: '2px solid #333' }}>
      {map.walls.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {row.map((isWall, x) => {
            const key = `${x},${y}`
            const npc = npcsByPos[key]
            const door = doorsByPos[key]
            const player = playersByPos[key]

            let bg = isWall ? '#2a2a2a' : '#d4c5a0'
            let label = ''
            let color = '#000'
            let title = ''

            if (npc)    { bg = '#4a7fc1'; label = npc.name[0];  color = '#fff'; title = npc.name }
            if (door)   { bg = '#4caf50'; label = 'D';           color = '#fff'; title = door.label }
            if (player) { bg = player.isMe ? '#e05555' : '#ff9800'; label = '@'; color = '#fff' }

            return (
              <div
                key={x}
                title={title}
                onClick={() => !isWall && onCellClick(x, y)}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  background: bg,
                  border: '1px solid rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 'bold',
                  color,
                  cursor: isWall ? 'default' : 'pointer',
                  userSelect: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {label}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
