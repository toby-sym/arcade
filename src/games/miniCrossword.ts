export const MINI_CROSSWORD_SIDE = 5
export const MINI_CROSSWORD_START_DATE = '2021-01-01'

export type CrosswordDirection = 'across' | 'down'
export type CrosswordPhase = 'playing' | 'complete'

export interface CrosswordClue {
  number: number
  clue: string
  answer: string
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
  answers: [string, string, string, string, string]
  across: [string, string, string, string, string]
  down: [string, string, string, string, string]
}

const DAILY_PUZZLES: PuzzleDefinition[] = [
  {
    answers: ['ACTED', 'CHILI', 'TIGER', 'ELECT', 'DIRTY'],
    across: ['Performed in a play', 'Spicy bean stew', 'Striped big cat', 'Choose by vote', 'Grimy'],
    down: ['Played a role', 'Peppery stew', 'Jungle cat with stripes', 'Select for office', 'Not clean'],
  },
  {
    answers: ['ACTED', 'CHILI', 'TITAN', 'ELATE', 'DINER'],
    across: ['Took a part onstage', 'Spicy bean stew', 'Giant from Greek myth', 'Make very happy', 'Casual restaurant'],
    down: ['Performed in a scene', 'Pepper-based dish', 'Mythic giant', 'Cheer up', 'Place with booths'],
  },
  {
    answers: ['ADAGE', 'DEMON', 'AMBLE', 'GOLEM', 'ENEMY'],
    across: ['Old saying', 'Evil spirit', 'Walk at an easy pace', 'Clay figure from folklore', 'Opponent'],
    down: ['Proverb', 'Fiend', 'Leisurely stroll', 'Folklore figure shaped from clay', 'Rival'],
  },
  {
    answers: ['AGATE', 'GIVEN', 'AVERT', 'TERSE', 'ENTER'],
    across: ['Banded gemstone', 'Handed over', 'Ward off', 'Brief in wording', 'Go inside'],
    down: ['Stone used in jewelry', 'Supplied or granted', 'Turn away', 'Succinct', 'Come in'],
  },
  {
    answers: ['AGREE', 'GLOAT', 'ROUGH', 'EAGLE', 'ETHER'],
    across: ['See eye to eye', 'Take pleasure in a rival’s loss', 'Coarse or uneven', 'Large bird of prey', 'Gas once used as an anesthetic'],
    down: ['Consent', 'Celebrate another’s setback', 'Not smooth', 'Raptor with a hooked beak', 'Old-fashioned anesthetic'],
  },
  {
    answers: ['AHEAD', 'HELLO', 'ELBOW', 'ALONE', 'DOWEL'],
    across: ['In front', 'Friendly greeting', 'Arm joint', 'By oneself', 'Wooden pin'],
    down: ['At the front', '“Hi there!”', 'Nudge with an arm', 'Without company', 'Joinery peg'],
  },
  {
    answers: ['ALPHA', 'LASER', 'PSALM', 'HELLO', 'ARMOR'],
    across: ['First Greek letter', 'Focused beam of light', 'Biblical song or poem', 'Greeting', 'Protective covering'],
    down: ['Beginning of a series', 'Beam used to scan or cut', 'Book of the Bible', '“Hi!”', 'Knight’s protection'],
  },
  {
    answers: ['ALTAR', 'LLAMA', 'TALON', 'AMONG', 'RANGE'],
    across: ['Raised place for worship', 'Andean pack animal', 'Bird’s claw', 'In the middle of', 'Mountain chain'],
    down: ['Place for an offering', 'Woolly South American animal', 'Raptor’s claw', 'Part of a group', 'Set of mountains'],
  },
  {
    answers: ['AMASS', 'MARCH', 'ARBOR', 'SCORE', 'SHREW'],
    across: ['Gather in large amounts', 'Month after February', 'Shady garden structure', 'Points earned in a game', 'Small, sharp-snouted mammal'],
    down: ['Collect a lot of', 'Walk in step', 'Leafy garden shelter', 'Result on a test', 'Mouse-like mammal'],
  },
  {
    answers: ['AMISS', 'MIGHT', 'IGLOO', 'SHOWN', 'STONE'],
    across: ['Not quite right', 'Power or strength', 'Snow house', 'Displayed', 'Small rock'],
    down: ['Out of order', 'Could, perhaps', 'Arctic shelter', 'Put on display', 'Pebble or mineral'],
  },
  {
    answers: ['AMUSE', 'MANIA', 'UNMET', 'SIEGE', 'EATEN'],
    across: ['Entertain', 'Frenzy', 'Not yet encountered', 'Military encirclement', 'Consumed'],
    down: ['Make laugh', 'Obsessive excitement', 'Still waiting to be met', 'Encirclement of a fort', 'Already consumed'],
  },
  {
    answers: ['AMASS', 'MULCH', 'ALGAE', 'SCALE', 'SHEEP'],
    across: ['Accumulate', 'Garden ground cover', 'Green growth in water', 'Weigh on a balance', 'Flock animals'],
    down: ['Gather a large amount', 'Bark or leaf ground cover', 'Simple water plants', 'Fish’s outer covering', 'Woolly farm animals'],
  },
]

