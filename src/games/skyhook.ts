export const SKYHOOK_WIDTH = 960
export const SKYHOOK_HEIGHT = 600
export const SKYHOOK_MAX_HULL = 3
export const SKYHOOK_GRAPPLE_RANGE = 152
export const SKYHOOK_BEACON_RADIUS = 24
export const SKYHOOK_DOCK_RADIUS = 44

export interface SkyhookPoint {
  x: number
  y: number
}

export interface SkyhookAnchor extends SkyhookPoint {
  name: string
}

export interface SkyhookBeacon extends SkyhookPoint {
  name: string
}

export interface SkyhookHazard extends SkyhookPoint {
  radius: number
  id: number
}

export interface SkyhookCourse {
  date: string
  anchors: SkyhookAnchor[]
  beacons: SkyhookBeacon[]
  dock: SkyhookPoint
  hazards: SkyhookHazard[]
  startAngle: number
  startLength: number
}

export type SkyhookPhase = 'ready' | 'playing' | 'paused' | 'won' | 'over'
export type SkyhookControl = 'left' | 'right' | 'reel' | 'brake'

export interface SkyhookCapsule extends SkyhookPoint {
  vx: number
  vy: number
  angle: number
}

export interface SkyhookState {
  phase: SkyhookPhase
  course: SkyhookCourse
  capsule: SkyhookCapsule
  controls: Record<SkyhookControl, boolean>
  attachedAnchor: number | null
  lastAnchor: number
  ropeLength: number
  swingAngle: number
  angularVelocity: number
  elapsedMs: number
  invulnerableMs: number
  nextBeacon: number
  hull: number
  score: number
  message: string
}

export type SkyhookAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'control'; control: SkyhookControl; pressed: boolean }
  | { type: 'tether' }
  | { type: 'tick'; deltaMs: number }

const GRAVITY = 92
const TURN_RATE = 2.25
const THRUST_ACCELERATION = 190
const MAX_SPEED = 320
const DRIFT_DECAY = 0.055
const BRAKE_DECELERATION = 3.8
const CAPSULE_RADIUS = 11
const COLLISION_INVULNERABILITY_MS = 1350
const MAX_DELTA_MS = 50
const MIN_ROPE_LENGTH = 72
const MAX_ROPE_LENGTH = 150
const SWING_STEERING = 2.55
const ROPE_DAMPING = 0.12
const BEACON_POINTS = 500
const emptyControls = (): Record<SkyhookControl, boolean> => ({ left: false, right: false, reel: false, brake: false })

export function skyhookCourseForDate(date: string): SkyhookCourse {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  let seed = hashSeed(`skyhook:${date}`)
  const mirror = seed % 2 === 1
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  const yShift = Math.floor(seed / 0x1_0000_0000 * 19) - 9
  const point = (x: number, y: number): SkyhookPoint => ({ x: mirror ? SKYHOOK_WIDTH - x : x, y: y + yShift })
  const anchors: SkyhookAnchor[] = [
    { ...point(185, 292), name: 'Low Orbit' },
    { ...point(410, 205), name: 'Glassline' },
    { ...point(625, 350), name: 'Morrow' },
    { ...point(805, 222), name: 'Farpoint' },
  ]
  const beacons: SkyhookBeacon[] = [
    { ...point(302, 352), name: 'First beacon' },
    { ...point(470, 310), name: 'Second beacon' },
    { ...point(600, 320), name: 'Third beacon' },
  ]
  const hazards: SkyhookHazard[] = [
    { ...point(330, 151), radius: 23, id: 0 },
    { ...point(555, 448), radius: 27, id: 1 },
    { ...point(770, 158), radius: 20, id: 2 },
  ]
  return {
    date,
    anchors,
    beacons,
    dock: point(880, 500),
    hazards,
    startAngle: mirror ? 1.18 : -1.18,
    startLength: 112,
  }
}

