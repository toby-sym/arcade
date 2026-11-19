export const TILES_ROWS = 4
export const TILES_COLUMNS = 5
export const TILES_TILE_COUNT = TILES_ROWS * TILES_COLUMNS
export const TILES_PAIR_COUNT = TILES_TILE_COUNT / 2

export const TILE_PATTERNS = [
  { id: 'star', symbol: '✦' },
  { id: 'moon', symbol: '☾' },
  { id: 'diamond', symbol: '◆' },
  { id: 'triangle', symbol: '▲' },
  { id: 'circle', symbol: '●' },
  { id: 'flower', symbol: '✿' },
  { id: 'hexagon', symbol: '⬟' },
  { id: 'wave', symbol: '⌁' },
  { id: 'square', symbol: '■' },
  { id: 'spark', symbol: '✧' },
] as const

export type TilePatternId = typeof TILE_PATTERNS[number]['id']

export interface TilesPuzzle {
  date: string
  patterns: TilePatternId[]
  solutionPairs: number[][]
}

export interface TilesProgress {
  date: string
  clearedIndices: number[]
  moves: number
  mistakes: number
}

export interface TilesState extends TilesPuzzle {
  clearedIndices: number[]
  selectedIndex: number | null
  moves: number
  mistakes: number
  phase: 'playing' | 'complete'
  message: string
}

export type TilesAction =
  | { type: 'select'; index: number }
  | { type: 'restart' }

export function createTilesPuzzle(date: string): TilesPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const random = createRandom(date)
  const remaining = new Set(Array.from({ length: TILES_TILE_COUNT }, (_, index) => index))
  const solutionPairs: number[][] = []

  while (remaining.size > 0) {
    const free = [...remaining].filter((index) => isFreeInRemainingBoard(index, remaining))
    if (free.length < 2) throw new Error('The daily Tiles board has no available pair.')
    shuffle(free, random)
    const pair = [free[0]!, free[1]!]
    solutionPairs.push(pair)
    remaining.delete(pair[0]!)
    remaining.delete(pair[1]!)
  }

  const pairPatterns = [...TILE_PATTERNS]
  shuffle(pairPatterns, random)
  const patterns = Array<TilePatternId>(TILES_TILE_COUNT)
  solutionPairs.forEach(([first, second], pairIndex) => {
    const pattern = pairPatterns[pairIndex]!.id
    patterns[first!] = pattern
    patterns[second!] = pattern
  })

  return { date, patterns, solutionPairs }
}

export function createTilesState(date: string, progress?: TilesProgress | null): TilesState {
  const puzzle = createTilesPuzzle(date)
  let clearedIndices: number[] = []
  let moves = 0
  let mistakes = 0

  if (progress?.date === date && validTilesProgress(progress)) {
    clearedIndices = [...progress.clearedIndices]
    moves = progress.moves
    mistakes = progress.mistakes
  }

  const phase = clearedIndices.length === TILES_TILE_COUNT ? 'complete' : 'playing'
  return {
    ...puzzle,
    clearedIndices,
    selectedIndex: null,
    moves,
    mistakes,
    phase,
    message: phase === 'complete'
      ? `All ten pairs cleared in ${moves} ${moves === 1 ? 'move' : 'moves'}. A fresh board arrives tomorrow.`
      : clearedIndices.length > 0
        ? 'Progress restored. Clear the remaining free pairs.'
        : 'Match the visible patterns. A tile is free when one horizontal side is open.',
  }
}

export function tilesReducer(state: TilesState, action: TilesAction): TilesState {
  if (state.phase === 'complete') return state

  if (action.type === 'restart') {
    if (state.clearedIndices.length === 0 && state.selectedIndex === null && state.moves === 0 && state.mistakes === 0) return state
    return {
      ...state,
      clearedIndices: [],
      selectedIndex: null,
      moves: 0,
      mistakes: 0,
      message: 'Board reset. Find the free matching pairs.',
    }
  }

  const index = action.index
  if (!Number.isSafeInteger(index) || index < 0 || index >= TILES_TILE_COUNT) return state
  if (!isTilesIndexFree(index, state.clearedIndices)) return state

  if (state.selectedIndex === null) {
    return { ...state, selectedIndex: index, message: `Tile ${index + 1} selected. Choose the matching free pattern.` }
  }
  if (state.selectedIndex === index) {
    return { ...state, selectedIndex: null, message: 'Selection cleared. Choose a free pair.' }
  }

  const moves = state.moves + 1
  if (state.patterns[state.selectedIndex] !== state.patterns[index]) {
    const mistakes = state.mistakes + 1
    return {
      ...state,
      selectedIndex: null,
      moves,
      mistakes,
      message: `Those patterns do not match. ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'} so far.`,
    }
  }

  const clearedIndices = [...state.clearedIndices, state.selectedIndex, index]
  const phase = clearedIndices.length === TILES_TILE_COUNT ? 'complete' : 'playing'
  return {
    ...state,
    clearedIndices,
    selectedIndex: null,
    moves,
    phase,
    message: phase === 'complete'
      ? `All ten pairs cleared in ${moves} ${moves === 1 ? 'move' : 'moves'}. A fresh board arrives tomorrow.`
      : 'Pair cleared. Find another free match.',
  }
}

export function isTilesIndexFree(index: number, clearedIndices: number[]): boolean {
  if (!Number.isSafeInteger(index) || index < 0 || index >= TILES_TILE_COUNT) return false
  if (clearedIndices.includes(index)) return false
  const column = index % TILES_COLUMNS
  const cleared = new Set(clearedIndices)
  const leftOpen = column === 0 || cleared.has(index - 1)
  const rightOpen = column === TILES_COLUMNS - 1 || cleared.has(index + 1)
  return leftOpen || rightOpen
}

export function tilesProgress(state: TilesState): TilesProgress {
  return { date: state.date, clearedIndices: [...state.clearedIndices], moves: state.moves, mistakes: state.mistakes }
}

export function validTilesProgress(value: unknown): value is TilesProgress {
  if (!isRecord(value) || !isUtcDateKey(value.date) || !Array.isArray(value.clearedIndices)) return false
  if (value.clearedIndices.length > TILES_TILE_COUNT || value.clearedIndices.length % 2 !== 0) return false
  if (!value.clearedIndices.every((index) => Number.isSafeInteger(index) && index >= 0 && index < TILES_TILE_COUNT)) return false
  if (new Set(value.clearedIndices).size !== value.clearedIndices.length) return false
  if (typeof value.moves !== 'number' || typeof value.mistakes !== 'number') return false
  if (!Number.isSafeInteger(value.moves) || !Number.isSafeInteger(value.mistakes) || value.mistakes < 0 || value.moves !== value.clearedIndices.length / 2 + value.mistakes || value.moves > 9999) return false

  const patterns = createTilesPuzzle(value.date).patterns
  const counts = new Map<TilePatternId, number>()
  for (const index of value.clearedIndices as number[]) {
    const pattern = patterns[index]!
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1)
  }
  return [...counts.values()].every((count) => count === 2)
}

function isFreeInRemainingBoard(index: number, remaining: Set<number>): boolean {
  const column = index % TILES_COLUMNS
  return column === 0 || !remaining.has(index - 1) || column === TILES_COLUMNS - 1 || !remaining.has(index + 1)
}

function createRandom(seed: string): () => number {
  let state = 2166136261
  for (const character of seed) {
    state ^= character.charCodeAt(0)
    state = Math.imul(state, 16777619)
  }
  if (state === 0) state = 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!]
  }
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
