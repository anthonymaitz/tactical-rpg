import { createBiomeRoom } from '../hooks/useBiomeRoom'
import { token, heroIds } from '../session'
import { useParams } from '@solidjs/router'
import { LocationScreen, BIOME_NAMES } from './LocationScreen'

export function BiomeScreen() {
  const params = useParams<{ biomeId: string }>()
  const biomeId = () => params.biomeId
  const state = createBiomeRoom(token, heroIds, biomeId)
  return (
    <LocationScreen config={{
      state,
      showInitiativeTracker: true,
      showExtractPrompt: true,
      biomeName: BIOME_NAMES[params.biomeId] ?? params.biomeId,
      roomId: params.biomeId,
      walls: [],
      hintText: 'Drag your token to move · Walk to the spawn pad to extract',
    }} />
  )
}
