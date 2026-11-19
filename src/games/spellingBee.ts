import { FIVE_LETTER_WORD_LIST } from './dailyWord'

export const SPELLING_BEE_MIN_WORD_LENGTH = 4
export const SPELLING_BEE_START_DATE = '2021-01-01'

export type SpellingBeePhase = 'playing' | 'complete'

export interface SpellingBeePuzzle {
  date: string
  center: string
  outer: string[]
  words: string[]
  pangrams: string[]
  maxScore: number
}

export interface SpellingBeeProgress {
  date: string
  foundWords: string[]
  phase: SpellingBeePhase
}

export interface SpellingBeeState extends SpellingBeeProgress, SpellingBeePuzzle {
  draft: string
  score: number
  phase: SpellingBeePhase
  message: string
  shuffleCount: number
}

export type SpellingBeeAction =
  | { type: 'letter'; letter: string }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'submit' }
  | { type: 'shuffle' }

interface HiveDefinition {
  center: string
  outer: string
  pangram: string
  extraWords: string
}

const DAILY_HIVES: HiveDefinition[] = [
  { center: 'A', outer: 'ORNGES', pangram: 'ORANGES', extraWords: 'ANGER ANGERS ARENA AREAS AROSE EARN EARNER EARS EASE ERAS ERASE GEAR GROAN ORANGE RANGE RANGER RANGES RAGES ROARS SAGE SAGES SNARE SONAR NEARS EAGER AGREE' },
  { center: 'E', outer: 'RCITAL', pangram: 'RECITAL', extraWords: 'ARTICLE CIRCLE CIRCLET RELIC LICE LIRE LITER RETAIL LATER ALTER ALERT RELATE CREATE RECREATE CARTEL CATER CATERER TRACE RACE CARE TIRE TIER RICE ELECT' },
  { center: 'O', outer: 'SCHLAR', pangram: 'SCHOLAR', extraWords: 'SCHOOL SCHOOLS CHARCOAL CHORAL CHORALS CORAL COAL COALS LOCAL LOCALS ROACH SHOAL SHOALS ORAL ORALS SOLAR COLOR COLORS CAROL CAROLS ROARS HOAR HOARS' },
  { center: 'U', outer: 'NCLERA', pangram: 'NUCLEAR', extraWords: 'UNCLEAR CLEANER UNCLEAN CLEAN CLEAR CRANE LANCE LUNAR RURAL CURL CURE RULE UNCLE LEARN CANAL LURE CRUEL LAUREL RULER CARNAL' },
  { center: 'E', outer: 'TACHRS', pangram: 'TEACHERS', extraWords: 'TEACHER SEARCH CHEATS CHASE CHART CHEAT EACH HEAR HEART HATER STARE TEARS TRACE CATER CREST EASTER SEAT SHEAR REHEARSE THESE EATER EARTH RATES TREES' },
  { center: 'D', outer: 'RAINGE', pangram: 'DRAINAGE', extraWords: 'GRAINED GRAIN RANGE GRADE GRAND DRAIN DREAD DEAR READ REAR EARN GAIN GANDER GAINED GARDEN GENDER DANGER DARING ENDING DEIGN DINGE' },
  { center: 'M', outer: 'ROAINE', pangram: 'ROMAINE', extraWords: 'MORAINE REMAIN RAMEN MINER MINOR MANNER MOAN MOANER ROMAN MIRE MINE NAME MORE MOIRE REAM RIME MIME MARINE MARINER' },
  { center: 'I', outer: 'RETNAL', pangram: 'RETINAL', extraWords: 'RETAIL RETAIN LINEAR INERT TRIAL TRAIL TILER INLET TINE RAIN LIAR LIRA TRAIN TRINE ENTAIL INTER LITER LITRE RETINA' },
  { center: 'R', outer: 'CETAIN', pangram: 'CERTAIN', extraWords: 'INTERACT CRANE TRACE TRAIN CATER IRATE RECANT CRATER CART TACIT TRICE RETINA RACER CARE RICE CIRCA NICER INERT RANT CANTER' },
  { center: 'E', outer: 'TRAGDY', pangram: 'TRAGEDY', extraWords: 'GREAT TREAD READY TEAR DARE DEAR AGED GRADE TRADE RAGED GRATED GATE DATE YEAR GREATER DRAG RATED EAGER GARDEN' },
  { center: 'A', outer: 'PRIMTE', pangram: 'PRIMATE', extraWords: 'PIRATE REPAIR TAPER PRAIRIE TIMER PRIME MATE TAME RATE PART MART RIPE TRIPE IMPAIR REPEAT TREAT MIRE PIER PEAR PARE' },
  { center: 'A', outer: 'MONCHR', pangram: 'MONARCH', extraWords: 'ANCHOR CHARM MARCH ACORN ROACH CHROMA CARN NACHO HARM AROMA CAROM ARCH MACHO HORN NORM ROAM MOAN' },
  { center: 'I', outer: 'ORGNAL', pangram: 'ORIGINAL', extraWords: 'ALIGN GRAIN GROAN ORIGIN LIAR RAIL RING GIRL ARGON ROARING IGLOO RIGOR LION GRAINING' },
  { center: 'E', outer: 'MONSTR', pangram: 'MONSTER', extraWords: 'STONE STORE TENOR RESET SOME STEM NEST SENT ENTER TERMS STERN TONER SNORE MORSE METER SENOR REMOTE ENTERS' },
  { center: 'I', outer: 'FRCTON', pangram: 'FRICTION', extraWords: 'FICTION INTRO CITRIC FRONT CORN FROST IRON ICON INTO TORN TRIO TONIC CITRON FROTH' },
  { center: 'E', outer: 'ACDINT', pangram: 'ACCIDENT', extraWords: 'INCIDENT DANCE CITED ACTED DECADE CADDIE TIDED DATE DICE DENT NICE NEAT CANTEEN ANTE CITE CADET CANE TINE' },
  { center: 'E', outer: 'COMPLT', pangram: 'COMPLETE', extraWords: 'COMPOTE COMET TEMPO ELECT POEM MELT MOTE TOME POLE MOLE COLT CLOT ELOPE MOTEL COMPEL TEMPLE' },
  { center: 'O', outer: 'RECUNT', pangram: 'RECOUNT', extraWords: 'COUNTER TROUNCE COUNT COURT ROUTE TONE NOTE CURE CUTE CONE OCTET TOUR TROUT CORN CORNET' },
  { center: 'A', outer: 'GLCIER', pangram: 'GLACIER', extraWords: 'CIGAR GLARE GRACE RACIAL CLEAR LARGE LAGER CIRCA LACER AGILE REGAL RECALL LACE RACE ALICE' },
  { center: 'A', outer: 'NGELIC', pangram: 'ANGELIC', extraWords: 'ANGEL ALIGN GLEAN CLEAN GLANCE LACING ALIEN ALGAE GENIAL CLEANING LANCE NICE CAGE CANINE' },
  { center: 'A', outer: 'OVERLP', pangram: 'OVERLAP', extraWords: 'APPAREL APPEAL PAPER PALER PARE PAVE PEARL LAPEL ALOE ORAL PAVER RAVEL PAPAL RAPPEL PLEA' },
  { center: 'A', outer: 'COURGE', pangram: 'COURAGE', extraWords: 'COUGAR RACE CAGE CARGO RAGE ACRE ARGUE AUGER AURA AGUE COURAGE' },
  { center: 'A', outer: 'CUTION', pangram: 'CAUTION', extraWords: 'AUCTION ACTION CATION CANTO CANT ANTI TACO TUNA TUNIC COATI COAT TAUT TACIT ATTIC ATTAIN CANON ANION VATICAN' },
  { center: 'A', outer: 'SLNTED', pangram: 'SLANTED', extraWords: 'SENATE STAND LAND SAND DENTAL LADEN LATE SALE SEAL LEND SLED SENT TENS NEAT DEAL LEAST TALES TENDS SANE DALE TALENT' },
  { center: 'A', outer: 'GRMENT', pangram: 'GARMENT', extraWords: 'MAGNET GAMER ANGER MANNER GARNET MANGER GREAT GRANT TAME MATE RANGE AGENT TANG MART GARNER' },
  { center: 'A', outer: 'VCTION', pangram: 'VACATION', extraWords: 'VACANT ACTION CATION CANON ANION TACIT COATI TAINT ATTIC VATICAN CAVITATION NATION' },
  { center: 'A', outer: 'MOUNTI', pangram: 'MOUNTAIN', extraWords: 'AMOUNT MOTION MAINTAIN ANION TUNA UNIT MINT MAIN AUTUMN MANIA MANTA ANNUM MOUNT' },
]

