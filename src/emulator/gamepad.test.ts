import { describe, expect, it } from 'vitest'
import { readStandardGamepads, type StandardGamepadLike } from './gamepad'

function makePad(pressed: number[] = [], axes: number[] = []): NonNullable<StandardGamepadLike> {
  return {
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index), value: pressed.includes(index) ? 1 : 0 })),
    axes,
  }
}

describe('standard GBA gamepad mapping', () => {
  it('maps face buttons, d-pad, shoulders, triggers, Select, and Start', () => {
    const { connectedCount, keys } = readStandardGamepads([makePad([0, 1, 4, 7, 8, 9, 12, 15])])

    expect(connectedCount).toBe(1)
    expect([...keys].sort()).toEqual(['ArrowRight', 'ArrowUp', 'Backspace', 'Enter', 'a', 's', 'x', 'z'].sort())
  })

  it('maps the left stick and combines multiple standard controllers without duplicate keys', () => {
    const first = makePad([], [-0.75, 0.8])
    const second = makePad([0, 14], [0.8, -0.8])
    const { connectedCount, keys } = readStandardGamepads([first, second])

    expect(connectedCount).toBe(2)
    expect([...keys].sort()).toEqual(['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'z'].sort())
  })

  it('ignores disconnected and non-standard controllers', () => {
    const disconnected = { ...makePad([0]), connected: false }
    const nonStandard = { ...makePad([1]), mapping: '' }
    const { connectedCount, keys } = readStandardGamepads([disconnected, nonStandard])

    expect(connectedCount).toBe(0)
    expect(keys.size).toBe(0)
  })

  it('accepts analog button values and leaves stick drift inside the dead zone idle', () => {
    const pad = makePad([], [0.2, -0.4])
    const buttons = Array.from(pad.buttons ?? [], (button, index) => index === 0 ? { pressed: false, value: 0.8 } : button)
    const { keys } = readStandardGamepads([{ ...pad, buttons }])

    expect([...keys]).toEqual(['z'])
  })
})