export const MINI_CROSSWORD_DAILY_COUNT = DAILY_PUZZLES.length
const DAY_MS = 86_400_000
const GAME_EPOCH = Date.parse(`${MINI_CROSSWORD_START_DATE}T00:00:00.000Z`)
const CELL_COUNT = MINI_CROSSWORD_SIDE * MINI_CROSSWORD_SIDE

export function createMiniCrosswordPuzzle(date: string): MiniCrosswordPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const days = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  const definition = DAILY_PUZZLES[((days % DAILY_PUZZLES.length) + DAILY_PUZZLES.length) % DAILY_PUZZLES.length]!
  const solution = definition.answers.flatMap((answer) => [...answer])
  const downAnswers = Array.from({ length: MINI_CROSSWORD_SIDE }, (_, column) =>
    definition.answers.map((answer) => answer[column]!).join(''))
  if (downAnswers.some((answer, index) => answer !== definition.answers[index])) {
    throw new Error('Mini crossword word-square entries do not intersect correctly.')
  }
  const across = definition.answers.map((answer, index) => ({ number: index + 1, clue: definition.across[index]!, answer }))
  const down = downAnswers.map((answer, index) => ({ number: index + 1, clue: definition.down[index]!, answer }))
  return { date, solution, across, down }
}

export function createMiniCrosswordState(date: string, progress?: MiniCrosswordProgress | null): MiniCrosswordState {
  const puzzle = createMiniCrosswordPuzzle(date)
  const board = Array(CELL_COUNT).fill('') as string[]
  if (progress?.date === date && Array.isArray(progress.board)) {
    progress.board.forEach((letter, index) => {
      if (index < CELL_COUNT && (letter === '' || /^[A-Z]$/.test(letter))) board[index] = letter
    })
  }
  const hintedCells = progress?.date === date && Array.isArray(progress.hintedCells)
    ? [...new Set(progress.hintedCells.filter((index) => Number.isSafeInteger(index) && index >= 0 && index < CELL_COUNT && board[index] === puzzle.solution[index]))]
    : []
  const hintsUsed = progress?.date === date && Number.isSafeInteger(progress.hintsUsed)
    ? Math.max(hintedCells.length, Math.min(CELL_COUNT, progress.hintsUsed))
    : 0
  const phase = board.every((letter, index) => letter === puzzle.solution[index]) ? 'complete' : 'playing'
  return {
    ...puzzle,
    board,
    selectedCell: Math.max(0, board.findIndex((letter) => !letter)),
    direction: 'across',
    hintsUsed,
    hintedCells,
    phase,
    message: phase === 'complete' ? 'Puzzle solved. A fresh grid arrives tomorrow.' : 'Fill each five-letter answer across and down.',
  }
}

export function miniCrosswordProgress(state: MiniCrosswordState): MiniCrosswordProgress {
  return { date: state.date, board: [...state.board], hintsUsed: state.hintsUsed, hintedCells: [...state.hintedCells] }
}

export function miniCrosswordEntry(state: MiniCrosswordState): CrosswordClue {
  const number = state.direction === 'across'
    ? Math.floor(state.selectedCell / MINI_CROSSWORD_SIDE) + 1
    : state.selectedCell % MINI_CROSSWORD_SIDE + 1
  return (state.direction === 'across' ? state.across : state.down)[number - 1]!
}

