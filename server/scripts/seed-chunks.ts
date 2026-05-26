/// <reference types="bun-types" />
/**
 * Seed script: populates scene_chunks with 12 starter chunks (4 per biome).
 * Run once (or re-run to upsert): bun run server/scripts/seed-chunks.ts
 */
import { createClient } from '@supabase/supabase-js'
import type { SceneChunkMeta, SceneData } from 'shared-types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Verdant Forest chunks ─────────────────────────────────────────────────────

const vfWolfCamp: SceneChunkMeta = {
  slug: 'vf-wolf-camp',
  name: 'Wolf Pack Camp',
  biomeTags: ['verdant-forest'],
  width: 12,
  height: 12,
  sceneData: {
    buildings: [
      // Trees around the perimeter (corners and edges)
      { col: 0, row: 0, tileId: 'tree', instanceId: '0,0' },
      { col: 2, row: 0, tileId: 'tree', instanceId: '2,0' },
      { col: 4, row: 0, tileId: 'tree', instanceId: '4,0' },
      { col: 7, row: 0, tileId: 'tree', instanceId: '7,0' },
      { col: 9, row: 0, tileId: 'tree', instanceId: '9,0' },
      { col: 11, row: 0, tileId: 'tree', instanceId: '11,0' },
      { col: 0, row: 3, tileId: 'tree', instanceId: '0,3' },
      { col: 11, row: 3, tileId: 'tree', instanceId: '11,3' },
      { col: 0, row: 6, tileId: 'tree', instanceId: '0,6' },
      { col: 11, row: 6, tileId: 'tree', instanceId: '11,6' },
      { col: 0, row: 9, tileId: 'tree', instanceId: '0,9' },
      { col: 11, row: 9, tileId: 'tree', instanceId: '11,9' },
      { col: 0, row: 11, tileId: 'tree', instanceId: '0,11' },
      { col: 3, row: 11, tileId: 'tree', instanceId: '3,11' },
      { col: 6, row: 11, tileId: 'tree', instanceId: '6,11' },
      { col: 9, row: 11, tileId: 'tree', instanceId: '9,11' },
      { col: 11, row: 11, tileId: 'tree', instanceId: '11,11' },
    ],
    layers: [{ id: 1, background: 'grass' }],
    props: [
      { id: 'campfire-1', col: 6, row: 5, tileId: 'campfire' },
    ],
    tokens: [
      {
        id: 'vf-wolf-camp-spawn-1',
        type: 'spawn-point',
        col: 4,
        row: 4,
        name: 'Wolf',
        level: 1,
        spawnRadius: 2,
        dropTableSlug: 'wolf',
      },
      {
        id: 'vf-wolf-camp-spawn-2',
        type: 'spawn-point',
        col: 8,
        row: 7,
        name: 'Wolf',
        level: 1,
        spawnRadius: 2,
        dropTableSlug: 'wolf',
      },
    ],
    weather: 'sunny',
  } satisfies SceneData,
}

const vfBanditHideout: SceneChunkMeta = {
  slug: 'vf-bandit-hideout',
  name: 'Bandit Hideout',
  biomeTags: ['verdant-forest'],
  width: 12,
  height: 12,
  sceneData: {
    buildings: [],
    layers: [{ id: 1, background: 'grass' }],
    props: [
      { id: 'tent-1', col: 3, row: 3, tileId: 'tent' },
      { id: 'tent-2', col: 7, row: 2, tileId: 'tent' },
      { id: 'chest-1', col: 9, row: 8, tileId: 'chest' },
    ],
    tokens: [
      {
        id: 'vf-bandit-spawn-1',
        type: 'spawn-point',
        col: 5,
        row: 5,
        name: 'Bandit',
        level: 2,
        spawnRadius: 2,
        dropTableSlug: 'bandit',
      },
      {
        id: 'vf-bandit-spawn-2',
        type: 'spawn-point',
        col: 8,
        row: 6,
        name: 'Bandit',
        level: 2,
        spawnRadius: 2,
        dropTableSlug: 'bandit',
      },
    ],
    weather: 'sunny',
  } satisfies SceneData,
}

