export const DOMINO_ROWS = 3
export const DOMINO_COLUMNS = 4
export const DOMINO_COUNT = (DOMINO_ROWS * DOMINO_COLUMNS) / 2

export type DominoOrientation = 'horizontal' | 'vertical'
export type DominoPhase = 'playing' | 'complete'

export interface DominoTile {
  id: number
  values: [number, number]
}

export interface DominoPlacement {
  dominoId: number
  firstCell: number
  orientation: DominoOrientation
  flipped: boolean
}

export interface DominoLogicPuzzle {
  date: string
  dominoes: DominoTile[]
  rowTargets: number[]
  columnTargets: number[]
}

export interface DominoLogicProgress {
  date: string
  placements: DominoPlacement[]
  undos: number
}

export interface DominoLogicState extends DominoLogicPuzzle {
  placements: DominoPlacement[]
  selectedDominoId: number | null
  orientation: DominoOrientation
  flipped: boolean
  undos: number
  phase: DominoPhase
  message: string
}

export interface DominoTotals {
  cells: (number | null)[]
  rowSums: number[]
  columnSums: number[]
}

export type DominoLogicAction =
  | { type: 'select'; dominoId: number }
  | { type: 'rotate' }
  | { type: 'flip' }
  | { type: 'place'; cell: number }
  | { type: 'undo' }
  | { type: 'restart' }

export function createDominoLogicPuzzle(date: string): DominoLogicPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const random = createRandom(date)
  const solutionCells = createTiling(random)
  const dominoes: DominoTile[] = []
  const rowTargets = Array<number>(DOMINO_ROWS).fill(0)
  const columnTargets = Array<number>(DOMINO_COLUMNS).fill(0)

  solutionCells.forEach(([firstCell, secondCell], id) => {
    const values: [number, number] = [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)]
    dominoes.push({ id, values })
    rowTargets[Math.floor(firstCell / DOMINO_COLUMNS)]! += values[0]
    columnTargets[firstCell % DOMINO_COLUMNS]! += values[0]
    rowTargets[Math.floor(secondCell / DOMINO_COLUMNS)]! += values[1]
    columnTargets[secondCell % DOMINO_COLUMNS]! += values[1]
  })

  shuffle(dominoes, random)
  return { date, dominoes, rowTargets, columnTargets }
}

export function createDominoLogicState(date: string, progress?: DominoLogicProgress | null): DominoLogicState {
  return createDominoLogicStateForPuzzle(createDominoLogicPuzzle(date), progress)
}

export function createDominoLogicStateForPuzzle(puzzle: DominoLogicPuzzle, progress?: DominoLogicProgress | null): DominoLogicState {
  const placements: DominoPlacement[] = []
  let undos = 0

  if (progress?.date === puzzle.date && validDominoLogicProgress(progress)) {
    for (const placement of progress.placements) {
      if (!canPlaceDomino(puzzle, placements, placement)) break
      placements.push({ ...placement })
    }
    undos = progress.undos
  }

  const phase = isDominoLogicSolved(puzzle, placements) ? 'complete' : 'playing'
  return {
    ...puzzle,
    placements,
    selectedDominoId: null,
    orientation: 'horizontal',
    flipped: false,
    undos,
    phase,
    message: phase === 'complete'
      ? 'Grid complete. A fresh set arrives tomorrow.'
      : placements.length > 0
        ? 'Progress restored. Keep fitting tiles to the totals.'
        : 'Select a domino, then choose an empty cell for its left or top half.',
  }
}

