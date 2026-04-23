import { For, Show } from 'solid-js'
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

function Cell(props: {
  x: number; y: number; isWall: boolean
  players: Record<string, PlayerState>; mySessionId: string | null
  npcs: NpcState[]; doors: DoorState[]
  onCellClick: (x: number, y: number) => void
}) {
  const npc = () => props.npcs.find((n) => n.x === props.x && n.y === props.y)
  const door = () => props.doors.find((d) => d.x === props.x && d.y === props.y)
  const player = () => {
    const entry = Object.entries(props.players).find(([, p]) => p.x === props.x && p.y === props.y)
    if (!entry) return undefined
    return { ...entry[1], isMe: entry[0] === props.mySessionId }
  }

  const bg = () => {
    if (props.isWall) return '#2a2a2a'
    if (player()) return player()!.isMe ? '#e05555' : '#ff9800'
    if (door()) return '#4caf50'
    if (npc()) return '#4a7fc1'
    return '#d4c5a0'
  }

  const label = () => {
    if (player()) return '@'
    if (door()) return 'D'
    const n = npc()
    if (n) return n.name[0]
    return ''
  }

  const title = () => npc()?.name ?? door()?.label ?? ''

  return (
    <div
      title={title()}
      onClick={() => !props.isWall && props.onCellClick(props.x, props.y)}
      style={{
        width: `${CELL_SIZE}px`,
        height: `${CELL_SIZE}px`,
        background: bg(),
        border: '1px solid rgba(0,0,0,0.1)',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'font-size': '13px',
        'font-weight': 'bold',
        color: (player() || door() || npc()) ? '#fff' : '#000',
        cursor: props.isWall ? 'default' : 'pointer',
        'user-select': 'none',
        'box-sizing': 'border-box',
      }}
    >
      {label()}
    </div>
  )
}

export function InnView(props: Props) {
  return (
    <div style={{ display: 'inline-block', border: '2px solid #333' }}>
      <For each={props.map.walls}>
        {(row, getY) => (
          <div style={{ display: 'flex' }}>
            <For each={row}>
              {(isWall, getX) => (
                <Cell
                  x={getX()} y={getY()} isWall={isWall === 1}
                  players={props.players} mySessionId={props.mySessionId}
                  npcs={props.npcs} doors={props.doors}
                  onCellClick={props.onCellClick}
                />
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  )
}
