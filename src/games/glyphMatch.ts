export const GLYPH_MATCH_ROWS = 4
export const GLYPH_MATCH_COLUMNS = 4
export const GLYPH_MATCH_TILE_COUNT = GLYPH_MATCH_ROWS * GLYPH_MATCH_COLUMNS
export const GLYPH_MATCH_PAIR_COUNT = GLYPH_MATCH_TILE_COUNT / 2

export const GLYPH_SYMBOLS = ['✦', '☾', '◆', '▲', '●', '✿', '⬟', '⌁'] as const

export interface GlyphMatchPuzzle {
  date: string
  glyphs: string[]
}

export interface GlyphMatchProgress {
  date: string
  matchedIndices: number[]
  moves: number
}

export interface GlyphMatchState extends GlyphMatchPuzzle {
  matchedIndices: number[]
  revealedIndices: number[]
  moves: number
  phase: 'playing' | 'complete'
  mismatch: boolean
  message: string
}

export type GlyphMatchAction =
  | { type: 'select'; index: number }
  | { type: 'hide-mismatch' }
  | { type: 'restart' }

export function createGlyphMatchPuzzle(date: string): GlyphMatchPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const random = createRandom(date)
  const glyphs = [...GLYPH_SYMBOLS, ...GLYPH_SYMBOLS]
  shuffle(glyphs, random)
  return { date, glyphs }
}

export function createGlyphMatchState(date: string, progress?: GlyphMatchProgress | null): GlyphMatchState {
  const puzzle = createGlyphMatchPuzzle(date)
  const matchedIndices: number[] = []
  let moves = 0

  if (progress?.date === date && validGlyphMatchProgress(progress)) {
    const grouped = new Map<string, number[]>()
    for (const index of progress.matchedIndices) {
      const glyph = puzzle.glyphs[index]!
      grouped.set(glyph, [...(grouped.get(glyph) ?? []), index])
    }
    if ([...grouped.values()].every((indices) => indices.length === 2)) {
      matchedIndices.push(...progress.matchedIndices)
      moves = progress.moves
    }
  }

  const phase = matchedIndices.length === GLYPH_MATCH_TILE_COUNT ? 'complete' : 'playing'
  return {
    ...puzzle,
    matchedIndices,
    revealedIndices: [],
    moves,
    phase,
    mismatch: false,
    message: phase === 'complete'
      ? 'All eight pairs found. A fresh board arrives tomorrow.'
      : matchedIndices.length > 0
        ? 'Progress restored. Find the remaining pairs.'
        : 'Turn over two tiles. Find all eight pairs.',
  }
}

export function glyphMatchReducer(state: GlyphMatchState, action: GlyphMatchAction): GlyphMatchState {
  if (state.phase === 'complete') return state

  if (action.type === 'hide-mismatch') {
    if (!state.mismatch) return state
    return { ...state, revealedIndices: [], mismatch: false, message: 'No match. Try another pair.' }
  }

  if (action.type === 'restart') {
    if (state.matchedIndices.length === 0 && state.moves === 0 && state.revealedIndices.length === 0) return state
    return { ...state, matchedIndices: [], revealedIndices: [], moves: 0, mismatch: false, message: 'Board reset. Find eight new pairs.' }
  }

  const index = action.index
  if (!Number.isInteger(index) || index < 0 || index >= state.glyphs.length) return state
  if (state.mismatch || state.matchedIndices.includes(index) || state.revealedIndices.includes(index)) return state

  if (state.revealedIndices.length === 0) {
    return { ...state, revealedIndices: [index], message: `Tile ${index + 1} turned. Find its match.` }
  }

  const firstIndex = state.revealedIndices[0]!
  const moves = state.moves + 1
  if (state.glyphs[firstIndex] === state.glyphs[index]) {
    const matchedIndices = [...state.matchedIndices, firstIndex, index]
    const phase = matchedIndices.length === GLYPH_MATCH_TILE_COUNT ? 'complete' : 'playing'
    return {
      ...state,
      matchedIndices,
      revealedIndices: [],
      moves,
      phase,
      message: phase === 'complete'
        ? `Board complete in ${moves} ${moves === 1 ? 'turn' : 'turns'}. A fresh puzzle arrives tomorrow.`
        : 'Pair found. Keep going.',
    }
  }

  return {
    ...state,
    revealedIndices: [firstIndex, index],
    moves,
    mismatch: true,
    message: 'Those tiles do not match.',
  }
}

export function glyphMatchProgress(state: GlyphMatchState): GlyphMatchProgress {
  return { date: state.date, matchedIndices: [...state.matchedIndices], moves: state.moves }
}

export function validGlyphMatchProgress(value: unknown): value is GlyphMatchProgress {
  if (!isRecord(value) || !isUtcDateKey(value.date) || !Array.isArray(value.matchedIndices)) return false
  if (value.matchedIndices.length > GLYPH_MATCH_TILE_COUNT || value.matchedIndices.length % 2 !== 0) return false
  if (!Number.isSafeInteger(value.moves) || (value.moves as number) < value.matchedIndices.length / 2 || (value.moves as number) > 9999) return false

  const indices = value.matchedIndices
  if (indices.some((index) => !Number.isSafeInteger(index) || (index as number) < 0 || (index as number) >= GLYPH_MATCH_TILE_COUNT)) return false
  if (new Set(indices).size !== indices.length) return false

  const glyphs = createGlyphMatchPuzzle(value.date).glyphs
  const counts = new Map<string, number>()
  for (const index of indices as number[]) counts.set(glyphs[index]!, (counts.get(glyphs[index]!) ?? 0) + 1)
  return [...counts.values()].every((count) => count === 2)
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
