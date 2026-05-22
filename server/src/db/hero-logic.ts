import type { HeroRecord } from 'shared-types'
export { isRecovering } from 'shared-types'

export function xpToNextLevel(level: number): number {
  return level * 200
}

export function applyLevelUp(hero: HeroRecord): {
  newLevel: number
  newMaxHp: number
  newXp: number
} {
  let level = hero.level
  let maxHp = hero.maxHp
  let xp = hero.xp

  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level)
    level++
    maxHp += 4
  }

  return { newLevel: level, newMaxHp: maxHp, newXp: xp }
}

export function recoveryDurationMs(level: number): number {
  return level * 60 * 60 * 1000
}

export function getRecoveryEndsAt(level: number): string {
  return new Date(Date.now() + recoveryDurationMs(level)).toISOString()
}

export const CLASS_XP_PER_COMBAT_USE = 10

/** XP required to unlock tier N (0-indexed). Tier 0 = first unlock beyond base. */
export function classXpThreshold(tier: number): number {
  return (tier + 1) * 100
}

/**
 * How many ability tiers are unlocked for a class given accumulated XP.
 * Starts at 1 (base tier always unlocked). Max 5.
 */
export function availableAbilityTiers(totalClassXp: number): number {
  let tiers = 1
  let spent = 0
  while (tiers < 5) {
    spent += classXpThreshold(tiers - 1)
    if (totalClassXp < spent) break
    tiers++
  }
  return tiers
}