export function dominoLogicReducer(state: DominoLogicState, action: DominoLogicAction): DominoLogicState {
  if (state.phase === 'complete') return state

  if (action.type === 'select') {
    const domino = state.dominoes.find((candidate) => candidate.id === action.dominoId)
    if (!domino || state.placements.some((placement) => placement.dominoId === domino.id)) return state
    return { ...state, selectedDominoId: domino.id, orientation: 'horizontal', flipped: false, message: `Domino ${domino.id + 1} selected. Choose its first cell.` }
  }

  if (action.type === 'rotate') {
    if (state.selectedDominoId === null) return state
    const orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal'
    return { ...state, orientation, message: `Domino turned ${orientation}.` }
  }

  if (action.type === 'flip') {
    if (state.selectedDominoId === null) return state
    return { ...state, flipped: !state.flipped, message: `Domino ends ${state.flipped ? 'restored' : 'swapped'}.` }
  }

  if (action.type === 'place') {
    if (state.selectedDominoId === null) return state
    const placement: DominoPlacement = {
      dominoId: state.selectedDominoId,
      firstCell: action.cell,
      orientation: state.orientation,
      flipped: state.flipped,
    }
    if (!canPlaceDomino(state, state.placements, placement)) {
      return { ...state, message: 'That domino needs two empty neighboring cells inside the grid.' }
    }

    const placements = [...state.placements, placement]
    const phase = isDominoLogicSolved(state, placements) ? 'complete' : 'playing'
    const allPlaced = placements.length === state.dominoes.length
    return {
      ...state,
      placements,
      selectedDominoId: null,
      orientation: 'horizontal',
      flipped: false,
      phase,
      message: phase === 'complete'
        ? `Grid complete in ${state.undos} ${state.undos === 1 ? 'undo' : 'undos'}. A fresh set arrives tomorrow.`
        : allPlaced
          ? 'Every tile is down, but a total is off. Undo a tile and try another fit.'
          : 'Domino placed. Keep matching the row and column totals.',
    }
  }

  if (action.type === 'undo') {
    if (state.placements.length === 0) return state
    const placements = state.placements.slice(0, -1)
    return {
      ...state,
      placements,
      selectedDominoId: null,
      undos: state.undos + 1,
      message: 'Last domino returned to the tray.',
    }
  }

  if (state.placements.length === 0) return state
  return {
    ...state,
    placements: [],
    selectedDominoId: null,
    orientation: 'horizontal',
    flipped: false,
    undos: state.undos + 1,
    message: 'Grid cleared. Start again with the same daily puzzle.',
  }
}

export function dominoLogicProgress(state: DominoLogicState): DominoLogicProgress {
  return { date: state.date, placements: state.placements.map((placement) => ({ ...placement })), undos: state.undos }
}

export function dominoTotals(puzzle: DominoLogicPuzzle, placements: DominoPlacement[]): DominoTotals {
  const cells: (number | null)[] = Array(DOMINO_ROWS * DOMINO_COLUMNS).fill(null)
  const rowSums = Array<number>(DOMINO_ROWS).fill(0)
  const columnSums = Array<number>(DOMINO_COLUMNS).fill(0)

  for (const placement of placements) {
    const tile = puzzle.dominoes.find((candidate) => candidate.id === placement.dominoId)
    const occupiedCells = placementCells(placement)
    if (!tile || !occupiedCells) continue
    const values = placement.flipped ? [tile.values[1], tile.values[0]] : tile.values
    occupiedCells.forEach((cell, index) => {
      if (cells[cell] !== null) return
      const value = values[index]!
      cells[cell] = value
      rowSums[Math.floor(cell / DOMINO_COLUMNS)]! += value
      columnSums[cell % DOMINO_COLUMNS]! += value
    })
  }
  return { cells, rowSums, columnSums }
}

export function isDominoLogicSolved(puzzle: DominoLogicPuzzle, placements: DominoPlacement[]): boolean {
  if (placements.length !== puzzle.dominoes.length) return false
  const totals = dominoTotals(puzzle, placements)
  return totals.cells.every((value) => value !== null)
    && totals.rowSums.every((sum, index) => sum === puzzle.rowTargets[index])
    && totals.columnSums.every((sum, index) => sum === puzzle.columnTargets[index])
}

