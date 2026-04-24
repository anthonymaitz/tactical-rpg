import { createRoot, createSignal } from 'solid-js'

const { token, setToken, heroIds, setHeroIds } = createRoot(() => {
  const [token, setToken] = createSignal<string | null>(null)
  const [heroIds, setHeroIds] = createSignal<string[]>([])
  return { token, setToken, heroIds, setHeroIds }
})

export { token, setToken, heroIds, setHeroIds }
