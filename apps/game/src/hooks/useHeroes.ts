// apps/game/src/hooks/useHeroes.ts
import { useState, useEffect, useCallback } from 'react'
import type { HeroRecord, GearSlots } from 'shared-types'

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

export type CreateHeroInput = {
  name: string
  className: string
  personality: string
}

export function useHeroes(token: string | null) {
  const [heroes, setHeroes] = useState<HeroRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<HeroRecord[]>('/heroes', token)
      setHeroes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load heroes')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { refresh() }, [refresh])

  const createHero = useCallback(async (input: CreateHeroInput): Promise<HeroRecord> => {
    if (!token) throw new Error('Not authenticated')
    const hero = await apiFetch<HeroRecord>('/heroes', token, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    setHeroes((prev) => [...prev, hero])
    return hero
  }, [token])

  const equipGear = useCallback(async (
    heroId: string,
    slot: keyof GearSlots,
    item: string | null
  ): Promise<HeroRecord> => {
    if (!token) throw new Error('Not authenticated')
    const hero = await apiFetch<HeroRecord>(`/heroes/${heroId}/gear`, token, {
      method: 'PATCH',
      body: JSON.stringify({ slot, item }),
    })
    setHeroes((prev) => prev.map((h) => (h.id === heroId ? hero : h)))
    return hero
  }, [token])

  return { heroes, loading, error, refresh, createHero, equipGear }
}
