import { describe, expect, it } from 'vitest'
import {
  colorConduitProgress,
  colorConduitPuzzleForDate,
  colorConduitReducer,
  createColorConduitState,
  formatColorConduitTime,
  validColorConduitProgress,
} from './colorConduit'

const DATE = '2026-11-19'

describe('Color Conduit', () => {
  it('generates a deterministic daily board with four disjoint complete routes', () => {
    const puzzle = colorConduitPuzzleForDate(DATE)
    expect(colorConduitPuzzleForDate(DATE)).toEqual(puzzle)
    expect(colorConduitPuzzleForDate('2026-11-20')).not.toEqual(puzzle)
    expect(() => colorConduitPuzzleForDate('2026-02-30')).toThrow(RangeError)
    expect(puzzle.routes).toHaveLength(4)

    const occupied = new Set<number>()
    for (const route of puzzle.routes) {
      expect(route.solution).toHaveLength(9)
      expect(route.start).toBe(route.solution[0])
      expect(route.end).toBe(route.solution.at(-1))
      expect(new Set(route.solution).size).toBe(route.solution.length)
      for (let index = 0; index < route.solution.length; index += 1) {
        const cell = route.solution[index]!
        expect(occupied.has(cell)).toBe(false)
        occupied.add(cell)
        if (index > 0) {
          const previous = route.solution[index - 1]!
          expect(Math.abs(Math.floor(cell / 6) - Math.floor(previous / 6)) + Math.abs(cell % 6 - previous % 6)).toBe(1)
        }
      }
    }
    expect(occupied.size).toBe(36)
  })

  it('requires adjacent cells, protects other terminals, and allows undo', () => {
    let state = colorConduitReducer(createColorConduitState(DATE), { type: 'start' })
    const route = state.puzzle.routes[0]!
    state = colorConduitReducer(state, { type: 'select', signal: route.signal })
    state = colorConduitReducer(state, { type: 'cell', index: route.start })
    const nonAdjacent = route.solution[2]!
    state = colorConduitReducer(state, { type: 'cell', index: nonAdjacent })
    expect(state.mistakes).toBe(1)
    expect(state.paths[route.signal]).toEqual([route.start])

    state = colorConduitReducer(state, { type: 'cell', index: route.solution[1]! })
    expect(state.paths[route.signal]).toEqual(route.solution.slice(0, 2))
    state = colorConduitReducer(state, { type: 'undo' })
    expect(state.paths[route.signal]).toEqual([route.start])
    expect(state.moves).toBeGreaterThan(1)
  })

  it('solves the board, saves local progress, and restores the completed result', () => {
    const initial = createColorConduitState(DATE)
    let state = colorConduitReducer(initial, { type: 'start' })
    state = colorConduitReducer(state, { type: 'tick' })
    for (const route of initial.puzzle.routes) {
      state = colorConduitReducer(state, { type: 'select', signal: route.signal })
      for (const cell of route.solution) state = colorConduitReducer(state, { type: 'cell', index: cell })
    }

    expect(state.phase).toBe('complete')
    expect(state.paths.flat()).toHaveLength(36)
    expect(state.message).toContain('Station online')
    expect(formatColorConduitTime(state.elapsedSeconds)).toBe('00:01')
    const progress = colorConduitProgress(state)
    expect(validColorConduitProgress(progress)).toBe(true)
    expect(createColorConduitState(DATE, progress).phase).toBe('complete')
  })

  it('pauses the clock, resumes progress, rejects corrupt routes, and resets cleanly', () => {
    let state = colorConduitReducer(createColorConduitState(DATE), { type: 'start' })
    state = colorConduitReducer(state, { type: 'tick' })
    state = colorConduitReducer(state, { type: 'pause' })
    state = colorConduitReducer(state, { type: 'tick' })
    expect(state.elapsedSeconds).toBe(1)
    state = colorConduitReducer(state, { type: 'resume' })
    state = colorConduitReducer(state, { type: 'select', signal: state.puzzle.routes[0]!.signal })
    state = colorConduitReducer(state, { type: 'cell', index: state.puzzle.routes[0]!.start })
    const progress = colorConduitProgress(state)
    expect(createColorConduitState(DATE, progress).phase).toBe('paused')
    expect(validColorConduitProgress({ ...progress, paths: [[0, 35], [], [], []] })).toBe(false)
    expect(validColorConduitProgress({ ...progress, elapsedSeconds: -1 })).toBe(false)

    const restarted = colorConduitReducer(state, { type: 'restart' })
    expect(restarted).toMatchObject({ date: DATE, phase: 'ready', moves: 0, mistakes: 0, elapsedSeconds: 0 })
    expect(restarted.paths).toEqual([[], [], [], []])
    expect(createColorConduitState('2026-11-20', progress).paths).toEqual([[], [], [], []])
  })
})
