import { lazy } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { ConnectScreen } from './screens/ConnectScreen'
import { ExploreScreen } from './screens/ExploreScreen'
import { BiomeScreen } from './screens/BiomeScreen'
import { DebugScreen } from './screens/DebugScreen'

const BuildScreen = lazy(() => import('./screens/BuildScreen'))

export default function App() {
  return (
    <Router base={(import.meta.env.BASE_URL ?? '').replace(/\/$/, '')}>
      <Route path="/" component={ConnectScreen} />
      <Route path="/inn" component={ExploreScreen} />
      <Route path="/biome/:biomeId" component={BiomeScreen} />
      <Route path="/build/:slug" component={BuildScreen} />
      <Route path="/debug" component={DebugScreen} />
    </Router>
  )
}
