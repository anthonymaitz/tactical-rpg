import type { ActorState } from 'shared-types'

export function rollInitiativeOrder(actors: ActorState[]): string[] {
  return [...actors]
    .sort((a, b) => b.speed - a.speed)
    .map(a => a.id)
}

export function advanceTurn(queue: string[], currentIndex: number): number {
  return (currentIndex + 1) % queue.length
}
