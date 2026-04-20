import { useState } from 'react'
import { ConnectScreen } from './screens/ConnectScreen'
import { ExploreScreen } from './screens/ExploreScreen'
import { CombatScreen } from './screens/CombatScreen'

type Screen = 'connect' | 'explore' | 'combat'

export default function App() {
  const [screen, setScreen] = useState<Screen>('connect')
  const [token, setToken] = useState<string | null>(null)
  const [heroIds, setHeroIds] = useState<string[]>([])

  function handleConnect(tok: string, ids: string[]) {
    setToken(tok)
    setHeroIds(ids)
    setScreen('explore')
  }

  if (screen === 'explore') return <ExploreScreen token={token} heroIds={heroIds} />
  if (screen === 'combat') return <CombatScreen />
  return <ConnectScreen onConnect={handleConnect} />
}
