import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmulatorBridge } from '@gba-kit/gba-browser'
import type { GbaSnapshot } from '@gba-kit/gba-emulator/savestate'
import {
  createPortableGbaSave,
  GBA_RECENTS_KEY,
  clearRecentGbaRoms,
  hashGbaRom,
  parsePortableGbaSave,
  readBlobAsArrayBuffer,
  readRecentGbaRoms,
  validateGbaFile,
  writeRecentGbaRom,
} from './gbaStorage'

function fakeSnapshot(): GbaSnapshot {
  const bridge = new EmulatorBridge()
  const snapshot = bridge.gba.serialize()
  snapshot.cpu.registers.set(Array.from({ length: 16 }, (_, index) => index * 19))
  bridge.stop()
  return snapshot
}

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

beforeEach(() => {
  class TestImageData {
    data: Uint8ClampedArray
    constructor(public width: number, public height: number) {
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
  vi.stubGlobal('ImageData', TestImageData)
})

afterEach(() => vi.unstubAllGlobals())

describe('Game Boy Advance local files and save states', () => {
  it('accepts only reasonable local .gba files', () => {
    expect(validateGbaFile('game.gba', 0xc0)).toBeNull()
    expect(validateGbaFile('game.nds', 1024)).toMatch(/\.gba/)
    expect(validateGbaFile('game.gba', 100)).toMatch(/too small/)
    expect(validateGbaFile('game.gba', 32 * 1024 * 1024 + 1)).toMatch(/32 MB/)
  })

  it('identifies the complete file, not only its cartridge header', async () => {
    const first = new Uint8Array(512)
    const second = first.slice()
    second[480] = 1
    expect(await hashGbaRom(first.buffer)).not.toBe(await hashGbaRom(second.buffer))
  })

  it('keeps only a bounded list of ROM names and fingerprints in local history', () => {
    const storage = memoryStorage()
    expect(writeRecentGbaRom({ name: 'puzzle.gba', hash: 'a'.repeat(64), playedAt: 10 }, storage)).toBe(true)
    expect(writeRecentGbaRom({ name: 'racer.gba', hash: 'b'.repeat(64), playedAt: 20 }, storage)).toBe(true)
    expect(readRecentGbaRoms(storage)).toEqual([
      { name: 'racer.gba', hash: 'b'.repeat(64), playedAt: 20 },
      { name: 'puzzle.gba', hash: 'a'.repeat(64), playedAt: 10 },
    ])
    expect(storage.getItem(GBA_RECENTS_KEY)).not.toContain('ROM bytes')
    expect(clearRecentGbaRoms(storage)).toBe(true)
    expect(readRecentGbaRoms(storage)).toEqual([])
  })

  it('exports and imports a typed-array save state only for its matching ROM', async () => {
    const thumbnail = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
    const portable = await createPortableGbaSave('c'.repeat(64), 'Checkpoint', fakeSnapshot(), thumbnail)
    const imported = parsePortableGbaSave(portable, 'c'.repeat(64))

    expect(imported).not.toBeNull()
    expect(imported?.label).toBe('Checkpoint')
    expect(imported?.snapshot.cpu.registers).toBeInstanceOf(Uint32Array)
    expect(Array.from(imported!.snapshot.cpu.registers.slice(0, 4))).toEqual([0, 19, 38, 57])
    expect(imported?.snapshot.bus.ewram).toBeInstanceOf(Uint8Array)
    expect(await readBlobAsArrayBuffer(imported!.thumbnail)).toEqual(await readBlobAsArrayBuffer(thumbnail))
    expect(parsePortableGbaSave(portable, 'd'.repeat(64))).toBeNull()
  })
})
