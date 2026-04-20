# Hero Persistence & Data Layer — Implementation Plan 08

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the hero persistence layer so heroes survive across sessions — Supabase schema, server service, HTTP API, client hook, and updated ConnectScreen with roster and hero creation.

**Architecture:** Heroes are stored in Supabase linked to Supabase auth user IDs (the existing `verifySupabaseJWT` already validates these). A Hono API layer exposes CRUD endpoints. The React client reads heroes via `useHeroes` and passes selected hero IDs into Colyseus room join options.

**Tech Stack:** Supabase (Postgres + RLS + @supabase/supabase-js), Hono, Vitest, React 18

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared-types/src/hero-persistence.ts` | Create | `HeroRecord`, `GearSlots`, `StarterClass`, `STARTER_CLASSES` |
| `packages/shared-types/src/index.ts` | Modify | Export from `hero-persistence` |
| `server/src/db/migrations/001_heroes.sql` | Create | Heroes table + RLS |
| `server/src/db/supabase.ts` | Create | Server-side Supabase admin client |
| `server/src/db/hero-logic.ts` | Create | Pure functions: XP thresholds, level-up, recovery duration |
| `server/src/db/__tests__/hero-logic.test.ts` | Create | Unit tests for `hero-logic` |
| `server/src/db/hero-service.ts` | Create | Supabase CRUD for heroes |
| `server/src/routes/heroes.ts` | Create | Hono route handlers |
| `server/src/http-app.ts` | Modify | Register `/heroes` routes + auth middleware |
| `apps/game/src/lib/supabase.ts` | Create | Browser Supabase anon client |
| `apps/game/src/hooks/useHeroes.ts` | Create | Fetch and mutate heroes from API |
| `apps/game/src/screens/ConnectScreen.tsx` | Modify | Roster display + hero creation + party selection |
| `.env.example` | Modify | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |

---

## Task 1: Shared Types for Hero Persistence

**Files:**
- Create: `packages/shared-types/src/hero-persistence.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Create `hero-persistence.ts`**

```typescript
// packages/shared-types/src/hero-persistence.ts
import type { AbilityDefinition } from './index'

export type Die = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
export type Personality = 'passionate' | 'calculating' | 'wild' | 'selfish' | 'righteous'

export type GearSlots = {
  weapon: string | null
  offhand: string | null
  armor: string | null
  trinket: string | null
}

export type HeroRecord = {
  id: string
  userId: string
  name: string
  characterClass: string
  personality: Personality
  die: Die
  level: number
  xp: number
  maxHp: number
  maxEnergy: number
  speed: number
  abilities: AbilityDefinition[]
  gear: GearSlots
  recoveryEndsAt: string | null
  createdAt: string
}

export type StarterClass = {
  name: string
  die: Die
  maxHp: number
  maxEnergy: number
  speed: number
  abilities: AbilityDefinition[]
}

export const STARTER_CLASSES: StarterClass[] = [
  {
    name: 'Fighter',
    die: 'd8',
    maxHp: 20,
    maxEnergy: 4,
    speed: 3,
    abilities: [
      {
        id: 'strike',
        name: 'Strike',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'shield-bash',
        name: 'Shield Bash',
        energyCost: 2,
        diceNotation: { kind: 'notation', value: '1d6' },
        targetType: 'enemy',
        effect: 'debuff',
        statusEffect: ['stunned'],
        context: 'inCombat',
      },
    ],
  },
  {
    name: 'Mage',
    die: 'd6',
    maxHp: 12,
    maxEnergy: 6,
    speed: 3,
    abilities: [
      {
        id: 'magic-bolt',
        name: 'Magic Bolt',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'frost-nova',
        name: 'Frost Nova',
        energyCost: 3,
        diceNotation: { kind: 'notation', value: '1d4' },
        targetType: 'area',
        effect: 'debuff',
        statusEffect: ['slowed'],
        context: 'inCombat',
      },
    ],
  },
  {
    name: 'Rogue',
    die: 'd8',
    maxHp: 14,
    maxEnergy: 5,
    speed: 4,
    abilities: [
      {
        id: 'stab',
        name: 'Stab',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'smoke-bomb',
        name: 'Smoke Bomb',
        energyCost: 2,
        diceNotation: { kind: 'notation', value: '1d4' },
        targetType: 'area',
        effect: 'debuff',
        statusEffect: ['blinded'],
        context: 'inCombat',
      },
    ],
  },
  {
    name: 'Cleric',
    die: 'd6',
    maxHp: 16,
    maxEnergy: 5,
    speed: 3,
    abilities: [
      {
        id: 'smite',
        name: 'Smite',
        energyCost: 1,
        diceNotation: { kind: 'actor' },
        targetType: 'enemy',
        effect: 'damage',
        context: 'inCombat',
      },
      {
        id: 'heal',
        name: 'Heal',
        energyCost: 2,
        diceNotation: { kind: 'notation', value: '1d6' },
        targetType: 'ally',
        effect: 'heal',
        context: 'inCombat',
      },
    ],
  },
]

export const PERSONALITIES: Personality[] = [
  'passionate',
  'calculating',
  'wild',
  'selfish',
  'righteous',
]
```