const vfForestShrine: SceneChunkMeta = {
  slug: 'vf-forest-shrine',
  name: 'Ancient Forest Shrine',
  biomeTags: ['verdant-forest'],
  width: 10,
  height: 10,
  sceneData: {
    buildings: [
      // Ring of trees encircling the shrine
      { col: 0, row: 0, tileId: 'tree', instanceId: '0,0' },
      { col: 5, row: 0, tileId: 'tree', instanceId: '5,0' },
      { col: 9, row: 0, tileId: 'tree', instanceId: '9,0' },
      { col: 0, row: 5, tileId: 'tree', instanceId: '0,5' },
      { col: 9, row: 5, tileId: 'tree', instanceId: '9,5' },
      { col: 0, row: 9, tileId: 'tree', instanceId: '0,9' },
      { col: 5, row: 9, tileId: 'tree', instanceId: '5,9' },
      { col: 9, row: 9, tileId: 'tree', instanceId: '9,9' },
    ],
    layers: [{ id: 1, background: 'grass' }],
    props: [
      { id: 'shrine-1', col: 4, row: 4, tileId: 'shrine-stone' },
    ],
    tokens: [
      {
        id: 'vf-shrine-spawn-1',
        type: 'spawn-point',
        col: 5,
        row: 5,
        name: 'Forest Spirit',
        level: 3,
        spawnRadius: 2,
        dropTableSlug: 'forest-spirit',
      },
    ],
    weather: 'misty',
  } satisfies SceneData,
}

const vfVillageOutpost: SceneChunkMeta = {
  slug: 'vf-village-outpost',
  name: 'Forest Village Outpost',
  biomeTags: ['verdant-forest'],
  width: 16,
  height: 16,
  sceneData: {
    buildings: [
      // House 1 (top-left area): 4×3 footprint
      { col: 1, row: 1, tileId: 'wall-wood', instanceId: '1,1' },
      { col: 2, row: 1, tileId: 'wall-wood', instanceId: '2,1' },
      { col: 3, row: 1, tileId: 'wall-wood', instanceId: '3,1' },
      { col: 4, row: 1, tileId: 'wall-wood', instanceId: '4,1' },
      { col: 1, row: 2, tileId: 'wall-wood', instanceId: '1,2' },
      { col: 4, row: 2, tileId: 'wall-wood', instanceId: '4,2' },
      { col: 1, row: 3, tileId: 'wall-wood', instanceId: '1,3' },
      { col: 2, row: 3, tileId: 'wall-wood', instanceId: '2,3' },
      { col: 4, row: 3, tileId: 'wall-wood', instanceId: '4,3' },
      // House 2 (top-right area): 4×3 footprint
      { col: 11, row: 1, tileId: 'wall-wood', instanceId: '11,1' },
      { col: 12, row: 1, tileId: 'wall-wood', instanceId: '12,1' },
      { col: 13, row: 1, tileId: 'wall-wood', instanceId: '13,1' },
      { col: 14, row: 1, tileId: 'wall-wood', instanceId: '14,1' },
      { col: 11, row: 2, tileId: 'wall-wood', instanceId: '11,2' },
      { col: 14, row: 2, tileId: 'wall-wood', instanceId: '14,2' },
      { col: 11, row: 3, tileId: 'wall-wood', instanceId: '11,3' },
      { col: 13, row: 3, tileId: 'wall-wood', instanceId: '13,3' },
      { col: 14, row: 3, tileId: 'wall-wood', instanceId: '14,3' },
    ],
    layers: [{ id: 1, background: 'grass' }],
    props: [
      { id: 'well-1', col: 7, row: 7, tileId: 'well' },
    ],
    tokens: [
      {
        id: 'vf-village-npc-elder',
        type: 'npc',
        col: 8,
        row: 10,
        role: 'sage',
        name: 'Forest Elder',
        direction: 's',
      },
    ],
    weather: 'sunny',
  } satisfies SceneData,
}

// ── Dungeon Depths chunks ─────────────────────────────────────────────────────

