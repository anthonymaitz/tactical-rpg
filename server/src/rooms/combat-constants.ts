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
