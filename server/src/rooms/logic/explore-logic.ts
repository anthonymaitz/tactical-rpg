import type { Position, InnMap } from 'shared-types'

export function getManhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function isValidMove(current: Position, destination: Position, speed: number): boolean {
  const dist = getManhattanDistance(current, destination)
  return dist > 0 && dist <= speed
}

export function isWalkable(map: InnMap, pos: Position): boolean {
  if (map.walls.length === 0) return false
  if (pos.x < 0 || pos.y < 0 || pos.y >= map.walls.length || pos.x >= map.walls[0].length) return false
  return map.walls[pos.y][pos.x] === 0
}

export function isAdjacent(a: Position, b: Position): boolean {
  return getManhattanDistance(a, b) === 1
}

