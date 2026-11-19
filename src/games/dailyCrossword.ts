export const DAILY_CROSSWORD_SIDE = 7
export const DAILY_CROSSWORD_START_DATE = '2026-01-01'

export type DailyCrosswordDirection = 'across' | 'down'
export type DailyCrosswordPhase = 'playing' | 'complete'

export interface DailyCrosswordClue {
  number: number
  clue: string
  answer: string
  cells: number[]
}

export interface DailyCrosswordPuzzle {
  date: string
  solution: string[]
  across: DailyCrosswordClue[]
  down: DailyCrosswordClue[]
}

export interface DailyCrosswordProgress {
  date: string
  board: string[]
  hintsUsed: number
  hintedCells: number[]
}

export interface DailyCrosswordState extends DailyCrosswordPuzzle {
  board: string[]
  selectedCell: number
  direction: DailyCrosswordDirection
  hintsUsed: number
  hintedCells: number[]
  phase: DailyCrosswordPhase
  message: string
}

export type DailyCrosswordAction =
  | { type: 'select'; index: number }
  | { type: 'toggleDirection' }
  | { type: 'letter'; letter: string }
  | { type: 'backspace' }
  | { type: 'hint' }
  | { type: 'reset' }

type Block = [string, string, string]
interface PuzzleDefinition {
  blocks: [Block, Block, Block, Block]
}

const WORD_CLUES: Record<string, string> = {
  ACE: 'Top card in a deck',
  AGE: 'Grow older',
  AGO: 'Before now',
  ALL: 'Everyone or everything',
  ANT: 'Picnic crawler',
  ARE: 'Plural form of “be”',
  ATE: 'Dined',
  BED: 'Place to sleep',
  CAB: 'Taxi',
  CAP: 'Brimmed hat',
  DEN: 'Animal’s hideaway',
  EGG: 'Breakfast shell',
  ERA: 'Historical period',
  HAM: 'Cured deli meat',
  HID: 'Concealed, in the past',
  ICE: 'Frozen water',
  LEG: 'Limb below the hip',
  LOG: 'Fireplace fuel',
  MEN: 'Adult males',
  NEW: 'Not old',
  NOR: 'Neither’s partner',
  ORE: 'Rock with metal in it',
  PEA: 'Small green pod',
  PEN: 'Ink holder',
  PET: 'Household companion',
  POD: 'Pea casing',
  SAT: 'Took a seat',
  SEA: 'Saltwater expanse',
  SIP: 'Small drink',
  SOD: 'Piece of turf',
  SOP: 'Thing dipped to soak up liquid',
  TAP: 'Faucet',
  TEA: 'Steeped drink',
  TEN: 'Number after nine',
  TOE: 'Digit at a shoe’s end',
  TOY: 'Plaything',
  WAS: 'Past-tense “is”',
  WIT: 'Clever humor',
  YAW: 'Turn off course, as a ship',
  YET: 'Still, up to now',
}

const PUZZLE_BLOCKS: Block[] = [
  ['SAT', 'ICE', 'PEN'],
  ['TOY', 'ARE', 'PET'],
  ['ATE', 'NOR', 'TEA'],
  ['CAB', 'AGE', 'POD'],
  ['SAT', 'ICE', 'PEA'],
  ['TOY', 'ERA', 'NEW'],
  ['ATE', 'LOG', 'LEG'],
  ['SAT', 'ORE', 'DEN'],
  ['WIT', 'ACE', 'SEA'],
  ['SAT', 'ORE', 'PEN'],
  ['SAT', 'ORE', 'PEA'],
  ['HID', 'ACE', 'MEN'],
]

const DAILY_PUZZLES: PuzzleDefinition[] = [
  [0, 1, 2, 3], [4, 5, 6, 3], [7, 8, 6, 3], [9, 8, 6, 3], [10, 6, 3, 11],
  [0, 1, 3, 6], [1, 2, 3, 11], [1, 3, 4, 6], [1, 3, 6, 8], [1, 3, 6, 11],
  [2, 3, 9, 11], [3, 5, 6, 8], [3, 5, 6, 11], [3, 6, 9, 11],
].map((indices) => ({ blocks: indices.map((index) => PUZZLE_BLOCKS[index]!) as [Block, Block, Block, Block] }))

export const DAILY_CROSSWORD_COUNT = DAILY_PUZZLES.length
const DAY_MS = 86_400_000
const GAME_EPOCH = Date.parse(`${DAILY_CROSSWORD_START_DATE}T00:00:00.000Z`)
const CELL_COUNT = DAILY_CROSSWORD_SIDE * DAILY_CROSSWORD_SIDE
const BLOCK_CELLS = new Set(Array.from({ length: CELL_COUNT }, (_, index) => index)
  .filter((index) => Math.floor(index / DAILY_CROSSWORD_SIDE) === 3 || index % DAILY_CROSSWORD_SIDE === 3))
