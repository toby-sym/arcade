export const GRAVITY_LOOM_BOARD_SIZE = 7
export const GRAVITY_LOOM_STAGE_COUNT = 4

export type GravityLoomDirection = 'up' | 'right' | 'down' | 'left'
export type GravityLoomPhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface GravityLoomPuzzle {
  walls: number[]
  portals: [number, number] | null
  start: number
  receiver: number
  par: number
}

export interface GravityLoomProgress {
  date: string
  stageIndex: number
  completedStageMoves: number[]
  currentMoves: GravityLoomDirection[]
  phase: 'playing' | 'paused' | 'complete'
}

export interface GravityLoomState {
  date: string
  puzzles: GravityLoomPuzzle[]
  stageIndex: number
  spark: number
  stageMoves: number
  totalMoves: number
  completedStageMoves: number[]
  currentMoves: GravityLoomDirection[]
  phase: GravityLoomPhase
  outcome: 'wall' | 'portal' | 'receiver' | null
  message: string
}

export type GravityLoomAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'tilt'; direction: GravityLoomDirection }

const DIRECTIONS: Record<GravityLoomDirection, readonly [number, number]> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
}

export function gravityLoomPuzzleForDate(date: string, stage: number): GravityLoomPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  if (!Number.isSafeInteger(stage) || stage < 0 || stage >= GRAVITY_LOOM_STAGE_COUNT) {
    throw new RangeError(`Stage must be between 0 and ${GRAVITY_LOOM_STAGE_COUNT - 1}.`)
  }

  let seed = hashSeed(`gravity-loom:${date}:${stage}`)
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x1_0000_0000
  }
  const cell = () => 1 + Math.floor(random() * (GRAVITY_LOOM_BOARD_SIZE - 2))
  let easiest: GravityLoomPuzzle | null = null
  let easiestPortalRoute: GravityLoomPuzzle | null = null

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const start = cell() * GRAVITY_LOOM_BOARD_SIZE + cell()
    let receiver = cell() * GRAVITY_LOOM_BOARD_SIZE + cell()
    while (receiver === start) receiver = cell() * GRAVITY_LOOM_BOARD_SIZE + cell()

    const blocked = new Set([start, receiver])
    const walls: number[] = []
    const wallCount = 3 + stage * 2 + Math.floor(random() * 2)
    while (walls.length < wallCount) {
      const next = cell() * GRAVITY_LOOM_BOARD_SIZE + cell()
      if (blocked.has(next)) continue
      blocked.add(next)
      walls.push(next)
    }

    let portals: [number, number] | null = null
    if (stage > 0) {
      const portalA = chooseFreeCell(blocked, cell, random)
      blocked.add(portalA)
      const portalB = chooseFreeCell(blocked, cell, random)
      portals = [portalA, portalB]
    }

    const candidate = { walls, portals, start, receiver, par: 0 }
    const solution = solveGravityLoomPuzzle(candidate)
    if (!solution) continue
    candidate.par = solution.length
    if (!easiest || solution.length < easiest.par) easiest = candidate
    const usesPortal = solutionUsesPortal(candidate, solution)
    if (usesPortal && (!easiestPortalRoute || solution.length < easiestPortalRoute.par)) easiestPortalRoute = candidate
    if (stage > 0 && !usesPortal) continue
    if (solution.length >= 2 && solution.length <= 12) return candidate
  }

  if (easiestPortalRoute) return easiestPortalRoute
  if (easiest) return easiest
  throw new Error('Could not create a solvable daily chamber. Please try again.')
}

export function solveGravityLoomPuzzle(puzzle: GravityLoomPuzzle): GravityLoomDirection[] | null {
  const queue: Array<{ position: number; moves: GravityLoomDirection[] }> = [{ position: puzzle.start, moves: [] }]
  const visited = new Set([puzzle.start])
  const walls = new Set(puzzle.walls)

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!
    for (const direction of Object.keys(DIRECTIONS) as GravityLoomDirection[]) {
      const result = rollGravityLoomSpark(puzzle, current.position, direction, walls)
      const moves = [...current.moves, direction]
      if (result.reachedReceiver) return moves
      if (result.position === current.position || visited.has(result.position)) continue
      visited.add(result.position)
      queue.push({ position: result.position, moves })
    }
  }
  return null
}

