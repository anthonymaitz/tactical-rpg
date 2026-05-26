import type { Action, ActorState, AbilityDefinition, CombatState, Position } from 'shared-types'

function isWalkable(pos: Position, walls: number[][]): boolean {
  if (walls.length === 0) return true
  if (pos.y < 0 || pos.y >= walls.length) return false
  if (pos.x < 0 || pos.x >= (walls[0]?.length ?? 0)) return false
  return walls[pos.y][pos.x] === 0
}

export function getValidActions(actorId: string, state: CombatState, walls: number[][] = []): Action[] {
  const actor = state.actors[actorId]
  if (!actor || actor.hp <= 0) return []

  const actions: Action[] = [{ type: 'skip', actorId }]

  const occupied = new Set(
    Object.values(state.actors)
      .filter(a => a.id !== actorId && a.hp > 0)
      .map(a => `${a.position.x},${a.position.y}`),
  )
  for (let dx = -actor.speed; dx <= actor.speed; dx++) {
    for (let dy = -actor.speed; dy <= actor.speed; dy++) {
      if (dx === 0 && dy === 0) continue
      if (Math.abs(dx) + Math.abs(dy) > actor.speed) continue
      const dest = { x: actor.position.x + dx, y: actor.position.y + dy }
      if (!isWalkable(dest, walls)) continue
      if (!occupied.has(`${dest.x},${dest.y}`)) {
        actions.push({ type: 'move', actorId, destination: dest })
      }
    }
  }

  for (const ability of actor.abilities) {
    if (ability.context === 'outOfCombat') continue
    if (actor.energy < ability.energyCost) continue
    const targets = getValidTargets(actorId, ability, actor, state)
    for (const targetId of targets) {
      actions.push({ type: 'ability', actorId, ability, targetIds: [targetId] })
    }
  }

  return actions
}

function getValidTargets(
  actorId: string,
  ability: AbilityDefinition,
  actor: ActorState,
  state: CombatState,
): string[] {
  const alive = Object.values(state.actors).filter(a => a.hp > 0)
  switch (ability.targetType) {
    case 'enemy':
      return alive.filter(a => a.isNPC !== actor.isNPC).map(a => a.id)
    case 'ally':
      return alive.filter(a => a.isNPC === actor.isNPC && a.id !== actorId).map(a => a.id)
    case 'self':
      return alive.filter(a => a.id === actorId).map(a => a.id)
    case 'area':
      return alive.filter(a => a.isNPC !== actor.isNPC).map(a => a.id)
    default: {
      const _exhaustive: never = ability.targetType
      return []
    }
  }
}
