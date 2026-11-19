import { FIVE_LETTER_WORD_LIST } from './dailyWord'

export const LETTER_BOXED_START_DATE = '2026-01-01'
export const LETTER_BOXED_MIN_WORD_LENGTH = 3

export type LetterBoxedPhase = 'playing' | 'complete'

export interface LetterBoxedPuzzle {
  date: string
  /** The four sides are ordered top, right, bottom, left. */
  sides: [string[], string[], string[], string[]]
  letters: string[]
}

export interface LetterBoxedProgress {
  date: string
  words: string[]
}

export interface LetterBoxedState extends LetterBoxedPuzzle {
  words: string[]
  draft: string
  coveredLetters: string[]
  phase: LetterBoxedPhase
  message: string
}

export type LetterBoxedAction =
  | { type: 'letter'; letter: string }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'submit' }
  | { type: 'undo' }

interface PuzzleDefinition {
  sides: [string, string, string, string]
  solution: [string, string, string]
}

const DAILY_PUZZLES: PuzzleDefinition[] = [
  { sides: ['RNL', 'AEB', 'OIT', 'CWS'], solution: ['CRANE', 'ELBOW', 'WRIST'] },
  { sides: ['BVT', 'OEG', 'IHU', 'ARS'], solution: ['ABOVE', 'EIGHT', 'TRUST'] },
  { sides: ['BEI', 'OLR', 'VDH', 'AGT'], solution: ['ABOVE', 'ELDER', 'RIGHT'] },
  { sides: ['BEP', 'OMT', 'VYL', 'AID'], solution: ['ABOVE', 'EMPTY', 'YIELD'] },
  { sides: ['COE', 'TRP', 'LUG', 'AYN'], solution: ['ACTOR', 'REPLY', 'YOUNG'] },
  { sides: ['CEB', 'ULO', 'TWR', 'AID'], solution: ['ACUTE', 'ELBOW', 'WEIRD'] },
  { sides: ['CTO', 'UEB', 'LWN', 'ARG'], solution: ['ACUTE', 'ELBOW', 'WRONG'] },
  { sides: ['CEJ', 'UNO', 'TYL', 'AID'], solution: ['ACUTE', 'ENJOY', 'YIELD'] },
  { sides: ['AML', 'DIB', 'TNO', 'EJY'], solution: ['ADMIT', 'TABLE', 'ENJOY'] },
  { sides: ['AMT', 'DIE', 'RHC', 'SOK'], solution: ['ADMIT', 'TEARS', 'SHOCK'] },
  { sides: ['AMT', 'DIH', 'OEL', 'SRY'], solution: ['ADMIT', 'THOSE', 'EARLY'] },
  { sides: ['DIG', 'MTN', 'HRU', 'AOP'], solution: ['ADMIT', 'THING', 'GROUP'] },
]

