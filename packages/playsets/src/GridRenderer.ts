export interface GridTile {
  x: number
  y: number
}

export function chunkSeededHash(seed: bigint, x: number, y: number): number {
  const combined = seed + BigInt(x * 73856093) + BigInt(y * 19349663)
  return Number(combined % BigInt(0x7FFFFFFF))
}

export function getGridTiles(
  originX: number,
  originY: number,
  width: number,
  height: number,
): GridTile[] {
  const tiles: GridTile[] = []
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      tiles.push({ x: originX + dx, y: originY + dy })
    }
  }
  return tiles
}
