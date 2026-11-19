import { describe, expect, it } from 'vitest'
import {
  createSwitchyardState,
  SWITCHYARD_DELIVERIES_TO_WIN,
  SWITCHYARD_DESTINATIONS,
  SWITCHYARD_PASS_DURATION_MS,
  SWITCHYARD_SCHEDULE_LENGTH,
  switchyardApproachDuration,
  switchyardReducer,
  switchyardScheduleForDate,
} from './switchyard'

const DATE = '2026-11-19'

function begin(date = DATE) {
  return switchyardReducer(createSwitchyardState(date), { type: 'start' })
}

describe('Switchyard', () => {
  it('builds a repeatable, balanced daily dispatch with no long run of one depot', () => {
    const schedule = switchyardScheduleForDate(DATE)
    expect(switchyardScheduleForDate(DATE)).toEqual(schedule)
    expect(switchyardScheduleForDate('2026-11-20')).not.toEqual(schedule)
    expect(() => switchyardScheduleForDate('2026-02-30')).toThrow(RangeError)
    expect(schedule).toHaveLength(SWITCHYARD_SCHEDULE_LENGTH)
    expect(new Set(schedule.map(({ destination }) => destination))).toHaveProperty('size', 3)
    expect(schedule.every(({ cargo, destination }) => cargo.length > 0 && destination >= 0 && destination < SWITCHYARD_DESTINATIONS.length)).toBe(true)
    for (let index = 2; index < schedule.length; index += 1) {
      expect(schedule[index]!.destination === schedule[index - 1]!.destination && schedule[index]!.destination === schedule[index - 2]!.destination).toBe(false)
    }
  })

  it('routes a train only if the lever is set before the junction', () => {
    let state = begin()
    const target = state.schedule[0]!.destination
    const other = ((target + 1) % SWITCHYARD_DESTINATIONS.length) as 0 | 1 | 2
    state = switchyardReducer(state, { type: 'switch', destination: other })
    state = switchyardReducer(state, { type: 'switch', destination: target })
    state = switchyardReducer(state, { type: 'tick', deltaMs: switchyardApproachDuration(state.deliveries) - 1 })
    expect(state.deliveries).toBe(0)
    state = switchyardReducer(state, { type: 'tick', deltaMs: 1 })
    expect(state).toMatchObject({ deliveries: 1, streak: 1, lives: 3, journeyPhase: 'pass', outcome: 'delivered' })
    expect(state.score).toBe(110)

    state = switchyardReducer(state, { type: 'tick', deltaMs: SWITCHYARD_PASS_DURATION_MS })
    expect(state.shipmentIndex).toBe(1)
    expect(state.journeyPhase).toBe('approach')
    expect(state.outcome).toBeNull()
  })

  it('penalizes a wrong line, resets the streak, and ends after three missed depots', () => {
    let state = begin()
    for (let miss = 0; miss < 3; miss += 1) {
      const target = state.schedule[state.shipmentIndex]!.destination
      const wrong = ((target + 1) % SWITCHYARD_DESTINATIONS.length) as 0 | 1 | 2
      state = switchyardReducer(state, { type: 'switch', destination: wrong })
      state = switchyardReducer(state, { type: 'tick', deltaMs: switchyardApproachDuration(state.deliveries) })
      expect(state).toMatchObject({ outcome: 'misrouted', misses: miss + 1, lives: 2 - miss, streak: 0 })
      if (miss < 2) state = switchyardReducer(state, { type: 'tick', deltaMs: SWITCHYARD_PASS_DURATION_MS })
    }
    expect(state.phase).toBe('over')
    expect(state.message).toContain('Three cars missed')
  })

  it('pauses the clock, resumes, reaches the shift goal, and restarts the same daily schedule', () => {
    let state = begin()
    state = switchyardReducer(state, { type: 'tick', deltaMs: 520 })
    state = switchyardReducer(state, { type: 'pause' })
    state = switchyardReducer(state, { type: 'tick', deltaMs: 700 })
    expect(state.journeyElapsedMs).toBe(520)
    state = switchyardReducer(state, { type: 'resume' })

    for (let delivery = 0; delivery < SWITCHYARD_DELIVERIES_TO_WIN; delivery += 1) {
      const target = state.schedule[state.shipmentIndex]!.destination
      state = switchyardReducer(state, { type: 'switch', destination: target })
      state = switchyardReducer(state, { type: 'tick', deltaMs: switchyardApproachDuration(state.deliveries) - state.journeyElapsedMs })
      expect(state.deliveries).toBe(delivery + 1)
      if (state.phase === 'won') break
      state = switchyardReducer(state, { type: 'tick', deltaMs: SWITCHYARD_PASS_DURATION_MS })
    }
    expect(state.phase).toBe('won')
    expect(state.message).toContain('Shift complete')
    expect(switchyardReducer(state, { type: 'restart' })).toMatchObject({ phase: 'ready', date: DATE, deliveries: 0, misses: 0, lives: 3, score: 0 })
    expect(switchyardReducer(state, { type: 'restart' }).schedule).toEqual(state.schedule)
  })
})