const SHORT_WORDS = `
ACE ACT ADD AGE AGO AID AIM AIR ALE ALL AND ANT ANY APE ARC ARE ARM ART ASH ASK ATE AWE
BAD BAG BAN BAR BAT BAY BED BEE BEG BET BID BIG BIN BIT BOW BOX BOY BUG BUS BUY CAB CAN CAP CAR CAT COT COW CUP CUT
DAY DEN DIE DIG DIM DIP DOG DOT DRY DUE EAR EAT EEL EGG EGO ELF END ERA EVE EYE FAN FAR FAT FED FEE FEW FIG FIN FIT FIX FLY FOG FOR FOX FRY FUN
GAP GAS GEL GEM GET GIN GOD GOT GUM GUN GUT GUY GYM HAD HAM HAT HAY HEN HER HID HIM HIP HIS HIT HOG HOT HOW HUG HUT ICE ILL INK INN ION ITS
JAM JAR JAW JET JOB JOY KEY KID KIN KIT LAB LAD LAG LAP LAW LAY LEG LET LID LIE LIP LIT LOG LOT LOW MAD MAN MAP MAT MAY MEN MET MID MIX MOB MOD MOP MUD MUG
NAG NAP NET NEW NIL NOD NOR NOT NOW NUN NUT OAK OAR OAT ODD OFF OIL OLD ONE OPT ORE OUR OUT OWL OWN PAD PAL PAN PAT PAW PAY PEA PEE PEN PET PIE PIG PIN PIT POD POT PUT
RAG RAN RAP RAT RAW RED RID RIG RIP ROB ROD ROT ROW RUB RUG RUN SAD SAG SAT SAW SAY SEA SEE SET SEW SHE SHY SIN SIP SIT SIX SKY SOD SON SOP SOW SUN TAB TAG TAN TAP TAR TAX TEA TEN THE TIE TIN TIP TOE TON TOP TOY TRY TUB TUG TWO USE VAN VAT VET VIA VIE VOW WAR WAS WAY WEB WED WET WHO WHY WIG WIN WIT WON WOW YAM YAP YAW YES YET YOU ZAP ZIP
ABLE ALSO AREA ARMY AWAY BABY BACK BALL BAND BANK BASE BATH BEAR BEAT BEEN BELL BELT BEST BILL BIRD BLOW BLUE BOAT BODY BOLD BOOK BOOT BORN BOSS BOTH BOWL BURN BUSY CALL CALM CAME CAMP CARD CARE CASE CASH CAST CITY CLUB COAL COAT COLD COME COOK COOL COPY CORE COST CREW CROP DARK DATA DATE DEAD DEAL DEAR DEBT DEEP DESK DIAL DIET DISH DOOR DOSE DOWN DRAW DREW DROP DRUG DUAL DUST EACH EARN EASY EAST EDGE ELSE EVEN EVER EVIL FACE FACT FAIR FALL FARM FAST FATE FEAR FEED FEEL FELL FELT FILE FILL FILM FIND FINE FIRE FIRM FISH FIVE FLAT FLOW FOOD FOOT FORK FORM FORT FOUR FREE FROM FUEL FULL FUND GAME GATE GAVE GEAR GIFT GIRL GIVE GLAD GOAL GOES GOLD GOLF GONE GOOD GRAB GRAY GREW GROW HAIR HALF HAND HANG HARD HARM HAVE HEAD HEAR HEAT HELD HELP HERE HERO HIGH HILL HIRE HOLD HOLE HOME HOPE HOST HOUR HUGE IDEA ITEM JOIN JOKE JUMP JUST KEEP KEPT KICK KIND KING KNEW KNOW LACK LAKE LAMP LAND LAST LATE LEAD LEAF LEFT LESS LIFE LIFT LIKE LINE LINK LIST LIVE LOAD LOAN LOCK LONG LOOK LORD LOSE LOST LOVE MADE MAIL MAIN MAKE MANY MARK MATE MEAL MEAN MEAT MEET MENU MILE MILK MIND MINE MISS MODE MOOD MOON MORE MOST MOVE MUCH MUST NAME NEAR NEAT NECK NEED NEWS NEXT NICE NINE NONE NOTE ONCE ONLY OPEN OVER PAGE PAID PAIN PAIR PARK PART PASS PAST PATH PEAK PICK PILE PINK PLAN PLAY PLOT PLUS POEM POET POLE POOL POOR PORT POST PULL PURE PUSH RACE RACK RAIN RANK RATE READ REAL REAR REST RICE RICH RIDE RING RISE RISK ROAD ROCK ROLE ROSE RULE SAFE SAIL SALE SAME SAND SAVE SEAT SEED SEEK SEEM SEEN SELF SELL SEND SENT SHIP SHOP SHOT SHOW SIDE SIGN SING SITE SIZE SKIN SLIP SLOW SNOW SOFT SOLD SOLE SOME SONG SOON SORT SOUL SPIN STAR STAY STEP STOP SUCH SUIT SURE TAKE TALE TALK TALL TANK TASK TEAM TELL TEND TERM TEST TEXT THAN THAT THEM THEN THEY THIN THIS TIDE TIED TIME TINY TOLD TONE TOOL TOUR TOWN TREE TRIP TRUE TUNE TURN TYPE UNIT UPON USED USER VERY VIEW VISA VOID WAIT WAKE WALK WALL WANT WARM WARN WASH WAVE WAYS WEAR WEEK WELL WENT WERE WEST WHAT WHEN WIDE WIFE WILD WILL WIND WINE WING WISH WITH WOOD WORD WORE WORK WRAP YEAR YOUR ZERO ZONE
`.trim().split(/\s+/)

const VALID_WORDS = new Set([...FIVE_LETTER_WORD_LIST, ...SHORT_WORDS].map((word) => word.toUpperCase()))
export const LETTER_BOXED_DAILY_COUNT = DAILY_PUZZLES.length
const DAY_MS = 86_400_000
const GAME_EPOCH = Date.parse(`${LETTER_BOXED_START_DATE}T00:00:00.000Z`)

export function createLetterBoxedPuzzle(date: string): LetterBoxedPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const day = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  const definition = DAILY_PUZZLES[((day % DAILY_PUZZLES.length) + DAILY_PUZZLES.length) % DAILY_PUZZLES.length]!
  const sides = definition.sides.map((side) => [...side]) as LetterBoxedPuzzle['sides']
  const letters = sides.flat()
  if (new Set(letters).size !== 12) throw new Error('Letter Boxed sides must contain twelve unique letters.')
  return { date, sides, letters }
}

export function letterBoxedSolutionForDate(date: string): readonly string[] {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const day = Math.floor((Date.parse(`${date}T00:00:00.000Z`) - GAME_EPOCH) / DAY_MS)
  return DAILY_PUZZLES[((day % DAILY_PUZZLES.length) + DAILY_PUZZLES.length) % DAILY_PUZZLES.length]!.solution
}

