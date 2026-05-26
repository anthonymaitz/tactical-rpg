/// <reference types="bun-types" />
/**
 * Seed script: populates biome_spawns table from hardcoded spawn arrays.
 * Run once (or re-run to upsert): bun run server/scripts/seed-biome-spawns.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SpawnRow = {
  id: string
  biome_id: string
  col: number
  row: number
  name: string
  level: number
  spawn_radius: number
  drop_table_slug: string
  group_id: string | null
}

const VERDANT_FOREST_SPAWNS: SpawnRow[] = [
  // Close to entrance — easy to find for testing
  { id: 'sp-vf-test-1', biome_id: 'verdant-forest', col: 46, row: 44, name: 'Wolf',         level: 1, spawn_radius: 3, drop_table_slug: 'wolf',         group_id: null },
  { id: 'sp-vf-test-2', biome_id: 'verdant-forest', col: 53, row: 45, name: 'Wolf',         level: 1, spawn_radius: 3, drop_table_slug: 'wolf',         group_id: null },
  // Wolf pack: two wolves close together — forms two enemy groups in one encounter
  { id: 'sp-wolf-1',    biome_id: 'verdant-forest', col: 42, row: 42, name: 'Wolf',         level: 1, spawn_radius: 4, drop_table_slug: 'wolf',         group_id: 'wolves' },
  { id: 'sp-wolf-2',    biome_id: 'verdant-forest', col: 44, row: 43, name: 'Wolf',         level: 1, spawn_radius: 4, drop_table_slug: 'wolf',         group_id: 'wolves' },
  { id: 'sp-bandit-1',  biome_id: 'verdant-forest', col: 35, row: 50, name: 'Bandit',       level: 2, spawn_radius: 5, drop_table_slug: 'bandit',       group_id: null },
  { id: 'sp-bandit-2',  biome_id: 'verdant-forest', col: 62, row: 55, name: 'Bandit',       level: 2, spawn_radius: 5, drop_table_slug: 'bandit',       group_id: null },
  { id: 'sp-spirit-1',  biome_id: 'verdant-forest', col: 50, row: 38, name: 'Forest Spirit',level: 3, spawn_radius: 6, drop_table_slug: 'forest-spirit',group_id: null },
]

const DUNGEON_DEPTHS_SPAWNS: SpawnRow[] = [
  // Close to entrance
  { id: 'sp-dd-test-1', biome_id: 'dungeon-depths', col: 47, row: 44, name: 'Skeleton',      level: 2, spawn_radius: 3, drop_table_slug: 'bandit',       group_id: null },
  { id: 'sp-dd-test-2', biome_id: 'dungeon-depths', col: 52, row: 45, name: 'Skeleton',      level: 2, spawn_radius: 3, drop_table_slug: 'bandit',       group_id: null },
  { id: 'sp-dd-skel-1', biome_id: 'dungeon-depths', col: 38, row: 42, name: 'Skeleton',      level: 2, spawn_radius: 5, drop_table_slug: 'bandit',       group_id: 'skels' },
  { id: 'sp-dd-skel-2', biome_id: 'dungeon-depths', col: 40, row: 44, name: 'Skeleton',      level: 2, spawn_radius: 5, drop_table_slug: 'bandit',       group_id: 'skels' },
  { id: 'sp-dd-spider', biome_id: 'dungeon-depths', col: 60, row: 48, name: 'Giant Spider',  level: 3, spawn_radius: 6, drop_table_slug: 'forest-spirit',group_id: null },
  { id: 'sp-dd-boss',   biome_id: 'dungeon-depths', col: 50, row: 35, name: 'Dungeon Wraith',level: 4, spawn_radius: 4, drop_table_slug: 'forest-spirit',group_id: null },
]

const RUINED_CASTLE_SPAWNS: SpawnRow[] = [
  // Close to entrance
  { id: 'sp-rc-test-1', biome_id: 'ruined-castle', col: 47, row: 43, name: 'Cursed Knight', level: 3, spawn_radius: 3, drop_table_slug: 'bandit',       group_id: null },
  { id: 'sp-rc-test-2', biome_id: 'ruined-castle', col: 53, row: 44, name: 'Cursed Knight', level: 3, spawn_radius: 3, drop_table_slug: 'bandit',       group_id: null },
  { id: 'sp-rc-guard-1',biome_id: 'ruined-castle', col: 36, row: 50, name: 'Cursed Knight', level: 3, spawn_radius: 5, drop_table_slug: 'bandit',       group_id: 'guards' },
  { id: 'sp-rc-guard-2',biome_id: 'ruined-castle', col: 38, row: 48, name: 'Cursed Knight', level: 3, spawn_radius: 5, drop_table_slug: 'bandit',       group_id: 'guards' },
  { id: 'sp-rc-wraith', biome_id: 'ruined-castle', col: 62, row: 52, name: 'Castle Wraith', level: 4, spawn_radius: 6, drop_table_slug: 'forest-spirit',group_id: null },
  { id: 'sp-rc-boss',   biome_id: 'ruined-castle', col: 50, row: 35, name: 'Lich Lord',     level: 5, spawn_radius: 4, drop_table_slug: 'forest-spirit',group_id: null },
]

const ALL_SPAWNS: SpawnRow[] = [
  ...VERDANT_FOREST_SPAWNS,
  ...DUNGEON_DEPTHS_SPAWNS,
  ...RUINED_CASTLE_SPAWNS,
]

async function seed() {
  console.log(`Seeding biome_spawns (${ALL_SPAWNS.length} rows)…`)
  const { error } = await supabase
    .from('biome_spawns')
    .upsert(ALL_SPAWNS, { onConflict: 'id' })
  if (error) throw error
  console.log('Done. Seeded', ALL_SPAWNS.length, 'spawn points.')
}

seed().catch((e) => { console.error(e); process.exit(1) })
