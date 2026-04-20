# Simple Quest Tactics — Game Design Spec

**Date:** 2026-04-20  
**Status:** Approved

---

## Overview

Simple Quest Tactics is a Diablo-style dungeon crawler with roguelite progression. Players build a persistent roster of heroes, dive into procedural biome maps, fight tactical turn-based combat, collect gear and new heroes, and return to their base (The Inn) between runs. There is no defined end state — the game is about exploration, growth, and discovery.

---

## Core Game Loop

1. **The Inn** — Players start in the hub world. Browse the roster, equip gear, talk to NPCs, manage guild upgrades. Each biome is accessible via a dedicated door.
2. **Enter a Biome** — Walk through a door to teleport into the biome's infinite map.
3. **Explore** — Free-roam grid exploration. Difficulty scales with distance from the spawn teleport. Structures and encounters are scattered across the map.
4. **Events** — Stepping into encounter zones or structures triggers events (see below).
5. **Combat** — Tactical turn-based combat in CombatRoom. Energy-based turns using SimpleQuest rules.
6. **Extract** — Walk back to the spawn teleport pad, or use a recall item (consumable drop). No mandatory objective — players push as far as they want.
7. **Post-encounter** — End-of-encounter screen after each combat: XP earned, loot dropped, heroes knocked out.
8. **Return to Inn** — Knocked-out heroes begin recovery timers. Gear equipped. Upgrades purchased.

---

## Environments

### The Inn (Hub World)

The Inn is an explorable map — not a UI screen. Players walk around and interact with NPCs and doors. It uses the existing ExploreRoom.

**NPCs:**
| NPC | Role |
|-----|------|
| Innkeeper | Manage roster, view hero recovery timers |
| Blacksmith | Equip and compare gear |
| Sage | Purchase upgrade tree nodes |
| Guild Master | Create/join guild, view shared upgrades |
| Doorkeepers | One per biome door; show biome difficulty and current party |

**Biome Doors:** Each unlocked biome has a door in the Inn. Walk through to enter. Locked biomes show a locked door (unlocked via Dungeon upgrade tree).

**Party Assembly:** Interacting with a Doorkeeper NPC triggers a party selection UI — players choose which available (non-recovering) heroes to bring before the biome loads.

---

### Biome Maps

Each biome is one large procedural map — not floor-based. Players teleport in at a fixed spawn point and explore outward. Distance from spawn determines difficulty: enemy level, encounter density, and loot quality all scale with distance.

**MVP Biomes:**

| Biome | Theme | Difficulty |
|-------|-------|------------|
| Verdant Forest | Starter — bandits, wolves, forest spirits | Near spawn: trivial. Far: dangerous. |
| Dungeon Depths | Mid — undead, traps, dark magic | Uniformly harder than Forest |
| Ruined Castle | Hard — knights, demons, boss rooms | End-game distances only |

Additional biomes unlocked via the Dungeon upgrade tree.

---

## Events & Structures

### Open Map Events
Scattered across each biome map at varying distances from spawn:

| Event | Description |
|-------|-------------|
| **Combat Zone** | Enemy patrol area. Entering triggers a tactical combat encounter. |
| **Ambush** | Hidden encounter. Enemies get a free action round before player turn. |
| **Treasure Cache** | Loot chest. May contain gear, recall items, or a new hero scroll. |
| **Merchant** | Wandering trader. Buy/sell gear and consumables using gold dropped from enemies. |
| **Shrine** | Interact to heal party HP or grant a temporary buff for the current dive. |

### Structures
Distinct zones on the map (ruins, crypts, towers, caves). Structures contain denser encounters and always include a boss encounter at their deepest point. Boss loot tables are better than open-world drops and may include hero scrolls (unlock a new hero for the roster).

---

## Hero System

### Identity
Each hero has:
- **Class** — determines ability set and die size (Fighter d8, Mage d6, Rogue d8, Cleric d6, etc.)
- **Personality** — shapes dialogue and passive traits
- **Die Size** — core mechanic inherited from SimpleQuest rules

The SimpleQuest web component (`<simple-quest>`) renders the hero card UI: stats, abilities, energy. This is the source of truth for hero display — no custom hero card UI is built.