const OPEN_CELLS = Array.from({ length: CELL_COUNT }, (_, index) => index).filter((index) => !BLOCK_CELLS.has(index))

export function createDailyCrosswordPuzzle(date: string): DailyCrosswordPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const days = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  const definition = DAILY_PUZZLES[((days % DAILY_PUZZLES.length) + DAILY_PUZZLES.length) % DAILY_PUZZLES.length]!
  const solution = Array<string>(CELL_COUNT).fill('#')
  for (let blockIndex = 0; blockIndex < definition.blocks.length; blockIndex += 1) {
    const originRow = blockIndex >= 2 ? 4 : 0
    const originColumn = blockIndex % 2 === 0 ? 0 : 4
    const block = definition.blocks[blockIndex]!
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        solution[(originRow + row) * DAILY_CROSSWORD_SIDE + originColumn + column] = block[row]![column]!
      }
    }
  }

  const across = extractEntries(solution, 'across').map((entry) => ({ ...entry, clue: WORD_CLUES[entry.answer] ?? '' }))
  const down = extractEntries(solution, 'down').map((entry) => ({ ...entry, clue: WORD_CLUES[entry.answer] ?? '' }))
  const allEntries = [...across, ...down]
  if (across.length !== 12 || down.length !== 12 || allEntries.some((entry) => !entry.clue || !entry.answer)) {
    throw new Error('Daily crossword does not match its clue layout.')
  }
  if (new Set(allEntries.map((entry) => entry.answer)).size !== allEntries.length) {
    throw new Error('Daily crossword answers must be independent across and down.')
  }

  return { date, solution, across, down }
}

export function createDailyCrosswordState(date: string, progress?: DailyCrosswordProgress | null): DailyCrosswordState {
  const puzzle = createDailyCrosswordPuzzle(date)
  const board: string[] = puzzle.solution.map((cell) => cell === '#' ? '#' : '')
  if (progress?.date === date && validDailyCrosswordProgress(progress)) {
    progress.board.forEach((letter, index) => {
      if (letter !== '#') board[index] = letter
    })
  }
  const saved = progress?.date === date && validDailyCrosswordProgress(progress)
  const hintedCells = saved ? [...new Set(progress.hintedCells.filter((index) => board[index] === puzzle.solution[index]))] : []
  const hintsUsed = saved ? progress.hintsUsed : 0
  const phase = OPEN_CELLS.every((index) => board[index] === puzzle.solution[index]) ? 'complete' : 'playing'
  return {
    ...puzzle,
    board,
    selectedCell: Math.max(0, OPEN_CELLS.find((index) => !board[index]) ?? OPEN_CELLS[0]!),
    direction: 'across',
    hintsUsed,
    hintedCells,
    phase,
    message: phase === 'complete' ? 'Puzzle solved. A fresh crossword arrives tomorrow.' : 'Fill the short entries across and down.',
  }
}

export function dailyCrosswordProgress(state: DailyCrosswordState): DailyCrosswordProgress {
  return { date: state.date, board: [...state.board], hintsUsed: state.hintsUsed, hintedCells: [...state.hintedCells] }
}

export function dailyCrosswordEntry(state: Pick<DailyCrosswordState, 'across' | 'down' | 'selectedCell' | 'direction'>): DailyCrosswordClue {
  const entries = state.direction === 'across' ? state.across : state.down
  return entries.find((entry) => entry.cells.includes(state.selectedCell)) ?? entries[0]!
}

export function isDailyCrosswordEntrySolved(state: Pick<DailyCrosswordState, 'board'>, entry: DailyCrosswordClue): boolean {
  return entry.cells.every((cell, position) => state.board[cell] === entry.answer[position])
}