export function validDominoLogicProgress(value: unknown): value is DominoLogicProgress {
  if (!isRecord(value) || !isUtcDateKey(value.date) || !Array.isArray(value.placements)) return false
  if (value.placements.length > DOMINO_COUNT || !Number.isSafeInteger(value.undos) || (value.undos as number) < 0 || (value.undos as number) > 9999) return false

  const seenDominoes = new Set<number>()
  const seenCells = new Set<number>()
  for (const candidate of value.placements) {
    if (!isRecord(candidate)
      || !Number.isSafeInteger(candidate.dominoId)
      || (candidate.dominoId as number) < 0
      || (candidate.dominoId as number) >= DOMINO_COUNT
      || !Number.isSafeInteger(candidate.firstCell)
      || (candidate.firstCell as number) < 0
      || (candidate.firstCell as number) >= DOMINO_ROWS * DOMINO_COLUMNS
      || (candidate.orientation !== 'horizontal' && candidate.orientation !== 'vertical')
      || typeof candidate.flipped !== 'boolean') return false

    const placement = candidate as unknown as DominoPlacement
    const cells = placementCells(placement)
    if (!cells || seenDominoes.has(placement.dominoId) || cells.some((cell) => seenCells.has(cell))) return false
    seenDominoes.add(placement.dominoId)
    cells.forEach((cell) => seenCells.add(cell))
  }
  return true
}

function canPlaceDomino(puzzle: DominoLogicPuzzle, placements: DominoPlacement[], candidate: DominoPlacement): boolean {
  if (!puzzle.dominoes.some((tile) => tile.id === candidate.dominoId)) return false
  if (placements.some((placement) => placement.dominoId === candidate.dominoId)) return false
  const cells = placementCells(candidate)
  if (!cells) return false
  const occupied = new Set(placements.flatMap((placement) => placementCells(placement) ?? []))
  return cells.every((cell) => !occupied.has(cell))
}

function placementCells(placement: DominoPlacement): [number, number] | null {
  if (!Number.isInteger(placement.firstCell) || placement.firstCell < 0 || placement.firstCell >= DOMINO_ROWS * DOMINO_COLUMNS) return null
  const row = Math.floor(placement.firstCell / DOMINO_COLUMNS)
  const column = placement.firstCell % DOMINO_COLUMNS
  if (placement.orientation === 'horizontal') {
    if (column >= DOMINO_COLUMNS - 1) return null
    return [placement.firstCell, placement.firstCell + 1]
  }
  if (placement.orientation === 'vertical') {
    if (row >= DOMINO_ROWS - 1) return null
    return [placement.firstCell, placement.firstCell + DOMINO_COLUMNS]
  }
  return null
}

function createTiling(random: () => number): [number, number][] {
  const occupied = Array<boolean>(DOMINO_ROWS * DOMINO_COLUMNS).fill(false)
  const pairs: [number, number][] = []

  const search = (): boolean => {
    const firstCell = occupied.findIndex((value) => !value)
    if (firstCell === -1) return true
    const row = Math.floor(firstCell / DOMINO_COLUMNS)
    const column = firstCell % DOMINO_COLUMNS
    const candidates: number[] = []
    if (column < DOMINO_COLUMNS - 1 && !occupied[firstCell + 1]) candidates.push(firstCell + 1)
    if (row < DOMINO_ROWS - 1 && !occupied[firstCell + DOMINO_COLUMNS]) candidates.push(firstCell + DOMINO_COLUMNS)
    shuffle(candidates, random)

    for (const secondCell of candidates) {
      occupied[firstCell] = true
      occupied[secondCell] = true
      pairs.push([firstCell, secondCell])
      if (search()) return true
      pairs.pop()
      occupied[firstCell] = false
      occupied[secondCell] = false
    }
    return false
  }

  if (!search()) throw new Error('Could not tile the domino puzzle grid.')
  return pairs
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
