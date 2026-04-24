import { createRoot, createSignal, createEffect } from 'solid-js'

const TOKEN_KEY = 'tactical-rpg-token'
const HERO_IDS_KEY = 'tactical-rpg-hero-ids'

const { token, setToken, heroIds, setHeroIds } = createRoot(() => {
  const [token, setToken] = createSignal<string | null>(
    sessionStorage.getItem(TOKEN_KEY),
  )
  const [heroIds, setHeroIds] = createSignal<string[]>(
    JSON.parse(sessionStorage.getItem(HERO_IDS_KEY) ?? '[]'),
  )

  createEffect(() => {
    const t = token()
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  })

  createEffect(() => {
    sessionStorage.setItem(HERO_IDS_KEY, JSON.stringify(heroIds()))
  })

  return { token, setToken, heroIds, setHeroIds }
})

export { token, setToken, heroIds, setHeroIds }