export const SPELLING_BEE_DAILY_HIVE_COUNT = DAILY_HIVES.length
const DAY_MS = 86_400_000
const GAME_EPOCH = Date.parse(`${SPELLING_BEE_START_DATE}T00:00:00.000Z`)

export function createSpellingBeePuzzle(date: string): SpellingBeePuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const day = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  const definition = DAILY_HIVES[((day % DAILY_HIVES.length) + DAILY_HIVES.length) % DAILY_HIVES.length]!
  const outer = [...definition.outer]
  const allowed = new Set([definition.center, ...outer])
  const candidates = [
    ...FIVE_LETTER_WORD_LIST,
    definition.pangram,
    ...definition.extraWords.split(/\s+/),
  ].map((word) => word.toUpperCase())
  const words = [...new Set(candidates)].filter((word) => isAllowedBeeWord(word, definition.center, allowed))
  const pangrams = words.filter((word) => [...allowed].every((letter) => word.includes(letter)))
  const maxScore = words.reduce((total, word) => total + scoreSpellingBeeWord(word, allowed), 0)

  return { date, center: definition.center, outer, words, pangrams, maxScore }
}

export function createSpellingBeeState(date: string, progress?: SpellingBeeProgress | null): SpellingBeeState {
  const puzzle = createSpellingBeePuzzle(date)
  const foundWords = progress?.date === date
    ? [...new Set(progress.foundWords.filter((word) => puzzle.words.includes(word))) ]
    : []
  const score = foundWords.reduce((total, word) => total + scoreSpellingBeeWord(word, new Set([puzzle.center, ...puzzle.outer])), 0)
  const phase = foundWords.length === puzzle.words.length ? 'complete' : 'playing'

  return {
    ...puzzle,
    foundWords,
    draft: '',
    score,
    phase,
    message: phase === 'complete'
      ? 'All words found. Come back tomorrow for a new hive.'
      : foundWords.length > 0
        ? `${foundWords.length} words saved in this browser. Keep going.`
        : 'Make words of four or more letters. Every word needs the centre letter.',
    shuffleCount: 0,
  }
}

