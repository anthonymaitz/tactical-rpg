import type { Position } from 'shared-types'

export function getManhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function isValidMove(current: Position, destination: Position, speed: number): boolean {
  const dist = getManhattanDistance(current, destination)
  return dist > 0 && dist <= speed
}