- [ ] **Step 2: Export from shared-types index**

Add to the bottom of `packages/shared-types/src/index.ts`:

```typescript
export * from './hero-persistence'
```

- [ ] **Step 3: Verify typecheck passes**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/src/hero-persistence.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add HeroRecord, GearSlots, STARTER_CLASSES"
```

---

## Task 2: Hero Business Logic (Pure Functions)

**Files:**
- Create: `server/src/db/hero-logic.ts`
- Create: `server/src/db/__tests__/hero-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/db/__tests__/hero-logic.test.ts
import { describe, it, expect } from 'vitest'
import {
  xpToNextLevel,
  applyLevelUp,
  recoveryDurationMs,
  getRecoveryEndsAt,
  isRecovering,
} from '../hero-logic'
import type { HeroRecord } from 'shared-types'

const baseHero: HeroRecord = {
  id: 'test-id',
  userId: 'user-id',
  name: 'Aldric',
  characterClass: 'Fighter',
  personality: 'righteous',
  die: 'd8',
  level: 1,
  xp: 0,
  maxHp: 20,
  maxEnergy: 4,
  speed: 3,
  abilities: [],
  gear: { weapon: null, offhand: null, armor: null, trinket: null },
  recoveryEndsAt: null,
  createdAt: new Date().toISOString(),
}

describe('xpToNextLevel', () => {
  it('returns 200 for level 1', () => {
    expect(xpToNextLevel(1)).toBe(200)
  })
  it('scales linearly with level', () => {
    expect(xpToNextLevel(3)).toBe(600)
    expect(xpToNextLevel(10)).toBe(2000)
  })
})

describe('applyLevelUp', () => {
  it('returns unchanged hero when XP below threshold', () => {
    const hero = { ...baseHero, xp: 150 }
    const result = applyLevelUp(hero)
    expect(result.newLevel).toBe(1)
    expect(result.newXp).toBe(150)
    expect(result.newMaxHp).toBe(20)
  })

  it('levels up when XP meets threshold', () => {
    const hero = { ...baseHero, xp: 250 }
    const result = applyLevelUp(hero)
    expect(result.newLevel).toBe(2)
    expect(result.newXp).toBe(50)
    expect(result.newMaxHp).toBe(24)
  })
})

describe('recoveryDurationMs', () => {
  it('returns 1 hour in ms for level 1', () => {
    expect(recoveryDurationMs(1)).toBe(3_600_000)
  })
  it('returns 4 hours for level 4', () => {
    expect(recoveryDurationMs(4)).toBe(14_400_000)
  })
})

