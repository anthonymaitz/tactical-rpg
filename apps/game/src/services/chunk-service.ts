import { supabase } from '../lib/supabase'
import type { SceneChunkMeta, SceneData } from 'shared-types'

const API = import.meta.env.VITE_API_URL

async function freshToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await freshToken()
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export async function listChunks(biomeTag?: string): Promise<SceneChunkMeta[]> {
  const query = biomeTag ? `?biomeTag=${encodeURIComponent(biomeTag)}` : ''
  return apiFetch<SceneChunkMeta[]>(`/chunks${query}`)
}

export async function getChunk(slug: string): Promise<SceneChunkMeta | null> {
  try {
    return await apiFetch<SceneChunkMeta>(`/chunks/${encodeURIComponent(slug)}`)
  } catch {
    return null
  }
}

export async function upsertChunk(
  slug: string,
  meta: Partial<SceneChunkMeta>,
  sceneData: SceneData,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  await apiFetch<void>(`/chunks/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...meta,
      slug,
      sceneData,
      createdBy: user?.id,
      updatedAt: new Date().toISOString(),
    }),
  })
}
