export const STRANDS_ROWS = 6
export const STRANDS_COLUMNS = 8
export const STRANDS_START_DATE = '2021-01-01'

export type StrandsPhase = 'playing' | 'complete'

export interface StrandsPuzzle {
  date: string
  theme: string
  spangram: string
  words: string[]
  grid: string[]
  paths: Record<string, number[]>
}

export interface StrandsProgress {
  date: string
  foundWords: string[]
  hintsUsed: number
  hintedCells: number[]
}

export interface StrandsState extends StrandsPuzzle, StrandsProgress {
  selection: number[]
  hintedCells: number[]
  phase: StrandsPhase
  message: string
}

export type StrandsAction =
  | { type: 'select'; index: number }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'hint' }

interface PuzzleDefinition {
  theme: string
  spangram: string
  words: string[]
}

const DAILY_PUZZLES: PuzzleDefinition[] = [
  { theme: 'Things in the night sky', spangram: 'NIGHTSKY', words: ['PLANET', 'METEOR', 'COMET', 'ORBIT', 'MOON'] },
  { theme: 'A well-kept garden', spangram: 'BACKYARD', words: ['RAKE', 'TULIP', 'HEDGE', 'SHOVEL', 'SEED'] },
  { theme: 'On a road trip', spangram: 'ROADTRIP', words: ['MILE', 'FUEL', 'SNACKS', 'RESTSTOP', 'DETOUR'] },
  { theme: 'A day at the beach', spangram: 'BEACHDAY', words: ['SURF', 'SAND', 'SHELL', 'TIDE', 'TOWEL'] },
  { theme: 'Things in a kitchen', spangram: 'COOKWARE', words: ['SPICE', 'WHISK', 'APRON', 'LADLE', 'SKILLET'] },
  { theme: 'A music room', spangram: 'BANDSTAGE', words: ['PIANO', 'FLUTE', 'DRUMS', 'GUITAR', 'VIOLIN'] },
  { theme: 'Winter weather', spangram: 'COLDSEASON', words: ['SNOW', 'SLEET', 'FROST', 'ICICLE', 'MITTEN'] },
  { theme: 'At a carnival', spangram: 'CARNIVAL', words: ['TICKET', 'PRIZE', 'POPCORN', 'CAROUSEL', 'FUNHOUSE'] },
  { theme: 'In the city', spangram: 'DOWNTOWN', words: ['SUBWAY', 'TAXI', 'CROSSWALK', 'PARK', 'BLOCK'] },
  { theme: 'At the airport', spangram: 'FLIGHTPLAN', words: ['PILOT', 'GATE', 'LUGGAGE', 'RUNWAY', 'BOARDING'] },
  { theme: 'In outer space', spangram: 'ASTRONAUT', words: ['STAR', 'COMET', 'GALAXY', 'ROCKET', 'ORBIT'] },
  { theme: 'At a museum', spangram: 'ARTISTIC', words: ['STATUE', 'GALLERY', 'EXHIBIT', 'PAINTING', 'CURATOR'] },
  { theme: 'On a camping trip', spangram: 'WILDERNESS', words: ['TENT', 'FIRE', 'TRAIL', 'CREEK', 'SMORE'] },
  { theme: 'At a bakery', spangram: 'PASTRIES', words: ['BREAD', 'BAGEL', 'CROISSANT', 'MUFFIN', 'ICING'] },
  { theme: 'A game night', spangram: 'PLAYTIME', words: ['DICE', 'CARDS', 'CHESS', 'PUZZLE', 'TRIVIA'] },
  { theme: 'Life in the ocean', spangram: 'OCEANLIFE', words: ['CORAL', 'WHALE', 'REEF', 'OCTOPUS', 'DOLPHIN'] },
  { theme: 'Spring cleaning', spangram: 'HOUSEWORK', words: ['DUST', 'BROOM', 'VACUUM', 'SPONGE', 'CLEAN'] },
  { theme: 'The night shift', spangram: 'OVERNIGHT', words: ['NURSE', 'GUARD', 'DRIVER', 'BAKER', 'PILOT'] },
  { theme: 'On the farm', spangram: 'FARMHOUSE', words: ['HORSE', 'TRACTOR', 'CHICKEN', 'PASTURE', 'STABLE'] },
  { theme: 'Going to school', spangram: 'SCHOOLBUS', words: ['LESSON', 'PENCIL', 'RECESS', 'TEACHER', 'CLASS'] },
  { theme: 'A good book', spangram: 'BOOKMARKS', words: ['NOVEL', 'AUTHOR', 'READER', 'CHAPTER', 'LIBRARY'] },
  { theme: 'Keeping time', spangram: 'TIMEPIECE', words: ['CLOCK', 'ALARM', 'MINUTE', 'SECOND', 'HOUR'] },
  { theme: 'Birdwatching', spangram: 'BIRDWATCH', words: ['ROBIN', 'HERON', 'EGRET', 'HAWK', 'FEATHER'] },
  { theme: 'A snowy day', spangram: 'SNOWFLAKE', words: ['FROST', 'ICICLE', 'WINTER', 'SLEIGH', 'MITTEN'] },
  { theme: 'Road construction', spangram: 'ROADWORKS', words: ['CONE', 'DETOUR', 'PAVING', 'BARRIER', 'SIGNAL'] },
  { theme: 'A theatre show', spangram: 'PLAYHOUSE', words: ['ACTOR', 'STAGE', 'SCRIPT', 'SCENE', 'CURTAIN'] },
  { theme: 'Under the spotlight', spangram: 'LIMELIGHT', words: ['SPOTLIGHT', 'STAGE', 'ACTOR', 'COSTUME', 'APPLAUSE'] },
  { theme: 'A rushing river', spangram: 'WATERFALL', words: ['STREAM', 'CASCADE', 'RIVER', 'RAPIDS', 'CURRENT'] },
  { theme: 'A clear night', spangram: 'STARLIGHT', words: ['MOON', 'COMET', 'PLANET', 'ORBIT', 'GALAXY'] },
]

