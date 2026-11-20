export const FATHOM_BOARD_SIZE = 8
export const FATHOM_CELL_COUNT = FATHOM_BOARD_SIZE * FATHOM_BOARD_SIZE
export const FATHOM_SONAR_CHARGES = 3

export const FATHOM_FLEET_SPEC = [
  { name: 'Longboat', length: 4 },
  { name: 'Skiff', length: 3 },
  { name: 'Sloop', length: 3 },
  { name: 'Dinghy', length: 2 },
] as const

export interface FathomShip {
  name: string
  length: number
  cells: number[]
}

export interface FathomShot {
  cell: number
  result: 'hit' | 'miss'
}

export interface FathomScan {
  center: number
  echoes: number
}

export type FathomPhase = 'ready' | 'playing' | 'paused' | 'won'

export interface FathomState {
  phase: FathomPhase
  seed: number
  fleet: FathomShip[]
  shots: FathomShot[]
  scans: FathomScan[]
  scansRemaining: number
  message: string
}

export function createFathomState(seed = randomSeed()): FathomState {
  const safeSeed = normalizeSeed(seed)
  return {
    phase: 'ready',
    seed: safeSeed,
    fleet: createFathomFleet(safeSeed),
    shots: [],
    scans: [],
    scansRemaining: FATHOM_SONAR_CHARGES,
    message: 'Sweep the water, read the echoes, and find the hidden fleet.',
  }
}

export function startFathom(state: FathomState): FathomState {
  return state.phase === 'ready' ? { ...state, phase: 'playing', message: 'Fleet is hidden. Mark a coordinate to fire.' } : state
}

export function pauseFathom(state: FathomState): FathomState {
  return state.phase === 'playing' ? { ...state, phase: 'paused', message: 'Sonar paused.' } : state
}

export function resumeFathom(state: FathomState): FathomState {
  return state.phase === 'paused' ? { ...state, phase: 'playing', message: 'Sweep the water and follow the hits.' } : state
}

export function restartFathom(state: FathomState): FathomState {
  return { ...createFathomState(state.seed), phase: state.phase === 'playing' ? 'playing' : 'ready' }
}

export function newFathomFleet(state: FathomState): FathomState {
  return createFathomState(nextSeed(state.seed))
}

export function fireFathomShot(state: FathomState, cell: number): FathomState {
  if (state.phase !== 'playing' || !isValidCell(cell)) return state
  if (state.shots.some((shot) => shot.cell === cell)) {
    return { ...state, message: `${formatFathomCoordinate(cell)} is already charted.` }
  }

  const shipIndex = state.fleet.findIndex((ship) => ship.cells.includes(cell))
  const shot: FathomShot = { cell, result: shipIndex >= 0 ? 'hit' : 'miss' }
  const shots = [...state.shots, shot]
  const sunkShipIndices = getSunkShipIndices(state.fleet, shots)
  const justSunk = shipIndex >= 0 && sunkShipIndices.includes(shipIndex) && !getSunkShipIndices(state.fleet, state.shots).includes(shipIndex)
  const remainingShips = state.fleet.length - sunkShipIndices.length

  if (remainingShips === 0) {
    return { ...state, shots, phase: 'won', message: `Fleet cleared in ${shots.length} shots. Clean work.` }
  }
  if (justSunk) {
    return { ...state, shots, message: `${state.fleet[shipIndex]!.name} sunk. ${remainingShips} ships remain.` }
  }
  return { ...state, shots, message: shot.result === 'hit' ? `${formatFathomCoordinate(cell)} is a hit. Follow the line.` : `${formatFathomCoordinate(cell)} is open water.` }
}

