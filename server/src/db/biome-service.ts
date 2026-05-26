import { supabase } from './supabase'

export type SpawnPoint = {
  id: string
  col: number
  row: number
  name: string
  level: number
  spawnRadius: number
  dropTableSlug: string
  groupId: string | undefined
}

interface BiomeSpawnRow {
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

export async function getBiomeSpawns(biomeId: string): Promise<SpawnPoint[]> {
  const { data, error } = await supabase
    .from('biome_spawns')
    .select('*')
    .eq('biome_id', biomeId)

  if (error) throw new Error(`Failed to load biome spawns for ${biomeId}: ${error.message}`)
  if (!data) return []

  return (data as BiomeSpawnRow[]).map((row) => ({
    id: row.id,
    col: row.col,
    row: row.row,
    name: row.name,
    level: row.level,
    spawnRadius: row.spawn_radius,
    dropTableSlug: row.drop_table_slug,
    groupId: row.group_id ?? undefined,
  }))
}
