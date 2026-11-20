export const BEAMWORKS_BOARD_SIZE = 7
export const BEAMWORKS_STAGE_COUNT = 4

export type BeamworksDirection = 'up' | 'right' | 'down' | 'left'
export type BeamworksMirrorAngle = 'slash' | 'backslash'
export type BeamworksPhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface BeamworksMirror {
  cell: number
  angle: BeamworksMirrorAngle
}

export interface BeamworksPuzzle {
  title: string
  hint: string
  source: { cell: number; direction: BeamworksDirection }
  receiver: number
  mirrors: BeamworksMirror[]
  blockers: number[]
}

interface BeamworksSnapshot {
  mirrors: BeamworksMirror[]
  turns: number
  stageTurns: number
}

export interface BeamworksState {
  phase: BeamworksPhase
  stageIndex: number
  mirrors: BeamworksMirror[]
  turns: number
  stageTurns: number
  completedStageTurns: number[]
  history: BeamworksSnapshot[]
  message: string
}

export const BEAMWORKS_PUZZLES: readonly BeamworksPuzzle[] = [
  {
    title: 'First Reflection',
    hint: 'Bend the beam upward, then turn it right toward the receiver.',
    source: { cell: cell(3, 0), direction: 'right' },
    receiver: cell(1, 6),
    mirrors: [
      { cell: cell(3, 3), angle: 'backslash' },
      { cell: cell(1, 3), angle: 'backslash' },
    ],
    blockers: [],
  },
  {
    title: 'High Line',
    hint: 'The first turn is set. Rotate the upper mirror to send the ray east.',
    source: { cell: cell(5, 0), direction: 'right' },
    receiver: cell(2, 6),
    mirrors: [
      { cell: cell(5, 2), angle: 'slash' },
      { cell: cell(2, 2), angle: 'backslash' },
    ],
    blockers: [cell(5, 5)],
  },
  {
    title: 'Well Light',
    hint: 'Turn the beam east at the lower mirror, then up at the far mirror.',
    source: { cell: cell(6, 1), direction: 'up' },
    receiver: cell(0, 4),
    mirrors: [
      { cell: cell(3, 1), angle: 'backslash' },
      { cell: cell(3, 4), angle: 'backslash' },
    ],
    blockers: [cell(1, 1)],
  },
  {
    title: 'Last Circuit',
    hint: 'Route left through the pair, then bend upward into the final receiver.',
    source: { cell: cell(5, 0), direction: 'right' },
    receiver: cell(0, 1),
    mirrors: [
      { cell: cell(5, 2), angle: 'slash' },
      { cell: cell(2, 2), angle: 'slash' },
      { cell: cell(2, 1), angle: 'slash' },
    ],
    blockers: [cell(5, 4), cell(4, 1)],
  },
]

export function beamworksCell(row: number, column: number): number {
  return row * BEAMWORKS_BOARD_SIZE + column
}

export function beamworksRow(index: number): number {
  return Math.floor(index / BEAMWORKS_BOARD_SIZE)
}

export function beamworksColumn(index: number): number {
  return index % BEAMWORKS_BOARD_SIZE
}

export function createBeamworksState(): BeamworksState {
  const puzzle = BEAMWORKS_PUZZLES[0]!
  return {
    phase: 'ready',
    stageIndex: 0,
    mirrors: puzzle.mirrors.map((mirror) => ({ ...mirror })),
    turns: 0,
    stageTurns: 0,
    completedStageTurns: [],
    history: [],
    message: 'Rotate each mirror to bend the beam into all four receivers.',
  }
}

export function startBeamworks(_state: BeamworksState): BeamworksState {
  return { ...createBeamworksState(), phase: 'playing', message: 'First Reflection is live. Trace the beam to its receiver.' }
}

export function pauseBeamworks(state: BeamworksState): BeamworksState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Circuit paused. Mirror angles and turn count are held.' } : state
}

export function resumeBeamworks(state: BeamworksState): BeamworksState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', message: `${BEAMWORKS_PUZZLES[state.stageIndex]!.title} is live.` } : state
}

export function restartBeamworks(_state: BeamworksState): BeamworksState {
  return createBeamworksState()
}

