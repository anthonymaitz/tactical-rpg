import { Hono } from 'hono'
import { chunkService } from '../db/chunk-service'
import { authMiddleware } from '../middleware'
import type { SceneChunkMeta } from 'shared-types'

export const chunkRoutes = new Hono<{ Variables: { userId: string } }>()

// GET /chunks — list all chunks, optionally filter by ?biomeTag=verdant-forest
chunkRoutes.get('/', async (c) => {
  const biomeTag = c.req.query('biomeTag')
  const chunks = await chunkService.listChunks(biomeTag ?? undefined)
  return c.json(chunks)
})

// GET /chunks/:slug — get one chunk by slug
chunkRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const chunk = await chunkService.getChunk(slug)
  if (!chunk) return c.json({ error: 'Chunk not found' }, 404)
  return c.json(chunk)
})

// POST /chunks — create new chunk (requires auth)
chunkRoutes.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<SceneChunkMeta>()
  if (!body.slug) return c.json({ error: 'slug required' }, 400)
  if (!body.name) return c.json({ error: 'name required' }, 400)
  if (!body.sceneData) return c.json({ error: 'sceneData required' }, 400)
  const chunk = await chunkService.upsertChunk(body, userId)
  return c.json(chunk, 201)
})

// PUT /chunks/:slug — update existing chunk (requires auth)
chunkRoutes.put('/:slug', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const slug = c.req.param('slug') ?? ''
  const body = await c.req.json<Omit<SceneChunkMeta, 'slug'>>()
  if (!slug) return c.json({ error: 'slug required' }, 400)
  if (!body.name) return c.json({ error: 'name required' }, 400)
  if (!body.sceneData) return c.json({ error: 'sceneData required' }, 400)
  const chunk = await chunkService.upsertChunk({ ...body, slug }, userId)
  return c.json(chunk)
})
