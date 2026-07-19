/// <reference types="bun-types" />
/**
 * Seed script: populates sq_classes, sq_abilities, sq_metadata from sampleContent.
 * Run once (or re-run to upsert): bun run server/scripts/seed-sq-content.ts
 */
import { sql } from '../src/db/pg'
import { sampleContent } from '../../../simplequest/src/sample-content'

// ── Mechanical data for inCombat class abilities (merged from old STARTER_CLASSES) ──
const MECHANICS: Record<string, { targetType: string; effect: string; diceNotation: object; statusEffects?: string[] }> = {
  // Fighter
  'Strike':            { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'actor' } },
  'Shield Block':      { targetType: 'enemy', effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d6' }, statusEffects: ['stunned'] },
  'Reckless Assault':  { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'notation', value: '4d4' } },
  'Cleave':            { targetType: 'area',  effect: 'damage',  diceNotation: { kind: 'notation', value: '1d8' } },
  'Charge':            { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'notation', value: '1d10' } },
  'Taunt':             { targetType: 'enemy', effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d20' } },
  // Wizard
  'Wand':              { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'actor' } },
  'Chain Lightning':   { targetType: 'area',  effect: 'damage',  diceNotation: { kind: 'notation', value: '1d6' } },
  'Morph':             { targetType: 'enemy', effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d20' } },
  'Teleport':          { targetType: 'self',  effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d6' } },
  'Illusion':          { targetType: 'self',  effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d20' } },
  'Living Flame':      { targetType: 'area',  effect: 'damage',  diceNotation: { kind: 'notation', value: '1d6' } },
  // Sage
  'Hex':               { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'actor' } },
  'Heal':              { targetType: 'ally',  effect: 'heal',    diceNotation: { kind: 'notation', value: '1d12' } },
  'Shield':            { targetType: 'ally',  effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d20' } },
  'Dispel':            { targetType: 'area',  effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d8' } },
  'Fear':              { targetType: 'area',  effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d8' } },
  'Cleanse':           { targetType: 'ally',  effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d20' } },
  // Marksman
  'Shoot':             { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'actor' } },
  'Distracting Shot':  { targetType: 'enemy', effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d10' }, statusEffects: ['blinded'] },
  'Fire Arrows':       { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'notation', value: '1d20' } },
  'Poison Arrow':      { targetType: 'enemy', effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d8' }, statusEffects: ['poisoned'] },
  'Dodge':             { targetType: 'self',  effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d20' } },
  // Monk
  'Kung Fu':           { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'actor' } },
  'Judo Throw':        { targetType: 'enemy', effect: 'debuff',  diceNotation: { kind: 'notation', value: '1d6' }, statusEffects: ['stunned'] },
  'Chi Heal':          { targetType: 'ally',  effect: 'heal',    diceNotation: { kind: 'notation', value: '1d10' } },
  'Soul Siphon':       { targetType: 'enemy', effect: 'damage',  diceNotation: { kind: 'notation', value: '1d20' } },
  'Flying Scissor Kick': { targetType: 'enemy', effect: 'damage', diceNotation: { kind: 'notation', value: '1d8' } },
  'Earthcall':         { targetType: 'area',  effect: 'damage',  diceNotation: { kind: 'notation', value: '1d20' } },
}

// ── Class stats ──────────────────────────────────────────────────────────────
const CLASS_STATS = [
  { id: 'fighter',  die: 'd8', max_hp: 20, max_energy: 4, speed: 3 },
  { id: 'wizard',   die: 'd6', max_hp: 12, max_energy: 6, speed: 3 },
  { id: 'marksman', die: 'd6', max_hp: 14, max_energy: 5, speed: 4 },
  { id: 'sage',     die: 'd6', max_hp: 16, max_energy: 5, speed: 3 },
  { id: 'monk',     die: 'd8', max_hp: 18, max_energy: 5, speed: 4 },
]

async function seed() {
  console.log('Seeding sq_classes…')
  for (const c of CLASS_STATS) {
    await sql`
      insert into sq_classes (id, die, max_hp, max_energy, speed)
      values (${c.id}, ${c.die}, ${c.max_hp}, ${c.max_energy}, ${c.speed})
      on conflict (id) do update set die = excluded.die, max_hp = excluded.max_hp, max_energy = excluded.max_energy, speed = excluded.speed
    `
  }

  console.log('Seeding sq_abilities…')
  const abilities = sampleContent.abilities.map((card) => {
    const slug = card.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = `${card.source}-${slug}`
    const mech = MECHANICS[card.title]
    return {
      id,
      title: card.title,
      body: card.body,
      context: card.context,
      source: card.source,
      energy_cost: card.energyCost ?? null,
      target_type: mech?.targetType ?? null,
      effect: mech?.effect ?? null,
      dice_notation: mech?.diceNotation ?? null,
      status_effects: mech?.statusEffects ?? null,
    }
  })
  for (const a of abilities) {
    await sql`
      insert into sq_abilities (id, title, body, context, source, energy_cost, target_type, effect, dice_notation, status_effects)
      values (${a.id}, ${a.title}, ${a.body}, ${a.context}, ${a.source}, ${a.energy_cost}, ${a.target_type}, ${a.effect}, ${a.dice_notation ? sql.json(a.dice_notation) : null}, ${a.status_effects})
      on conflict (id) do update set
        title = excluded.title, body = excluded.body, context = excluded.context, source = excluded.source,
        energy_cost = excluded.energy_cost, target_type = excluded.target_type, effect = excluded.effect,
        dice_notation = excluded.dice_notation, status_effects = excluded.status_effects
    `
  }

  console.log('Seeding sq_metadata…')
  const metadata = [
    { key: 'personalities', value: sampleContent.personalities },
    { key: 'classes',       value: sampleContent.classes },
    { key: 'professions',   value: sampleContent.professions },
    { key: 'statuses',      value: sampleContent.statuses },
    { key: 'descriptions',  value: sampleContent.descriptions },
    { key: 'generalContent', value: sampleContent.generalContent },
    { key: 'deathContent',  value: sampleContent.deathContent },
  ]
  for (const m of metadata) {
    await sql`
      insert into sq_metadata (key, value) values (${m.key}, ${sql.json(m.value as object)})
      on conflict (key) do update set value = excluded.value
    `
  }

  console.log('Done. Seeded', abilities.length, 'abilities,', CLASS_STATS.length, 'classes.')
}

seed().catch((e) => { console.error(e); process.exit(1) }).finally(() => sql.end())