function solutionUsesPortal(puzzle: GravityLoomPuzzle, solution: GravityLoomDirection[]): boolean {
  let position = puzzle.start
  for (const direction of solution) {
    const result = rollGravityLoomSpark(puzzle, position, direction)
    if (result.usedPortal) return true
    position = result.position
    if (result.reachedReceiver) break
  }
  return false
}

export function rollGravityLoomSpark(
  puzzle: GravityLoomPuzzle,
  start: number,
  direction: GravityLoomDirection,
  wallPositions = new Set(puzzle.walls),
): { position: number; reachedReceiver: boolean; usedPortal: boolean } {
  const [rowStep, columnStep] = DIRECTIONS[direction]
  const portalA = puzzle.portals?.[0]
  const portalB = puzzle.portals?.[1]
  let position = start
  let usedPortal = false

  while (true) {
    const row = Math.floor(position / GRAVITY_LOOM_BOARD_SIZE) + rowStep
    const column = position % GRAVITY_LOOM_BOARD_SIZE + columnStep
    if (row < 0 || row >= GRAVITY_LOOM_BOARD_SIZE || column < 0 || column >= GRAVITY_LOOM_BOARD_SIZE) {
      return { position, reachedReceiver: false, usedPortal }
    }

    const next = row * GRAVITY_LOOM_BOARD_SIZE + column
    if (wallPositions.has(next)) return { position, reachedReceiver: false, usedPortal }
    position = next
    if (position === puzzle.receiver) return { position, reachedReceiver: true, usedPortal }

    if (!usedPortal && (position === portalA || position === portalB)) {
      position = position === portalA ? portalB! : portalA!
      usedPortal = true
    }
  }
}

export function createGravityLoomState(date: string, progress: GravityLoomProgress | null = null): GravityLoomState {
  const puzzles = Array.from({ length: GRAVITY_LOOM_STAGE_COUNT }, (_, stage) => gravityLoomPuzzleForDate(date, stage))
  const initial: GravityLoomState = {
    date,
    puzzles,
    stageIndex: 0,
    spark: puzzles[0]!.start,
    stageMoves: 0,
    totalMoves: 0,
    completedStageMoves: [],
    currentMoves: [],
    phase: 'ready',
    outcome: null,
    message: `Tilt the chamber to roll the spark into receiver 1. The daily route has ${GRAVITY_LOOM_STAGE_COUNT} chambers.`,
  }
  if (!isGravityLoomProgress(progress) || progress.date !== date) return initial

  const base: GravityLoomState = {
    ...initial,
    stageIndex: progress.stageIndex,
    completedStageMoves: progress.completedStageMoves.slice(0, progress.stageIndex),
    totalMoves: progress.completedStageMoves.slice(0, progress.stageIndex).reduce((sum, moves) => sum + moves, 0),
    spark: puzzles[progress.stageIndex]!.start,
    phase: 'playing',
    message: 'Route restored. Tilt the chamber to continue.',
  }
  let restored = base
  for (const direction of progress.currentMoves) restored = gravityLoomReducer(restored, { type: 'tilt', direction })

  if (restored.currentMoves.length !== progress.currentMoves.length) return initial
  const expectedPhase = progress.phase === 'complete' ? 'complete' : 'playing'
  if (restored.phase !== expectedPhase) return initial
  return progress.phase === 'paused' ? { ...restored, phase: 'paused', message: 'Route restored and paused.' } : restored
}

