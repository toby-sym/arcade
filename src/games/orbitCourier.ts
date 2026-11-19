export const ORBIT_COURIER_WIDTH = 960
export const ORBIT_COURIER_HEIGHT = 600
export const ORBIT_COURIER_MAX_HULL = 3
export const ORBIT_COURIER_DOCK_RANGE = 48
export const ORBIT_COURIER_DOCK_SPEED_LIMIT = 76

export interface OrbitCourierPoint {
  x: number
  y: number
}

export interface OrbitCourierStation extends OrbitCourierPoint {
  name: string
  cargo: string
}

export const ORBIT_COURIER_START: OrbitCourierPoint = { x: 130, y: 315 }

export const ORBIT_COURIER_STATIONS: OrbitCourierStation[] = [
  { name: 'Mica Relay', cargo: 'medical packs', x: 390, y: 122 },
  { name: 'Morrow Outpost', cargo: 'repair cores', x: 810, y: 294 },
  { name: 'Lumen Port', cargo: 'seed archive', x: 505, y: 500 },
]

export interface OrbitCourierHazardOrbit {
  centerX: number
  centerY: number
  orbitX: number
  orbitY: number
  periodMs: number
  phase: number
  radius: number
}

export const ORBIT_COURIER_HAZARD_ORBITS: OrbitCourierHazardOrbit[] = [
  { centerX: 245, centerY: 205, orbitX: 72, orbitY: 86, periodMs: 10800, phase: 0.15, radius: 18 },
  { centerX: 590, centerY: 306, orbitX: 112, orbitY: 64, periodMs: 13200, phase: 1.1, radius: 21 },
  { centerX: 710, centerY: 455, orbitX: 67, orbitY: 53, periodMs: 9100, phase: 2.2, radius: 16 },
]

export type OrbitCourierPhase = 'ready' | 'playing' | 'paused' | 'won' | 'over'
export type OrbitCourierControl = 'left' | 'right' | 'thrust' | 'brake'

export interface OrbitCourierShip extends OrbitCourierPoint {
  vx: number
  vy: number
  angle: number
}

export interface OrbitCourierHazard extends OrbitCourierPoint {
  radius: number
  id: number
}

export interface OrbitCourierState {
  phase: OrbitCourierPhase
  ship: OrbitCourierShip
  controls: Record<OrbitCourierControl, boolean>
  elapsedMs: number
  invulnerableMs: number
  nextStation: number
  delivered: number
  hull: number
  score: number
  lastDock: OrbitCourierPoint
  message: string
}

export type OrbitCourierAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'control'; control: OrbitCourierControl; pressed: boolean }
  | { type: 'tick'; deltaMs: number }
  | { type: 'dock' }

const TURN_SPEED = 2.55
const THRUST_ACCELERATION = 224
const MAX_SPEED = 238
const DRIFT_DECAY = 0.16
const BRAKE_DECELERATION = 5.8
const SHIP_RADIUS = 12
const COLLISION_INVULNERABILITY_MS = 1650
const MAX_DELTA_MS = 50
const DOCK_POINTS = 900

const emptyControls = (): Record<OrbitCourierControl, boolean> => ({ left: false, right: false, thrust: false, brake: false })

export function createOrbitCourierState(): OrbitCourierState {
  return {
    phase: 'ready',
    ship: { ...ORBIT_COURIER_START, vx: 0, vy: 0, angle: Math.PI / 2 },
    controls: emptyControls(),
    elapsedMs: 0,
    invulnerableMs: 0,
    nextStation: 0,
    delivered: 0,
    hull: ORBIT_COURIER_MAX_HULL,
    score: 0,
    lastDock: { ...ORBIT_COURIER_START },
    message: 'Three deliveries are waiting. Read the route, watch the debris, and arrive slowly enough to dock.',
  }
}

export function orbitCourierReducer(state: OrbitCourierState, action: OrbitCourierAction): OrbitCourierState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready'
        ? { ...state, phase: 'playing', message: `Delivery 1 of ${ORBIT_COURIER_STATIONS.length}: ${ORBIT_COURIER_STATIONS[0]!.cargo} to ${ORBIT_COURIER_STATIONS[0]!.name}.` }
        : state
    case 'pause':
      return state.phase === 'playing'
        ? { ...state, phase: 'paused', controls: emptyControls(), message: 'Flight paused. Your route and cargo are safe.' }
        : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Flight resumed. Keep an eye on your drift.' } : state
    case 'restart':
      return createOrbitCourierState()
    case 'control':
      if (state.phase !== 'playing' || state.controls[action.control] === action.pressed) return state
      return { ...state, controls: { ...state.controls, [action.control]: action.pressed } }
    case 'tick':
      return advanceOrbitCourier(state, action.deltaMs)
    case 'dock':
      return attemptDock(state)
  }
}

export function orbitCourierHazardsAt(elapsedMs: number): OrbitCourierHazard[] {
  return ORBIT_COURIER_HAZARD_ORBITS.map((orbit, id) => {
    const angle = orbit.phase + (Math.max(0, elapsedMs) / orbit.periodMs) * Math.PI * 2
    return {
      id,
      x: orbit.centerX + Math.cos(angle) * orbit.orbitX,
      y: orbit.centerY + Math.sin(angle) * orbit.orbitY,
      radius: orbit.radius,
    }
  })
}