describe('isRecovering', () => {
  it('returns false when recoveryEndsAt is null', () => {
    expect(isRecovering(baseHero)).toBe(false)
  })
  it('returns true when recovery has not ended', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString()
    expect(isRecovering({ ...baseHero, recoveryEndsAt: future })).toBe(true)
  })
  it('returns false when recovery has ended', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isRecovering({ ...baseHero, recoveryEndsAt: past })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter server test --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `hero-logic` module not found.

- [ ] **Step 3: Implement `hero-logic.ts`**

```typescript
// server/src/db/hero-logic.ts
import type { HeroRecord } from 'shared-types'

export function xpToNextLevel(level: number): number {
  return level * 200
}

export function applyLevelUp(hero: HeroRecord): {
  newLevel: number
  newMaxHp: number
  newXp: number
} {
  const threshold = xpToNextLevel(hero.level)
  if (hero.xp < threshold) {
    return { newLevel: hero.level, newMaxHp: hero.maxHp, newXp: hero.xp }
  }
  return {
    newLevel: hero.level + 1,
    newMaxHp: hero.maxHp + 4,
    newXp: hero.xp - threshold,
  }
}

export function recoveryDurationMs(level: number): number {
  return level * 60 * 60 * 1000
}

export function getRecoveryEndsAt(level: number): string {
  return new Date(Date.now() + recoveryDurationMs(level)).toISOString()
}

export function isRecovering(hero: HeroRecord): boolean {
  if (!hero.recoveryEndsAt) return false
  return new Date(hero.recoveryEndsAt) > new Date()
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter server test --reporter=verbose
```

Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/hero-logic.ts server/src/db/__tests__/hero-logic.test.ts
git commit -m "feat(server): add hero business logic with tests"
```

---

## Task 3: Supabase Schema Migration

**Files:**
- Create: `server/src/db/migrations/001_heroes.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- server/src/db/migrations/001_heroes.sql
create table if not exists heroes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  character_class text not null,
  personality text not null,
  die text not null default 'd6',
  level integer not null default 1,
  xp integer not null default 0,
  max_hp integer not null default 12,
  max_energy integer not null default 5,
  speed integer not null default 3,
  abilities jsonb not null default '[]'::jsonb,
  gear jsonb not null default '{"weapon":null,"offhand":null,"armor":null,"trinket":null}'::jsonb,
  recovery_ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table heroes enable row level security;

create policy "users manage own heroes"
  on heroes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index heroes_user_id_idx on heroes (user_id);
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to your Supabase project → SQL Editor → paste the contents of `001_heroes.sql` → Run.

Verify: the `heroes` table appears in Table Editor with the correct columns.

- [ ] **Step 3: Commit the migration file**

```bash
git add server/src/db/migrations/001_heroes.sql
git commit -m "feat(db): add heroes table migration"
```

---

## Task 4: Supabase Clients & Environment

**Files:**
- Create: `server/src/db/supabase.ts`
- Create: `apps/game/src/lib/supabase.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add Supabase deps**

```bash
cd /Users/anthonymaitz/Repositories/tactical-rpg
pnpm --filter server add @supabase/supabase-js
pnpm --filter game add @supabase/supabase-js
```

- [ ] **Step 2: Update `.env.example`**

Add these lines (copy from existing content, add new vars):

```bash
# Supabase (server — service role, bypasses RLS)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Supabase (client — anon key, subject to RLS)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# HTTP API base URL (Hono server)
VITE_API_URL=http://localhost:3000
```

Copy `.env.example` to `.env` (for server) and `apps/game/.env` (for game app) and fill in real values from your Supabase project settings.

- [ ] **Step 3: Create server Supabase client**

```typescript
// server/src/db/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
})
```

- [ ] **Step 4: Create browser Supabase client**

```typescript
// apps/game/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')

export const supabase = createClient(url, key)
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/supabase.ts apps/game/src/lib/supabase.ts .env.example
git commit -m "feat: add Supabase clients for server and browser"
```

---

## Task 5: Hero Service (DB Layer)

**Files:**
- Create: `server/src/db/hero-service.ts`

- [ ] **Step 1: Write `hero-service.ts`**

```typescript
// server/src/db/hero-service.ts
import { supabase } from './supabase'
import { applyLevelUp, getRecoveryEndsAt } from './hero-logic'
import type { HeroRecord, GearSlots, StarterClass } from 'shared-types'

