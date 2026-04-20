export type AbilityContext = 'inGeneral' | 'inCombat' | 'outOfCombat'
export type AbilityEffect = 'damage' | 'heal' | 'buff' | 'debuff'
export type TargetType = 'enemy' | 'ally' | 'self' | 'area'

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
