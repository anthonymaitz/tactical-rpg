import { createSignal } from 'solid-js'
import { Switch, Match } from 'solid-js'
import { ConnectScreen } from './screens/ConnectScreen'
import { ExploreScreen } from './screens/ExploreScreen'
import { CombatScreen } from './screens/CombatScreen'

type Screen = 'connect' | 'explore' | 'combat'

export default function App() {
  const [screen, setScreen] = createSignal<Screen>('connect')
  const [token, setToken] = createSignal<string | null>(null)
  const [heroIds, setHeroIds] = createSignal<string[]>([])

  function handleConnect(tok: string, ids: string[]) {
    setToken(tok)
    setHeroIds(ids)
    setScreen('explore')
  }

  return (
    <Switch>
      <Match when={screen() === 'explore'}>
        <ExploreScreen token={token()} heroIds={heroIds()} />
      </Match>
      <Match when={screen() === 'combat'}>
        <CombatScreen />
      </Match>
      <Match when={screen() === 'connect'}>
        <ConnectScreen onConnect={handleConnect} />
      </Match>
    </Switch>
  )
}
