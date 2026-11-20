export const PIXEL_MOSAIC_SIZE = 8

const MOSAICS = [
  { name: 'Heart', rows: ['........', '.##..##.', '########', '########', '.######.', '..####..', '...##...', '........'] },
  { name: 'Rocket', rows: ['....#...', '...###..', '..#####.', '.#######', '########', '.######.', '..##.##.', '...#.#..'] },
  { name: 'Fish', rows: ['........', '...##...', '..######', '########', '..######', '...##...', '........', '........'] },
  { name: 'Mushroom', rows: ['...##...', '..####..', '.######.', '########', '########', '...##...', '..####..', '..####..'] },
  { name: 'Crown', rows: ['#......#', '##....##', '########', '.######.', '.######.', '.######.', '########', '........'] },
  { name: 'Moon', rows: ['...####.', '..######', '.#######', '########', '########', '.#######', '..######', '...####.'] },
  { name: 'Key', rows: ['..####..', '.######.', '.##..##.', '..####..', '....##..', '....##..', '....####', '....##..'] },
  { name: 'Boat', rows: ['...##...', '..####..', '.######.', '########', '########', '...##...', '........', '........'] },
  { name: 'Cactus', rows: ['...##...', '...##...', '...##...', '.#####..', '.#####..', '...##...', '...##...', '...##...'] },
  { name: 'Cup', rows: ['..####..', '..####..', '..####..', '..####..', '..####..', '.######.', '..####..', '..####..'] },
  { name: 'Snail', rows: ['........', '..####..', '.##..##.', '##.####.', '########', '.######.', '..##..#.', '........'] },
  { name: 'Lantern', rows: ['...##...', '..####..', '.######.', '.######.', '.######.', '.######.', '..####..', '...##...'] },
] as const

export type PixelMosaicPhase = 'ready' | 'playing' | 'paused' | 'complete'
export type PixelMosaicMark = 'unknown' | 'filled' | 'empty'

export interface PixelMosaicPuzzle {
  date: string
  name: string
  solution: boolean[]
  rowClues: number[][]
  columnClues: number[][]
}

export interface PixelMosaicProgress {
  date: string
  cells: PixelMosaicMark[]
  mistakes: number
  elapsedMs: number
  phase: PixelMosaicPhase
}

export interface PixelMosaicState extends PixelMosaicPuzzle {
  cells: PixelMosaicMark[]
  mistakes: number
  elapsedMs: number
  startedAt: number | null
  phase: PixelMosaicPhase
  message: string
}

