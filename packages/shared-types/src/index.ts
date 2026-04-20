export type Personality = 'passionate' | 'calculating' | 'wild' | 'selfish' | 'righteous'
export type Die = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
export type ActionType = 'move' | 'ability' | 'skip'
export type AbilityContext = 'inGeneral' | 'inCombat' | 'outOfCombat'
export type AbilityEffect = 'damage' | 'heal' | 'buff' | 'debuff'
export type TargetType = 'enemy' | 'ally' | 'self' | 'area'

export interface Position {
  x: number
  y: number
}

export interface AbilityDefinition {
  id: string
  name: string
  energyCost: number
  /** Dice notation string e.g. '1d8', '2d6+2'. Use 'actor' to roll the actor's own die. */
  diceNotation: string
  targetType: TargetType
  effect: AbilityEffect
  statusEffect?: string
  context: AbilityContext
}

export interface ActorState {
  id: string
  name: string
  personality: Personality
  class: string
  die: Die
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  speed: number
  position: Position
  statusEffects: string[]
  isNPC: boolean
  abilities: AbilityDefinition[]
}

export interface Action {
  type: ActionType
  actorId: string
  targetIds?: string[]
  ability?: AbilityDefinition
  destination?: Position
}

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
}
