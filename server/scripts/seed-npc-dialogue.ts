/// <reference types="bun-types" />
/**
 * Seed script: upserts NPC dialogue panels into sq_metadata under key 'npc_dialogue'.
 * Run once (or re-run to update): bun run server/scripts/seed-npc-dialogue.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const dialogue = {
  innkeeper: [
    { speaker: 'Innkeeper', text: 'Welcome back! Rest up — your heroes are fully restored.' },
  ],
  blacksmith: [
    { speaker: 'Blacksmith', text: 'I can help you equip your heroes when gear equipping arrives.' },
  ],
  sage_locked: [
    { speaker: 'Sage', text: "Return when you've proven yourself in battle. Secondary paths open at level 5." },
  ],
  sage_unlocked: [
    { speaker: 'Sage', text: 'Your spirit is ready. Choose a second path — one ability from another class will join your arsenal.' },
  ],
  sage_rechosen: [
    { speaker: 'Sage', text: 'Your path can be reforged. Choose again to swap your borrowed ability.' },
  ],
}

const { error } = await supabase
  .from('sq_metadata')
  .upsert({ key: 'npc_dialogue', value: dialogue }, { onConflict: 'key' })

if (error) {
  console.error('Failed to seed npc_dialogue:', error.message)
  process.exit(1)
}

console.log('✓ Seeded npc_dialogue into sq_metadata')
