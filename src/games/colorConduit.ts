export const COLOR_CONDUIT_GRID_SIZE = 6
export const COLOR_CONDUIT_CELL_COUNT = COLOR_CONDUIT_GRID_SIZE ** 2
export const COLOR_CONDUIT_ROUTE_COUNT = 4

export const COLOR_CONDUIT_SIGNALS = [
  { name: 'Amber', glyph: '◆', color: 'amber' },
  { name: 'Cyan', glyph: '●', color: 'cyan' },
  { name: 'Coral', glyph: '▲', color: 'coral' },
  { name: 'Violet', glyph: '✚', color: 'violet' },
] as const

export type ColorConduitSignal = 0 | 1 | 2 | 3
export type ColorConduitPhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface ColorConduitRoute {
  signal: ColorConduitSignal
  start: number
  end: number
  solution: number[]
}

export interface ColorConduitPuzzle {
  date: string
  routes: ColorConduitRoute[]
}

export interface ColorConduitProgress {
  date: string
  paths: number[][]
  activeSignal: ColorConduitSignal | null
  moves: number
  mistakes: number
  elapsedSeconds: number
}

export interface ColorConduitState extends ColorConduitProgress {
  puzzle: ColorConduitPuzzle
  phase: ColorConduitPhase
  cursor: number
  message: string
}

export type ColorConduitAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'select'; signal: ColorConduitSignal }
  | { type: 'cell'; index: number }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'cursor'; index: number }
  | { type: 'tick' }

export function colorConduitPuzzleForDate(date: string): ColorConduitPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  let seed = 2166136261
  for (const character of `color-conduit:${date}`) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  const nextRandom = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x1_0000_0000
  }

  const order: number[] = []
  for (let row = 0; row < COLOR_CONDUIT_GRID_SIZE; row += 1) {
    const columns = Array.from({ length: COLOR_CONDUIT_GRID_SIZE }, (_, column) => column)
    if (row % 2 === 1) columns.reverse()
    for (const column of columns) order.push(row * COLOR_CONDUIT_GRID_SIZE + column)
  }

  const rotation = Math.floor(nextRandom() * 4)
  const reflect = nextRandom() < .5
  const transform = (cell: number) => {
    let row = Math.floor(cell / COLOR_CONDUIT_GRID_SIZE)
    let column = cell % COLOR_CONDUIT_GRID_SIZE
    if (reflect) column = COLOR_CONDUIT_GRID_SIZE - 1 - column
    for (let turn = 0; turn < rotation; turn += 1) [row, column] = [column, COLOR_CONDUIT_GRID_SIZE - 1 - row]
    return row * COLOR_CONDUIT_GRID_SIZE + column
  }

  const signals: ColorConduitSignal[] = [0, 1, 2, 3]
  for (let index = signals.length - 1; index > 0; index -= 1) {
    const other = Math.floor(nextRandom() * (index + 1))
    ;[signals[index], signals[other]] = [signals[other]!, signals[index]!]
  }

  const routes: ColorConduitRoute[] = []
  for (let routeIndex = 0; routeIndex < COLOR_CONDUIT_ROUTE_COUNT; routeIndex += 1) {
    const solution = order.slice(routeIndex * 9, routeIndex * 9 + 9).map(transform)
    routes.push({ signal: signals[routeIndex]!, start: solution[0]!, end: solution[solution.length - 1]!, solution })
  }
  return { date, routes }
}

export function createColorConduitState(date: string, progress?: ColorConduitProgress | null): ColorConduitState {
  const puzzle = colorConduitPuzzleForDate(date)
  const valid = progress?.date === date && validColorConduitProgress(progress) ? progress : null
  const paths = valid ? valid.paths.map((path) => [...path]) : Array.from({ length: COLOR_CONDUIT_ROUTE_COUNT }, () => [])
  const activeSignal = valid?.activeSignal ?? null
  const moves = valid?.moves ?? 0
  const mistakes = valid?.mistakes ?? 0
  const elapsedSeconds = valid?.elapsedSeconds ?? 0
  const complete = isColorConduitSolved(puzzle, paths)
  return {
    date,
    puzzle,
    paths,
    activeSignal,
    moves,
    mistakes,
    elapsedSeconds,
    phase: complete ? 'complete' : valid ? 'paused' : 'ready',
    cursor: 0,
    message: complete
      ? `All four conduits are carrying power. Solved in ${formatColorConduitTime(elapsedSeconds)}.`
      : valid
        ? 'Saved routes restored. Resume when you are ready.'
        : 'Connect each matching pair. Every square must carry one signal before the station is live.',
  }
}

export function colorConduitProgress(state: ColorConduitState): ColorConduitProgress {
  return {
    date: state.date,
    paths: state.paths.map((path) => [...path]),
    activeSignal: state.activeSignal,
    moves: state.moves,
    mistakes: state.mistakes,
    elapsedSeconds: state.elapsedSeconds,
  }
}

