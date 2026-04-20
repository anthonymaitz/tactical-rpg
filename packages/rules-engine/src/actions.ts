import type { Action, ActionResult, CombatState } from 'shared-types'
import { rollDice } from './dice'

export function resolveAction(
  actorId: string,
  action: Action,
  state: CombatState,
): ActionResult {
  const actor = state.actors[actorId]
  if (!actor) throw new Error(`Actor "${actorId}" not found in combat state`)

  if (action.type === 'skip') {
    return {
      action,
      rolls: [],
      hpDeltas: {},
      energyDeltas: {},
      statusEffectsApplied: {},
      description: `${actor.name} skips their turn.`,
    }
  }

  if (action.type === 'move') {
    const dest = action.destination
    return {
      action,
      rolls: [],
      hpDeltas: {},
      energyDeltas: {},
      statusEffectsApplied: {},
      description: `${actor.name} moves to (${dest.x}, ${dest.y}).`,
    }
  }

  if (action.type === 'ability') {
    const { ability, targetIds } = action
    const notation =
      ability.diceNotation.kind === 'actor'
        ? `1${actor.die}`
        : ability.diceNotation.value
    const roll = rollDice(notation)

    const hpDeltas: Record<string, number> = {}
    const energyDeltas: Record<string, number> = { [actorId]: -ability.energyCost }
    const statusEffectsApplied: Record<string, string[]> = {}

    for (const targetId of targetIds) {
      if (ability.effect === 'damage') hpDeltas[targetId] = -roll.total
      if (ability.effect === 'heal') hpDeltas[targetId] = roll.total
      if (ability.statusEffect) statusEffectsApplied[targetId] = ability.statusEffect
    }

    return {
      action,
      rolls: [roll],
      hpDeltas,
      energyDeltas,
      statusEffectsApplied,
      description: `${actor.name} uses ${ability.name} for ${roll.total}.`,
    }
  }

  throw new Error(`Unknown action type`)
}

export function applyResult(result: ActionResult, state: CombatState): CombatState {
  let actors = { ...state.actors }

  for (const [id, delta] of Object.entries(result.hpDeltas)) {
    const a = actors[id]
    if (a) actors[id] = { ...a, hp: Math.min(a.maxHp, Math.max(0, a.hp + delta)) }
  }

  for (const [id, delta] of Object.entries(result.energyDeltas)) {
    const a = actors[id]
    if (a) actors[id] = { ...a, energy: Math.min(a.maxEnergy, Math.max(0, a.energy + delta)) }
  }

  for (const [id, effects] of Object.entries(result.statusEffectsApplied)) {
    const a = actors[id]
    if (a) actors[id] = { ...a, statusEffects: [...new Set([...a.statusEffects, ...effects])] }
  }

  if (result.action.type === 'move') {
    const a = actors[result.action.actorId]
    if (a) actors[result.action.actorId] = { ...a, position: result.action.destination }
  }

  const playersAlive = Object.values(actors).some(a => !a.isNPC && a.hp > 0)
  const npcsAlive = Object.values(actors).some(a => a.isNPC && a.hp > 0)
  const isOver = !playersAlive || !npcsAlive
  const winningSide = isOver ? (playersAlive ? 'players' : 'npcs') : undefined

  return {
    ...state,
    actors,
    log: [...state.log, result.description],
    isOver,
    ...(winningSide !== undefined && { winningSide }),
  }
}
