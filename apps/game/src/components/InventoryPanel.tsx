import { For, Show } from 'solid-js'
import type { HeroRecord } from 'shared-types'
import { createInventory } from '../hooks/useInventory'
import { STAR_UPGRADE_COSTS } from 'shared-types'

interface Props {
  token: () => string | null
  heroes: () => HeroRecord[]
}

const STAR_LABELS = ['', '★', '★★', '★★★', '★★★★', '★★★★★']

export function InventoryPanel(props: Props) {
  const heroIds = () => props.heroes().map((h) => h.id)
  const inv = createInventory(props.token, heroIds)

  return (
    <div style={{ padding: '12px', display: 'flex', 'flex-direction': 'column', gap: '16px', 'overflow-y': 'auto', height: '100%' }}>

      {/* Account stash */}
      <div>
        <div style={{ 'font-size': '11px', 'font-weight': '700', color: '#888', 'letter-spacing': '0.08em', 'text-transform': 'uppercase', 'margin-bottom': '8px' }}>Stash</div>
        <Show when={inv.inventory()} fallback={<div style={{ color: '#555', 'font-size': '12px' }}>Loading…</div>}>
          {(stash) => (
            <div style={{ display: 'flex', gap: '10px', 'flex-wrap': 'wrap' }}>
              <StatChip label="Gold" value={stash().gold} color="#f0c040" />
              <StatChip label="Potions" value={stash().healthPotions} color="#e05080" />
              <StatChip label="Star Frags" value={stash().starFragments} color="#80c0ff" />
              <StatChip label="Decor Shards" value={stash().decorShards} color="#c080ff" />
            </div>
          )}
        </Show>
      </div>

      {/* Per-hero rows */}
      <div>
        <div style={{ 'font-size': '11px', 'font-weight': '700', color: '#888', 'letter-spacing': '0.08em', 'text-transform': 'uppercase', 'margin-bottom': '8px' }}>Heroes</div>
        <For each={props.heroes()}>
          {(hero) => {
            const heroInv = () => inv.heroInventories()[hero.id]
            const nextStar = () => hero.starRating + 1
            const upgradeCost = () => STAR_UPGRADE_COSTS[nextStar()]
            const canUpgrade = () => {
              const cost = upgradeCost()
              const stash = inv.inventory()
              return !!cost && !!stash && stash.starFragments >= cost
            }

            return (
              <div style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                'border-radius': '6px', padding: '10px 12px', 'margin-bottom': '8px',
                display: 'flex', 'flex-direction': 'column', gap: '8px',
              }}>
                <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                  <span style={{ color: '#ddd', 'font-size': '13px', 'font-weight': '600' }}>{hero.name}</span>
                  <span style={{ color: '#f0c040', 'font-size': '12px' }}>{STAR_LABELS[hero.starRating] || 'Unranked'}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
                  <span style={{ color: '#aaa', 'font-size': '12px' }}>
                    Potions: {heroInv()?.healthPotions ?? '…'}
                  </span>

                  <Show when={(heroInv()?.healthPotions ?? 0) > 0}>
                    <SmallButton
                      label="→ Stash"
                      onClick={() => void inv.movePotion(hero.id, 'to-stash')}
                    />
                  </Show>

                  <Show when={(inv.inventory()?.healthPotions ?? 0) > 0}>
                    <SmallButton
                      label="→ Hero"
                      onClick={() => void inv.movePotion(hero.id, 'to-hero')}
                    />
                  </Show>
                </div>

                <Show when={upgradeCost()}>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <span style={{ color: '#666', 'font-size': '11px' }}>
                      Next star: {upgradeCost()} fragments
                    </span>
                    <SmallButton
                      label={`Upgrade to ${STAR_LABELS[nextStar()]}`}
                      disabled={!canUpgrade()}
                      onClick={() => void inv.upgradeHeroStar(hero.id).then(() => inv.refresh())}
                    />
                  </div>
                </Show>
              </div>
            )
          }}
        </For>
      </div>

      <Show when={inv.error()}>
        <div style={{ color: '#f66', 'font-size': '11px' }}>{inv.error()}</div>
      </Show>
    </div>
  )
}

function StatChip(props: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      'border-radius': '5px', padding: '6px 10px', 'text-align': 'center', 'min-width': '64px',
    }}>
      <div style={{ color: props.color, 'font-size': '16px', 'font-weight': '700' }}>{props.value}</div>
      <div style={{ color: '#666', 'font-size': '10px', 'text-transform': 'uppercase', 'letter-spacing': '0.06em' }}>{props.label}</div>
    </div>
  )
}

function SmallButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        padding: '3px 8px', 'font-size': '10px', cursor: props.disabled ? 'not-allowed' : 'pointer',
        background: props.disabled ? 'rgba(255,255,255,0.03)' : 'rgba(80,160,80,0.15)',
        color: props.disabled ? '#444' : '#8d8',
        border: `1px solid ${props.disabled ? 'rgba(255,255,255,0.05)' : 'rgba(80,180,80,0.3)'}`,
        'border-radius': '4px',
      }}
    >
      {props.label}
    </button>
  )
}
