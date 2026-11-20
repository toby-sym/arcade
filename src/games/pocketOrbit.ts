import { utcDateKey } from './dailyPattern'

export const POCKET_ORBIT_WIDTH = 960
export const POCKET_ORBIT_HEIGHT = 600
export const POCKET_ORBIT_BEACON_COUNT = 3
export const POCKET_ORBIT_MAX_DOCK_SPEED = 260

export interface PocketOrbitPoint {
  x: number
  y: number
}

export interface PocketOrbitWell extends PocketOrbitPoint {
  mass: number
  radius: number
  name: string
}

export interface PocketOrbitBeacon extends PocketOrbitPoint {
  id: number
  radius: number
}

export interface PocketOrbitCourse {
  date: string
  well: PocketOrbitWell
  moon: PocketOrbitWell
  start: PocketOrbitPoint
  beacons: PocketOrbitBeacon[]
  dock: PocketOrbitPoint & { radius: number }
  idealAngle: number
  idealPower: number
  orbitPeriodMs: number
  angleOffset: number
  powerOffset: number
}

export interface PocketOrbitShip extends PocketOrbitPoint {
  vx: number
  vy: number
}

export type PocketOrbitPhase = 'ready' | 'aiming' | 'flying' | 'paused' | 'complete'

export interface PocketOrbitState {
  phase: PocketOrbitPhase
  resumePhase: 'aiming' | 'flying' | null
  course: PocketOrbitCourse
  ship: PocketOrbitShip
  aimAngle: number
  power: number
  beacons: boolean[]
  trail: PocketOrbitPoint[]
  launches: number
  elapsedMs: number
  message: string
}

export type PocketOrbitAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'adjust-angle'; degrees: number }
  | { type: 'adjust-power'; amount: number }
  | { type: 'aim'; angle: number; power: number }
  | { type: 'launch' }
  | { type: 'tick'; deltaMs: number }

const FRAME_MS = 1000 / 60
const MAX_FRAME_MS = 50
const SHIP_RADIUS = 9
const ORBIT_PREVIEW_MS = 7200

export function pocketOrbitCourseForDate(date: string): PocketOrbitCourse {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const random = seededRandom(hashDate(`pocket-orbit:${date}`))
  const well: PocketOrbitWell = {
    x: 420 + Math.round(random() * 120),
    y: 230 + Math.round(random() * 110),
    mass: 5_500_000,
    radius: 34,
    name: 'Aster Well',
  }
  const moon: PocketOrbitWell = {
    x: well.x + (random() < 0.5 ? -340 : 340),
    y: well.y + (random() < 0.5 ? -115 : 115),
    mass: 5_500,
    radius: 19,
    name: 'Drift Moon',
  }
  const orbitRadius = 137 + Math.round(random() * 21)
  const startAngle = Math.floor(random() * 8) * Math.PI / 4 + (random() - 0.5) * 0.18
  const start = {
    x: well.x + Math.cos(startAngle) * orbitRadius,
    y: well.y + Math.sin(startAngle) * orbitRadius,
  }
  const idealPower = Math.sqrt(well.mass / orbitRadius)
  const idealAngle = normalizeAngle(Math.atan2(Math.cos(startAngle), -Math.sin(startAngle)))
  const orbitPeriodMs = 2 * Math.PI * Math.sqrt((orbitRadius ** 3) / well.mass) * 1000
  const idealTrail = traceOrbit([well, moon], start, {
    vx: Math.cos(idealAngle) * idealPower,
    vy: Math.sin(idealAngle) * idealPower,
  }, orbitPeriodMs * 1.2)
  const targets = [0.18, 0.39, 0.60, 0.92].map((fraction) => {
    const index = Math.min(idealTrail.length - 1, Math.round((orbitPeriodMs * fraction) / FRAME_MS))
    return idealTrail[index]!
  })

  return {
    date,
    well,
    moon,
    start,
    beacons: targets.slice(0, POCKET_ORBIT_BEACON_COUNT).map((point, id) => ({ ...point, id, radius: 22 })),
    dock: { ...targets[3]!, radius: 27 },
    idealAngle,
    idealPower,
    orbitPeriodMs,
    angleOffset: (random() < 0.5 ? -1 : 1) * (4 + Math.floor(random() * 5)) * Math.PI / 180,
    powerOffset: (random() < 0.5 ? -1 : 1) * (7 + Math.floor(random() * 9)),
  }
}