export function rotateBeamworksMirror(state: BeamworksState, mirrorIndex: number): BeamworksState {
  if (state.phase !== 'playing' || !Number.isInteger(mirrorIndex) || mirrorIndex < 0 || mirrorIndex >= state.mirrors.length) return state
  const history = [...state.history, snapshot(state)].slice(-250)
  const mirrors = state.mirrors.map((mirror, index) => index === mirrorIndex
    ? { ...mirror, angle: mirror.angle === 'slash' ? 'backslash' as const : 'slash' as const }
    : { ...mirror })
  const turns = state.turns + 1
  const stageTurns = state.stageTurns + 1
  const puzzle = BEAMWORKS_PUZZLES[state.stageIndex]!
  const completedStageTurns = [...state.completedStageTurns]
  if (traceBeam(puzzle, mirrors).reachedReceiver) {
    completedStageTurns.push(stageTurns)
    if (state.stageIndex === BEAMWORKS_PUZZLES.length - 1) {
      return {
        ...state,
        phase: 'complete',
        mirrors,
        turns,
        stageTurns,
        completedStageTurns,
        history: [],
        message: `All four receivers lit in ${turns} turns. Your local best is saved in this browser.`,
      }
    }
    const nextIndex = state.stageIndex + 1
    const nextPuzzle = BEAMWORKS_PUZZLES[nextIndex]!
    return {
      ...state,
      stageIndex: nextIndex,
      mirrors: nextPuzzle.mirrors.map((mirror) => ({ ...mirror })),
      turns,
      stageTurns: 0,
      completedStageTurns,
      history: [],
      message: `${puzzle.title} connected. ${nextPuzzle.title} is live.`,
    }
  }
  return {
    ...state,
    mirrors,
    turns,
    stageTurns,
    history,
    message: `Mirror ${mirrorIndex + 1} rotated. The ray now travels ${directionLabel(traceBeam(puzzle, mirrors).lastDirection)}.`,
  }
}

export function undoBeamworks(state: BeamworksState): BeamworksState {
  if (state.phase !== 'playing' || state.history.length === 0) return state
  const history = [...state.history]
  const previous = history.pop()!
  return {
    ...state,
    mirrors: previous.mirrors.map((mirror) => ({ ...mirror })),
    turns: previous.turns,
    stageTurns: previous.stageTurns,
    history,
    message: 'Last mirror turn undone.',
  }
}

export function traceBeam(puzzle: BeamworksPuzzle, mirrors: readonly BeamworksMirror[]): { cells: number[]; reachedReceiver: boolean; lastDirection: BeamworksDirection } {
  let current = puzzle.source.cell
  let direction = puzzle.source.direction
  const cells = [current]
  const visited = new Set<string>()
  for (let step = 0; step < BEAMWORKS_BOARD_SIZE ** 2 * 4; step += 1) {
    if (current === puzzle.receiver) return { cells, reachedReceiver: true, lastDirection: direction }
    const key = `${current}:${direction}`
    if (visited.has(key)) return { cells, reachedReceiver: false, lastDirection: direction }
    visited.add(key)
    if (puzzle.blockers.includes(current)) return { cells, reachedReceiver: false, lastDirection: direction }
    const mirror = mirrors.find((item) => item.cell === current)
    if (mirror) direction = reflect(direction, mirror.angle)
    const next = nextCell(current, direction)
    if (next === null) return { cells, reachedReceiver: false, lastDirection: direction }
    current = next
    cells.push(current)
  }
  return { cells, reachedReceiver: false, lastDirection: direction }
}

function reflect(direction: BeamworksDirection, angle: BeamworksMirrorAngle): BeamworksDirection {
  if (angle === 'slash') {
    return direction === 'up' ? 'right' : direction === 'right' ? 'up' : direction === 'down' ? 'left' : 'down'
  }
  return direction === 'up' ? 'left' : direction === 'left' ? 'up' : direction === 'down' ? 'right' : 'down'
}

function nextCell(index: number, direction: BeamworksDirection): number | null {
  const row = beamworksRow(index)
  const column = beamworksColumn(index)
  const nextRow = row + (direction === 'up' ? -1 : direction === 'down' ? 1 : 0)
  const nextColumn = column + (direction === 'left' ? -1 : direction === 'right' ? 1 : 0)
  if (nextRow < 0 || nextRow >= BEAMWORKS_BOARD_SIZE || nextColumn < 0 || nextColumn >= BEAMWORKS_BOARD_SIZE) return null
  return beamworksCell(nextRow, nextColumn)
}

function directionLabel(direction: BeamworksDirection): string {
  return direction === 'up' ? 'north' : direction === 'right' ? 'east' : direction === 'down' ? 'south' : 'west'
}

function snapshot(state: BeamworksState): BeamworksSnapshot {
  return { mirrors: state.mirrors.map((mirror) => ({ ...mirror })), turns: state.turns, stageTurns: state.stageTurns }
}

function cell(row: number, column: number): number {
  return beamworksCell(row, column)
}
