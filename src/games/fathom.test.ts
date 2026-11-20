import { describe, expect, it } from 'vitest'
import {
  createFathomState,
  FATHOM_BOARD_SIZE,
  FATHOM_FLEET_SPEC,
  fireFathomShot,
  formatFathomCoordinate,
  getSunkShipIndices,
  newFathomFleet,
  pauseFathom,
  restartFathom,
  resumeFathom,
  scanFathom,
  startFathom,
} from './fathom'

describe('Fathom', () => {
  it('creates reproducible fleets with the expected lengths and no overlaps', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const state = createFathomState(seed)
      expect(state.fleet).toEqual(createFathomState(seed).fleet)
      expect(state.fleet.map((ship) => ship.length)).toEqual(FATHOM_FLEET_SPEC.map((ship) => ship.length))
      const cells = state.fleet.flatMap((ship) => ship.cells)
      expect(new Set(cells).size).toBe(cells.length)
      expect(cells.every((cell) => cell >= 0 && cell < FATHOM_BOARD_SIZE ** 2)).toBe(true)
      for (const ship of state.fleet) {
        const rows = new Set(ship.cells.map((cell) => Math.floor(cell / FATHOM_BOARD_SIZE)))
        const columns = new Set(ship.cells.map((cell) => cell % FATHOM_BOARD_SIZE))
        expect(rows.size === 1 || columns.size === 1).toBe(true)
      }
    }
  })

  it('fires once per coordinate and identifies a sunk ship', () => {
    let state = startFathom(createFathomState(27))
    const firstShip = state.fleet[0]!
    state = fireFathomShot(state, firstShip.cells[0]!)
    expect(state.shots.at(-1)?.result).toBe('hit')
    const shotCount = state.shots.length
    state = fireFathomShot(state, firstShip.cells[0]!)
    expect(state.shots).toHaveLength(shotCount)
    expect(state.message).toMatch(/already charted/i)

    for (const cell of firstShip.cells.slice(1)) state = fireFathomShot(state, cell)
    expect(getSunkShipIndices(state.fleet, state.shots)).toContain(0)
    expect(state.message).toMatch(/sunk/i)
  })

  it('uses one sonar charge for a clipped three-by-three echo scan', () => {
    const state = startFathom(createFathomState(81))
    const scan = scanFathom(state, 0)
    const knownNearCorner = state.fleet.flatMap((ship) => ship.cells).filter((cell) => {
      const row = Math.floor(cell / FATHOM_BOARD_SIZE)
      const column = cell % FATHOM_BOARD_SIZE
      return row <= 1 && column <= 1
    }).length
    expect(scan.scans).toEqual([{ center: 0, echoes: knownNearCorner }])
    expect(scan.scansRemaining).toBe(2)
    expect(scan.message).toMatch(/Sonar finds|No hull echoes/)
    expect(scanFathom(scan, 1).scansRemaining).toBe(1)
    expect(scanFathom({ ...scan, scansRemaining: 0 }, 1)).toMatchObject({ scansRemaining: 0, scans: scan.scans })
  })

  it('clears the hidden fleet and records the exact shot count', () => {
    let state = startFathom(createFathomState(8128))
    const fleetCells = state.fleet.flatMap((ship) => ship.cells)
    for (const cell of fleetCells) state = fireFathomShot(state, cell)
    expect(state.phase).toBe('won')
    expect(state.shots).toHaveLength(fleetCells.length)
    expect(state.message).toContain(`${fleetCells.length} shots`)
    expect(formatFathomCoordinate(0)).toBe('A1')
    expect(formatFathomCoordinate(63)).toBe('H8')
  })

  it('pauses and restarts the same fleet, while a new fleet changes the layout', () => {
    let state = startFathom(createFathomState(94))
    state = fireFathomShot(state, state.fleet[0]!.cells[0]!)
    const paused = pauseFathom(state)
    expect(fireFathomShot(paused, 0)).toBe(paused)
    expect(resumeFathom(paused).phase).toBe('playing')
    expect(restartFathom(paused)).toMatchObject({ phase: 'ready', shots: [], seed: state.seed, fleet: state.fleet })
    expect(newFathomFleet(state).fleet).not.toEqual(state.fleet)
  })
})
