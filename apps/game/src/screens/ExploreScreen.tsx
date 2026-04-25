import { createSignal, createMemo, Show } from 'solid-js'
import { THE_INN, generateSceneFromInn } from 'shared-types'
import type { ExploreMap, ExploreToken, SceneData } from 'shared-types'
import type { Panel } from 'click-comics'
import { createExploreRoom } from '../hooks/useExploreRoom'
import { ComicPlayer } from '../components/ComicPlayer'
import { SimpleQuestHUD, sampleContent } from 'simplequest-hud'
import { PlaysetBoard } from 'playsets'
import { token, heroIds } from '../session'

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

export function ExploreScreen() {
  const state = createExploreRoom(token, heroIds)
  const [showSheet, setShowSheet] = createSignal(false)
  const sceneJson = createMemo(() => {
    const sd: SceneData | null = state.sceneData()
    if (sd) return JSON.stringify(sd)
    return JSON.stringify(generateSceneFromInn(THE_INN))
  })
  const contentJson = JSON.stringify(sampleContent)
  const characterJson = () => {
    const h = state.heroState()
    return h ? JSON.stringify(h) : ''
  }

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

  const exploreMap = (): ExploreMap => {
    const tokens: ExploreToken[] = [
      ...Object.entries(state.players()).map(([id, p]) => ({
        x: p.x, y: p.y,
        type: 'player' as const,
        id,
        label: id,
        isMe: id === state.mySessionId(),
      })),
      ...state.npcs().map((n) => ({
        x: n.x, y: n.y,
        type: 'npc' as const,
        id: n.id,
        label: n.name,
      })),
      ...state.doors().map((d) => ({
        x: d.x, y: d.y,
        type: 'door' as const,
        id: d.id,
        label: d.label,
      })),
    ]
    return { walls: THE_INN.walls, tokens }
  }

  const interactionPanels = (): Panel[] | null => {
    const ev = state.interaction()
    if (!ev) return null
    if (ev.type === 'npc') return NPC_PANELS[ev.role] ?? null
    if (ev.type === 'door') return DOOR_PANELS
    return null
  }

  const encounterPanels = (): Panel[] | null => {
    const ev = state.encounter()
    if (!ev) return null
    return [{ speaker: ev.enemyName, text: 'Blocks your path! Combat coming soon.' }]
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
            <div style={{ width: '720px', height: '480px', 'flex-shrink': '0' }}>
              <PlaysetBoard
                mode="explore"
                roomId="inn"
                exploreMap={exploreMap()}
                sceneJson={sceneJson()}
                onCellClick={handleCellClick}
              />
            </div>

            <Show when={showSheet()}>
              <div style={{ width: '480px', 'flex-shrink': '0' }}>
                <SimpleQuestHUD content={contentJson} character={characterJson()} />
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

          {/* Encounter comic panel — bottom center overlay */}
          <Show when={encounterPanels()}>
            {(panels) => (
              <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
                <ComicPlayer panels={panels()} onComplete={state.dismissEncounter} />
              </div>
            )}
          </Show>
        </div>
      </Show>
    </Show>
  )
}