const ddSkeletonCrypt: SceneChunkMeta = {
  slug: 'dd-skeleton-crypt',
  name: 'Skeleton Crypt',
  biomeTags: ['dungeon-depths'],
  width: 12,
  height: 12,
  sceneData: {
    buildings: [
      // Top wall
      { col: 0, row: 0, tileId: 'wall-stone', instanceId: '0,0' },
      { col: 1, row: 0, tileId: 'wall-stone', instanceId: '1,0' },
      { col: 2, row: 0, tileId: 'wall-stone', instanceId: '2,0' },
      { col: 3, row: 0, tileId: 'wall-stone', instanceId: '3,0' },
      { col: 4, row: 0, tileId: 'wall-stone', instanceId: '4,0' },
      { col: 5, row: 0, tileId: 'wall-stone', instanceId: '5,0' },
      { col: 6, row: 0, tileId: 'wall-stone', instanceId: '6,0' },
      { col: 7, row: 0, tileId: 'wall-stone', instanceId: '7,0' },
      { col: 8, row: 0, tileId: 'wall-stone', instanceId: '8,0' },
      { col: 9, row: 0, tileId: 'wall-stone', instanceId: '9,0' },
      { col: 10, row: 0, tileId: 'wall-stone', instanceId: '10,0' },
      { col: 11, row: 0, tileId: 'wall-stone', instanceId: '11,0' },
      // Bottom wall
      { col: 0, row: 11, tileId: 'wall-stone', instanceId: '0,11' },
      { col: 1, row: 11, tileId: 'wall-stone', instanceId: '1,11' },
      { col: 2, row: 11, tileId: 'wall-stone', instanceId: '2,11' },
      { col: 3, row: 11, tileId: 'wall-stone', instanceId: '3,11' },
      { col: 4, row: 11, tileId: 'wall-stone', instanceId: '4,11' },
      // Door gap at col 5-6 (south exit)
      { col: 7, row: 11, tileId: 'wall-stone', instanceId: '7,11' },
      { col: 8, row: 11, tileId: 'wall-stone', instanceId: '8,11' },
      { col: 9, row: 11, tileId: 'wall-stone', instanceId: '9,11' },
      { col: 10, row: 11, tileId: 'wall-stone', instanceId: '10,11' },
      { col: 11, row: 11, tileId: 'wall-stone', instanceId: '11,11' },
      // Left wall
      { col: 0, row: 1, tileId: 'wall-stone', instanceId: '0,1' },
      { col: 0, row: 2, tileId: 'wall-stone', instanceId: '0,2' },
      { col: 0, row: 3, tileId: 'wall-stone', instanceId: '0,3' },
      { col: 0, row: 4, tileId: 'wall-stone', instanceId: '0,4' },
      { col: 0, row: 5, tileId: 'wall-stone', instanceId: '0,5' },
      { col: 0, row: 6, tileId: 'wall-stone', instanceId: '0,6' },
      { col: 0, row: 7, tileId: 'wall-stone', instanceId: '0,7' },
      { col: 0, row: 8, tileId: 'wall-stone', instanceId: '0,8' },
      { col: 0, row: 9, tileId: 'wall-stone', instanceId: '0,9' },
      { col: 0, row: 10, tileId: 'wall-stone', instanceId: '0,10' },
      // Right wall
      { col: 11, row: 1, tileId: 'wall-stone', instanceId: '11,1' },
      { col: 11, row: 2, tileId: 'wall-stone', instanceId: '11,2' },
      { col: 11, row: 3, tileId: 'wall-stone', instanceId: '11,3' },
      { col: 11, row: 4, tileId: 'wall-stone', instanceId: '11,4' },
      { col: 11, row: 5, tileId: 'wall-stone', instanceId: '11,5' },
      { col: 11, row: 6, tileId: 'wall-stone', instanceId: '11,6' },
      { col: 11, row: 7, tileId: 'wall-stone', instanceId: '11,7' },
      { col: 11, row: 8, tileId: 'wall-stone', instanceId: '11,8' },
      { col: 11, row: 9, tileId: 'wall-stone', instanceId: '11,9' },
      { col: 11, row: 10, tileId: 'wall-stone', instanceId: '11,10' },
    ],
    layers: [{ id: 1, background: 'stone-floor' }],
    props: [
      { id: 'coffin-1', col: 2, row: 3, tileId: 'coffin' },
      { id: 'coffin-2', col: 9, row: 3, tileId: 'coffin' },
      { id: 'coffin-3', col: 2, row: 8, tileId: 'coffin' },
    ],
    tokens: [
      {
        id: 'dd-crypt-spawn-1',
        type: 'spawn-point',
        col: 5,
        row: 5,
        name: 'Skeleton',
        level: 2,
        spawnRadius: 2,
        dropTableSlug: 'bandit',
      },
      {
        id: 'dd-crypt-spawn-2',
        type: 'spawn-point',
        col: 8,
        row: 7,
        name: 'Skeleton',
        level: 2,
        spawnRadius: 2,
        dropTableSlug: 'bandit',
      },
    ],
    weather: 'dark',
  } satisfies SceneData,
}

