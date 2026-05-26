/// <reference types="bun-types" />
/**
 * Seed script: populates drop_tables with loot entries for all enemy slugs.
 * Run once (or re-run to upsert): bun run server/scripts/seed-drop-tables.ts
 */
import { createClient } from '@supabase/supabase-js'
import type { ItemType } from 'shared-types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface DropEntry {
  item: ItemType
  prop_id?: string
  min_qty: number
  max_qty: number
  weight: number
}

// ── wolf — low-level forest enemy ────────────────────────────────────────────
const wolfEntries: DropEntry[] = [
  { item: 'gold',          min_qty: 5,  max_qty: 15, weight: 60 },
  { item: 'health_potion', min_qty: 1,  max_qty: 1,  weight: 25 },
  { item: 'star_fragment', min_qty: 1,  max_qty: 1,  weight: 15 },
]

// ── bandit — mid-level enemy, carries more gold ───────────────────────────────
const banditEntries: DropEntry[] = [
  { item: 'gold',          min_qty: 15, max_qty: 40, weight: 50 },
  { item: 'health_potion', min_qty: 1,  max_qty: 2,  weight: 30 },
  { item: 'star_fragment', min_qty: 1,  max_qty: 2,  weight: 20 },
]

// ── forest-spirit — rare/boss enemy, good rewards ────────────────────────────
const forestSpiritEntries: DropEntry[] = [
  { item: 'gold',          min_qty: 20, max_qty: 50, weight: 40 },
  { item: 'star_fragment', min_qty: 1,  max_qty: 3,  weight: 40 },
  { item: 'decor_shard',   min_qty: 1,  max_qty: 2,  weight: 20 },
]

// ── boss — elite enemies (Dungeon Wraith, Lich Lord tier) ────────────────────
const bossEntries: DropEntry[] = [
  { item: 'gold',          min_qty: 50, max_qty: 100, weight: 30 },
  { item: 'star_fragment', min_qty: 2,  max_qty: 4,   weight: 35 },
  { item: 'decor_shard',   min_qty: 1,  max_qty: 3,   weight: 25 },
  { item: 'builder_prop',  min_qty: 1,  max_qty: 1,   weight: 10, prop_id: 'chest-rare' },
]

async function seed() {
  const tables = [
    { slug: 'wolf',          entries: wolfEntries },
    { slug: 'bandit',        entries: banditEntries },
    { slug: 'forest-spirit', entries: forestSpiritEntries },
    { slug: 'boss',          entries: bossEntries },
  ]

  console.log('Seeding drop_tables…')
  const { error } = await supabase
    .from('drop_tables')
    .upsert(tables, { onConflict: 'slug' })
  if (error) throw error

  console.log(`Done. Seeded ${tables.length} drop tables:`)
  for (const t of tables) {
    console.log(`  ${t.slug}: ${t.entries.length} entries (weights: ${t.entries.map(e => e.weight).join('/')})`)
  }
}

seed().catch((e) => { console.error(e); process.exit(1) })
