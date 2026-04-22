export type NpcRole = 'innkeeper' | 'blacksmith' | 'doorkeeper'

export type InnNpc = {
  id: string
  name: string
  role: NpcRole
  x: number
  y: number
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
    { id: 'innkeeper',         name: 'Innkeeper',        role: 'innkeeper',  x: 10, y: 2  },
    { id: 'blacksmith',        name: 'Blacksmith',        role: 'blacksmith', x: 4,  y: 7  },
    { id: 'doorkeeper-forest', name: 'Forest Doorkeeper', role: 'doorkeeper', x: 16, y: 7  },
  ],
  doors: [
    { id: 'door-forest', biomeId: 'verdant-forest', label: 'Verdant Forest', x: 16, y: 12 },
  ],
}