const ddSpiderNest: SceneChunkMeta = {
  slug: 'dd-spider-nest',
  name: 'Spider Nest',
  biomeTags: ['dungeon-depths'],
  width: 12,
  height: 12,
  sceneData: {
    buildings: [
      // Stalactite pillars scattered around
      { col: 2, row: 2, tileId: 'wall-stone', instanceId: '2,2' },
      { col: 9, row: 2, tileId: 'wall-stone', instanceId: '9,2' },
      { col: 2, row: 9, tileId: 'wall-stone', instanceId: '2,9' },
      { col: 9, row: 9, tileId: 'wall-stone', instanceId: '9,9' },
    ],
    layers: [{ id: 1, background: 'cave-floor' }],
    props: [
      { id: 'webs-1', col: 4, row: 3, tileId: 'spider-web' },
      { id: 'webs-2', col: 7, row: 8, tileId: 'spider-web' },
    ],
    tokens: [
      {
        id: 'dd-spider-spawn-1',
        type: 'spawn-point',
        col: 5,
        row: 4,
        name: 'Giant Spider',
        level: 3,
        spawnRadius: 2,
        dropTableSlug: 'forest-spirit',
      },
      {
        id: 'dd-spider-spawn-2',
        type: 'spawn-point',
        col: 7,
        row: 7,
        name: 'Skeleton',
        level: 2,
        spawnRadius: 2,
        dropTableSlug: 'bandit',
      },
    ],
    weather: 'dark',
  } satisfies SceneData,
}

const ddWraithChamber: SceneChunkMeta = {
  slug: 'dd-wraith-chamber',
  name: 'Wraith Chamber',
  biomeTags: ['dungeon-depths'],
  width: 10,
  height: 10,
  sceneData: {
    buildings: [
      // Ritual circle of stone pillars
      { col: 1, row: 1, tileId: 'wall-stone', instanceId: '1,1' },
      { col: 8, row: 1, tileId: 'wall-stone', instanceId: '8,1' },
      { col: 1, row: 8, tileId: 'wall-stone', instanceId: '1,8' },
      { col: 8, row: 8, tileId: 'wall-stone', instanceId: '8,8' },
    ],
    layers: [{ id: 1, background: 'stone-floor' }],
    props: [
      { id: 'altar-1', col: 4, row: 4, tileId: 'altar' },
    ],
    tokens: [
      {
        id: 'dd-wraith-spawn-1',
        type: 'spawn-point',
        col: 5,
        row: 5,
        name: 'Dungeon Wraith',
        level: 4,
        spawnRadius: 2,
        dropTableSlug: 'forest-spirit',
      },
    ],
    weather: 'dark',
  } satisfies SceneData,
}