export function createSkyhookState(date = utcDateKey()): SkyhookState {
  const course = skyhookCourseForDate(date)
  const anchor = course.anchors[0]!
  const angle = course.startAngle
  const length = course.startLength
  return {
    phase: 'ready',
    course,
    capsule: {
      x: anchor.x + Math.sin(angle) * length,
      y: anchor.y + Math.cos(angle) * length,
      vx: 0,
      vy: 0,
      angle: angle + Math.PI / 2,
    },
    controls: emptyControls(),
    attachedAnchor: 0,
    lastAnchor: 0,
    ropeLength: length,
    swingAngle: angle,
    angularVelocity: 0,
    elapsedMs: 0,
    invulnerableMs: 0,
    nextBeacon: 0,
    hull: SKYHOOK_MAX_HULL,
    score: 0,
    message: 'Pump the tether, release into the sky, and catch the next anchor. Bring every beacon to the dock.',
  }
}

export function skyhookReducer(state: SkyhookState, action: SkyhookAction): SkyhookState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Tether live. Build your swing, then release toward the next anchor.' } : state
    case 'pause':
      return state.phase === 'playing'
        ? { ...state, phase: 'paused', controls: emptyControls(), message: 'Flight paused. Your tether and route are held.' }
        : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Flight resumed. Keep the next beacon in view.' } : state
    case 'restart':
      return createSkyhookState(state.course.date)
    case 'control':
      if (state.phase !== 'playing' || !(action.control in state.controls) || state.controls[action.control] === action.pressed) return state
      return { ...state, controls: { ...state.controls, [action.control]: action.pressed } }
    case 'tether':
      return state.phase === 'playing' ? toggleSkyhookTether(state) : state
    case 'tick':
      return advanceSkyhook(state, action.deltaMs)
  }
}

export function skyhookDistance(from: SkyhookPoint, to: SkyhookPoint): number {
  return Math.hypot(from.x - to.x, from.y - to.y)
}

function toggleSkyhookTether(state: SkyhookState): SkyhookState {
  if (state.attachedAnchor !== null) {
    const nextAnchor = nearestSkyhookAnchor(state)
    if (nextAnchor) return attachSkyhookAnchor(state, nextAnchor.index, `Tether transferred to ${nextAnchor.anchor.name}.`)
    const theta = state.swingAngle
    const length = state.ropeLength
    const vx = Math.cos(theta) * state.angularVelocity * length
    const vy = -Math.sin(theta) * state.angularVelocity * length
    const speed = Math.hypot(vx, vy)
    return {
      ...state,
      attachedAnchor: null,
      controls: emptyControls(),
      capsule: { ...state.capsule, vx, vy, angle: speed > 0.1 ? Math.atan2(vy, vx) : state.capsule.angle },
      message: speed < 28
        ? 'Tether released with little momentum. Steer and thrust toward an anchor.'
        : `Tether released at ${Math.round(speed)} units per second. Steer into the catch ring.`,
    }
  }

  const nearest = nearestSkyhookAnchor(state)
  if (!nearest) {
    const closest = Math.min(...state.course.anchors.map((anchor, index) => index === state.lastAnchor ? Infinity : skyhookDistance(state.capsule, anchor)))
    return { ...state, message: `No fresh anchor in range. The nearest catch ring is ${Math.ceil(closest)} units away.` }
  }

  return attachSkyhookAnchor(state, nearest.index)
}

function nearestSkyhookAnchor(state: SkyhookState) {
  return state.course.anchors
    .map((anchor, index) => ({ anchor, index, distance: skyhookDistance(state.capsule, anchor) }))
    .filter(({ index, distance }) => index !== state.lastAnchor && distance <= SKYHOOK_GRAPPLE_RANGE)
    .sort((a, b) => a.distance - b.distance)[0]
}

