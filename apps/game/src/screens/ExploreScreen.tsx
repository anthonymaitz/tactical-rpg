import type { Panel } from 'click-comics'
import { createResource, createSignal, Show } from 'solid-js'
import { createExploreRoom } from '../hooks/useExploreRoom'
import { token, heroIds } from '../session'
import { LocationScreen } from './LocationScreen'
import { BlacksmithShop } from '../components/BlacksmithShop'

const API = import.meta.env.VITE_API_URL

// Hardcoded fallback — used while the DB fetch is loading or if the key doesn't exist yet
const FALLBACK_NPC_PANELS: Record<string, Panel[]> = {
  innkeeper: [
    { speaker: 'Innkeeper', text: 'Welcome back! Rest up — your heroes are fully restored.' },
  ],
  blacksmith: [
    { speaker: 'Blacksmith', text: 'Welcome to my forge! Browse my wares.' },
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

async function fetchNpcDialogue(): Promise<Record<string, Panel[]>> {
  const res = await fetch(`${API}/content/npc-dialogue`)
  if (!res.ok) return FALLBACK_NPC_PANELS
  const data = await res.json() as Record<string, Panel[]>
  // If the DB key doesn't exist yet the server returns {}, fall back to hardcoded
  if (!data || Object.keys(data).length === 0) return FALLBACK_NPC_PANELS
  return data
}

export function ExploreScreen() {
  const state = createExploreRoom(token, heroIds)
  const [npcPanels] = createResource(fetchNpcDialogue)
  const [showBlacksmith, setShowBlacksmith] = createSignal(false)

  // The first hero ID is the active hero in the inn
  const firstHeroId = () => heroIds()[0] ?? null
  const heroLevel = () => state.heroMeta().level

  return (
    <>
      <LocationScreen config={{
        state,
        npcPanels: npcPanels() ?? FALLBACK_NPC_PANELS,
        onBlacksmithOpen: () => setShowBlacksmith(true),
      }} />
      <Show when={showBlacksmith()}>
        <BlacksmithShop
          token={token}
          heroId={firstHeroId}
          heroLevel={heroLevel}
          onClose={() => setShowBlacksmith(false)}
        />
      </Show>
    </>
  )
}