export const STRANDS_DAILY_PUZZLE_COUNT = DAILY_PUZZLES.length
const DAY_MS = 86_400_000
const GAME_EPOCH = Date.parse(`${STRANDS_START_DATE}T00:00:00.000Z`)

export function createStrandsPuzzle(date: string): StrandsPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const days = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  const definition = DAILY_PUZZLES[((days % DAILY_PUZZLES.length) + DAILY_PUZZLES.length) % DAILY_PUZZLES.length]!
  const seed = date.split('-').join('').split('').reduce((value, digit) => (value * 31 + Number(digit)) >>> 0, 1)
  const words = [definition.spangram, ...stableShuffle(definition.words, seed)]
  const grid = Array(STRANDS_ROWS * STRANDS_COLUMNS).fill('') as string[]
  const paths: Record<string, number[]> = {}
  const occupied = new Set<number>()
  paths[definition.spangram] = makeSpangramPath(definition.spangram.length, seed)
  placeWord(grid, occupied, definition.spangram, paths[definition.spangram]!)

  const themeWords = [...words.slice(1)].sort((first, second) => second.length - first.length)
  const placeThemeWord = (wordIndex: number): boolean => {
    if (wordIndex === themeWords.length) return true
    const word = themeWords[wordIndex]!
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const path = findOpenPath(word.length, occupied, seed + wordIndex * 997 + attempt * 104729)
      if (!path) continue
      paths[word] = path
      placeWord(grid, occupied, word, path)
      if (placeThemeWord(wordIndex + 1)) return true
      path.forEach((index) => {
        grid[index] = ''
        occupied.delete(index)
      })
      delete paths[word]
    }
    return false
  }
  if (!placeThemeWord(0)) throw new Error('The daily words do not fit the Strands board.')

  const filler = [...new Set(words.join(''))]
  let random = seed || 1
  for (let index = 0; index < grid.length; index += 1) {
    if (grid[index]) continue
    random = (random * 1664525 + 1013904223) >>> 0
    grid[index] = filler[random % filler.length]!
  }

  return { date, theme: definition.theme, spangram: definition.spangram, words, grid, paths }
}