const ddArmory: SceneChunkMeta = {
  slug: 'dd-armory',
  name: 'Abandoned Armory',
  biomeTags: ['dungeon-depths'],
  width: 14,
  height: 14,
  sceneData: {
    buildings: [
      // Outer walls
      { col: 0, row: 0, tileId: 'wall-stone', instanceId: '0,0' },
      { col: 1, row: 0, tileId: 'wall-stone', instanceId: '1,0' },
      { col: 2, row: 0, tileId: 'wall-stone', instanceId: '2,0' },
      { col: 3, row: 0, tileId: 'wall-stone', instanceId: '3,0' },
      { col: 4, row: 0, tileId: 'wall-stone', instanceId: '4,0' },
      { col: 5, row: 0, tileId: 'wall-stone', instanceId: '5,0' },
      { col: 6, row: 0, tileId: 'wall-stone', instanceId: '6,0' },
      { col: 7, row: 0, tileId: 'wall-stone', instanceId: '7,0' },
      { col: 8, row: 0, tileId: 'wall-stone', instanceId: '8,0' },
      { col: 9, row: 0, tileId: 'wall-stone', instanceId: '9,0' },
      { col: 10, row: 0, tileId: 'wall-stone', instanceId: '10,0' },
      { col: 11, row: 0, tileId: 'wall-stone', instanceId: '11,0' },
      { col: 12, row: 0, tileId: 'wall-stone', instanceId: '12,0' },
      { col: 13, row: 0, tileId: 'wall-stone', instanceId: '13,0' },
      { col: 0, row: 13, tileId: 'wall-stone', instanceId: '0,13' },
      { col: 13, row: 13, tileId: 'wall-stone', instanceId: '13,13' },
      { col: 0, row: 1, tileId: 'wall-stone', instanceId: '0,1' },
      { col: 0, row: 2, tileId: 'wall-stone', instanceId: '0,2' },
      { col: 0, row: 3, tileId: 'wall-stone', instanceId: '0,3' },
      { col: 0, row: 4, tileId: 'wall-stone', instanceId: '0,4' },
      { col: 0, row: 5, tileId: 'wall-stone', instanceId: '0,5' },
      { col: 0, row: 6, tileId: 'wall-stone', instanceId: '0,6' },
      { col: 13, row: 1, tileId: 'wall-stone', instanceId: '13,1' },
      { col: 13, row: 2, tileId: 'wall-stone', instanceId: '13,2' },
      { col: 13, row: 3, tileId: 'wall-stone', instanceId: '13,3' },
      { col: 13, row: 4, tileId: 'wall-stone', instanceId: '13,4' },
      { col: 13, row: 5, tileId: 'wall-stone', instanceId: '13,5' },
      { col: 13, row: 6, tileId: 'wall-stone', instanceId: '13,6' },
    ],
    layers: [{ id: 1, background: 'stone-floor' }],
    props: [
      { id: 'weapon-rack-1', col: 3, row: 3, tileId: 'weapon-rack' },
      { id: 'weapon-rack-2', col: 10, row: 3, tileId: 'weapon-rack' },
      { id: 'weapon-rack-3', col: 3, row: 9, tileId: 'weapon-rack' },
    ],
    tokens: [
      {
        id: 'dd-armory-spawn-1',
        type: 'spawn-point',
        col: 7,
        row: 7,
        name: 'Skeleton',
        level: 2,
        spawnRadius: 3,
        dropTableSlug: 'bandit',
      },
    ],
    weather: 'dark',
  } satisfies SceneData,
}

// ── Ruined Castle chunks ──────────────────────────────────────────────────────

const rcGuardPost: SceneChunkMeta = {
  slug: 'rc-guard-post',
  name: 'Castle Guard Post',
  biomeTags: ['ruined-castle'],
  width: 12,
  height: 12,
  sceneData: {
    buildings: [
      // Partial castle wall — left side and top
      { col: 0, row: 0, tileId: 'wall-stone', instanceId: '0,0' },
      { col: 1, row: 0, tileId: 'wall-stone', instanceId: '1,0' },
      { col: 2, row: 0, tileId: 'wall-stone', instanceId: '2,0' },
      { col: 3, row: 0, tileId: 'wall-stone', instanceId: '3,0' },
      { col: 4, row: 0, tileId: 'wall-stone', instanceId: '4,0' },
      // Gap at col 5-6 (gatehouse opening)
      { col: 7, row: 0, tileId: 'wall-stone', instanceId: '7,0' },
      { col: 8, row: 0, tileId: 'wall-stone', instanceId: '8,0' },
      { col: 9, row: 0, tileId: 'wall-stone', instanceId: '9,0' },
      { col: 10, row: 0, tileId: 'wall-stone', instanceId: '10,0' },
      { col: 11, row: 0, tileId: 'wall-stone', instanceId: '11,0' },
      // Left wall partial (ruined — only goes partway down)
      { col: 0, row: 1, tileId: 'wall-stone', instanceId: '0,1' },
      { col: 0, row: 2, tileId: 'wall-stone', instanceId: '0,2' },
      { col: 0, row: 3, tileId: 'wall-stone', instanceId: '0,3' },
      { col: 0, row: 4, tileId: 'wall-stone', instanceId: '0,4' },
      // Right wall partial
      { col: 11, row: 1, tileId: 'wall-stone', instanceId: '11,1' },
      { col: 11, row: 2, tileId: 'wall-stone', instanceId: '11,2' },
      { col: 11, row: 3, tileId: 'wall-stone', instanceId: '11,3' },
      { col: 11, row: 4, tileId: 'wall-stone', instanceId: '11,4' },
    ],
    layers: [{ id: 1, background: 'cobblestone' }],
    props: [],
    tokens: [
      {
        id: 'rc-guard-spawn-1',
        type: 'spawn-point',
        col: 4,
        row: 6,
        name: 'Cursed Knight',
        level: 3,
        spawnRadius: 2,
        dropTableSlug: 'bandit',
      },
      {
        id: 'rc-guard-spawn-2',
        type: 'spawn-point',
        col: 8,
        row: 6,
        name: 'Cursed Knight',
        level: 3,
        spawnRadius: 2,
        dropTableSlug: 'bandit',
      },
    ],
    weather: 'overcast',
  } satisfies SceneData,
}

