import { sql } from './pg'
import type { SimpleQuestContent } from 'simple-quest'

export type SqClass = {
  id: string
  die: string
  maxHp: number
  maxEnergy: number
  speed: number
}

export type SqAbility = {
  id: string
  title: string
  body: string
  context: string
  source: string
  energyCost: number | null
  targetType: string | null
  effect: string | null
  diceNotation: object | null
  statusEffects: string[] | null
}

export async function getSqContent(): Promise<SimpleQuestContent> {
  const [meta, abilities] = await Promise.all([
    sql`select key, value from sq_metadata`,
    sql`select * from sq_abilities order by source, context`,
  ])

  const m: Record<string, unknown> = {}
  for (const row of meta) m[row.key] = row.value

  return {
    personalities: m.personalities as string[],
    classes: m.classes as string[],
    professions: m.professions as string[],
    statuses: m.statuses as never,
    descriptions: m.descriptions as Record<string, string>,
    generalContent: m.generalContent as string,
    deathContent: m.deathContent as string,
    abilities: abilities.map((a) => ({
      title: a.title,
      body: a.body,
      context: a.context as never,
      source: a.source,
      energyCost: a.energy_cost ?? undefined,
    })),
  }
}

export async function getSqClass(classId: string): Promise<SqClass | null> {
  const [row] = await sql`select * from sq_classes where id = ${classId}`
  if (!row) return null
  return {
    id: row.id,
    die: row.die,
    maxHp: row.max_hp,
    maxEnergy: row.max_energy,
    speed: row.speed,
  }
}

export async function getSqClassAbilities(classId: string): Promise<SqAbility[]> {
  const rows = await sql`select * from sq_abilities where source = ${classId} and context = 'inCombat'`
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    context: a.context,
    source: a.source,
    energyCost: a.energy_cost,
    targetType: a.target_type,
    effect: a.effect,
    diceNotation: a.dice_notation,
    statusEffects: a.status_effects,
  }))
}