export function createPocketOrbitState(date = utcDateKey()): PocketOrbitState {
  const course = pocketOrbitCourseForDate(date)
  return {
    phase: 'ready',
    resumePhase: null,
    course,
    ship: { ...course.start, vx: 0, vy: 0 },
    aimAngle: normalizeAngle(course.idealAngle + course.angleOffset),
    power: clamp(course.idealPower + course.powerOffset, 110, 245),
    beacons: Array(POCKET_ORBIT_BEACON_COUNT).fill(false),
    trail: [],
    launches: 0,
    elapsedMs: 0,
    message: 'A small pull can bend a long route. Tune the launch, gather three beacons, then dock.',
  }
}

export function pocketOrbitReducer(state: PocketOrbitState, action: PocketOrbitAction): PocketOrbitState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'aiming', message: 'Adjust your launch, then send the satellite past all three beacons.' } : state
    case 'pause':
      return state.phase === 'aiming' || state.phase === 'flying'
        ? { ...state, phase: 'paused', resumePhase: state.phase, message: 'Flight paused. The route is held in place.' }
        : state
    case 'resume':
      return state.phase === 'paused'
        ? { ...state, phase: state.resumePhase ?? 'aiming', resumePhase: null, message: 'Flight resumed. Keep the beacons and dock in view.' }
        : state
    case 'restart':
      return createPocketOrbitState(state.course.date)
    case 'adjust-angle':
      if (state.phase !== 'aiming' || !Number.isFinite(action.degrees)) return state
      return { ...state, aimAngle: normalizeAngle(state.aimAngle + action.degrees * Math.PI / 180) }
    case 'adjust-power':
      if (state.phase !== 'aiming' || !Number.isFinite(action.amount)) return state
      return { ...state, power: clamp(state.power + action.amount, 110, 245) }
    case 'aim':
      if (state.phase !== 'aiming' || !Number.isFinite(action.angle) || !Number.isFinite(action.power)) return state
      return { ...state, aimAngle: normalizeAngle(action.angle), power: clamp(action.power, 110, 245) }
    case 'launch':
      if (state.phase !== 'aiming') return state
      return {
        ...state,
        phase: 'flying',
        resumePhase: null,
        ship: { ...state.course.start, vx: Math.cos(state.aimAngle) * state.power, vy: Math.sin(state.aimAngle) * state.power },
        beacons: Array(POCKET_ORBIT_BEACON_COUNT).fill(false),
        trail: [{ ...state.course.start }],
        launches: state.launches + 1,
        elapsedMs: 0,
        message: 'Gravity is bending the route. Collect each beacon and find the dock.',
      }
    case 'tick':
      return advancePocketOrbit(state, action.deltaMs)
  }
}

export function pocketOrbitPreview(state: PocketOrbitState, maxDurationMs = ORBIT_PREVIEW_MS): PocketOrbitPoint[] {
  if (state.phase !== 'aiming') return []
  return traceOrbit([state.course.well, state.course.moon], state.course.start, {
    vx: Math.cos(state.aimAngle) * state.power,
    vy: Math.sin(state.aimAngle) * state.power,
  }, maxDurationMs, 2)
}

