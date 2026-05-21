// server/src/db/hero-service.ts
import { supabase } from './supabase'
import { applyLevelUp, getRecoveryEndsAt } from './hero-logic'
import { getSqClassAbilities } from './sq-content'
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
    secondaryClass: (row.secondary_class as string | null) ?? null,
    secondaryAbility: (row.secondary_ability as AbilityDefinition | null) ?? null,
    classXp: (row.class_xp as Record<string, number>) ?? {},
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
    hero: NewHeroData,
    personality: HeroRecord['personality'],
    profession: string
  ): Promise<HeroRecord> {
    const { data, error } = await supabase
      .from('heroes')
      .insert({
        user_id: userId,
        name,
        character_class: hero.className,
        personality,
        profession,
        die: hero.die,
        max_hp: hero.maxHp,
        max_energy: hero.maxEnergy,
        speed: hero.speed,
        abilities: hero.abilities,
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

  async updateCurrentHp(heroId: string, currentHp: number): Promise<void> {
    await supabase
      .from('heroes')
      .update({ current_hp: currentHp })
      .eq('id', heroId)
  },

  async restoreHp(heroId: string): Promise<void> {
    await supabase
      .from('heroes')
      .update({ current_hp: null })
      .eq('id', heroId)
  },

  async setSecondaryClass(heroId: string, className: string): Promise<HeroRecord> {
    const sqAbilities = await getSqClassAbilities(className)
    const mapped: AbilityDefinition[] = sqAbilities.map((a) => ({
      id: a.id,
      name: a.title,
      energyCost: a.energyCost ?? 1,
      diceNotation: (a.diceNotation ?? { kind: 'actor' }) as AbilityDefinition['diceNotation'],
      targetType: (a.targetType ?? 'enemy') as AbilityDefinition['targetType'],
      effect: (a.effect ?? 'damage') as AbilityDefinition['effect'],
      context: a.context as AbilityDefinition['context'],
      statusEffect: a.statusEffects ?? undefined,
    }))
    const firstAbility = mapped[0] ?? null
    const { data, error } = await supabase
      .from('heroes')
      .update({ secondary_class: className, secondary_ability: firstAbility })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async awardClassXp(heroId: string, abilityId: string, amount: number): Promise<void> {
    const { data: existing, error: selectError } = await supabase
      .from('heroes')
      .select('class_xp')
      .eq('id', heroId)
      .single()
    if (selectError) return  // fire-and-forget: skip silently on error, don't corrupt data
    const current = (existing?.class_xp as Record<string, number>) ?? {}
    const updated = { ...current, [abilityId]: (current[abilityId] ?? 0) + amount }
    await supabase
      .from('heroes')
      .update({ class_xp: updated })
      .eq('id', heroId)
  },
}
