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

export function getFrontCell(pos: Position, direction: string): Position {
  switch (direction) {
    case 'n': return { x: pos.x, y: pos.y - 1 }
    case 's': return { x: pos.x, y: pos.y + 1 }
    case 'e': return { x: pos.x + 1, y: pos.y }
    case 'w': return { x: pos.x - 1, y: pos.y }
    default:  return { x: pos.x, y: pos.y + 1 }
  }
}

export function getMovementDirection(from: Position, to: Position): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w'
  return dy >= 0 ? 's' : 'n'
}
