import { supabase } from './supabase'
import type { PlayerInventory, HeroInventory, LootResult } from 'shared-types'
import { STAR_UPGRADE_COSTS } from 'shared-types'

function toPlayerInventory(row: Record<string, unknown>): PlayerInventory {
  return {
    userId: row.user_id as string,
    gold: (row.gold as number) ?? 0,
    healthPotions: (row.health_potions as number) ?? 0,
    starFragments: (row.star_fragments as number) ?? 0,
  }
}

function toHeroInventory(row: Record<string, unknown>): HeroInventory {
  return {
    heroId: row.hero_id as string,
    healthPotions: (row.health_potions as number) ?? 0,
  }
}

export const inventoryService = {
  async getOrCreate(userId: string): Promise<PlayerInventory> {
    const { data, error } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!error && data) return toPlayerInventory(data)

    const { data: created, error: insertErr } = await supabase
      .from('player_inventory')
      .insert({ user_id: userId })
      .select()
      .single()
    if (insertErr) throw insertErr
    return toPlayerInventory(created)
  },

  async addLoot(userId: string, loot: LootResult): Promise<PlayerInventory> {
    const inv = await this.getOrCreate(userId)
    const { data, error } = await supabase
      .from('player_inventory')
      .update({
        gold: inv.gold + loot.gold,
        health_potions: inv.healthPotions + loot.healthPotions,
        star_fragments: inv.starFragments + loot.starFragments,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw error
    return toPlayerInventory(data)
  },

  async getHeroInventory(heroId: string): Promise<HeroInventory> {
    const { data, error } = await supabase
      .from('hero_inventory')
      .select('*')
      .eq('hero_id', heroId)
      .single()

    if (!error && data) return toHeroInventory(data)

    const { data: created, error: insertErr } = await supabase
      .from('hero_inventory')
      .insert({ hero_id: heroId })
      .select()
      .single()
    if (insertErr) throw insertErr
    return toHeroInventory(created)
  },

  async useHeroPotion(heroId: string): Promise<HeroInventory> {
    const inv = await this.getHeroInventory(heroId)
    if (inv.healthPotions <= 0) throw new Error('No potions')
    const { data, error } = await supabase
      .from('hero_inventory')
      .update({ health_potions: inv.healthPotions - 1, updated_at: new Date().toISOString() })
      .eq('hero_id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroInventory(data)
  },

  async movePotion(
    userId: string,
    heroId: string,
    direction: 'to-hero' | 'to-stash',
  ): Promise<{ inventory: PlayerInventory; heroInventory: HeroInventory }> {
    const [inv, heroInv] = await Promise.all([
      this.getOrCreate(userId),
      this.getHeroInventory(heroId),
    ])

    if (direction === 'to-hero') {
      if (inv.healthPotions <= 0) throw new Error('No potions in stash')
      const [{ data: d1, error: e1 }, { data: d2, error: e2 }] = await Promise.all([
        supabase.from('player_inventory')
          .update({ health_potions: inv.healthPotions - 1, updated_at: new Date().toISOString() })
          .eq('user_id', userId).select().single(),
        supabase.from('hero_inventory')
          .update({ health_potions: heroInv.healthPotions + 1, updated_at: new Date().toISOString() })
          .eq('hero_id', heroId).select().single(),
      ])
      if (e1) throw e1
      if (e2) throw e2
      return { inventory: toPlayerInventory(d1!), heroInventory: toHeroInventory(d2!) }
    } else {
      if (heroInv.healthPotions <= 0) throw new Error('No potions on hero')
      const [{ data: d1, error: e1 }, { data: d2, error: e2 }] = await Promise.all([
        supabase.from('player_inventory')
          .update({ health_potions: inv.healthPotions + 1, updated_at: new Date().toISOString() })
          .eq('user_id', userId).select().single(),
        supabase.from('hero_inventory')
          .update({ health_potions: heroInv.healthPotions - 1, updated_at: new Date().toISOString() })
          .eq('hero_id', heroId).select().single(),
      ])
      if (e1) throw e1
      if (e2) throw e2
      return { inventory: toPlayerInventory(d1!), heroInventory: toHeroInventory(d2!) }
    }
  },

  async upgradeHeroStar(userId: string, heroId: string): Promise<{ starRating: number; inventory: PlayerInventory }> {
    const { data: heroRow, error: heroErr } = await supabase
      .from('heroes')
      .select('star_rating, user_id')
      .eq('id', heroId)
      .single()
    if (heroErr || !heroRow) throw new Error('Hero not found')
    if (heroRow.user_id !== userId) throw new Error('Not your hero')

    const currentStar = (heroRow.star_rating as number) ?? 0
    const nextStar = currentStar + 1
    const cost = STAR_UPGRADE_COSTS[nextStar]
    if (!cost) throw new Error('Already at max star')

    const inv = await this.getOrCreate(userId)
    if (inv.starFragments < cost) throw new Error(`Need ${cost} star fragments`)

    const [{ error: heroUpErr }, { data: invData, error: invErr }] = await Promise.all([
      supabase.from('heroes').update({ star_rating: nextStar }).eq('id', heroId),
      supabase.from('player_inventory')
        .update({ star_fragments: inv.starFragments - cost, updated_at: new Date().toISOString() })
        .eq('user_id', userId).select().single(),
    ])
    if (heroUpErr) throw heroUpErr
    if (invErr) throw invErr

    return { starRating: nextStar, inventory: toPlayerInventory(invData!) }
  },
}
