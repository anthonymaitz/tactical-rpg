// server/src/db/hero-service.ts
import { supabase } from './supabase'
import { applyLevelUp, getRecoveryEndsAt } from './hero-logic'
import type { HeroRecord, GearSlots, StarterClass } from 'shared-types'

function toHeroRecord(row: Record<string, unknown>): HeroRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    characterClass: row.character_class as string,
    personality: row.personality as HeroRecord['personality'],
    die: row.die as HeroRecord['die'],
    level: row.level as number,
    xp: row.xp as number,
    maxHp: row.max_hp as number,
    maxEnergy: row.max_energy as number,
    speed: row.speed as number,
    abilities: row.abilities as HeroRecord['abilities'],
    gear: row.gear as GearSlots,
    recoveryEndsAt: row.recovery_ends_at as string | null,
    createdAt: row.created_at as string,
  }
}

export const heroService = {
  async getHero(heroId: string): Promise<HeroRecord | null> {
    const { data, error } = await supabase
      .from('heroes')
      .select('*')
      .eq('id', heroId)
      .single()
    if (error) return null
    return toHeroRecord(data)
  },

  async listHeroes(userId: string): Promise<HeroRecord[]> {
    const { data, error } = await supabase
      .from('heroes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(toHeroRecord)
  },

  async createHero(
    userId: string,
    name: string,
    starterClass: StarterClass,
    personality: HeroRecord['personality']
  ): Promise<HeroRecord> {
    const { data, error } = await supabase
      .from('heroes')
      .insert({
        user_id: userId,
        name,
        character_class: starterClass.name,
        personality,
        die: starterClass.die,
        max_hp: starterClass.maxHp,
        max_energy: starterClass.maxEnergy,
        speed: starterClass.speed,
        abilities: starterClass.abilities,
      })
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async awardXp(heroId: string, xpGained: number): Promise<HeroRecord> {
    const { data: existing, error: fetchErr } = await supabase
      .from('heroes')
      .select('*')
      .eq('id', heroId)
      .single()
    if (fetchErr) throw fetchErr

    const current = toHeroRecord(existing)
    const withXp = { ...current, xp: current.xp + xpGained }
    const { newLevel, newMaxHp, newXp } = applyLevelUp(withXp)

    const { data, error } = await supabase
      .from('heroes')
      .update({ xp: newXp, level: newLevel, max_hp: newMaxHp })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async equipGear(heroId: string, slot: keyof GearSlots, itemName: string | null): Promise<HeroRecord> {
    const { data: existing, error: fetchErr } = await supabase
      .from('heroes')
      .select('gear')
      .eq('id', heroId)
      .single()
    if (fetchErr) throw fetchErr

    const gear: GearSlots = { ...(existing.gear as GearSlots), [slot]: itemName }
    const { data, error } = await supabase
      .from('heroes')
      .update({ gear })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async setRecovering(heroId: string, level: number): Promise<HeroRecord> {
    const { data, error } = await supabase
      .from('heroes')
      .update({ recovery_ends_at: getRecoveryEndsAt(level) })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async clearRecovery(heroId: string): Promise<HeroRecord> {
    const { data, error } = await supabase
      .from('heroes')
      .update({ recovery_ends_at: null })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },
}
