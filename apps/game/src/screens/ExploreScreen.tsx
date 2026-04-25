import { createSignal, createMemo, Show } from 'solid-js'
import { THE_INN, generateSceneFromInn, getReachableCells, getMoveCost } from 'shared-types'
import type { ExploreMap, ExploreToken, SceneData, AbilityDefinition, Position } from 'shared-types'
import type { Panel } from 'click-comics'
import { createExploreRoom } from '../hooks/useExploreRoom'
import { ComicPlayer } from '../components/ComicPlayer'
import { SimpleQuestHUD, sampleContent } from 'simplequest-hud'
import { PlaysetBoard } from 'playsets'
import { token, heroIds } from '../session'
import { useNavigate } from '@solidjs/router'

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

const SIDEBAR_WIDTH = 380

export function ExploreScreen() {
  const state = createExploreRoom(token, heroIds)
  const navigate = useNavigate()
  const [selectedAbility, setSelectedAbility] = createSignal<AbilityDefinition | null>(null)
  const [dragPos, setDragPos] = createSignal<Position | null>(null)

  const sceneJson = createMemo(() => {
    const sd: SceneData | null = state.sceneData()
    if (sd) return JSON.stringify(sd)
    return JSON.stringify(generateSceneFromInn(THE_INN))
  })
  const contentJson = JSON.stringify(sampleContent)

  const myHeroId = (): string | null => {
    const cs = state.combatState()
    if (!cs) return null
    const playerActors = Object.values(cs.actors).filter((a) => !a.isNPC)
    // Match by hero ID from session — most reliable
    const ids = heroIds()
    if (ids.length > 0) {
      const byId = playerActors.find((a) => ids.includes(a.id))
      if (byId) return byId.id
    }
    // Fallback: initial position match
    const myPos = state.myPosition()
    if (myPos) {
      const byPos = playerActors.find((a) => a.position.x === myPos.x && a.position.y === myPos.y)
      if (byPos) return byPos.id
    }
    // Last resort: only player in this combat (single-player)
    if (playerActors.length === 1) return playerActors[0].id
    return null
  }

  const isMyTurn = (): boolean => {
    const cs = state.combatState()
    if (!cs) return false
    const heroId = myHeroId()
    return cs.turnQueue[cs.currentActorIndex] === heroId
  }

  const myActor = () => {
    const cs = state.combatState()
    const heroId = myHeroId()
    if (!cs || !heroId) return null
    return cs.actors[heroId] ?? null
  }

  // Build character data for the HUD — prefer heroState (full data), fall back to combat actor
  const characterJson = () => {
    const actor = myActor()
    const h = state.heroState()

    if (actor) {
      const energyArray = Array(10).fill(false).map((_, i) => i < actor.energy)
      const base = h ?? {
        name: actor.name,
        class: actor.characterClass,
        personality: actor.personality,
        profession: '',
        die: actor.die,
      }
      return JSON.stringify({ ...base, hp: actor.hp, energy: energyArray, combat: 'inCombat' as const })
    }

    if (h) return JSON.stringify(h)
    return ''
  }

  const moveHighlights = createMemo((): Position[] => {
    if (!isMyTurn()) return []
    const actor = myActor()
    if (!actor) return []
    return getReachableCells(actor.position, THE_INN.walls, actor.energy)
  })

  const abilityHighlights = createMemo((): Position[] => {
    const ability = selectedAbility()
    const cs = state.combatState()
    if (!ability || !cs) return []
    const actor = myActor()
    if (!actor) return []
    return Object.values(cs.actors)
      .filter((a) => a.isNPC && a.hp > 0)
      .map((a) => a.position)
  })

  const highlights = createMemo(() => {
    if (!state.combatState()) return []
    const ability = selectedAbility()
    const base = ability
      ? abilityHighlights().map((p) => ({ x: p.x, y: p.y, kind: 'ability' as const }))
      : moveHighlights().map((p) => ({ x: p.x, y: p.y, kind: 'move' as const }))
    const dp = dragPos()
    if (dp) return [...base, { x: dp.x, y: dp.y, kind: 'target' as const }]
    return base
  })

  function handleAbilityActivate(title: string) {
    if (!isMyTurn()) return
    const actor = myActor()
    if (!actor) return
    const ability = actor.abilities.find((a) => a.name === title)
    if (!ability) return
    setSelectedAbility((prev) => prev?.id === ability.id ? null : ability)
  }

  function handleTokenDrag(x: number, y: number) {
    setDragPos({ x, y })
  }

  function handleTokenMove(x: number, y: number) {
    setDragPos(null)
    const cs = state.combatState()
    if (cs && isMyTurn()) {
      const actor = myActor()
      if (!actor) return
      const cost = getMoveCost(actor.position, { x, y }, THE_INN.walls)
      if (cost !== null && cost <= actor.energy) {
        state.sendAction({ type: 'move', actorId: actor.id, destination: { x, y } })
      }
      return
    }
    state.move({ x, y })
  }

  function handleCellClick(x: number, y: number) {
    const cs = state.combatState()
    if (cs && isMyTurn()) {
      const ability = selectedAbility()
      if (ability) {
        const actor = myActor()
        if (!actor) return
        const target = Object.values(cs.actors).find((a) => a.position.x === x && a.position.y === y)
        if (target && target.isNPC && target.hp > 0) {
          state.sendAction({ type: 'ability', actorId: actor.id, ability, targetIds: [target.id] })
          setSelectedAbility(null)
        }
      }
      return
    }
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
      ...Object.values(state.enemies()).map((e) => ({
        x: e.x, y: e.y,
        type: 'enemy' as const,
        id: e.id,
        label: e.name,
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

  const currentCombatActor = createMemo(() => {
    const cs = state.combatState()
    if (!cs) return null
    return cs.actors[cs.turnQueue[cs.currentActorIndex]] ?? null
  })

  return (
    <Show when={!state.error()} fallback={<div style={{ padding: '20px', color: 'red' }}>Connection error: {state.error()}</div>}>
      <Show when={state.connected()} fallback={<div style={{ padding: '20px', background: '#111', color: '#fff', 'min-height': '100vh' }}>Connecting to The Inn…</div>}>
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>

          {/* Board — fills remaining space left of sidebar */}
          <div style={{ position: 'relative', flex: '1 1 0', 'min-width': 0 }}>
            <PlaysetBoard
              mode="explore"
              roomId="inn"
              exploreMap={exploreMap()}
              sceneJson={sceneJson()}
              combatState={state.combatState() ?? undefined}
              myActorId={myHeroId() ?? undefined}
              highlights={highlights()}
              onCellClick={handleCellClick}
              onTokenMove={handleTokenMove}
              onTokenDrag={handleTokenDrag}
            />

            {/* Turn indicator */}
            <Show when={currentCombatActor()}>
              {(current) => (
                <div style={{
                  position: 'absolute', top: '12px', left: '12px', 'z-index': '10',
                  background: 'rgba(5,10,5,0.85)', border: '1px solid rgba(255,255,255,0.1)',
                  'border-radius': '6px', padding: '6px 12px', 'font-size': '11px', color: '#aaa',
                }}>
                  <span>{'⚔'} {current().name}{'\''}s turn {'·'} Round {state.combatState()?.round ?? 0}</span>
                </div>
              )}
            </Show>

            {/* Action error toast */}
            <Show when={state.actionError()}>
              <div style={{
                position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
                'z-index': '30', background: 'rgba(180,40,40,0.92)', color: '#fcc',
                'border-radius': '6px', padding: '8px 18px', 'font-size': '12px',
                border: '1px solid rgba(255,100,100,0.3)', 'pointer-events': 'none',
              }}>
                {state.actionError()}
              </div>
            </Show>

            {/* Join combat offer */}
            <Show when={state.joinOffer()}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                'z-index': '20', background: 'rgba(5,10,5,0.95)', border: '1px solid rgba(255,200,50,0.3)',
                'border-radius': '8px', padding: '20px 28px', 'text-align': 'center',
              }}>
                <div style={{ color: '#fa0', 'font-size': '14px', 'margin-bottom': '12px' }}>A battle is nearby!</div>
                <div style={{ display: 'flex', gap: '8px', 'justify-content': 'center' }}>
                  <button onClick={state.joinCombat} style={{ padding: '6px 16px', background: 'rgba(80,160,80,0.2)', color: '#6f6', border: '1px solid #3a5a3a', 'border-radius': '4px', cursor: 'pointer' }}>Join</button>
                  <button onClick={state.dismissJoinOffer} style={{ padding: '6px 16px', background: 'rgba(10,10,10,0.5)', color: '#666', border: '1px solid #333', 'border-radius': '4px', cursor: 'pointer' }}>Ignore</button>
                </div>
              </div>
            </Show>

            {/* Combat results overlay */}
            <Show when={state.combatResult()}>
              <div style={{
                position: 'absolute', inset: '0', 'z-index': '30', background: 'rgba(0,0,0,0.7)',
                display: 'flex', 'align-items': 'center', 'justify-content': 'center',
              }}>
                <div style={{ background: 'rgba(5,10,5,0.97)', border: '1px solid rgba(255,255,255,0.1)', 'border-radius': '10px', padding: '32px 40px', 'text-align': 'center', 'max-width': '360px' }}>
                  <Show when={state.combatResult() === 'win'}>
                    <div style={{ color: '#6f6', 'font-size': '22px', 'margin-bottom': '8px' }}>Victory!</div>
                    <div style={{ color: '#888', 'font-size': '13px', 'margin-bottom': '20px' }}>The enemy has been defeated.</div>
                    <button onClick={state.dismissCombatResult} style={{ padding: '8px 24px', background: 'rgba(80,160,80,0.2)', color: '#6f6', border: '1px solid #3a5a3a', 'border-radius': '4px', cursor: 'pointer' }}>Continue</button>
                  </Show>
                  <Show when={state.combatResult() === 'lose'}>
                    <div style={{ color: '#f66', 'font-size': '22px', 'margin-bottom': '8px' }}>Defeated</div>
                    <div style={{ color: '#888', 'font-size': '13px', 'margin-bottom': '8px' }}>Your heroes need time to recover.</div>
                    <Show when={state.recoveryEndsAt()}>
                      <div style={{ color: '#666', 'font-size': '11px', 'margin-bottom': '16px' }}>
                        Available again: {new Date(state.recoveryEndsAt()!).toLocaleTimeString()}
                      </div>
                    </Show>
                    <button
                      onClick={() => { state.dismissCombatResult(); navigate('/') }}
                      style={{ padding: '8px 24px', background: 'rgba(160,50,50,0.2)', color: '#f88', border: '1px solid #5a3a3a', 'border-radius': '4px', cursor: 'pointer' }}
                    >
                      Return to Roster
                    </button>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Interaction comic panel */}
            <Show when={interactionPanels()}>
              {(panels) => (
                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
                  <ComicPlayer panels={panels()} onComplete={state.dismissInteraction} />
                </div>
              )}
            </Show>

            {/* Encounter comic panel */}
            <Show when={encounterPanels()}>
              {(panels) => (
                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
                  <ComicPlayer panels={panels()} onComplete={state.dismissEncounter} />
                </div>
              )}
            </Show>

            {/* Hint text */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', 'font-size': '11px', color: 'rgba(255,255,255,0.3)', 'z-index': '10', 'pointer-events': 'none' }}>
              Click NPC or door to interact · Drag or click to move
            </div>
          </div>

          {/* Right sidebar — SimpleQuest HUD + combat controls */}
          <div style={{
            width: `${SIDEBAR_WIDTH}px`,
            'flex-shrink': '0',
            height: '100vh',
            overflow: 'auto',
            background: 'rgba(8,12,8,0.97)',
            'border-left': '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            'flex-direction': 'column',
          }}>
            {/* SimpleQuest HUD — live character status + ability cards */}
            <div style={{ flex: '1 1 0', overflow: 'auto' }}>
              <SimpleQuestHUD
                content={contentJson}
                character={characterJson()}
                onAbilityActivate={handleAbilityActivate}
              />
            </div>

            {/* Combat controls — only shown during combat on player's turn */}
            <Show when={state.combatState() && isMyTurn()}>
              <div style={{
                'flex-shrink': '0',
                padding: '10px 14px',
                'border-top': '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                'flex-direction': 'column',
                gap: '8px',
              }}>
                <Show when={selectedAbility()}>
                  <div style={{ 'font-size': '11px', color: '#6f6', padding: '4px 0' }}>
                    {'▶'} {selectedAbility()!.name} selected — click an enemy to attack
                    <button
                      onClick={() => setSelectedAbility(null)}
                      style={{ 'margin-left': '8px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', 'font-size': '11px' }}
                    >
                      cancel
                    </button>
                  </div>
                </Show>
                <button
                  onClick={() => { setSelectedAbility(null); state.endTurn() }}
                  style={{
                    padding: '8px', 'font-size': '12px', cursor: 'pointer',
                    background: 'rgba(10,10,30,0.9)', color: '#aaf',
                    border: '1px solid rgba(150,150,255,0.25)', 'border-radius': '5px',
                    'font-weight': '600',
                  }}
                >
                  End Turn
                </button>
              </div>
            </Show>
          </div>

        </div>
      </Show>
    </Show>
  )
}