const rcWraithTower: SceneChunkMeta = {
  slug: 'rc-wraith-tower',
  name: 'Wraith Tower',
  biomeTags: ['ruined-castle'],
  width: 12,
  height: 12,
  sceneData: {
    buildings: [
      // Tower footprint — circular-ish with stone walls
      { col: 3, row: 0, tileId: 'wall-stone', instanceId: '3,0' },
      { col: 4, row: 0, tileId: 'wall-stone', instanceId: '4,0' },
      { col: 5, row: 0, tileId: 'wall-stone', instanceId: '5,0' },
      { col: 6, row: 0, tileId: 'wall-stone', instanceId: '6,0' },
      { col: 7, row: 0, tileId: 'wall-stone', instanceId: '7,0' },
      { col: 8, row: 0, tileId: 'wall-stone', instanceId: '8,0' },
      { col: 2, row: 1, tileId: 'wall-stone', instanceId: '2,1' },
      { col: 9, row: 1, tileId: 'wall-stone', instanceId: '9,1' },
      { col: 1, row: 2, tileId: 'wall-stone', instanceId: '1,2' },
      { col: 10, row: 2, tileId: 'wall-stone', instanceId: '10,2' },
      { col: 1, row: 3, tileId: 'wall-stone', instanceId: '1,3' },
      { col: 10, row: 3, tileId: 'wall-stone', instanceId: '10,3' },
      { col: 1, row: 8, tileId: 'wall-stone', instanceId: '1,8' },
      { col: 10, row: 8, tileId: 'wall-stone', instanceId: '10,8' },
      { col: 2, row: 9, tileId: 'wall-stone', instanceId: '2,9' },
      { col: 9, row: 9, tileId: 'wall-stone', instanceId: '9,9' },
      { col: 3, row: 10, tileId: 'wall-stone', instanceId: '3,10' },
      { col: 4, row: 10, tileId: 'wall-stone', instanceId: '4,10' },
      // Gap (doorway) at col 5-6
      { col: 7, row: 10, tileId: 'wall-stone', instanceId: '7,10' },
      { col: 8, row: 10, tileId: 'wall-stone', instanceId: '8,10' },
    ],
    layers: [{ id: 1, background: 'stone-floor' }],
    props: [],
    tokens: [
      {
        id: 'rc-tower-spawn-1',
        type: 'spawn-point',
        col: 6,
        row: 5,
        name: 'Castle Wraith',
        level: 4,
        spawnRadius: 2,
        dropTableSlug: 'forest-spirit',
      },
    ],
    weather: 'stormy',
  } satisfies SceneData,
}

const rcThroneRoom: SceneChunkMeta = {
  slug: 'rc-throne-room',
  name: 'Lich Lord Throne Room',
  biomeTags: ['ruined-castle'],
  width: 16,
  height: 16,
  sceneData: {
    buildings: [
      // Full enclosing walls
      ...Array.from({ length: 16 }, (_, i) => ({ col: i, row: 0, tileId: 'wall-stone', instanceId: `${i},0` })),
      ...Array.from({ length: 16 }, (_, i) => ({ col: i, row: 15, tileId: 'wall-stone', instanceId: `${i},15` })),
      ...Array.from({ length: 14 }, (_, i) => ({ col: 0, row: i + 1, tileId: 'wall-stone', instanceId: `0,${i + 1}` })),
      ...Array.from({ length: 14 }, (_, i) => ({ col: 15, row: i + 1, tileId: 'wall-stone', instanceId: `15,${i + 1}` })),
    ],
    layers: [{ id: 1, background: 'throne-floor' }],
    props: [
      { id: 'throne-1', col: 7, row: 2, tileId: 'throne' },
    ],
    tokens: [
      {
        id: 'rc-throne-spawn-1',
        type: 'spawn-point',
        col: 8,
        row: 4,
        name: 'Lich Lord',
        level: 5,
        spawnRadius: 2,
        dropTableSlug: 'forest-spirit',
      },
      {
        id: 'rc-throne-door-1',
        type: 'door',
        col: 7,
        row: 14,
        destinationSlug: 'rc-dungeon-depths',
        label: 'Sub-Dungeon',
      },
    ],
    weather: 'stormy',
  } satisfies SceneData,
}

