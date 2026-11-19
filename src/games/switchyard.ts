export const SWITCHYARD_DESTINATIONS = [
  { name: 'Foundry', color: 'amber', glyph: '◆' },
  { name: 'Harbor', color: 'cyan', glyph: '●' },
  { name: 'Market', color: 'coral', glyph: '▲' },
] as const

export const SWITCHYARD_DELIVERIES_TO_WIN = 15
export const SWITCHYARD_SCHEDULE_LENGTH = 20
export const SWITCHYARD_STARTING_LIVES = 3
export const SWITCHYARD_PASS_DURATION_MS = 540

export type SwitchyardDestination = 0 | 1 | 2
export type SwitchyardPhase = 'ready' | 'playing' | 'paused' | 'won' | 'over'
export type SwitchyardJourneyPhase = 'approach' | 'pass'

export interface SwitchyardShipment {
  destination: SwitchyardDestination
  cargo: string
}

export interface SwitchyardState {
  date: string
  schedule: SwitchyardShipment[]
  shipmentIndex: number
  journeyPhase: SwitchyardJourneyPhase
  journeyElapsedMs: number
  elapsedMs: number
  switchRoute: SwitchyardDestination
  deliveries: number
  misses: number
  lives: number
  streak: number
  score: number
  outcome: 'delivered' | 'misrouted' | null
  phase: SwitchyardPhase
  message: string
}

export type SwitchyardAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'switch'; destination: SwitchyardDestination }
  | { type: 'tick'; deltaMs: number }

export function switchyardScheduleForDate(date: string): SwitchyardShipment[] {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  let seed = 2166136261
  for (const character of `switchyard:${date}`) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x1_0000_0000
  }
  const cargo = ['tea', 'copper', 'letters', 'oranges', 'lanterns', 'fabric', 'cocoa', 'spare parts', 'post', 'glass']
  let previous: number | null = null
  let repeatCount = 0
  return Array.from({ length: SWITCHYARD_SCHEDULE_LENGTH }, (_, index) => {
    let destination = Math.floor(random() * SWITCHYARD_DESTINATIONS.length)
    if (destination === previous) repeatCount += 1
    else repeatCount = 1
    if (repeatCount > 2) {
      destination = (destination + 1 + Math.floor(random() * (SWITCHYARD_DESTINATIONS.length - 1))) % SWITCHYARD_DESTINATIONS.length
      repeatCount = 1
    }
    previous = destination
    const cargoIndex = (Math.floor(random() * cargo.length) + index) % cargo.length
    return { destination: destination as SwitchyardDestination, cargo: cargo[cargoIndex]! }
  })
}

export function switchyardApproachDuration(deliveries: number): number {
  return Math.max(850, 1650 - Math.floor(deliveries / 3) * 120)
}

export function createSwitchyardState(date: string): SwitchyardState {
  const schedule = switchyardScheduleForDate(date)
  return {
    date,
    schedule,
    shipmentIndex: 0,
    journeyPhase: 'approach',
    journeyElapsedMs: 0,
    elapsedMs: 0,
    switchRoute: 0,
    deliveries: 0,
    misses: 0,
    lives: SWITCHYARD_STARTING_LIVES,
    streak: 0,
    score: 0,
    outcome: null,
    phase: 'ready',
    message: `A ${schedule[0]!.cargo} car is on the way. Route it to ${SWITCHYARD_DESTINATIONS[schedule[0]!.destination].name}.`,
  }
}

