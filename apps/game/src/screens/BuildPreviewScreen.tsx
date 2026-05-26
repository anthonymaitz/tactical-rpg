import { useParams } from '@solidjs/router'
import { createBiomeRoom } from '../hooks/useBiomeRoom'
import { token, heroIds } from '../session'
import { LocationScreen } from './LocationScreen'

/**
 * BuildPreviewScreen — placeholder preview for a chunk being edited.
 * Joins a BiomeRoom with biomeId='preview' and the chunk slug as a hint.
 * Server-side preview logic is not yet implemented; this renders a standard
 * biome room for now.
 */
export function BuildPreviewScreen() {
  const params = useParams<{ slug: string }>()
  const biomeId = () => 'preview'
  const state = createBiomeRoom(token, heroIds, biomeId)
  return (
    <LocationScreen config={{
      state,
      showInitiativeTracker: false,
      showExtractPrompt: true,
      biomeName: `Preview: ${params.slug}`,
      roomId: 'preview',
      walls: [],
      hintText: `Previewing chunk: ${params.slug}`,
    }} />
  )
}
