import type { AbilityDefinition } from './ability-types'

export type Die = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
export type Personality = 'passionate' | 'calculating' | 'wild' | 'selfish' | 'righteous'
export type Profession =
  | 'animal-trainer' | 'criminal' | 'diplomat' | 'merchant' | 'performer'
  | 'priest' | 'scout' | 'soldier' | 'tinkerer' | 'warlock'

export const PROFESSIONS: Profession[] = [
  'animal-trainer', 'criminal', 'diplomat', 'merchant', 'performer',
  'priest', 'scout', 'soldier', 'tinkerer', 'warlock',
]

export type GearSlots = {
  weapon: string | null
  offhand: string | null
  armor: string | null
  trinket: string | null
}

export type HeroRecord = {
  id: string
  userId: string
  name: string
  characterClass: string
  personality: Personality
  profession: Profession
  die: Die
  level: number
  xp: number
  maxHp: number
  maxEnergy: number
  speed: number
  abilities: AbilityDefinition[]
  gear: GearSlots
  recoveryEndsAt: string | null
  createdAt: string
}

export const PERSONALITIES: Personality[] = [
  'passionate',
  'calculating',
  'wild',
  'selfish',
  'righteous',
]

export function isRecovering(hero: HeroRecord): boolean {
  if (!hero.recoveryEndsAt) return false
  return new Date(hero.recoveryEndsAt) > new Date()
}
