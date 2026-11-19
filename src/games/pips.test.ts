import { describe, expect, it } from 'vitest'
import {
  PIPS_CELL_COUNT,
  canPlacePipsDomino,
  createPipsPuzzle,
  createPipsState,
  isPipsSolved,
  pipsCellValues,
  pipsProgress,
  pipsReducer,
  pipsRegionStatuses,
  validPipsProgress,
} from './pips'

describe('daily Pips puzzles', () => {
  it('creates deterministic daily dominoes, connected regions, and a valid solution', () => {
    const puzzle = createPipsPuzzle('2026-11-19')
    expect(createPipsPuzzle('2026-11-19')).toEqual(puzzle)
    expect(createPipsPuzzle('2026-11-20')).not.toEqual(puzzle)
    expect(puzzle.dominoes).toHaveLength(6)
    expect(new Set(puzzle.dominoes.map((domino) => domino.values.join(':'))).size).toBe(6)
    expect(puzzle.regions).toHaveLength(4)
    expect(puzzle.regions.map((region) => region.cells.length)).toEqual([3, 3, 3, 3])
    expect(puzzle.regionByCell).toHaveLength(PIPS_CELL_COUNT)
    expect(puzzle.solution).toHaveLength(6)
    expect(pipsCellValues(puzzle, puzzle.solution).every((value) => value !== null)).toBe(true)
    expect(isPipsSolved(puzzle, puzzle.solution)).toBe(true)
    expect(pipsRegionStatuses(puzzle, puzzle.solution).every((region) => region.satisfied)).toBe(true)
  })

  it('allows only in-bounds, non-overlapping domino placements', () => {
    const puzzle = createPipsPuzzle('2026-11-19')
    const first = { dominoId: 0, firstCell: 0, orientation: 'horizontal' as const, flipped: false }
    expect(canPlacePipsDomino(puzzle, [], first)).toBe(true)
    expect(canPlacePipsDomino(puzzle, [first], { ...first, dominoId: 1 })).toBe(false)
    expect(canPlacePipsDomino(puzzle, [], { ...first, firstCell: 3 })).toBe(false)
    expect(canPlacePipsDomino(puzzle, [], { ...first, firstCell: 8, orientation: 'vertical' })).toBe(false)
  })

  it('selects, rotates, flips, places, undoes, and restarts', () => {
    const initial = createPipsState('2026-11-19')
    const selected = pipsReducer(initial, { type: 'select', dominoId: 0 })
    expect(selected.selectedDominoId).toBe(0)
    expect(pipsReducer(selected, { type: 'rotate' }).orientation).toBe('vertical')
    expect(pipsReducer(selected, { type: 'flip' }).flipped).toBe(true)

    const placed = pipsReducer(selected, { type: 'place', cell: 0 })
    expect(placed.placements).toHaveLength(1)
    expect(placed.selectedDominoId).toBeNull()
    expect(pipsCellValues(placed, placed.placements).slice(0, 2).every((value) => value !== null)).toBe(true)
    const undone = pipsReducer(placed, { type: 'undo' })
    expect(undone.placements).toHaveLength(0)
    expect(undone.undos).toBe(1)

    const reset = pipsReducer(placed, { type: 'restart' })
    expect(reset.placements).toHaveLength(0)
    expect(reset.undos).toBe(1)
  })

  it('restores a valid daily board and rejects malformed saved placements', () => {
    const puzzle = createPipsPuzzle('2026-11-19')
    const partial = { date: puzzle.date, placements: puzzle.solution.slice(0, 2), undos: 3 }
    const restored = createPipsState(puzzle.date, partial)
    expect(restored.placements).toEqual(partial.placements)
    expect(restored.undos).toBe(3)
    expect(validPipsProgress(partial)).toBe(true)
    expect(validPipsProgress({ ...partial, placements: [...partial.placements, partial.placements[0]] })).toBe(false)
    expect(validPipsProgress({ ...partial, placements: [{ dominoId: 0, firstCell: 3, orientation: 'horizontal', flipped: false }] })).toBe(false)
    expect(validPipsProgress({ ...partial, undos: -1 })).toBe(false)
    expect(validPipsProgress({ ...partial, date: '2026-02-30' })).toBe(false)
  })

  it('keeps generated solution paths valid across a month of daily boards', () => {
    for (let day = 1; day <= 30; day += 1) {
      const puzzle = createPipsPuzzle(`2026-11-${String(day).padStart(2, '0')}`)
      expect(isPipsSolved(puzzle, puzzle.solution)).toBe(true)
      expect(new Set(puzzle.solution.flatMap((placement) => {
        const next = { ...placement, firstCell: placement.firstCell + (placement.orientation === 'horizontal' ? 1 : 4) }
        return [placement.firstCell, next.firstCell]
      })).size).toBe(PIPS_CELL_COUNT)
    }
  })

  it('finishes and locks a solved daily board', () => {
    const initial = createPipsState('2026-11-19')
    const solved = initial.solution.reduce((state, placement) => {
      const selected = pipsReducer(state, { type: 'select', dominoId: placement.dominoId })
      const oriented = placement.orientation === 'vertical' ? pipsReducer(selected, { type: 'rotate' }) : selected
      const flipped = placement.flipped ? pipsReducer(oriented, { type: 'flip' }) : oriented
      return pipsReducer(flipped, { type: 'place', cell: placement.firstCell })
    }, initial)
    expect(solved.phase).toBe('complete')
    expect(pipsProgress(solved).placements).toHaveLength(6)
    expect(pipsReducer(solved, { type: 'undo' })).toBe(solved)
  })
})
