export const MINESWEEPER_WIDTH = 9
export const MINESWEEPER_CELL_COUNT = MINESWEEPER_WIDTH * MINESWEEPER_WIDTH
export const MINESWEEPER_MINE_COUNT = 10
export const MINESWEEPER_OPENING_INDEX = 4 * MINESWEEPER_WIDTH + 4

export type MinesweeperPhase = 'ready' | 'playing' | 'paused' | 'won' | 'lost'

export interface MinesweeperProgress {
  date: string
  revealed: number[]
  flagged: number[]
  elapsedSeconds: number
  phase: MinesweeperPhase
}

export interface MinesweeperState extends MinesweeperProgress {
  mines: number[]
}

export type MinesweeperAction =
  | { type: 'start' }
  | { type: 'reveal'; cell: number }
  | { type: 'toggleFlag'; cell: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'tick' }

const SAFE_OPENING = new Set(
  Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3) + 3
    const column = index % 3 + 3
    return row * MINESWEEPER_WIDTH + column
  }),
)

export function createMinesweeperState(date = utcDateKey(), progress?: MinesweeperProgress | null): MinesweeperState {
  const mines = createDailyMines(date)
  if (progress && isMinesweeperProgress(progress) && progress.date === date) {
    return { ...progress, revealed: [...progress.revealed], flagged: [...progress.flagged], mines }
  }

  const initial: MinesweeperState = {
    date,
    revealed: [],
    flagged: [],
    elapsedSeconds: 0,
    phase: 'ready',
    mines,
  }
  return { ...initial, revealed: revealSafeRegion(initial, MINESWEEPER_OPENING_INDEX) }
}

export function minesweeperReducer(state: MinesweeperState, action: MinesweeperAction): MinesweeperState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'playing' } : state
    case 'reveal':
      return revealCell(state, action.cell)
    case 'toggleFlag': {
      if ((state.phase !== 'playing' && state.phase !== 'ready') || !isCell(action.cell) || state.revealed.includes(action.cell)) return state
      const active = state.phase === 'ready' ? { ...state, phase: 'playing' as const } : state
      const flagged = active.flagged.includes(action.cell)
        ? active.flagged.filter((cell) => cell !== action.cell)
        : [...active.flagged, action.cell]
      return { ...active, flagged }
    }
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
    case 'restart':
      return createMinesweeperState(state.date)
    case 'tick':
      return state.phase === 'playing' ? { ...state, elapsedSeconds: state.elapsedSeconds + 1 } : state
  }
}

export function adjacentMineCount(state: Pick<MinesweeperState, 'mines'>, cell: number): number {
  return neighbors(cell).filter((neighbor) => state.mines.includes(neighbor)).length
}

export function toMinesweeperProgress(state: MinesweeperState): MinesweeperProgress {
  return {
    date: state.date,
    revealed: [...state.revealed],
    flagged: [...state.flagged],
    elapsedSeconds: state.elapsedSeconds,
    phase: state.phase,
  }
}

export function isMinesweeperProgress(value: unknown): value is MinesweeperProgress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const progress = value as Partial<MinesweeperProgress>
  if (typeof progress.date !== 'string' || !isValidUtcDateKey(progress.date)) return false
  if (!Array.isArray(progress.revealed) || !progress.revealed.every(isCell) || new Set(progress.revealed).size !== progress.revealed.length) return false
  if (!Array.isArray(progress.flagged) || !progress.flagged.every(isCell) || new Set(progress.flagged).size !== progress.flagged.length) return false
  if (progress.flagged.some((cell) => progress.revealed?.includes(cell))) return false
  if (!Number.isSafeInteger(progress.elapsedSeconds) || (progress.elapsedSeconds ?? -1) < 0 || (progress.elapsedSeconds ?? Number.MAX_SAFE_INTEGER) > 86_400) return false
  return progress.phase === 'ready' || progress.phase === 'playing' || progress.phase === 'paused' || progress.phase === 'won' || progress.phase === 'lost'
}

function revealCell(state: MinesweeperState, cell: number): MinesweeperState {
  if ((state.phase !== 'playing' && state.phase !== 'ready') || !isCell(cell) || state.flagged.includes(cell) || state.revealed.includes(cell)) return state
  const active = state.phase === 'ready' ? { ...state, phase: 'playing' as const } : state
  if (active.mines.includes(cell)) {
    return { ...active, phase: 'lost', revealed: [...new Set([...active.revealed, ...active.mines])] }
  }

  const revealed = [...new Set([...active.revealed, ...revealSafeRegion(active, cell)])]
  const won = revealed.length === MINESWEEPER_CELL_COUNT - MINESWEEPER_MINE_COUNT
  return {
    ...active,
    revealed,
    phase: won ? 'won' : 'playing',
  }
}

function revealSafeRegion(state: MinesweeperState, start: number): number[] {
  if (state.mines.includes(start)) return []
  const revealed = new Set<number>()
  const pending = [start]
  while (pending.length > 0) {
    const cell = pending.pop()!
    if (revealed.has(cell) || state.mines.includes(cell)) continue
    revealed.add(cell)
    if (adjacentMineCount(state, cell) === 0) {
      for (const neighbor of neighbors(cell)) {
        if (!revealed.has(neighbor) && !state.mines.includes(neighbor)) pending.push(neighbor)
      }
    }
  }
  return [...revealed]
}

function createDailyMines(date: string): number[] {
  let seed = 2166136261
  for (const character of date) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619)
  const random = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 0x1_0000_0000
  }
  const candidates = Array.from({ length: MINESWEEPER_CELL_COUNT }, (_, cell) => cell)
    .filter((cell) => !SAFE_OPENING.has(cell))
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[candidates[index], candidates[other]] = [candidates[other]!, candidates[index]!]
  }
  return candidates.slice(0, MINESWEEPER_MINE_COUNT).sort((first, second) => first - second)
}

function neighbors(cell: number): number[] {
  const row = Math.floor(cell / MINESWEEPER_WIDTH)
  const column = cell % MINESWEEPER_WIDTH
  const result: number[] = []
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nextRow = row + dy
      const nextColumn = column + dx
      if (nextRow >= 0 && nextRow < MINESWEEPER_WIDTH && nextColumn >= 0 && nextColumn < MINESWEEPER_WIDTH) {
        result.push(nextRow * MINESWEEPER_WIDTH + nextColumn)
      }
    }
  }
  return result
}

function isCell(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < MINESWEEPER_CELL_COUNT
}

function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function isValidUtcDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
