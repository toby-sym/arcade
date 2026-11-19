import { afterEach, describe, expect, it, vi } from 'vitest'

describe('local arcade sounds', () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(window, 'AudioContext')

  afterEach(() => {
    vi.resetModules()
    if (originalAudioContext) Object.defineProperty(window, 'AudioContext', originalAudioContext)
    else Reflect.deleteProperty(window, 'AudioContext')
  })

  it('stays silent by default and synthesizes short notes only when enabled', async () => {
    const oscillator = {
      type: '',
      frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }
    const contexts: Array<{
      currentTime: number
      state: string
      destination: object
      createOscillator: ReturnType<typeof vi.fn>
      createGain: ReturnType<typeof vi.fn>
      resume: ReturnType<typeof vi.fn>
      suspend: ReturnType<typeof vi.fn>
    }> = []
    class MockAudioContext {
      currentTime = 0
      state = 'running'
      destination = {}
      createOscillator = vi.fn(() => oscillator)
      createGain = vi.fn(() => gain)
      resume = vi.fn().mockResolvedValue(undefined)
      suspend = vi.fn().mockResolvedValue(undefined)
      constructor() { contexts.push(this) }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: MockAudioContext })

    vi.resetModules()
    const { playArcadeSound, setArcadeAudioEnabled } = await import('./arcadeAudio')
    playArcadeSound('fire', false)
    expect(contexts).toHaveLength(0)

    playArcadeSound('signal', true)
    expect(contexts).toHaveLength(1)
    const context = contexts[0]!
    expect(context.createOscillator).toHaveBeenCalledTimes(3)
    expect(context.createGain).toHaveBeenCalledTimes(3)
    expect(oscillator.start).toHaveBeenCalledTimes(3)
    setArcadeAudioEnabled(false)
    expect(context.suspend).toHaveBeenCalledOnce()
  })
})