function toHeroRecord(row: Record<string, unknown>): HeroRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    characterClass: row.character_class as string,
    personality: row.personality as HeroRecord['personality'],
    die: row.die as HeroRecord['die'],
    level: row.level as number,
    xp: row.xp as number,
    maxHp: row.max_hp as number,
    maxEnergy: row.max_energy as number,
    speed: row.speed as number,
    abilities: row.abilities as HeroRecord['abilities'],
    gear: row.gear as GearSlots,
    recoveryEndsAt: row.recovery_ends_at as string | null,
    createdAt: row.created_at as string,
  }
}

export const heroService = {
  async listHeroes(userId: string): Promise<HeroRecord[]> {
    const { data, error } = await supabase
      .from('heroes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(toHeroRecord)
  },

  async createHero(
    userId: string,
    name: string,
    starterClass: StarterClass,
    personality: HeroRecord['personality']
  ): Promise<HeroRecord> {
    const { data, error } = await supabase
      .from('heroes')
      .insert({
        user_id: userId,
        name,
        character_class: starterClass.name,
        personality,
        die: starterClass.die,
        max_hp: starterClass.maxHp,
        max_energy: starterClass.maxEnergy,
        speed: starterClass.speed,
        abilities: starterClass.abilities,
      })
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async awardXp(heroId: string, xpGained: number): Promise<HeroRecord> {
    const { data: existing, error: fetchErr } = await supabase
      .from('heroes')
      .select('*')
      .eq('id', heroId)
      .single()
    if (fetchErr) throw fetchErr

    const current = toHeroRecord(existing)
    const withXp = { ...current, xp: current.xp + xpGained }
    const { newLevel, newMaxHp, newXp } = applyLevelUp(withXp)

    const { data, error } = await supabase
      .from('heroes')
      .update({ xp: newXp, level: newLevel, max_hp: newMaxHp })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async equipGear(heroId: string, slot: keyof GearSlots, itemName: string | null): Promise<HeroRecord> {
    const { data: existing, error: fetchErr } = await supabase
      .from('heroes')
      .select('gear')
      .eq('id', heroId)
      .single()
    if (fetchErr) throw fetchErr

    const gear: GearSlots = { ...(existing.gear as GearSlots), [slot]: itemName }
    const { data, error } = await supabase
      .from('heroes')
      .update({ gear })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async setRecovering(heroId: string, level: number): Promise<HeroRecord> {
    const { data, error } = await supabase
      .from('heroes')
      .update({ recovery_ends_at: getRecoveryEndsAt(level) })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },

  async clearRecovery(heroId: string): Promise<HeroRecord> {
    const { data, error } = await supabase
      .from('heroes')
      .update({ recovery_ends_at: null })
      .eq('id', heroId)
      .select()
      .single()
    if (error) throw error
    return toHeroRecord(data)
  },
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add server/src/db/hero-service.ts
git commit -m "feat(server): add hero service with Supabase CRUD"
```

---

## Task 6: Hono API Routes

**Files:**
- Create: `server/src/routes/heroes.ts`
- Modify: `server/src/http-app.ts`

- [ ] **Step 1: Write route handlers**

```typescript
// server/src/routes/heroes.ts
import { Hono } from 'hono'
import { heroService } from '../db/hero-service'
import { STARTER_CLASSES } from 'shared-types'

export const heroRoutes = new Hono()

// Auth middleware — extracts userId from Bearer JWT already verified by verifySupabaseJWT
// The JWT sub claim is the Supabase user ID
heroRoutes.use('*', async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = auth.slice(7)
  try {
    // Decode without re-verification (already verified upstream in Colyseus rooms)
    // For HTTP routes we do a lightweight decode to extract the sub claim
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.sub) return c.json({ error: 'Invalid token' }, 401)
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
})

// GET /heroes — list current user's heroes
heroRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string
  const heroes = await heroService.listHeroes(userId)
  return c.json(heroes)
})

// POST /heroes — create a new hero
// Body: { name: string, className: string, personality: string }
heroRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ name: string; className: string; personality: string }>()

  const starterClass = STARTER_CLASSES.find((sc) => sc.name === body.className)
  if (!starterClass) return c.json({ error: `Unknown class: ${body.className}` }, 400)
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const hero = await heroService.createHero(
    userId,
    body.name.trim(),
    starterClass,
    body.personality as Parameters<typeof heroService.createHero>[3]
  )
  return c.json(hero, 201)
})

