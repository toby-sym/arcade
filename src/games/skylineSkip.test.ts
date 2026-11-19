import { describe, expect, it } from 'vitest'
import {
  createSkylineState,
  SKYLINE_FINISH_X,
  SKYLINE_PLAYER_WIDTH,
  SKYLINE_VIEW_WIDTH,
  SKYLINE_WIDTH,
  skylineCameraX,
  skylineReducer,
} from './skylineSkip'

const playingState = () => skylineReducer(createSkylineState(), { type: 'start' })

describe('Skyline Skip', () => {
  it('moves smoothly, buffers jumps, and collects nearby shards', () => {
    const started = playingState()
    const running = skylineReducer(started, { type: 'step', direction: 1, deltaMs: 50 })
    expect(running.x).toBeGreaterThan(started.x)
    expect(running.vx).toBeGreaterThan(0)

    const jump = skylineReducer(running, { type: 'step', direction: 0, deltaMs: 16, jumpPressed: true })
    expect(jump.y).toBeLessThan(running.y)
    expect(jump.grounded).toBe(false)

    const nearShard = { ...started, x: 100 }
    const collected = skylineReducer(nearShard, { type: 'step', direction: 0, deltaMs: 16 })
    expect(collected.shards).toContain(0)
    expect(collected.score).toBe(10)
  })

  it('uses checkpoints after a hazard and ends the run after the last life', () => {
    const atHazard = { ...playingState(), x: 190, vx: 270 }
    const hit = skylineReducer(atHazard, { type: 'step', direction: 1, deltaMs: 16 })
    expect(hit.lives).toBe(2)
    expect(hit.x).toBe(0)
    expect(hit.phase).toBe('playing')

    const atLaterHazard = { ...playingState(), x: 1265, vx: 270, checkpoint: 1, lives: 1 }
    const lost = skylineReducer(atLaterHazard, { type: 'step', direction: 1, deltaMs: 50 })
    expect(lost.lives).toBe(0)
    expect(lost.phase).toBe('over')
    expect(lost.x).toBe(1170)
  })

  it('charges a life for falling between roofs', () => {
    let falling = { ...playingState(), x: 360, y: 260, vx: 270, grounded: false, coyoteMs: 0 }
    for (let frame = 0; frame < 20 && falling.lives === 3; frame += 1) {
      falling = skylineReducer(falling, { type: 'step', direction: 1, deltaMs: 50 })
    }
    expect(falling.lives).toBe(2)
    expect(falling.x).toBe(0)
  })

  it('finishes at the beacon and keeps camera movement within the course', () => {
    const atBeacon = { ...playingState(), x: SKYLINE_FINISH_X - SKYLINE_PLAYER_WIDTH - 2, vx: 270, score: 40, lives: 2 }
    const won = skylineReducer(atBeacon, { type: 'step', direction: 1, deltaMs: 16 })
    expect(won.phase).toBe('won')
    expect(won.score).toBeGreaterThan(40)
    expect(skylineCameraX(0)).toBe(0)
    expect(skylineCameraX(10_000)).toBeGreaterThan(0)
    expect(skylineCameraX(10_000) + SKYLINE_VIEW_WIDTH).toBeLessThanOrEqual(SKYLINE_WIDTH)
  })

  it('pauses, resumes, and resets all run progress', () => {
    const running = { ...playingState(), x: 100, score: 20, shards: [0, 1], lives: 2 }
    const paused = skylineReducer(running, { type: 'pause' })
    expect(skylineReducer(paused, { type: 'step', direction: 1, deltaMs: 50 })).toBe(paused)
    expect(skylineReducer(paused, { type: 'resume' }).phase).toBe('playing')
    expect(skylineReducer(paused, { type: 'restart' })).toMatchObject({ phase: 'ready', x: 0, score: 0, lives: 3, shards: [] })
    expect(SKYLINE_FINISH_X).toBeGreaterThan(SKYLINE_PLAYER_WIDTH)
  })
})
