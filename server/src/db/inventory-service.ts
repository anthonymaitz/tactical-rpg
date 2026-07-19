import { sql } from './pg'
import type { PlayerInventory, HeroInventory, LootResult } from 'shared-types'
import { STAR_UPGRADE_COSTS } from 'shared-types'

function toPlayerInventory(row: Record<string, unknown>): PlayerInventory {
  return {
    userId: row.user_id as string,
    gold: (row.gold as number) ?? 0,
    healthPotions: (row.health_potions as number) ?? 0,
    starFragments: (row.star_fragments as number) ?? 0,
    decorShards: (row.decor_shards as number) ?? 0,
    builderProps: (row.builder_props as Record<string, number>) ?? {},
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
    const [row] = await sql`select * from player_inventory where user_id = ${userId}`
    if (row) return toPlayerInventory(row)

    const [created] = await sql`
      insert into player_inventory (user_id) values (${userId})
      on conflict (user_id) do update set user_id = excluded.user_id
      returning *
    `
    return toPlayerInventory(created)
  },

  async addLoot(userId: string, loot: LootResult): Promise<PlayerInventory> {
    const inv = await this.getOrCreate(userId)

    // Merge builder prop drops into existing map
    const mergedProps = { ...inv.builderProps }
    for (const propId of loot.builderPropIds) {
      mergedProps[propId] = (mergedProps[propId] ?? 0) + 1
    }

    const [row] = await sql`
      update player_inventory set
        gold = ${inv.gold + loot.gold},
        health_potions = ${inv.healthPotions + loot.healthPotions},
        star_fragments = ${inv.starFragments + loot.starFragments},
        decor_shards = ${inv.decorShards + loot.decorShards},
        builder_props = ${sql.json(mergedProps)},
        updated_at = now()
      where user_id = ${userId}
      returning *
    `
    return toPlayerInventory(row)
  },

  async getHeroInventory(heroId: string): Promise<HeroInventory> {
    const [row] = await sql`select * from hero_inventory where hero_id = ${heroId}`
    if (row) return toHeroInventory(row)

    const [created] = await sql`
      insert into hero_inventory (hero_id) values (${heroId})
      on conflict (hero_id) do update set hero_id = excluded.hero_id
      returning *
    `
    return toHeroInventory(created)
  },

  async useHeroPotion(heroId: string): Promise<HeroInventory> {
    const inv = await this.getHeroInventory(heroId)
    if (inv.healthPotions <= 0) throw new Error('No potions')
    const [row] = await sql`
      update hero_inventory set health_potions = ${inv.healthPotions - 1}, updated_at = now()
      where hero_id = ${heroId}
      returning *
    `
    return toHeroInventory(row)
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
      const [[d1], [d2]] = await Promise.all([
        sql`update player_inventory set health_potions = ${inv.healthPotions - 1}, updated_at = now() where user_id = ${userId} returning *`,
        sql`update hero_inventory set health_potions = ${heroInv.healthPotions + 1}, updated_at = now() where hero_id = ${heroId} returning *`,
      ])
      return { inventory: toPlayerInventory(d1), heroInventory: toHeroInventory(d2) }
    } else {
      if (heroInv.healthPotions <= 0) throw new Error('No potions on hero')
      const [[d1], [d2]] = await Promise.all([
        sql`update player_inventory set health_potions = ${inv.healthPotions + 1}, updated_at = now() where user_id = ${userId} returning *`,
        sql`update hero_inventory set health_potions = ${heroInv.healthPotions - 1}, updated_at = now() where hero_id = ${heroId} returning *`,
      ])
      return { inventory: toPlayerInventory(d1), heroInventory: toHeroInventory(d2) }
    }
  },

  async upgradeHeroStar(userId: string, heroId: string): Promise<{ starRating: number; inventory: PlayerInventory }> {
    const [heroRow] = await sql`select star_rating, user_id from heroes where id = ${heroId}`
    if (!heroRow) throw new Error('Hero not found')
    if (heroRow.user_id !== userId) throw new Error('Not your hero')

    const currentStar = (heroRow.star_rating as number) ?? 0
    const nextStar = currentStar + 1
    const cost = STAR_UPGRADE_COSTS[nextStar]
    if (!cost) throw new Error('Already at max star')

    const inv = await this.getOrCreate(userId)
    if (inv.starFragments < cost) throw new Error(`Need ${cost} star fragments`)

    const [, [invRow]] = await Promise.all([
      sql`update heroes set star_rating = ${nextStar} where id = ${heroId}`,
      sql`update player_inventory set star_fragments = ${inv.starFragments - cost}, updated_at = now() where user_id = ${userId} returning *`,
    ])

    return { starRating: nextStar, inventory: toPlayerInventory(invRow) }
  },
}
