import { describe, expect, it } from 'vitest'
import {
  DOMINO_COLUMNS,
  DOMINO_COUNT,
  DOMINO_ROWS,
  createDominoLogicPuzzle,
  createDominoLogicState,
  createDominoLogicStateForPuzzle,
  dominoLogicProgress,
  dominoLogicReducer,
  dominoTotals,
  isDominoLogicSolved,
  validDominoLogicProgress,
  type DominoLogicPuzzle,
  type DominoLogicState,
  type DominoLogicProgress,
} from './dominoLogic'

const DATE = '2026-11-19'

function winningPuzzle(): DominoLogicPuzzle {
  return {
    date: DATE,
    dominoes: [
      { id: 0, values: [1, 2] },
      { id: 1, values: [3, 4] },
      { id: 2, values: [5, 6] },
      { id: 3, values: [2, 3] },
      { id: 4, values: [4, 5] },
      { id: 5, values: [1, 3] },
    ],
    rowTargets: [10, 16, 13],
    columnTargets: [10, 13, 6, 10],
  }
}

function stateFor(puzzle: DominoLogicPuzzle): DominoLogicState {
  return {
    ...puzzle,
    placements: [],
    selectedDominoId: null,
    orientation: 'horizontal',
    flipped: false,
    undos: 0,
    phase: 'playing',
    message: '',
  }
}

describe('Domino Logic daily puzzle', () => {
  it('generates a deterministic, complete tiling with matching row and column totals', () => {
    const first = createDominoLogicPuzzle(DATE)
    const repeated = createDominoLogicPuzzle(DATE)
    const other = createDominoLogicPuzzle('2026-11-20')

    expect(repeated).toEqual(first)
    expect(other).not.toEqual(first)
    expect(first.dominoes).toHaveLength(DOMINO_COUNT)
    expect(new Set(first.dominoes.map((tile) => tile.id)).size).toBe(DOMINO_COUNT)
    expect(first.dominoes.every((tile) => tile.values.every((value) => value >= 1 && value <= 6))).toBe(true)
    expect(first.rowTargets).toHaveLength(DOMINO_ROWS)
    expect(first.columnTargets).toHaveLength(DOMINO_COLUMNS)
    expect(first.rowTargets.reduce((sum, value) => sum + value, 0)).toBe(first.columnTargets.reduce((sum, value) => sum + value, 0))
  })

  it('generates valid puzzles across dates and rejects malformed dates', () => {
    for (let day = 1; day <= 31; day += 1) {
      const date = `2026-12-${String(day).padStart(2, '0')}`
      const puzzle = createDominoLogicPuzzle(date)
      expect(puzzle.rowTargets.reduce((sum, value) => sum + value, 0)).toBe(puzzle.columnTargets.reduce((sum, value) => sum + value, 0))
    }
    expect(() => createDominoLogicPuzzle('2026-02-30')).toThrow(RangeError)
  })

  it('adds each placed half to the correct row and column totals', () => {
    const puzzle = winningPuzzle()
    const placements = puzzle.dominoes.map((tile) => ({
      dominoId: tile.id,
      firstCell: Math.floor(tile.id / 2) * DOMINO_COLUMNS + (tile.id % 2) * 2,
      orientation: 'horizontal' as const,
      flipped: false,
    }))
    const totals = dominoTotals(puzzle, placements)

    expect(totals.rowSums).toEqual(puzzle.rowTargets)
    expect(totals.columnSums).toEqual(puzzle.columnTargets)
    expect(totals.cells).toEqual([1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 1, 3])
    expect(isDominoLogicSolved(puzzle, placements)).toBe(true)
  })

  it('requires selection, keeps dominoes inside the grid, and prevents overlaps', () => {
    let state = stateFor(winningPuzzle())
    state = dominoLogicReducer(state, { type: 'place', cell: 0 })
    expect(state.placements).toHaveLength(0)

    state = dominoLogicReducer(state, { type: 'select', dominoId: 0 })
    state = dominoLogicReducer(state, { type: 'rotate' })
    state = dominoLogicReducer(state, { type: 'place', cell: DOMINO_COLUMNS * (DOMINO_ROWS - 1) })
    expect(state.placements).toHaveLength(0)
    expect(state.message).toContain('two empty neighboring cells')

    state = dominoLogicReducer(state, { type: 'place', cell: 0 })
    expect(state.placements[0]).toMatchObject({ dominoId: 0, firstCell: 0, orientation: 'vertical' })
    state = dominoLogicReducer(state, { type: 'select', dominoId: 1 })
    state = dominoLogicReducer(state, { type: 'place', cell: 0 })
    expect(state.placements).toHaveLength(1)
  })

  it('supports reversing domino ends and counts undo and restart actions', () => {
    let state = stateFor(winningPuzzle())
    state = dominoLogicReducer(state, { type: 'select', dominoId: 0 })
    state = dominoLogicReducer(state, { type: 'flip' })
    state = dominoLogicReducer(state, { type: 'place', cell: 0 })
    expect(dominoTotals(state, state.placements).cells.slice(0, 2)).toEqual([2, 1])

    state = dominoLogicReducer(state, { type: 'undo' })
    expect(state.placements).toHaveLength(0)
    expect(state.undos).toBe(1)
    state = dominoLogicReducer(state, { type: 'select', dominoId: 0 })
    state = dominoLogicReducer(state, { type: 'place', cell: 0 })
    state = dominoLogicReducer(state, { type: 'restart' })
    expect(state.placements).toHaveLength(0)
    expect(state.undos).toBe(2)
  })

  it('completes the daily grid when every row and column matches and restores progress', () => {
    const puzzle = winningPuzzle()
    let state = stateFor(puzzle)
    for (let row = 0; row < DOMINO_ROWS; row += 1) {
      for (let pair = 0; pair < DOMINO_COLUMNS / 2; pair += 1) {
        const dominoId = row * 2 + pair
        state = dominoLogicReducer(state, { type: 'select', dominoId })
        state = dominoLogicReducer(state, { type: 'place', cell: row * DOMINO_COLUMNS + pair * 2 })
      }
    }

    expect(state.phase).toBe('complete')
    expect(state.message).toContain('Grid complete')
    const progress = dominoLogicProgress(state)
    expect(validDominoLogicProgress(progress)).toBe(true)
    expect(createDominoLogicStateForPuzzle(puzzle, progress).phase).toBe('complete')
    expect(dominoLogicReducer(state, { type: 'undo' })).toBe(state)
  })

  it('rejects stale, overlapping, and malformed saved placements', () => {
    const puzzle = createDominoLogicPuzzle(DATE)
    const saved: DominoLogicProgress = { date: DATE, placements: [{ dominoId: 0, firstCell: 0, orientation: 'horizontal', flipped: false }], undos: 3 }
    expect(validDominoLogicProgress(saved)).toBe(true)
    expect(createDominoLogicState(DATE, saved).placements).toEqual(saved.placements)
    expect(createDominoLogicState('2026-11-20', saved).placements).toHaveLength(0)
    expect(validDominoLogicProgress({ ...saved, placements: [...saved.placements, { dominoId: 1, firstCell: 1, orientation: 'horizontal', flipped: false }] })).toBe(false)
    expect(validDominoLogicProgress({ ...saved, placements: [{ dominoId: 0, firstCell: DOMINO_COLUMNS - 1, orientation: 'horizontal', flipped: false }] })).toBe(false)
    expect(validDominoLogicProgress({ ...saved, date: '2026-02-30' })).toBe(false)
    expect(puzzle.date).toBe(DATE)
  })
})