export function createLetterBoxedState(date: string, progress?: LetterBoxedProgress | null): LetterBoxedState {
  const puzzle = createLetterBoxedPuzzle(date)
  const words: string[] = []
  if (progress?.date === date && validLetterBoxedProgress(progress)) {
    for (const word of progress.words) {
      if (!isValidLetterBoxedWord(puzzle, words, word)) break
      words.push(word)
      if (hasCoveredEveryLetter(puzzle, words)) break
    }
  }
  const coveredLetters = getCoveredLetters(words)
  const phase = puzzle.letters.every((letter) => coveredLetters.includes(letter)) ? 'complete' : 'playing'
  return {
    ...puzzle,
    words,
    draft: '',
    coveredLetters,
    phase,
    message: phase === 'complete'
      ? `Puzzle solved in ${words.length} ${words.length === 1 ? 'word' : 'words'}. A fresh box arrives tomorrow.`
      : words.length > 0
        ? 'Keep going. Start the next word with the last letter you used.'
        : 'Make words of three or more letters. Use each side letter to finish the box.',
  }
}

export function letterBoxedProgress(state: LetterBoxedState): LetterBoxedProgress {
  return { date: state.date, words: [...state.words] }
}

export function isValidLetterBoxedWord(puzzle: LetterBoxedPuzzle, previousWords: string[], word: string): boolean {
  const normalized = word.toUpperCase()
  if (normalized.length < LETTER_BOXED_MIN_WORD_LENGTH || !VALID_WORDS.has(normalized) || previousWords.includes(normalized)) return false
  if (previousWords.length > 0 && normalized[0] !== previousWords.at(-1)?.at(-1)) return false
  for (const letter of normalized) if (!puzzle.letters.includes(letter)) return false
  for (let index = 1; index < normalized.length; index += 1) {
    if (sideForLetter(puzzle, normalized[index - 1]!) === sideForLetter(puzzle, normalized[index]!)) return false
  }
  return true
}

export function letterBoxedReducer(state: LetterBoxedState, action: LetterBoxedAction): LetterBoxedState {
  if (action.type === 'undo') {
    if (state.words.length === 0) return state
    const words = state.words.slice(0, -1)
    const coveredLetters = getCoveredLetters(words)
    return {
      ...state,
      words,
      draft: '',
      coveredLetters,
      phase: 'playing',
      message: words.length > 0 ? `Removed the last word. Continue from ${words.at(-1)!.slice(-1)}.` : 'Last word removed. Start a new chain.',
    }
  }
  if (state.phase === 'complete') return state

  if (action.type === 'clear') {
    if (!state.draft) return state
    return { ...state, draft: '', message: 'Current word cleared.' }
  }

  if (action.type === 'backspace') {
    if (!state.draft) return state
    return { ...state, draft: state.draft.slice(0, -1), message: 'Last letter removed.' }
  }

  if (action.type === 'letter') {
    const letter = action.letter.toUpperCase()
    if (!/^[A-Z]$/.test(letter)) return state
    if (!state.letters.includes(letter)) return { ...state, message: 'Choose a letter from one of the four sides.' }
    const previous = state.draft.slice(-1)
    if (previous && sideForLetter(state, previous) === sideForLetter(state, letter)) {
      return { ...state, message: 'Switch sides between each pair of letters.' }
    }
    return { ...state, draft: `${state.draft}${letter}`, message: 'Word in progress.' }
  }

  const word = state.draft
  if (word.length < LETTER_BOXED_MIN_WORD_LENGTH) return { ...state, message: 'Words need at least three letters.' }
  if (state.words.length > 0 && word[0] !== state.words.at(-1)?.at(-1)) {
    return { ...state, message: `Start this word with ${state.words.at(-1)!.slice(-1)}.` }
  }
  if (!VALID_WORDS.has(word)) return { ...state, message: 'That word is not in Arcade’s bundled word list.' }
  if (state.words.includes(word)) return { ...state, message: 'That word was already used.' }
  if (!isValidLetterBoxedWord(state, state.words, word)) return { ...state, message: 'That word does not follow the side rule.' }

  const words = [...state.words, word]
  const coveredLetters = getCoveredLetters(words)
  const phase = state.letters.every((letter) => coveredLetters.includes(letter)) ? 'complete' : 'playing'
  return {
    ...state,
    words,
    draft: '',
    coveredLetters,
    phase,
    message: phase === 'complete'
      ? `Box complete in ${words.length} ${words.length === 1 ? 'word' : 'words'}. A fresh puzzle arrives tomorrow.`
      : `Nice word. ${state.letters.length - coveredLetters.length} letters left to cover.`,
  }
}

export function validLetterBoxedProgress(value: unknown): value is LetterBoxedProgress {
  return isRecord(value)
    && isUtcDateKey(value.date)
    && Array.isArray(value.words)
    && value.words.length <= 12
    && value.words.every((word) => typeof word === 'string' && /^[A-Z]{3,15}$/.test(word))
    && new Set(value.words).size === value.words.length
}

function sideForLetter(puzzle: LetterBoxedPuzzle, letter: string): number {
  return puzzle.sides.findIndex((side) => side.includes(letter))
}

function getCoveredLetters(words: string[]): string[] {
  return [...new Set(words.join(''))]
}

function hasCoveredEveryLetter(puzzle: LetterBoxedPuzzle, words: string[]): boolean {
  const covered = getCoveredLetters(words)
  return puzzle.letters.every((letter) => covered.includes(letter))
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
