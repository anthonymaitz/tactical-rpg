import { Hono } from 'hono'
import { getSqContent } from '../db/sq-content'

export const contentRoutes = new Hono()

contentRoutes.get('/', async (c) => {
  const content = await getSqContent()
  return c.json(content)
})
