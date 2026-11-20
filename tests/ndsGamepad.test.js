import { describe, expect, it } from 'vitest'
import { BUTTON_MASK, InputState, gamepadToMask } from '../public/nds/js/input.js'

function makePad(pressed = [], axes = []) {
  return {
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })),
    axes,
  }
}

describe('Nintendo DS gamepad input', () => {
  it('maps a standard controller and its left stick to DS controls', () => {
    const mask = gamepadToMask(makePad([0, 4, 9, 12, 15], [0.7, -0.8]))

    expect(mask & BUTTON_MASK.B).not.toBe(0)
    expect(mask & BUTTON_MASK.L).not.toBe(0)
    expect(mask & BUTTON_MASK.START).not.toBe(0)
    expect(mask & BUTTON_MASK.UP).not.toBe(0)
    expect(mask & BUTTON_MASK.RIGHT).not.toBe(0)
    expect(mask & BUTTON_MASK.DOWN).toBe(0)
  })

  it('polls controller changes and releases held buttons when detached', () => {
    const input = new InputState()
    let pads = [makePad([0, 12])]
    let nextId = 0
    const frames = new Map()
    const status = []
    const raf = (callback) => {
      const id = ++nextId
      frames.set(id, callback)
      return id
    }
    const caf = (id) => { frames.delete(id) }
    const stepFrame = () => {
      const pending = [...frames.entries()]
      frames.clear()
      pending.forEach(([, callback]) => callback(0))
    }

    const detach = input.attachGamepad({ getGamepads: () => pads, raf, caf, onStatus: (count) => status.push(count) })
    expect(input.mask & BUTTON_MASK.B).not.toBe(0)
    expect(input.mask & BUTTON_MASK.UP).not.toBe(0)
    expect(status.at(-1)).toBe(1)

    pads = []
    stepFrame()
    expect(input.mask).toBe(0)
    expect(status.at(-1)).toBe(0)

    pads = [makePad([1])]
    window.dispatchEvent(new Event('gamepadconnected'))
    expect(input.mask & BUTTON_MASK.A).not.toBe(0)

    detach()
    expect(input.mask).toBe(0)
    expect(frames.size).toBe(0)
  })
})
