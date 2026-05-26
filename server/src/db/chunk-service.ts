import { supabase } from './supabase'
import type { SceneChunkMeta, SceneData } from 'shared-types'

function toSceneChunkMeta(row: Record<string, unknown>): SceneChunkMeta {
  return {
    slug: row.slug as string,
    name: row.name as string,
    biomeTags: (row.biome_tags as string[]) ?? [],
    width: (row.width as number) ?? 16,
    height: (row.height as number) ?? 16,
    sceneData: (row.scene_data as SceneData),
    createdBy: (row.created_by as string | undefined) ?? undefined,
    updatedAt: (row.updated_at as string | undefined) ?? undefined,
  }
}

export const chunkService = {
  async listChunks(biomeTag?: string): Promise<SceneChunkMeta[]> {
    let query = supabase.from('scene_chunks').select('*')

    if (biomeTag) {
      query = query.contains('biome_tags', [biomeTag])
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(toSceneChunkMeta)
  },

  async getChunk(slug: string): Promise<SceneChunkMeta | null> {
    const { data, error } = await supabase
      .from('scene_chunks')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) return null
    return toSceneChunkMeta(data)
  },

  async upsertChunk(chunk: SceneChunkMeta, userId: string): Promise<SceneChunkMeta> {
    const { data, error } = await supabase
      .from('scene_chunks')
      .upsert({
        slug: chunk.slug,
        name: chunk.name,
        biome_tags: chunk.biomeTags,
        width: chunk.width,
        height: chunk.height,
        scene_data: chunk.sceneData,
        created_by: userId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return toSceneChunkMeta(data)
  },
}
