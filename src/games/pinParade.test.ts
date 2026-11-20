import { describe, expect, it } from 'vitest'
import {
  PIN_PARADE_FRAME_COUNT,
  adjustPinParadeAim,
  advancePinParade,
  createPinParadeState,
  launchPinParadeBall,
  nextPinParadeRoll,
  pausePinParade,
  restartPinParade,
  resumePinParade,
  scorePinParade,
  setPinParadeControls,
  startPinParade,
} from './pinParade'

function rollUntilResult(state: ReturnType<typeof createPinParadeState>) {
  for (let tick = 0; tick < 900 && state.phase === 'rolling'; tick += 1) state = advancePinParade(state, 1 / 60)
  return state
}

describe('Pin Parade bowling game', () => {
  it('starts a full ten-frame game with ten numbered pins', () => {
    const state = createPinParadeState()
    expect(state.frames).toHaveLength(PIN_PARADE_FRAME_COUNT)
    expect(state.pins.map((pin) => pin.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(state.phase).toBe('ready')
  })

  it('clamps line, power, and spin controls and launches once per roll', () => {
    const aiming = startPinParade(createPinParadeState())
    const controlled = setPinParadeControls(aiming, 60, 130, -130)
    expect(controlled).toMatchObject({ aimDegrees: 18, power: 100, spin: -100 })
    expect(adjustPinParadeAim(aiming, Number.NaN)).toBe(aiming)
    expect(launchPinParadeBall(controlled)).toMatchObject({ phase: 'rolling', ball: { y: 652 }, frames: aiming.frames })
    expect(launchPinParadeBall(launchPinParadeBall(controlled))).toMatchObject({ phase: 'rolling' })
  })

  it('simulates a centerline roll into the pins and records the first ball', () => {
    const shot = launchPinParadeBall(startPinParade(createPinParadeState()))
    const result = rollUntilResult(shot)
    expect(result.phase).toBe('result')
    expect(result.pinsKnocked).toBeGreaterThan(0)
    expect(result.frames[0]).toEqual([result.pinsKnocked])
    expect(nextPinParadeRoll(result).phase).toBe('aiming')
  })

  it('pauses a roll in place and resets the whole game', () => {
    const shot = launchPinParadeBall(startPinParade(createPinParadeState()))
    const paused = pausePinParade(shot)
    expect(paused).toMatchObject({ phase: 'paused', resumePhase: 'rolling' })
    expect(advancePinParade(paused, 1).pins).toEqual(paused.pins)
    expect(resumePinParade(paused).phase).toBe('rolling')
    expect(restartPinParade(paused)).toMatchObject({ phase: 'ready', frameIndex: 0, frames: Array.from({ length: 10 }, () => []), ball: null })
  })

  it('calculates strike bonuses, spares, and the perfect 300 game', () => {
    const perfect = [...Array.from({ length: 9 }, () => [10]), [10, 10, 10]]
    expect(scorePinParade(perfect).total).toBe(300)
    expect(scorePinParade(perfect).frames[9]).toMatchObject({ score: 30, cumulative: 300 })

    const spare = [[7, 3], [4, 5], ...Array.from({ length: 8 }, () => [])]
    const scored = scorePinParade(spare)
    expect(scored.frames[0]).toMatchObject({ score: 14, cumulative: 14 })
    expect(scored.frames[1]).toMatchObject({ score: 9, cumulative: 23 })
  })
})