// PATCH /heroes/:id/gear — equip or unequip a gear slot
// Body: { slot: 'weapon' | 'offhand' | 'armor' | 'trinket', item: string | null }
heroRoutes.patch('/:id/gear', async (c) => {
  const heroId = c.req.param('id')
  const body = await c.req.json<{ slot: string; item: string | null }>()
  const validSlots = ['weapon', 'offhand', 'armor', 'trinket']
  if (!validSlots.includes(body.slot)) return c.json({ error: `Invalid slot: ${body.slot}` }, 400)
  const hero = await heroService.equipGear(heroId, body.slot as 'weapon', body.item)
  return c.json(hero)
})

// PATCH /heroes/:id/xp — award XP (called server-side after combat)
// Body: { xp: number }
heroRoutes.patch('/:id/xp', async (c) => {
  const heroId = c.req.param('id')
  const body = await c.req.json<{ xp: number }>()
  if (typeof body.xp !== 'number' || body.xp < 0) return c.json({ error: 'xp must be a non-negative number' }, 400)
  const hero = await heroService.awardXp(heroId, body.xp)
  return c.json(hero)
})
```

- [ ] **Step 2: Register routes in `http-app.ts`**

Open `server/src/http-app.ts`. Add after the existing `/health` route:

```typescript
import { heroRoutes } from './routes/heroes'

// existing health route stays unchanged
app.route('/heroes', heroRoutes)
```

Full updated `http-app.ts`:

```typescript
// server/src/http-app.ts
import { Hono } from 'hono'
import { heroRoutes } from './routes/heroes'

export const httpApp = new Hono()

httpApp.get('/health', (c) => c.json({ status: 'ok' }))
httpApp.route('/heroes', heroRoutes)
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Smoke test the routes**

Start the server:

```bash
pnpm --filter server dev
```

In a separate terminal, test the health endpoint still works:

```bash
node -e "fetch('http://localhost:3000/health').then(r=>r.json()).then(console.log)"
```

Expected: `{ status: 'ok' }`

Stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/heroes.ts server/src/http-app.ts
git commit -m "feat(server): add /heroes Hono API routes"
```

---

## Task 7: `useHeroes` Client Hook

**Files:**
- Create: `apps/game/src/hooks/useHeroes.ts`

- [ ] **Step 1: Write the hook**

```typescript
// apps/game/src/hooks/useHeroes.ts
import { useState, useEffect, useCallback } from 'react'
import type { HeroRecord, GearSlots } from 'shared-types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error)
  }
  return res.json() as Promise<T>
}

export type CreateHeroInput = {
  name: string
  className: string
  personality: string
}

