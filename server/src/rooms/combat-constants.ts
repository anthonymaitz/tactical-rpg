import { WEAPON_DAMAGE_BONUSES } from 'shared-types'
import type { AbilityDefinition } from 'shared-types'

export function weaponDamageBonus(weapon: string | null | undefined): number {
  if (!weapon) return 0
  return WEAPON_DAMAGE_BONUSES[weapon] ?? 0
}

export const ENEMY_SLASH: AbilityDefinition = {
  id: 'slash',
  name: 'Slash',
  energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d4' },
  targetType: 'enemy',
  effect: 'damage',
  context: 'inCombat',
}

export const WOLF_BITE: AbilityDefinition = {
  id: 'wolf-bite',
  name: 'Bite',
  energyCost: 2,
  diceNotation: { kind: 'notation', value: '1d6' },
  targetType: 'enemy',
  effect: 'damage',
  context: 'inCombat',
}

export const BANDIT_BACKSTAB: AbilityDefinition = {
  id: 'bandit-backstab',
  name: 'Backstab',
  energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d8+1' },
  targetType: 'enemy',
  effect: 'damage',
  context: 'inCombat',
}

export const SPIRIT_DRAIN: AbilityDefinition = {
  id: 'spirit-drain',
  name: 'Spirit Drain',
  energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d6' },
  targetType: 'enemy',
  effect: 'damage',
  statusEffect: ['weakened'],
  context: 'inCombat',
}

export const SKELETON_BONE_THROW: AbilityDefinition = {
  id: 'skeleton-bone-throw',
  name: 'Bone Throw',
  energyCost: 2,
  diceNotation: { kind: 'notation', value: '1d4+1' },
  targetType: 'enemy',
  effect: 'damage',
  context: 'inCombat',
}

export const SPIDER_POISON_BITE: AbilityDefinition = {
  id: 'spider-poison-bite',
  name: 'Poison Bite',
  energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d6' },
  targetType: 'enemy',
  effect: 'damage',
  statusEffect: ['poisoned'],
  context: 'inCombat',
}

export const WRAITH_TERROR: AbilityDefinition = {
  id: 'wraith-terror',
  name: 'Terror',
  energyCost: 4,
  diceNotation: { kind: 'notation', value: '1d6' },
  targetType: 'enemy',
  effect: 'debuff',
  statusEffect: ['frightened'],
  context: 'inCombat',
}

export const KNIGHT_SHIELD_BASH: AbilityDefinition = {
  id: 'knight-shield-bash',
  name: 'Shield Bash',
  energyCost: 3,
  diceNotation: { kind: 'notation', value: '1d6+2' },
  targetType: 'enemy',
  effect: 'damage',
  statusEffect: ['stunned'],
  context: 'inCombat',
}

export const CASTLE_WRAITH_WAIL: AbilityDefinition = {
  id: 'castle-wraith-wail',
  name: 'Spectral Wail',
  energyCost: 4,
  diceNotation: { kind: 'notation', value: '1d8' },
  targetType: 'enemy',
  effect: 'debuff',
  statusEffect: ['frightened'],
  context: 'inCombat',
}

export const LICH_DARK_PULSE: AbilityDefinition = {
  id: 'lich-dark-pulse',
  name: 'Dark Pulse',
  energyCost: 5,
  diceNotation: { kind: 'notation', value: '2d6' },
  targetType: 'enemy',
  effect: 'damage',
  context: 'inCombat',
}

export const ENEMY_ABILITIES: Record<string, AbilityDefinition[]> = {
  'Wolf':           [WOLF_BITE, ENEMY_SLASH],
  'Bandit':         [BANDIT_BACKSTAB, ENEMY_SLASH],
  'Forest Spirit':  [SPIRIT_DRAIN, ENEMY_SLASH],
  'Skeleton':       [SKELETON_BONE_THROW, ENEMY_SLASH],
  'Giant Spider':   [SPIDER_POISON_BITE, ENEMY_SLASH],
  'Dungeon Wraith': [WRAITH_TERROR, ENEMY_SLASH],
  'Cursed Knight':  [KNIGHT_SHIELD_BASH, ENEMY_SLASH],
  'Castle Wraith':  [CASTLE_WRAITH_WAIL, ENEMY_SLASH],
  'Lich Lord':      [LICH_DARK_PULSE, ENEMY_SLASH],
}