### Gear Slots
| Slot | Examples |
|------|---------|
| Weapon | Sword, Staff, Bow, Dagger |
| Off-hand | Shield, Tome, Quiver |
| Armor | Light, Medium, Heavy |
| Trinket | Rings, Amulets — passive effects |

Gear is equipped in The Inn via the Blacksmith NPC.

### Progression
- **XP** earned from combat encounters and discoveries (treasure, shrines, boss kills)
- **Level up** → gain max HP and unlock/upgrade one ability
- Gear drops from combat, treasure caches, and boss encounters
- **New heroes** discovered via hero scrolls (treasure or boss drops) — added to roster permanently

### Recovery Timers
When a hero is knocked out during combat they cannot participate in runs until recovered.

- **Base recovery time:** `1 hour × hero level` (real-time)
- Recovery begins immediately on return to The Inn
- Guild upgrade tree can reduce recovery time
- Roster upgrade tree can increase available hero slots (enabling more parallel runs)

---

## Base & Guild

### Personal Upgrade Trees
Purchased from the Sage NPC in The Inn using gold and materials dropped during runs.

**Roster Tree**
- More hero slots (start: 4, max: 12)
- Faster recovery timers (up to 50% reduction)
- Higher hero level cap (start: 10, unlock up to 20)

**Dungeon Tree**
- Unlock additional biomes
- Reveal structure locations on biome minimap
- Improve loot table quality across all biomes
- Increase max dive depth (encounter scaling distance)

**Combat Tree**
- Passive party-wide buffs active during all runs: energy regen, crit bonuses, status resistance
- Unlocked nodes apply to all heroes regardless of class

### Guild (Optional)
Players can create or join a guild. Guild members share:
- A separate guild upgrade queue (same three trees, separate progress)
- Co-op run access — guild members can join the same biome dive
- Guild upgrades benefit all members

Co-op runs: any guild member can join an active run in progress via the biome door in their Inn instance. Colyseus multiplayer handles synchronization.

Guild upgrade tree benefits (separate from personal trees, apply to all members):
- Faster recovery timers for all guild members (up to 25% reduction, stacks with Roster tree)
- Larger co-op party size (default 2, up to 4)
- Shared loot quality bonus during co-op runs

---

## Extraction

Players extract from a biome by either:
1. **Walking back** to the spawn teleport pad (natural consequence of overextending)
2. **Using a recall item** — consumable drop found in treasure caches and merchants. Instant return to The Inn from anywhere on the map.

There is no penalty for extracting. There is no mandatory objective. Players push as far as feels safe.

---

## Screens

### Existing (no changes required)
| Screen | Role |
|--------|------|
| `ConnectScreen` | Auth / server connection |
| `ExploreScreen` | Drives both The Inn and biome maps |
| `CombatScreen` | Tactical combat |

### New
| Screen | Role |
|--------|------|
| `EndOfEncounterScreen` | Shown after each combat resolves: XP gained per hero, gear dropped, heroes knocked out, option to continue exploring or extract |

---

## Technical Integration Notes

- **ExploreRoom** handles both The Inn and biome maps. The Inn is a curated hand-authored map; biome maps are procedurally generated. Room state distinguishes map type.
- **Biome map generation** uses seed + distance-based difficulty scaling. Chunk-based or large fixed grid (resolved during implementation planning).
- **Minimap** is part of ExploreScreen HUD for biome maps. Reveals explored tiles; structure locations revealed via Dungeon upgrade tree node.
- **CombatRoom** is entered from any map when an encounter triggers. On combat end, players return to the ExploreRoom they came from.
- **SimpleQuest HUD** (`packages/simplequest-hud`) wraps the `<simple-quest>` web component. Rendered in the CombatScreen and accessible in The Inn via the Innkeeper/Blacksmith NPCs.
- **Hero persistence** stored in Supabase (linked to player account via existing JWT auth). Recovery timers are server-side timestamps.
- **Recall items** are inventory consumables tracked in hero/player state.
- **Guild state** is a Supabase record shared across guild member accounts.
