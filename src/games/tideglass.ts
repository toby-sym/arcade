export const TIDEGLASS_BOARD_SIZE = 7
export const TIDEGLASS_BUOY_COUNT = 3

export type TideglassDirection = 'up' | 'right' | 'down' | 'left'
export type TideglassPhase = 'ready' | 'playing' | 'paused' | 'complete'
export type TideglassBuoy = 0 | 1 | 2

export interface TideglassPuzzle {
  walls: number[]
  sluices: number[]
  starts: [number, number, number]
  docks: [number, number, number]
  par: number
}

export type TideglassRecordedAction =
  | { type: 'select'; buoy: TideglassBuoy }
  | { type: 'move'; direction: TideglassDirection }
  | { type: 'sluice'; index: number }

export interface TideglassProgress {
  date: string
  actions: TideglassRecordedAction[]
  phase: 'playing' | 'paused' | 'complete'
}

export interface TideglassState {
  date: string
  puzzle: TideglassPuzzle
  positions: [number, number, number]
  openSluices: boolean[]
  selectedBuoy: TideglassBuoy
  actionCount: number
  actions: TideglassRecordedAction[]
  phase: TideglassPhase
  message: string
}

export type TideglassAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'select'; buoy: TideglassBuoy }
  | { type: 'move'; direction: TideglassDirection }
  | { type: 'toggle-sluice'; index: number }

type TideglassSolutionAction =
  | { type: 'move'; buoy: TideglassBuoy; direction: TideglassDirection }
  | { type: 'sluice'; index: number }

interface SearchState {
  positions: [number, number, number]
  openMask: number
}

const DELTAS: Record<TideglassDirection, readonly [number, number]> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
}
const DIRECTIONS = Object.keys(DELTAS) as TideglassDirection[]
const BUOY_PERMUTATIONS: Array<[TideglassBuoy, TideglassBuoy, TideglassBuoy]> = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
]
const puzzleCache = new Map<string, TideglassPuzzle>()

export function tideglassPuzzleForDate(date: string): TideglassPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const cached = puzzleCache.get(date)
  if (cached) return clonePuzzle(cached)

  const seed = hashSeed(`tideglass:${date}`)
  const base = seed % 2 === 0 ? verticalHarbor() : horizontalHarbor()
  const turns = (seed >>> 3) % 4
  const mirror = (seed >>> 5) % 2 === 1
  const permutation = BUOY_PERMUTATIONS[(seed >>> 7) % BUOY_PERMUTATIONS.length]!
  const transformed: Omit<TideglassPuzzle, 'par'> = {
    walls: base.walls.map((cell) => transformCell(cell, turns, mirror)).sort((a, b) => a - b),
    sluices: base.sluices.map((cell) => transformCell(cell, turns, mirror)).sort((a, b) => a - b),
    starts: permutation.map((buoy) => transformCell(base.starts[buoy], turns, mirror)) as [number, number, number],
    docks: permutation.map((buoy) => transformCell(base.docks[buoy], turns, mirror)) as [number, number, number],
  }
  const solution = solveTideglassPuzzle(transformed)
  if (!solution) throw new Error('Could not route the daily harbor. Please try again.')
  const puzzle: TideglassPuzzle = { ...transformed, par: solution.length }
  puzzleCache.set(date, puzzle)
  if (puzzleCache.size > 32) puzzleCache.delete(puzzleCache.keys().next().value as string)
  return clonePuzzle(puzzle)
}

