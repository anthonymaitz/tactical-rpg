import { sql } from './pg'
import type { LootResult, ItemType } from 'shared-types'

interface DropEntry {
  item: ItemType
  prop_id?: string
  min_qty: number
  max_qty: number
  weight: number
}

function rollRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickItem(entries: DropEntry[]): DropEntry | null {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight === 0) return null
  let roll = Math.random() * totalWeight
  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) return entry
  }
  return entries[entries.length - 1]
}

export const dropTableService = {
  async rollDrops(slug: string): Promise<LootResult> {
    const [row] = await sql`select entries from drop_tables where slug = ${slug}`

    const result: LootResult = { gold: 0, healthPotions: 0, starFragments: 0, decorShards: 0, builderPropIds: [] }
    if (!row) return result

    const entries = row.entries as DropEntry[]
    const picked = pickItem(entries)
    if (!picked) return result

    const qty = rollRange(picked.min_qty, picked.max_qty)
    if (picked.item === 'gold') result.gold = qty
    else if (picked.item === 'health_potion') result.healthPotions = qty
    else if (picked.item === 'star_fragment') result.starFragments = qty
    else if (picked.item === 'decor_shard') result.decorShards = qty
    else if (picked.item === 'builder_prop' && picked.prop_id) {
      for (let i = 0; i < qty; i++) result.builderPropIds.push(picked.prop_id)
    }

    return result
  },
}
