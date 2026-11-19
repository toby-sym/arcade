import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useHeldKeys } from './useHeldKeys'

afterEach(() => vi.useRealTimers())

function HeldKeyHarness({
  onMove,
  repeatMs = 16,
}: {
  onMove: (deltaMs: number) => void
  repeatMs?: number
}) {
  const onKeyDown = useHeldKeys({ ArrowRight: onMove }, true, repeatMs)
  return <div role="group" aria-label="Held-key test board" tabIndex={0} onKeyDown={onKeyDown} />
}

describe('held keyboard controls', () => {
  it('updates on animation frames using elapsed time, then stops immediately on release', () => {
    vi.useFakeTimers()
    const deltas: number[] = []
    render(<HeldKeyHarness onMove={(deltaMs) => deltas.push(deltaMs)} />)
    const board = screen.getByRole('group', { name: 'Held-key test board' })

    fireEvent.keyDown(board, { key: 'ArrowRight' })
    expect(deltas).toEqual([16])

    act(() => { vi.advanceTimersByTime(64) })
    expect(deltas.reduce((total, delta) => total + delta, 0)).toBeCloseTo(80, 2)

    fireEvent.keyUp(window, { key: 'ArrowRight' })
    const releasedTotal = deltas.reduce((total, delta) => total + delta, 0)
    act(() => { vi.advanceTimersByTime(96) })
    expect(deltas.reduce((total, delta) => total + delta, 0)).toBe(releasedTotal)
  })

  it('keeps slower discrete repeats on their configured cadence', () => {
    vi.useFakeTimers()
    const moves = vi.fn()
    render(<HeldKeyHarness onMove={moves} repeatMs={100} />)
    const board = screen.getByRole('group', { name: 'Held-key test board' })

    fireEvent.keyDown(board, { key: 'ArrowRight' })
    expect(moves).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(96) })
    expect(moves).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(16) })
    expect(moves).toHaveBeenCalledTimes(2)
    expect(moves).toHaveBeenLastCalledWith(100)

    fireEvent.blur(window)
    act(() => { vi.advanceTimersByTime(200) })
    expect(moves).toHaveBeenCalledTimes(2)
  })
})
