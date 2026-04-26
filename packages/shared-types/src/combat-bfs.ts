import type { Position } from './index'

function isWalkable(pos: Position, walls: number[][]): boolean {
  if (walls.length === 0) return false
  if (pos.y < 0 || pos.y >= walls.length) return false
  if (pos.x < 0 || pos.x >= (walls[0]?.length ?? 0)) return false
  return walls[pos.y][pos.x] === 0
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

export function getMoveCost(
  origin: Position,
  destination: Position,
  walls: number[][],
): number | null {
  if (!isWalkable(destination, walls)) return null
  if (origin.x === destination.x && origin.y === destination.y) return 0

  const key = (p: Position) => `${p.x},${p.y}`
  const queue: Array<{ pos: Position; cost: number }> = [{ pos: origin, cost: 0 }]
  const visited = new Set<string>([key(origin)])

  while (queue.length > 0) {
    const { pos, cost } = queue.shift()!
    for (const [dx, dy] of DIRS) {
      const next: Position = { x: pos.x + dx, y: pos.y + dy }
      if (next.x === destination.x && next.y === destination.y) return cost + 1
      if (!isWalkable(next, walls)) continue
      const k = key(next)
      if (visited.has(k)) continue
      visited.add(k)
      queue.push({ pos: next, cost: cost + 1 })
    }
  }
  return null
}

export function getReachableCells(
  origin: Position,
  walls: number[][],
  energyBudget: number,
): Position[] {
  const key = (p: Position) => `${p.x},${p.y}`
  const queue: Array<{ pos: Position; cost: number }> = [{ pos: origin, cost: 0 }]
  const visited = new Set<string>([key(origin)])
  const result: Position[] = []

  while (queue.length > 0) {
    const { pos, cost } = queue.shift()!
    for (const [dx, dy] of DIRS) {
      const next: Position = { x: pos.x + dx, y: pos.y + dy }
      const nextCost = cost + 1
      if (nextCost > energyBudget) continue
      if (!isWalkable(next, walls)) continue
      const k = key(next)
      if (visited.has(k)) continue
      visited.add(k)
      queue.push({ pos: next, cost: nextCost })
      result.push(next)
    }
  }
  return result
}