export function dailyCrosswordReducer(state: DailyCrosswordState, action: DailyCrosswordAction): DailyCrosswordState {
  if (action.type === 'reset') {
    if (state.phase === 'complete') return state
    return {
      ...state,
      board: state.solution.map((cell) => cell === '#' ? '#' : ''),
      selectedCell: OPEN_CELLS[0]!,
      direction: 'across',
      hintsUsed: 0,
      hintedCells: [],
      message: 'Entries cleared. The daily crossword is ready.',
    }
  }
  if (state.phase === 'complete') return state
  if (action.type === 'toggleDirection') return { ...state, direction: state.direction === 'across' ? 'down' : 'across' }
  if (action.type === 'select') {
    if (!Number.isSafeInteger(action.index) || action.index < 0 || action.index >= CELL_COUNT || state.solution[action.index] === '#') return state
    return action.index === state.selectedCell ? state : { ...state, selectedCell: action.index }
  }
  if (action.type === 'backspace') {
    const entry = dailyCrosswordEntry(state)
    const position = entry.cells.indexOf(state.selectedCell)
    if (state.hintedCells.includes(state.selectedCell)) return state
    const board = [...state.board]
    if (board[state.selectedCell]) {
      board[state.selectedCell] = ''
      return { ...state, board, message: 'Letter erased.' }
    }
    const previous = entry.cells[Math.max(0, position - 1)]!
    if (previous === state.selectedCell || state.hintedCells.includes(previous)) return { ...state, selectedCell: previous }
    board[previous] = ''
    return { ...state, board, selectedCell: previous, message: 'Previous letter erased.' }
  }
  if (action.type === 'hint') {
    const entry = dailyCrosswordEntry(state)
    const index = entry.cells.find((cell) => !state.board[cell] && !state.hintedCells.includes(cell))
      ?? OPEN_CELLS.find((cell) => !state.board[cell] && !state.hintedCells.includes(cell))
    if (index === undefined) return state
    const board = [...state.board]
    board[index] = state.solution[index]!
    const hintedCells = [...state.hintedCells, index]
    const phase = OPEN_CELLS.every((cell) => board[cell] === state.solution[cell]) ? 'complete' : 'playing'
    return {
      ...state,
      board,
      selectedCell: index,
      hintsUsed: state.hintsUsed + 1,
      hintedCells,
      phase,
      message: phase === 'complete' ? 'Puzzle solved with a hint. A fresh crossword arrives tomorrow.' : 'Hint: one square revealed.',
    }
  }
  if (!/^[A-Z]$/.test(action.letter)) return state
  if (state.hintedCells.includes(state.selectedCell)) return { ...state, message: 'Hinted squares are locked.' }
  const entry = dailyCrosswordEntry(state)
  const board = [...state.board]
  board[state.selectedCell] = action.letter
  const nextCell = nextCellInEntry(entry, state.selectedCell)
  const phase = OPEN_CELLS.every((cell) => board[cell] === state.solution[cell]) ? 'complete' : 'playing'
  return {
    ...state,
    board,
    selectedCell: nextCell,
    phase,
    message: phase === 'complete' ? 'Puzzle solved. A fresh crossword arrives tomorrow.' : 'Letter entered.',
  }
}

export function validDailyCrosswordProgress(value: unknown): value is DailyCrosswordProgress {
  return isRecord(value)
    && isUtcDateKey(value.date)
    && Array.isArray(value.board)
    && value.board.length === CELL_COUNT
    && value.board.every((letter, index) => BLOCK_CELLS.has(index)
      ? letter === '#'
      : letter === '' || (typeof letter === 'string' && /^[A-Z]$/.test(letter)))
    && Number.isSafeInteger(value.hintsUsed)
    && (value.hintsUsed as number) >= 0
    && (value.hintsUsed as number) <= OPEN_CELLS.length
    && Array.isArray(value.hintedCells)
    && value.hintedCells.length <= OPEN_CELLS.length
    && value.hintedCells.length === value.hintsUsed
    && new Set(value.hintedCells).size === value.hintedCells.length
    && value.hintedCells.every((index) => Number.isSafeInteger(index)
      && (index as number) >= 0
      && (index as number) < CELL_COUNT
      && !BLOCK_CELLS.has(index as number))
}

function extractEntries(solution: string[], direction: DailyCrosswordDirection): Array<Omit<DailyCrosswordClue, 'clue'>> {
  const entries: Array<Omit<DailyCrosswordClue, 'clue'>> = []
  let number = 0
  for (let row = 0; row < DAILY_CROSSWORD_SIDE; row += 1) {
    for (let column = 0; column < DAILY_CROSSWORD_SIDE; column += 1) {
      const index = row * DAILY_CROSSWORD_SIDE + column
      if (solution[index] === '#') continue
      const startsAcross = column === 0 || solution[index - 1] === '#'
      const startsDown = row === 0 || solution[index - DAILY_CROSSWORD_SIDE] === '#'
      if (!startsAcross && !startsDown) continue
      number += 1
      const startsEntry = direction === 'across' ? startsAcross : startsDown
      if (!startsEntry) continue
      const cells: number[] = []
      let cursorRow = row
      let cursorColumn = column
      while (cursorRow < DAILY_CROSSWORD_SIDE && cursorColumn < DAILY_CROSSWORD_SIDE) {
        const cursor = cursorRow * DAILY_CROSSWORD_SIDE + cursorColumn
        if (solution[cursor] === '#') break
        cells.push(cursor)
        if (direction === 'across') cursorColumn += 1
        else cursorRow += 1
      }
      entries.push({ number, cells, answer: cells.map((cell) => solution[cell]).join('') })
    }
  }
  return entries
}

function nextCellInEntry(entry: DailyCrosswordClue, current: number): number {
  const position = entry.cells.indexOf(current)
  return entry.cells[Math.min(position + 1, entry.cells.length - 1)]!
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
