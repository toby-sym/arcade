import { describe, expect, it } from 'vitest'
import {
  createMazeDashState,
  isMazeDashWall,
  MAZE_DASH_CELL_COUNT,
  MAZE_DASH_EXIT,
  MAZE_DASH_START,
  MAZE_DASH_WIDTH,
  mazeDashReducer,
} from './mazeDash'

describe('Maze Dash', () => {
  it('keeps every gem and the exit reachable from the starting tile', () => {
    const state = createMazeDashState()
    const reachable = new Set([MAZE_DASH_START])
    const pending = [MAZE_DASH_START]
    while (pending.length > 0) {
      const cell = pending.pop()!
      const row = Math.floor(cell / MAZE_DASH_WIDTH)
      const column = cell % MAZE_DASH_WIDTH
      const neighbors = [
        row > 0 ? cell - MAZE_DASH_WIDTH : -1,
        column < MAZE_DASH_WIDTH - 1 ? cell + 1 : -1,
        row < MAZE_DASH_WIDTH - 1 ? cell + MAZE_DASH_WIDTH : -1,
        column > 0 ? cell - 1 : -1,
      ]
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && !isMazeDashWall(neighbor) && !reachable.has(neighbor)) {
          reachable.add(neighbor)
          pending.push(neighbor)
        }
      }
    }

    expect(state.pellets.every((cell) => reachable.has(cell))).toBe(true)
    expect(reachable.has(MAZE_DASH_EXIT)).toBe(true)
    expect(state.pellets).not.toContain(MAZE_DASH_START)
    expect(state.pellets).not.toContain(MAZE_DASH_EXIT)
    expect(state.pellets.length).toBeLessThan(MAZE_DASH_CELL_COUNT)
  })

  it('collects gems, keeps walls solid, and moves sentries on every second step', () => {
    const ready = createMazeDashState()
    const playing = mazeDashReducer(ready, { type: 'start' })
    expect(mazeDashReducer(playing, { type: 'move', direction: 'up' })).toBe(playing)

    const first = mazeDashReducer(playing, { type: 'move', direction: 'right' })
    expect(first.player).toBe(15)
    expect(first.score).toBe(10)
    expect(first.pellets).not.toContain(15)

    const second = mazeDashReducer(first, { type: 'move', direction: 'right' })
    expect(second.moves).toBe(2)
    expect(second.sentries).not.toEqual(first.sentries)
  })

  it('loses a life on contact and wins when the exit opens', () => {
    const base = createMazeDashState()
    const playing = { ...base, phase: 'playing' as const, sentries: [15, 71, 144] }
    const caught = mazeDashReducer(playing, { type: 'move', direction: 'right' })
    expect(caught.lives).toBe(2)
    expect(caught.player).toBe(MAZE_DASH_START)
    expect(caught.phase).toBe('playing')

    const atExitApproach = { ...base, phase: 'playing' as const, player: MAZE_DASH_EXIT - 1, pellets: [], moves: 1 }
    const won = mazeDashReducer(atExitApproach, { type: 'move', direction: 'right' })
    expect(won.phase).toBe('won')
    expect(won.player).toBe(MAZE_DASH_EXIT)
  })

  it('pauses, resumes, and restarts the maze', () => {
    const playing = mazeDashReducer(createMazeDashState(), { type: 'start' })
    const paused = mazeDashReducer(playing, { type: 'pause' })
    expect(mazeDashReducer(paused, { type: 'move', direction: 'right' })).toBe(paused)
    expect(mazeDashReducer(paused, { type: 'resume' }).phase).toBe('playing')
    expect(mazeDashReducer(paused, { type: 'restart' })).toMatchObject({ phase: 'ready', lives: 3, score: 0, player: MAZE_DASH_START })
  })
})
