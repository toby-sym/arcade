export const PIPS_ROWS = 3
export const PIPS_COLUMNS = 4
export const PIPS_CELL_COUNT = PIPS_ROWS * PIPS_COLUMNS
export const PIPS_DOMINO_COUNT = PIPS_CELL_COUNT / 2

export type PipsOrientation = 'horizontal' | 'vertical'
export type PipsRuleKind = 'sum' | 'equal' | 'different' | 'less' | 'greater'
export type PipsPhase = 'playing' | 'complete'

export interface PipsDomino {
  id: number
  values: [number, number]
}

export interface PipsPlacement {
  dominoId: number
  firstCell: number
  orientation: PipsOrientation
  flipped: boolean
}

export interface PipsRegion {
  id: number
  cells: number[]
  rule: PipsRuleKind
  target: number | null
}

export interface PipsPuzzle {
  date: string
  dominoes: PipsDomino[]
  regions: PipsRegion[]
  regionByCell: number[]
  solution: PipsPlacement[]
}

export interface PipsProgress {
  date: string
  placements: PipsPlacement[]
  undos: number
}

export interface PipsRegionStatus {
  filled: number
  total: number
  valid: boolean
  satisfied: boolean
}

export interface PipsState extends PipsPuzzle {
  placements: PipsPlacement[]
  selectedDominoId: number | null
  orientation: PipsOrientation
  flipped: boolean
  undos: number
  phase: PipsPhase
  message: string
}

export type PipsAction =
  | { type: 'select'; dominoId: number }
  | { type: 'rotate' }
  | { type: 'flip' }
  | { type: 'place'; cell: number }
  | { type: 'undo' }
  | { type: 'restart' }

const REGION_LAYOUT = [
  0, 0, 1, 1,
  0, 2, 1, 3,
  2, 2, 3, 3,
]

const DOUBLE_SIX_SET: [number, number][] = Array.from({ length: 28 }, (_, index) => {
  let value = 0
  let offset = index
  while (offset >= 7 - value) {
    offset -= 7 - value
    value += 1
  }
  return [value, value + offset]
})

export function createPipsPuzzle(date: string): PipsPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const random = createRandom(date)
  const solutionCells = createTiling(random)
  const availableDominoes = [...DOUBLE_SIX_SET]
  shuffle(availableDominoes, random)
  const dominoes = solutionCells.map((_, id) => ({ id, values: availableDominoes[id]! as [number, number] }))
  const solution = solutionCells.map(([firstCell, secondCell], dominoId): PipsPlacement => ({
    dominoId,
    firstCell,
    orientation: secondCell === firstCell + 1 ? 'horizontal' : 'vertical',
    flipped: false,
  }))
  const cellValues = pipsCellValues({ dominoes } as Pick<PipsPuzzle, 'dominoes'>, solution)
  const regions = Array.from({ length: 4 }, (_, id) => {
    const cells = REGION_LAYOUT.flatMap((regionId, cell) => regionId === id ? [cell] : [])
    const values = cells.map((cell) => cellValues[cell]!)
    const total = values.reduce((sum, value) => sum + value, 0)
    const options: PipsRuleKind[] = ['sum', 'sum', 'sum', 'less', 'greater', 'equal', 'different']
    const requestedRule = options[Math.floor(random() * options.length)]!
    const rule = requestedRule === 'equal' && new Set(values).size !== 1
      ? 'sum'
      : requestedRule === 'different' && new Set(values).size !== values.length
        ? 'sum'
        : requestedRule === 'greater' && total === 0
          ? 'sum'
          : requestedRule
    const target = rule === 'equal'
      ? values[0]!
      : rule === 'sum'
        ? total
        : rule === 'less'
          ? total + 1
          : rule === 'greater'
            ? total - 1
            : null
    return { id, cells, rule, target }
  })

  return { date, dominoes, regions, regionByCell: [...REGION_LAYOUT], solution }
}

export function createPipsState(date: string, progress?: PipsProgress | null): PipsState {
  return createPipsStateForPuzzle(createPipsPuzzle(date), progress)
}

