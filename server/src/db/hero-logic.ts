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
  const threshold = xpToNextLevel(hero.level)
  if (hero.xp < threshold) {
    return { newLevel: hero.level, newMaxHp: hero.maxHp, newXp: hero.xp }
  }
  return {
    newLevel: hero.level + 1,
    newMaxHp: hero.maxHp + 4,
    newXp: hero.xp - threshold,
  }
}

export function recoveryDurationMs(level: number): number {
  return level * 60 * 60 * 1000
}

export function getRecoveryEndsAt(level: number): string {
  return new Date(Date.now() + recoveryDurationMs(level)).toISOString()
}