export function scanFathom(state: FathomState, center: number): FathomState {
  if (state.phase !== 'playing' || !isValidCell(center) || state.scansRemaining <= 0) return state
  const row = Math.floor(center / FATHOM_BOARD_SIZE)
  const column = center % FATHOM_BOARD_SIZE
  const knownHits = new Set(state.shots.filter((shot) => shot.result === 'hit').map((shot) => shot.cell))
  let echoes = 0
  for (let y = Math.max(0, row - 1); y <= Math.min(FATHOM_BOARD_SIZE - 1, row + 1); y += 1) {
    for (let x = Math.max(0, column - 1); x <= Math.min(FATHOM_BOARD_SIZE - 1, column + 1); x += 1) {
      const cell = y * FATHOM_BOARD_SIZE + x
      if (!knownHits.has(cell) && state.fleet.some((ship) => ship.cells.includes(cell))) echoes += 1
    }
  }
  return {
    ...state,
    scans: [...state.scans, { center, echoes }],
    scansRemaining: state.scansRemaining - 1,
    message: echoes === 0
      ? `No hull echoes near ${formatFathomCoordinate(center)}. The surrounding water is clear.`
      : `Sonar finds ${echoes} hidden hull ${echoes === 1 ? 'section' : 'sections'} near ${formatFathomCoordinate(center)}.`,
  }
}

export function getSunkShipIndices(fleet: readonly FathomShip[], shots: readonly FathomShot[]): number[] {
  const hits = new Set(shots.filter((shot) => shot.result === 'hit').map((shot) => shot.cell))
  return fleet.flatMap((ship, index) => ship.cells.every((cell) => hits.has(cell)) ? [index] : [])
}

export function formatFathomCoordinate(cell: number): string {
  if (!isValidCell(cell)) return '—'
  return `${String.fromCharCode(65 + cell % FATHOM_BOARD_SIZE)}${Math.floor(cell / FATHOM_BOARD_SIZE) + 1}`
}

export function formatFathomShipLabel(ship: FathomShip): string {
  return `${ship.name}, ${ship.length} ${ship.length === 1 ? 'cell' : 'cells'}`
}

function createFathomFleet(seed: number): FathomShip[] {
  const random = createRandom(seed)
  const occupied = new Set<number>()
  const fleet: FathomShip[] = []

  function placeShip(shipIndex: number): boolean {
    if (shipIndex >= FATHOM_FLEET_SPEC.length) return true
    const spec = FATHOM_FLEET_SPEC[shipIndex]!
    const placements = shuffle(makePlacements(spec.length), random)
    for (const cells of placements) {
      if (cells.some((cell) => occupied.has(cell))) continue
      cells.forEach((cell) => occupied.add(cell))
      fleet.push({ name: spec.name, length: spec.length, cells })
      if (placeShip(shipIndex + 1)) return true
      fleet.pop()
      cells.forEach((cell) => occupied.delete(cell))
    }
    return false
  }

  if (!placeShip(0)) throw new Error('Unable to place the Fathom fleet.')
  return fleet
}

function makePlacements(length: number): number[][] {
  const placements: number[][] = []
  for (let row = 0; row < FATHOM_BOARD_SIZE; row += 1) {
    for (let column = 0; column < FATHOM_BOARD_SIZE; column += 1) {
      if (column + length <= FATHOM_BOARD_SIZE) placements.push(Array.from({ length }, (_, offset) => row * FATHOM_BOARD_SIZE + column + offset))
      if (row + length <= FATHOM_BOARD_SIZE) placements.push(Array.from({ length }, (_, offset) => (row + offset) * FATHOM_BOARD_SIZE + column))
    }
  }
  return placements
}

function shuffle<T>(values: T[], random: () => number): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[values[index], values[other]] = [values[other]!, values[index]!]
  }
  return values
}

function createRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    value >>>= 0
    return value / 0x1_0000_0000
  }
}

function normalizeSeed(seed: number): number {
  const safeSeed = Number.isSafeInteger(seed) ? seed >>> 0 : randomSeed()
  return safeSeed === 0 ? 1 : safeSeed
}

function nextSeed(seed: number): number {
  return normalizeSeed((seed + 0x9e3779b9) >>> 0)
}

function randomSeed(): number {
  return normalizeSeed(Math.floor(Math.random() * 0xffff_ffff))
}

function isValidCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < FATHOM_CELL_COUNT
}