export function colorConduitReducer(state: ColorConduitState, action: ColorConduitAction): ColorConduitState {
  if (action.type === 'start') return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Choose a signal or tap one of its terminals to begin a route.' } : state
  if (action.type === 'pause') return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Power paused. Your routes are safe.' } : state
  if (action.type === 'resume') return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Power restored. Continue the active conduit.' } : state
  if (action.type === 'restart') return createColorConduitState(state.date)
  if (action.type === 'cursor') return Number.isSafeInteger(action.index) && action.index >= 0 && action.index < COLOR_CONDUIT_CELL_COUNT ? { ...state, cursor: action.index } : state
  if (action.type === 'tick') return state.phase === 'playing' ? { ...state, elapsedSeconds: state.elapsedSeconds + 1 } : state
  if (state.phase !== 'playing') return state

  if (action.type === 'select') return selectSignal(state, action.signal)
  if (action.type === 'cell') return routeThroughCell(state, action.index)
  if (action.type === 'undo') {
    if (state.activeSignal === null) return { ...state, message: 'Choose a signal before undoing a route.' }
    const path = state.paths[state.activeSignal]!
    if (path.length === 0) return state
    const paths = state.paths.map((route) => [...route])
    paths[state.activeSignal] = path.slice(0, -1)
    return { ...state, paths, moves: state.moves + 1, message: 'Last cell removed from this route.' }
  }
  if (action.type === 'clear') {
    if (state.activeSignal === null) return { ...state, message: 'Choose a signal before clearing a route.' }
    if (state.paths[state.activeSignal]!.length === 0) return state
    const paths = state.paths.map((route) => [...route])
    paths[state.activeSignal] = []
    return { ...state, paths, moves: state.moves + 1, message: `${COLOR_CONDUIT_SIGNALS[state.activeSignal].name} route cleared.` }
  }
  return state
}

export function validColorConduitProgress(value: unknown): value is ColorConduitProgress {
  if (!isRecord(value) || !isUtcDateKey(value.date) || !Array.isArray(value.paths) || value.paths.length !== COLOR_CONDUIT_ROUTE_COUNT) return false
  if (value.activeSignal !== null && !isSignal(value.activeSignal)) return false
  if (!isCounter(value.moves) || !isCounter(value.mistakes) || !isCounter(value.elapsedSeconds)) return false
  if (!value.paths.every((path) => Array.isArray(path) && path.length <= COLOR_CONDUIT_CELL_COUNT && path.every(isCell))) return false

  const puzzle = colorConduitPuzzleForDate(value.date)
  const occupied = new Set<number>()
  for (const route of puzzle.routes) {
    const path = value.paths[route.signal] as number[]
    if (path.length === 0) continue
    if (path[0] !== route.start && path[0] !== route.end) return false
    const target = path[0] === route.start ? route.end : route.start
    for (let index = 0; index < path.length; index += 1) {
      const cell = path[index]!
      if (occupied.has(cell)) return false
      occupied.add(cell)
      if (index > 0 && !adjacent(path[index - 1]!, cell)) return false
      if (index < path.length - 1 && isReservedTerminal(puzzle, route.signal, cell)) return false
      if (index < path.length - 1 && cell === target) return false
    }
  }

  if (value.activeSignal !== null) {
    const activePath = value.paths[value.activeSignal] as number[]
    const route = puzzle.routes.find((entry) => entry.signal === value.activeSignal)!
    if (activePath.length > 0 && activePath[activePath.length - 1] === (activePath[0] === route.start ? route.end : route.start)) return false
  }
  return true
}

export function isColorConduitSolved(puzzle: ColorConduitPuzzle, paths: readonly (readonly number[])[]): boolean {
  if (paths.length !== COLOR_CONDUIT_ROUTE_COUNT) return false
  const occupied = new Set(paths.flat())
  if (occupied.size !== COLOR_CONDUIT_CELL_COUNT) return false
  return puzzle.routes.every((route) => {
    const path = paths[route.signal] ?? []
    return path.length >= 2 && ((path[0] === route.start && path[path.length - 1] === route.end) || (path[0] === route.end && path[path.length - 1] === route.start))
  })
}

export function colorConduitSignalAt(puzzle: ColorConduitPuzzle, paths: readonly (readonly number[])[], cell: number): ColorConduitSignal | null {
  for (const route of puzzle.routes) if (paths[route.signal]?.includes(cell)) return route.signal
  return null
}

export function formatColorConduitTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function selectSignal(state: ColorConduitState, signal: ColorConduitSignal): ColorConduitState {
  if (!isSignal(signal)) return state
  if (state.activeSignal === signal) return { ...state, activeSignal: null, message: 'Choose a signal or tap one of its terminals to resume a route.' }
  const path = state.paths[signal]!
  const route = state.puzzle.routes.find((entry) => entry.signal === signal)!
  if (path.length > 1 && path[path.length - 1] === (path[0] === route.start ? route.end : route.start)) {
    const paths = state.paths.map((entry) => [...entry])
    paths[signal] = path.slice(0, -1)
    return { ...state, paths, activeSignal: signal, moves: state.moves + 1, message: `${COLOR_CONDUIT_SIGNALS[signal].name} route reopened at its terminal.` }
  }
  return { ...state, activeSignal: signal, message: path.length === 0 ? `Tap either ${COLOR_CONDUIT_SIGNALS[signal].name} terminal to start the conduit.` : `${COLOR_CONDUIT_SIGNALS[signal].name} route selected. Continue from its open end.` }
}

