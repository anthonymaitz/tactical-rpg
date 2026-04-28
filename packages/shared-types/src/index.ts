import type { AbilityDefinition, DiceNotation, AbilityContext, AbilityEffect, TargetType } from './ability-types'
import type { Die, Personality } from './hero-persistence'

export type { AbilityDefinition, DiceNotation, AbilityContext, AbilityEffect, TargetType } from './ability-types'

export interface Position {
  x: number
  y: number
}

export interface ActorState {
  id: string
  name: string
  personality: Personality
  characterClass: string
  die: Die
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  speed: number
  position: Position
  statusEffects: string[]
  isNPC: boolean
  isGhost?: boolean
  abilities: AbilityDefinition[]
  damageBonus?: number
}

export type Action =
  | { type: 'move'; actorId: string; destination: Position }
  | { type: 'ability'; actorId: string; targetIds: string[]; ability: AbilityDefinition }
  | { type: 'skip'; actorId: string }

export interface RollResult {
  total: number
  dice: number[]
  modifier: number
  notation: string
}

export interface ActionResult {
  action: Action
  rolls: RollResult[]
  /** Positive = healing, negative = damage */
  hpDeltas: Record<string, number>
  energyDeltas: Record<string, number>
  statusEffectsApplied: Record<string, string[]>
  description: string
}

export interface CombatState {
  roomId: string
  /** Actor IDs in initiative order */
  turnQueue: string[]
  currentActorIndex: number
  actors: Record<string, ActorState>
  round: number
  log: string[]
  isOver: boolean
  winningSide?: 'players' | 'npcs'
  activeEnemyIds: string[]
}

export * from './hero-persistence'
export * from './inn-map'
export * from './explore-map'
export * from './scene-data'
export * from './combat-bfs'
export * from './inventory'
