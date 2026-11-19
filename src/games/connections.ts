export const CONNECTIONS_MISTAKE_LIMIT = 4
export const CONNECTIONS_GROUP_SIZE = 4
export const CONNECTIONS_START_DATE = '2021-06-12'

export type ConnectionsPhase = 'playing' | 'won' | 'lost'
export type ConnectionsColor = 'gold' | 'green' | 'blue' | 'purple'

export interface ConnectionsGroup {
  id: string
  label: string
  words: string[]
  color: ConnectionsColor
}

export interface ConnectionsProgress {
  date: string
  solvedGroupIds: string[]
  selectedWords: string[]
  mistakes: number
  phase: ConnectionsPhase
}

export interface ConnectionsState extends ConnectionsProgress {
  words: string[]
  groups: ConnectionsGroup[]
  message: string
  shuffleCount: number
}

export type ConnectionsAction =
  | { type: 'toggle'; word: string }
  | { type: 'submit' }
  | { type: 'clear' }
  | { type: 'shuffle' }

interface DailyPuzzle {
  groups: ConnectionsGroup[]
}

const DAILY_PUZZLES: DailyPuzzle[] = [
  {
    groups: [
      { id: 'workshop', label: 'Things found in a workshop', words: ['HAMMER', 'VISE', 'FILE', 'CLAMP'], color: 'gold' },
      { id: 'board', label: 'Words before “board”', words: ['SURF', 'CHESS', 'BULLETIN', 'DASH'], color: 'green' },
      { id: 'blue', label: 'Words after “blue”', words: ['MOON', 'CHEESE', 'RIBBON', 'PRINT'], color: 'blue' },
      { id: 'planet', label: 'Planets', words: ['MARS', 'VENUS', 'EARTH', 'SATURN'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'bicycle', label: 'Parts of a bicycle', words: ['PEDAL', 'SADDLE', 'CHAIN', 'SPOKE'], color: 'gold' },
      { id: 'light', label: 'Words before “light”', words: ['STOP', 'FLASH', 'STREET', 'DAY'], color: 'green' },
      { id: 'card-games', label: 'Card games', words: ['BRIDGE', 'POKER', 'RUMMY', 'HEARTS'], color: 'blue' },
      { id: 'double-letters', label: 'Words with a double letter', words: ['BALLOON', 'COFFEE', 'BUBBLE', 'KETTLE'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'pasta', label: 'Types of pasta', words: ['PENNE', 'FUSILLI', 'RIGATONI', 'ORZO'], color: 'gold' },
      { id: 'house', label: 'Words before “house”', words: ['GREEN', 'LIGHT', 'CLUB', 'WARE'], color: 'green' },
      { id: 'sounds', label: 'Words for a short sound', words: ['RING', 'BUZZ', 'HUM', 'POP'], color: 'blue' },
      { id: 'silent-letter', label: 'Words with a silent first letter', words: ['KNIFE', 'WRIST', 'KNEE', 'KNOT'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'weather', label: 'Kinds of weather', words: ['SUNNY', 'WINDY', 'FOGGY', 'RAINY'], color: 'gold' },
      { id: 'theatre', label: 'Parts of a theatre', words: ['STAGE', 'AISLE', 'LOBBY', 'CURTAIN'], color: 'green' },
      { id: 'coffee', label: 'Coffee drinks', words: ['LATTE', 'MOCHA', 'CORTADO', 'ESPRESSO'], color: 'blue' },
      { id: 'toolbox', label: 'Tools with a cutting edge', words: ['CHISEL', 'SCISSORS', 'AXE', 'SHEARS'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'fruit', label: 'Tropical fruit', words: ['MANGO', 'PAPAYA', 'GUAVA', 'PINEAPPLE'], color: 'gold' },
      { id: 'shoe', label: 'Parts of a shoe', words: ['SOLE', 'LACE', 'TONGUE', 'HEEL'], color: 'green' },
      { id: 'dance', label: 'Partner dances', words: ['TANGO', 'WALTZ', 'SALSA', 'FOXTROT'], color: 'blue' },
      { id: 'constellation', label: 'Constellations', words: ['ORION', 'LYRA', 'DRACO', 'CYGNUS'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'clouds', label: 'Cloud types', words: ['CIRRUS', 'CUMULUS', 'STRATUS', 'NIMBUS'], color: 'gold' },
      { id: 'board-games', label: 'Board games', words: ['CHESS', 'CHECKERS', 'BACKGAMMON', 'SCRABBLE'], color: 'green' },
      { id: 'berry', label: 'Berries', words: ['STRAWBERRY', 'BLUEBERRY', 'CRANBERRY', 'RASPBERRY'], color: 'blue' },
      { id: 'small-tools', label: 'Small hand tools', words: ['AWL', 'CHISEL', 'RASP', 'MALLET'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'camera', label: 'Parts of a camera', words: ['LENS', 'SHUTTER', 'FLASH', 'FOCUS'], color: 'gold' },
      { id: 'music-genres', label: 'Music genres', words: ['JAZZ', 'BLUES', 'REGGAE', 'FOLK'], color: 'green' },
      { id: 'line', label: 'Words before “line”', words: ['FOUL', 'GOAL', 'FINISH', 'WAITING'], color: 'blue' },
      { id: 'fish', label: 'Fish', words: ['TROUT', 'SALMON', 'PERCH', 'HERRING'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'kitchen-tools', label: 'Kitchen tools', words: ['WHISK', 'GRATER', 'LADLE', 'TONGS'], color: 'gold' },
      { id: 'dog-breeds', label: 'Dog breeds', words: ['POODLE', 'BEAGLE', 'COLLIE', 'PUG'], color: 'green' },
      { id: 'shapes', label: 'Three-dimensional shapes', words: ['CONE', 'CUBE', 'CYLINDER', 'SPHERE'], color: 'blue' },
      { id: 'greek-letters', label: 'First four Greek letters', words: ['ALPHA', 'BETA', 'GAMMA', 'DELTA'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'road-signs', label: 'Road signs', words: ['YIELD', 'MERGE', 'DETOUR', 'STOP'], color: 'gold' },
      { id: 'cheeses', label: 'Types of cheese', words: ['BRIE', 'FETA', 'GOUDA', 'SWISS'], color: 'green' },
      { id: 'joints', label: 'Joints in the body', words: ['WRIST', 'ELBOW', 'ANKLE', 'KNEE'], color: 'blue' },
      { id: 'book', label: 'Words before “book”', words: ['GUIDE', 'COOK', 'LOG', 'CHECK'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'tree', label: 'Parts of a tree', words: ['BARK', 'ROOT', 'BRANCH', 'LEAF'], color: 'gold' },
      { id: 'card', label: 'Words before “card”', words: ['GREETING', 'CREDIT', 'FLASH', 'PLAYING'], color: 'green' },
      { id: 'waves', label: 'Kinds of waves', words: ['RADIO', 'SOUND', 'OCEAN', 'SEISMIC'], color: 'blue' },
      { id: 'ight', label: 'Words ending in “-ight”', words: ['BRIGHT', 'FLIGHT', 'KNIGHT', 'SLIGHT'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'sea-mammals', label: 'Sea mammals', words: ['SEAOTTER', 'DOLPHIN', 'SEAL', 'WALRUS'], color: 'gold' },
      { id: 'citrus', label: 'Citrus fruit', words: ['LEMON', 'LIME', 'ORANGE', 'POMELO'], color: 'green' },
      { id: 'homes', label: 'Small homes', words: ['CABIN', 'COTTAGE', 'CHALET', 'HUT'], color: 'blue' },
      { id: 'storage', label: 'Places to store things', words: ['LOCKER', 'CABINET', 'DRAWER', 'SHELF'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'instruments', label: 'Orchestral instruments', words: ['TRUMPET', 'TROMBONE', 'CLARINET', 'PICCOLO'], color: 'gold' },
      { id: 'bedroom', label: 'Bedroom furnishings', words: ['PILLOW', 'BLANKET', 'DRESSER', 'LAMP'], color: 'green' },
      { id: 'mountains', label: 'Famous mountains', words: ['EVEREST', 'FUJI', 'DENALI', 'KILIMANJARO'], color: 'blue' },
      { id: 'work', label: 'Words beginning with “work”', words: ['WORKDAY', 'WORKOUT', 'WORKER', 'WORKPLACE'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'fabric', label: 'Types of fabric', words: ['DENIM', 'VELVET', 'SATIN', 'LINEN'], color: 'gold' },
      { id: 'playground', label: 'Playground equipment', words: ['SWING', 'SLIDE', 'SEESAW', 'SANDBOX'], color: 'green' },
      { id: 'stage', label: 'Things used on stage', words: ['SPOTLIGHT', 'MICROPHONE', 'PROP', 'COSTUME'], color: 'blue' },
      { id: 'soup', label: 'Types of soup', words: ['CHOWDER', 'BISQUE', 'BROTH', 'CONSOMME'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'card-ranks', label: 'Playing card ranks', words: ['KING', 'QUEEN', 'JACK', 'ACE'], color: 'gold' },
      { id: 'fair', label: 'Fairground attractions', words: ['CAROUSEL', 'SCRAMBLER', 'DODGEMS', 'FUNHOUSE'], color: 'green' },
      { id: 'green', label: 'Shades or sources of green', words: ['EMERALD', 'JADE', 'MOSS', 'LIME'], color: 'blue' },
      { id: 'instrument-families', label: 'Instrument families', words: ['BRASS', 'WOODWIND', 'PERCUSSION', 'STRING'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'school', label: 'School subjects', words: ['ALGEBRA', 'HISTORY', 'BIOLOGY', 'MUSIC'], color: 'gold' },
      { id: 'mail', label: 'Things you can mail', words: ['LETTER', 'PARCEL', 'POSTCARD', 'PACKAGE'], color: 'green' },
      { id: 'cake', label: 'Words before “cake”', words: ['CHEESE', 'CUP', 'CRAB', 'POUND'], color: 'blue' },
      { id: 'season', label: 'The four seasons', words: ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'shoes', label: 'Types of shoe', words: ['LOAFER', 'SANDAL', 'BOOT', 'SNEAKER'], color: 'gold' },
      { id: 'garden', label: 'Types of garden', words: ['HERB', 'ROSE', 'ROCK', 'ZEN'], color: 'green' },
      { id: 'money', label: 'Slang for money', words: ['BUCK', 'QUID', 'GRAND', 'DOLLAR'], color: 'blue' },
      { id: 'sun', label: 'Words after “sun”', words: ['RISE', 'SET', 'FLOWER', 'SHINE'], color: 'purple' },
    ],
  },
  {
    groups: [
      { id: 'string', label: 'Things that use a string', words: ['GUITAR', 'PUPPET', 'BOW', 'YOYO'], color: 'gold' },
      { id: 'poems', label: 'Forms of poetry', words: ['SONNET', 'HAIKU', 'ODE', 'LYRIC'], color: 'green' },
      { id: 'book-parts', label: 'Parts of a book', words: ['PREFACE', 'INDEX', 'GLOSSARY', 'EPILOGUE'], color: 'blue' },
      { id: 'weekday', label: 'Days of the week', words: ['MONDAY', 'TUESDAY', 'THURSDAY', 'SATURDAY'], color: 'purple' },
    ],
  },
]

export const CONNECTIONS_DAILY_BOARD_COUNT = DAILY_PUZZLES.length

const DAY_MS = 86_400_000
const GAME_EPOCH = Date.parse(`${CONNECTIONS_START_DATE}T00:00:00.000Z`)

export function createConnectionsState(date: string, progress?: ConnectionsProgress | null): ConnectionsState {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const puzzle = puzzleForDate(date)
  const allWords = puzzle.groups.flatMap((group) => group.words)
  const validProgress = progress?.date === date ? progress : null
  const solvedGroupIds = validProgress
    ? validProgress.solvedGroupIds.filter((id, index, ids) => puzzle.groups.some((group) => group.id === id) && ids.indexOf(id) === index)
    : []
  const selectedWords = validProgress
    ? validProgress.selectedWords.filter((word, index, words) => allWords.includes(word) && !isWordSolved(word, puzzle.groups, solvedGroupIds) && words.indexOf(word) === index).slice(0, CONNECTIONS_GROUP_SIZE)
    : []
  const mistakes = validProgress && Number.isSafeInteger(validProgress.mistakes)
    ? Math.max(0, Math.min(CONNECTIONS_MISTAKE_LIMIT, validProgress.mistakes))
    : 0
  const phase = solvedGroupIds.length === puzzle.groups.length
    ? 'won'
    : mistakes >= CONNECTIONS_MISTAKE_LIMIT
      ? 'lost'
      : 'playing'

  return {
    date,
    words: stableShuffle(allWords, dateSeed(date)),
    groups: puzzle.groups,
    solvedGroupIds,
    selectedWords: phase === 'playing' ? selectedWords : [],
    mistakes,
    phase,
    message: phase === 'won'
      ? 'All four groups found. Come back tomorrow for a new board.'
      : phase === 'lost'
        ? 'Board complete. The groupings are shown below; a new board arrives tomorrow.'
        : solvedGroupIds.length > 0
          ? `${solvedGroupIds.length} of 4 groups found. Your progress is saved in this browser.`
          : 'Find four groups of four. Some words could fit more than one idea.',
    shuffleCount: 0,
  }
}

export function connectionsProgress(state: ConnectionsState): ConnectionsProgress {
  return {
    date: state.date,
    solvedGroupIds: [...state.solvedGroupIds],
    selectedWords: [...state.selectedWords],
    mistakes: state.mistakes,
    phase: state.phase,
  }
}

export function visibleConnectionsWords(state: ConnectionsState): string[] {
  const remaining = state.words.filter((word) => !isWordSolved(word, state.groups, state.solvedGroupIds))
  if (!remaining.length || state.shuffleCount === 0) return remaining
  const shift = state.shuffleCount % remaining.length
  const rotated = [...remaining.slice(shift), ...remaining.slice(0, shift)]
  return state.shuffleCount % 2 === 0 ? rotated.reverse() : rotated
}

export function connectionsReducer(state: ConnectionsState, action: ConnectionsAction): ConnectionsState {
  if (state.phase !== 'playing') return state

  if (action.type === 'toggle') {
    if (!state.words.includes(action.word) || isWordSolved(action.word, state.groups, state.solvedGroupIds)) return state
    if (state.selectedWords.includes(action.word)) {
      const selectedWords = state.selectedWords.filter((word) => word !== action.word)
      return { ...state, selectedWords, message: `${selectedWords.length} selected.` }
    }
    if (state.selectedWords.length >= CONNECTIONS_GROUP_SIZE) return { ...state, message: 'Submit or clear your four selected words first.' }
    const selectedWords = [...state.selectedWords, action.word]
    return { ...state, selectedWords, message: `${selectedWords.length} of 4 selected.` }
  }

  if (action.type === 'clear') {
    return state.selectedWords.length ? { ...state, selectedWords: [], message: 'Selection cleared.' } : state
  }

  if (action.type === 'shuffle') {
    return { ...state, shuffleCount: state.shuffleCount + 1, message: 'The remaining words have been rearranged.' }
  }

  if (state.selectedWords.length !== CONNECTIONS_GROUP_SIZE) {
    return { ...state, message: 'Select exactly four words to submit a group.' }
  }

  const selected = new Set(state.selectedWords)
  const match = state.groups.find((group) => !state.solvedGroupIds.includes(group.id)
    && group.words.every((word) => selected.has(word)))
  if (match) {
    const solvedGroupIds = [...state.solvedGroupIds, match.id]
    const phase = solvedGroupIds.length === state.groups.length ? 'won' : 'playing'
    return {
      ...state,
      selectedWords: [],
      solvedGroupIds,
      phase,
      message: phase === 'won'
        ? 'All four groups found. Come back tomorrow for a new board.'
        : `${match.label} — found. ${4 - solvedGroupIds.length} ${4 - solvedGroupIds.length === 1 ? 'group' : 'groups'} remaining.`,
    }
  }

  const oneAway = state.groups.some((group) => !state.solvedGroupIds.includes(group.id)
    && group.words.filter((word) => selected.has(word)).length === CONNECTIONS_GROUP_SIZE - 1)
  const mistakes = state.mistakes + 1
  const phase = mistakes >= CONNECTIONS_MISTAKE_LIMIT ? 'lost' : 'playing'
  return {
    ...state,
    selectedWords: [],
    mistakes,
    phase,
    message: phase === 'lost'
      ? 'No mistakes remaining. The groupings are shown below; a new board arrives tomorrow.'
      : oneAway
        ? `One away. ${CONNECTIONS_MISTAKE_LIMIT - mistakes} ${CONNECTIONS_MISTAKE_LIMIT - mistakes === 1 ? 'mistake' : 'mistakes'} remaining.`
        : `Not a group. ${CONNECTIONS_MISTAKE_LIMIT - mistakes} ${CONNECTIONS_MISTAKE_LIMIT - mistakes === 1 ? 'mistake' : 'mistakes'} remaining.`,
  }
}

export function validConnectionsProgress(value: unknown): value is ConnectionsProgress {
  return isRecord(value)
    && isUtcDateKey(value.date)
    && Array.isArray(value.solvedGroupIds)
    && value.solvedGroupIds.length <= 4
    && value.solvedGroupIds.every((id) => typeof id === 'string' && /^[a-z-]+$/.test(id))
    && Array.isArray(value.selectedWords)
    && value.selectedWords.length <= CONNECTIONS_GROUP_SIZE
    && value.selectedWords.every((word) => typeof word === 'string' && /^[A-Z]{2,12}$/.test(word))
    && Number.isSafeInteger(value.mistakes)
    && (value.mistakes as number) >= 0
    && (value.mistakes as number) <= CONNECTIONS_MISTAKE_LIMIT
    && (value.phase === 'playing' || value.phase === 'won' || value.phase === 'lost')
}

function isWordSolved(word: string, groups: ConnectionsGroup[], solvedGroupIds: string[]): boolean {
  return groups.some((group) => solvedGroupIds.includes(group.id) && group.words.includes(word))
}

function puzzleForDate(date: string): DailyPuzzle {
  const days = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  return DAILY_PUZZLES[((days % CONNECTIONS_DAILY_BOARD_COUNT) + CONNECTIONS_DAILY_BOARD_COUNT) % CONNECTIONS_DAILY_BOARD_COUNT]!
}

function stableShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items]
  let state = seed || 1
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    const swapWith = state % (index + 1)
    ;[shuffled[index], shuffled[swapWith]] = [shuffled[swapWith]!, shuffled[index]!]
  }
  return shuffled
}

function dateSeed(date: string): number {
  return date.split('-').join('').split('').reduce((seed, digit) => (seed * 31 + Number(digit)) >>> 0, 0)
}

function isUtcDateKey(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const timestamp = Date.parse(`${date}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