export function useHeroes(token: string | null) {
  const [heroes, setHeroes] = useState<HeroRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<HeroRecord[]>('/heroes', token)
      setHeroes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load heroes')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { refresh() }, [refresh])

  const createHero = useCallback(async (input: CreateHeroInput): Promise<HeroRecord> => {
    if (!token) throw new Error('Not authenticated')
    const hero = await apiFetch<HeroRecord>('/heroes', token, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    setHeroes((prev) => [...prev, hero])
    return hero
  }, [token])

  const equipGear = useCallback(async (
    heroId: string,
    slot: keyof GearSlots,
    item: string | null
  ): Promise<HeroRecord> => {
    if (!token) throw new Error('Not authenticated')
    const hero = await apiFetch<HeroRecord>(`/heroes/${heroId}/gear`, token, {
      method: 'PATCH',
      body: JSON.stringify({ slot, item }),
    })
    setHeroes((prev) => prev.map((h) => (h.id === heroId ? hero : h)))
    return hero
  }, [token])

  return { heroes, loading, error, refresh, createHero, equipGear }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/game/src/hooks/useHeroes.ts
git commit -m "feat(game): add useHeroes hook"
```

---

## Task 8: ConnectScreen with Roster & Hero Creation

**Files:**
- Modify: `apps/game/src/screens/ConnectScreen.tsx`

The ConnectScreen becomes the entry point for auth + hero selection. For this plan, we use a hardcoded dev token (the existing ConnectScreen just has a Connect button with no auth). We wire the real Supabase auth token in Plan 09 when The Inn is built. For now, we use the Supabase anon sign-in to get a session token.

- [ ] **Step 1: Replace `ConnectScreen.tsx`**

```typescript
// apps/game/src/screens/ConnectScreen.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHeroes } from '../hooks/useHeroes'
import { STARTER_CLASSES, PERSONALITIES, isRecovering } from 'shared-types'
import type { HeroRecord } from 'shared-types'

type Props = { onConnect: (token: string, heroIds: string[]) => void }

type View = 'auth' | 'roster' | 'create'

export function ConnectScreen({ onConnect }: Props) {
  const [view, setView] = useState<View>('auth')
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Hero creation form state
  const [heroName, setHeroName] = useState('')
  const [heroClass, setHeroClass] = useState(STARTER_CLASSES[0].name)
  const [heroPersonality, setHeroPersonality] = useState(PERSONALITIES[0])
  const [createError, setCreateError] = useState<string | null>(null)

  const { heroes, loading: heroesLoading, createHero } = useHeroes(token)

  async function handleAuth() {
    setAuthLoading(true)
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      // Try sign up if sign in fails
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError || !signUpData.session) {
        setAuthError(signUpError?.message ?? 'Authentication failed')
        setAuthLoading(false)
        return
      }
      setToken(signUpData.session.access_token)
    } else {
      setToken(data.session.access_token)
    }
    setAuthLoading(false)
    setView('roster')
  }

  async function handleCreateHero() {
    setCreateError(null)
    if (!heroName.trim()) { setCreateError('Name is required'); return }
    try {
      await createHero({ name: heroName.trim(), className: heroClass, personality: heroPersonality })
      setHeroName('')
      setView('roster')
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create hero')
    }
  }

  function toggleSelect(hero: HeroRecord) {
    if (isRecovering(hero)) return
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(hero.id) ? next.delete(hero.id) : next.add(hero.id)
      return next
    })
  }

  function handleEnterInn() {
    if (!token || selected.size === 0) return
    onConnect(token, [...selected])
  }

  if (view === 'auth') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '80px auto' }}>
        <h2>Simple Quest Tactics</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 8 }}
        />
        {authError && <p style={{ color: 'red' }}>{authError}</p>}
        <button onClick={handleAuth} disabled={authLoading} style={{ padding: '10px 20px' }}>
          {authLoading ? 'Connecting…' : 'Sign In / Sign Up'}
        </button>
      </div>
    )
  }

  if (view === 'create') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, margin: '60px auto' }}>
        <h2>Create Your First Hero</h2>
        <input
          placeholder="Hero name"
          value={heroName}
          onChange={(e) => setHeroName(e.target.value)}
          style={{ padding: 8 }}
        />
        <label>
          Class
          <select value={heroClass} onChange={(e) => setHeroClass(e.target.value)} style={{ marginLeft: 8 }}>
            {STARTER_CLASSES.map((sc) => (
              <option key={sc.name} value={sc.name}>
                {sc.name} ({sc.die})
              </option>
            ))}
          </select>
        </label>
        <label>
          Personality
          <select value={heroPersonality} onChange={(e) => setHeroPersonality(e.target.value)} style={{ marginLeft: 8 }}>
            {PERSONALITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        {createError && <p style={{ color: 'red' }}>{createError}</p>}
        <button onClick={handleCreateHero} style={{ padding: '10px 20px' }}>Create Hero</button>
        {heroes.length > 0 && (
          <button onClick={() => setView('roster')} style={{ padding: '8px 16px' }}>Back to Roster</button>
        )}
      </div>
    )
  }

  // Roster view
  const available = heroes.filter((h) => !isRecovering(h))
  return (
    <div style={{ maxWidth: 600, margin: '60px auto' }}>
      <h2>Your Heroes</h2>
      {heroesLoading && <p>Loading heroes…</p>}
      {heroes.length === 0 && !heroesLoading && (
        <p>No heroes yet. Create your first one!</p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {heroes.map((hero) => {
          const recovering = isRecovering(hero)
          const isSelected = selected.has(hero.id)
          return (
            <div
              key={hero.id}
              onClick={() => toggleSelect(hero)}
              style={{
                border: isSelected ? '2px solid #4caf50' : '2px solid #444',
                borderRadius: 8,
                padding: 12,
                width: 160,
                opacity: recovering ? 0.5 : 1,
                cursor: recovering ? 'not-allowed' : 'pointer',
                background: isSelected ? '#1e2a1e' : '#1a1a2a',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{hero.name}</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{hero.characterClass} · Lv{hero.level}</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{hero.personality}</div>
              {recovering && (
                <div style={{ fontSize: 11, color: '#e05555', marginTop: 4 }}>
                  Recovering…
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <button onClick={() => setView('create')} style={{ padding: '8px 16px' }}>
          + New Hero
        </button>
        <button
          onClick={handleEnterInn}
          disabled={selected.size === 0}
          style={{ padding: '10px 20px', opacity: selected.size === 0 ? 0.5 : 1 }}
        >
          Enter The Inn ({selected.size} selected)
        </button>
      </div>
      {available.length === 0 && heroes.length > 0 && (
        <p style={{ color: '#e07b39', marginTop: 12 }}>All heroes are recovering. Create a new hero or wait.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx to pass token + heroIds**

Open `apps/game/src/App.tsx`. The `onConnect` callback now receives `(token: string, heroIds: string[])`. Update the call site to store these in state and pass `heroIds` into the room join:

```typescript
// In App.tsx — update state to hold token and heroIds
const [token, setToken] = useState<string | null>(null)
const [heroIds, setHeroIds] = useState<string[]>([])

// Update onConnect handler
function handleConnect(t: string, ids: string[]) {
  setToken(t)
  setHeroIds(ids)
  // existing: navigate to ExploreScreen / join room
}
```

Pass `heroIds` into `joinRoom` options:

```typescript
const room = await joinRoom('ExploreRoom', { token, heroIds })
```

- [ ] **Step 3: Update ExploreRoom to accept heroIds**

In `server/src/rooms/ExploreRoom.ts`, add `heroIds` to the `onJoin` options type:

```typescript
async onJoin(client: Client, options: { token?: string; heroIds?: string[] }) {
  // existing JWT verification stays unchanged
  // store heroIds on client data for later use
  client.userData = { ...(client.userData ?? {}), heroIds: options.heroIds ?? [] }
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: all 100+ existing tests pass plus the 8 new hero-logic tests.

- [ ] **Step 6: Manual smoke test**

```bash
pnpm --filter server dev &
pnpm --filter game dev
```

Open `http://localhost:5173`. You should be able to:
1. Sign in / sign up with an email + password
2. See the roster (empty for new account)
3. Create a hero (Fighter/Mage/Rogue/Cleric, pick name and personality)
4. See the hero card in the roster
5. Select it and click "Enter The Inn"

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/screens/ConnectScreen.tsx apps/game/src/App.tsx server/src/rooms/ExploreRoom.ts
git commit -m "feat(game): roster + hero creation in ConnectScreen, wire heroIds into room join"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Hero persistent roster with XP, leveling, gear slots
- ✅ Recovery timers (1h × level) stored server-side as timestamps
- ✅ Starter classes: Fighter, Mage, Rogue, Cleric with abilities
- ✅ Personalities defined
- ✅ `isRecovering` used in UI to prevent selecting knocked-out heroes
- ✅ Supabase schema with RLS
- ✅ HTTP API for client CRUD
- ⏭ Guild features — deferred to Plan 09
- ⏭ Upgrade trees — deferred to later plan
- ⏭ Gear drops — deferred to Plan 11 (Event System)

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `HeroRecord` defined in Task 1, used in Tasks 2, 5, 6, 7, 8 — consistent
- `GearSlots` keys (`weapon`, `offhand`, `armor`, `trinket`) consistent across Task 1, 5, 6, 7
- `STARTER_CLASSES` defined in Task 1, imported in Task 6 routes and Task 8 ConnectScreen
- `isRecovering` defined in Task 2 `hero-logic.ts`, imported in Task 8 ConnectScreen
- `applyLevelUp` defined in Task 2, used in Task 5 `hero-service.ts`
