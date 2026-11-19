import { describe, expect, it } from 'vitest'
import { BLOCK_TYPES, blockDropReducer, createBlockDropState, getPieceCells, type BlockDropState } from './blockDrop'

describe('Block Drop', () => {
  it('starts with a deterministic seven-piece bag', () => {
    const first = createBlockDropState(412)
    const second = createBlockDropState(412)

    expect(first).toEqual(second)
    expect(new Set([first.current.type, ...first.next])).toEqual(new Set(BLOCK_TYPES))
    expect(first.next).toHaveLength(6)
  })

  it('moves to the edge and rejects a move through the wall', () => {
    let state: BlockDropState = { ...createBlockDropState(12), phase: 'playing', current: { type: 'i', rotation: 0, x: 3, y: 4 } }
    for (let move = 0; move < 5; move += 1) state = blockDropReducer(state, { type: 'move', dx: -1 })

    expect(state.current.x).toBe(0)
    expect(blockDropReducer(state, { type: 'move', dx: -1 })).toBe(state)
  })

  it('rotates a piece in the three by three play area', () => {
    const playing: BlockDropState = { ...createBlockDropState(11), phase: 'playing', current: { type: 't', rotation: 0, x: 3, y: 4 } }
    const rotated = blockDropReducer(playing, { type: 'rotate', direction: 1 })

    expect(getPieceCells(rotated.current)).toEqual([{ x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }])
  })

  it('drops, locks, and awards points for distance', () => {
    const playing = { ...createBlockDropState(77), phase: 'playing' as const, current: { type: 'o' as const, rotation: 0, x: 3, y: -1 } }
    const dropped = blockDropReducer(playing, { type: 'hardDrop' })

    expect(dropped.score).toBe(38)
    expect(dropped.board[18]?.slice(4, 6)).toEqual(['o', 'o'])
    expect(dropped.board[19]?.slice(4, 6)).toEqual(['o', 'o'])
    expect(dropped.canHold).toBe(true)
  })

  it('scores soft drops and locks a cleared row with level progression', () => {
    const board = createBlockDropState(3).board.map((row) => [...row])
    board[19] = ['i', 'i', 'i', 'i', 'i', 'i', null, null, null, null]
    const state = {
      ...createBlockDropState(3),
      phase: 'playing' as const,
      board,
      current: { type: 'i' as const, rotation: 0, x: 6, y: 17 },
      lines: 9,
      score: 10,
    }
    const softDropped = blockDropReducer(state, { type: 'softDrop' })
    expect(softDropped.current.y).toBe(18)
    expect(softDropped.score).toBe(11)

    const cleared = blockDropReducer(softDropped, { type: 'hardDrop' })
    expect(cleared.lines).toBe(10)
    expect(cleared.level).toBe(2)
    expect(cleared.score).toBe(111)
    expect(cleared.board[0]).toEqual(Array(10).fill(null))
  })

  it('holds one piece until the current piece locks', () => {
    const playing = { ...createBlockDropState(991), phase: 'playing' as const }
    const held = blockDropReducer(playing, { type: 'hold' })

    expect(held.hold).toBe(playing.current.type)
    expect(held.current.type).toBe(playing.next[0])
    expect(held.canHold).toBe(false)
    expect(blockDropReducer(held, { type: 'hold' })).toBe(held)
    expect(blockDropReducer(blockDropReducer(held, { type: 'hardDrop' }), { type: 'hold' }).canHold).toBe(false)
  })

  it('pauses gravity and ends when the next piece cannot fit', () => {
    const playing = { ...createBlockDropState(7), phase: 'playing' as const }
    const paused = blockDropReducer(playing, { type: 'pause' })
    expect(blockDropReducer(paused, { type: 'tick' })).toBe(paused)
    expect(blockDropReducer(paused, { type: 'resume' }).phase).toBe('playing')

    const board = playing.board.map((row) => [...row])
    board[0] = Array(10).fill('i')
    const blockedSpawn = { ...playing, board, current: { type: 'o' as const, rotation: 0, x: 3, y: -1 } }
    expect(blockDropReducer(blockedSpawn, { type: 'tick' }).phase).toBe('over')
  })
})
