export const MINI_CROSSWORD_SIDE = 5
export const MINI_CROSSWORD_START_DATE = '2021-01-01'

export type CrosswordDirection = 'across' | 'down'
export type CrosswordPhase = 'playing' | 'complete'

export interface CrosswordClue {
  number: number
  clue: string
  answer: string
  cells: number[]
}

export interface MiniCrosswordPuzzle {
  date: string
  solution: string[]
  across: CrosswordClue[]
  down: CrosswordClue[]
}

export interface MiniCrosswordProgress {
  date: string
  board: string[]
  hintsUsed: number
  hintedCells: number[]
}

export interface MiniCrosswordState extends MiniCrosswordPuzzle {
  board: string[]
  selectedCell: number
  direction: CrosswordDirection
  hintsUsed: number
  hintedCells: number[]
  phase: CrosswordPhase
  message: string
}

export type MiniCrosswordAction =
  | { type: 'select'; index: number }
  | { type: 'toggleDirection' }
  | { type: 'letter'; letter: string }
  | { type: 'backspace' }
  | { type: 'hint' }
  | { type: 'reset' }

interface PuzzleDefinition {
  rows: [string, string, string, string, string]
  across: [string, string, string, string, string]
  down: [string, string, string, string, string]
}

const DAILY_PUZZLES: PuzzleDefinition[] = [
  {
    rows: ['ACT##', 'RAISE', 'EMBED', 'APING', '##ATE'],
    across: ['Do, as a role', 'Lift upward', 'Set firmly in', 'Imitating', 'Dined'],
    down: ['A region', 'Outdoor lodging spot', 'Shinbone', 'Dispatched', 'Outer boundary'],
  },
  {
    rows: ['ARM##', 'LOOSE', 'SONAR', 'OMEGA', '##YES'],
    across: ['Upper limb', 'Not tight', 'Echo-location system', 'Final Greek letter', 'Affirmative'],
    down: ['In addition', 'Space in a home', 'Cash or currency', 'Wise person or herb', 'Historical periods'],
  },
  {
    rows: ['ATE##', 'CHART', 'RATIO', 'ENEMA', '##RED'],
    across: ['Had a meal', 'Graph or map', 'Comparison of quantities', 'Flushing treatment', 'Stoplight color'],
    down: ['Plot of land, unit', 'Comparative word', 'One who dines', 'Frost coating', 'Warty amphibian'],
  },
  {
    rows: ['BUS##', 'APING', 'SONAR', 'ENEMA', '##WEB'],
    across: ['City transport', 'Copying', 'Echo-location system', 'Flushing treatment', 'Network of pages'],
    down: ['Foundation', 'On top of', 'Tendon', 'Identify', 'Snatch'],
  },
  {
    rows: ['CAN##', 'ALARM', 'MOVIE', 'PEACE', '##LET'],
    across: ['Tin container', 'Warning signal', 'Film', 'Calm', 'Allow'],
    down: ['Outdoor lodging spot', 'Succulent plant', 'Of the navy', 'Grain', 'Encounter'],
  },
  {
    rows: ['COD##', 'ABACK', 'SEDAN', 'HYDRO', '##YET'],
    across: ['Fish on a menu', 'Taken by surprise', 'Four-door car', 'Relating to waterpower', 'Even so'],
    down: ['Money', 'Follow the rules', 'Father', 'Look after', 'Tangle'],
  },
  {
    rows: ['COP##', 'ABACK', 'SEDAN', 'HYDRO', '##YET'],
    across: ['Police officer', 'Taken by surprise', 'Four-door car', 'Relating to waterpower', 'Even so'],
    down: ['Money', 'Follow the rules', 'Rice-growing field', 'Look after', 'Tangle'],
  },
  {
    rows: ['FUR##', 'INEPT', 'TIBIA', 'STUNK', '##SEE'],
    across: ['Animal’s winter coat', 'Not skilled', 'Shinbone', 'Smelled awful', 'Perceive'],
    down: ['Is the right size', 'Single measure', 'Picture-word puzzle', 'Long for', 'Grab'],
  },
  {
    rows: ['HAT##', 'ALIBI', 'NOMAD', 'GEESE', '##SEA'],
    across: ['Headwear', 'Excuse', 'Wandering person', 'Honking flock', 'Large body of water'],
    down: ['Suspend', 'Succulent plant', 'Multiplies or periods', 'Foundation', 'Concept'],
  },
  {
    rows: ['SAT##', 'ALIBI', 'NOMAD', 'GEESE', '##SEA'],
    across: ['Took a seat', 'Excuse', 'Wandering person', 'Honking flock', 'Large body of water'],
    down: ['Performed vocally', 'Succulent plant', 'Multiplies or periods', 'Foundation', 'Concept'],
  },
  {
    rows: ['SAT##', 'WRING', 'ACTOR', 'PHASE', '##NEW'],
    across: ['Took a seat', 'Twist', 'Performer', 'Stage', 'Recent'],
    down: ['Exchange', 'Curved structure', 'Giant', 'Sniff around', 'Got bigger'],
  },
]

