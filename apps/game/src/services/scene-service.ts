import { auth } from '../lib/auth'
import type { SceneData } from 'shared-types'

const API = import.meta.env.VITE_API_URL

export async function fetchScene(slug: string): Promise<SceneData | null> {
  const res = await fetch(`${API}/scenes/${slug}`)
  if (!res.ok) return null
  const data = await res.json()
  return (data as SceneData | null) ?? null
}

export async function upsertScene(slug: string, sceneData: SceneData): Promise<void> {
  const { data } = await auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${API}/scenes/${slug}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneData }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error)
  }
}