function attachSkyhookAnchor(state: SkyhookState, index: number, transferMessage?: string): SkyhookState {
  const anchor = state.course.anchors[index]!
  const dx = state.capsule.x - anchor.x
  const dy = state.capsule.y - anchor.y
  const distance = Math.hypot(dx, dy)
  const angle = Math.atan2(dx, dy)
  const length = clamp(distance, MIN_ROPE_LENGTH, MAX_ROPE_LENGTH)
  const omega = (state.capsule.vx * Math.cos(angle) - state.capsule.vy * Math.sin(angle)) / length
  const capsule = {
    ...state.capsule,
    x: anchor.x + Math.sin(angle) * length,
    y: anchor.y + Math.cos(angle) * length,
    vx: Math.cos(angle) * omega * length,
    vy: -Math.sin(angle) * omega * length,
    angle: angle + Math.PI / 2,
  }
  const collected = collectSkyhookBeacons({
    ...state,
    attachedAnchor: index,
    lastAnchor: index,
    ropeLength: length,
    swingAngle: angle,
    angularVelocity: omega,
    capsule,
  })
  return {
    ...collected,
    message: transferMessage ?? (collected.nextBeacon > state.nextBeacon
      ? `${anchor.name} caught the tether. Beacon ${collected.nextBeacon} secured.`
      : `Tether caught at ${anchor.name}. Keep swinging toward beacon ${Math.min(collected.nextBeacon + 1, state.course.beacons.length)}.`),
  }
}

