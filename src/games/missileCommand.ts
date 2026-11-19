export const MISSILE_COMMAND_WIDTH = 600
export const MISSILE_COMMAND_HEIGHT = 600
export const MISSILE_CITY_X = [68, 160, 252, 348, 440, 532] as const
export const MISSILE_CITY_Y = 548
export const MISSILE_SILO_X = [76, 300, 524] as const
export const MISSILE_SILO_Y = 548
export const MISSILE_SILO_AMMO = 8

export type MissileCommandPhase = 'ready' | 'playing' | 'paused' | 'over'

export interface IncomingMissile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  target: number
}

export interface DefenseMissile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
}

export interface Blast {
  id: number
  x: number
  y: number
  radius: number
  expanding: boolean
}

export interface MissileCommandState {
  phase: MissileCommandPhase
  score: number
  wave: number
  cities: boolean[]
  ammo: number[]
  incoming: IncomingMissile[]
  defense: DefenseMissile[]
  blasts: Blast[]
  aim: { x: number; y: number }
  spawnRemaining: number
  tick: number
  nextId: number
  message: string
}

export type MissileCommandAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'aim'; x: number; y: number }
  | { type: 'moveAim'; dx: number; dy: number }
  | { type: 'fire' }
  | { type: 'tick' }

const ENEMY_SPAWN_INTERVAL = 70
const DEFENSE_SPEED = 8
const BLAST_MAX_RADIUS = 82

export function createMissileCommandState(): MissileCommandState {
  return {
    phase: 'ready',
    score: 0,
    wave: 1,
    cities: MISSILE_CITY_X.map(() => true),
    ammo: MISSILE_SILO_X.map(() => MISSILE_SILO_AMMO),
    incoming: [],
    defense: [],
    blasts: [],
    aim: { x: MISSILE_COMMAND_WIDTH / 2, y: 250 },
    spawnRemaining: 6,
    tick: 0,
    nextId: 1,
    message: 'Aim above the skyline. Tap or click to launch an interceptor.',
  }
}

export function missileCommandReducer(state: MissileCommandState, action: MissileCommandAction): MissileCommandState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Protect the cities. Each interceptor can clear a cluster.' } : state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Game paused.' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Incoming. Protect the skyline.' } : state
    case 'restart':
      return createMissileCommandState()
    case 'aim':
      if (!Number.isFinite(action.x) || !Number.isFinite(action.y)) return state
      return { ...state, aim: { x: clamp(action.x, 8, MISSILE_COMMAND_WIDTH - 8), y: clamp(action.y, 20, MISSILE_CITY_Y - 38) } }
    case 'moveAim':
      if (!Number.isFinite(action.dx) || !Number.isFinite(action.dy)) return state
      return { ...state, aim: { x: clamp(state.aim.x + action.dx, 8, MISSILE_COMMAND_WIDTH - 8), y: clamp(state.aim.y + action.dy, 20, MISSILE_CITY_Y - 38) } }
    case 'fire':
      return fireInterceptor(state)
    case 'tick':
      return advanceMissileCommand(state)
  }
}

function fireInterceptor(state: MissileCommandState): MissileCommandState {
  if (state.phase !== 'playing' || state.defense.length >= 3) return state
  const availableSilos = state.ammo
    .map((ammo, index) => ({ ammo, index }))
    .filter((silo) => silo.ammo > 0)
    .sort((first, second) => Math.abs(MISSILE_SILO_X[first.index]! - state.aim.x) - Math.abs(MISSILE_SILO_X[second.index]! - state.aim.x))
  const silo = availableSilos[0]
  if (!silo) return state

  const startX = MISSILE_SILO_X[silo.index]!
  const startY = MISSILE_SILO_Y
  const dx = state.aim.x - startX
  const dy = state.aim.y - startY
  const length = Math.max(1, Math.hypot(dx, dy))
  const ammo = [...state.ammo]
  ammo[silo.index] = Math.max(0, ammo[silo.index]! - 1)
  return {
    ...state,
    ammo,
    defense: [...state.defense, { id: state.nextId, x: startX, y: startY, vx: (dx / length) * DEFENSE_SPEED, vy: (dy / length) * DEFENSE_SPEED, targetX: state.aim.x, targetY: state.aim.y }],
    nextId: state.nextId + 1,
    message: 'Interceptor away. Keep an eye on the whole skyline.',
  }
}

