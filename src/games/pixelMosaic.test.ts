import { describe, expect, it } from 'vitest'
import {
  createPixelMosaicState,
  formatPixelMosaicTime,
  markPixelMosaicCell,
  pausePixelMosaic,
  pixelMosaicElapsedMs,
  pixelMosaicProgress,
  pixelMosaicPuzzleForDate,
  resumePixelMosaic,
  startPixelMosaic,
  validPixelMosaicProgress,
} from './pixelMosaic'

describe('Pixel Mosaic', () => {
  it('creates a stable daily picture and matching row and column runs', () => {
    const first = pixelMosaicPuzzleForDate('2026-11-20')
    const again = pixelMosaicPuzzleForDate('2026-11-20')
    expect(first).toEqual(again)
    expect(first.solution).toHaveLength(64)
    expect(first.rowClues).toHaveLength(8)
    expect(first.columnClues).toHaveLength(8)
    expect(first.rowClues.flat().reduce((sum, count) => sum + count, 0)).toBe(first.solution.filter(Boolean).length)
    expect(first.columnClues.flat().reduce((sum, count) => sum + count, 0)).toBe(first.solution.filter(Boolean).length)
    expect(() => pixelMosaicPuzzleForDate('2026-02-30')).toThrow(RangeError)
  })

  it('keeps every original daily picture uniquely solvable from its run clues', () => {
    const seen = new Set<string>()
    const ambiguous: string[] = []
    for (let day = 1; day <= 366 && seen.size < 12; day += 1) {
      const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10)
      const puzzle = pixelMosaicPuzzleForDate(date)
      if (seen.has(puzzle.name)) continue
      seen.add(puzzle.name)
      if (countSolutions(puzzle) !== 1) ambiguous.push(puzzle.name)
    }
    expect(seen.size).toBe(12)
    expect(ambiguous).toEqual([])
  })

  it('reveals the picture only after every light and dark square is marked correctly', () => {
    let state = startPixelMosaic(createPixelMosaicState('2026-11-20'), 1_000)
    state = markPixelMosaicCell(state, 0, state.solution[0] ? 'filled' : 'empty', 1_010)
    expect(state.phase).toBe('playing')
    for (let index = 1; index < state.solution.length; index += 1) {
      state = markPixelMosaicCell(state, index, state.solution[index] ? 'filled' : 'empty', 1_000 + index * 10)
    }
    expect(state.phase).toBe('complete')
    expect(state.mistakes).toBe(0)
    expect(state.elapsedMs).toBe(630)
    expect(pixelMosaicProgress(state).phase).toBe('complete')
  })

  it('counts incorrect marks once and lets players clear them', () => {
    const state = startPixelMosaic(createPixelMosaicState('2026-11-20'), 0)
    const emptyIndex = state.solution.findIndex((filled) => !filled)
    const wrong = markPixelMosaicCell(state, emptyIndex, 'filled', 50)
    expect(wrong.mistakes).toBe(1)
    expect(markPixelMosaicCell(wrong, emptyIndex, 'filled', 60).mistakes).toBe(1)
    expect(markPixelMosaicCell(wrong, emptyIndex, 'empty', 60).mistakes).toBe(1)
    expect(markPixelMosaicCell(state, emptyIndex, 'empty', 50).mistakes).toBe(0)
  })

  it('pauses the clock, restores an interrupted run paused, and resumes elapsed time', () => {
    const playing = startPixelMosaic(createPixelMosaicState('2026-11-20'), 1_000)
    expect(pixelMosaicElapsedMs(playing, 4_500)).toBe(3_500)
    const paused = pausePixelMosaic(playing, 4_500)
    expect(paused.elapsedMs).toBe(3_500)
    expect(createPixelMosaicState(paused.date, pixelMosaicProgress(paused)).phase).toBe('paused')
    const resumed = resumePixelMosaic(paused, 8_000)
    expect(pixelMosaicElapsedMs(resumed, 9_250)).toBe(4_750)
    expect(formatPixelMosaicTime(125_000)).toBe('02:05')
  })

  it('rejects malformed progress and validates completed boards', () => {
    const state = createPixelMosaicState('2026-11-20')
    const progress = pixelMosaicProgress(state)
    expect(validPixelMosaicProgress(progress)).toBe(true)
    expect(validPixelMosaicProgress({ ...progress, cells: ['filled'] })).toBe(false)
    expect(validPixelMosaicProgress({ ...progress, elapsedMs: -1 })).toBe(false)
    expect(validPixelMosaicProgress({ ...progress, date: '2026-02-30' })).toBe(false)
    expect(validPixelMosaicProgress({ ...progress, phase: 'complete' })).toBe(false)
  })
})

function countSolutions(puzzle: ReturnType<typeof pixelMosaicPuzzleForDate>): number {
  const candidates = puzzle.rowClues.map((clue) => Array.from({ length: 256 }, (_, mask) => mask).filter((mask) => JSON.stringify(maskRuns(mask)) === JSON.stringify(clue)))
  const rows: number[] = []
  let solutions = 0
  function search(row: number) {
    if (solutions > 1) return
    if (row === 8) {
      if (puzzle.columnClues.every((clue, column) => JSON.stringify(maskRuns(rows.reduce((mask, bits, y) => mask | (((bits >> column) & 1) << y), 0))) === JSON.stringify(clue))) solutions += 1
      return
    }
    for (const mask of candidates[row]!) {
      rows.push(mask)
      let valid = true
      for (let column = 0; column < 8 && valid; column += 1) {
        const clue = puzzle.columnClues[column]!
        let clueIndex = 0
        let run = 0
        for (const partial of rows) {
          if ((partial >> column) & 1) {
            run += 1
            if (run > (clue[clueIndex] ?? 0)) { valid = false; break }
          } else if (run > 0) {
            if (run !== clue[clueIndex]) { valid = false; break }
            clueIndex += 1
            run = 0
          }
        }
      }
      if (valid) search(row + 1)
      rows.pop()
      if (solutions > 1) return
    }
  }
  search(0)
  return solutions
}

function maskRuns(mask: number): number[] {
  const result: number[] = []
  let run = 0
  for (let bit = 0; bit < 8; bit += 1) {
    if ((mask >> bit) & 1) run += 1
    else if (run > 0) { result.push(run); run = 0 }
  }
  if (run > 0) result.push(run)
  return result.length ? result : [0]
}