const rcMerchant: SceneChunkMeta = {
  slug: 'rc-merchant',
  name: 'Wandering Merchant Stall',
  biomeTags: ['ruined-castle'],
  width: 14,
  height: 14,
  sceneData: {
    buildings: [
      // Partial ruined walls for shelter
      { col: 0, row: 0, tileId: 'wall-stone', instanceId: '0,0' },
      { col: 1, row: 0, tileId: 'wall-stone', instanceId: '1,0' },
      { col: 2, row: 0, tileId: 'wall-stone', instanceId: '2,0' },
      { col: 3, row: 0, tileId: 'wall-stone', instanceId: '3,0' },
      { col: 4, row: 0, tileId: 'wall-stone', instanceId: '4,0' },
      { col: 0, row: 1, tileId: 'wall-stone', instanceId: '0,1' },
      { col: 0, row: 2, tileId: 'wall-stone', instanceId: '0,2' },
      { col: 0, row: 3, tileId: 'wall-stone', instanceId: '0,3' },
      { col: 0, row: 4, tileId: 'wall-stone', instanceId: '0,4' },
      { col: 4, row: 1, tileId: 'wall-stone', instanceId: '4,1' },
      { col: 4, row: 2, tileId: 'wall-stone', instanceId: '4,2' },
      { col: 4, row: 3, tileId: 'wall-stone', instanceId: '4,3' },
      { col: 4, row: 4, tileId: 'wall-stone', instanceId: '4,4' },
      { col: 1, row: 4, tileId: 'wall-stone', instanceId: '1,4' },
      { col: 2, row: 4, tileId: 'wall-stone', instanceId: '2,4' },
      { col: 3, row: 4, tileId: 'wall-stone', instanceId: '3,4' },
    ],
    layers: [{ id: 1, background: 'cobblestone' }],
    props: [
      { id: 'stall-1', col: 6, row: 4, tileId: 'market-stall' },
      { id: 'stall-2', col: 9, row: 4, tileId: 'market-stall' },
      { id: 'crate-1', col: 7, row: 7, tileId: 'crate' },
    ],
    tokens: [
      {
        id: 'rc-merchant-npc-1',
        type: 'npc',
        col: 7,
        row: 5,
        role: 'innkeeper',
        name: 'Wandering Merchant',
        direction: 's',
      },
    ],
    weather: 'overcast',
  } satisfies SceneData,
}

// ── All chunks ────────────────────────────────────────────────────────────────

const ALL_CHUNKS: SceneChunkMeta[] = [
  vfWolfCamp,
  vfBanditHideout,
  vfForestShrine,
  vfVillageOutpost,
  ddSkeletonCrypt,
  ddSpiderNest,
  ddWraithChamber,
  ddArmory,
  rcGuardPost,
  rcWraithTower,
  rcThroneRoom,
  rcMerchant,
]

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${ALL_CHUNKS.length} scene chunks…`)

  const rows = ALL_CHUNKS.map((chunk) => ({
    slug: chunk.slug,
    name: chunk.name,
    biome_tags: chunk.biomeTags,
    width: chunk.width,
    height: chunk.height,
    scene_data: chunk.sceneData,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('scene_chunks')
    .upsert(rows, { onConflict: 'slug' })

  if (error) throw error

  console.log('Done. Seeded chunks:')
  for (const chunk of ALL_CHUNKS) {
    const tokenSummary = chunk.sceneData.tokens
      .map((t) => `${t.type}:${t.name ?? t.role ?? t.id}`)
      .join(', ')
    console.log(`  ${chunk.slug} (${chunk.biomeTags[0]}) — tokens: [${tokenSummary}]`)
  }
}

seed().catch((e) => { console.error(e); process.exit(1) })