function advanceMissileCommand(state: MissileCommandState): MissileCommandState {
  if (state.phase !== 'playing') return state
  const tick = state.tick + 1
  let nextId = state.nextId
  let spawnRemaining = state.spawnRemaining
  let incoming = state.incoming.map((missile) => ({ ...missile, x: missile.x + missile.vx, y: missile.y + missile.vy }))
  if (spawnRemaining > 0 && tick % ENEMY_SPAWN_INTERVAL === 0) {
    const missile = createIncomingMissile(state.wave, 5 + state.wave - spawnRemaining, state.cities, tick, nextId)
    if (missile) {
      incoming = [...incoming, missile]
      nextId += 1
    }
    spawnRemaining -= 1
  }

  let blasts = state.blasts.map((blast) => {
    if (blast.expanding) {
      const radius = blast.radius + 6
      return { ...blast, radius: Math.min(BLAST_MAX_RADIUS, radius), expanding: radius < BLAST_MAX_RADIUS }
    }
    return { ...blast, radius: Math.max(0, blast.radius - 3) }
  }).filter((blast) => blast.radius > 0)

  let defense: DefenseMissile[] = []
  for (const missile of state.defense) {
    const x = missile.x + missile.vx
    const y = missile.y + missile.vy
    if (Math.hypot(missile.targetX - x, missile.targetY - y) <= DEFENSE_SPEED) {
      blasts = [...blasts, { id: nextId, x: missile.targetX, y: missile.targetY, radius: 2, expanding: true }]
      nextId += 1
    } else {
      defense.push({ ...missile, x, y })
    }
  }

  const cities = [...state.cities]
  let score = state.score
  const remainingIncoming: IncomingMissile[] = []
  for (const missile of incoming) {
    const burst = blasts.find((blast) => Math.hypot(blast.x - missile.x, blast.y - missile.y) <= blast.radius + 8)
    if (burst) {
      score += 25
      continue
    }
    const targetX = MISSILE_CITY_X[missile.target]
    if (targetX !== undefined && missile.y >= MISSILE_CITY_Y && Math.abs(missile.x - targetX) <= 20) {
      cities[missile.target] = false
      continue
    }
    remainingIncoming.push(missile)
  }

  const phase = cities.some(Boolean) ? 'playing' : 'over'
  if (phase === 'over') {
    return { ...state, phase, tick, score, cities, incoming: remainingIncoming, defense, blasts, spawnRemaining, nextId, message: 'The skyline is lost. Game over.' }
  }

  let wave = state.wave
  let ammo = state.ammo
  let message = state.message
  if (spawnRemaining === 0 && remainingIncoming.length === 0 && defense.length === 0 && blasts.length === 0) {
    wave += 1
    spawnRemaining = 5 + wave
    ammo = MISSILE_SILO_X.map(() => MISSILE_SILO_AMMO)
    message = `Wave ${wave}. The silos are reloaded. Incoming!`
  }

  return { ...state, phase, tick, score, wave, cities, ammo, incoming: remainingIncoming, defense, blasts, spawnRemaining, nextId, message }
}

function createIncomingMissile(wave: number, launched: number, cities: boolean[], tick: number, id: number): IncomingMissile | null {
  const targets = cities.map((alive, index) => alive ? index : -1).filter((index) => index >= 0)
  if (targets.length === 0) return null
  const target = targets[(launched + wave) % targets.length]!
  const startX = 28 + ((tick * 37 + wave * 101 + launched * 83) % 544)
  const targetX = MISSILE_CITY_X[target]!
  const dx = targetX - startX
  const dy = MISSILE_CITY_Y
  const length = Math.hypot(dx, dy)
  const speed = 1.05 + wave * 0.12
  return { id, x: startX, y: 0, vx: (dx / length) * speed, vy: (dy / length) * speed, target }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
