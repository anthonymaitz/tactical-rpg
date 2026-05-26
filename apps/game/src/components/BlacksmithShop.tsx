import { createResource, createSignal, For, Show } from 'solid-js'
import type { WeaponDefinition } from 'shared-types'

interface Props {
  token: () => string | null
  heroId: () => string | null
  heroLevel: () => number
  onClose: () => void
  onPurchased?: () => void
}

const API = import.meta.env.VITE_API_URL

async function fetchWeapons(): Promise<WeaponDefinition[]> {
  const res = await fetch(`${API}/shop/weapons`)
  if (!res.ok) throw new Error('Failed to load weapons')
  return res.json() as Promise<WeaponDefinition[]>
}

async function fetchGold(token: string): Promise<number> {
  const res = await fetch(`${API}/inventory`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return 0
  const data = await res.json() as { gold: number }
  return data.gold ?? 0
}

export function BlacksmithShop(props: Props) {
  const [weapons] = createResource(fetchWeapons)
  const [gold, { refetch: refetchGold }] = createResource(
    () => props.token() ?? null,
    (tok) => (tok ? fetchGold(tok) : Promise.resolve(0)),
  )
  const [buying, setBuying] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [lastBought, setLastBought] = createSignal<string | null>(null)

  async function buyWeapon(weapon: WeaponDefinition) {
    const tok = props.token()
    const heroId = props.heroId()
    if (!tok || !heroId) { setError('No hero selected'); return }
    setBuying(weapon.id)
    setError(null)
    try {
      const res = await fetch(`${API}/shop/buy-weapon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ heroId, weaponId: weapon.id }),
      })
      const data = await res.json() as { gear?: unknown; gold?: number; error?: string }
      if (!res.ok) { setError(data.error ?? 'Purchase failed'); return }
      setLastBought(weapon.name)
      void refetchGold()
      props.onPurchased?.()
    } catch {
      setError('Network error')
    } finally {
      setBuying(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.75)',
      display: 'flex', 'align-items': 'center', 'justify-content': 'center',
      'z-index': '100',
    }}>
      <div style={{
        background: '#1a1208', border: '2px solid #8b6914', 'border-radius': '8px',
        padding: '24px', width: '480px', 'max-width': '95vw',
        'max-height': '85vh', display: 'flex', 'flex-direction': 'column', gap: '16px',
        color: '#e8d5a0',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
          <div>
            <div style={{ 'font-size': '18px', 'font-weight': '700', color: '#ffd700' }}>
              Blacksmith's Forge
            </div>
            <div style={{ 'font-size': '12px', color: '#b8a060', 'margin-top': '2px' }}>
              Welcome to my forge! Browse my wares.
            </div>
          </div>
          <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end', gap: '4px' }}>
            <div style={{ 'font-size': '14px', color: '#ffd700', 'font-weight': '600' }}>
              {gold.loading ? '...' : `${gold() ?? 0} gold`}
            </div>
            <button
              style={{ background: 'none', border: '1px solid #8b6914', color: '#e8d5a0', padding: '4px 12px', 'border-radius': '4px', cursor: 'pointer', 'font-size': '12px' }}
              onClick={props.onClose}
            >
              Close
            </button>
          </div>
        </div>

        {/* Success message */}
        <Show when={lastBought()}>
          <div style={{ background: '#1a3a1a', border: '1px solid #4a8a4a', 'border-radius': '4px', padding: '8px 12px', 'font-size': '13px', color: '#80e080' }}>
            {lastBought()} equipped!
          </div>
        </Show>

        {/* Error message */}
        <Show when={error()}>
          <div style={{ background: '#3a1a1a', border: '1px solid #8a4a4a', 'border-radius': '4px', padding: '8px 12px', 'font-size': '13px', color: '#e08080' }}>
            {error()}
          </div>
        </Show>

        {/* Weapons list */}
        <div style={{ 'overflow-y': 'auto', display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
          <Show when={weapons.loading}>
            <div style={{ color: '#b8a060', 'font-size': '13px' }}>Loading weapons...</div>
          </Show>
          <Show when={weapons.error}>
            <div style={{ color: '#e08080', 'font-size': '13px' }}>Failed to load weapons.</div>
          </Show>
          <For each={weapons()}>
            {(weapon) => {
              const locked = () => props.heroLevel() < weapon.levelRequirement
              const canAfford = () => (gold() ?? 0) >= weapon.cost
              const isBuying = () => buying() === weapon.id
              return (
                <div style={{
                  display: 'flex', 'align-items': 'center', gap: '12px',
                  background: locked() ? 'rgba(255,255,255,0.03)' : 'rgba(255,215,0,0.05)',
                  border: `1px solid ${locked() ? '#444' : '#8b6914'}`,
                  'border-radius': '6px', padding: '10px 12px',
                  opacity: locked() ? '0.5' : '1',
                }}>
                  <div style={{ flex: '1' }}>
                    <div style={{ 'font-size': '14px', 'font-weight': '600', color: locked() ? '#888' : '#ffd700' }}>
                      {weapon.name}
                      <span style={{ 'margin-left': '8px', 'font-size': '11px', 'font-weight': '400', color: '#80c080' }}>
                        +{weapon.damageBonus} dmg
                      </span>
                    </div>
                    <div style={{ 'font-size': '12px', color: '#b8a060', 'margin-top': '2px' }}>
                      {weapon.description}
                    </div>
                    <div style={{ 'font-size': '11px', color: '#888', 'margin-top': '2px' }}>
                      {locked() ? `Requires level ${weapon.levelRequirement}` : `Level ${weapon.levelRequirement}+`}
                      {weapon.classAffinity && weapon.classAffinity.length > 0 && (
                        <span style={{ 'margin-left': '8px' }}>
                          {weapon.classAffinity.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end', gap: '4px' }}>
                    <div style={{ 'font-size': '13px', 'font-weight': '600', color: canAfford() && !locked() ? '#ffd700' : '#666' }}>
                      {weapon.cost}g
                    </div>
                    <button
                      disabled={locked() || !canAfford() || isBuying() || buying() !== null}
                      onClick={() => void buyWeapon(weapon)}
                      style={{
                        background: locked() || !canAfford() ? '#2a2a2a' : '#8b6914',
                        border: 'none', color: locked() || !canAfford() ? '#666' : '#ffd700',
                        padding: '5px 12px', 'border-radius': '4px', cursor: locked() || !canAfford() ? 'not-allowed' : 'pointer',
                        'font-size': '12px', 'font-weight': '600', 'white-space': 'nowrap',
                      }}
                    >
                      {isBuying() ? 'Buying...' : 'Buy & Equip'}
                    </button>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}