export const MINI_CROSSWORD_DAILY_COUNT = DAILY_PUZZLES.length
const DAY_MS = 86_400_000
const GAME_EPOCH = Date.parse(`${MINI_CROSSWORD_START_DATE}T00:00:00.000Z`)
const CELL_COUNT = MINI_CROSSWORD_SIDE * MINI_CROSSWORD_SIDE
const BLOCK_CELLS = new Set([3, 4, 20, 21])
const OPEN_CELLS = Array.from({ length: CELL_COUNT }, (_, index) => index).filter((index) => !BLOCK_CELLS.has(index))

export function createMiniCrosswordPuzzle(date: string): MiniCrosswordPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const days = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  const definition = DAILY_PUZZLES[((days % DAILY_PUZZLES.length) + DAILY_PUZZLES.length) % DAILY_PUZZLES.length]!
  const solution = definition.rows.flatMap((row) => [...row])
  const across = extractEntries(solution, 'across').map((slot, index) => ({
    ...slot,
    clue: definition.across[index]!,
  }))
  const down = extractEntries(solution, 'down').map((slot, index) => ({
    ...slot,
    clue: definition.down[index]!,
  }))

  if (across.length !== 5 || down.length !== 5 || [...across, ...down].some((entry) => !entry.clue || !entry.answer)) {
    throw new Error('Mini crossword puzzle does not match its clue layout.')
  }
  if (new Set([...across, ...down].map((entry) => entry.answer)).size !== across.length + down.length) {
    throw new Error('Mini crossword answers must be independent across and down.')
  }

  return { date, solution, across, down }
}

export function createMiniCrosswordState(date: string, progress?: MiniCrosswordProgress | null): MiniCrosswordState {
  const puzzle = createMiniCrosswordPuzzle(date)
  const board: string[] = puzzle.solution.map((cell) => cell === '#' ? '#' : '')
  if (progress?.date === date && validMiniCrosswordProgress(progress)) {
    progress.board.forEach((letter, index) => {
      if (letter !== '#') board[index] = letter
    })
  }
  const hintedCells = progress?.date === date && validMiniCrosswordProgress(progress)
    ? [...new Set(progress.hintedCells.filter((index) => board[index] === puzzle.solution[index]))]
    : []
  const hintsUsed = progress?.date === date && validMiniCrosswordProgress(progress)
    ? progress.hintsUsed
    : 0
  const phase = OPEN_CELLS.every((index) => board[index] === puzzle.solution[index]) ? 'complete' : 'playing'
  return {
    ...puzzle,
    board,
    selectedCell: Math.max(0, OPEN_CELLS.find((index) => !board[index]) ?? OPEN_CELLS[0]!),
    direction: 'across',
    hintsUsed,
    hintedCells,
    phase,
    message: phase === 'complete' ? 'Puzzle solved. A fresh grid arrives tomorrow.' : 'Fill each short answer across and down.',
  }
}