export function pocketOrbitDistance(first: PocketOrbitPoint, second: PocketOrbitPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function advancePocketOrbit(state: PocketOrbitState, deltaMs: number): PocketOrbitState {
  if (state.phase !== 'flying' || !Number.isFinite(deltaMs) || deltaMs <= 0) return state
  const boundedMs = Math.min(MAX_FRAME_MS, deltaMs)
  let current: PocketOrbitState = state
  let remaining = boundedMs
  while (remaining > 0 && current.phase === 'flying') {
    const step = Math.min(FRAME_MS, remaining)
    current = stepPocketOrbit(current, step)
    remaining -= step
  }
  return current
}

function stepPocketOrbit(state: PocketOrbitState, deltaMs: number): PocketOrbitState {
  const dt = deltaMs / 1000
  const wells = [state.course.well, state.course.moon]
  const acceleration = wells.reduce((total, well) => {
    const dx = well.x - state.ship.x
    const dy = well.y - state.ship.y
    const distanceSquared = Math.max(625, dx * dx + dy * dy)
    const strength = well.mass / (distanceSquared * Math.sqrt(distanceSquared))
    return { x: total.x + dx * strength, y: total.y + dy * strength }
  }, { x: 0, y: 0 })
  const vx = state.ship.vx + acceleration.x * dt
  const vy = state.ship.vy + acceleration.y * dt
  const ship = { x: state.ship.x + vx * dt, y: state.ship.y + vy * dt, vx, vy }
  const elapsedMs = state.elapsedMs + deltaMs
  const trail = [...state.trail, { x: ship.x, y: ship.y }].slice(-180)

  if (pocketOrbitDistance(ship, state.course.well) < state.course.well.radius + SHIP_RADIUS) {
    return missPocketOrbit({ ...state, ship, elapsedMs, trail }, 'The satellite dipped too close to the well. Trim the launch and try again.')
  }
  if (ship.x < 10 || ship.x > POCKET_ORBIT_WIDTH - 10 || ship.y < 10 || ship.y > POCKET_ORBIT_HEIGHT - 10 || elapsedMs > state.course.orbitPeriodMs * 1.7) {
    return missPocketOrbit({ ...state, ship, elapsedMs, trail }, 'The satellite drifted off course. Try a small change to angle or power.')
  }

  const beacons = state.beacons.map((collected, index) => collected
    || pocketOrbitDistance(ship, state.course.beacons[index]!) <= state.course.beacons[index]!.radius)
  const collectedNow = beacons.filter((collected, index) => collected && !state.beacons[index]).length
  const next: PocketOrbitState = {
    ...state,
    ship,
    elapsedMs,
    trail,
    beacons,
    message: collectedNow > 0
      ? `Beacon ${beacons.filter(Boolean).length} of ${POCKET_ORBIT_BEACON_COUNT} aboard. Keep the arc steady.`
      : state.message,
  }
  const dockDistance = pocketOrbitDistance(ship, state.course.dock)
  const speed = Math.hypot(vx, vy)
  if (dockDistance <= state.course.dock.radius && beacons.every(Boolean) && speed <= POCKET_ORBIT_MAX_DOCK_SPEED) {
    return { ...next, phase: 'complete', message: `Dock secured in ${state.launches} ${state.launches === 1 ? 'launch' : 'launches'}.` }
  }
  return next
}

function missPocketOrbit(state: PocketOrbitState, message: string): PocketOrbitState {
  return {
    ...state,
    phase: 'aiming',
    resumePhase: null,
    ship: { ...state.course.start, vx: 0, vy: 0 },
    beacons: Array(POCKET_ORBIT_BEACON_COUNT).fill(false),
    trail: [],
    elapsedMs: 0,
    message,
  }
}

function traceOrbit(
  wells: PocketOrbitWell[],
  start: PocketOrbitPoint,
  velocity: Pick<PocketOrbitShip, 'vx' | 'vy'>,
  durationMs: number,
  sampleEvery = 1,
): PocketOrbitPoint[] {
  let ship: PocketOrbitShip = { ...start, ...velocity }
  const points = [{ x: ship.x, y: ship.y }]
  const steps = Math.ceil(durationMs / FRAME_MS)
  for (let step = 1; step <= steps; step += 1) {
    const dt = Math.min(FRAME_MS, durationMs - (step - 1) * FRAME_MS) / 1000
    const acceleration = wells.reduce((total, well) => {
      const dx = well.x - ship.x
      const dy = well.y - ship.y
      const distanceSquared = Math.max(625, dx * dx + dy * dy)
      const strength = well.mass / (distanceSquared * Math.sqrt(distanceSquared))
      return { x: total.x + dx * strength, y: total.y + dy * strength }
    }, { x: 0, y: 0 })
    const vx = ship.vx + acceleration.x * dt
    const vy = ship.vy + acceleration.y * dt
    ship = { x: ship.x + vx * dt, y: ship.y + vy * dt, vx, vy }
    if (step % sampleEvery === 0) points.push({ x: ship.x, y: ship.y })
    if (ship.x < -20 || ship.x > POCKET_ORBIT_WIDTH + 20 || ship.y < -20 || ship.y > POCKET_ORBIT_HEIGHT + 20) break
  }
  return points
}

function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2
  return ((angle % fullTurn) + fullTurn) % fullTurn
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function hashDate(value: string): number {
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

function seededRandom(seed: number): () => number {
  let value = seed || 1
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function isUtcDateKey(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}
