export const SUDOKU_SIDE = 9
export const SUDOKU_CELL_COUNT = SUDOKU_SIDE * SUDOKU_SIDE
export const SUDOKU_START_DATE = '2021-01-01'

export type SudokuPhase = 'playing' | 'complete'

export interface SudokuPuzzle {
  date: string
  initialBoard: string[]
  solution: string[]
  givens: boolean[]
}

export interface SudokuProgress {
  date: string
  board: string[]
  hintsUsed: number
  hintedCells: number[]
}

export interface SudokuState extends SudokuPuzzle {
  board: string[]
  selectedCell: number
  hintsUsed: number
  hintedCells: number[]
  phase: SudokuPhase
  message: string
}

export type SudokuAction =
  | { type: 'select'; index: number }
  | { type: 'input'; value: string }
  | { type: 'erase' }
  | { type: 'hint' }
  | { type: 'reset' }

const BASE_PUZZLE = [
  '12..567..',
  '456.89..3',
  '.8..2....',
  '2...6789.',
  '.6.891.3.',
  '.9123...7',
  '....7..1.',
  '6..91.345',
  '..234..78',
]
const DAY_MS = 86_400_000
const GAME_EPOCH = Date.parse(`${SUDOKU_START_DATE}T00:00:00.000Z`)
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function createSudokuPuzzle(date: string): SudokuPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const days = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  const seed = seedForDate(date)
  const rowOrder = shuffledSudokuAxis(seed ^ Math.imul(days + 1, 31))
  const columnOrder = shuffledSudokuAxis(seed ^ Math.imul(days + 1, 127))
  const symbols = stableShuffle(DIGITS, seed ^ 0x9e3779b9)
  const transpose = (seed & 1) === 1
  const solution: string[] = []
  const initialBoard: string[] = []
  const givens: boolean[] = []

  for (let row = 0; row < SUDOKU_SIDE; row += 1) {
    for (let column = 0; column < SUDOKU_SIDE; column += 1) {
      const sourceRow = rowOrder[transpose ? column : row]!
      const sourceColumn = columnOrder[transpose ? row : column]!
      const baseValue = String((sourceRow * 3 + Math.floor(sourceRow / 3) + sourceColumn) % SUDOKU_SIDE + 1)
      const solutionValue = symbols[Number(baseValue) - 1]!
      const sourceClue = BASE_PUZZLE[sourceRow]![sourceColumn]!
      const isGiven = sourceClue !== '.'
      const index = row * SUDOKU_SIDE + column
      solution[index] = solutionValue
      initialBoard[index] = isGiven ? solutionValue : ''
      givens[index] = isGiven
    }
  }

  return { date, initialBoard, solution, givens }
}

export function createSudokuState(date: string, progress?: SudokuProgress | null): SudokuState {
  const puzzle = createSudokuPuzzle(date)
  const board = [...puzzle.initialBoard]
  if (progress?.date === date && Array.isArray(progress.board)) {
    for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
      const value = progress.board[index]
      if (!puzzle.givens[index] && (value === '' || isDigit(value))) board[index] = value
    }
  }
  const hintedCells = progress?.date === date && Array.isArray(progress.hintedCells)
    ? [...new Set(progress.hintedCells.filter((index) => Number.isSafeInteger(index) && index >= 0 && index < SUDOKU_CELL_COUNT && !puzzle.givens[index] && board[index] === puzzle.solution[index]))]
    : []
  const hintsUsed = progress?.date === date && Number.isSafeInteger(progress.hintsUsed)
    ? Math.max(hintedCells.length, Math.min(40, progress.hintsUsed))
    : 0
  const phase = board.every((value, index) => value === puzzle.solution[index]) ? 'complete' : 'playing'

  return {
    ...puzzle,
    board,
    selectedCell: Math.max(0, board.findIndex((value, index) => !puzzle.givens[index] && value === '')),
    hintsUsed,
    hintedCells,
    phase,
    message: phase === 'complete'
      ? 'Puzzle solved. A fresh grid arrives tomorrow.'
      : 'Fill each row, column, and 3×3 box with the numbers 1 to 9.',
  }
}

export function sudokuProgress(state: SudokuState): SudokuProgress {
  return {
    date: state.date,
    board: [...state.board],
    hintsUsed: state.hintsUsed,
    hintedCells: [...state.hintedCells],
  }
}

