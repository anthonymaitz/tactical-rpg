import { createSignal, Show } from 'solid-js'
import { THE_INN } from 'shared-types'
import type { Panel } from 'click-comics'
import { createExploreRoom } from '../hooks/useExploreRoom'
import { InnView } from './InnView'
import { ComicPlayer } from '../components/ComicPlayer'
import { SimpleQuestHUD, sampleContent } from 'simplequest-hud'

const NPC_PANELS: Record<string, Panel[]> = {
  innkeeper: [
    { speaker: 'Innkeeper', text: 'Welcome to the Inn! Your heroes rest and recover here between runs.' },
  ],
  blacksmith: [
    { speaker: 'Blacksmith', text: 'I can help you equip your heroes when gear equipping arrives.' },
  ],
  doorkeeper: [
    { speaker: 'Doorkeeper', text: 'Ready to venture out? Walk up to the door when your party is ready.' },
  ],
}

const DOOR_PANELS: Panel[] = [
  { speaker: 'The Door', text: 'Biome exploration is coming in the next update.' },
]

interface ExploreScreenProps {
  token?: string | null
  heroIds?: string[]
}

export function ExploreScreen(props: ExploreScreenProps) {
  const state = createExploreRoom(
    () => props.token ?? null,
    () => props.heroIds ?? [],
  )
  const [showSheet, setShowSheet] = createSignal(false)
  const contentJson = JSON.stringify(sampleContent)

  function handleCellClick(x: number, y: number) {
    const pos = state.myPosition()
    if (!pos) return
    const isNpc = state.npcs().some((n) => n.x === x && n.y === y)
    const isDoor = state.doors().some((d) => d.x === x && d.y === y)
    const dist = Math.abs(pos.x - x) + Math.abs(pos.y - y)
    if ((isNpc || isDoor) && dist === 1) {
      state.interact()
    } else {
      state.move({ x, y })
    }
  }

  const interactionPanels = (): Panel[] | null => {
    const ev = state.interaction()
    if (!ev) return null
    if (ev.type === 'npc') return NPC_PANELS[ev.role] ?? null
    if (ev.type === 'door') return DOOR_PANELS
    return null
  }

  return (
    <Show when={!state.error()} fallback={<div style={{ padding: '20px', color: 'red' }}>Connection error: {state.error()}</div>}>
      <Show when={state.connected()} fallback={<div style={{ padding: '20px' }}>Connecting to The Inn…</div>}>
        <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', padding: '20px', background: '#111', 'min-height': '100vh', color: '#fff' }}>
          <div style={{ display: 'flex', gap: '12px', 'margin-bottom': '16px', 'align-items': 'center' }}>
            <h2 style={{ margin: '0' }}>The Inn</h2>
            <button
              onClick={() => setShowSheet((v) => !v)}
              style={{ padding: '4px 12px', 'font-size': '12px', cursor: 'pointer' }}
            >
              {showSheet() ? 'Hide Sheet' : 'Character Sheet'}
            </button>
          </div>

          <div style={{ 'font-size': '11px', color: '#666', 'margin-bottom': '8px' }}>
            Click an adjacent NPC or door to interact · Click a floor tile to move
          </div>

          <div style={{ display: 'flex', gap: '20px', 'align-items': 'flex-start', width: '100%', 'justify-content': 'center' }}>
            <div>
              <InnView
                map={THE_INN}
                players={state.players()}
                mySessionId={state.mySessionId()}
                npcs={state.npcs()}
                doors={state.doors()}
                onCellClick={handleCellClick}
              />
              <Show when={state.myPosition()}>
                <div style={{ 'margin-top': '8px', 'font-size': '11px', color: '#555', 'text-align': 'center' }}>
                  ({state.myPosition()!.x}, {state.myPosition()!.y})
                </div>
              </Show>
            </div>

            <Show when={showSheet()}>
              <div style={{ width: '480px', 'flex-shrink': '0' }}>
                <SimpleQuestHUD content={contentJson} />
              </div>
            </Show>
          </div>

          <Show when={interactionPanels()}>
            {(panels) => (
              <div style={{ 'margin-top': '20px', 'max-width': '480px', width: '100%' }}>
                <ComicPlayer panels={panels()} onComplete={state.dismissInteraction} />
              </div>
            )}
          </Show>
        </div>
      </Show>
    </Show>
  )
}