export function miniCrosswordReducer(state: MiniCrosswordState, action: MiniCrosswordAction): MiniCrosswordState {
  if (action.type === 'reset') {
    if (state.phase === 'complete') return state
    return {
      ...state,
      board: Array(CELL_COUNT).fill(''),
      selectedCell: 0,
      direction: 'across',
      hintsUsed: 0,
      hintedCells: [],
      message: 'Entries cleared. The daily puzzle is ready.',
    }
  }
  if (state.phase === 'complete') return state

  if (action.type === 'toggleDirection') return { ...state, direction: state.direction === 'across' ? 'down' : 'across' }

  if (action.type === 'select') {
    if (!Number.isSafeInteger(action.index) || action.index < 0 || action.index >= CELL_COUNT) return state
    return action.index === state.selectedCell ? state : { ...state, selectedCell: action.index }
  }

  if (action.type === 'backspace') {
    if (state.hintedCells.includes(state.selectedCell)) return state
    const board = [...state.board]
    if (board[state.selectedCell]) {
      board[state.selectedCell] = ''
      return { ...state, board, message: 'Letter erased.' }
    }
    const previous = advanceCrosswordCell(state.selectedCell, state.direction, -1)
    if (state.hintedCells.includes(previous)) return { ...state, selectedCell: previous }
    board[previous] = ''
    return { ...state, board, selectedCell: previous, message: 'Previous letter erased.' }
  }

  if (action.type === 'hint') {
    const index = !state.board[state.selectedCell] && !state.hintedCells.includes(state.selectedCell)
      ? state.selectedCell
      : state.board.findIndex((letter, cell) => !letter && !state.hintedCells.includes(cell))
    if (index < 0) return state
    const board = [...state.board]
    board[index] = state.solution[index]!
    const hintedCells = [...state.hintedCells, index]
    const phase = board.every((letter, cell) => letter === state.solution[cell]) ? 'complete' : 'playing'
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
  if (state.board[state.selectedCell] === action.letter) {
    return { ...state, selectedCell: nextCrosswordCell(state.selectedCell, state.direction), message: 'Letter confirmed.' }
  }
  const board = [...state.board]
  board[state.selectedCell] = action.letter
  const phase = board.every((letter, index) => letter === state.solution[index]) ? 'complete' : 'playing'
  return {
    ...state,
    board,
    selectedCell: nextCrosswordCell(state.selectedCell, state.direction),
    phase,
    message: phase === 'complete' ? 'Puzzle solved. A fresh grid arrives tomorrow.' : 'Letter entered.',
  }
}

export function validMiniCrosswordProgress(value: unknown): value is MiniCrosswordProgress {
  return isRecord(value)
    && isUtcDateKey(value.date)
    && Array.isArray(value.board)
    && value.board.length === CELL_COUNT
    && value.board.every((letter) => letter === '' || (typeof letter === 'string' && /^[A-Z]$/.test(letter)))
    && Number.isSafeInteger(value.hintsUsed)
    && (value.hintsUsed as number) >= 0
    && (value.hintsUsed as number) <= CELL_COUNT
    && Array.isArray(value.hintedCells)
    && value.hintedCells.length <= CELL_COUNT
    && value.hintedCells.length === value.hintsUsed
    && new Set(value.hintedCells).size === value.hintedCells.length
    && value.hintedCells.every((index) => Number.isSafeInteger(index) && (index as number) >= 0 && (index as number) < CELL_COUNT)
}

function advanceCrosswordCell(index: number, direction: CrosswordDirection, amount: number): number {
  if (direction === 'across') {
    const row = Math.floor(index / MINI_CROSSWORD_SIDE)
    const column = (index % MINI_CROSSWORD_SIDE + amount + MINI_CROSSWORD_SIDE) % MINI_CROSSWORD_SIDE
    return row * MINI_CROSSWORD_SIDE + column
  }
  const column = index % MINI_CROSSWORD_SIDE
  const row = (Math.floor(index / MINI_CROSSWORD_SIDE) + amount + MINI_CROSSWORD_SIDE) % MINI_CROSSWORD_SIDE
  return row * MINI_CROSSWORD_SIDE + column
}

function nextCrosswordCell(index: number, direction: CrosswordDirection): number {
  if (direction === 'across') {
    const row = Math.floor(index / MINI_CROSSWORD_SIDE)
    const column = index % MINI_CROSSWORD_SIDE
    return column === MINI_CROSSWORD_SIDE - 1
      ? ((row + 1) % MINI_CROSSWORD_SIDE) * MINI_CROSSWORD_SIDE
      : index + 1
  }
  const row = Math.floor(index / MINI_CROSSWORD_SIDE)
  const column = index % MINI_CROSSWORD_SIDE
  return row === MINI_CROSSWORD_SIDE - 1
    ? (column + 1) % MINI_CROSSWORD_SIDE
    : index + MINI_CROSSWORD_SIDE
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
