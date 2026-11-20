import { describe, expect, it } from 'vitest'
import {
  BEAMWORKS_PUZZLES,
  BEAMWORKS_BOARD_SIZE,
  beamworksCell,
  createBeamworksState,
  pauseBeamworks,
  restartBeamworks,
  resumeBeamworks,
  rotateBeamworksMirror,
  startBeamworks,
  traceBeam,
  undoBeamworks,
} from './beamworks'

describe('Beamworks mirror circuits', () => {
  it('starts with each beam missing its receiver', () => {
    const state = createBeamworksState()
    expect(BEAMWORKS_PUZZLES).toHaveLength(4)
    expect(state.phase).toBe('ready')
    expect(traceBeam(BEAMWORKS_PUZZLES[0]!, state.mirrors).reachedReceiver).toBe(false)
  })

  it('rotates one mirror at a time and rejects inactive or invalid controls', () => {
    const ready = createBeamworksState()
    expect(rotateBeamworksMirror(ready, 0)).toBe(ready)
    const live = startBeamworks(ready)
    expect(rotateBeamworksMirror(live, -1)).toBe(live)
    expect(rotateBeamworksMirror(live, 8)).toBe(live)
    const turned = rotateBeamworksMirror(live, 0)
    expect(turned.mirrors[0]?.angle).toBe('slash')
    expect(turned.turns).toBe(1)
    expect(undoBeamworks(turned)).toMatchObject({ turns: 0, stageTurns: 0, mirrors: live.mirrors })
  })

  it('pauses, resumes, and restarts without carrying mirror angles or turns', () => {
    const live = startBeamworks(createBeamworksState())
    const turned = rotateBeamworksMirror(live, 0)
    expect(rotateBeamworksMirror(pauseBeamworks(turned), 1).turns).toBe(1)
    expect(resumeBeamworks(pauseBeamworks(turned)).phase).toBe('playing')
    expect(restartBeamworks(turned)).toMatchObject({ phase: 'ready', turns: 0, stageIndex: 0, history: [] })
  })

  it('solves all four hand-authored paths and records their turn counts', () => {
    let state = startBeamworks(createBeamworksState())
    const solution = [[0, 1], [1], [0, 1], [1, 2]]
    for (let stage = 0; stage < solution.length; stage += 1) {
      expect(traceBeam(BEAMWORKS_PUZZLES[stage]!, state.mirrors).reachedReceiver).toBe(false)
      for (const mirror of solution[stage]!) state = rotateBeamworksMirror(state, mirror)
      expect(state.completedStageTurns).toHaveLength(stage + 1)
      if (stage < solution.length - 1) expect(state.stageIndex).toBe(stage + 1)
    }
    expect(state.phase).toBe('complete')
    expect(state.turns).toBe(7)
    expect(state.completedStageTurns).toEqual([2, 1, 2, 2])
    expect(state.message).toMatch(/all four receivers lit/i)
  })

  it('stops safely when a mirror route loops back through the same circuit', () => {
    const circuit = {
      title: 'Closed Loop',
      hint: 'Keep the light moving.',
      source: { cell: beamworksCell(1, 2), direction: 'right' as const },
      receiver: beamworksCell(6, 6),
      mirrors: [
        { cell: beamworksCell(1, 3), angle: 'backslash' as const },
        { cell: beamworksCell(3, 3), angle: 'slash' as const },
        { cell: beamworksCell(3, 1), angle: 'backslash' as const },
        { cell: beamworksCell(1, 1), angle: 'slash' as const },
      ],
      blockers: [],
    }
    const path = traceBeam(circuit, circuit.mirrors)
    expect(path.reachedReceiver).toBe(false)
    expect(new Set(path.cells).size).toBeLessThan(path.cells.length)
    expect(path.cells.length).toBeLessThan(BEAMWORKS_BOARD_SIZE ** 2 * 4)
  })
})
