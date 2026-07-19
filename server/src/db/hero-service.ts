// server/src/db/hero-service.ts
import { sql } from './pg'
import { applyLevelUp, getRecoveryEndsAt } from './hero-logic'
import type { HeroRecord, GearSlots, AbilityDefinition } from 'shared-types'

type NewHeroData = {
  className: string
  die: string
  maxHp: number
  maxEnergy: number
  speed: number
  abilities: AbilityDefinition[]
}

function toHeroRecord(row: Record<string, unknown>): HeroRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    characterClass: row.character_class as string,
    personality: row.personality as HeroRecord['personality'],
    profession: row.profession as HeroRecord['profession'],
    die: row.die as HeroRecord['die'],
    level: row.level as number,
    xp: row.xp as number,
    maxHp: row.max_hp as number,
    currentHp: row.current_hp as number | null,
    maxEnergy: row.max_energy as number,
    speed: row.speed as number,
    abilities: row.abilities as HeroRecord['abilities'],
    gear: row.gear as GearSlots,
    starRating: (row.star_rating as number) ?? 0,
    recoveryEndsAt: row.recovery_ends_at as string | null,
    createdAt: row.created_at as string,
  }
}

export const heroService = {
  async getHero(heroId: string): Promise<HeroRecord | null> {
    const [row] = await sql`select * from heroes where id = ${heroId}`
    return row ? toHeroRecord(row) : null
  },

  async listHeroes(userId: string): Promise<HeroRecord[]> {
    const rows = await sql`select * from heroes where user_id = ${userId} order by created_at asc`
    return rows.map(toHeroRecord)
  },

  async createHero(
    userId: string,
    name: string,
    hero: NewHeroData,
    personality: HeroRecord['personality'],
    profession: string
  ): Promise<HeroRecord> {
    const [row] = await sql`
      insert into heroes (user_id, name, character_class, personality, profession, die, max_hp, max_energy, speed, abilities)
      values (${userId}, ${name}, ${hero.className}, ${personality}, ${profession}, ${hero.die}, ${hero.maxHp}, ${hero.maxEnergy}, ${hero.speed}, ${sql.json(hero.abilities as never)})
      returning *
    `
    return toHeroRecord(row)
  },

  async awardXp(heroId: string, xpGained: number): Promise<HeroRecord> {
    const [existing] = await sql`select * from heroes where id = ${heroId}`
    if (!existing) throw new Error('Hero not found')

    const current = toHeroRecord(existing)
    const withXp = { ...current, xp: current.xp + xpGained }
    const { newLevel, newMaxHp, newXp } = applyLevelUp(withXp)

    const [row] = await sql`
      update heroes set xp = ${newXp}, level = ${newLevel}, max_hp = ${newMaxHp}
      where id = ${heroId}
      returning *
    `
    return toHeroRecord(row)
  },

  async equipGear(heroId: string, slot: keyof GearSlots, itemName: string | null): Promise<HeroRecord> {
    const [existing] = await sql`select gear from heroes where id = ${heroId}`
    if (!existing) throw new Error('Hero not found')

    const gear: GearSlots = { ...(existing.gear as GearSlots), [slot]: itemName }
    const [row] = await sql`
      update heroes set gear = ${sql.json(gear)} where id = ${heroId}
      returning *
    `
    return toHeroRecord(row)
  },

  async setRecovering(heroId: string, level: number): Promise<HeroRecord> {
    const [row] = await sql`
      update heroes set recovery_ends_at = ${getRecoveryEndsAt(level)} where id = ${heroId}
      returning *
    `
    return toHeroRecord(row)
  },

  async updateRecoveryEndsAt(heroId: string, recoveryEndsAt: string): Promise<void> {
    await sql`update heroes set recovery_ends_at = ${recoveryEndsAt} where id = ${heroId}`
  },

  async clearRecovery(heroId: string): Promise<HeroRecord> {
    const [row] = await sql`
      update heroes set recovery_ends_at = null where id = ${heroId}
      returning *
    `
    return toHeroRecord(row)
  },

  async updateCurrentHp(heroId: string, currentHp: number): Promise<void> {
    await sql`update heroes set current_hp = ${currentHp} where id = ${heroId}`
  },

  async restoreHp(heroId: string): Promise<void> {
    await sql`update heroes set current_hp = null where id = ${heroId}`
  },
}
