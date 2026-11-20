import { deleteState, EmulatorBridge, listByRom, loadState, renameState, saveState, type SaveStateMeta } from '@gba-kit/gba-browser'
import type { GbaSnapshot } from '@gba-kit/gba-emulator/savestate'

export const GBA_RECENTS_KEY = 'arcade.gba.recent.v1'
export const GBA_ROM_MAX_BYTES = 32 * 1024 * 1024
export const GBA_STATE_FILE_MAX_BYTES = 24 * 1024 * 1024
export const GBA_MAX_SAVE_STATES = 10
const MAX_RECENT_ROMS = 8

export interface RecentGbaRom {
  name: string
  hash: string
  playedAt: number
}

export interface PortableGbaSave {
  format: 'arcade-gba-save'
  version: 1
  romHash: string
  label: string
  createdAt: number
  thumbnail: string
  snapshot: unknown
}

const typedArrayConstructors = {
  Uint8Array,
  Int8Array,
  Uint32Array,
} as const

type TypedArrayName = keyof typeof typedArrayConstructors

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(encoded: string): Uint8Array | null {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return null
  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch {
    return null
  }
}

function encodeSnapshot(value: unknown): unknown {
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const name = value.constructor.name as TypedArrayName
    if (!(name in typedArrayConstructors)) throw new Error('This save state contains an unsupported typed array.')
    const view = value as Exclude<ArrayBufferView, DataView>
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    return { __arcadeTypedArray: name, data: bytesToBase64(bytes) }
  }
  if (Array.isArray(value)) return value.map(encodeSnapshot)
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encodeSnapshot(child)]))
  }
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  throw new Error('This save state contains data that cannot be exported safely.')
}

function decodeSnapshot(value: unknown, byteBudget: { remaining: number }): unknown {
  if (Array.isArray(value)) return value.map((child) => decodeSnapshot(child, byteBudget))
  if (!isRecord(value)) return value
  if ('__arcadeTypedArray' in value) {
    if (Object.keys(value).length !== 2 || typeof value.__arcadeTypedArray !== 'string' || typeof value.data !== 'string') return null
    const name = value.__arcadeTypedArray as TypedArrayName
    if (!(name in typedArrayConstructors)) return null
    const bytes = base64ToBytes(value.data)
    if (!bytes || bytes.byteLength > byteBudget.remaining) return null
    byteBudget.remaining -= bytes.byteLength
    const constructor = typedArrayConstructors[name] as Uint8ArrayConstructor
    if (bytes.byteLength % constructor.BYTES_PER_ELEMENT !== 0) return null
    const owned = bytes.slice().buffer
    return new constructor(owned)
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodeSnapshot(child, byteBudget)]))
}

export function validateGbaFile(name: string, size: number): string | null {
  if (!name.toLocaleLowerCase().endsWith('.gba')) return 'Choose a Game Boy Advance .gba file.'
  if (!Number.isSafeInteger(size) || size < 0xc0) return 'That file is too small to contain a Game Boy Advance ROM header.'
  if (size > GBA_ROM_MAX_BYTES) return 'That ROM is larger than the 32 MB limit for this cabinet.'
  return null
}

export async function hashGbaRom(rom: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', rom)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function readRecentGbaRoms(storage?: Pick<Storage, 'getItem'>): RecentGbaRom[] {
  try {
    const target = storage ?? window.localStorage
    const value: unknown = JSON.parse(target.getItem(GBA_RECENTS_KEY) ?? 'null')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is RecentGbaRom =>
      isRecord(item)
      && typeof item.name === 'string'
      && typeof item.hash === 'string'
      && /^[\da-f]{64}$/i.test(item.hash)
      && typeof item.playedAt === 'number'
      && Number.isFinite(item.playedAt),
    ).slice(0, MAX_RECENT_ROMS)
  } catch {
    return []
  }
}

export function writeRecentGbaRom(rom: RecentGbaRom, storage?: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  try {
    const target = storage ?? window.localStorage
    const recent = [rom, ...readRecentGbaRoms(target).filter((item) => item.hash !== rom.hash)]
    target.setItem(GBA_RECENTS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_ROMS)))
    return true
  } catch {
    return false
  }
}

