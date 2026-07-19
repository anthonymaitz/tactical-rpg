import { sql } from './pg'
import type { SceneData } from 'shared-types'

export async function fetchScene(slug: string): Promise<SceneData | null> {
  const [row] = await sql`select scene_data from scenes where slug = ${slug}`
  return row ? (row.scene_data as SceneData) : null
}

export async function upsertScene(slug: string, sceneData: SceneData, userId: string): Promise<void> {
  await sql`
    insert into scenes (slug, scene_data, created_by, updated_at)
    values (${slug}, ${sql.json(sceneData as never)}, ${userId}, now())
    on conflict (slug) do update set scene_data = excluded.scene_data, updated_at = now()
  `
}
