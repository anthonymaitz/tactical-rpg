import { createSignal, For, Show } from 'solid-js'
import { isRecovering } from 'shared-types'
import type { HeroRecord } from 'shared-types'

const MAX_PARTY = 4

interface Props {
  biomeId: string
  biomeName: string
  heroes: () => HeroRecord[]
  loading?: () => boolean
  onConfirm: (selectedIds: string[]) => void
  onCancel: () => void
}

export function PartyPicker(props: Props) {
  const [selected, setSelected] = createSignal<string[]>([])

  function toggle(hero: HeroRecord) {
    if (isRecovering(hero)) return
    setSelected((prev) => {
      if (prev.includes(hero.id)) return prev.filter((id) => id !== hero.id)
      if (prev.length >= MAX_PARTY) return prev
      return [...prev, hero.id]
    })
  }

  return (
    <div style="position:fixed;inset:0;z-index:50;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;">
      <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:28px 32px;min-width:380px;max-width:520px;width:90%;">
        <div style="font-size:18px;font-weight:700;color:#e8e8e8;margin-bottom:4px;">Choose Your Party</div>
        <div style="font-size:12px;color:#666;margin-bottom:20px;">Entering {props.biomeName} · Up to {MAX_PARTY} heroes</div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px;">
          <For each={props.heroes()}>
            {(hero) => {
              const recovering = isRecovering(hero)
              const isSelected = () => selected().includes(hero.id)
              const atMax = () => selected().length >= MAX_PARTY && !isSelected()
              return (
                <div
                  onClick={() => toggle(hero)}
                  style={`display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;cursor:${recovering || atMax() ? 'not-allowed' : 'pointer'};border:1px solid ${isSelected() ? 'rgba(80,180,100,0.6)' : 'rgba(255,255,255,0.08)'};background:${isSelected() ? 'rgba(30,60,30,0.7)' : 'rgba(255,255,255,0.03)'};opacity:${recovering || atMax() ? 0.45 : 1};`}
                >
                  <div style={`width:12px;height:12px;border-radius:50%;border:2px solid ${isSelected() ? '#5ab470' : 'rgba(255,255,255,0.25)'};background:${isSelected() ? '#5ab470' : 'transparent'};flex-shrink:0;`} />
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:13px;color:#e0e0e0;">{hero.name}</div>
                    <div style="font-size:11px;color:#777;">{hero.characterClass} · Lv{hero.level} · {hero.personality}</div>
                  </div>
                  <Show when={recovering}>
                    <div style="font-size:10px;color:#c05050;flex-shrink:0;">Recovering</div>
                  </Show>
                </div>
              )
            }}
          </For>
          <Show when={props.heroes().length === 0}>
            <div style="color:#666;font-size:13px;text-align:center;padding:20px 0;">
              {props.loading?.() ? 'Loading heroes…' : 'No heroes available'}
            </div>
          </Show>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button
            onClick={props.onCancel}
            style="padding:8px 18px;font-size:12px;cursor:pointer;background:transparent;color:#888;border:1px solid rgba(255,255,255,0.15);border-radius:6px;"
          >
            Cancel
          </button>
          <button
            onClick={() => props.onConfirm(selected())}
            disabled={selected().length === 0}
            style={`padding:8px 20px;font-size:12px;font-weight:600;cursor:${selected().length === 0 ? 'not-allowed' : 'pointer'};background:${selected().length === 0 ? 'rgba(80,180,100,0.15)' : 'rgba(80,180,100,0.25)'};color:${selected().length === 0 ? '#4a7a55' : '#7de89a'};border:1px solid ${selected().length === 0 ? 'rgba(80,180,100,0.2)' : 'rgba(80,180,100,0.5)'};border-radius:6px;`}
          >
            Enter {props.biomeName} ({selected().length})
          </button>
        </div>
      </div>
    </div>
  )
}