export function orbitCourierDistance(from: OrbitCourierPoint, to: OrbitCourierPoint): number {
  const dx = wrappedDistance(from.x, to.x, ORBIT_COURIER_WIDTH)
  const dy = wrappedDistance(from.y, to.y, ORBIT_COURIER_HEIGHT)
  return Math.hypot(dx, dy)
}

function advanceOrbitCourier(state: OrbitCourierState, deltaMs: number): OrbitCourierState {
  if (state.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return state
  const dtMs = Math.min(deltaMs, MAX_DELTA_MS)
  const dt = dtMs / 1000
  const turnDirection = Number(state.controls.right) - Number(state.controls.left)
  const angle = normalizeAngle(state.ship.angle + turnDirection * TURN_SPEED * dt)
  let vx = state.ship.vx
  let vy = state.ship.vy

  if (state.controls.thrust) {
    vx += Math.sin(angle) * THRUST_ACCELERATION * dt
    vy -= Math.cos(angle) * THRUST_ACCELERATION * dt
  }

  const decay = Math.exp(-(state.controls.brake ? BRAKE_DECELERATION : DRIFT_DECAY) * dt)
  vx *= decay
  vy *= decay
  const speed = Math.hypot(vx, vy)
  if (speed > MAX_SPEED) {
    vx = (vx / speed) * MAX_SPEED
    vy = (vy / speed) * MAX_SPEED
  }

  const elapsedMs = state.elapsedMs + dtMs
  const ship: OrbitCourierShip = {
    x: wrap(state.ship.x + vx * dt, ORBIT_COURIER_WIDTH),
    y: wrap(state.ship.y + vy * dt, ORBIT_COURIER_HEIGHT),
    vx,
    vy,
    angle,
  }
  const invulnerableMs = Math.max(0, state.invulnerableMs - dtMs)
  const moved = { ...state, ship, elapsedMs, invulnerableMs }
  if (invulnerableMs > 0) return moved

  const hazard = orbitCourierHazardsAt(elapsedMs).find((rock) => orbitCourierDistance(ship, rock) < SHIP_RADIUS + rock.radius)
  if (!hazard) return moved

  const hull = state.hull - 1
  return {
    ...moved,
    phase: hull === 0 ? 'over' : 'playing',
    ship: { ...state.lastDock, vx: 0, vy: 0, angle: Math.PI / 2 },
    controls: emptyControls(),
    invulnerableMs: COLLISION_INVULNERABILITY_MS,
    hull,
    message: hull === 0
      ? 'Courier lost. The route is still here when you are ready to fly again.'
      : `Debris strike. ${hull} ${hull === 1 ? 'hull point' : 'hull points'} remain; you are back at the last dock.`,
  }
}

function attemptDock(state: OrbitCourierState): OrbitCourierState {
  if (state.phase !== 'playing') return state
  const station = ORBIT_COURIER_STATIONS[state.nextStation]
  if (!station) return state

  const distance = orbitCourierDistance(state.ship, station)
  if (distance > ORBIT_COURIER_DOCK_RANGE) {
    return { ...state, message: `${station.name} is ${Math.ceil(distance)} units away. Bring the courier inside the gold ring.` }
  }

  const speed = Math.hypot(state.ship.vx, state.ship.vy)
  if (speed > ORBIT_COURIER_DOCK_SPEED_LIMIT) {
    return { ...state, message: `Too much drift to dock (${Math.round(speed)} units per second). Hold Brake until you are under ${ORBIT_COURIER_DOCK_SPEED_LIMIT}.` }
  }

  const deliveryScore = DOCK_POINTS + Math.round((ORBIT_COURIER_DOCK_SPEED_LIMIT - speed) * 2)
  const delivered = state.delivered + 1
  const nextStation = state.nextStation + 1
  const lastDock = { x: station.x, y: station.y }
  const ship = { ...lastDock, vx: 0, vy: 0, angle: state.ship.angle }
  if (nextStation === ORBIT_COURIER_STATIONS.length) {
    const timeBonus = Math.max(0, 600 - Math.floor(state.elapsedMs / 1000) * 3)
    const hullBonus = state.hull * 250
    const score = state.score + deliveryScore + timeBonus + hullBonus
    return {
      ...state,
      phase: 'won',
      controls: emptyControls(),
      ship,
      lastDock,
      delivered,
      nextStation,
      score,
      message: `All three deliveries arrived safely. ${timeBonus} flight bonus and ${hullBonus} hull bonus added.`,
    }
  }

  const next = ORBIT_COURIER_STATIONS[nextStation]!
  return {
    ...state,
    ship,
    lastDock,
    delivered,
    nextStation,
    controls: emptyControls(),
    score: state.score + deliveryScore,
    message: `${station.name} secured. Take ${next.cargo} to ${next.name}.`,
  }
}

function wrappedDistance(a: number, b: number, size: number): number {
  const distance = Math.abs(a - b)
  return Math.min(distance, size - distance)
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size
}

function normalizeAngle(angle: number): number {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}
