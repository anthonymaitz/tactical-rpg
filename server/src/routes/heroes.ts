// server/src/routes/heroes.ts
import { Hono } from 'hono'
import { heroService } from '../db/hero-service'
import { STARTER_CLASSES, PERSONALITIES, PROFESSIONS } from 'shared-types'
import { supabase } from '../db/supabase'
import { verifySupabaseJWT } from '../auth'

export const heroRoutes = new Hono<{ Variables: { userId: string } }>()

// Auth middleware — verifies Bearer JWT using verifySupabaseJWT
heroRoutes.use('*', async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = auth.slice(7)
  const projectUrl = process.env.SUPABASE_URL
  if (!projectUrl) return c.json({ error: 'Server misconfigured' }, 500)
  try {
    const userId = await verifySupabaseJWT(token, projectUrl)
    c.set('userId', userId)
    await next()
  } catch (e) {
    console.error('JWT verification failed:', e)
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
// Body: { name: string, className: string, personality: string, profession: string }
heroRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ name: string; className: string; personality: string; profession: string }>()

  const starterClass = STARTER_CLASSES.find((sc) => sc.name === body.className)
  if (!starterClass) return c.json({ error: `Unknown class: ${body.className}` }, 400)
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)
  if (!PERSONALITIES.includes(body.personality as typeof PERSONALITIES[number])) {
    return c.json({ error: `Invalid personality: ${body.personality}` }, 400)
  }
  if (!PROFESSIONS.includes(body.profession as typeof PROFESSIONS[number])) {
    return c.json({ error: `Invalid profession: ${body.profession}` }, 400)
  }

  const hero = await heroService.createHero(
    userId,
    body.name.trim(),
    starterClass,
    body.personality as Parameters<typeof heroService.createHero>[3],
    body.profession
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

