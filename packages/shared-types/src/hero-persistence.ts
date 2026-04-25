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

export type StarterClass = {
  name: string
  die: Die
  maxHp: number
  maxEnergy: number
  speed: number
  abilities: AbilityDefinition[]
}

// Class names match SimpleQuest ability sources — SQ is source of truth for content
export const STARTER_CLASSES: StarterClass[] = [
  {
    name: 'fighter',
    die: 'd8',
    maxHp: 20,
    maxEnergy: 4,
    speed: 3,
    abilities: [
      {
        id: 'strike',
        name: 'Strike',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'shield-bash',
        name: 'Shield Bash',
        energyCost: 2,
        diceNotation: { kind: 'notation', value: '1d6' },
        targetType: 'enemy',
        effect: 'debuff',
        statusEffect: ['stunned'],
        context: 'inCombat',
      },
    ],
  },
  {
    name: 'wizard',
    die: 'd6',
    maxHp: 12,
    maxEnergy: 6,
    speed: 3,
    abilities: [
      {
        id: 'magic-bolt',
        name: 'Magic Bolt',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'frost-nova',
        name: 'Frost Nova',
        energyCost: 3,
        diceNotation: { kind: 'notation', value: '1d4' },
        targetType: 'area',
        effect: 'debuff',
        statusEffect: ['slowed'],
        context: 'inCombat',
      },
    ],
  },
  {
    name: 'marksman',
    die: 'd6',
    maxHp: 14,
    maxEnergy: 5,
    speed: 4,
    abilities: [
      {
        id: 'shoot',
        name: 'Shoot',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'smoke-bomb',
        name: 'Smoke Bomb',
        energyCost: 2,
        diceNotation: { kind: 'notation', value: '1d4' },
        targetType: 'area',
        effect: 'debuff',
        statusEffect: ['blinded'],
        context: 'inCombat',
      },
    ],
  },
  {
    name: 'sage',
    die: 'd6',
    maxHp: 16,
    maxEnergy: 5,
    speed: 3,
    abilities: [
      {
        id: 'hex',
        name: 'Hex',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'heal',
        name: 'Heal',
        energyCost: 2,
        diceNotation: { kind: 'notation', value: '1d6' },
        targetType: 'ally',
        effect: 'heal',
        context: 'inCombat',
      },
    ],
  },
  {
    name: 'monk',
    die: 'd8',
    maxHp: 18,
    maxEnergy: 5,
    speed: 4,
    abilities: [
      {
        id: 'kung-fu',
        name: 'Kung Fu',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'judo-throw',
        name: 'Judo Throw',
        energyCost: 3,
        diceNotation: { kind: 'notation', value: '1d6' },
        targetType: 'enemy',
        effect: 'debuff',
        statusEffect: ['stunned'],
        context: 'inCombat',
      },
    ],
  },
]

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
