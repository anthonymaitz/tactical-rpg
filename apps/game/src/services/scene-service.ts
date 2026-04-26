import { supabase } from '../lib/supabase'
import type { SceneData } from 'shared-types'

export async function fetchScene(slug: string): Promise<SceneData | null> {
  const { data, error } = await supabase
    .from('scenes')
    .select('scene_data')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return data.scene_data as SceneData
}

export async function upsertScene(slug: string, sceneData: SceneData): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('scenes').upsert(
    { slug, scene_data: sceneData, created_by: user?.id, updated_at: new Date().toISOString() },
    { onConflict: 'slug' },
  )
}
