export type ItemType = 'gold' | 'health_potion' | 'star_fragment'

export interface LootResult {
  gold: number
  healthPotions: number
  starFragments: number
}

export interface PlayerInventory {
  userId: string
  gold: number
  healthPotions: number
  starFragments: number
}

export interface HeroInventory {
  heroId: string
  healthPotions: number
}

/** Upgrade costs indexed by target star level (index 1 = cost to reach ★1, etc.) */
export const STAR_UPGRADE_COSTS: Record<number, number> = {
  1: 10,
  2: 20,
  3: 60,
  4: 180,
  5: 360,
}
