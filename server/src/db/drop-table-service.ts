import { supabase } from './supabase'
import type { LootResult, ItemType } from 'shared-types'

interface DropEntry {
  item: ItemType
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
    const { data, error } = await supabase
      .from('drop_tables')
      .select('entries')
      .eq('slug', slug)
      .single()

    const result: LootResult = { gold: 0, healthPotions: 0, starFragments: 0 }
    if (error || !data) return result

    const entries = data.entries as DropEntry[]
    const picked = pickItem(entries)
    if (!picked) return result

    const qty = rollRange(picked.min_qty, picked.max_qty)
    if (picked.item === 'gold') result.gold = qty
    else if (picked.item === 'health_potion') result.healthPotions = qty
    else if (picked.item === 'star_fragment') result.starFragments = qty

    return result
  },
}
