import { describe, expect, it } from 'vitest'
import {
  createGravityLoomState,
  gravityLoomProgress,
  gravityLoomReducer,
  gravityLoomPuzzleForDate,
  GRAVITY_LOOM_BOARD_SIZE,
  GRAVITY_LOOM_STAGE_COUNT,
  isGravityLoomProgress,
  rollGravityLoomSpark,
  solveGravityLoomPuzzle,
} from './gravityLoom'

const DATE = '2026-11-19'

describe('Gravity Loom', () => {
  it('creates deterministic, solvable daily chambers with a real shortest-tilt par', () => {
    for (const date of [DATE, '2026-11-20', '2027-01-01']) {
      for (let stage = 0; stage < GRAVITY_LOOM_STAGE_COUNT; stage += 1) {
        const puzzle = gravityLoomPuzzleForDate(date, stage)
        const solution = solveGravityLoomPuzzle(puzzle)
        expect(gravityLoomPuzzleForDate(date, stage)).toEqual(puzzle)
        expect(solution).not.toBeNull()
        expect(solution).toHaveLength(puzzle.par)
        expect(puzzle.par).toBeGreaterThanOrEqual(2)
        expect(puzzle.start).not.toBe(puzzle.receiver)
        expect(new Set(puzzle.walls).size).toBe(puzzle.walls.length)
        expect(puzzle.walls).not.toContain(puzzle.start)
        expect(puzzle.walls).not.toContain(puzzle.receiver)
        if (stage === 0) {
          expect(puzzle.portals).toBeNull()
        } else {
          expect(puzzle.portals).not.toBeNull()
          expect(puzzle.portals?.[0]).not.toBe(puzzle.portals?.[1])
          expect(puzzle.walls).not.toContain(puzzle.portals?.[0])
          expect(puzzle.walls).not.toContain(puzzle.portals?.[1])
        }
      }
    }
    expect(() => gravityLoomPuzzleForDate('2026-02-30', 0)).toThrow(RangeError)
    expect(() => gravityLoomPuzzleForDate(DATE, GRAVITY_LOOM_STAGE_COUNT)).toThrow(RangeError)
  })

  it('rolls through a paired portal and keeps moving in the same tilt', () => {
    const puzzle = {
      walls: [],
      portals: [10, 38] as [number, number],
      start: 8,
      receiver: 34,
      par: 1,
    }
    expect(rollGravityLoomSpark(puzzle, puzzle.start, 'right')).toEqual({
      position: 41,
      reachedReceiver: false,
      usedPortal: true,
    })
    expect(GRAVITY_LOOM_BOARD_SIZE).toBe(7)
  })

  it('clears four receivers, counts tilts, pauses, resumes, and restarts the same route', () => {
    let state = gravityLoomReducer(createGravityLoomState(DATE), { type: 'start' })
    expect(state.phase).toBe('playing')

    for (let stage = 0; stage < GRAVITY_LOOM_STAGE_COUNT; stage += 1) {
      const puzzle = state.puzzles[state.stageIndex]!
      const solution = solveGravityLoomPuzzle({ ...puzzle, start: state.spark })!
      if (stage === 0) {
        state = gravityLoomReducer(state, { type: 'tilt', direction: solution[0]! })
        state = gravityLoomReducer(state, { type: 'pause' })
        const saved = gravityLoomProgress(state)!
        expect(isGravityLoomProgress(saved)).toBe(true)
        expect(gravityLoomReducer(state, { type: 'tilt', direction: 'left' })).toBe(state)
        const restored = createGravityLoomState(DATE, saved)
        expect(restored).toMatchObject({ phase: 'paused', stageIndex: state.stageIndex, spark: state.spark, currentMoves: state.currentMoves })
        state = gravityLoomReducer(restored, { type: 'resume' })
        for (const direction of solution.slice(1)) state = gravityLoomReducer(state, { type: 'tilt', direction })
      } else {
        for (const direction of solution) state = gravityLoomReducer(state, { type: 'tilt', direction })
      }
    }

    expect(state.phase).toBe('complete')
    expect(state.completedStageMoves).toHaveLength(GRAVITY_LOOM_STAGE_COUNT)
    expect(state.totalMoves).toBe(state.completedStageMoves.reduce((sum, moves) => sum + moves, 0))
    expect(state.message).toContain('All four receivers are lit')
    const completedProgress = gravityLoomProgress(state)!
    expect(isGravityLoomProgress(completedProgress)).toBe(true)
    expect(createGravityLoomState(DATE, completedProgress)).toMatchObject({ phase: 'complete', totalMoves: state.totalMoves })

    const restarted = gravityLoomReducer(state, { type: 'restart' })
    expect(restarted).toMatchObject({ date: DATE, phase: 'ready', totalMoves: 0, stageIndex: 0 })
    expect(restarted.puzzles).toEqual(state.puzzles)
    expect(isGravityLoomProgress({ ...completedProgress, stageIndex: 88 })).toBe(false)
  })
})