export function solveTideglassPuzzle(puzzle: Omit<TideglassPuzzle, 'par'> | TideglassPuzzle): TideglassSolutionAction[] | null {
  const walls = new Set(puzzle.walls)
  const sluiceIndex = new Map(puzzle.sluices.map((cell, index) => [cell, index]))
  const initial: SearchState = { positions: [...puzzle.starts], openMask: 0 }
  const initialKey = searchKey(initial)
  const queue = [initial]
  const parent = new Map<string, { previous: string; action: TideglassSolutionAction }>()
  const seen = new Set([initialKey])
  let solvedKey: string | null = null

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!
    const currentKey = searchKey(current)
    if (current.positions.every((position, buoy) => position === puzzle.docks[buoy])) {
      solvedKey = currentKey
      break
    }

    for (let gate = 0; gate < puzzle.sluices.length; gate += 1) {
      if (current.positions.includes(puzzle.sluices[gate]!)) continue
      const next = { ...current, openMask: current.openMask ^ (1 << gate) }
      addSearchState(next, { type: 'sluice', index: gate }, currentKey, queue, parent, seen)
    }

    for (let buoy = 0; buoy < TIDEGLASS_BUOY_COUNT; buoy += 1) {
      if (current.positions[buoy] === puzzle.docks[buoy]) continue
      for (const direction of DIRECTIONS) {
        const nextCell = adjacentCell(current.positions[buoy]!, direction)
        if (nextCell === null || walls.has(nextCell) || current.positions.some((position, index) => index !== buoy && position === nextCell)) continue
        const gate = sluiceIndex.get(nextCell)
        if (gate !== undefined && (current.openMask & (1 << gate)) === 0) continue
        const positions = [...current.positions] as [number, number, number]
        positions[buoy] = nextCell
        addSearchState({ positions, openMask: current.openMask }, { type: 'move', buoy: buoy as TideglassBuoy, direction }, currentKey, queue, parent, seen)
      }
    }
  }

  if (!solvedKey) return null
  const route: TideglassSolutionAction[] = []
  let key = solvedKey
  while (key !== initialKey) {
    const step = parent.get(key)
    if (!step) return null
    route.push(step.action)
    key = step.previous
  }
  return route.reverse()
}

export function createTideglassState(date: string, progress: TideglassProgress | null = null): TideglassState {
  const puzzle = tideglassPuzzleForDate(date)
  const initial: TideglassState = {
    date,
    puzzle,
    positions: [...puzzle.starts],
    openSluices: puzzle.sluices.map(() => false),
    selectedBuoy: 0,
    actionCount: 0,
    actions: [],
    phase: 'ready',
    message: 'Choose a buoy, switch the sluice gates, and guide all three colors into their matching berths.',
  }
  if (!validTideglassProgress(progress) || progress.date !== date) return initial

  let restored = tideglassReducer(initial, { type: 'start' })
  for (const action of progress.actions) {
    const next = replayAction(restored, action)
    if (next.actions.length !== restored.actions.length + 1) return initial
    restored = next
  }
  const solved = restored.positions.every((position, buoy) => position === puzzle.docks[buoy])
  if ((progress.phase === 'complete') !== solved) return initial
  return progress.phase === 'paused'
    ? { ...restored, phase: 'paused', message: 'The harbor is paused. Your buoy positions are held.' }
    : { ...restored, phase: progress.phase }
}

