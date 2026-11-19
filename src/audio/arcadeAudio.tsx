import { createContext, useCallback, useContext, type PropsWithChildren } from 'react'

export type ArcadeSound = 'signal' | 'fire' | 'hit' | 'score' | 'miss' | 'win' | 'lose' | 'wave'

interface Tone {
  frequency: number
  duration: number
  delay?: number
  endFrequency?: number
}

const soundNotes: Record<ArcadeSound, Tone[]> = {
  signal: [{ frequency: 392, duration: 0.055 }, { frequency: 523, duration: 0.055, delay: 0.06 }, { frequency: 784, duration: 0.09, delay: 0.12 }],
  fire: [{ frequency: 880, endFrequency: 480, duration: 0.045 }],
  hit: [{ frequency: 260, endFrequency: 150, duration: 0.055 }],
  score: [{ frequency: 587, duration: 0.07 }, { frequency: 784, duration: 0.1, delay: 0.075 }],
  miss: [{ frequency: 220, endFrequency: 135, duration: 0.15 }],
  win: [{ frequency: 440, duration: 0.075 }, { frequency: 587, duration: 0.075, delay: 0.08 }, { frequency: 784, duration: 0.14, delay: 0.16 }],
  lose: [{ frequency: 392, endFrequency: 310, duration: 0.08 }, { frequency: 293, endFrequency: 190, duration: 0.18, delay: 0.09 }],
  wave: [{ frequency: 330, duration: 0.055 }, { frequency: 440, duration: 0.055, delay: 0.06 }, { frequency: 660, duration: 0.1, delay: 0.12 }],
}

const SoundEnabledContext = createContext(false)
let audioContext: AudioContext | null = null

export function ArcadeAudioProvider({ enabled, children }: PropsWithChildren<{ enabled: boolean }>) {
  return <SoundEnabledContext.Provider value={enabled}>{children}</SoundEnabledContext.Provider>
}

export function useArcadeSound() {
  const enabled = useContext(SoundEnabledContext)
  return useCallback((sound: ArcadeSound) => playArcadeSound(sound, enabled), [enabled])
}

export function useArcadeTone() {
  const enabled = useContext(SoundEnabledContext)
  return useCallback((frequency: number) => playArcadeTone(frequency, enabled), [enabled])
}

export function setArcadeAudioEnabled(enabled: boolean) {
  if (!enabled) {
    if (audioContext?.state === 'running') void audioContext.suspend().catch(() => undefined)
    return
  }
  const context = getAudioContext()
  if (context?.state === 'suspended') void context.resume().catch(() => undefined)
}

export function playArcadeTone(frequency: number, enabled: boolean) {
  if (!enabled || !Number.isFinite(frequency) || frequency < 40 || frequency > 4000) return
  playTones([{ frequency, duration: 0.09 }])
}

export function playArcadeSound(sound: ArcadeSound, enabled: boolean) {
  if (!enabled) return
  playTones(soundNotes[sound])
}

function playTones(tones: Tone[]) {
  const context = getAudioContext()
  if (!context) return
  if (context.state === 'suspended') void context.resume().catch(() => undefined)

  const origin = context.currentTime
  for (const tone of tones) {
    const start = origin + (tone.delay ?? 0)
    const end = start + tone.duration
    try {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(tone.frequency, start)
      if (tone.endFrequency !== undefined) oscillator.frequency.linearRampToValueAtTime(tone.endFrequency, end)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(end + 0.01)
    } catch {
      // Audio is optional and can be unavailable in restricted browser contexts.
    }
  }
}

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (audioContext) return audioContext
  try {
    const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext }
    const Context = window.AudioContext ?? browserWindow.webkitAudioContext
    if (typeof Context !== 'function') return null
    audioContext = new Context()
    return audioContext
  } catch {
    return null
  }
}
