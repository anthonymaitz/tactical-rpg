import { Hono } from 'hono'
import { inventoryService } from '../db/inventory-service'
import { heroService } from '../db/hero-service'
import { verifySupabaseJWT } from '../auth'

export const debugRoutes = new Hono<{ Variables: { userId: string } }>()

debugRoutes.use('*', async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
  const token = auth.slice(7)
  const projectUrl = process.env.SUPABASE_URL
  if (!projectUrl) return c.json({ error: 'Server misconfigured' }, 500)
  try {
    c.set('userId', await verifySupabaseJWT(token, projectUrl))
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
  await next()
})

// POST /debug/give-items — add resources to the authenticated player's stash
// Body: { gold?, healthPotions?, starFragments?, decorShards? }
debugRoutes.post('/give-items', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{
    gold?: number
    healthPotions?: number
    starFragments?: number
    decorShards?: number
  }>()
  const loot = {
    gold: Math.max(0, body.gold ?? 0),
    healthPotions: Math.max(0, body.healthPotions ?? 0),
    starFragments: Math.max(0, body.starFragments ?? 0),
    decorShards: Math.max(0, body.decorShards ?? 0),
    builderPropIds: [],
  }
  const inventory = await inventoryService.addLoot(userId, loot)
  return c.json(inventory)
})

// POST /debug/equip-weapon — equip a debug weapon on a hero
// Body: { heroId: string, weapon?: string }
debugRoutes.post('/equip-weapon', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ heroId: string; weapon?: string }>()
  if (!body.heroId) return c.json({ error: 'heroId required' }, 400)

  const hero = await heroService.getHero(body.heroId)
  if (!hero) return c.json({ error: 'Hero not found' }, 404)
  if (hero.userId !== userId) return c.json({ error: 'Not your hero' }, 403)

  const weapon = body.weapon ?? 'debug-sword'
  const updated = await heroService.equipGear(body.heroId, 'weapon', weapon)
  return c.json(updated)
})

// POST /debug/unequip-weapon — remove weapon from a hero
debugRoutes.post('/unequip-weapon', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ heroId: string }>()
  if (!body.heroId) return c.json({ error: 'heroId required' }, 400)

  const hero = await heroService.getHero(body.heroId)
  if (!hero) return c.json({ error: 'Hero not found' }, 404)
  if (hero.userId !== userId) return c.json({ error: 'Not your hero' }, 403)

  const updated = await heroService.equipGear(body.heroId, 'weapon', null)
  return c.json(updated)
})
