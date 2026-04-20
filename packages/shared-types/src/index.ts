export type Personality = 'passionate' | 'calculating' | 'wild' | 'selfish' | 'righteous'
export type Die = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
export type AbilityContext = 'inGeneral' | 'inCombat' | 'outOfCombat'
export type AbilityEffect = 'damage' | 'heal' | 'buff' | 'debuff'
export type TargetType = 'enemy' | 'ally' | 'self' | 'area'

export interface Position {
  x: number
  y: number
}

export type DiceNotation =
  | { kind: 'notation'; value: string }
  | { kind: 'actor' }

export interface AbilityDefinition {
  id: string
  name: string
  energyCost: number
  /** Dice notation e.g. { kind: 'notation', value: '1d8' } or { kind: 'actor' } to roll the actor's own die. */
  diceNotation: DiceNotation
  targetType: TargetType
  effect: AbilityEffect
  statusEffect?: string[]
  context: AbilityContext
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
  abilities: AbilityDefinition[]
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
}

export * from './hero-persistence'
