import { Hono } from 'hono'
import { fetchScene, upsertScene } from '../db/scene-service'
import { authMiddleware } from '../middleware'
import type { SceneData } from 'shared-types'

export const sceneRoutes = new Hono<{ Variables: { userId: string } }>()

// GET /scenes/:slug — public read (BuildScreen preview + room bootstrap)
sceneRoutes.get('/:slug', async (c) => {
  const scene = await fetchScene(c.req.param('slug'))
  return c.json(scene)
})

// PUT /scenes/:slug — save from the builder. Body: { sceneData: SceneData }
sceneRoutes.put('/:slug', authMiddleware, async (c) => {
  const slug = c.req.param('slug')!
  const userId = c.get('userId') as string
  const body = await c.req.json<{ sceneData: SceneData }>()
  if (!body.sceneData) return c.json({ error: 'sceneData is required' }, 400)
  await upsertScene(slug, body.sceneData, userId)
  return c.json({ ok: true })
})
