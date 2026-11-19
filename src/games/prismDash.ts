export const PRISM_DASH_LANE_COUNT = 3
export const PRISM_DASH_SEGMENT_COUNT = 24
export const PRISM_DASH_STARTING_LIVES = 3

export type PrismDashLane = 0 | 1 | 2
export type PrismDashPhase = 'ready' | 'playing' | 'paused' | 'won' | 'over'
export type PrismDashOutcome = 'shard' | 'gate' | 'clear' | null

export interface PrismDashSegment {
  shardLane: PrismDashLane
  gateLane: PrismDashLane
}

export interface PrismDashState {
  date: string
  course: PrismDashSegment[]
  segmentIndex: number
  segmentElapsedMs: number
  elapsedMs: number
  lane: PrismDashLane
  score: number
  shards: number
  gatesHit: number
  lives: number
  streak: number
  outcome: PrismDashOutcome
  phase: PrismDashPhase
  message: string
}

export type PrismDashAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'lane'; lane: PrismDashLane }
  | { type: 'move'; delta: -1 | 1 }
  | { type: 'tick'; deltaMs: number }

export function prismDashCourseForDate(date: string): PrismDashSegment[] {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  let seed = 2166136261
  for (const character of `prism-dash:${date}`) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x1_0000_0000
  }

  let previousGate: number | null = null
  let repeatedGates = 0
  let previousShard: number | null = null
  return Array.from({ length: PRISM_DASH_SEGMENT_COUNT }, () => {
    let gateLane = Math.floor(random() * PRISM_DASH_LANE_COUNT)
    if (gateLane === previousGate) repeatedGates += 1
    else repeatedGates = 1
    if (repeatedGates > 2) {
      gateLane = (gateLane + 1 + Math.floor(random() * (PRISM_DASH_LANE_COUNT - 1))) % PRISM_DASH_LANE_COUNT
      repeatedGates = 1
    }

    let shardLane = Math.floor(random() * (PRISM_DASH_LANE_COUNT - 1))
    if (shardLane >= gateLane) shardLane += 1
    if (shardLane === previousShard) {
      const remainingLane = [0, 1, 2].find((lane) => lane !== gateLane && lane !== shardLane)
      if (remainingLane !== undefined) shardLane = remainingLane
    }
    previousGate = gateLane
    previousShard = shardLane
    return { gateLane: gateLane as PrismDashLane, shardLane: shardLane as PrismDashLane }
  })
}

export function prismDashSegmentDuration(index: number): number {
  return Math.max(760, 1450 - Math.floor(index / 4) * 110)
}

export function createPrismDashState(date: string): PrismDashState {
  const course = prismDashCourseForDate(date)
  const first = course[0]!
  return {
    date,
    course,
    segmentIndex: 0,
    segmentElapsedMs: 0,
    elapsedMs: 0,
    lane: 1,
    score: 0,
    shards: 0,
    gatesHit: 0,
    lives: PRISM_DASH_STARTING_LIVES,
    streak: 0,
    outcome: null,
    phase: 'ready',
    message: `The first gate is in lane ${first.gateLane + 1}. The shard is in lane ${first.shardLane + 1}.`,
  }
}

export function prismDashReducer(state: PrismDashState, action: PrismDashAction): PrismDashState {
  if (action.type === 'restart') return createPrismDashState(state.date)
  if (action.type === 'start') return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Run started. Switch lanes before the gate reaches you.' } : state
  if (action.type === 'pause') return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Run paused. The next gate is held back.' } : state
  if (action.type === 'resume') return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Run resumed. Read the gate and shard lanes.' } : state
  if (action.type === 'lane') {
    if (state.phase !== 'playing' || !isLane(action.lane) || action.lane === state.lane) return state
    return { ...state, lane: action.lane, message: `Lane ${action.lane + 1}.` }
  }
  if (action.type === 'move') {
    if (state.phase !== 'playing' || (action.delta !== -1 && action.delta !== 1)) return state
    const lane = Math.max(0, Math.min(PRISM_DASH_LANE_COUNT - 1, state.lane + action.delta)) as PrismDashLane
    if (lane === state.lane) return state
    return { ...state, lane, message: `Lane ${lane + 1}.` }
  }
  if (action.type !== 'tick' || state.phase !== 'playing' || !Number.isFinite(action.deltaMs) || action.deltaMs <= 0) return state

  let remaining = action.deltaMs
  let next: PrismDashState = { ...state, elapsedMs: state.elapsedMs + remaining }
  while (remaining > 0 && next.phase === 'playing') {
    const untilCheckpoint = prismDashSegmentDuration(next.segmentIndex) - next.segmentElapsedMs
    if (remaining < untilCheckpoint) {
      next = { ...next, segmentElapsedMs: next.segmentElapsedMs + remaining }
      remaining = 0
    } else {
      remaining -= untilCheckpoint
      next = resolveSegment(next)
    }
  }
  return next
}

export function formatPrismDashTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function resolveSegment(state: PrismDashState): PrismDashState {
  const segment = state.course[state.segmentIndex]!
  let score = state.score
  let shards = state.shards
  let gatesHit = state.gatesHit
  let lives = state.lives
  let streak = state.streak
  let outcome: PrismDashOutcome = 'clear'
  let message = `Clear lane. Segment ${state.segmentIndex + 1} passed.`

  if (state.lane === segment.gateLane) {
    gatesHit += 1
    lives -= 1
    streak = 0
    outcome = 'gate'
    message = lives === 0 ? 'Run over. Three gates caught the runner.' : `Gate hit. ${lives} ${lives === 1 ? 'life' : 'lives'} left.`
  } else if (state.lane === segment.shardLane) {
    shards += 1
    streak += 1
    score += 100 + Math.min(streak * 15, 75)
    outcome = 'shard'
    message = `Shard caught. ${streak} in a row.`
  } else {
    streak = 0
  }

  const segmentIndex = state.segmentIndex + 1
  const phase = lives === 0 ? 'over' : segmentIndex >= state.course.length ? 'won' : 'playing'
  if (phase === 'won') message = `Finish line reached. ${shards} shards, ${score} points, ${formatPrismDashTime(state.elapsedMs)}.`
  return {
    ...state,
    segmentIndex: phase === 'won' ? state.segmentIndex : segmentIndex,
    segmentElapsedMs: phase === 'playing' ? 0 : prismDashSegmentDuration(state.segmentIndex),
    score,
    shards,
    gatesHit,
    lives,
    streak,
    outcome,
    phase,
    message,
  }
}

function isLane(value: number): value is PrismDashLane {
  return Number.isSafeInteger(value) && value >= 0 && value < PRISM_DASH_LANE_COUNT
}

function isUtcDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}
