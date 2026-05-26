import { useLocationRoom } from './useLocationRoom'
import type { Accessor } from 'solid-js'

export type { PlayerState, DoorState, EnemyState, InteractionEvent } from './useLocationRoom'

export function createBiomeRoom(
  token: Accessor<string | null>,
  heroIds: Accessor<string[]>,
  biomeId: Accessor<string>,
) {
  return useLocationRoom({
    roomName: 'BiomeRoom',
    options: () => ({ token: token(), heroIds: heroIds(), biomeId: biomeId() }),
  })
}
