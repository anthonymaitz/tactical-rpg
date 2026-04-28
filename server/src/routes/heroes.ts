// server/src/routes/heroes.ts
import { Hono } from 'hono'
import { heroService } from '../db/hero-service'
import { getSqClass, getSqClassAbilities, getSqContent } from '../db/sq-content'
import { supabase } from '../db/supabase'
import { authMiddleware } from '../middleware'

export const heroRoutes = new Hono<{ Variables: { userId: string } }>()

heroRoutes.use('*', authMiddleware)

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

  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400)

  const [sqClass, sqAbilities, content] = await Promise.all([
    getSqClass(body.className),
    getSqClassAbilities(body.className),
    getSqContent(),
  ])

  if (!sqClass) return c.json({ error: `Unknown class: ${body.className}` }, 400)
  if (!content.personalities.includes(body.personality)) {
    return c.json({ error: `Invalid personality: ${body.personality}` }, 400)
  }
  if (!content.professions.includes(body.profession)) {
    return c.json({ error: `Invalid profession: ${body.profession}` }, 400)
  }

  const abilities = sqAbilities.map((a) => ({
    id: a.id,
    name: a.title,
    energyCost: a.energyCost ?? 1,
    diceNotation: a.diceNotation ?? { kind: 'actor' },
    targetType: a.targetType ?? 'enemy',
    effect: a.effect ?? 'damage',
    context: a.context,
    statusEffect: a.statusEffects ?? undefined,
  })) as import('shared-types').AbilityDefinition[]

  const hero = await heroService.createHero(
    userId,
    body.name.trim(),
    { className: sqClass.id, die: sqClass.die, maxHp: sqClass.maxHp, maxEnergy: sqClass.maxEnergy, speed: sqClass.speed, abilities },
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

