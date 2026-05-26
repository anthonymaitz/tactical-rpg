import { Hono } from 'hono'
import { getBiomeSpawns } from '../db/biome-service'

export const biomeRoutes = new Hono()

// GET /biomes/:biomeId/spawns — return spawn points for a biome as JSON
biomeRoutes.get('/:biomeId/spawns', async (c) => {
  const biomeId = c.req.param('biomeId')
  try {
    const spawns = await getBiomeSpawns(biomeId)
    return c.json(spawns)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed to load spawns' }, 500)
  }
})
