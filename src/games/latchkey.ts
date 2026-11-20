export const LATCHKEY_WIDTH = 12
export const LATCHKEY_HEIGHT = 8

export interface LatchkeyPoint {
  x: number
  y: number
}

export interface LatchkeyRoom {
  title: string
  rows: readonly string[]
  start: LatchkeyPoint
  key: LatchkeyPoint
  exit: LatchkeyPoint
  hint: string
}

export const LATCHKEY_ROOMS: readonly LatchkeyRoom[] = [
  {
    title: 'First Gap',
    rows: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '............',
      '.S......K.E.',
      '###..#######',
    ],
    start: { x: 1, y: 6 },
    key: { x: 8, y: 6 },
    exit: { x: 10, y: 6 },
    hint: 'Step to the edge, then jump the two-tile break.',
  },
  {
    title: 'High Key',
    rows: [
      '............',
      '............',
      '............',
      '............',
      '........K...',
      '.......###..',
      '.S.........E',
      '####..######',
    ],
    start: { x: 1, y: 6 },
    key: { x: 8, y: 4 },
    exit: { x: 11, y: 6 },
    hint: 'A jump carries three tiles and can land on a higher ledge.',
  },
  {
    title: 'Last Light',
    rows: [
      '............',
      '............',
      '............',
      '............',
      '..........K.',
      '.........##.',
      '.S.........E',
      '###..##..###',
    ],
    start: { x: 1, y: 6 },
    key: { x: 10, y: 4 },
    exit: { x: 11, y: 6 },
    hint: 'Two gaps, one high key, and one last door.',
  },
]

export type LatchkeyPhase = 'ready' | 'playing' | 'paused' | 'complete'

export interface LatchkeyState {
  phase: LatchkeyPhase
  roomIndex: number
  x: number
  y: number
  facing: -1 | 1
  hasKey: boolean
  elapsedSeconds: number
  message: string
}

export type LatchkeyAction = 'left' | 'right' | 'jump'

export function createLatchkeyState(): LatchkeyState {
  return { phase: 'ready', roomIndex: 0, x: LATCHKEY_ROOMS[0]!.start.x, y: LATCHKEY_ROOMS[0]!.start.y, facing: 1, hasKey: false, elapsedSeconds: 0, message: 'Three rooms. One key opens each door.' }
}

export function startLatchkey(state: LatchkeyState): LatchkeyState {
  return state.phase === 'ready' ? { ...state, phase: 'playing', message: LATCHKEY_ROOMS[state.roomIndex]!.hint } : state
}

export function pauseLatchkey(state: LatchkeyState): LatchkeyState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Route paused.' } : state
}

export function resumeLatchkey(state: LatchkeyState): LatchkeyState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', message: LATCHKEY_ROOMS[state.roomIndex]!.hint } : state
}

export function restartLatchkey(state: LatchkeyState): LatchkeyState {
  return { ...createLatchkeyState(), phase: state.phase === 'playing' ? 'playing' : 'ready' }
}

