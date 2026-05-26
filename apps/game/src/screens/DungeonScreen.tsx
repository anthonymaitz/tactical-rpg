import { useParams } from '@solidjs/router'
import { useLocationRoom } from '../hooks/useLocationRoom'
import { token, heroIds } from '../session'
import { LocationScreen } from './LocationScreen'

export function DungeonScreen() {
  const params = useParams<{ slug: string }>()
  const state = useLocationRoom({
    roomName: 'DungeonRoom',
    options: () => ({ token: token(), heroIds: heroIds(), chunkSlug: params.slug }),
    features: {
      combatJoinOffer: true,
      heroMeta: false,
      npcs: false,
    },
  })
  return (
    <LocationScreen config={{
      state,
      showInitiativeTracker: true,
      roomId: params.slug,
      walls: [],
      hintText: 'Drag your token to move',
    }} />
  )
}
