import type { CombatState } from 'shared-types'

export interface CombatOverPayload {
  winningSide: 'players' | 'npcs' | undefined
  log: string[]
  round: number
}

export function buildCombatOverPayload(state: CombatState): CombatOverPayload {
  return {
    winningSide: state.winningSide,
    log: state.log,
    round: state.round,
  }
}