export function miniCrosswordProgress(state: MiniCrosswordState): MiniCrosswordProgress {
  return { date: state.date, board: [...state.board], hintsUsed: state.hintsUsed, hintedCells: [...state.hintedCells] }
}

export function miniCrosswordEntry(state: MiniCrosswordState): CrosswordClue {
  const entries = state.direction === 'across' ? state.across : state.down
  return entries.find((entry) => entry.cells.includes(state.selectedCell)) ?? entries[0]!
}

export function isMiniCrosswordEntrySolved(state: Pick<MiniCrosswordState, 'board'>, entry: CrosswordClue): boolean {
  return entry.cells.every((cell, position) => state.board[cell] === entry.answer[position])
}

export function miniCrosswordReducer(state: MiniCrosswordState, action: MiniCrosswordAction): MiniCrosswordState {
  if (action.type === 'reset') {
    if (state.phase === 'complete') return state
    return {
      ...state,
      board: state.solution.map((cell) => cell === '#' ? '#' : ''),
      selectedCell: OPEN_CELLS[0]!,
      direction: 'across',
      hintsUsed: 0,
      hintedCells: [],
      message: 'Entries cleared. The daily puzzle is ready.',
    }
  }
  if (state.phase === 'complete') return state

  if (action.type === 'toggleDirection') return { ...state, direction: state.direction === 'across' ? 'down' : 'across' }

  if (action.type === 'select') {
    if (!Number.isSafeInteger(action.index) || action.index < 0 || action.index >= CELL_COUNT || state.solution[action.index] === '#') return state
    return action.index === state.selectedCell ? state : { ...state, selectedCell: action.index }
  }

  if (action.type === 'backspace') {
    const entry = miniCrosswordEntry(state)
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
    const entry = miniCrosswordEntry(state)
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
      message: phase === 'complete' ? 'Puzzle solved with a hint. A fresh grid arrives tomorrow.' : 'Hint: one square revealed.',
    }
  }

  if (!/^[A-Z]$/.test(action.letter)) return state
  if (state.hintedCells.includes(state.selectedCell)) return { ...state, message: 'Hinted squares are locked.' }
  const entry = miniCrosswordEntry(state)
  const board = [...state.board]
  board[state.selectedCell] = action.letter
  const nextCell = nextCellInEntry(entry, state.selectedCell)
  const phase = OPEN_CELLS.every((cell) => board[cell] === state.solution[cell]) ? 'complete' : 'playing'
  return {
    ...state,
    board,
    selectedCell: nextCell,
    phase,
    message: phase === 'complete' ? 'Puzzle solved. A fresh grid arrives tomorrow.' : 'Letter entered.',
  }
}

export function validMiniCrosswordProgress(value: unknown): value is MiniCrosswordProgress {
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

function extractEntries(solution: string[], direction: CrosswordDirection): Array<Omit<CrosswordClue, 'clue'>> {
  const entries: Array<Omit<CrosswordClue, 'clue'>> = []
  let number = 0
  for (let row = 0; row < MINI_CROSSWORD_SIDE; row += 1) {
    for (let column = 0; column < MINI_CROSSWORD_SIDE; column += 1) {
      const index = row * MINI_CROSSWORD_SIDE + column
      if (solution[index] === '#') continue
      const startsAcross = column === 0 || solution[index - 1] === '#'
      const startsDown = row === 0 || solution[index - MINI_CROSSWORD_SIDE] === '#'
      if (!startsAcross && !startsDown) continue
      number += 1
      const startsEntry = direction === 'across' ? startsAcross : startsDown
      if (!startsEntry) continue
      const cells: number[] = []
      let cursorRow = row
      let cursorColumn = column
      while (cursorRow < MINI_CROSSWORD_SIDE && cursorColumn < MINI_CROSSWORD_SIDE) {
        const cursor = cursorRow * MINI_CROSSWORD_SIDE + cursorColumn
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

function nextCellInEntry(entry: CrosswordClue, current: number): number {
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
