import { Hono } from 'hono'
import { getSqContent, listSqClasses } from '../db/sq-content'

export const contentRoutes = new Hono()

contentRoutes.get('/', async (c) => {
  const content = await getSqContent()
  return c.json(content)
})

contentRoutes.get('/classes', async (c) => {
  const classes = await listSqClasses()
  return c.json({
    classes: classes
      .filter((cls) => cls.firstAbility !== null)
      .map((cls) => ({
        name: cls.id,
        ability: {
          id: cls.firstAbility!.id,
          name: cls.firstAbility!.title,
          description: cls.firstAbility!.body,
        },
      })),
  })
})
