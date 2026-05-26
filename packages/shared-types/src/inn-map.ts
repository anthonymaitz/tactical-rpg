export type FacingDir = 'n' | 'e' | 's' | 'w'

export type NpcRole = 'innkeeper' | 'blacksmith' | 'sage'

export type InnNpc = {
  id: string
  name: string
  role: NpcRole
  x: number
  y: number
  direction: FacingDir
}

export function getFrontCell(pos: { x: number; y: number }, direction: string): { x: number; y: number } {
  switch (direction) {
    case 'n': return { x: pos.x, y: pos.y - 1 }
    case 's': return { x: pos.x, y: pos.y + 1 }
    case 'e': return { x: pos.x + 1, y: pos.y }
    case 'w': return { x: pos.x - 1, y: pos.y }
    default:  return { x: pos.x, y: pos.y + 1 }
  }
}

export function getMovementDirection(from: { x: number; y: number }, to: { x: number; y: number }): FacingDir {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w'
  return dy >= 0 ? 's' : 'n'
}

export type InnDoor = {
  id: string
  biomeId: string
  label: string
  x: number
  y: number
}

export type InnMap = {
  width: number
  height: number
  spawnX: number
  spawnY: number
  /** 0 = floor, 1 = wall. Indexed as walls[y][x]. */
  walls: number[][]
  npcs: InnNpc[]
  doors: InnDoor[]
}

// prettier-ignore
const W = 1, F = 0

// prettier-ignore
export const THE_INN: InnMap = {
  width: 20,
  height: 14,
  spawnX: 10,
  spawnY: 7,
  walls: [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  ],
  npcs: [
    { id: 'innkeeper',  name: 'Innkeeper',  role: 'innkeeper',  x: 10, y: 2, direction: 's' },
    { id: 'blacksmith', name: 'Blacksmith', role: 'blacksmith', x: 4,  y: 7, direction: 'e' },
    { id: 'sage',       name: 'Sage',       role: 'sage',       x: 7,  y: 2, direction: 's' },
  ],
  doors: [
    { id: 'door-forest',  biomeId: 'verdant-forest',  label: 'Verdant Forest',  x: 4,  y: 12 },
    { id: 'door-dungeon', biomeId: 'dungeon-depths',   label: 'Dungeon Depths',  x: 10, y: 12 },
    { id: 'door-castle',  biomeId: 'ruined-castle',    label: 'Ruined Castle',   x: 16, y: 12 },
  ],
}
