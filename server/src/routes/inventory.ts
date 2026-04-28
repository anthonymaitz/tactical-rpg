import { Hono } from 'hono'
import { inventoryService } from '../db/inventory-service'
import { authMiddleware } from '../middleware'

export const inventoryRoutes = new Hono<{ Variables: { userId: string } }>()

inventoryRoutes.use('*', authMiddleware)

// GET /inventory — player stash + all hero inventories
inventoryRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string
  const inventory = await inventoryService.getOrCreate(userId)
  return c.json(inventory)
})

// GET /inventory/hero/:heroId
inventoryRoutes.get('/hero/:heroId', async (c) => {
  const heroInv = await inventoryService.getHeroInventory(c.req.param('heroId'))
  return c.json(heroInv)
})

// POST /inventory/move-potion
// Body: { heroId: string, direction: 'to-hero' | 'to-stash' }
inventoryRoutes.post('/move-potion', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ heroId: string; direction: 'to-hero' | 'to-stash' }>()
  if (!body.heroId) return c.json({ error: 'heroId required' }, 400)
  if (body.direction !== 'to-hero' && body.direction !== 'to-stash') {
    return c.json({ error: 'direction must be to-hero or to-stash' }, 400)
  }
  try {
    const result = await inventoryService.movePotion(userId, body.heroId, body.direction)
    return c.json(result)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed' }, 400)
  }
})

// POST /inventory/upgrade-star
// Body: { heroId: string }
inventoryRoutes.post('/upgrade-star', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ heroId: string }>()
  if (!body.heroId) return c.json({ error: 'heroId required' }, 400)
  try {
    const result = await inventoryService.upgradeHeroStar(userId, body.heroId)
    return c.json(result)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed' }, 400)
  }
})