function routeThroughCell(state: ColorConduitState, cell: number): ColorConduitState {
  if (!isCell(cell)) return state
  const atTerminal = state.puzzle.routes.find((route) => route.start === cell || route.end === cell)
  let activeSignal = state.activeSignal
  let paths = state.paths.map((path) => [...path])
  let moves = state.moves
  let message = state.message

  if (activeSignal === null) {
    if (!atTerminal) return { ...state, cursor: cell, message: 'Choose a signal, then start at one of its matching terminals.' }
    activeSignal = atTerminal.signal
    const existing = paths[activeSignal]!
    if (existing.length > 1) {
      const target = existing[0] === atTerminal.start ? atTerminal.end : atTerminal.start
      if (existing[existing.length - 1] === target) {
        paths[activeSignal] = existing.slice(0, -1)
        moves += 1
        return { ...state, paths, activeSignal, moves, cursor: cell, message: `${COLOR_CONDUIT_SIGNALS[activeSignal].name} route reopened. Trace it to the other terminal.` }
      }
    }
    if (existing.length === 0) {
      paths[activeSignal] = [cell]
      moves += 1
      message = `${COLOR_CONDUIT_SIGNALS[activeSignal].name} conduit started. Trace adjacent cells to its matching terminal.`
    } else {
      message = `${COLOR_CONDUIT_SIGNALS[activeSignal].name} route selected. Continue from its open end.`
    }
    return { ...state, paths, activeSignal, moves, cursor: cell, message }
  }

  const route = state.puzzle.routes.find((entry) => entry.signal === activeSignal)!
  const path = paths[activeSignal]!
  if (path.length === 0) {
    if (!atTerminal || atTerminal.signal !== activeSignal) return recordMistake(state, cell, 'Start at one of this signal’s two terminals.')
    paths[activeSignal] = [cell]
    moves += 1
    return { ...state, paths, moves, cursor: cell, message: `${COLOR_CONDUIT_SIGNALS[activeSignal].name} conduit started. Follow one cell at a time.` }
  }
  if (cell === path[path.length - 1]) return { ...state, cursor: cell }

  const previousIndex = path.indexOf(cell)
  if (previousIndex >= 0) {
    paths[activeSignal] = path.slice(0, previousIndex + 1)
    return { ...state, paths, moves: moves + 1, cursor: cell, message: 'Route pulled back to that cell.' }
  }

  const occupiedSignal = colorConduitSignalAt(state.puzzle, paths, cell)
  if (occupiedSignal !== null) return recordMistake(state, cell, `${COLOR_CONDUIT_SIGNALS[occupiedSignal].name} is already carrying power here.`)
  if (isReservedTerminal(state.puzzle, activeSignal, cell) && cell !== route.start && cell !== route.end) {
    return recordMistake(state, cell, 'A terminal is reserved for its own signal.')
  }
  if (!adjacent(path[path.length - 1]!, cell)) return recordMistake(state, cell, 'Conduits move one square at a time. No diagonal jumps.')

  paths[activeSignal] = [...path, cell]
  moves += 1
  const target = path[0] === route.start ? route.end : route.start
  if (cell === target) {
    activeSignal = null
    message = `${COLOR_CONDUIT_SIGNALS[route.signal].name} terminals connected.`
    if (isColorConduitSolved(state.puzzle, paths)) {
      return { ...state, paths, activeSignal, moves, cursor: cell, phase: 'complete', message: `Station online. All four conduits are live in ${formatColorConduitTime(state.elapsedSeconds)}.` }
    }
  } else {
    message = `${COLOR_CONDUIT_SIGNALS[route.signal].name} conduit extended.`
  }
  return { ...state, paths, activeSignal, moves, cursor: cell, message }
}

function recordMistake(state: ColorConduitState, cursor: number, message: string): ColorConduitState {
  return { ...state, cursor, mistakes: state.mistakes + 1, message }
}

function isReservedTerminal(puzzle: ColorConduitPuzzle, signal: ColorConduitSignal, cell: number): boolean {
  return puzzle.routes.some((route) => route.signal !== signal && (route.start === cell || route.end === cell))
}

function adjacent(first: number, second: number): boolean {
  const firstRow = Math.floor(first / COLOR_CONDUIT_GRID_SIZE)
  const firstColumn = first % COLOR_CONDUIT_GRID_SIZE
  const secondRow = Math.floor(second / COLOR_CONDUIT_GRID_SIZE)
  const secondColumn = second % COLOR_CONDUIT_GRID_SIZE
  return Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1
}

function isCell(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < COLOR_CONDUIT_CELL_COUNT
}

function isSignal(value: unknown): value is ColorConduitSignal {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < COLOR_CONDUIT_ROUTE_COUNT
}

function isCounter(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
