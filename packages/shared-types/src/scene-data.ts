import type { InnMap } from './inn-map'

/** col = x (left→right), row = y (top→bottom), matching InnMap.walls[row][col] */
export interface SceneBuilding {
  col: number
  row: number
  tileId: string
  instanceId?: string
}

export interface SceneLayer {
  id: number
  background: string
}

export interface SceneProp {
  id: string
  col: number
  row: number
  tileId: string
}

export interface SceneToken {
  id: string
  type: 'npc' | 'door' | 'enemy' | 'spawn-point'
  col: number
  row: number
  role?: 'innkeeper' | 'blacksmith' | 'doorkeeper'
  name?: string
  biomeId?: string
  label?: string
  level?: number
  spawnRadius?: number
  direction?: string
}

export interface EncounterEvent {
  enemyId: string
  enemyName: string
  x: number
  y: number
}

export interface SceneData {
  buildings: SceneBuilding[]
  layers: SceneLayer[]
  props: SceneProp[]
  tokens: SceneToken[]
  weather: string
}

export function generateSceneFromInn(inn: InnMap): SceneData {
  const buildings: SceneBuilding[] = []
  for (let row = 0; row < inn.walls.length; row++) {
    for (let col = 0; col < (inn.walls[row]?.length ?? 0); col++) {
      if (inn.walls[row][col] === 1) {
        buildings.push({ col, row, tileId: 'wall-wood', instanceId: `${col},${row}` })
      }
    }
  }

  const tokens: SceneToken[] = [
    ...inn.npcs.map(npc => ({
      id: npc.id,
      type: 'npc' as const,
      col: npc.x,
      row: npc.y,
      role: npc.role,
      name: npc.name,
      direction: npc.direction,
    })),
    ...inn.doors.map(door => ({
      id: door.id,
      type: 'door' as const,
      col: door.x,
      row: door.y,
      biomeId: door.biomeId,
      label: door.label,
    })),
  ]

  return {
    buildings,
    layers: [{ id: 1, background: 'grass' }],
    props: [],
    tokens,
    weather: 'sunny',
  }
}
