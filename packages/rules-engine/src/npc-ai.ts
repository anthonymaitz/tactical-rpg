import type { Action, CombatState } from 'shared-types'
import { getValidActions } from './valid-actions'

export function decideNPCAction(npcId: string, state: CombatState): Action {
  const npc = state.actors[npcId]
  if (!npc || npc.hp <= 0) return { type: 'skip', actorId: npcId }

  const valid = getValidActions(npcId, state)
  if (valid.length === 0) return { type: 'skip', actorId: npcId }

  const abilities = valid.filter(a => a.type === 'ability')
  const moves = valid.filter(a => a.type === 'move')

  switch (npc.personality) {
    case 'passionate':
    case 'calculating':
      if (abilities.length > 0) return abilities[0]
      if (moves.length > 0) return closestMoveToEnemy(npcId, moves, state)
      break

    case 'wild':
      return valid[Math.floor(Math.random() * valid.length)]

    case 'selfish': {
      const selfHeal = abilities.find(
        a => a.type === 'ability' && a.ability.effect === 'heal' && a.targetIds.includes(npcId),
      )
      if (selfHeal && npc.hp < npc.maxHp * 0.5) return selfHeal
      if (abilities.length > 0) return abilities[0]
      if (moves.length > 0) return farthestMoveFromEnemy(npcId, moves, state)
      break
    }

    case 'righteous': {
      const allyHeal = abilities.find(
        a => a.type === 'ability' && a.ability.effect === 'heal' && !a.targetIds.includes(npcId),
      )
      if (allyHeal) return allyHeal
      if (abilities.length > 0) return abilities[0]
      if (moves.length > 0) return closestMoveToEnemy(npcId, moves, state)
      break
    }
  }

  return { type: 'skip', actorId: npcId }
}

function closestMoveToEnemy(npcId: string, moves: Action[], state: CombatState): Action {
  const npc = state.actors[npcId]
  const enemies = Object.values(state.actors).filter(a => a.isNPC !== npc.isNPC && a.hp > 0)
  if (enemies.length === 0) return moves[0]
  const target = enemies[0]
  return moves.reduce((best, action) => {
    if (action.type !== 'move' || best.type !== 'move') return best
    const distAction = Math.abs(action.destination.x - target.position.x) + Math.abs(action.destination.y - target.position.y)
    const distBest = Math.abs(best.destination.x - target.position.x) + Math.abs(best.destination.y - target.position.y)
    return distAction < distBest ? action : best
  })
}

function farthestMoveFromEnemy(npcId: string, moves: Action[], state: CombatState): Action {
  const npc = state.actors[npcId]
  const enemies = Object.values(state.actors).filter(a => a.isNPC !== npc.isNPC && a.hp > 0)
  if (enemies.length === 0) return moves[0]
  const target = enemies[0]
  return moves.reduce((best, action) => {
    if (action.type !== 'move' || best.type !== 'move') return best
    const distAction = Math.abs(action.destination.x - target.position.x) + Math.abs(action.destination.y - target.position.y)
    const distBest = Math.abs(best.destination.x - target.position.x) + Math.abs(best.destination.y - target.position.y)
    return distAction > distBest ? action : best
  })
}
