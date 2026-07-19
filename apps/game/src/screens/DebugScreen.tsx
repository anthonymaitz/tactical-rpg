import { createSignal, createEffect, For, Show } from 'solid-js'
import { auth } from '../lib/auth'
import type { HeroRecord, PlayerInventory } from 'shared-types'

const API = import.meta.env.VITE_API_URL

async function apiFetch<T>(path: string, token: string, body?: object): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error)
  }
  return res.json() as Promise<T>
}

export function DebugScreen() {
  const [token, setToken] = createSignal<string | null>(null)
  const [heroes, setHeroes] = createSignal<HeroRecord[]>([])
  const [inventory, setInventory] = createSignal<PlayerInventory | null>(null)
  const [status, setStatus] = createSignal<string | null>(null)
  const [amounts, setAmounts] = createSignal({ gold: 100, healthPotions: 5, starFragments: 10, decorShards: 10 })

  createEffect(() => {
    auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null
      setToken(t)
      if (t) {
        apiFetch<HeroRecord[]>('/heroes', t).then(setHeroes).catch(console.error)
        apiFetch<PlayerInventory>('/inventory', t).then(setInventory).catch(console.error)
      }
    })
  })

  async function giveItems() {
    const t = token()
    if (!t) return
    try {
      const inv = await apiFetch<PlayerInventory>('/debug/give-items', t, amounts())
      setInventory(inv)
      setStatus('Items added!')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Error')
    }
    setTimeout(() => setStatus(null), 3000)
  }

  async function equipWeapon(heroId: string) {
    const t = token()
    if (!t) return
    try {
      const updated = await apiFetch<HeroRecord>('/debug/equip-weapon', t, { heroId })
      setHeroes((prev) => prev.map((h) => (h.id === heroId ? updated : h)))
      setStatus(`Debug Sword equipped on ${updated.name}!`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Error')
    }
    setTimeout(() => setStatus(null), 3000)
  }

  async function unequipWeapon(heroId: string) {
    const t = token()
    if (!t) return
    try {
      const updated = await apiFetch<HeroRecord>('/debug/unequip-weapon', t, { heroId })
      setHeroes((prev) => prev.map((h) => (h.id === heroId ? updated : h)))
      setStatus(`Weapon removed from ${updated.name}.`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Error')
    }
    setTimeout(() => setStatus(null), 3000)
  }

  return (
    <div style={{ 'min-height': '100vh', background: '#0a0f0a', color: '#ccc', 'font-family': 'monospace', padding: '24px 32px' }}>
      <div style={{ 'max-width': '640px', margin: '0 auto' }}>
        <div style={{ 'font-size': '13px', color: '#555', 'margin-bottom': '4px', 'letter-spacing': '0.1em', 'text-transform': 'uppercase' }}>Debug Panel</div>
        <div style={{ 'border-bottom': '1px solid rgba(255,255,255,0.07)', 'margin-bottom': '24px' }} />

        <Show when={!token()}>
          <div style={{ color: '#f88', 'font-size': '13px' }}>Not authenticated — log in first at <a href="/" style={{ color: '#88f' }}>/</a></div>
        </Show>

        <Show when={token()}>
          {/* Status toast */}
          <Show when={status()}>
            <div style={{ background: 'rgba(80,160,80,0.15)', border: '1px solid rgba(80,180,80,0.3)', 'border-radius': '5px', padding: '8px 14px', 'margin-bottom': '16px', 'font-size': '12px', color: '#8f8' }}>
              {status()}
            </div>
          </Show>

          {/* Current stash */}
          <Section label="Current Stash">
            <Show when={inventory()} fallback={<span style={{ color: '#555' }}>Loading…</span>}>
              {(inv) => (
                <div style={{ display: 'flex', gap: '16px', 'flex-wrap': 'wrap', 'font-size': '13px' }}>
                  <Chip label="Gold" value={inv().gold} color="#f0c040" />
                  <Chip label="Potions" value={inv().healthPotions} color="#e05080" />
                  <Chip label="Star Frags" value={inv().starFragments} color="#80c0ff" />
                  <Chip label="Decor Shards" value={inv().decorShards} color="#c080ff" />
                </div>
              )}
            </Show>
          </Section>

          {/* Give items */}
          <Section label="Give Items">
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '10px', 'margin-bottom': '14px' }}>
              <NumInput label="Gold" value={amounts().gold} onChange={(v) => setAmounts((p) => ({ ...p, gold: v }))} />
              <NumInput label="Health Potions" value={amounts().healthPotions} onChange={(v) => setAmounts((p) => ({ ...p, healthPotions: v }))} />
              <NumInput label="Star Fragments" value={amounts().starFragments} onChange={(v) => setAmounts((p) => ({ ...p, starFragments: v }))} />
              <NumInput label="Decor Shards" value={amounts().decorShards} onChange={(v) => setAmounts((p) => ({ ...p, decorShards: v }))} />
            </div>
            <DebugButton label="Add to Stash" onClick={giveItems} />
          </Section>

          {/* Hero weapons */}
          <Section label="Hero Weapons (Debug Sword +1 dmg)">
            <Show when={heroes().length === 0}>
              <span style={{ color: '#555', 'font-size': '12px' }}>No heroes found.</span>
            </Show>
            <For each={heroes()}>
              {(hero) => (
                <div style={{
                  display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                  padding: '8px 12px', 'margin-bottom': '6px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  'border-radius': '5px',
                }}>
                  <div>
                    <span style={{ color: '#ddd', 'font-size': '13px' }}>{hero.name}</span>
                    <span style={{ color: '#555', 'font-size': '11px', 'margin-left': '10px' }}>{hero.characterClass}</span>
                    <Show when={hero.gear?.weapon}>
                      <span style={{ color: '#aaf', 'font-size': '11px', 'margin-left': '10px' }}>⚔ {hero.gear.weapon}</span>
                    </Show>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Show when={hero.gear?.weapon !== 'debug-sword'}>
                      <DebugButton label="Equip Sword" onClick={() => void equipWeapon(hero.id)} small />
                    </Show>
                    <Show when={hero.gear?.weapon === 'debug-sword'}>
                      <DebugButton label="Unequip" onClick={() => void unequipWeapon(hero.id)} small danger />
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </Section>
        </Show>
      </div>
    </div>
  )
}

function Section(props: { label: string; children: unknown }) {
  return (
    <div style={{ 'margin-bottom': '28px' }}>
      <div style={{ 'font-size': '10px', 'font-weight': '700', color: '#444', 'letter-spacing': '0.12em', 'text-transform': 'uppercase', 'margin-bottom': '10px' }}>{props.label}</div>
      {props.children as never}
    </div>
  )
}

function Chip(props: { label: string; value: number; color: string }) {
  return (
    <div style={{ 'text-align': 'center', 'min-width': '70px' }}>
      <div style={{ color: props.color, 'font-size': '18px', 'font-weight': '700' }}>{props.value}</div>
      <div style={{ color: '#555', 'font-size': '10px', 'text-transform': 'uppercase' }}>{props.label}</div>
    </div>
  )
}

function NumInput(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
      <span style={{ 'font-size': '10px', color: '#555', 'text-transform': 'uppercase', 'letter-spacing': '0.08em' }}>{props.label}</span>
      <input
        type="number"
        value={props.value}
        min={0}
        onInput={(e) => props.onChange(parseInt((e.target as HTMLInputElement).value) || 0)}
        style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          'border-radius': '4px', color: '#ccc', padding: '5px 8px', 'font-size': '13px',
          'font-family': 'monospace',
        }}
      />
    </label>
  )
}

function DebugButton(props: { label: string; onClick: () => void; small?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        padding: props.small ? '4px 10px' : '7px 18px',
        'font-size': props.small ? '11px' : '12px',
        cursor: 'pointer',
        background: props.danger ? 'rgba(160,40,40,0.15)' : 'rgba(80,160,80,0.15)',
        color: props.danger ? '#f88' : '#8f8',
        border: `1px solid ${props.danger ? 'rgba(180,60,60,0.3)' : 'rgba(80,180,80,0.3)'}`,
        'border-radius': '4px', 'font-family': 'monospace',
      }}
    >
      {props.label}
    </button>
  )
}