export function createStrandsState(date: string, progress?: StrandsProgress | null): StrandsState {
  const puzzle = createStrandsPuzzle(date)
  const foundWords = progress?.date === date
    ? [...new Set(progress.foundWords.filter((word) => puzzle.words.includes(word)))]
    : []
  const hintsUsed = progress?.date === date && Number.isSafeInteger(progress.hintsUsed)
    ? Math.max(0, Math.min(48, progress.hintsUsed))
    : 0
  const phase = foundWords.length === puzzle.words.length ? 'complete' : 'playing'
  const foundIndexes = new Set(foundWords.flatMap((word) => puzzle.paths[word]!))
  const hintedCells = progress?.date === date && Array.isArray(progress.hintedCells)
    ? [...new Set(progress.hintedCells.filter((index) => Number.isSafeInteger(index) && index >= 0 && index < puzzle.grid.length && !foundIndexes.has(index)))]
    : []

  return {
    ...puzzle,
    foundWords,
    hintsUsed,
    selection: [],
    hintedCells,
    phase,
    message: phase === 'complete'
      ? 'All six words found. Come back tomorrow for a new theme.'
      : foundWords.length > 0
        ? `${foundWords.length} words found. Your progress is saved in this browser.`
        : 'Select adjacent letters to find the theme words and the spanning word.',
  }
}

export function strandsProgress(state: StrandsState): StrandsProgress {
  return { date: state.date, foundWords: [...state.foundWords], hintsUsed: state.hintsUsed, hintedCells: [...state.hintedCells] }
}

export function strandsWordAtPath(state: StrandsState, indexes: number[]): string {
  return indexes.map((index) => state.grid[index] ?? '').join('')
}

export function strandsReducer(state: StrandsState, action: StrandsAction): StrandsState {
  if (state.phase !== 'playing') return state

  if (action.type === 'clear') {
    return state.selection.length ? { ...state, selection: [], message: 'Path cleared.' } : state
  }

  if (action.type === 'undo') {
    if (!state.selection.length) return state
    const selection = state.selection.slice(0, -1)
    return { ...state, selection, message: selection.length ? 'Last letter removed from the path.' : 'Path cleared.' }
  }

  if (action.type === 'hint') {
    const nextWord = state.words.find((word) => !state.foundWords.includes(word)
      && state.paths[word]!.some((index) => !state.hintedCells.includes(index)))
    if (!nextWord) return state
    const hintCell = state.paths[nextWord]!.find((index) => !state.hintedCells.includes(index))!
    const hintsUsed = state.hintsUsed + 1
    const hintedCells = [...state.hintedCells, hintCell]
    return { ...state, hintsUsed, hintedCells, message: `Hint: revealed one letter of a ${nextWord.length}-letter word.` }
  }

  if (action.index < 0 || action.index >= state.grid.length || state.foundWords.some((word) => state.paths[word]!.includes(action.index))) return state
  if (state.selection.includes(action.index)) {
    if (state.selection.at(-1) !== action.index) return { ...state, message: 'Undo from the end of the path, or clear it.' }
    const selection = state.selection.slice(0, -1)
    return { ...state, selection, message: 'Last letter removed from the path.' }
  }
  const previous = state.selection.at(-1)
  if (previous !== undefined && !areAdjacent(previous, action.index)) {
    return { ...state, selection: [action.index], message: 'Path restarted at this letter. Choose a neighboring cell next.' }
  }

  const selection = [...state.selection, action.index]
  const selectedWord = strandsWordAtPath(state, selection)
  const match = state.words.find((word) => !state.foundWords.includes(word)
    && (word === selectedWord || word === [...selectedWord].reverse().join('')))
  if (match) {
    const foundWords = [...state.foundWords, match]
    const phase = foundWords.length === state.words.length ? 'complete' : 'playing'
    return {
      ...state,
      selection: [],
      foundWords,
      hintedCells: state.hintedCells.filter((index) => !state.paths[match]!.includes(index)),
      phase,
      message: phase === 'complete'
        ? 'All six words found. Come back tomorrow for a new theme.'
        : match === state.spangram ? `Spangram found: ${match}. ${foundWords.length} of ${state.words.length} words found.` : `Found ${match}. ${foundWords.length} of ${state.words.length} words found.`,
    }
  }

  const prefix = state.words.some((word) => !state.foundWords.includes(word)
    && (word.startsWith(selectedWord) || word.endsWith(selectedWord)))
  return {
    ...state,
    selection,
    message: prefix
      ? `${selection.length} connected ${selection.length === 1 ? 'letter' : 'letters'} selected.`
      : 'Keep tracing, or undo the last letter.',
  }
}

