import { describe, expect, it } from 'vitest'
import {
  advanceLatchkeyTime,
  createLatchkeyState,
  formatLatchkeyTime,
  LATCHKEY_HEIGHT,
  LATCHKEY_ROOMS,
  moveLatchkey,
  pauseLatchkey,
  resumeLatchkey,
  restartLatchkey,
  startLatchkey,
} from './latchkey'

describe('Latchkey', () => {
  it('keeps the rooms within the same readable grid size', () => {
    expect(LATCHKEY_ROOMS).toHaveLength(3)
    for (const room of LATCHKEY_ROOMS) {
      expect(room.rows).toHaveLength(LATCHKEY_HEIGHT)
      expect(room.rows.every((row) => row.length === 12)).toBe(true)
      expect(room.rows.flatMap((row) => [...row]).filter((cell) => cell === 'K')).toHaveLength(1)
      expect(room.rows.flatMap((row) => [...row]).filter((cell) => cell === 'E')).toHaveLength(1)
    }
  })

  it('moves in deliberate steps and jumps a two-tile gap in one pulse', () => {
    let state = startLatchkey(createLatchkeyState())
    state = moveLatchkey(state, 'right')
    expect(state.x).toBe(2)
    state = moveLatchkey(state, 'jump')
    expect(state).toMatchObject({ x: 5, y: 6, phase: 'playing' })
  })

  it('resets a missed gap to the room entrance without losing the run time', () => {
    let state = startLatchkey(createLatchkeyState())
    state = moveLatchkey(state, 'right')
    state = moveLatchkey(state, 'right')
    expect(state).toMatchObject({ x: 1, y: 6, hasKey: false })
    expect(state.message).toMatch(/gap was too wide/i)
    expect(advanceLatchkeyTime(state, 9).elapsedSeconds).toBe(9)
  })

  it('requires each key before opening its exit and clears all three rooms', () => {
    let state = startLatchkey(createLatchkeyState())
    const actions = [
      'right', 'jump', 'right', 'right', 'right', 'right', 'right',
      'right', 'right', 'jump', 'jump', 'left', 'right', 'right', 'right',
      'right', 'jump', 'right', 'jump', 'right', 'right',
    ] as const
    for (const action of actions) state = moveLatchkey(state, action)
    expect(state.phase).toBe('complete')
    expect(state.roomIndex).toBe(2)
    expect(state.hasKey).toBe(true)
    expect(state.message).toContain('All three doors opened')
  })

  it('keeps a keyless exit locked', () => {
    const atDoor = startLatchkey({ ...createLatchkeyState(), x: 9, hasKey: false })
    const blocked = moveLatchkey(atDoor, 'right')
    expect(blocked.phase).toBe('playing')
    expect(blocked.x).toBe(10)
    expect(blocked.message).toMatch(/exit is locked/i)
  })

  it('pauses the clock and restarts the route from the first room', () => {
    let state = startLatchkey(createLatchkeyState())
    state = advanceLatchkeyTime(state, 13)
    state = pauseLatchkey(state)
    expect(advanceLatchkeyTime(state, 9).elapsedSeconds).toBe(13)
    expect(resumeLatchkey(state).phase).toBe('playing')
    expect(restartLatchkey(state)).toMatchObject({ phase: 'ready', roomIndex: 0, x: 1, y: 6, elapsedSeconds: 0 })
    expect(formatLatchkeyTime(125)).toBe('2:05')
  })
})