export function tideglassReducer(state: TideglassState, action: TideglassAction): TideglassState {
  if (action.type === 'restart') return createTideglassState(state.date)
  if (action.type === 'start') return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'The tide is in. Select a buoy and chart a route.' } : state
  if (action.type === 'pause') return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'The harbor is paused. Your buoy positions are held.' } : state
  if (action.type === 'resume') return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'The tide is in. Continue the route.' } : state
  if (state.phase !== 'playing') return state

  if (action.type === 'select') {
    if (!isBuoy(action.buoy)) return state
    const color = BUOY_NAMES[action.buoy]
    return {
      ...state,
      selectedBuoy: action.buoy,
      actions: [...state.actions, { type: 'select', buoy: action.buoy }],
      message: state.positions[action.buoy] === state.puzzle.docks[action.buoy]
        ? `${color} is safely moored. Select another buoy to continue.`
        : `${color} selected. Choose a neighboring water cell or change a sluice.`,
    }
  }

  if (action.type === 'toggle-sluice') {
    if (!Number.isSafeInteger(action.index) || action.index < 0 || action.index >= state.puzzle.sluices.length) return state
    const cell = state.puzzle.sluices[action.index]!
    if (state.positions.includes(cell)) return { ...state, message: 'A buoy is in this sluice. Move it clear before switching the gate.' }
    const openSluices = [...state.openSluices]
    openSluices[action.index] = !openSluices[action.index]
    const open = openSluices[action.index]
    return {
      ...state,
      openSluices,
      actionCount: state.actionCount + 1,
      actions: [...state.actions, { type: 'sluice', index: action.index }],
      message: `Sluice ${action.index + 1} ${open ? 'opened' : 'closed'}. Gate changes count as one move.`,
    }
  }

  if (action.type === 'move') {
    if (!(action.direction in DELTAS)) return state
    const buoy = state.selectedBuoy
    const current = state.positions[buoy]!
    if (current === state.puzzle.docks[buoy]) return { ...state, message: `${BUOY_NAMES[buoy]} is moored. Select another buoy.` }
    const nextCell = adjacentCell(current, action.direction)
    if (nextCell === null || state.puzzle.walls.includes(nextCell)) return { ...state, message: 'The breakwater blocks this current.' }
    const sluice = state.puzzle.sluices.indexOf(nextCell)
    if (sluice >= 0 && !state.openSluices[sluice]) return { ...state, message: `Sluice ${sluice + 1} is closed. Open it before sending a buoy through.` }
    if (state.positions.some((position, index) => index !== buoy && position === nextCell)) return { ...state, message: 'Another buoy occupies that water cell.' }

    const positions = [...state.positions] as [number, number, number]
    positions[buoy] = nextCell
    const actionCount = state.actionCount + 1
    const complete = positions.every((position, index) => position === state.puzzle.docks[index])
    const nextSelected = complete ? buoy : state.positions[buoy] === state.puzzle.docks[buoy] ? nextUndockedBuoy(positions, state.puzzle.docks, buoy) : buoy
    return {
      ...state,
      positions,
      selectedBuoy: nextSelected,
      actionCount,
      actions: [...state.actions, { type: 'move', direction: action.direction }],
      phase: complete ? 'complete' : state.phase,
      message: complete
        ? `All three buoys are safely moored in ${actionCount} moves. The harbor is calm.`
        : positions[buoy] === state.puzzle.docks[buoy]
          ? `${BUOY_NAMES[buoy]} is moored. ${BUOY_NAMES[nextSelected]} is selected.`
          : `${BUOY_NAMES[buoy]} moved one current cell.`,
    }
  }
  return state
}

export function tideglassProgress(state: TideglassState): TideglassProgress | null {
  if (state.phase === 'ready') return null
  return {
    date: state.date,
    actions: state.actions.map((action) => ({ ...action })),
    phase: state.phase,
  }
}

export function validTideglassProgress(value: unknown): value is TideglassProgress {
  if (!value || typeof value !== 'object') return false
  const progress = value as Partial<TideglassProgress>
  if (!isUtcDateKey(progress.date ?? '') || !Array.isArray(progress.actions) || progress.actions.length > 500) return false
  if (progress.phase !== 'playing' && progress.phase !== 'paused' && progress.phase !== 'complete') return false
  return progress.actions.every((action) => {
    if (!action || typeof action !== 'object') return false
    if (action.type === 'select') return isBuoy(action.buoy)
    if (action.type === 'move') return isDirection(action.direction)
    if (action.type === 'sluice') return Number.isSafeInteger(action.index) && action.index >= 0 && action.index < 2
    return false
  })
}

export const TIDEGLASS_BUOY_NAMES = ['Coral', 'Mint', 'Sun'] as const
const BUOY_NAMES = TIDEGLASS_BUOY_NAMES

function replayAction(state: TideglassState, action: TideglassRecordedAction): TideglassState {
  if (action.type === 'select') return tideglassReducer(state, action)
  if (action.type === 'move') return tideglassReducer(state, action)
  return tideglassReducer(state, { type: 'toggle-sluice', index: action.index })
}

function nextUndockedBuoy(positions: number[], docks: number[], justDocked: number): TideglassBuoy {
  for (let offset = 1; offset <= TIDEGLASS_BUOY_COUNT; offset += 1) {
    const candidate = (justDocked + offset) % TIDEGLASS_BUOY_COUNT
    if (positions[candidate] !== docks[candidate]) return candidate as TideglassBuoy
  }
  return justDocked as TideglassBuoy
}

