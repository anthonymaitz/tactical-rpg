import type { Panel } from 'click-comics'
import { createExploreRoom } from '../hooks/useExploreRoom'
import { token, heroIds } from '../session'
import { LocationScreen } from './LocationScreen'

const NPC_PANELS: Record<string, Panel[]> = {
  innkeeper: [
    { speaker: 'Innkeeper', text: 'Welcome back! Rest up — your heroes are fully restored.' },
  ],
  blacksmith: [
    { speaker: 'Blacksmith', text: 'I can help you equip your heroes when gear equipping arrives.' },
  ],
  sage_locked: [
    { speaker: 'Sage', text: 'Return when you\'ve proven yourself in battle. Secondary paths open at level 5.' },
  ],
  sage_unlocked: [
    { speaker: 'Sage', text: 'Your spirit is ready. Choose a second path — one ability from another class will join your arsenal.' },
  ],
  sage_rechosen: [
    { speaker: 'Sage', text: 'Your path can be reforged. Choose again to swap your borrowed ability.' },
  ],
}

export function ExploreScreen() {
  const state = createExploreRoom(token, heroIds)
  return (
    <LocationScreen config={{
      state,
      npcPanels: NPC_PANELS,
    }} />
  )
}
