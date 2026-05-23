import { describe, it, expect } from 'vitest'
import {
  xpToNextLevel,
  applyLevelUp,
  recoveryDurationMs,
  getRecoveryEndsAt,
  isRecovering,
  classXpThreshold,
  availableAbilityTiers,
} from '../hero-logic'
import type { HeroRecord } from 'shared-types'

const baseHero: HeroRecord = {
  id: 'test-id',
  userId: 'user-id',
  name: 'Aldric',
  characterClass: 'Fighter',
  personality: 'righteous',
  profession: 'soldier',
  die: 'd8',
  level: 1,
  xp: 0,
  maxHp: 20,
  currentHp: null,
  maxEnergy: 4,
  speed: 3,
  abilities: [],
  gear: { weapon: null, offhand: null, armor: null, trinket: null },
  starRating: 0,
  secondaryClass: null,
  secondaryAbilities: [],
  classXp: {},
  recoveryEndsAt: null,
  createdAt: new Date().toISOString(),
}

describe('xpToNextLevel', () => {
  it('returns 200 for level 1', () => {
    expect(xpToNextLevel(1)).toBe(200)
  })
  it('scales linearly with level', () => {
    expect(xpToNextLevel(3)).toBe(600)
    expect(xpToNextLevel(10)).toBe(2000)
  })
})

describe('applyLevelUp', () => {
  it('returns unchanged hero when XP below threshold', () => {
    const hero = { ...baseHero, xp: 150 }
    const result = applyLevelUp(hero)
    expect(result.newLevel).toBe(1)
    expect(result.newXp).toBe(150)
    expect(result.newMaxHp).toBe(20)
  })

  it('levels up when XP meets threshold', () => {
    const hero = { ...baseHero, xp: 250 }
    const result = applyLevelUp(hero)
    expect(result.newLevel).toBe(2)
    expect(result.newXp).toBe(50)
    expect(result.newMaxHp).toBe(24)
  })

  it('cascades through multiple level thresholds', () => {
    const hero = { ...baseHero, xp: 700 } // level 1: 200, level 2: 400 → total 600 to reach level 3
    const result = applyLevelUp(hero)
    expect(result.newLevel).toBe(3)
    expect(result.newXp).toBe(100)
    expect(result.newMaxHp).toBe(28) // 20 + 4 + 4
  })
})

describe('recoveryDurationMs', () => {
  it('returns 1 hour in ms for level 1', () => {
    expect(recoveryDurationMs(1)).toBe(3_600_000)
  })
  it('returns 4 hours for level 4', () => {
    expect(recoveryDurationMs(4)).toBe(14_400_000)
  })
})

describe('isRecovering', () => {
  it('returns false when recoveryEndsAt is null', () => {
    expect(isRecovering(baseHero)).toBe(false)
  })
  it('returns true when recovery has not ended', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString()
    expect(isRecovering({ ...baseHero, recoveryEndsAt: future })).toBe(true)
  })
  it('returns false when recovery has ended', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isRecovering({ ...baseHero, recoveryEndsAt: past })).toBe(false)
  })
})

describe('classXpThreshold', () => {
  it('tier 0 requires 100 xp', () => {
    expect(classXpThreshold(0)).toBe(100)
  })
  it('tier 1 requires 200 xp', () => {
    expect(classXpThreshold(1)).toBe(200)
  })
  it('tier 4 requires 500 xp', () => {
    expect(classXpThreshold(4)).toBe(500)
  })
})

describe('availableAbilityTiers', () => {
  it('returns 1 with 0 class xp', () => {
    expect(availableAbilityTiers(0)).toBe(1)
  })
  it('returns 2 after 100 xp', () => {
    expect(availableAbilityTiers(100)).toBe(2)
  })
  it('returns 3 after 300 xp (100 + 200)', () => {
    expect(availableAbilityTiers(300)).toBe(3)
  })
  it('caps at 5 tiers', () => {
    expect(availableAbilityTiers(999999)).toBe(5)
  })
})
