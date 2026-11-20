export const NEON_RALLY_WIDTH = 640
export const NEON_RALLY_HEIGHT = 780
export const NEON_RALLY_LAPS = 3
export const NEON_RALLY_TRACK_WIDTH = 104
export const NEON_RALLY_MAX_SPEED = 228
export const NEON_RALLY_CHECKPOINT_RADIUS = 38
export const NEON_RALLY_CHECKPOINT_COUNT = 12

export type NeonRallyControl = 'left' | 'right' | 'accelerate' | 'brake'
export type NeonRallyPhase = 'ready' | 'playing' | 'paused' | 'won'

export interface NeonRallyPoint {
  x: number
  y: number
}

export interface NeonRallyVehicle extends NeonRallyPoint {
  heading: number
  speed: number
  offRoad: boolean
}

export interface NeonRallyState {
  phase: NeonRallyPhase
  vehicle: NeonRallyVehicle
  controls: Record<NeonRallyControl, boolean>
  lap: number
  nextCheckpoint: number
  elapsedMs: number
  lapElapsedMs: number
  lapTimes: number[]
  message: string
}

export type NeonRallyAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'control'; control: NeonRallyControl; pressed: boolean }
  | { type: 'tick'; deltaMs: number }

const CENTER = { x: 320, y: 390 }
const RADIUS_X = 204
const RADIUS_Y = 294
const ROAD_EDGE_ALLOWANCE = NEON_RALLY_TRACK_WIDTH / 2 - 7
const MAX_FRAME_MS = 50
const STEP_SECONDS = 1 / 120
const EMPTY_CONTROLS = (): Record<NeonRallyControl, boolean> => ({ left: false, right: false, accelerate: false, brake: false })

function ellipsePoint(angle: number): NeonRallyPoint {
  return { x: CENTER.x + RADIUS_X * Math.cos(angle), y: CENTER.y + RADIUS_Y * Math.sin(angle) }
}

export const NEON_RALLY_CHECKPOINTS = Array.from({ length: NEON_RALLY_CHECKPOINT_COUNT }, (_, index) =>
  ellipsePoint(-Math.PI / 2 + (Math.PI * 2 * index) / NEON_RALLY_CHECKPOINT_COUNT),
)

function ellipseTangent(angle: number): number {
  return Math.atan2(RADIUS_Y * Math.cos(angle), -RADIUS_X * Math.sin(angle))
}

function initialVehicle(): NeonRallyVehicle {
  const angle = -Math.PI / 2 + 0.17
  return { ...ellipsePoint(angle), heading: ellipseTangent(angle), speed: 0, offRoad: false }
}

export function createNeonRallyState(): NeonRallyState {
  return {
    phase: 'ready',
    vehicle: initialVehicle(),
    controls: EMPTY_CONTROLS(),
    lap: 1,
    nextCheckpoint: 1,
    elapsedMs: 0,
    lapElapsedMs: 0,
    lapTimes: [],
    message: 'Hold the accelerator. Follow each lit gate in order.',
  }
}

export function neonRallyReducer(state: NeonRallyState, action: NeonRallyAction): NeonRallyState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Green light. Take the first bend cleanly.' } : state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused', controls: EMPTY_CONTROLS(), message: 'Race paused.' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Back on the circuit.' } : state
    case 'restart':
      return createNeonRallyState()
    case 'control':
      return state.phase === 'playing' && state.controls[action.control] !== action.pressed
        ? { ...state, controls: { ...state.controls, [action.control]: action.pressed } }
        : state
    case 'tick':
      return advanceNeonRally(state, action.deltaMs)
  }
}

export function neonRallyDistanceToTrack(point: NeonRallyPoint): number {
  const normalizedX = (point.x - CENTER.x) / RADIUS_X
  const normalizedY = (point.y - CENTER.y) / RADIUS_Y
  const angle = Math.atan2(normalizedY, normalizedX)
  const nearest = ellipsePoint(angle)
  return Math.hypot(point.x - nearest.x, point.y - nearest.y)
}