function adjacentCell(index: number, direction: TideglassDirection): number | null {
  const [rowDelta, columnDelta] = DELTAS[direction]
  const row = Math.floor(index / TIDEGLASS_BOARD_SIZE) + rowDelta
  const column = index % TIDEGLASS_BOARD_SIZE + columnDelta
  if (row < 0 || row >= TIDEGLASS_BOARD_SIZE || column < 0 || column >= TIDEGLASS_BOARD_SIZE) return null
  return row * TIDEGLASS_BOARD_SIZE + column
}

function verticalHarbor(): Omit<TideglassPuzzle, 'par'> {
  const walls: number[] = []
  for (let position = 0; position < TIDEGLASS_BOARD_SIZE; position += 1) {
    walls.push(position, (TIDEGLASS_BOARD_SIZE - 1) * TIDEGLASS_BOARD_SIZE + position)
    walls.push(position * TIDEGLASS_BOARD_SIZE, position * TIDEGLASS_BOARD_SIZE + TIDEGLASS_BOARD_SIZE - 1)
  }
  for (let row = 1; row < TIDEGLASS_BOARD_SIZE - 1; row += 1) {
    if (row !== 2 && row !== 4) walls.push(row * TIDEGLASS_BOARD_SIZE + 3)
  }
  return { walls: [...new Set(walls)], sluices: [2 * TIDEGLASS_BOARD_SIZE + 3, 4 * TIDEGLASS_BOARD_SIZE + 3], starts: [8, 12, 37], docks: [40, 36, 9] }
}

function horizontalHarbor(): Omit<TideglassPuzzle, 'par'> {
  const walls: number[] = []
  for (let position = 0; position < TIDEGLASS_BOARD_SIZE; position += 1) {
    walls.push(position, (TIDEGLASS_BOARD_SIZE - 1) * TIDEGLASS_BOARD_SIZE + position)
    walls.push(position * TIDEGLASS_BOARD_SIZE, position * TIDEGLASS_BOARD_SIZE + TIDEGLASS_BOARD_SIZE - 1)
  }
  for (let column = 1; column < TIDEGLASS_BOARD_SIZE - 1; column += 1) {
    if (column !== 2 && column !== 4) walls.push(3 * TIDEGLASS_BOARD_SIZE + column)
  }
  return { walls: [...new Set(walls)], sluices: [3 * TIDEGLASS_BOARD_SIZE + 2, 3 * TIDEGLASS_BOARD_SIZE + 4], starts: [8, 12, 10], docks: [40, 36, 38] }
}

function transformCell(index: number, turns: number, mirror: boolean): number {
  let row = Math.floor(index / TIDEGLASS_BOARD_SIZE)
  let column = index % TIDEGLASS_BOARD_SIZE
  if (mirror) column = TIDEGLASS_BOARD_SIZE - 1 - column
  for (let turn = 0; turn < turns; turn += 1) [row, column] = [column, TIDEGLASS_BOARD_SIZE - 1 - row]
  return row * TIDEGLASS_BOARD_SIZE + column
}

function addSearchState(
  state: SearchState,
  action: TideglassSolutionAction,
  previous: string,
  queue: SearchState[],
  parent: Map<string, { previous: string; action: TideglassSolutionAction }>,
  seen: Set<string>,
) {
  const key = searchKey(state)
  if (seen.has(key)) return
  seen.add(key)
  parent.set(key, { previous, action })
  queue.push(state)
}

function searchKey(state: SearchState): string {
  return `${state.positions.join(',')}:${state.openMask}`
}

function clonePuzzle(puzzle: TideglassPuzzle): TideglassPuzzle {
  return { walls: [...puzzle.walls], sluices: [...puzzle.sluices], starts: [...puzzle.starts], docks: [...puzzle.docks], par: puzzle.par }
}

function hashSeed(value: string): number {
  let seed = 2166136261
  for (const character of value) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  return seed
}

function isBuoy(value: unknown): value is TideglassBuoy {
  return value === 0 || value === 1 || value === 2
}

function isDirection(value: unknown): value is TideglassDirection {
  return value === 'up' || value === 'right' || value === 'down' || value === 'left'
}

function isUtcDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}