export function pixelMosaicPuzzleForDate(date: string): PixelMosaicPuzzle {
  if (!isValidDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')
  const seed = hashDate(date)
  const source = MOSAICS[seed % MOSAICS.length]!
  const sourceSize = source.rows.length
  if (sourceSize !== PIXEL_MOSAIC_SIZE || source.rows.some((row) => row.length !== PIXEL_MOSAIC_SIZE)) throw new Error(`The ${source.name} picture must be an 8×8 pattern.`)
  let image = source.rows.map((row) => [...row].map((pixel) => pixel === '#'))
  if (seed & 1) image = image.map((row) => row.reverse())
  if (seed & 2) image = image.reverse()
  if (seed & 4) image = Array.from({ length: sourceSize }, (_, y) => Array.from({ length: sourceSize }, (_, x) => image[sourceSize - x - 1]![y]!))
  const solution = image.flat()
  const rowClues = Array.from({ length: PIXEL_MOSAIC_SIZE }, (_, y) => runs(solution.slice(y * PIXEL_MOSAIC_SIZE, (y + 1) * PIXEL_MOSAIC_SIZE)))
  const columnClues = Array.from({ length: PIXEL_MOSAIC_SIZE }, (_, x) => runs(Array.from({ length: PIXEL_MOSAIC_SIZE }, (_, y) => solution[y * PIXEL_MOSAIC_SIZE + x]!)))
  return { date, name: source.name, solution, rowClues, columnClues }
}

export function createPixelMosaicState(date: string, progress?: PixelMosaicProgress | null): PixelMosaicState {
  const puzzle = pixelMosaicPuzzleForDate(date)
  const saved = progress?.date === date && validPixelMosaicProgress(progress) ? progress : null
  const cells = saved ? [...saved.cells] : Array<PixelMosaicMark>(PIXEL_MOSAIC_SIZE ** 2).fill('unknown')
  const solved = isPixelMosaicSolved(puzzle, cells)
  const phase: PixelMosaicPhase = solved || saved?.phase === 'complete' ? 'complete'
    : saved?.phase === 'playing' ? 'paused'
      : saved?.phase ?? 'ready'
  return {
    ...puzzle,
    cells,
    mistakes: saved?.mistakes ?? 0,
    elapsedMs: saved?.elapsedMs ?? 0,
    startedAt: null,
    phase,
    message: phase === 'complete' ? `Picture restored. You cleared it in ${formatPixelMosaicTime(saved?.elapsedMs ?? 0)}.`
      : phase === 'paused' ? 'Your picture is saved. Resume when you are ready.'
        : 'Fill every lit pixel and mark each dark square to reveal today’s picture.',
  }
}

export function startPixelMosaic(state: PixelMosaicState, now: number): PixelMosaicState {
  if (state.phase !== 'ready' || !Number.isFinite(now)) return state
  return { ...state, phase: 'playing', startedAt: now, message: 'Picture is live. Read the row and column runs.' }
}

export function resumePixelMosaic(state: PixelMosaicState, now: number): PixelMosaicState {
  if (state.phase !== 'paused' || !Number.isFinite(now)) return state
  return { ...state, phase: 'playing', startedAt: now, message: 'Back to the picture. Your clock is running.' }
}

export function pausePixelMosaic(state: PixelMosaicState, now: number): PixelMosaicState {
  if (state.phase !== 'playing') return state
  return {
    ...state,
    phase: 'paused',
    elapsedMs: pixelMosaicElapsedMs(state, now),
    startedAt: null,
    message: 'Picture paused. Your progress is saved in this browser.',
  }
}

export function markPixelMosaicCell(state: PixelMosaicState, index: number, mark: PixelMosaicMark, now: number): PixelMosaicState {
  if (state.phase !== 'playing' || !Number.isInteger(index) || index < 0 || index >= state.cells.length || mark === 'unknown' || !Number.isFinite(now)) return state
  const cells = [...state.cells]
  const nextMark = cells[index] === mark ? 'unknown' : mark
  cells[index] = nextMark
  const mistakes = state.mistakes + (nextMark !== 'unknown' && ((nextMark === 'filled') !== state.solution[index]) ? 1 : 0)
  const phase: PixelMosaicPhase = isPixelMosaicSolved(state, cells) ? 'complete' : 'playing'
  const elapsedMs = phase === 'complete' ? pixelMosaicElapsedMs(state, now) : state.elapsedMs
  return {
    ...state,
    cells,
    mistakes,
    phase,
    elapsedMs,
    startedAt: phase === 'complete' ? null : state.startedAt,
    message: phase === 'complete'
      ? `Picture revealed in ${formatPixelMosaicTime(elapsedMs)} with ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}.`
      : nextMark === 'unknown' ? 'Square cleared.' : nextMark === 'filled' ? 'Pixel filled.' : 'Square marked dark.',
  }
}

export function restartPixelMosaic(state: PixelMosaicState, now: number): PixelMosaicState {
  if (state.phase === 'ready' || !Number.isFinite(now)) return state
  return {
    ...state,
    cells: Array<PixelMosaicMark>(state.solution.length).fill('unknown'),
    mistakes: 0,
    elapsedMs: 0,
    startedAt: now,
    phase: 'playing',
    message: 'Fresh board. Read the runs and build the picture.',
  }
}

export function pixelMosaicElapsedMs(state: PixelMosaicState, now: number): number {
  if (state.phase !== 'playing' || state.startedAt === null) return state.elapsedMs
  return Math.max(0, state.elapsedMs + Math.floor(now - state.startedAt))
}

export function pixelMosaicProgress(state: PixelMosaicState, now?: number): PixelMosaicProgress {
  const elapsedMs = now === undefined ? state.elapsedMs : pixelMosaicElapsedMs(state, now)
  return {
    date: state.date,
    cells: [...state.cells],
    mistakes: state.mistakes,
    elapsedMs,
    phase: state.phase,
  }
}

export function isPixelMosaicSolved(puzzle: Pick<PixelMosaicPuzzle, 'solution'>, cells: readonly PixelMosaicMark[]): boolean {
  return cells.length === puzzle.solution.length && cells.every((mark, index) => mark === (puzzle.solution[index] ? 'filled' : 'empty'))
}

export function validPixelMosaicProgress(value: unknown): value is PixelMosaicProgress {
  if (!isRecord(value) || !isValidDateKey(value.date) || !Array.isArray(value.cells)
    || value.cells.length !== PIXEL_MOSAIC_SIZE ** 2
    || !value.cells.every((cell) => cell === 'unknown' || cell === 'filled' || cell === 'empty')
    || !Number.isSafeInteger(value.mistakes) || (value.mistakes as number) < 0 || (value.mistakes as number) > 5000
    || !Number.isSafeInteger(value.elapsedMs) || (value.elapsedMs as number) < 0 || (value.elapsedMs as number) > 86_400_000
    || (value.phase !== 'ready' && value.phase !== 'playing' && value.phase !== 'paused' && value.phase !== 'complete')) return false
  const puzzle = pixelMosaicPuzzleForDate(value.date)
  if (value.phase === 'complete' && !isPixelMosaicSolved(puzzle, value.cells as PixelMosaicMark[])) return false
  return value.phase !== 'ready' || ((value.mistakes as number) === 0 && (value.elapsedMs as number) === 0 && value.cells.every((cell) => cell === 'unknown'))
}

export function formatPixelMosaicTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function runs(line: readonly boolean[]): number[] {
  const clues: number[] = []
  let run = 0
  for (const pixel of line) {
    if (pixel) run += 1
    else if (run) { clues.push(run); run = 0 }
  }
  if (run) clues.push(run)
  return clues.length ? clues : [0]
}

function hashDate(date: string): number {
  let hash = 2166136261
  for (const character of date) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