export function spellingBeeProgress(state: SpellingBeeState): SpellingBeeProgress {
  return { date: state.date, foundWords: [...state.foundWords], phase: state.phase }
}

export function visibleSpellingBeeLetters(state: SpellingBeeState): string[] {
  const shift = state.shuffleCount % state.outer.length
  const outer = [...state.outer.slice(shift), ...state.outer.slice(0, shift)]
  if (state.shuffleCount % 2 === 0) outer.reverse()
  return [...outer.slice(0, 3), state.center, ...outer.slice(3)]
}

export function scoreSpellingBeeWord(word: string, allowedLetters: Set<string>): number {
  return (word.length === SPELLING_BEE_MIN_WORD_LENGTH ? 1 : word.length)
    + ([...allowedLetters].every((letter) => word.includes(letter) && allowedLetters.size === 7) ? 7 : 0)
}

export function spellingBeeReducer(state: SpellingBeeState, action: SpellingBeeAction): SpellingBeeState {
  if (state.phase !== 'playing') return state

  if (action.type === 'letter') {
    const letter = action.letter.toUpperCase()
    if (!/^[A-Z]$/.test(letter)) return state
    if (![state.center, ...state.outer].includes(letter)) return { ...state, message: 'Use only letters from today’s hive.' }
    if (state.draft.length >= 15) return state
    return { ...state, draft: `${state.draft}${letter}`, message: 'Press Enter when your word is ready.' }
  }

  if (action.type === 'backspace') {
    return state.draft ? { ...state, draft: state.draft.slice(0, -1), message: 'Last letter removed.' } : state
  }

  if (action.type === 'clear') {
    return state.draft ? { ...state, draft: '', message: 'Word cleared.' } : state
  }

  if (action.type === 'shuffle') {
    return { ...state, shuffleCount: state.shuffleCount + 1, message: 'The outer hive letters have been rearranged.' }
  }

  if (state.draft.length < SPELLING_BEE_MIN_WORD_LENGTH) {
    return { ...state, message: 'Words need at least four letters.' }
  }
  if (!state.draft.includes(state.center)) {
    return { ...state, message: `Every word needs the centre letter ${state.center}.` }
  }
  if (!state.words.includes(state.draft)) {
    return { ...state, message: 'That word is not in today’s word list.' }
  }
  if (state.foundWords.includes(state.draft)) {
    return { ...state, message: 'You already found that word.' }
  }

  const word = state.draft
  const foundWords = [...state.foundWords, word]
  const phase = foundWords.length === state.words.length ? 'complete' : 'playing'
  const points = scoreSpellingBeeWord(word, new Set([state.center, ...state.outer]))
  const isPangram = state.pangrams.includes(word)
  return {
    ...state,
    draft: '',
    foundWords,
    score: state.score + points,
    phase,
    message: phase === 'complete'
      ? 'All words found. Come back tomorrow for a new hive.'
      : `${isPangram ? 'Pangram! ' : ''}+${points} ${points === 1 ? 'point' : 'points'}. ${foundWords.length} of ${state.words.length} words found.`,
  }
}

export function validSpellingBeeProgress(value: unknown): value is SpellingBeeProgress {
  return isRecord(value)
    && isUtcDateKey(value.date)
    && Array.isArray(value.foundWords)
    && value.foundWords.length <= 200
    && value.foundWords.every((word) => typeof word === 'string' && /^[A-Z]{4,15}$/.test(word))
    && (value.phase === 'playing' || value.phase === 'complete')
}

function isAllowedBeeWord(word: string, center: string, allowed: Set<string>): boolean {
  return word.length >= SPELLING_BEE_MIN_WORD_LENGTH
    && word.includes(center)
    && [...word].every((letter) => allowed.has(letter))
}

function isUtcDateKey(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const timestamp = Date.parse(`${date}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
