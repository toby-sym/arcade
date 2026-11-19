import { describe, expect, it } from 'vitest'
import { createTilesPuzzle, createTilesState, isTilesIndexFree, tilesProgress, tilesReducer, validTilesProgress } from './tiles'

describe('daily Tiles matching puzzles', () => {
  it('generates a deterministic board with a legal removal path', () => {
    const puzzle = createTilesPuzzle('2026-11-19')
    expect(createTilesPuzzle('2026-11-19')).toEqual(puzzle)
    expect(createTilesPuzzle('2026-11-20')).not.toEqual(puzzle)
    expect(puzzle.patterns).toHaveLength(20)
    expect(puzzle.solutionPairs).toHaveLength(10)

    const cleared: number[] = []
    for (const pair of puzzle.solutionPairs) {
      expect(pair).toHaveLength(2)
      expect(isTilesIndexFree(pair[0]!, cleared)).toBe(true)
      expect(isTilesIndexFree(pair[1]!, cleared)).toBe(true)
      expect(puzzle.patterns[pair[0]!]).toBe(puzzle.patterns[pair[1]!])
      cleared.push(...pair)
    }
    expect(cleared).toHaveLength(20)
    expect(new Set(cleared).size).toBe(20)
  })

  it('requires an exposed tile and counts mismatched selections', () => {
    const initial = createTilesState('2026-11-19')
    const blocked = 6
    expect(isTilesIndexFree(blocked, [])).toBe(false)
    expect(tilesReducer(initial, { type: 'select', index: blocked })).toBe(initial)

    const free = initial.solutionPairs[0]![0]!
    const stateWithSelection = tilesReducer(initial, { type: 'select', index: free })
    expect(stateWithSelection.selectedIndex).toBe(free)
    const otherPattern = initial.patterns.findIndex((pattern, index) => index !== free && isTilesIndexFree(index, []) && pattern !== initial.patterns[free])
    const wrongSelection = tilesReducer(stateWithSelection, { type: 'select', index: otherPattern })
    expect(wrongSelection.selectedIndex).toBeNull()
    expect(wrongSelection.moves).toBe(1)
    expect(wrongSelection.mistakes).toBe(1)
    expect(wrongSelection.clearedIndices).toEqual([])
  })

  it('clears all daily pairs on the generated exposed path', () => {
    const initial = createTilesState('2026-11-19')
    const solved = initial.solutionPairs.reduce((state, [first, second]) => {
      const selected = tilesReducer(state, { type: 'select', index: first! })
      return tilesReducer(selected, { type: 'select', index: second! })
    }, initial)

    expect(solved.phase).toBe('complete')
    expect(solved.moves).toBe(10)
    expect(solved.mistakes).toBe(0)
    expect(solved.message).toContain('All ten pairs cleared')
    expect(tilesProgress(solved).clearedIndices).toHaveLength(20)
    expect(tilesReducer(solved, { type: 'restart' })).toBe(solved)
  })

  it('restores valid cleared pairs and resets the same daily board', () => {
    const puzzle = createTilesPuzzle('2026-11-19')
    const clearedIndices = puzzle.solutionPairs.slice(0, 2).flat()
    const progress = { date: puzzle.date, clearedIndices, moves: 3, mistakes: 1 }
    const restored = createTilesState(puzzle.date, progress)
    expect(restored.clearedIndices).toEqual(clearedIndices)
    expect(restored.moves).toBe(3)
    expect(restored.mistakes).toBe(1)
    expect(validTilesProgress(progress)).toBe(true)
    expect(validTilesProgress({ ...progress, clearedIndices: [clearedIndices[0]] })).toBe(false)
    expect(validTilesProgress({ ...progress, moves: 2 })).toBe(false)
    const otherPatternIndex = puzzle.patterns.findIndex((pattern, index) => index > 0 && pattern !== puzzle.patterns[0])
    expect(validTilesProgress({ date: puzzle.date, clearedIndices: [0, otherPatternIndex], moves: 1, mistakes: 0 })).toBe(false)

    const restarted = tilesReducer(restored, { type: 'restart' })
    expect(restarted.date).toBe(puzzle.date)
    expect(restarted.patterns).toEqual(puzzle.patterns)
    expect(restarted.clearedIndices).toEqual([])
    expect(restarted.moves).toBe(0)
    expect(restarted.mistakes).toBe(0)
  })

  it('keeps daily boards solvable across a month of dates', () => {
    for (let day = 1; day <= 30; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`
      const puzzle = createTilesPuzzle(date)
      expect(puzzle.solutionPairs).toHaveLength(10)
      const cleared: number[] = []
      for (const pair of puzzle.solutionPairs) {
        expect(isTilesIndexFree(pair[0]!, cleared)).toBe(true)
        expect(isTilesIndexFree(pair[1]!, cleared)).toBe(true)
        cleared.push(...pair)
      }
      expect(new Set(cleared).size).toBe(20)
    }
  })
})
