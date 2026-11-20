export const DECKHAND_COLUMN_COUNT = 7
export const DECKHAND_RANK_COUNT = 13

export type DeckhandSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
export type DeckhandColor = 'red' | 'black'
export type DeckhandPhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface DeckhandCard {
  id: string
  rank: number
  suit: DeckhandSuit
  color: DeckhandColor
}

export interface DeckhandColumn {
  /** Cards are stored from the bottom of the pile to its top card. */
  cards: DeckhandCard[]
  /** The first card in the face-up suffix; earlier cards are face down. */
  faceUpFrom: number
}

export type DeckhandSource =
  | { kind: 'waste' }
  | { kind: 'tableau'; column: number; cardIndex: number }
  | { kind: 'foundation'; suit: DeckhandSuit }

export type DeckhandTarget =
  | { kind: 'tableau'; column: number }
  | { kind: 'foundation'; suit: DeckhandSuit }

interface DeckhandSnapshot {
  tableau: DeckhandColumn[]
  stock: DeckhandCard[]
  waste: DeckhandCard[]
  foundations: Record<DeckhandSuit, DeckhandCard[]>
  moves: number
}

export interface DeckhandState {
  phase: DeckhandPhase
  seed: number
  tableau: DeckhandColumn[]
  /** The end of the array is the next card drawn. */
  stock: DeckhandCard[]
  /** The end of the array is the playable waste card. */
  waste: DeckhandCard[]
  foundations: Record<DeckhandSuit, DeckhandCard[]>
  selection: DeckhandSource | null
  moves: number
  elapsedSeconds: number
  history: DeckhandSnapshot[]
  message: string
}

export const DECKHAND_SUITS: readonly DeckhandSuit[] = ['clubs', 'diamonds', 'hearts', 'spades']

const RED_SUITS: readonly DeckhandSuit[] = ['diamonds', 'hearts']
const BLACK_SUITS: readonly DeckhandSuit[] = ['clubs', 'spades']
const DECKHAND_EMPTY_FOUNDATIONS = (): Record<DeckhandSuit, DeckhandCard[]> => ({ clubs: [], diamonds: [], hearts: [], spades: [] })

export function createDeckhandState(seed = randomSeed()): DeckhandState {
  const safeSeed = normalizeSeed(seed)
  const deal = createDeckhandDeal(safeSeed)
  return {
    phase: 'ready',
    seed: safeSeed,
    tableau: deal.tableau,
    stock: deal.stock,
    waste: [],
    foundations: DECKHAND_EMPTY_FOUNDATIONS(),
    selection: null,
    moves: 0,
    elapsedSeconds: 0,
    history: [],
    message: 'A fresh, solvable deal is ready. Build each suit from ace to king.',
  }
}

export function startDeckhand(state: DeckhandState): DeckhandState {
  if (state.phase !== 'ready') return state
  return { ...createDeckhandState(state.seed), phase: 'playing', message: 'Deal live. Build each suit from ace to king.' }
}

export function restartDeckhand(state: DeckhandState): DeckhandState {
  return createDeckhandState(state.seed)
}

export function newDeckhandDeal(state: DeckhandState): DeckhandState {
  return createDeckhandState(nextSeed(state.seed))
}

export function pauseDeckhand(state: DeckhandState): DeckhandState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', selection: null, message: 'Deal paused. Your cards and time are held.' } : state
}

export function resumeDeckhand(state: DeckhandState): DeckhandState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Deal live. Build each suit from ace to king.' } : state
}

