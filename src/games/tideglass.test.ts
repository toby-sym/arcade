import { describe, expect, it } from 'vitest'
import {
  createTideglassState,
  solveTideglassPuzzle,
  tideglassProgress,
  tideglassPuzzleForDate,
  tideglassReducer,
  validTideglassProgress,
  type TideglassDirection,
} from './tideglass'

describe('Tideglass daily harbors', () => {
  it('creates repeatable, solvable daily routes with a shortest-move par', () => {
    for (const date of ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-11-19', '2027-05-23']) {
      const puzzle = tideglassPuzzleForDate(date)
      expect(tideglassPuzzleForDate(date)).toEqual(puzzle)
      const solution = solveTideglassPuzzle(puzzle)
      expect(solution).not.toBeNull()
      expect(solution).toHaveLength(puzzle.par)

      let state = tideglassReducer(createTideglassState(date), { type: 'start' })
      for (const step of solution!) {
        if (step.type === 'sluice') {
          state = tideglassReducer(state, { type: 'toggle-sluice', index: step.index })
        } else {
          state = tideglassReducer(state, { type: 'select', buoy: step.buoy })
          state = tideglassReducer(state, { type: 'move', direction: step.direction })
        }
      }

      expect(state.phase).toBe('complete')
      expect(state.actionCount).toBe(puzzle.par)
      expect(state.positions).toEqual(puzzle.docks)
    }
  })

  it('counts legal buoy steps and sluice changes but ignores blocked moves', () => {
    let state = tideglassReducer(createTideglassState('2026-11-19'), { type: 'start' })
    const initialPositions = state.positions
    const directions: TideglassDirection[] = ['up', 'right', 'down', 'left']
    const legal = directions.find((direction) => {
      const next = tideglassReducer(state, { type: 'move', direction })
      return next.actionCount === state.actionCount + 1
    })
    expect(legal).toBeDefined()
    const blocked = directions.find((direction) => !legal || direction !== legal)!
    const afterBlocked = tideglassReducer(state, { type: 'move', direction: blocked })
    if (afterBlocked.actionCount === state.actionCount) {
      expect(afterBlocked.positions).toEqual(initialPositions)
    }

    state = tideglassReducer(state, { type: 'toggle-sluice', index: 0 })
    expect(state.actionCount).toBe(1)
    expect(state.openSluices[0]).toBe(true)
  })

  it('restores valid progress, rejects tampered actions, and restarts the route', () => {
    const date = '2026-11-19'
    const route = solveTideglassPuzzle(tideglassPuzzleForDate(date))!
    let state = tideglassReducer(createTideglassState(date), { type: 'start' })
    for (const step of route.slice(0, 4)) {
      if (step.type === 'sluice') state = tideglassReducer(state, { type: 'toggle-sluice', index: step.index })
      else {
        state = tideglassReducer(state, { type: 'select', buoy: step.buoy })
        state = tideglassReducer(state, { type: 'move', direction: step.direction })
      }
    }

    const progress = tideglassProgress(state)!
    expect(validTideglassProgress(progress)).toBe(true)
    expect(createTideglassState(date, progress)).toMatchObject({
      positions: state.positions,
      openSluices: state.openSluices,
      selectedBuoy: state.selectedBuoy,
      actionCount: state.actionCount,
      phase: 'playing',
    })
    expect(createTideglassState(date, { ...progress, actions: [...progress.actions, { type: 'sluice', index: 9 }] })).toMatchObject({ phase: 'ready', actionCount: 0 })
    expect(createTideglassState(date, { ...progress, date: '2026-02-30' })).toMatchObject({ phase: 'ready', actionCount: 0 })
    expect(tideglassReducer(state, { type: 'restart' })).toMatchObject({ phase: 'ready', actionCount: 0, actions: [] })
  })

  it('does not allow a second buoy to occupy a moored berth', () => {
    const date = '2026-11-19'
    const puzzle = tideglassPuzzleForDate(date)
    const solution = solveTideglassPuzzle(puzzle)!
    let state = tideglassReducer(createTideglassState(date), { type: 'start' })
    for (const step of solution) {
      if (step.type === 'sluice') state = tideglassReducer(state, { type: 'toggle-sluice', index: step.index })
      else {
        state = tideglassReducer(state, { type: 'select', buoy: step.buoy })
        state = tideglassReducer(state, { type: 'move', direction: step.direction })
      }
    }
    expect(state.phase).toBe('complete')
    expect(state.positions).toEqual(puzzle.docks)
    expect(tideglassReducer(state, { type: 'move', direction: 'left' })).toBe(state)
  })
})
