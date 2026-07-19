import { createSignal, createEffect, on } from 'solid-js'
import type { HeroRecord, GearSlots } from 'shared-types'
import { auth } from '../lib/auth'

const API = import.meta.env.VITE_API_URL

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
  const { data } = await auth.getSession()
  return data.session?.access_token ?? fallback
}

export type CreateHeroInput = {
  name: string
  className: string
  personality: string
  profession: string
}

export function createHeroes(token: () => string | null) {
  const [heroes, setHeroes] = createSignal<HeroRecord[]>([])
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  async function refresh() {
    const t = token()
    if (!t) return
    setLoading(true)
    setError(null)
    try {
      const ft = await freshToken(t)
      const data = await apiFetch<HeroRecord[]>('/heroes', ft)
      setHeroes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load heroes')
    } finally {
      setLoading(false)
    }
  }

  createEffect(on(token, (t) => { if (t) void refresh() }))

  async function createHero(input: CreateHeroInput): Promise<HeroRecord> {
    const t = token()
    if (!t) throw new Error('Not authenticated')
    const hero = await apiFetch<HeroRecord>('/heroes', t, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    setHeroes((prev) => [...prev, hero])
    return hero
  }

  async function equipGear(heroId: string, slot: keyof GearSlots, item: string | null): Promise<HeroRecord> {
    const t = token()
    if (!t) throw new Error('Not authenticated')
    const hero = await apiFetch<HeroRecord>(`/heroes/${heroId}/gear`, t, {
      method: 'PATCH',
      body: JSON.stringify({ slot, item }),
    })
    setHeroes((prev) => prev.map((h) => (h.id === heroId ? hero : h)))
    return hero
  }

  return { heroes, loading, error, refresh, createHero, equipGear }
}
