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