export function createPipsStateForPuzzle(puzzle: PipsPuzzle, progress?: PipsProgress | null): PipsState {
  const placements: PipsPlacement[] = []
  let undos = 0
  if (progress?.date === puzzle.date && validPipsProgress(progress)) {
    for (const placement of progress.placements) {
      if (!canPlacePipsDomino(puzzle, placements, placement)) break
      placements.push({ ...placement })
    }
    undos = progress.undos
  }

  const phase = isPipsSolved(puzzle, placements) ? 'complete' : 'playing'
  return {
    ...puzzle,
    placements,
    selectedDominoId: null,
    orientation: 'horizontal',
    flipped: false,
    undos,
    phase,
    message: phase === 'complete'
      ? 'Every region fits. A new Pips board arrives tomorrow.'
      : placements.length > 0
        ? 'Progress restored. Keep fitting dominoes to the region rules.'
        : 'Fit every domino into the grid. Each colored region has its own rule.',
  }
}

export function pipsReducer(state: PipsState, action: PipsAction): PipsState {
  if (state.phase === 'complete') return state

  if (action.type === 'select') {
    const domino = state.dominoes.find((candidate) => candidate.id === action.dominoId)
    if (!domino || state.placements.some((placement) => placement.dominoId === domino.id)) return state
    return { ...state, selectedDominoId: domino.id, orientation: 'horizontal', flipped: false, message: `Domino ${domino.id + 1} selected. Choose an empty cell.` }
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
    if (state.selectedDominoId === null) return { ...state, message: 'Select a domino from the tray before choosing a cell.' }
    const placement: PipsPlacement = {
      dominoId: state.selectedDominoId,
      firstCell: action.cell,
      orientation: state.orientation,
      flipped: state.flipped,
    }
    if (!canPlacePipsDomino(state, state.placements, placement)) {
      return { ...state, message: 'That domino needs two empty neighboring cells inside the grid.' }
    }
    const placements = [...state.placements, placement]
    const phase = isPipsSolved(state, placements) ? 'complete' : 'playing'
    const full = placements.length === state.dominoes.length
    return {
      ...state,
      placements,
      selectedDominoId: null,
      orientation: 'horizontal',
      flipped: false,
      phase,
      message: phase === 'complete'
        ? `Every region fits in ${state.undos} ${state.undos === 1 ? 'undo' : 'undos'}. A new board arrives tomorrow.`
        : full
          ? 'All dominoes are down, but a region rule is off. Undo a tile and try another fit.'
          : 'Domino placed. Check the region totals as you fill the board.',
    }
  }
  if (action.type === 'undo') {
    if (state.placements.length === 0) return state
    return { ...state, placements: state.placements.slice(0, -1), selectedDominoId: null, undos: state.undos + 1, message: 'Last domino returned to the tray.' }
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

export function pipsProgress(state: PipsState): PipsProgress {
  return { date: state.date, placements: state.placements.map((placement) => ({ ...placement })), undos: state.undos }
}

export function pipsPlacementCells(placement: PipsPlacement): [number, number] | null {
  if (!Number.isSafeInteger(placement.firstCell) || placement.firstCell < 0 || placement.firstCell >= PIPS_CELL_COUNT) return null
  if (placement.orientation === 'horizontal') {
    if (placement.firstCell % PIPS_COLUMNS === PIPS_COLUMNS - 1) return null
    return [placement.firstCell, placement.firstCell + 1]
  }
  if (placement.orientation === 'vertical') {
    if (placement.firstCell >= PIPS_CELL_COUNT - PIPS_COLUMNS) return null
    return [placement.firstCell, placement.firstCell + PIPS_COLUMNS]
  }
  return null
}

export function canPlacePipsDomino(puzzle: Pick<PipsPuzzle, 'dominoes'>, placements: PipsPlacement[], placement: PipsPlacement): boolean {
  if (!puzzle.dominoes.some((domino) => domino.id === placement.dominoId)) return false
  if (placements.some((candidate) => candidate.dominoId === placement.dominoId)) return false
  const cells = pipsPlacementCells(placement)
  if (!cells) return false
  return !placements.some((candidate) => {
    const occupied = pipsPlacementCells(candidate)
    return occupied && cells.some((cell) => occupied.includes(cell))
  })
}

export function pipsCellValues(puzzle: Pick<PipsPuzzle, 'dominoes'>, placements: PipsPlacement[]): (number | null)[] {
  const cells: (number | null)[] = Array(PIPS_CELL_COUNT).fill(null)
  for (const placement of placements) {
    const domino = puzzle.dominoes.find((candidate) => candidate.id === placement.dominoId)
    const occupied = pipsPlacementCells(placement)
    if (!domino || !occupied) continue
    const values = placement.flipped ? [domino.values[1], domino.values[0]] : domino.values
    occupied.forEach((cell, index) => {
      if (cells[cell] === null) cells[cell] = values[index]!
    })
  }
  return cells
}

export function pipsRegionStatuses(puzzle: PipsPuzzle, placements: PipsPlacement[]): PipsRegionStatus[] {
  const cells = pipsCellValues(puzzle, placements)
  return puzzle.regions.map((region) => {
    const values = region.cells.map((cell) => cells[cell]).filter((value): value is number => value !== null)
    const total = values.reduce((sum, value) => sum + value, 0)
    const filled = values.length
    const complete = filled === region.cells.length
    const unique = new Set(values).size === values.length
    const equal = new Set(values).size <= 1
    const valid = region.rule === 'sum'
      ? total <= region.target!
      : region.rule === 'equal'
        ? equal
        : region.rule === 'different'
          ? unique
          : region.rule === 'less'
            ? total < region.target!
            : complete ? total > region.target! : total + 6 * (region.cells.length - filled) > region.target!
    const satisfied = complete && (region.rule === 'sum'
      ? total === region.target
      : region.rule === 'equal'
        ? equal && (region.target === null || values[0] === region.target)
        : region.rule === 'different'
          ? unique
          : region.rule === 'less'
            ? total < region.target!
            : total > region.target!)
    return { filled, total, valid, satisfied }
  })
}

export function isPipsSolved(puzzle: PipsPuzzle, placements: PipsPlacement[]): boolean {
  if (placements.length !== puzzle.dominoes.length) return false
  const used = new Set<number>()
  const occupied: PipsPlacement[] = []
  for (const placement of placements) {
    if (!canPlacePipsDomino(puzzle, occupied, placement)) return false
    const cells = pipsPlacementCells(placement)
    if (!cells) return false
    occupied.push(placement)
    cells.forEach((cell) => used.add(cell))
  }
  return used.size === PIPS_CELL_COUNT && pipsRegionStatuses(puzzle, placements).every((region) => region.satisfied)
}

export function validPipsProgress(value: unknown): value is PipsProgress {
  if (!isRecord(value) || !isUtcDateKey(value.date) || !Array.isArray(value.placements)) return false
  if (value.placements.length > PIPS_DOMINO_COUNT || !Number.isSafeInteger(value.undos) || (value.undos as number) < 0 || (value.undos as number) > 9999) return false
  const seenDominoes = new Set<number>()
  const seenCells = new Set<number>()
  for (const candidate of value.placements) {
    if (!isRecord(candidate)
      || !Number.isSafeInteger(candidate.dominoId)
      || (candidate.dominoId as number) < 0
      || (candidate.dominoId as number) >= PIPS_DOMINO_COUNT
      || !Number.isSafeInteger(candidate.firstCell)
      || (candidate.firstCell as number) < 0
      || (candidate.firstCell as number) >= PIPS_CELL_COUNT
      || (candidate.orientation !== 'horizontal' && candidate.orientation !== 'vertical')
      || typeof candidate.flipped !== 'boolean') return false
    const placement = candidate as unknown as PipsPlacement
    const cells = pipsPlacementCells(placement)
    if (!cells || seenDominoes.has(placement.dominoId) || cells.some((cell) => seenCells.has(cell))) return false
    seenDominoes.add(placement.dominoId)
    cells.forEach((cell) => seenCells.add(cell))
  }
  return true
}

function createTiling(random: () => number): [number, number][] {
  const remaining = new Set(Array.from({ length: PIPS_CELL_COUNT }, (_, index) => index))
  const pairs: [number, number][] = []
  const fill = (): boolean => {
    if (remaining.size === 0) return true
    const first = Math.min(...remaining)
    const row = Math.floor(first / PIPS_COLUMNS)
    const column = first % PIPS_COLUMNS
    const candidates = [column < PIPS_COLUMNS - 1 ? first + 1 : -1, row < PIPS_ROWS - 1 ? first + PIPS_COLUMNS : -1]
      .filter((cell) => cell >= 0 && remaining.has(cell))
    shuffle(candidates, random)
    for (const second of candidates) {
      remaining.delete(first)
      remaining.delete(second)
      pairs.push([first, second])
      if (fill()) return true
      pairs.pop()
      remaining.add(first)
      remaining.add(second)
    }
    return false
  }
  if (!fill()) throw new Error('Unable to tile the daily Pips board.')
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
