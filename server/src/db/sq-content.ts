import { supabase } from './supabase'
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

const abilityCache = new Map<string, SqAbility[]>()
const secondaryCache = new Map<string, { inCombat: SqAbility | null; outOfCombat: SqAbility | null }>()

export async function getSqContent(): Promise<SimpleQuestContent> {
  const [{ data: meta, error: metaErr }, { data: abilities, error: abilityErr }] = await Promise.all([
    supabase.from('sq_metadata').select('key, value'),
    supabase.from('sq_abilities').select('*').order('source').order('context'),
  ])
  if (metaErr) throw metaErr
  if (abilityErr) throw abilityErr

  const m: Record<string, unknown> = {}
  for (const row of meta ?? []) m[row.key] = row.value

  return {
    personalities: m.personalities as string[],
    classes: m.classes as string[],
    professions: m.professions as string[],
    statuses: m.statuses as never,
    descriptions: m.descriptions as Record<string, string>,
    generalContent: m.generalContent as string,
    deathContent: m.deathContent as string,
    abilities: (abilities ?? []).map((a) => ({
      title: a.title,
      body: a.body,
      context: a.context as never,
      source: a.source,
      energyCost: a.energy_cost ?? undefined,
    })),
  }
}

export async function getSqClass(classId: string): Promise<SqClass | null> {
  const { data, error } = await supabase
    .from('sq_classes')
    .select('*')
    .eq('id', classId)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    die: data.die,
    maxHp: data.max_hp,
    maxEnergy: data.max_energy,
    speed: data.speed,
  }
}

export async function getSqClassAbilities(classId: string): Promise<SqAbility[]> {
  if (abilityCache.has(classId)) return abilityCache.get(classId)!
  const { data, error } = await supabase
    .from('sq_abilities')
    .select('*')
    .eq('source', classId)
    .eq('context', 'inCombat')
    .order('id', { ascending: true })
  if (error) throw error
  const result = (data ?? []).map((a) => ({
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
  abilityCache.set(classId, result)
  return result
}

export async function getSqClassSecondaryAbilities(classId: string): Promise<{ inCombat: SqAbility | null; outOfCombat: SqAbility | null }> {
  if (secondaryCache.has(classId)) return secondaryCache.get(classId)!
  const { data, error } = await supabase
    .from('sq_abilities')
    .select('*')
    .eq('source', classId)
    .in('context', ['inCombat', 'outOfCombat'])
    .order('id', { ascending: true })
  if (error) throw error
  const abilities = (data ?? []).map((a) => ({
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
  })) as SqAbility[]
  const result = {
    inCombat: abilities.find((a) => a.context === 'inCombat') ?? null,
    outOfCombat: abilities.find((a) => a.context === 'outOfCombat') ?? null,
  }
  secondaryCache.set(classId, result)
  return result
}

export type NpcPanel = { speaker: string; text: string }
export type NpcDialogue = Record<string, NpcPanel[]>

export async function getNpcDialogue(): Promise<NpcDialogue | null> {
  const { data, error } = await supabase
    .from('sq_metadata')
    .select('value')
    .eq('key', 'npc_dialogue')
    .single()
  if (error || !data) return null
  return data.value as NpcDialogue
}

export async function listSqClasses(): Promise<Array<{ id: string; firstAbility: SqAbility | null }>> {
  const { data, error } = await supabase
    .from('sq_classes')
    .select('id')
    .order('id', { ascending: true })
  if (error) throw error
  const results = await Promise.all(
    (data ?? []).map(async (cls) => {
      const abilities = await getSqClassAbilities(cls.id)
      return { id: cls.id, firstAbility: abilities[0] ?? null }
    })
  )
  return results
}
