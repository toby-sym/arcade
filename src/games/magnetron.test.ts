import { describe, expect, it } from 'vitest'
import {
  advanceMagnetron,
  createMagnetronState,
  formatMagnetronTime,
  magnetronAcceleration,
  MAGNETRON_COURSES,
  MAGNETRON_RESET_PENALTY_MS,
  pauseMagnetron,
  resetMagnetronCourse,
  resumeMagnetron,
  restartMagnetron,
  startMagnetron,
  toggleMagnetronPost,
} from './magnetron'

describe('Magnetron field courses', () => {
  it('starts with a fresh puck and one polarity for every post', () => {
    const state = createMagnetronState()
    expect(MAGNETRON_COURSES).toHaveLength(3)
    expect(state.phase).toBe('ready')
    expect(state.puck).toMatchObject({ x: 58, y: 200, vx: 68, vy: 0 })
    expect(state.posts.map(({ polarity }) => polarity)).toEqual([-1, 1, -1])
  })

  it('reverses field direction and ignores invalid or inactive switches', () => {
    const ready = createMagnetronState()
    expect(toggleMagnetronPost(ready, 0)).toBe(ready)
    const live = startMagnetron(ready)
    const reversed = toggleMagnetronPost(live, 0)
    expect(reversed.posts[0]?.polarity).toBe(1)
    expect(reversed.puck.vx).not.toBe(live.puck.vx)
    expect(reversed.message).toMatch(/field pulse/)
    expect(toggleMagnetronPost(live, -1)).toBe(live)
    expect(toggleMagnetronPost(live, 9)).toBe(live)
    expect(toggleMagnetronPost(pauseMagnetron(live), 0).posts[0]?.polarity).toBe(-1)
    expect(magnetronAcceleration({ x: 145, y: 80 }, [{ x: 245, y: 80, polarity: 1, name: 'pull' }]).x).toBeGreaterThan(0)
    expect(magnetronAcceleration({ x: 145, y: 80 }, [{ x: 245, y: 80, polarity: -1, name: 'push' }]).x).toBeLessThan(0)
  })

  it('advances with bounded motion and can pause and resume', () => {
    const live = startMagnetron(createMagnetronState())
    const moved = advanceMagnetron(live, 50)
    expect(moved.elapsedMs).toBe(50)
    expect(moved.puck.x).not.toBe(live.puck.x)
    expect(moved.puck.x).toBeGreaterThanOrEqual(12)
    expect(advanceMagnetron(pauseMagnetron(moved), 50)).toMatchObject({ elapsedMs: 50, puck: moved.puck })
    expect(resumeMagnetron(pauseMagnetron(moved)).phase).toBe('playing')
    expect(advanceMagnetron(moved, 1000).elapsedMs).toBe(1050)
    expect(resetMagnetronCourse(pauseMagnetron(live)).phase).toBe('paused')
  })

  it('charges a reset penalty, carries to the next course, and records a clean final time', () => {
    const live = startMagnetron(createMagnetronState())
    const changed = toggleMagnetronPost(live, 1)
    const reset = resetMagnetronCourse({ ...changed, elapsedMs: 900 })
    expect(reset).toMatchObject({ phase: 'playing', elapsedMs: 900 + MAGNETRON_RESET_PENALTY_MS, resets: 1, puck: { x: 58, y: 200 } })

    const nextCourse = advanceMagnetron({ ...live, puck: { ...live.puck, x: 528, y: 200, vx: 0, vy: 0 } }, 16)
    expect(nextCourse.courseIndex).toBe(1)
    expect(nextCourse.puck).toMatchObject({ x: 58, y: 320 })

    const lastCourse = advanceMagnetron({ ...nextCourse, courseIndex: 2, puck: { ...nextCourse.puck, x: 528, y: 92, vx: 0, vy: 0 } }, 16)
    expect(lastCourse.phase).toBe('won')
    expect(formatMagnetronTime(lastCourse.elapsedMs)).toMatch(/^\d{2}:\d{2}\.\d{2}$/)
    expect(restartMagnetron(lastCourse)).toMatchObject({ phase: 'ready', elapsedMs: 0, resets: 0, courseIndex: 0 })
  })
})