function advanceNeonRally(state: NeonRallyState, deltaMs: number): NeonRallyState {
  if (state.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return state
  const frameMs = Math.min(deltaMs, MAX_FRAME_MS)
  const steps = Math.max(1, Math.ceil((frameMs / 1000) / STEP_SECONDS))
  const stepMs = frameMs / steps
  let next = state
  for (let index = 0; index < steps && next.phase === 'playing'; index += 1) {
    next = advanceRallyStep(next, stepMs)
  }
  return next
}

function advanceRallyStep(state: NeonRallyState, deltaMs: number): NeonRallyState {
  const dt = deltaMs / 1000
  const controls = state.controls
  let speed = state.vehicle.speed
  const engine = state.vehicle.offRoad ? 100 : 205
  if (controls.brake) speed = Math.max(0, speed - 405 * dt)
  else if (controls.accelerate) speed = Math.min(state.vehicle.offRoad ? 120 : NEON_RALLY_MAX_SPEED, speed + engine * dt)
  else speed = Math.max(0, speed - 22 * dt)

  const steering = Number(controls.right) - Number(controls.left)
  const speedRatio = Math.min(1, speed / 130)
  const turnRate = (0.1 + speedRatio * 1.03) * (state.vehicle.offRoad ? 0.74 : 1)
  const heading = state.vehicle.heading + steering * turnRate * dt
  let x = state.vehicle.x + Math.cos(heading) * speed * dt
  let y = state.vehicle.y + Math.sin(heading) * speed * dt

  if (x < 26 || x > NEON_RALLY_WIDTH - 26) {
    x = Math.max(26, Math.min(NEON_RALLY_WIDTH - 26, x))
    speed *= 0.55
  }
  if (y < 26 || y > NEON_RALLY_HEIGHT - 26) {
    y = Math.max(26, Math.min(NEON_RALLY_HEIGHT - 26, y))
    speed *= 0.55
  }

  const offRoad = neonRallyDistanceToTrack({ x, y }) > ROAD_EDGE_ALLOWANCE
  if (offRoad) speed = Math.min(speed, 120)

  const elapsedMs = state.elapsedMs + deltaMs
  const lapElapsedMs = state.lapElapsedMs + deltaMs
  let next: NeonRallyState = {
    ...state,
    vehicle: { x, y, heading, speed, offRoad },
    elapsedMs,
    lapElapsedMs,
  }

  const checkpoint = NEON_RALLY_CHECKPOINTS[state.nextCheckpoint]
  if (Math.hypot(x - checkpoint.x, y - checkpoint.y) > NEON_RALLY_CHECKPOINT_RADIUS) return next

  if (state.nextCheckpoint !== 0) {
    const checkpointNumber = state.nextCheckpoint + 1
    return {
      ...next,
      nextCheckpoint: (state.nextCheckpoint + 1) % NEON_RALLY_CHECKPOINT_COUNT,
      message: `Sector gate ${String(checkpointNumber).padStart(2, '0')} cleared.`,
    }
  }

  const lapTimes = [...state.lapTimes, Math.round(lapElapsedMs)]
  if (state.lap >= NEON_RALLY_LAPS) {
    return {
      ...next,
      phase: 'won',
      lapTimes,
      controls: EMPTY_CONTROLS(),
      message: `Three laps complete in ${formatNeonRallyTime(elapsedMs)}.`,
    }
  }
  return {
    ...next,
    lap: state.lap + 1,
    nextCheckpoint: 1,
    lapElapsedMs: 0,
    lapTimes,
    message: `Lap ${state.lap} complete. Lap ${state.lap + 1} is green.`,
  }
}

export function formatNeonRallyTime(timeMs: number): string {
  const totalCentiseconds = Math.max(0, Math.floor(timeMs / 10))
  const minutes = Math.floor(totalCentiseconds / 6000)
  const seconds = Math.floor(totalCentiseconds / 100) % 60
  const centiseconds = totalCentiseconds % 100
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