export function switchyardReducer(state: SwitchyardState, action: SwitchyardAction): SwitchyardState {
  if (action.type === 'restart') return createSwitchyardState(state.date)
  if (action.type === 'start') return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Shift started. Set the lever before the train reaches the junction.' } : state
  if (action.type === 'pause') return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Shift paused. The approaching train is held safely.' } : state
  if (action.type === 'resume') return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Shift resumed. Watch the signal and set the lever.' } : state
  if (action.type === 'switch') {
    if (state.phase !== 'playing' || state.journeyPhase !== 'approach' || !isDestination(action.destination) || state.switchRoute === action.destination) return state
    return {
      ...state,
      switchRoute: action.destination,
      message: `Lever set to ${SWITCHYARD_DESTINATIONS[action.destination].name}.`,
    }
  }
  if (action.type !== 'tick' || state.phase !== 'playing' || !Number.isFinite(action.deltaMs) || action.deltaMs <= 0) return state

  let remaining = action.deltaMs
  let next: SwitchyardState = { ...state, elapsedMs: state.elapsedMs + remaining }
  while (remaining > 0 && next.phase === 'playing') {
    if (next.journeyPhase === 'approach') {
      const untilJunction = switchyardApproachDuration(next.deliveries) - next.journeyElapsedMs
      if (remaining < untilJunction) {
        next = { ...next, journeyElapsedMs: next.journeyElapsedMs + remaining }
        remaining = 0
      } else {
        next = resolveShipment({ ...next, journeyElapsedMs: switchyardApproachDuration(next.deliveries) })
        remaining -= untilJunction
      }
    } else {
      const untilDeparture = SWITCHYARD_PASS_DURATION_MS - next.journeyElapsedMs
      if (remaining < untilDeparture) {
        next = { ...next, journeyElapsedMs: next.journeyElapsedMs + remaining }
        remaining = 0
      } else {
        remaining -= untilDeparture
        next = advanceShipment(next)
      }
    }
  }
  return next
}

export function formatSwitchyardTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function resolveShipment(state: SwitchyardState): SwitchyardState {
  const shipment = state.schedule[state.shipmentIndex]!
  if (state.switchRoute === shipment.destination) {
    const deliveries = state.deliveries + 1
    const streak = state.streak + 1
    const points = 100 + Math.min(streak * 10, 50)
    const phase = deliveries >= SWITCHYARD_DELIVERIES_TO_WIN ? 'won' : state.phase
    return {
      ...state,
      journeyPhase: 'pass',
      journeyElapsedMs: 0,
      deliveries,
      streak,
      score: state.score + points,
      outcome: 'delivered',
      phase,
      message: phase === 'won'
        ? `Shift complete. ${deliveries} freight cars delivered for ${state.score + points} points.`
        : `${capitalize(shipment.cargo)} delivered to ${SWITCHYARD_DESTINATIONS[shipment.destination].name}. ${streak} in a row.`,
    }
  }

  const misses = state.misses + 1
  const lives = state.lives - 1
  const phase = lives === 0 ? 'over' : state.phase
  return {
    ...state,
    journeyPhase: 'pass',
    journeyElapsedMs: 0,
    misses,
    lives,
    streak: 0,
    outcome: 'misrouted',
    phase,
    message: phase === 'over'
      ? `Shift ended after ${state.deliveries} deliveries. Three cars missed their depots.`
      : `${capitalize(shipment.cargo)} missed ${SWITCHYARD_DESTINATIONS[shipment.destination].name}; it left by ${SWITCHYARD_DESTINATIONS[state.switchRoute].name}.`,
  }
}

function advanceShipment(state: SwitchyardState): SwitchyardState {
  const nextIndex = state.shipmentIndex + 1
  if (nextIndex >= state.schedule.length) {
    const phase = state.deliveries >= SWITCHYARD_DELIVERIES_TO_WIN ? 'won' : 'over'
    return {
      ...state,
      journeyElapsedMs: SWITCHYARD_PASS_DURATION_MS,
      phase,
      message: phase === 'won'
        ? `Shift complete. ${state.deliveries} freight cars delivered for ${state.score} points.`
        : `Last train out. ${state.deliveries} deliveries and ${state.misses} missed routes.`,
    }
  }
  const shipment = state.schedule[nextIndex]!
  return {
    ...state,
    shipmentIndex: nextIndex,
    journeyPhase: 'approach',
    journeyElapsedMs: 0,
    outcome: null,
    message: `Next car: ${shipment.cargo}. Route it to ${SWITCHYARD_DESTINATIONS[shipment.destination].name}.`,
  }
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1)
}

function isDestination(value: number): value is SwitchyardDestination {
  return Number.isSafeInteger(value) && value >= 0 && value < SWITCHYARD_DESTINATIONS.length
}

function isUtcDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}