export function gravityLoomReducer(state: GravityLoomState, action: GravityLoomAction): GravityLoomState {
  if (action.type === 'restart') return createGravityLoomState(state.date)
  if (action.type === 'start') return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'The chamber is live. Find the first receiver.' } : state
  if (action.type === 'pause') return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Route paused. Your spark is held in place.' } : state
  if (action.type === 'resume') return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Route resumed. Choose a direction to tilt.' } : state
  if (action.type !== 'tilt' || state.phase !== 'playing' || !(action.direction in DIRECTIONS)) return state

  const puzzle = state.puzzles[state.stageIndex]!
  const result = rollGravityLoomSpark(puzzle, state.spark, action.direction)
  const currentMoves = [...state.currentMoves, action.direction]
  const totalMoves = state.totalMoves + 1
  if (!result.reachedReceiver) {
    return {
      ...state,
      spark: result.position,
      stageMoves: state.stageMoves + 1,
      totalMoves,
      currentMoves,
      outcome: result.usedPortal ? 'portal' : 'wall',
      message: result.usedPortal
        ? `The spark crossed the portal and settled. ${state.stageMoves + 1} tilts in this chamber.`
        : result.position === state.spark
          ? 'The spark could not move. That tilt still counts; try another direction.'
          : `The spark settled against the chamber wall. ${state.stageMoves + 1} tilts in this chamber.`,
    }
  }

  const completedStageMoves = [...state.completedStageMoves, state.stageMoves + 1]
  if (state.stageIndex === GRAVITY_LOOM_STAGE_COUNT - 1) {
    return {
      ...state,
      spark: result.position,
      stageMoves: state.stageMoves + 1,
      totalMoves,
      completedStageMoves,
      currentMoves,
      phase: 'complete',
      outcome: 'receiver',
      message: `All four receivers are lit in ${totalMoves} tilts. The daily loom is complete.`,
    }
  }

  const nextIndex = state.stageIndex + 1
  return {
    ...state,
    stageIndex: nextIndex,
    spark: state.puzzles[nextIndex]!.start,
    stageMoves: 0,
    totalMoves,
    completedStageMoves,
    currentMoves: [],
    outcome: 'receiver',
    message: `Receiver ${state.stageIndex + 1} lit in ${state.stageMoves + 1} tilts. Chamber ${nextIndex + 1} is ready.`,
  }
}

export function gravityLoomProgress(state: GravityLoomState): GravityLoomProgress | null {
  if (state.phase === 'ready') return null
  return {
    date: state.date,
    stageIndex: state.phase === 'complete' ? GRAVITY_LOOM_STAGE_COUNT - 1 : state.stageIndex,
    completedStageMoves: [...state.completedStageMoves],
    currentMoves: [...state.currentMoves],
    phase: state.phase === 'complete' ? 'complete' : state.phase,
  }
}

export function isGravityLoomProgress(value: unknown): value is GravityLoomProgress {
  if (!value || typeof value !== 'object') return false
  const progress = value as Partial<GravityLoomProgress>
  if (!isUtcDateKey(progress.date ?? '') || !Number.isSafeInteger(progress.stageIndex)) return false
  if (!Array.isArray(progress.completedStageMoves) || !progress.completedStageMoves.every((moves) => Number.isSafeInteger(moves) && moves > 0 && moves <= 1000)) return false
  if (!Array.isArray(progress.currentMoves) || progress.currentMoves.length > 1000 || !progress.currentMoves.every(isDirection)) return false
  if (progress.phase !== 'playing' && progress.phase !== 'paused' && progress.phase !== 'complete') return false
  const stageIndex = progress.stageIndex!
  if (stageIndex < 0 || stageIndex >= GRAVITY_LOOM_STAGE_COUNT) return false
  if (progress.phase === 'complete') return stageIndex === GRAVITY_LOOM_STAGE_COUNT - 1 && progress.completedStageMoves.length === GRAVITY_LOOM_STAGE_COUNT && progress.currentMoves.length === progress.completedStageMoves.at(-1)
  return progress.completedStageMoves.length === stageIndex
}

function chooseFreeCell(blocked: Set<number>, cell: () => number, random: () => number): number {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const next = cell() * GRAVITY_LOOM_BOARD_SIZE + cell()
    if (!blocked.has(next)) return next
  }
  const free = Array.from({ length: GRAVITY_LOOM_BOARD_SIZE ** 2 }, (_, index) => index)
    .filter((index) => isInteriorCell(index) && !blocked.has(index))
  return free[Math.floor(random() * free.length)]!
}

function hashSeed(value: string): number {
  let seed = 2166136261
  for (const character of value) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  return seed
}

function isDirection(value: unknown): value is GravityLoomDirection {
  return value === 'up' || value === 'right' || value === 'down' || value === 'left'
}

function isInteriorCell(index: number): boolean {
  const row = Math.floor(index / GRAVITY_LOOM_BOARD_SIZE)
  const column = index % GRAVITY_LOOM_BOARD_SIZE
  return row > 0 && row < GRAVITY_LOOM_BOARD_SIZE - 1 && column > 0 && column < GRAVITY_LOOM_BOARD_SIZE - 1
}

function isUtcDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}
