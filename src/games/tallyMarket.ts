export const TALLY_MARKET_TILE_VALUES = Array.from({ length: 12 }, (_, index) => index + 1)
export const TALLY_MARKET_NAMES = ['Produce', 'Bakery', 'Pantry'] as const
export const TALLY_MARKET_CAPACITY = 4

export type TallyMarketPhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface TallyMarketTile {
  id: number
  value: number
}

export interface TallyMarketPlacement {
  tileId: number
  market: number
}

export interface TallyMarketPuzzle {
  date: string
  tiles: TallyMarketTile[]
  targets: number[]
}

export interface TallyMarketProgress {
  date: string
  placements: TallyMarketPlacement[]
  actions: number
}

export interface TallyMarketState extends TallyMarketPuzzle {
  phase: TallyMarketPhase
  placements: TallyMarketPlacement[]
  selectedTileId: number | null
  actions: number
  message: string
}

export function tallyMarketPuzzleForDate(date: string): TallyMarketPuzzle {
  if (!isValidDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const random = createRandom(date)

  let arrangedTiles: number[] = []
  let targets: number[] = []
  let foundBoard = false
  for (let attempt = 0; attempt < 100; attempt += 1) {
    arrangedTiles = shuffle([...TALLY_MARKET_TILE_VALUES], random)
    targets = [
      arrangedTiles[0]! + arrangedTiles[1]!,
      arrangedTiles[2]! + arrangedTiles[3]!,
      arrangedTiles[4]! + arrangedTiles[5]! + arrangedTiles[6]!,
    ]
    if (targets.every((target) => target > 12) && new Set(targets).size === targets.length) {
      foundBoard = true
      break
    }
  }

  if (!foundBoard) {
    arrangedTiles = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    targets = [23, 19, 21]
  }

  const tiles = shuffle([...TALLY_MARKET_TILE_VALUES], random).map((value) => ({ id: value - 1, value }))
  return { date, tiles, targets }
}

export function createTallyMarketState(date: string, progress?: TallyMarketProgress | null): TallyMarketState {
  const puzzle = tallyMarketPuzzleForDate(date)
  const placements = progress?.date === date && validTallyMarketProgress(progress)
    ? progress.placements.map((placement) => ({ ...placement }))
    : []
  const actions = progress?.date === date && validTallyMarketProgress(progress) ? progress.actions : 0
  const phase: TallyMarketPhase = isTallyMarketSolved(puzzle, placements)
    ? 'complete'
    : placements.length > 0 || actions > 0 ? 'playing' : 'ready'

  return {
    ...puzzle,
    phase,
    placements,
    selectedTileId: null,
    actions,
    message: phase === 'complete'
      ? `All three totals reached in ${actions} actions. A fresh board arrives tomorrow.`
      : placements.length > 0
        ? 'Today’s basket picks are back. Keep filling the targets.'
        : 'Choose a number tile, then add it to one of the three market baskets.',
  }
}

export function startTallyMarket(state: TallyMarketState): TallyMarketState {
  return state.phase === 'ready'
    ? { ...state, phase: 'playing', message: 'Choose a tile, then choose the basket it belongs in.' }
    : state
}

export function selectTallyMarketTile(state: TallyMarketState, tileId: number): TallyMarketState {
  if (state.phase !== 'playing' || !Number.isInteger(tileId) || !state.tiles.some((tile) => tile.id === tileId)) return state
  if (state.placements.some((placement) => placement.tileId === tileId)) return state
  const selectedTileId = state.selectedTileId === tileId ? null : tileId
  return {
    ...state,
    selectedTileId,
    message: selectedTileId === null
      ? 'Tile deselected.'
      : `Number ${tileId + 1} selected. Choose a basket without passing its target.`,
  }
}

export function placeTallyMarketTile(state: TallyMarketState, market: number): TallyMarketState {
  if (state.phase !== 'playing' || state.selectedTileId === null || !Number.isInteger(market) || market < 0 || market >= TALLY_MARKET_NAMES.length) return state
  const tile = state.tiles.find((candidate) => candidate.id === state.selectedTileId)
  if (!tile || state.placements.some((placement) => placement.tileId === tile.id)) return state
  const totals = tallyMarketTotals(state, state.placements)
  if (totals[market]! >= state.targets[market]!) return { ...state, message: `${TALLY_MARKET_NAMES[market]} has already reached its target.` }
  if (totals[market]! + tile.value > state.targets[market]!) {
    return { ...state, message: `${tile.value} would take ${TALLY_MARKET_NAMES[market]} past ${state.targets[market]}. Choose another basket.` }
  }

  const placements = [...state.placements, { tileId: tile.id, market }]
  const actions = state.actions + 1
  const phase: TallyMarketPhase = isTallyMarketSolved(state, placements) ? 'complete' : 'playing'
  return {
    ...state,
    phase,
    placements,
    selectedTileId: null,
    actions,
    message: phase === 'complete'
      ? `All three totals reached in ${actions} actions. A fresh board arrives tomorrow.`
      : `${TALLY_MARKET_NAMES[market]} is now ${totals[market]! + tile.value} of ${state.targets[market]}.`,
  }
}

export function undoTallyMarket(state: TallyMarketState): TallyMarketState {
  if (state.phase !== 'playing' || state.placements.length === 0) return state
  const placements = state.placements.slice(0, -1)
  return {
    ...state,
    placements,
    selectedTileId: null,
    actions: state.actions + 1,
    message: 'Last tile returned to the rack. The undo counts as an action.',
  }
}

export function restartTallyMarket(state: TallyMarketState): TallyMarketState {
  if (state.phase !== 'playing' || state.placements.length === 0) return state
  return {
    ...state,
    placements: [],
    selectedTileId: null,
    actions: state.actions + 1,
    message: 'Baskets cleared. The restart counts as an action; plan a tighter route.',
  }
}

export function playAgainTallyMarket(state: TallyMarketState): TallyMarketState {
  return { ...createTallyMarketState(state.date), phase: 'playing', message: 'New attempt. Reach all three totals in as few actions as you can.' }
}

export function pauseTallyMarket(state: TallyMarketState): TallyMarketState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', selectedTileId: null, message: 'Puzzle paused. Your basket totals are held.' } : state
}