export function validStrandsProgress(value: unknown): value is StrandsProgress {
  return isRecord(value)
    && isUtcDateKey(value.date)
    && Array.isArray(value.foundWords)
    && value.foundWords.length <= 10
    && value.foundWords.every((word) => typeof word === 'string' && /^[A-Z]{4,15}$/.test(word))
    && Number.isSafeInteger(value.hintsUsed)
    && (value.hintsUsed as number) >= 0
    && (value.hintsUsed as number) <= 48
    && Array.isArray(value.hintedCells)
    && value.hintedCells.length <= 48
    && value.hintedCells.every((index) => Number.isSafeInteger(index) && (index as number) >= 0 && (index as number) < STRANDS_ROWS * STRANDS_COLUMNS)
}

function makeSpangramPath(length: number, seed: number): number[] {
  const top = seed % 2
  const path = Array.from({ length: STRANDS_COLUMNS }, (_, column) => top * STRANDS_COLUMNS + column).slice(0, length)
  if (length > STRANDS_COLUMNS) {
    for (let column = STRANDS_COLUMNS - 1; path.length < length && column >= 0; column -= 1) {
      path.push((top + 1) * STRANDS_COLUMNS + column)
    }
  }
  if (path.length !== length) throw new Error('The daily spangram does not fit the Strands board.')
  return path
}

function findOpenPath(length: number, occupied: Set<number>, seed: number): number[] | null {
  const allIndexes = shuffleNumbers(Array.from({ length: STRANDS_ROWS * STRANDS_COLUMNS }, (_, index) => index), seed)
  for (const start of allIndexes) {
    if (occupied.has(start)) continue
    const path = [start]
    const visited = new Set(path)
    let visitedNodes = 0
    const find = (current: number): boolean => {
      if (path.length === length) return true
      if (visitedNodes >= 1200) return false
      visitedNodes += 1
      const neighbors = shuffleNumbers(neighborIndexes(current).filter((index) => !occupied.has(index) && !visited.has(index)), seed + current + visitedNodes)
      for (const next of neighbors) {
        path.push(next)
        visited.add(next)
        if (find(next)) return true
        path.pop()
        visited.delete(next)
      }
      return false
    }
    if (find(start)) return path
  }
  return null
}

function placeWord(grid: string[], occupied: Set<number>, word: string, path: number[]) {
  path.forEach((index, position) => {
    grid[index] = word[position]!
    occupied.add(index)
  })
}

function neighborIndexes(index: number): number[] {
  const row = Math.floor(index / STRANDS_COLUMNS)
  const column = index % STRANDS_COLUMNS
  const neighbors: number[] = []
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
      if (rowDelta === 0 && columnDelta === 0) continue
      const nextRow = row + rowDelta
      const nextColumn = column + columnDelta
      if (nextRow >= 0 && nextRow < STRANDS_ROWS && nextColumn >= 0 && nextColumn < STRANDS_COLUMNS) {
        neighbors.push(nextRow * STRANDS_COLUMNS + nextColumn)
      }
    }
  }
  return neighbors
}

function shuffleNumbers(items: number[], seed: number): number[] {
  const shuffled = [...items]
  let random = seed || 1
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    random = (random * 1664525 + 1013904223) >>> 0
    const swapWith = random % (index + 1)
    ;[shuffled[index], shuffled[swapWith]] = [shuffled[swapWith]!, shuffled[index]!]
  }
  return shuffled
}

function areAdjacent(first: number, second: number): boolean {
  const rowDistance = Math.abs(Math.floor(first / STRANDS_COLUMNS) - Math.floor(second / STRANDS_COLUMNS))
  const columnDistance = Math.abs(first % STRANDS_COLUMNS - second % STRANDS_COLUMNS)
  return rowDistance <= 1 && columnDistance <= 1 && (rowDistance !== 0 || columnDistance !== 0)
}

function stableShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items]
  let random = seed || 1
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    random = (random * 1664525 + 1013904223) >>> 0
    const swapWith = random % (index + 1)
    ;[shuffled[index], shuffled[swapWith]] = [shuffled[swapWith]!, shuffled[index]!]
  }
  return shuffled
}

function isUtcDateKey(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const timestamp = Date.parse(`${date}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
