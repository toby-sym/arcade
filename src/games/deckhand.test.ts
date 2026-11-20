import { describe, expect, it } from 'vitest'
import {
  DECKHAND_COLUMN_COUNT,
  DECKHAND_RANK_COUNT,
  advanceDeckhandTime,
  createDeckhandState,
  drawDeckhandCard,
  formatDeckhandTime,
  moveDeckhandCard,
  pauseDeckhand,
  restartDeckhand,
  resumeDeckhand,
  startDeckhand,
  undoDeckhand,
  type DeckhandCard,
  type DeckhandSource,
  type DeckhandState,
  type DeckhandSuit,
  type DeckhandTarget,
} from './deckhand'

describe('Deckhand solitaire', () => {
  it('makes a repeatable seven-column deal with a complete, unique deck', () => {
    const deal = createDeckhandState(8128)
    const sameDeal = createDeckhandState(8128)
    const anotherDeal = createDeckhandState(8129)
    const cards = [...deal.tableau.flatMap((column) => column.cards), ...deal.stock]

    expect(deal.tableau.map((column) => column.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(deal.tableau).toEqual(sameDeal.tableau)
    expect(deal.stock).toEqual(sameDeal.stock)
    expect(deal.stock).not.toEqual(anotherDeal.stock)
    expect(cards).toHaveLength(52)
    expect(new Set(cards.map((card) => card.id)).size).toBe(52)
    expect(deal.stock).toHaveLength(24)
    expect(deal.tableau.every((column) => column.faceUpFrom === column.cards.length - 1)).toBe(true)
  })

  it('builds alternating descending runs and can solve every generated deal', () => {
    for (const seed of [1, 2, 3, 9, 42, 2026, 65537]) {
      let state = startDeckhand(createDeckhandState(seed))
      for (const column of state.tableau) {
        for (let index = 0; index < column.cards.length - 1; index += 1) {
          expect(column.cards[index]!.rank).toBe(column.cards[index + 1]!.rank + 1)
          expect(column.cards[index]!.color).not.toBe(column.cards[index + 1]!.color)
        }
      }

      for (let action = 0; action < 1800 && state.phase !== 'complete'; action += 1) {
        const foundationMove = findAvailableFoundationMove(state)
        if (foundationMove) {
          state = moveDeckhandCard(state, foundationMove.source, foundationMove.target)
          continue
        }
        if (state.stock.length > 0 || state.waste.length > 0) {
          state = drawDeckhandCard(state)
          continue
        }
        throw new Error(`The generated deal ${seed} had no clear path at action ${action}.`)
      }

      expect(state.phase, `seed ${seed}`).toBe('complete')
      expect(state.foundations.clubs).toHaveLength(DECKHAND_RANK_COUNT)
      expect(state.foundations.diamonds).toHaveLength(DECKHAND_RANK_COUNT)
      expect(state.foundations.hearts).toHaveLength(DECKHAND_RANK_COUNT)
      expect(state.foundations.spades).toHaveLength(DECKHAND_RANK_COUNT)
    }
  })

  it('draws, recycles, and undoes without losing a card', () => {
    let state = startDeckhand(createDeckhandState(3))
    const originalStock = [...state.stock]
    state = drawDeckhandCard(state)
    expect(state.stock).toHaveLength(23)
    expect(state.waste).toHaveLength(1)
    state = undoDeckhand(state)
    expect(state.stock).toEqual(originalStock)
    expect(state.waste).toEqual([])

    const fullPass: DeckhandState = { ...startDeckhand(createDeckhandState(4)), stock: [], waste: [...originalStock.slice(0, 5)] }
    const recycled = drawDeckhandCard(fullPass)
    expect(recycled.stock).toEqual(fullPass.waste.slice().reverse())
    expect(recycled.waste).toEqual([])
    expect(undoDeckhand(recycled).waste).toEqual(fullPass.waste)
  })

  it('moves a playable card home, reveals the next card, and restores the move on undo', () => {
    let state = startDeckhand(createDeckhandState(21))
    const ace = state.tableau[0]!.cards.at(-1)!
    state = moveDeckhandCard(state, { kind: 'tableau', column: 0, cardIndex: 0 }, { kind: 'foundation', suit: ace.suit })
    expect(state.foundations[ace.suit]).toEqual([ace])
    expect(state.tableau[0]!.cards).toEqual([])
    expect(state.moves).toBe(1)
    state = undoDeckhand(state)
    expect(state.foundations[ace.suit]).toEqual([])
    expect(state.tableau[0]!.cards).toEqual([ace])
    expect(state.phase).toBe('playing')
    expect(state.moves).toBe(0)
  })

  it('moves an alternating run and reveals a facedown card', () => {
    const queen = card(12, 'hearts')
    const king = card(13, 'clubs')
    const jack = card(11, 'spades')
    let state = startDeckhand(createDeckhandState(2))
    state = {
      ...state,
      tableau: [
        { cards: [queen, king], faceUpFrom: 1 },
        { cards: [], faceUpFrom: 0 },
        { cards: [], faceUpFrom: 0 },
        ...state.tableau.slice(3),
      ],
      stock: [],
      waste: [],
    }

    state = moveDeckhandCard(state, { kind: 'tableau', column: 0, cardIndex: 1 }, { kind: 'tableau', column: 2 })
    expect(state.tableau[0]).toMatchObject({ cards: [queen], faceUpFrom: 0 })
    expect(state.tableau[2]!.cards.map((item) => item.rank)).toEqual([13])

    state = { ...state, tableau: state.tableau.map((column, index) => index === 1 ? { cards: [jack], faceUpFrom: 0 } : column) }
    state = moveDeckhandCard(state, { kind: 'tableau', column: 1, cardIndex: 0 }, { kind: 'tableau', column: 0 })
    expect(state.tableau[0]!.cards.map((item) => item.rank)).toEqual([12, 11])
  })

  it('pauses the clock, resumes, restarts the same deal, and formats the clear time', () => {
    let state = startDeckhand(createDeckhandState(99))
    state = advanceDeckhandTime(state, 18)
    state = pauseDeckhand(state)
    expect(advanceDeckhandTime(state, 10).elapsedSeconds).toBe(18)
    state = resumeDeckhand(state)
    expect(advanceDeckhandTime(state, 2).elapsedSeconds).toBe(20)
    expect(restartDeckhand(state).seed).toBe(99)
    expect(formatDeckhandTime(125)).toBe('2:05')
  })
})

function findAvailableFoundationMove(state: DeckhandState): { source: DeckhandSource; target: DeckhandTarget } | null {
  for (let columnIndex = 0; columnIndex < DECKHAND_COLUMN_COUNT; columnIndex += 1) {
    const column = state.tableau[columnIndex]!
    const cardIndex = column.cards.length - 1
    const candidate = column.cards[cardIndex]
    if (candidate && candidate.rank === state.foundations[candidate.suit].length + 1) {
      return { source: { kind: 'tableau', column: columnIndex, cardIndex }, target: { kind: 'foundation', suit: candidate.suit } }
    }
  }
  const candidate = state.waste.at(-1)
  if (candidate && candidate.rank === state.foundations[candidate.suit].length + 1) {
    return { source: { kind: 'waste' }, target: { kind: 'foundation', suit: candidate.suit } }
  }
  return null
}

function card(rank: number, suit: DeckhandSuit): DeckhandCard {
  const red = suit === 'diamonds' || suit === 'hearts'
  return { id: `${suit}-${rank}`, rank, suit, color: red ? 'red' : 'black' }
}