export function clearRecentGbaRoms(storage?: Pick<Storage, 'removeItem'>): boolean {
  try {
    const target = storage ?? window.localStorage
    target.removeItem(GBA_RECENTS_KEY)
    return true
  } catch {
    return false
  }
}

export async function saveGbaSnapshot(romHash: string, snapshot: GbaSnapshot, thumbnail: Blob, label: string): Promise<number> {
  const saves = await listByRom(romHash)
  while (saves.length >= GBA_MAX_SAVE_STATES) {
    const oldest = [...saves].sort((left, right) => left.timestamp - right.timestamp)[0]
    if (!oldest) break
    await deleteState(oldest.id)
    saves.splice(saves.findIndex((save) => save.id === oldest.id), 1)
  }
  return saveState(romHash, snapshot, thumbnail, label)
}

export async function renameGbaSave(id: number, label: string): Promise<void> {
  const safeLabel = label.trim().slice(0, 40)
  if (!safeLabel) throw new Error('Enter a name for this save state.')
  await renameState(id, safeLabel)
}

export async function removeGbaSave(id: number): Promise<void> {
  await deleteState(id)
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await readBlobAsArrayBuffer(blob))
  return bytesToBase64(bytes)
}

export function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Could not read local file data.'))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read local file data.'))
    reader.readAsArrayBuffer(blob)
  })
}

export function readLocalFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read local file data.'))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read local file data.'))
    reader.readAsText(file)
  })
}

export async function createPortableGbaSave(romHash: string, label: string, snapshot: GbaSnapshot, thumbnail: Blob): Promise<PortableGbaSave> {
  return {
    format: 'arcade-gba-save',
    version: 1,
    romHash,
    label: label.slice(0, 40),
    createdAt: Date.now(),
    thumbnail: await blobToBase64(thumbnail),
    snapshot: encodeSnapshot(snapshot),
  }
}

export function parsePortableGbaSave(value: unknown, expectedRomHash: string): { label: string; snapshot: GbaSnapshot; thumbnail: Blob } | null {
  if (!isRecord(value)
    || value.format !== 'arcade-gba-save'
    || value.version !== 1
    || value.romHash !== expectedRomHash
    || typeof value.label !== 'string'
    || typeof value.createdAt !== 'number'
    || !Number.isFinite(value.createdAt)
    || typeof value.thumbnail !== 'string') return null

  try {
    const thumbnailBytes = base64ToBytes(value.thumbnail)
    if (!thumbnailBytes || thumbnailBytes.byteLength < 8 || thumbnailBytes.byteLength > 2 * 1024 * 1024) return null
    const snapshot = decodeSnapshot(value.snapshot, { remaining: 20 * 1024 * 1024 })
    if (!isGbaSnapshot(snapshot)) return null
    return {
      label: value.label.trim().slice(0, 40) || 'Imported save',
      snapshot,
      thumbnail: new Blob([thumbnailBytes.slice().buffer as ArrayBuffer], { type: 'image/png' }),
    }
  } catch {
    return null
  }
}

function sameSnapshotShape(template: unknown, value: unknown): boolean {
  if (ArrayBuffer.isView(template) && !(template instanceof DataView)) {
    return ArrayBuffer.isView(value)
      && !(value instanceof DataView)
      && value.constructor === template.constructor
      && value.byteLength === template.byteLength
  }
  if (Array.isArray(template)) {
    return Array.isArray(value)
      && template.length === value.length
      && template.every((item, index) => sameSnapshotShape(item, value[index]))
  }
  if (template === null) return value === null
  if (isRecord(template)) {
    if (!isRecord(value)) return false
    const templateKeys = Object.keys(template).sort()
    const valueKeys = Object.keys(value).sort()
    return templateKeys.length === valueKeys.length
      && templateKeys.every((key, index) => key === valueKeys[index] && sameSnapshotShape(template[key], value[key]))
  }
  if (typeof template === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === typeof template
}

function isGbaSnapshot(value: unknown): value is GbaSnapshot {
  if (!isRecord(value) || value.version !== 1) return false
  const bridge = new EmulatorBridge()
  try {
    const template = bridge.gba.serialize() as unknown as Record<string, unknown>
    template.cpu = bridge.cpu.serialize()
    return sameSnapshotShape(template, value)
  } finally {
    bridge.stop()
  }
}

export type { SaveStateMeta }
export { loadState }
