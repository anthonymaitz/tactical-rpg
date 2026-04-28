import { Show } from 'solid-js'
import type { LootResult } from 'shared-types'

interface Props {
  result: 'win' | 'lose' | null
  loot?: LootResult | null
  recoveryEndsAt?: string | null
  onDismissWin: () => void
  onDismissLose: () => void
}

export function CombatResultModal(props: Props) {
  return (
    <Show when={props.result}>
      <div style={{
        position: 'absolute', inset: '0', 'z-index': '30',
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', 'align-items': 'center', 'justify-content': 'center',
      }}>
        <div style={{
          background: 'rgba(5,10,5,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          'border-radius': '10px',
          padding: '32px 40px',
          'text-align': 'center',
          'max-width': '360px',
          width: '90%',
        }}>
          <Show when={props.result === 'win'}>
            <div style={{ color: '#6f6', 'font-size': '22px', 'font-weight': '700', 'margin-bottom': '12px' }}>Victory!</div>
            <Show when={props.loot}>
              {(loot) => (
                <div style={{ 'margin-bottom': '16px', display: 'flex', gap: '10px', 'justify-content': 'center', 'flex-wrap': 'wrap' }}>
                  <Show when={loot().gold > 0}>
                    <LootChip label={`+${loot().gold} gold`} color="#f0c040" />
                  </Show>
                  <Show when={loot().healthPotions > 0}>
                    <LootChip label={`+${loot().healthPotions} potion${loot().healthPotions > 1 ? 's' : ''}`} color="#e05080" />
                  </Show>
                  <Show when={loot().starFragments > 0}>
                    <LootChip label={`+${loot().starFragments} star frag${loot().starFragments > 1 ? 's' : ''}`} color="#80c0ff" />
                  </Show>
                  <Show when={(loot().decorShards ?? 0) > 0}>
                    <LootChip label={`+${loot().decorShards} decor shard${(loot().decorShards ?? 0) > 1 ? 's' : ''}`} color="#c080ff" />
                  </Show>
                  <Show when={(loot().builderPropIds?.length ?? 0) > 0}>
                    <LootChip label={`+${loot().builderPropIds!.length} builder prop${loot().builderPropIds!.length > 1 ? 's' : ''}`} color="#80ffcc" />
                  </Show>
                  <Show when={
                    loot().gold === 0 && loot().healthPotions === 0 &&
                    loot().starFragments === 0 && !loot().decorShards && !loot().builderPropIds?.length
                  }>
                    <span style={{ color: '#555', 'font-size': '12px' }}>No loot this time.</span>
                  </Show>
                </div>
              )}
            </Show>
            <div style={{ color: '#666', 'font-size': '12px', 'margin-bottom': '20px' }}>The enemy has been defeated.</div>
            <ModalButton label="Continue" color="green" onClick={props.onDismissWin} />
          </Show>

          <Show when={props.result === 'lose'}>
            <div style={{ color: '#f66', 'font-size': '22px', 'font-weight': '700', 'margin-bottom': '8px' }}>Defeated</div>
            <div style={{ color: '#888', 'font-size': '12px', 'margin-bottom': '8px' }}>Your heroes need time to recover.</div>
            <Show when={props.recoveryEndsAt}>
              <div style={{ color: '#555', 'font-size': '11px', 'margin-bottom': '16px' }}>
                Available again: {new Date(props.recoveryEndsAt!).toLocaleTimeString()}
              </div>
            </Show>
            <ModalButton label="Return to Inn" color="red" onClick={props.onDismissLose} />
          </Show>
        </div>
      </div>
    </Show>
  )
}

function LootChip(props: { label: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      'border-radius': '5px', padding: '4px 10px',
      color: props.color, 'font-size': '13px', 'font-weight': '600',
    }}>
      {props.label}
    </div>
  )
}

function ModalButton(props: { label: string; color: 'green' | 'red'; onClick: () => void }) {
  const isGreen = props.color === 'green'
  return (
    <button
      onClick={props.onClick}
      style={{
        padding: '8px 28px', 'font-size': '13px', 'font-weight': '600', cursor: 'pointer',
        background: isGreen ? 'rgba(80,160,80,0.2)' : 'rgba(160,50,50,0.2)',
        color: isGreen ? '#6f6' : '#f88',
        border: `1px solid ${isGreen ? '#3a5a3a' : '#5a3a3a'}`,
        'border-radius': '5px',
      }}
    >
      {props.label}
    </button>
  )
}
