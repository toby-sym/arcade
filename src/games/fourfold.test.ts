import { describe, expect, it } from 'vitest'
import {
  chooseFourfoldMove,
  createFourfoldState,
  dropFourfold,
  FOURFOLD_CELL_COUNT,
  getFourfoldCell,
  hasFour,
  newFourfoldRound,
  pauseFourfold,
  playFourfoldCpuTurn,
  resumeFourfold,
  startFourfold,
} from './fourfold'

describe('Fourfold', () => {
  it('drops discs to the lowest open space and reports a full column', () => {
    let state = startFourfold(createFourfoldState())
    state = dropFourfold(state, 2)
    expect(state.phase).toBe('cpu-turn')
    expect(getFourfoldCell(state.board, 5, 2)).toBe(1)
    expect(dropFourfold(state, 2)).toBe(state)
    expect(state.board).toHaveLength(FOURFOLD_CELL_COUNT)

    const fullColumn = { ...startFourfold(createFourfoldState()), board: board(Array(6).fill('0010000')) }
    const rejected = dropFourfold(fullColumn, 2)
    expect(rejected.board).toEqual(fullColumn.board)
    expect(rejected.message).toBe('Column 3 is full. Choose another.')
  })

  it('detects horizontal, vertical, and diagonal lines', () => {
    expect(hasFour(board(['0000000', '0000000', '0000000', '0000000', '0000000', '1111000']), 'player')).toBe(true)
    expect(hasFour(board(['0000000', '0000000', '1000000', '1000000', '1000000', '1000000']), 'player')).toBe(true)
    expect(hasFour(board(['0000000', '0000000', '0002000', '0020000', '0200000', '2000000']), 'cpu')).toBe(true)
  })

  it('takes a winning move and blocks an immediate player line', () => {
    const cpuWin = board(['0000000', '0000000', '0000000', '0000000', '0000000', '2220000'])
    const playerThreat = board(['0000000', '0000000', '0000000', '1000000', '1000000', '1000000'])
    expect(chooseFourfoldMove(cpuWin)).toBe(3)
    expect(chooseFourfoldMove(playerThreat)).toBe(0)
  })

  it('returns the turn after a local opponent move and pauses on either side turn', () => {
    const afterPlayer = dropFourfold(startFourfold(createFourfoldState()), 3)
    const pausedCpu = pauseFourfold(afterPlayer)
    expect(pausedCpu.phase).toBe('paused')
    expect(playFourfoldCpuTurn(pausedCpu)).toBe(pausedCpu)
    expect(resumeFourfold(pausedCpu).phase).toBe('cpu-turn')
    expect(playFourfoldCpuTurn(afterPlayer).phase).toBe('player-turn')
    expect(pauseFourfold(startFourfold(createFourfoldState())).pausedPhase).toBe('player-turn')
  })

  it('keeps a win streak across boards and resets it when the opponent wins', () => {
    const winningBoard = board(['0000000', '0000000', '0000000', '1000000', '1000000', '1000000'])
    const firstWin = dropFourfold({ ...createFourfoldState(), phase: 'player-turn', board: winningBoard }, 0)
    expect(firstWin).toMatchObject({ phase: 'won', streak: 1 })
    const nextRound = newFourfoldRound(firstWin)
    expect(nextRound).toMatchObject({ phase: 'player-turn', streak: 1 })
    const lost = playFourfoldCpuTurn({ ...createFourfoldState(), phase: 'cpu-turn', board: board(['0000000', '0000000', '0000000', '0000000', '0000000', '2220000']), streak: 2 })
    expect(lost).toMatchObject({ phase: 'lost', streak: 0 })
    expect(newFourfoldRound(lost).phase).toBe('player-turn')
  })
})

function board(rows: string[]): ReturnType<typeof createFourfoldState>['board'] {
  return rows.flatMap((row) => [...row].map((disc) => Number(disc) as 0 | 1 | 2))
}