export function conflictingSudokuCells(board: string[]): Set<number> {
  const conflicts = new Set<number>()
  const markDuplicates = (indexes: number[]) => {
    const seen = new Map<string, number[]>()
    for (const index of indexes) {
      const value = board[index]
      if (!value) continue
      const positions = seen.get(value) ?? []
      positions.push(index)
      seen.set(value, positions)
    }
    for (const positions of seen.values()) {
      if (positions.length > 1) positions.forEach((index) => conflicts.add(index))
    }
  }

  for (let row = 0; row < SUDOKU_SIDE; row += 1) {
    markDuplicates(Array.from({ length: SUDOKU_SIDE }, (_, column) => row * SUDOKU_SIDE + column))
  }
  for (let column = 0; column < SUDOKU_SIDE; column += 1) {
    markDuplicates(Array.from({ length: SUDOKU_SIDE }, (_, row) => row * SUDOKU_SIDE + column))
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      markDuplicates(Array.from({ length: 9 }, (_, offset) => (boxRow * 3 + Math.floor(offset / 3)) * SUDOKU_SIDE + boxColumn * 3 + offset % 3))
    }
  }
  return conflicts
}

export function sudokuReducer(state: SudokuState, action: SudokuAction): SudokuState {
  if (action.type === 'reset') {
    if (state.phase === 'complete') return state
    return {
      ...state,
      board: [...state.initialBoard],
      selectedCell: state.initialBoard.findIndex((value, index) => !state.givens[index] && value === ''),
      hintsUsed: 0,
      hintedCells: [],
      message: 'Entries cleared. The original puzzle is ready.',
    }
  }
  if (state.phase === 'complete') return state

  if (action.type === 'select') {
    if (!Number.isSafeInteger(action.index) || action.index < 0 || action.index >= SUDOKU_CELL_COUNT) return state
    return action.index === state.selectedCell ? state : { ...state, selectedCell: action.index }
  }

  if (action.type === 'erase') {
    if (state.givens[state.selectedCell] || state.hintedCells.includes(state.selectedCell) || !state.board[state.selectedCell]) return state
    const board = [...state.board]
    board[state.selectedCell] = ''
    return { ...state, board, message: 'Cell cleared.' }
  }

  if (action.type === 'hint') {
    const selectedIsOpen = !state.givens[state.selectedCell] && !state.hintedCells.includes(state.selectedCell) && !state.board[state.selectedCell]
    const index = selectedIsOpen
      ? state.selectedCell
      : state.board.findIndex((value, cell) => !value && !state.givens[cell] && !state.hintedCells.includes(cell))
    if (index < 0) return state
    const board = [...state.board]
    board[index] = state.solution[index]!
    const hintedCells = [...state.hintedCells, index]
    const phase = board.every((value, cell) => value === state.solution[cell]) ? 'complete' : 'playing'
    return {
      ...state,
      board,
      selectedCell: index,
      hintsUsed: state.hintsUsed + 1,
      hintedCells,
      phase,
      message: phase === 'complete' ? 'Puzzle solved with a hint. A fresh grid arrives tomorrow.' : 'Hint: one empty cell revealed.',
    }
  }

  if (!isDigit(action.value)) return state
  if (state.givens[state.selectedCell] || state.hintedCells.includes(state.selectedCell)) {
    return { ...state, message: 'Given cells and hinted numbers are locked.' }
  }
  if (state.board[state.selectedCell] === action.value) return state
  const board = [...state.board]
  board[state.selectedCell] = action.value
  const phase = board.every((value, index) => value === state.solution[index]) ? 'complete' : 'playing'
  const message = phase === 'complete'
    ? 'Puzzle solved. A fresh grid arrives tomorrow.'
    : conflictingSudokuCells(board).size > 0
      ? 'Duplicate numbers are highlighted in their row, column, or box.'
      : board.every(Boolean)
        ? 'The grid is full, but some entries do not match the solution.'
        : 'Number entered.'
  return { ...state, board, phase, message }
}

export function validSudokuProgress(value: unknown): value is SudokuProgress {
  return isRecord(value)
    && isUtcDateKey(value.date)
    && Array.isArray(value.board)
    && value.board.length === SUDOKU_CELL_COUNT
    && value.board.every((cell) => cell === '' || isDigit(cell))
    && Number.isSafeInteger(value.hintsUsed)
    && (value.hintsUsed as number) >= 0
    && (value.hintsUsed as number) <= 40
    && Array.isArray(value.hintedCells)
    && value.hintedCells.length <= 40
    && value.hintedCells.length === value.hintsUsed
    && new Set(value.hintedCells).size === value.hintedCells.length
    && value.hintedCells.every((index) => Number.isSafeInteger(index) && (index as number) >= 0 && (index as number) < SUDOKU_CELL_COUNT)
}

function shuffledSudokuAxis(seed: number): number[] {
  const groups = stableShuffle([0, 1, 2], seed)
  return groups.flatMap((group, groupIndex) => stableShuffle([0, 1, 2], seed + (groupIndex + 1) * 104729).map((offset) => group * 3 + offset))
}

function stableShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items]
  let random = seed || 1
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0
    const swapWith = random % (index + 1)
    ;[shuffled[index], shuffled[swapWith]] = [shuffled[swapWith]!, shuffled[index]!]
  }
  return shuffled
}

function seedForDate(date: string): number {
  let seed = 2166136261
  for (const character of date) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  return seed || 1
}

function isDigit(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]$/.test(value)
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