export function resumeTallyMarket(state: TallyMarketState): TallyMarketState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Choose a tile, then choose the basket it belongs in.' } : state
}

export function tallyMarketTotals(puzzle: Pick<TallyMarketPuzzle, 'tiles'>, placements: readonly TallyMarketPlacement[]): number[] {
  const totals = Array<number>(TALLY_MARKET_NAMES.length).fill(0)
  for (const placement of placements) {
    const tile = puzzle.tiles.find((candidate) => candidate.id === placement.tileId)
    if (!tile || !Number.isInteger(placement.market) || placement.market < 0 || placement.market >= totals.length) continue
    totals[placement.market]! += tile.value
  }
  return totals
}

export function isTallyMarketSolved(puzzle: Pick<TallyMarketPuzzle, 'targets' | 'tiles'>, placements: readonly TallyMarketPlacement[]): boolean {
  const totals = tallyMarketTotals(puzzle, placements)
  return totals.length === puzzle.targets.length && totals.every((total, index) => total === puzzle.targets[index])
}

export function tallyMarketProgress(state: TallyMarketState): TallyMarketProgress {
  return { date: state.date, placements: state.placements.map((placement) => ({ ...placement })), actions: state.actions }
}

export function validTallyMarketProgress(value: unknown): value is TallyMarketProgress {
  if (!isRecord(value) || !isValidDateKey(value.date) || !Array.isArray(value.placements)
    || typeof value.actions !== 'number' || !Number.isSafeInteger(value.actions) || value.actions < value.placements.length || value.actions > 5000) return false
  const puzzle = tallyMarketPuzzleForDate(value.date)
  const usedTiles = new Set<number>()
  const totals = Array<number>(TALLY_MARKET_NAMES.length).fill(0)

  for (const entry of value.placements) {
    if (!isRecord(entry) || typeof entry.tileId !== 'number' || !Number.isInteger(entry.tileId) || entry.tileId < 0 || entry.tileId >= TALLY_MARKET_TILE_VALUES.length
      || typeof entry.market !== 'number' || !Number.isInteger(entry.market) || entry.market < 0 || entry.market >= TALLY_MARKET_NAMES.length || usedTiles.has(entry.tileId)) return false
    const tile = puzzle.tiles.find((candidate) => candidate.id === entry.tileId)
    if (!tile || totals[entry.market]! >= puzzle.targets[entry.market]! || totals[entry.market]! + tile.value > puzzle.targets[entry.market]!) return false
    usedTiles.add(entry.tileId)
    totals[entry.market]! += tile.value
  }

  return true
}

function createRandom(date: string): () => number {
  let seed = 0x811c9dc5
  for (const character of date) {
    seed ^= character.charCodeAt(0)
    seed = Math.imul(seed, 0x01000193)
  }
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), seed | 1)
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61)
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(values: T[], random: () => number): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[values[index], values[other]] = [values[other]!, values[index]!]
  }
  return values
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