export function advanceLatchkeyTime(state: LatchkeyState, seconds = 1): LatchkeyState {
  if (state.phase !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return state
  return { ...state, elapsedSeconds: state.elapsedSeconds + Math.floor(seconds) }
}

export function moveLatchkey(state: LatchkeyState, action: LatchkeyAction): LatchkeyState {
  if (state.phase !== 'playing') return state
  const room = LATCHKEY_ROOMS[state.roomIndex]!

  if (action === 'jump') {
    if (!isSolid(room, state.x, state.y + 1)) return { ...state, message: 'Land on a ledge before jumping.' }
    const direction = state.facing ?? 1
    const arc = [
      { x: state.x + direction, y: state.y - 2 },
      { x: state.x + direction * 2, y: state.y - 3 },
      { x: state.x + direction * 3, y: state.y - 2 },
    ]
    if (arc.some(({ x, y }) => isSolid(room, x, y))) return { ...state, message: 'The jump is blocked. Try another takeoff point.' }
    return finishMove(state, room, arc[2]!.x, arc[2]!.y, arc)
  }

  const direction = action === 'right' ? 1 : -1
  const nextX = state.x + direction
  if (isSolid(room, nextX, state.y)) return { ...state, message: direction > 0 ? 'The wall holds. Find another way up.' : 'The wall holds.' }
  const walked = { x: nextX, y: state.y }
  const settled = settle(room, nextX, state.y)
  if (!settled) return resetRoom(state, 'The gap was too wide. Back at the room entrance.')
  return finishMove({ ...state, facing: direction }, room, settled.x, settled.y, [walked, ...settled.fallPath])
}

export function formatLatchkeyTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`
}

export function latchkeyRoomCell(room: LatchkeyRoom, x: number, y: number): string {
  return room.rows[y]?.[x] ?? ''
}

export function isLatchkeyGrounded(state: LatchkeyState): boolean {
  return isSolid(LATCHKEY_ROOMS[state.roomIndex]!, state.x, state.y + 1)
}

interface SettledPoint extends LatchkeyPoint {
  fallPath: LatchkeyPoint[]
}

function finishMove(state: LatchkeyState, room: LatchkeyRoom, x: number, y: number, path: LatchkeyPoint[]): LatchkeyState {
  const settled = settle(room, x, y)
  if (!settled) return resetRoom(state, 'The landing fell away. Back at the room entrance.')
  const visited = [...path, { x, y }, { x: settled.x, y: settled.y }, ...settled.fallPath]
  const hasKey = state.hasKey || visited.some((point) => point.x === room.key.x && point.y === room.key.y)
  if (settled.x === room.exit.x && settled.y === room.exit.y) {
    if (!hasKey) return { ...state, x: settled.x, y: settled.y, hasKey, message: 'The exit is locked. Find the key in this room.' }
    if (state.roomIndex === LATCHKEY_ROOMS.length - 1) {
      return { ...state, x: settled.x, y: settled.y, hasKey, phase: 'complete', message: `All three doors opened in ${formatLatchkeyTime(state.elapsedSeconds)}.` }
    }
    const nextRoomIndex = state.roomIndex + 1
    const nextRoom = LATCHKEY_ROOMS[nextRoomIndex]!
    return { ...state, roomIndex: nextRoomIndex, x: nextRoom.start.x, y: nextRoom.start.y, hasKey: false, message: `${room.title} clear. ${nextRoom.hint}` }
  }
  return {
    ...state,
    x: settled.x,
    y: settled.y,
    hasKey,
    message: hasKey && !state.hasKey ? 'Key in hand. The exit is open.' : LATCHKEY_ROOMS[state.roomIndex]!.hint,
    facing: state.facing,
  }
}

function resetRoom(state: LatchkeyState, message: string): LatchkeyState {
  const room = LATCHKEY_ROOMS[state.roomIndex]!
  return { ...state, x: room.start.x, y: room.start.y, hasKey: false, message }
}

function settle(room: LatchkeyRoom, x: number, y: number): SettledPoint | null {
  if (isSolid(room, x, y)) return null
  const fallPath: LatchkeyPoint[] = []
  let nextY = y
  while (nextY < LATCHKEY_HEIGHT - 1 && !isSolid(room, x, nextY + 1)) {
    nextY += 1
    fallPath.push({ x, y: nextY })
  }
  if (nextY === LATCHKEY_HEIGHT - 1 && !isSolid(room, x, nextY)) return null
  return { x, y: nextY, fallPath }
}

function isSolid(room: LatchkeyRoom, x: number, y: number): boolean {
  if (x < 0 || x >= LATCHKEY_WIDTH || y < 0 || y >= LATCHKEY_HEIGHT) return true
  return room.rows[y]?.[x] === '#'
}