function advanceSkyhook(state: SkyhookState, deltaMs: number): SkyhookState {
  if (state.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return state
  const dtMs = Math.min(deltaMs, MAX_DELTA_MS)
  const dt = dtMs / 1000
  const turn = Number(state.controls.right) - Number(state.controls.left)
  const elapsedMs = state.elapsedMs + dtMs
  const invulnerableMs = Math.max(0, state.invulnerableMs - dtMs)
  let capsule: SkyhookCapsule
  let swingAngle = state.swingAngle
  let angularVelocity = state.angularVelocity
  let ropeLength = state.ropeLength

  if (state.attachedAnchor !== null) {
    const anchor = state.course.anchors[state.attachedAnchor]!
    ropeLength = clamp(ropeLength + (Number(state.controls.brake) - Number(state.controls.reel)) * 44 * dt, MIN_ROPE_LENGTH, MAX_ROPE_LENGTH)
    const acceleration = -(GRAVITY / ropeLength) * Math.sin(swingAngle) + turn * SWING_STEERING - angularVelocity * ROPE_DAMPING
    angularVelocity = clamp(angularVelocity + acceleration * dt, -4.2, 4.2)
    swingAngle = normalizeAngleSigned(swingAngle + angularVelocity * dt)
    capsule = {
      x: anchor.x + Math.sin(swingAngle) * ropeLength,
      y: anchor.y + Math.cos(swingAngle) * ropeLength,
      vx: Math.cos(swingAngle) * angularVelocity * ropeLength,
      vy: -Math.sin(swingAngle) * angularVelocity * ropeLength,
      angle: swingAngle + Math.PI / 2,
    }
  } else {
    const angle = normalizeAngle(state.capsule.angle + turn * TURN_RATE * dt)
    let vx = state.capsule.vx
    let vy = state.capsule.vy
    if (state.controls.reel) {
      vx += Math.cos(angle) * THRUST_ACCELERATION * dt
      vy += Math.sin(angle) * THRUST_ACCELERATION * dt
    }
    vy += GRAVITY * 0.34 * dt
    const decay = Math.exp(-(state.controls.brake ? BRAKE_DECELERATION : DRIFT_DECAY) * dt)
    vx *= decay
    vy *= decay
    const speed = Math.hypot(vx, vy)
    if (speed > MAX_SPEED) {
      vx = (vx / speed) * MAX_SPEED
      vy = (vy / speed) * MAX_SPEED
    }
    capsule = {
      x: state.capsule.x + vx * dt,
      y: state.capsule.y + vy * dt,
      vx,
      vy,
      angle,
    }
  }

  const moved: SkyhookState = { ...state, capsule, elapsedMs, invulnerableMs, swingAngle, angularVelocity, ropeLength }
  if (invulnerableMs > 0) return moved

  const hitHazard = state.course.hazards.some((hazard) => skyhookDistance(capsule, hazard) < hazard.radius + CAPSULE_RADIUS)
  const hitBoundary = capsule.x < CAPSULE_RADIUS || capsule.x > SKYHOOK_WIDTH - CAPSULE_RADIUS || capsule.y < CAPSULE_RADIUS || capsule.y > SKYHOOK_HEIGHT - CAPSULE_RADIUS
  if (hitHazard || hitBoundary) return takeSkyhookHit(moved, hitHazard ? 'A drifting shard struck the capsule.' : 'The capsule clipped the field boundary.')

  const collected = collectSkyhookBeacons(moved)
  if (collected.nextBeacon === collected.course.beacons.length && skyhookDistance(collected.capsule, collected.course.dock) <= SKYHOOK_DOCK_RADIUS) {
    const timeBonus = Math.max(0, 1800 - Math.floor(elapsedMs / 1000) * 8)
    const hullBonus = collected.hull * 350
    const score = collected.score + 1200 + timeBonus + hullBonus
    return {
      ...collected,
      phase: 'won',
      controls: emptyControls(),
      score,
      message: `Every beacon reached. Dock secured in ${formatFlightTime(elapsedMs)} with ${collected.hull} hull remaining.`,
    }
  }
  return collected
}

function collectSkyhookBeacons(state: SkyhookState): SkyhookState {
  let nextBeacon = state.nextBeacon
  let score = state.score
  while (nextBeacon < state.course.beacons.length && skyhookDistance(state.capsule, state.course.beacons[nextBeacon]!) <= SKYHOOK_BEACON_RADIUS + CAPSULE_RADIUS) {
    nextBeacon += 1
    score += BEACON_POINTS
  }
  if (nextBeacon === state.nextBeacon) return state
  const target = state.course.beacons[nextBeacon]
  return {
    ...state,
    nextBeacon,
    score,
    message: target
      ? `${state.course.beacons[nextBeacon - 1]!.name} collected. Beacon ${nextBeacon + 1} is live.`
      : 'All three beacons collected. Bring the capsule inside the gold dock ring.',
  }
}

function takeSkyhookHit(state: SkyhookState, cause: string): SkyhookState {
  const hull = state.hull - 1
  const anchorIndex = state.lastAnchor
  const anchor = state.course.anchors[anchorIndex]!
  const angle = state.course.startAngle
  const ropeLength = state.course.startLength
  const capsule = {
    x: anchor.x + Math.sin(angle) * ropeLength,
    y: anchor.y + Math.cos(angle) * ropeLength,
    vx: 0,
    vy: 0,
    angle: angle + Math.PI / 2,
  }
  return {
    ...state,
    phase: hull === 0 ? 'over' : 'playing',
    capsule,
    controls: emptyControls(),
    attachedAnchor: anchorIndex,
    ropeLength,
    swingAngle: angle,
    angularVelocity: 0,
    invulnerableMs: COLLISION_INVULNERABILITY_MS,
    hull,
    message: hull === 0
      ? `${cause} Capsule lost. Restart to fly today's course again.`
      : `${cause} ${hull} hull ${hull === 1 ? 'point' : 'points'} remain. Reattached at ${anchor.name}.`,
  }
}

function hashSeed(value: string): number {
  let seed = 2166136261
  for (const character of value) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  return seed
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function normalizeAngle(angle: number): number {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}

function normalizeAngleSigned(angle: number): number {
  let normalized = normalizeAngle(angle)
  if (normalized > Math.PI) normalized -= Math.PI * 2
  return normalized
}

export function formatFlightTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function isUtcDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}