export function advanceDeckhandTime(state: DeckhandState, seconds = 1): DeckhandState {
  if (state.phase !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return state
  return { ...state, elapsedSeconds: state.elapsedSeconds + seconds }
}

export function drawDeckhandCard(state: DeckhandState): DeckhandState {
  if (state.phase !== 'playing') return state
  if (state.stock.length === 0 && state.waste.length === 0) return state
  const history = [...state.history, snapshot(state)]
  if (state.stock.length === 0) {
    return {
      ...state,
      stock: [...state.waste].reverse(),
      waste: [],
      selection: null,
      moves: state.moves + 1,
      history,
      message: 'Stock recycled. The waste is ready for another pass.',
    }
  }
  const stock = [...state.stock]
  const card = stock.pop()!
  return {
    ...state,
    stock,
    waste: [...state.waste, card],
    selection: null,
    moves: state.moves + 1,
    history,
    message: `${describeDeckhandCard(card)} turned over. Select it or keep dealing.`,
  }
}

export function selectDeckhandCard(state: DeckhandState, source: DeckhandSource): DeckhandState {
  if (state.phase !== 'playing' || !sourceHasCards(state, source)) return state
  if (sameSource(state.selection, source)) return { ...state, selection: null, message: 'Card selection cleared.' }
  return { ...state, selection: source, message: `${describeDeckhandCard(sourceCards(state, source)![0]!)} selected. Choose a pile or suit foundation.` }
}

export function moveDeckhandCard(state: DeckhandState, source: DeckhandSource, target: DeckhandTarget): DeckhandState {
  if (state.phase !== 'playing' || !sourceHasCards(state, source)) return state
  const moving = sourceCards(state, source)!
  if (target.kind === 'foundation') {
    if (moving.length !== 1 || moving[0]!.suit !== target.suit || state.foundations[target.suit].length + 1 !== moving[0]!.rank) return state
  } else {
    if (source.kind === 'tableau' && source.column === target.column) return state
    const destination = state.tableau[target.column]
    if (!destination) return state
    const destinationTop = destination.cards.at(-1)
    const movingTop = moving[0]!
    if (destinationTop
      ? destinationTop.rank !== movingTop.rank + 1 || destinationTop.color === movingTop.color
      : movingTop.rank !== DECKHAND_RANK_COUNT) return state
  }

  const next = cloneForMove(state)
  next.history = [...state.history, snapshot(state)]
  next.selection = null
  if (source.kind === 'waste') next.waste.pop()
  else if (source.kind === 'foundation') next.foundations[source.suit].pop()
  else {
    const sourceColumn = next.tableau[source.column]!
    sourceColumn.cards.splice(source.cardIndex)
    if (sourceColumn.cards.length > 0 && source.cardIndex === state.tableau[source.column]!.faceUpFrom) {
      sourceColumn.faceUpFrom = sourceColumn.cards.length - 1
    }
  }

  if (target.kind === 'foundation') next.foundations[target.suit].push(moving[0]!)
  else {
    const destination = next.tableau[target.column]!
    if (destination.cards.length === 0) destination.faceUpFrom = 0
    destination.cards.push(...moving)
  }
  next.moves += 1
  const complete = DECKHAND_SUITS.every((suit) => next.foundations[suit].length === DECKHAND_RANK_COUNT)
  if (complete) {
    next.phase = 'complete'
    next.selection = null
    next.message = `All 52 cards home in ${formatDeckhandTime(next.elapsedSeconds)}. Your fastest clear stays in this browser.`
  } else {
    next.message = target.kind === 'foundation'
      ? `${describeDeckhandCard(moving[0]!)} moved home.`
      : `${moving.length === 1 ? 'Card' : `${moving.length} cards`} moved to column ${target.column + 1}.`
  }
  return next
}

export function moveSelectedDeckhandCard(state: DeckhandState, target: DeckhandTarget): DeckhandState {
  return state.selection ? moveDeckhandCard(state, state.selection, target) : state
}

export function undoDeckhand(state: DeckhandState): DeckhandState {
  if ((state.phase !== 'playing' && state.phase !== 'complete') || state.history.length === 0) return state
  const history = [...state.history]
  const previous = history.pop()!
  return {
    ...state,
    ...cloneSnapshot(previous),
    phase: 'playing',
    selection: null,
    history,
    message: 'Last move undone.',
  }
}

export function createDeckhandDeal(seed: number): Pick<DeckhandState, 'tableau' | 'stock'> {
  const random = createRandom(normalizeSeed(seed))
  const cardsByRank = new Map<number, Record<DeckhandColor, DeckhandCard[]>>()
  for (let rank = 1; rank <= DECKHAND_RANK_COUNT; rank += 1) {
    const red = shuffle([...RED_SUITS].map((suit) => makeCard(rank, suit)), random)
    const black = shuffle([...BLACK_SUITS].map((suit) => makeCard(rank, suit)), random)
    cardsByRank.set(rank, { red, black })
  }

  const used = new Set<string>()
  const tableau = Array.from({ length: DECKHAND_COLUMN_COUNT }, (_, columnIndex): DeckhandColumn => {
    const startRank = columnIndex + 1
    const topToBottom: DeckhandCard[] = []
    for (let rank = startRank; rank <= startRank * 2 - 1; rank += 1) {
      const color: DeckhandColor = (rank - startRank) % 2 === 0 ? 'red' : 'black'
      const candidate = cardsByRank.get(rank)![color].shift()
      if (!candidate) throw new Error(`Cannot build solvable card run at rank ${rank}.`)
      used.add(candidate.id)
      topToBottom.push(candidate)
    }
    const cards = topToBottom.reverse()
    return { cards, faceUpFrom: cards.length - 1 }
  })

  const stockCards = DECKHAND_SUITS.flatMap((suit) => Array.from({ length: DECKHAND_RANK_COUNT }, (_, index) => makeCard(index + 1, suit)))
    .filter((card) => !used.has(card.id))
  const stock = shuffle(stockCards, random).reverse()
  return { tableau, stock }
}

export function formatDeckhandTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`
}

export function deckhandSuitSymbol(suit: DeckhandSuit): string {
  return suit === 'clubs' ? '♣' : suit === 'diamonds' ? '♦' : suit === 'hearts' ? '♥' : '♠'
}

export function deckhandRankLabel(rank: number): string {
  return rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank)
}

export function describeDeckhandCard(card: DeckhandCard): string {
  const suitName = card.suit === 'clubs' ? 'clubs' : card.suit
  return `${deckhandRankLabel(card.rank)} of ${suitName}`
}

function sourceHasCards(state: DeckhandState, source: DeckhandSource): boolean {
  return sourceCards(state, source) !== null
}

function sourceCards(state: DeckhandState, source: DeckhandSource): DeckhandCard[] | null {
  if (source.kind === 'waste') return state.waste.length > 0 ? [state.waste.at(-1)!] : null
  if (source.kind === 'foundation') return state.foundations[source.suit].length > 0 ? [state.foundations[source.suit].at(-1)!] : null
  const column = state.tableau[source.column]
  if (!column || !Number.isInteger(source.cardIndex) || source.cardIndex < column.faceUpFrom || source.cardIndex >= column.cards.length) return null
  const cards = column.cards.slice(source.cardIndex)
  if (!cards.length || !isFaceUpRun(cards)) return null
  return cards
}

function isFaceUpRun(cards: readonly DeckhandCard[]): boolean {
  for (let index = 0; index < cards.length - 1; index += 1) {
    if (cards[index]!.rank !== cards[index + 1]!.rank + 1 || cards[index]!.color === cards[index + 1]!.color) return false
  }
  return true
}

function sameSource(first: DeckhandSource | null, second: DeckhandSource): boolean {
  return first?.kind === second.kind
    && (first.kind === 'waste' && second.kind === 'waste'
      || first.kind === 'tableau' && second.kind === 'tableau' && first.column === second.column && first.cardIndex === second.cardIndex
      || first.kind === 'foundation' && second.kind === 'foundation' && first.suit === second.suit)
}

function snapshot(state: DeckhandState): DeckhandSnapshot {
  return {
    tableau: cloneTableau(state.tableau),
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: cloneFoundations(state.foundations),
    moves: state.moves,
  }
}

function cloneSnapshot(snapshotState: DeckhandSnapshot): DeckhandSnapshot {
  return {
    tableau: cloneTableau(snapshotState.tableau),
    stock: [...snapshotState.stock],
    waste: [...snapshotState.waste],
    foundations: cloneFoundations(snapshotState.foundations),
    moves: snapshotState.moves,
  }
}

function cloneForMove(state: DeckhandState): DeckhandState {
  return {
    ...state,
    tableau: cloneTableau(state.tableau),
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: cloneFoundations(state.foundations),
  }
}

function cloneTableau(tableau: readonly DeckhandColumn[]): DeckhandColumn[] {
  return tableau.map((column) => ({ cards: [...column.cards], faceUpFrom: column.faceUpFrom }))
}

function cloneFoundations(foundations: Record<DeckhandSuit, DeckhandCard[]>): Record<DeckhandSuit, DeckhandCard[]> {
  return { clubs: [...foundations.clubs], diamonds: [...foundations.diamonds], hearts: [...foundations.hearts], spades: [...foundations.spades] }
}

function makeCard(rank: number, suit: DeckhandSuit): DeckhandCard {
  return { id: `${suit}-${rank}`, rank, suit, color: RED_SUITS.includes(suit) ? 'red' : 'black' }
}

function normalizeSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) >>> 0 || 1 : 1
}

function nextSeed(seed: number): number {
  return (seed + 0x9e3779b9) >>> 0 || 1
}

function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) return crypto.getRandomValues(new Uint32Array(1))[0]! || 1
  return Math.floor(Math.random() * 0xffffffff) || 1
}

function createRandom(seed: number): () => number {
  let value = normalizeSeed(seed)
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return (value >>> 0) / 0x100000000
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[items[index], items[other]] = [items[other]!, items[index]!]
  }
  return items
}
