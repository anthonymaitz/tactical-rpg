import { createSignal, createMemo, createEffect, on, For, Show } from 'solid-js'
import { getReachableCells, getMoveCost } from 'shared-types'
import type { ExploreMap, ExploreToken, AbilityDefinition, Position, SceneData } from 'shared-types'
import type { Panel } from 'click-comics'
import { createBiomeRoom } from '../hooks/useBiomeRoom'
import { createHeroes } from '../hooks/useHeroes'
import { ComicPlayer } from '../components/ComicPlayer'
import { InventoryPanel } from '../components/InventoryPanel'
import { CombatResultModal } from '../components/CombatResultModal'

import { SimpleQuestHUD } from 'simplequest-hud'
import { useContent } from '../hooks/useContent'
import { PlaysetBoard } from 'playsets'
import { token, heroIds } from '../session'
import { classToSpriteId } from '../lib/sprites'
import { useNavigate, useParams } from '@solidjs/router'

const SIDEBAR_WIDTH = 380
// Open biome — no walls
const NO_WALLS: number[][] = []

export function BiomeScreen() {
  const params = useParams<{ biomeId: string }>()
  const navigate = useNavigate()
  const biomeId = () => params.biomeId

  const state = createBiomeRoom(token, heroIds, biomeId)
  const heroRoster = createHeroes(token)
  let boardEl: HTMLElement | undefined

  const [sidebarTab, setSidebarTab] = createSignal<'character' | 'inventory'>('character')
  const [selectedAbility, setSelectedAbility] = createSignal<AbilityDefinition | null>(null)
  const [usedAbilityTitles, setUsedAbilityTitles] = createSignal<string[]>([])
  const [dragPos, setDragPos] = createSignal<Position | null>(null)

  type Doober = { id: string; text: string; color: string }
  const [doobers, setDoobers] = createSignal<Doober[]>([])

  createEffect(on(
    () => myActor()?.energy ?? -1,
    (energy) => {
      const actor = myActor()
      if (actor && energy === actor.maxEnergy) setUsedAbilityTitles([])
    }
  ))

  createEffect(on(
    () => state.actionResult(),
    (result) => {
      if (!result) return
      const cs = state.combatState()
      const newDoobers: Doober[] = []
      for (const [actorId, delta] of Object.entries(result.hpDeltas)) {
        if (delta === 0) continue
        const actor = cs?.actors[actorId]
        const name = actor?.name ?? actorId
        const rollText = result.rolls.length > 0 ? ` [${result.rolls.map((r) => r.total).join('+')}]` : ''
        newDoobers.push({
          id: `${Date.now()}-${actorId}-${Math.random()}`,
          text: delta < 0 ? `${name} ${delta}${rollText}` : `${name} +${delta}${rollText}`,
          color: delta < 0 ? '#f66' : '#6f6',
        })
      }
      if (newDoobers.length === 0) return
      setDoobers((prev) => [...prev, ...newDoobers])
      const ids = new Set(newDoobers.map((d) => d.id))
      setTimeout(() => setDoobers((prev) => prev.filter((d) => !ids.has(d.id))), 2500)
    }
  ))

  // Forward server-broadcast events to board for other clients' tokens
  createEffect(on(state.emoteEvent, (ev) => {
    if (!ev || !boardEl || heroIds().includes(ev.id)) return
    boardEl.dispatchEvent(new CustomEvent('show-emote', { detail: { id: ev.id, emote: ev.emote } }))
  }))
  createEffect(on(state.speechEvent, (ev) => {
    if (!ev || !boardEl || heroIds().includes(ev.id)) return
    boardEl.dispatchEvent(new CustomEvent('show-speech', { detail: { id: ev.id, speech: ev.speech } }))
  }))
  createEffect(on(state.actionEvent, (ev) => {
    if (!ev || !boardEl || heroIds().includes(ev.id)) return
    boardEl.dispatchEvent(new CustomEvent('show-action', { detail: { id: ev.id, action: ev.action } }))
  }))

  const sceneJson = () => {
    const sd: SceneData | null = state.sceneData()
    if (sd) return JSON.stringify(sd)
    return JSON.stringify({ buildings: [], layers: [{ id: 1, background: 'grass' }], props: [], tokens: [], weather: 'sunny' })
  }

  const sqContent = useContent()
  const contentJson = () => JSON.stringify(sqContent() ?? {})

  const myHeroId = (): string | null => {
    const cs = state.combatState()
    if (!cs) return null
    const playerActors = Object.values(cs.actors).filter((a) => !a.isNPC)
    const ids = heroIds()
    if (ids.length > 0) {
      const byId = playerActors.find((a) => ids.includes(a.id))
      if (byId) return byId.id
    }
    const myPos = state.myPosition()
    if (myPos) {
      const byPos = playerActors.find((a) => a.position.x === myPos.x && a.position.y === myPos.y)
      if (byPos) return byPos.id
    }
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
      const cs = state.combatState()
      if (!cs) return JSON.stringify({ ...base, hp: actor.hp, energy: energyArray, combat: 'inCombat' as const })
      return JSON.stringify({
        ...base,
        hp: actor.hp,
        energy: energyArray,
        combat: 'inCombat' as const,
        round: cs.round,
        selectedAbility: selectedAbility()?.name ?? null,
        usedAbilities: usedAbilityTitles(),
      })
    }
    if (h) return JSON.stringify(h)
    return ''
  }

  const moveHighlights = createMemo((): Position[] => {
    if (!isMyTurn()) return []
    const actor = myActor()
    if (!actor) return []
    return getReachableCells(actor.position, NO_WALLS, actor.energy)
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
    const dp = dragPos()
    if (state.combatState()) {
      const ability = selectedAbility()
      const base = ability
        ? abilityHighlights().map((p) => ({ x: p.x, y: p.y, kind: 'ability' as const }))
        : moveHighlights().map((p) => ({ x: p.x, y: p.y, kind: 'move' as const }))
      if (dp) return [...base, { x: dp.x, y: dp.y, kind: 'target' as const }]
      return base
    }
    if (!dp) return []
    const isEncounter = Object.values(state.enemies()).some(
      (e) => Math.abs(dp.x - e.x) + Math.abs(dp.y - e.y) <= 3
    )
    return [{ x: dp.x, y: dp.y, kind: (isEncounter ? 'encounter' : 'drop') as 'encounter' | 'drop' }]
  })

  function handleItemActivate(id: string) {
    if (id === 'health_potion') state.usePotion()
  }

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

  function handleTokenFace(direction: string) {
    state.face(direction)
  }

  function handleTokenMove(x: number, y: number) {
    setDragPos(null)
    const cs = state.combatState()
    if (cs && isMyTurn()) {
      const actor = myActor()
      if (!actor) return
      const cost = getMoveCost(actor.position, { x, y }, NO_WALLS)
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
          setUsedAbilityTitles((prev) => [...prev, ability.name])
          setSelectedAbility(null)
        }
      }
    }
  }

  const exploreMap = (): ExploreMap => {
    const myId = state.mySessionId()
    const myPos = myId ? state.players()[myId] : null
    const partyIds = heroIds()
    const tokens: ExploreToken[] = [
      ...Object.entries(state.players()).map(([id, p]) => {
        const isMe = id === myId
        return {
          x: p.x, y: p.y,
          type: 'player' as const,
          id,
          label: id,
          isMe,
          direction: p.direction,
          spriteId: isMe ? classToSpriteId(state.heroState()?.class) : undefined,
        }
      }),
      // Companion heroes (party members beyond the first) follow the lead hero
      ...(myPos && partyIds.length > 1 ? partyIds.slice(1).map((heroId, i) => {
        const companion = heroRoster.heroes().find((h) => h.id === heroId)
        return {
          x: myPos.x,
          y: myPos.y + (i + 1),
          type: 'player' as const,
          id: heroId,
          label: companion?.name ?? heroId,
          isMe: false,
          direction: myPos.direction,
          spriteId: classToSpriteId(companion?.characterClass),
        }
      }) : []),
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
    return { walls: NO_WALLS, tokens }
  }

  const extractPrompt = () => {
    const ev = state.interaction()
    return ev?.type === 'door' && ev.biomeId === 'inn'
  }

  const encounterPanels = (): Panel[] | null => {
    const ev = state.encounter()
    if (!ev) return null
    return [{ speaker: 'Encounter!', text: `A ${ev.enemyName} blocks your path. Prepare for combat!` }]
  }

  createEffect(on(() => state.combatState(), (cs) => {
    if (cs) state.dismissEncounter()
  }))

  const currentCombatActor = createMemo(() => {
    const cs = state.combatState()
    if (!cs) return null
    return cs.actors[cs.turnQueue[cs.currentActorIndex]] ?? null
  })

  return (
    <Show when={!state.error()} fallback={<div style={{ padding: '20px', color: 'red' }}>Connection error: {state.error()}</div>}>
      <Show when={state.connected()} fallback={<div style={{ padding: '20px', background: '#111', color: '#fff', 'min-height': '100vh' }}>Entering biome…</div>}>
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>

          <div style={{ position: 'relative', flex: '1 1 0', 'min-width': 0 }}>
            <PlaysetBoard
              mode={state.combatState() ? 'combat' : 'explore'}
              roomId={biomeId()}
              exploreMap={exploreMap()}
              sceneJson={sceneJson()}
              combatState={state.combatState() ?? undefined}
              myActorId={myHeroId() ?? undefined}
              highlights={highlights()}
              onCellClick={handleCellClick}
              onTokenMove={handleTokenMove}
              onTokenDrag={handleTokenDrag}
              onTokenFace={handleTokenFace}
              onRef={(el) => { boardEl = el }}
              onTokenEmote={(emote) => state.emote(emote)}
              onTokenSpeech={(speech) => state.speech(speech)}
              onTokenAction={(action) => state.action(action)}
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

            {/* Targeting prompt */}
            <Show when={selectedAbility()}>
              <div style={{
                position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                'z-index': '20', background: 'rgba(5,15,5,0.93)',
                border: '1px solid rgba(100,220,100,0.35)', 'border-radius': '8px',
                padding: '10px 20px', display: 'flex', 'align-items': 'center', gap: '12px',
              }}>
                <span style={{ color: '#9f9', 'font-size': '13px', 'font-weight': '600' }}>
                  Select a target for {selectedAbility()!.name}
                </span>
                <button
                  onClick={() => setSelectedAbility(null)}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', 'border-radius': '4px', color: '#888', cursor: 'pointer', 'font-size': '11px', padding: '2px 8px' }}
                >
                  cancel
                </button>
              </div>
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

            {/* Doobers */}
            <Show when={doobers().length > 0}>
              <style>{`
                @keyframes doober-rise {
                  0%   { opacity: 1; transform: translateY(0) scale(1); }
                  60%  { opacity: 1; }
                  100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
                }
                .doober-item { animation: doober-rise 2.5s ease-out forwards; pointer-events: none; }
              `}</style>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                'z-index': '25', display: 'flex', 'flex-direction': 'column',
                gap: '6px', 'align-items': 'center', 'pointer-events': 'none',
              }}>
                <For each={doobers()}>
                  {(d) => (
                    <div class="doober-item" style={{ color: d.color, 'font-size': '20px', 'font-weight': '800', 'text-shadow': '0 2px 6px rgba(0,0,0,0.9)', 'white-space': 'nowrap' }}>
                      {d.text}
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Join combat offer */}
            <Show when={state.joinOffer()}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', 'z-index': '20', background: 'rgba(5,10,5,0.95)', border: '1px solid rgba(255,200,50,0.3)', 'border-radius': '8px', padding: '20px 28px', 'text-align': 'center' }}>
                <div style={{ color: '#fa0', 'font-size': '14px', 'margin-bottom': '12px' }}>A battle is nearby!</div>
                <div style={{ display: 'flex', gap: '8px', 'justify-content': 'center' }}>
                  <button onClick={state.joinCombat} style={{ padding: '6px 16px', background: 'rgba(80,160,80,0.2)', color: '#6f6', border: '1px solid #3a5a3a', 'border-radius': '4px', cursor: 'pointer' }}>Join</button>
                  <button onClick={state.dismissJoinOffer} style={{ padding: '6px 16px', background: 'rgba(10,10,10,0.5)', color: '#666', border: '1px solid #333', 'border-radius': '4px', cursor: 'pointer' }}>Ignore</button>
                </div>
              </div>
            </Show>

            {/* Combat results overlay */}
            <CombatResultModal
              result={state.combatResult()}
              loot={state.combatLoot()}
              recoveryEndsAt={state.recoveryEndsAt()}
              onDismissWin={state.dismissCombatResult}
              onDismissLose={() => { state.dismissCombatResult(); navigate('/inn') }}
            />

            {/* Extract prompt */}
            <Show when={extractPrompt()}>
              <div style={{
                position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                'z-index': '20', background: 'rgba(5,10,5,0.96)', border: '1px solid rgba(255,255,255,0.12)',
                'border-radius': '10px', padding: '18px 24px', display: 'flex', 'flex-direction': 'column',
                gap: '12px', 'min-width': '280px',
              }}>
                <div style={{ color: '#e0e0e0', 'font-size': '14px', 'font-weight': '600' }}>Return to the Inn?</div>
                <div style={{ color: '#888', 'font-size': '12px' }}>Your heroes will return with everything they've found.</div>
                <div style={{ display: 'flex', gap: '10px', 'justify-content': 'flex-end' }}>
                  <button
                    onClick={() => state.dismissInteraction()}
                    style={{ padding: '6px 16px', 'font-size': '12px', cursor: 'pointer', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.15)', 'border-radius': '5px' }}
                  >
                    Stay
                  </button>
                  <button
                    onClick={() => { state.dismissInteraction(); navigate('/inn') }}
                    style={{ padding: '6px 18px', 'font-size': '12px', 'font-weight': '600', cursor: 'pointer', background: 'rgba(80,180,100,0.2)', color: '#7de89a', border: '1px solid rgba(80,180,100,0.4)', 'border-radius': '5px' }}
                  >
                    Return to Inn
                  </button>
                </div>
              </div>
            </Show>

            {/* Encounter comic panel */}
            <Show when={encounterPanels()}>
              {(panels) => (
                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', 'max-width': '480px', width: '100%', 'z-index': '10' }}>
                  <ComicPlayer panels={panels()} onComplete={state.dismissEncounter} />
                </div>
              )}
            </Show>

            <div style={{ position: 'absolute', bottom: '10px', left: '10px', 'font-size': '11px', color: 'rgba(255,255,255,0.3)', 'z-index': '10', 'pointer-events': 'none' }}>
              Drag your token to move · Walk to the spawn pad to extract
            </div>
          </div>

          {/* Right sidebar — tab switcher + content */}
          <div style={{
            width: `${SIDEBAR_WIDTH}px`, 'flex-shrink': '0', height: '100vh', overflow: 'hidden',
            background: 'rgba(8,12,8,0.97)', 'border-left': '1px solid rgba(255,255,255,0.07)',
            display: 'flex', 'flex-direction': 'column',
          }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', 'border-bottom': '1px solid rgba(255,255,255,0.07)', 'flex-shrink': '0' }}>
              {(['character', 'inventory'] as const).map((tab) => (
                <button
                  onClick={() => setSidebarTab(tab)}
                  style={{
                    flex: '1', padding: '8px', 'font-size': '11px', 'font-weight': '600',
                    cursor: 'pointer', border: 'none', 'letter-spacing': '0.05em',
                    'text-transform': 'uppercase',
                    background: sidebarTab() === tab ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: sidebarTab() === tab ? '#ccc' : '#555',
                    'border-bottom': sidebarTab() === tab ? '2px solid rgba(100,200,100,0.5)' : '2px solid transparent',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <Show when={sidebarTab() === 'character'}>
              <div style={{ flex: '1 1 0', overflow: 'hidden', display: 'flex', 'flex-direction': 'column', 'min-height': '0' }}>
                <SimpleQuestHUD
                  content={contentJson()}
                  character={characterJson()}
                  locked={true}
                  onAbilityActivate={handleAbilityActivate}
                  onItemActivate={handleItemActivate}
                />
              </div>

              <Show when={state.combatState() && isMyTurn()}>
                <div style={{ 'flex-shrink': '0', padding: '10px 14px', 'border-top': '1px solid rgba(255,255,255,0.07)', display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
                  <Show when={selectedAbility()}>
                    <div style={{ 'font-size': '11px', color: '#6f6', padding: '4px 0' }}>
                      {'▶'} {selectedAbility()!.name} selected — click an enemy to attack
                      <button onClick={() => setSelectedAbility(null)} style={{ 'margin-left': '8px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', 'font-size': '11px' }}>cancel</button>
                    </div>
                  </Show>
                  <button
                    onClick={() => { setSelectedAbility(null); state.endTurn() }}
                    style={{ padding: '8px', 'font-size': '12px', cursor: 'pointer', background: 'rgba(10,10,30,0.9)', color: '#aaf', border: '1px solid rgba(150,150,255,0.25)', 'border-radius': '5px', 'font-weight': '600' }}
                  >
                    End Turn
                  </button>
                </div>
              </Show>
            </Show>

            <Show when={sidebarTab() === 'inventory'}>
              <div style={{ flex: '1 1 0', 'min-height': '0', overflow: 'auto' }}>
                <InventoryPanel token={token} heroes={heroRoster.heroes} />
              </div>
            </Show>
          </div>

        </div>
      </Show>
    </Show>
  )
}
