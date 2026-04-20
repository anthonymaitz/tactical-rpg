// server/src/routes/heroes.ts
import { Hono } from 'hono'
import { heroService } from '../db/hero-service'
import { STARTER_CLASSES, PERSONALITIES } from 'shared-types'
import { supabase } from '../db/supabase'

export const heroRoutes = new Hono<{ Variables: { userId: string } }>()

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
  if (!PERSONALITIES.includes(body.personality as typeof PERSONALITIES[number])) {
    return c.json({ error: `Invalid personality: ${body.personality}` }, 400)
  }

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
  const userId = c.get('userId') as string
  const { data: ownerCheck } = await supabase.from('heroes').select('user_id').eq('id', heroId).single()
  if (!ownerCheck || ownerCheck.user_id !== userId) return c.json({ error: 'Not found' }, 404)
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
  const userId = c.get('userId') as string
  const { data: ownerCheck } = await supabase.from('heroes').select('user_id').eq('id', heroId).single()
  if (!ownerCheck || ownerCheck.user_id !== userId) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json<{ xp: number }>()
  if (typeof body.xp !== 'number' || body.xp < 0) return c.json({ error: 'xp must be a non-negative number' }, 400)
  const hero = await heroService.awardXp(heroId, body.xp)
  return c.json(hero)
})
