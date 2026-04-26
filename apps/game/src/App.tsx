import { lazy } from 'solid-js'
import { Router, Route } from '@solidjs/router'
import { ConnectScreen } from './screens/ConnectScreen'
import { ExploreScreen } from './screens/ExploreScreen'

const BuildScreen = lazy(() => import('./screens/BuildScreen'))

export default function App() {
  return (
    <Router>
      <Route path="/" component={ConnectScreen} />
      <Route path="/inn" component={ExploreScreen} />
      <Route path="/build/:slug" component={BuildScreen} />
    </Router>
  )
}
