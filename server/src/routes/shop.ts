// server/src/routes/shop.ts
import { Hono } from 'hono'
import { WEAPONS } from 'shared-types'
import { heroService } from '../db/hero-service'
import { inventoryService } from '../db/inventory-service'
import { supabase } from '../db/supabase'
import { authMiddleware } from '../middleware'

export const shopRoutes = new Hono<{ Variables: { userId: string } }>()

shopRoutes.use('*', authMiddleware)

// GET /shop/weapons — list all purchasable weapons
shopRoutes.get('/weapons', (c) => {
  return c.json(WEAPONS)
})

// POST /shop/buy-weapon
// Body: { heroId: string, weaponId: string }
// 1. Verify hero belongs to authenticated user
// 2. Look up weapon from WEAPONS array
// 3. Check hero level >= levelRequirement
// 4. Check player stash gold >= weapon.cost
// 5. Deduct gold from stash
// 6. Equip weapon to hero's gear.weapon slot
// 7. Return { gear, gold }
shopRoutes.post('/buy-weapon', async (c) => {
  const userId = c.get('userId') as string
  const body = await c.req.json<{ heroId: string; weaponId: string }>()

  if (!body.heroId) return c.json({ error: 'heroId required' }, 400)
  if (!body.weaponId) return c.json({ error: 'weaponId required' }, 400)

  // Verify hero ownership
  const { data: ownerCheck } = await supabase
    .from('heroes')
    .select('user_id, level')
    .eq('id', body.heroId)
    .single()
  if (!ownerCheck || ownerCheck.user_id !== userId) {
    return c.json({ error: 'Hero not found' }, 404)
  }

  // Look up weapon
  const weapon = WEAPONS.find(w => w.id === body.weaponId)
  if (!weapon) return c.json({ error: `Unknown weapon: ${body.weaponId}` }, 400)

  // Check level requirement
  const heroLevel = (ownerCheck.level as number) ?? 1
  if (heroLevel < weapon.levelRequirement) {
    return c.json({ error: `Hero must be level ${weapon.levelRequirement} to equip ${weapon.name}` }, 400)
  }

  // Check gold
  const inv = await inventoryService.getOrCreate(userId)
  if (inv.gold < weapon.cost) {
    return c.json({ error: `Not enough gold. Need ${weapon.cost}, have ${inv.gold}` }, 400)
  }

  try {
    // Deduct gold
    const { data: invData, error: invErr } = await supabase
      .from('player_inventory')
      .update({ gold: inv.gold - weapon.cost, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single()
    if (invErr) throw invErr

    // Equip weapon
    const hero = await heroService.equipGear(body.heroId, 'weapon', weapon.id)

    return c.json({
      gear: hero.gear,
      gold: (invData as Record<string, unknown>).gold as number,
    })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Purchase failed' }, 500)
  }
})
