export type ItemType = 'gold' | 'health_potion' | 'star_fragment' | 'decor_shard' | 'builder_prop'

export interface LootResult {
  gold: number
  healthPotions: number
  starFragments: number
  decorShards: number
  builderPropIds: string[]
}

export interface PlayerInventory {
  userId: string
  gold: number
  healthPotions: number
  starFragments: number
  decorShards: number
  builderProps: Record<string, number>
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

export type WeaponDefinition = {
  id: string
  name: string
  damageBonus: number
  description: string
  levelRequirement: number
  cost: number
  classAffinity?: string[]
}

export const WEAPONS: WeaponDefinition[] = [
  { id: 'iron-sword',      name: 'Iron Sword',      damageBonus: 1, description: 'A sturdy blade.',               levelRequirement: 1, cost: 50,  classAffinity: ['fighter', 'monk'] },
  { id: 'oak-staff',       name: 'Oak Staff',        damageBonus: 1, description: 'Channels arcane energy.',       levelRequirement: 1, cost: 50,  classAffinity: ['wizard', 'sage'] },
  { id: 'hunting-bow',     name: 'Hunting Bow',      damageBonus: 1, description: 'Silent and precise.',           levelRequirement: 1, cost: 50,  classAffinity: ['marksman'] },
  { id: 'steel-sword',     name: 'Steel Sword',      damageBonus: 2, description: 'Forged by master smiths.',      levelRequirement: 3, cost: 150, classAffinity: ['fighter', 'monk'] },
  { id: 'enchanted-staff', name: 'Enchanted Staff',  damageBonus: 2, description: 'Hums with ancient power.',      levelRequirement: 3, cost: 200, classAffinity: ['wizard', 'sage'] },
  { id: 'composite-bow',   name: 'Composite Bow',    damageBonus: 2, description: 'Greater range and power.',      levelRequirement: 3, cost: 175, classAffinity: ['marksman'] },
  { id: 'runed-blade',     name: 'Runed Blade',      damageBonus: 3, description: 'Inscribed with battle runes.',  levelRequirement: 6, cost: 400, classAffinity: ['fighter'] },
  { id: 'arcane-tome',     name: 'Arcane Tome',      damageBonus: 3, description: 'A compendium of spells.',       levelRequirement: 6, cost: 500, classAffinity: ['wizard', 'sage'] },
]

/** Flat damage bonus keyed by weapon item ID */
export const WEAPON_DAMAGE_BONUSES: Record<string, number> = Object.fromEntries(
  [...WEAPONS, { id: 'debug-sword', damageBonus: 1 }].map(w => [w.id, w.damageBonus])
)
