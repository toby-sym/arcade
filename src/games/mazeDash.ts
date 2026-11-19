export const MAZE_DASH_WIDTH = 13
export const MAZE_DASH_CELL_COUNT = MAZE_DASH_WIDTH * MAZE_DASH_WIDTH
export const MAZE_DASH_START = 14
export const MAZE_DASH_EXIT = 154
export const MAZE_DASH_ROWS = [
  '#############',
  '#.....#.....#',
  '#.###.#.###.#',
  '#.#...#...#.#',
  '#.#.#####.#.#',
  '#...........#',
  '###.#.###.###',
  '#...#...#...#',
  '#.#####.###.#',
  '#.....#.....#',
  '#.###.#.###.#',
  '#...........#',
  '#############',
]

export type MazeDashPhase = 'ready' | 'playing' | 'paused' | 'won' | 'lost'
export type MazeDashDirection = 'up' | 'right' | 'down' | 'left'

export interface MazeDashState {
  player: number
  sentries: number[]
  pellets: number[]
  score: number
  lives: number
  moves: number
  phase: MazeDashPhase
}

export type MazeDashAction =
  | { type: 'start' }
  | { type: 'move'; direction: MazeDashDirection }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }

const INITIAL_SENTRIES = [24, 71, 144]
const DIRECTIONS: Record<MazeDashDirection, [number, number]> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
}
const SENTRY_MOVE_EVERY = 2

export function createMazeDashState(): MazeDashState {
  const excluded = new Set([MAZE_DASH_START, MAZE_DASH_EXIT, ...INITIAL_SENTRIES])
  const pellets = Array.from({ length: MAZE_DASH_CELL_COUNT }, (_, cell) => cell)
    .filter((cell) => isOpen(cell) && !excluded.has(cell))
  return {
    player: MAZE_DASH_START,
    sentries: [...INITIAL_SENTRIES],
    pellets,
    score: 0,
    lives: 3,
    moves: 0,
    phase: 'ready',
  }
}

export function mazeDashReducer(state: MazeDashState, action: MazeDashAction): MazeDashState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing' } : state
    case 'move':
      return movePlayer(state, action.direction)
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
    case 'restart':
      return createMazeDashState()
  }
}

export function isMazeDashWall(cell: number): boolean {
  return !isOpen(cell)
}

function movePlayer(state: MazeDashState, direction: MazeDashDirection): MazeDashState {
  if (state.phase !== 'playing') return state
  const destination = stepTo(state.player, direction)
  if (destination === null) return state

  const pellets = state.pellets.filter((cell) => cell !== destination)
  const score = pellets.length === state.pellets.length ? state.score : state.score + 10
  const moves = state.moves + 1
  const sentries = moves % SENTRY_MOVE_EVERY === 0
    ? moveSentries(state.sentries, destination)
    : state.sentries
  const moved = { ...state, player: destination, sentries, pellets, score, moves }

  if (sentries.includes(destination)) {
    const lives = state.lives - 1
    return {
      ...moved,
      player: MAZE_DASH_START,
      sentries: [...INITIAL_SENTRIES],
      lives,
      phase: lives === 0 ? 'lost' : 'playing',
    }
  }
  if (destination === MAZE_DASH_EXIT && pellets.length === 0) return { ...moved, phase: 'won' }
  return moved
}

function moveSentries(sentries: number[], player: number): number[] {
  const moved: number[] = []
  for (let index = 0; index < sentries.length; index += 1) {
    const occupied = new Set([...sentries.slice(index + 1), ...moved])
    moved.push(nextPathCell(sentries[index]!, player, occupied))
  }
  return moved
}

function nextPathCell(start: number, target: number, occupied: Set<number>): number {
  if (start === target) return start
  const queue = [start]
  const previous = new Map<number, number | null>([[start, null]])
  let found = false

  for (let cursor = 0; cursor < queue.length && !found; cursor += 1) {
    const cell = queue[cursor]!
    for (const neighbor of adjacentCells(cell)) {
      if (previous.has(neighbor) || occupied.has(neighbor) || isMazeDashWall(neighbor)) continue
      previous.set(neighbor, cell)
      if (neighbor === target) {
        found = true
        break
      }
      queue.push(neighbor)
    }
  }

  if (!found) return start
  let next = target
  let parent = previous.get(next)
  while (parent !== start && parent !== null && parent !== undefined) {
    next = parent
    parent = previous.get(next)
  }
  return next
}

function stepTo(cell: number, direction: MazeDashDirection): number | null {
  const [rowStep, columnStep] = DIRECTIONS[direction]
  const row = Math.floor(cell / MAZE_DASH_WIDTH) + rowStep
  const column = cell % MAZE_DASH_WIDTH + columnStep
  if (row < 0 || row >= MAZE_DASH_WIDTH || column < 0 || column >= MAZE_DASH_WIDTH) return null
  const next = row * MAZE_DASH_WIDTH + column
  return isOpen(next) ? next : null
}

function adjacentCells(cell: number): number[] {
  const row = Math.floor(cell / MAZE_DASH_WIDTH)
  const column = cell % MAZE_DASH_WIDTH
  const cells: number[] = []
  for (const [rowStep, columnStep] of Object.values(DIRECTIONS)) {
    const nextRow = row + rowStep
    const nextColumn = column + columnStep
    if (nextRow >= 0 && nextRow < MAZE_DASH_WIDTH && nextColumn >= 0 && nextColumn < MAZE_DASH_WIDTH) {
      cells.push(nextRow * MAZE_DASH_WIDTH + nextColumn)
    }
  }
  return cells
}

function isOpen(cell: number): boolean {
  if (!Number.isInteger(cell) || cell < 0 || cell >= MAZE_DASH_CELL_COUNT) return false
  const row = Math.floor(cell / MAZE_DASH_WIDTH)
  const column = cell % MAZE_DASH_WIDTH
  return MAZE_DASH_ROWS[row]?.[column] !== '#'
}
