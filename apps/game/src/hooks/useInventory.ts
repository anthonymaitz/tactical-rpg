import { createSignal, createEffect, on } from 'solid-js'
import type { PlayerInventory, HeroInventory } from 'shared-types'
import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error)
  }
  return res.json() as Promise<T>
}

async function freshToken(fallback: string): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? fallback
}

export function createInventory(token: () => string | null, heroIds: () => string[]) {
  const [inventory, setInventory] = createSignal<PlayerInventory | null>(null)
  const [heroInventories, setHeroInventories] = createSignal<Record<string, HeroInventory>>({})
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  async function refresh() {
    const t = token()
    if (!t) return
    setLoading(true)
    setError(null)
    try {
      const ft = await freshToken(t)
      const [inv, ...heroInvs] = await Promise.all([
        apiFetch<PlayerInventory>('/inventory', ft),
        ...heroIds().map((id) => apiFetch<HeroInventory>(`/inventory/hero/${id}`, ft)),
      ])
      setInventory(inv)
      const byHeroId: Record<string, HeroInventory> = {}
      heroIds().forEach((id, i) => { byHeroId[id] = heroInvs[i] })
      setHeroInventories(byHeroId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  createEffect(on([token, heroIds] as const, ([t]) => { if (t) void refresh() }))

  async function movePotion(heroId: string, direction: 'to-hero' | 'to-stash'): Promise<void> {
    const t = token()
    if (!t) return
    const ft = await freshToken(t)
    const result = await apiFetch<{ inventory: PlayerInventory; heroInventory: HeroInventory }>(
      '/inventory/move-potion', ft,
      { method: 'POST', body: JSON.stringify({ heroId, direction }) },
    )
    setInventory(result.inventory)
    setHeroInventories((prev) => ({ ...prev, [heroId]: result.heroInventory }))
  }

  async function upgradeHeroStar(heroId: string): Promise<{ starRating: number }> {
    const t = token()
    if (!t) throw new Error('Not authenticated')
    const ft = await freshToken(t)
    const result = await apiFetch<{ starRating: number; inventory: PlayerInventory }>(
      '/inventory/upgrade-star', ft,
      { method: 'POST', body: JSON.stringify({ heroId }) },
    )
    setInventory(result.inventory)
    return { starRating: result.starRating }
  }

  return { inventory, heroInventories, loading, error, refresh, movePotion, upgradeHeroStar }
}
