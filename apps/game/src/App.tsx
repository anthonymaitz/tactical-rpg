import { useState } from 'react'
import { ConnectScreen } from './screens/ConnectScreen'
import { ExploreScreen } from './screens/ExploreScreen'
import { CombatScreen } from './screens/CombatScreen'

type Screen = 'connect' | 'explore' | 'combat'

export default function App() {
  const [screen, setScreen] = useState<Screen>('connect')

  if (screen === 'explore') return <ExploreScreen />
  if (screen === 'combat') return <CombatScreen />
  return <ConnectScreen onConnect={() => setScreen('explore')} />
}
