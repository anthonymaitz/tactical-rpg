import type { SceneChunkMeta, SceneData } from 'shared-types'

export type PlacedChunk = {
  chunk: SceneChunkMeta
  originX: number // world-space top-left corner
  originY: number
}

/** mulberry32 seeded PRNG — returns a function that yields numbers in [0, 1) */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}

/** Fisher-Yates shuffle using the provided PRNG */
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Returns true if two bounding boxes (with padding) overlap */
function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  pad: number,
): boolean {
  return (
    ax - pad < bx + bw + pad &&
    ax + aw + pad > bx - pad &&
    ay - pad < by + bh + pad &&
    ay + ah + pad > by - pad
  )
}

const WORLD_EDGE_MARGIN = 8
const CHUNK_PADDING = 5
const MAX_CHUNKS = 30
const MAX_PLACEMENT_ATTEMPTS = 50

export function assembleWorld(
  chunks: SceneChunkMeta[],
  worldWidth: number,
  worldHeight: number,
  seed: number,
): { walls: number[][]; sceneData: SceneData; placedChunks: PlacedChunk[] } {
  // Build empty walls grid (0 = walkable)
  const walls: number[][] = Array.from({ length: worldHeight }, () =>
    new Array<number>(worldWidth).fill(0),
  )

  const rand = mulberry32(seed)

  // Shuffle and limit to MAX_CHUNKS
  const candidates = shuffle(chunks, rand).slice(0, MAX_CHUNKS)

  const placed: PlacedChunk[] = []

  for (const chunk of candidates) {
    const cw = chunk.width
    const ch = chunk.height

    // World bounds allowing edge margin
    const minX = WORLD_EDGE_MARGIN
    const maxX = worldWidth - WORLD_EDGE_MARGIN - cw
    const minY = WORLD_EDGE_MARGIN
    const maxY = worldHeight - WORLD_EDGE_MARGIN - ch

    if (maxX < minX || maxY < minY) continue // chunk too large for world

    let found = false
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const ox = minX + Math.floor(rand() * (maxX - minX + 1))
      const oy = minY + Math.floor(rand() * (maxY - minY + 1))

      // Check overlap with all already-placed chunks
      const collides = placed.some((p) =>
        overlaps(ox, oy, cw, ch, p.originX, p.originY, p.chunk.width, p.chunk.height, CHUNK_PADDING),
      )

      if (!collides) {
        placed.push({ chunk, originX: ox, originY: oy })
        found = true
        break
      }
    }

    if (!found) continue // skip chunk if no room found
  }

  // Stamp wall tiles from each placed chunk onto the world grid
  for (const { chunk, originX, originY } of placed) {
    for (const building of chunk.sceneData.buildings) {
      const wx = originX + building.col
      const wy = originY + building.row
      if (wx >= 0 && wx < worldWidth && wy >= 0 && wy < worldHeight) {
        walls[wy]![wx] = 1
      }
    }
  }

  // Merge all chunk tokens (offset by origin) into one SceneData
  const allTokens = placed.flatMap(({ chunk, originX, originY }) =>
    chunk.sceneData.tokens.map((t) => ({
      ...t,
      id: `${chunk.slug}__${t.id}`,
      col: t.col + originX,
      row: t.row + originY,
    })),
  )

  const allBuildings = placed.flatMap(({ chunk, originX, originY }) =>
    chunk.sceneData.buildings.map((b) => ({
      ...b,
      instanceId: b.instanceId ?? `${chunk.slug}__${b.col},${b.row}`,
      col: b.col + originX,
      row: b.row + originY,
    })),
  )

  const allProps = placed.flatMap(({ chunk, originX, originY }) =>
    chunk.sceneData.props.map((p) => ({
      ...p,
      id: `${chunk.slug}__${p.id}`,
      col: p.col + originX,
      row: p.row + originY,
    })),
  )

  const sceneData: SceneData = {
    buildings: allBuildings,
    layers: [{ id: 1, background: 'grass' }],
    props: allProps,
    tokens: allTokens,
    weather: 'sunny',
  }

  return { walls, sceneData, placedChunks: placed }
}
