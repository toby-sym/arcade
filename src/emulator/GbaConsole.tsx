import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { EmulatorBridge, listByRom, loadState as loadGbaState } from '@gba-kit/gba-browser'
import type { SaveStateMeta } from '@gba-kit/gba-browser'
import { readStandardGamepads, type StandardGamepadLike } from './gamepad'
import {
  GBA_STATE_FILE_MAX_BYTES,
  GBA_MAX_SAVE_STATES,
  clearRecentGbaRoms,
  hashGbaRom,
  readRecentGbaRoms,
  removeGbaSave,
  renameGbaSave,
  saveGbaSnapshot,
  validateGbaFile,
  writeRecentGbaRom,
  createPortableGbaSave,
  parsePortableGbaSave,
  readBlobAsArrayBuffer,
  readLocalFileAsText,
  type RecentGbaRom,
} from './gbaStorage'

const keyboardButtons = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'z', 'x', 'Backspace', 'Enter', 'a', 's'])
const touchButtons = [
  { label: 'A', key: 'z', className: 'gba-button-a' },
  { label: 'B', key: 'x', className: 'gba-button-b' },
  { label: 'L', key: 's', className: 'gba-button-l' },
  { label: 'R', key: 'a', className: 'gba-button-r' },
  { label: 'SELECT', key: 'Backspace', className: 'gba-button-select' },
  { label: 'START', key: 'Enter', className: 'gba-button-start' },
] as const

function normalizedKey(key: string): string {
  if (key.length === 1) return key.toLocaleLowerCase()
  return key
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

function releaseKey(bridge: EmulatorBridge, key: string) {
  bridge.handleKeyUp(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
}

type InputSource = 'keyboard' | 'touch' | 'gamepad'
type HeldKeys = Map<string, Set<InputSource>>

function pressInputKey(bridge: EmulatorBridge, heldKeys: HeldKeys, key: string, source: InputSource) {
  const normalized = normalizedKey(key)
  let sources = heldKeys.get(normalized)
  if (!sources) {
    sources = new Set()
    heldKeys.set(normalized, sources)
    bridge.handleKeyDown(new KeyboardEvent('keydown', { key: normalized, bubbles: true, cancelable: true }))
  }
  sources.add(source)
}

function releaseInputKey(bridge: EmulatorBridge, heldKeys: HeldKeys, key: string, source: InputSource) {
  const normalized = normalizedKey(key)
  const sources = heldKeys.get(normalized)
  if (!sources?.delete(source) || sources.size > 0) return
  heldKeys.delete(normalized)
  releaseKey(bridge, normalized)
}

function releaseAllInputKeys(bridge: EmulatorBridge, heldKeys: HeldKeys) {
  for (const key of heldKeys.keys()) releaseKey(bridge, key)
  heldKeys.clear()
}

function releaseInputSource(bridge: EmulatorBridge, heldKeys: HeldKeys, source: InputSource) {
  for (const [key, sources] of heldKeys) {
    if (!sources.delete(source) || sources.size > 0) continue
    heldKeys.delete(key)
    releaseKey(bridge, key)
  }
}

function downloadFile(name: string, data: Blob) {
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function GbaConsole({ onBack }: { onBack: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const saveInput = useRef<HTMLInputElement>(null)
  const cabinetRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bridgeRef = useRef<EmulatorBridge | null>(null)
  const romBufferRef = useRef<ArrayBuffer | null>(null)
  const currentRomRef = useRef<RecentGbaRom | null>(null)
  const heldKeys = useRef<HeldKeys>(new Map())
  const fullscreenFallback = useRef(false)
  const [bridgeState, setBridgeState] = useState<'idle' | 'running' | 'paused'>('idle')
  const [currentRom, setCurrentRom] = useState<RecentGbaRom | null>(null)
  const [gamepadCount, setGamepadCount] = useState(0)
  const [fullscreenMode, setFullscreenMode] = useState<'native' | 'viewport' | null>(null)
  const [recentRoms, setRecentRoms] = useState(() => readRecentGbaRoms())
  const [saveStates, setSaveStates] = useState<SaveStateMeta[]>([])
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({})
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [message, setMessage] = useState('Choose a .gba file stored on this device to begin.')
  const [busy, setBusy] = useState(false)
  const [deletePending, setDeletePending] = useState<number | null>(null)
  const [renamePending, setRenamePending] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmClearHistory, setConfirmClearHistory] = useState(false)

  useEffect(() => {
    const bridge = new EmulatorBridge()
    bridgeRef.current = bridge
    bridge.setCallbacks({
      onStateChange: setBridgeState,
      onFrame: () => undefined,
      onBreakpoint: () => undefined,
    })
    if (canvasRef.current) bridge.attachCanvas(canvasRef.current)

    const stopInput = () => {
      releaseAllInputKeys(bridge, heldKeys.current)
    }
    const pauseWhenHidden = () => {
      if (document.hidden) {
        stopInput()
        bridge.pause()
      }
    }
    const releaseOnBlur = () => stopInput()
    document.addEventListener('visibilitychange', pauseWhenHidden)
    window.addEventListener('blur', releaseOnBlur)

    return () => {
      stopInput()
      document.removeEventListener('visibilitychange', pauseWhenHidden)
      window.removeEventListener('blur', releaseOnBlur)
      bridge.setCallbacks({ onStateChange: () => undefined, onFrame: () => undefined, onBreakpoint: () => undefined })
      bridge.stop()
      bridge.detachCanvas()
      bridgeRef.current = null
      romBufferRef.current = null
    }
  }, [])

  useEffect(() => {
    const bridge = bridgeRef.current
    if (!currentRom || !bridge) {
      setGamepadCount(0)
      return
    }

    let frame: number | null = null
    let alive = true
    let focused = document.hasFocus()
    let lastCount = -1
    let heldByGamepad = new Set<string>()

    const releaseGamepadKeys = () => {
      for (const key of heldByGamepad) releaseInputKey(bridge, heldKeys.current, key, 'gamepad')
      heldByGamepad.clear()
    }
    const syncGamepads = () => {
      if (!focused || document.hidden) {
        releaseGamepadKeys()
        if (lastCount !== 0) {
          lastCount = 0
          setGamepadCount(0)
        }
        return
      }

      let gamepads: ArrayLike<StandardGamepadLike> = []
      try {
        gamepads = navigator.getGamepads?.() ?? []
      } catch {
        gamepads = []
      }
      const next = readStandardGamepads(gamepads)
      for (const key of heldByGamepad) if (!next.keys.has(key)) releaseInputKey(bridge, heldKeys.current, key, 'gamepad')
      for (const key of next.keys) if (!heldByGamepad.has(key)) pressInputKey(bridge, heldKeys.current, key, 'gamepad')
      heldByGamepad = next.keys
      if (lastCount !== next.connectedCount) {
        lastCount = next.connectedCount
        setGamepadCount(next.connectedCount)
      }
    }
    const tick = () => {
      frame = null
      if (!alive) return
      syncGamepads()
      schedule()
    }
    const schedule = () => {
      if (alive && focused && !document.hidden && frame === null) frame = window.requestAnimationFrame(tick)
    }
    const refresh = () => {
      syncGamepads()
      schedule()
    }
    const onBlur = () => {
      focused = false
      syncGamepads()
    }
    const onFocus = () => {
      focused = true
      refresh()
    }
    const onVisibilityChange = () => {
      if (document.hidden && frame !== null) {
        window.cancelAnimationFrame(frame)
        frame = null
      }
      refresh()
    }

    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('gamepadconnected', refresh)
    window.addEventListener('gamepaddisconnected', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    refresh()

    return () => {
      alive = false
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('gamepadconnected', refresh)
      window.removeEventListener('gamepaddisconnected', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseGamepadKeys()
      setGamepadCount(0)
    }
  }, [currentRom?.hash])

  useEffect(() => {
    const syncFullscreen = () => {
      if (document.fullscreenElement) {
        fullscreenFallback.current = false
        setFullscreenMode(document.fullscreenElement === cabinetRef.current ? 'native' : null)
      } else if (!fullscreenFallback.current) {
        setFullscreenMode(null)
      }
    }
    const leaveViewportFullscreen = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && fullscreenFallback.current) {
        fullscreenFallback.current = false
        setFullscreenMode(null)
      }
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    document.addEventListener('keydown', leaveViewportFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen)
      document.removeEventListener('keydown', leaveViewportFullscreen)
    }
  }, [])

  useEffect(() => {
    const active = fullscreenMode === 'viewport'
    document.body.classList.toggle('gba-immersive-active', active)
    return () => document.body.classList.remove('gba-immersive-active')
  }, [fullscreenMode])

  useEffect(() => {
    const urls = Object.fromEntries(saveStates.map((state) => [state.id, URL.createObjectURL(state.thumbnail)]))
    setThumbUrls(urls)
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
  }, [saveStates])

  const refreshSaves = async (hash: string) => {
    try {
      setSaveStates(await listByRom(hash))
    } catch {
      setSaveStates([])
      setMessage('Arcade could not read this browser’s save-state storage. Check browser storage settings and try again.')
    }
  }

  const chooseRom = async (file: File) => {
    const validation = validateGbaFile(file.name, file.size)
    if (validation) {
      setMessage(validation)
      return
    }

    setBusy(true)
    setMessage('Reading the ROM locally…')
    try {
      const data = await readBlobAsArrayBuffer(file)
      const hash = await hashGbaRom(data)
      if (currentRomRef.current && !window.confirm('Switch games? Unsaved progress in the current game will be lost. Save a checkpoint first if you want to resume it later.')) {
        setMessage('Game selection canceled. The current game is still open.')
        return
      }
      const rom = { name: file.name, hash, playedAt: Date.now() }
      const bridge = bridgeRef.current
      if (!bridge) throw new Error('The emulator is still starting. Try choosing the file again.')
      bridge.loadRom(data)
      if (audioEnabled) bridge.enableAudio()
      romBufferRef.current = data
      currentRomRef.current = rom
      setCurrentRom(rom)
      setBridgeState('paused')
      const historySaved = writeRecentGbaRom(rom)
      setRecentRoms(readRecentGbaRoms())
      setMessage(historySaved
        ? `Loaded ${file.name}. Press Start, or choose a local save state to resume.`
        : `Loaded ${file.name}. Browser storage blocked local history, but the game remains playable.`)
      await refreshSaves(hash)
      requestAnimationFrame(() => screenRef.current?.focus())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Arcade could not open that ROM. Check that it is a valid .gba file.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const handleRomChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) void chooseRom(file)
  }

  const handleSaveImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    const rom = currentRomRef.current
    if (!file || !rom) return
    if (file.size > GBA_STATE_FILE_MAX_BYTES) {
      setMessage('That save-state file is larger than 24 MB.')
      return
    }
    setBusy(true)
    try {
      const parsed = parsePortableGbaSave(JSON.parse(await readLocalFileAsText(file)), rom.hash)
      if (!parsed) {
        setMessage('That save file is invalid or belongs to a different ROM. Nothing was changed.')
        return
      }
      if (saveStates.length >= GBA_MAX_SAVE_STATES
        && !window.confirm(`This game already has ${GBA_MAX_SAVE_STATES} save states. Importing another will remove its oldest checkpoint. Continue?`)) {
        setMessage('Save import canceled. Existing checkpoints are unchanged.')
        return
      }
      await saveGbaSnapshot(rom.hash, parsed.snapshot, parsed.thumbnail, parsed.label || 'Imported save')
      await refreshSaves(rom.hash)
      setMessage('Save state imported into this browser. Choose Resume to load it.')
    } catch {
      setMessage('Arcade could not read that save-state file. Nothing was changed.')
    } finally {
      setBusy(false)
    }
  }

  const handleKeyboardDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !screenRef.current?.contains(target)) return
    if (target.closest('button, input, select, textarea, a')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      bridgeRef.current?.pause()
      setMessage('Game paused.')
      return
    }
    const key = normalizedKey(event.key)
    if (!keyboardButtons.has(key)) return
    event.preventDefault()
    if (heldKeys.current.get(key)?.has('keyboard')) return
    const bridge = bridgeRef.current
    if (bridge) pressInputKey(bridge, heldKeys.current, key, 'keyboard')
  }

  const handleKeyboardUp = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = normalizedKey(event.key)
    const bridge = bridgeRef.current
    if (bridge) releaseInputKey(bridge, heldKeys.current, key, 'keyboard')
  }

  const pressTouchButton = (event: PointerEvent<HTMLButtonElement>, key: string) => {
    event.preventDefault()
    const bridge = bridgeRef.current
    if (bridge) pressInputKey(bridge, heldKeys.current, key, 'touch')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleControlKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    const bridge = bridgeRef.current
    if (bridge) pressInputKey(bridge, heldKeys.current, key, 'touch')
  }

  const handleControlKeyUp = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    releaseTouchButton(key)
  }

  const releaseTouchButton = (key: string) => {
    const normalized = normalizedKey(key)
    const bridge = bridgeRef.current
    if (bridge) releaseInputKey(bridge, heldKeys.current, normalized, 'touch')
  }

  const toggleFullscreen = async () => {
    const cabinet = cabinetRef.current
    if (!cabinet) return
    if (document.fullscreenElement === cabinet) {
      await document.exitFullscreen().catch(() => undefined)
      return
    }
    if (fullscreenFallback.current) {
      fullscreenFallback.current = false
      setFullscreenMode(null)
      return
    }
    if (document.fullscreenEnabled && typeof cabinet.requestFullscreen === 'function') {
      try {
        await cabinet.requestFullscreen()
        setFullscreenMode('native')
        return
      } catch {
        // iOS Safari and embedded browsers can reject element fullscreen. Use the viewport layout below.
      }
    }
    fullscreenFallback.current = true
    setFullscreenMode('viewport')
    setMessage('Expanded to the available screen. iOS Safari keeps its browser controls visible.')
  }

  const toggleRun = () => {
    const bridge = bridgeRef.current
    if (!bridge || !currentRomRef.current) return
    if (bridge.state === 'running') bridge.pause()
    else {
      bridge.run()
      setMessage('Game running. Escape pauses; arrows, Z/X, A/S, Enter and Backspace control the cabinet.')
    }
  }

  const restart = () => {
    const bridge = bridgeRef.current
    const rom = romBufferRef.current
    if (!bridge || !rom) return
    if (!window.confirm('Restart this game from the beginning? Unsaved progress in memory will be lost.')) return
    bridge.loadRom(rom.slice(0))
    if (audioEnabled) bridge.enableAudio()
    bridge.run()
    setMessage('Game restarted.')
  }

  const createSave = async () => {
    const bridge = bridgeRef.current
    const rom = currentRomRef.current
    if (!bridge || !rom) return
    if (saveStates.length >= GBA_MAX_SAVE_STATES
      && !window.confirm(`This game already has ${GBA_MAX_SAVE_STATES} save states. Creating another will remove its oldest checkpoint. Continue?`)) {
      setMessage('Save canceled. Existing checkpoints are unchanged.')
      return
    }
    setBusy(true)
    try {
      const { snapshot, thumbnail } = await bridge.saveState()
      const label = `Save ${new Date().toLocaleString()}`.slice(0, 40)
      await saveGbaSnapshot(rom.hash, snapshot, thumbnail, label)
      await refreshSaves(rom.hash)
      setMessage(bridge.state === 'paused' ? `Saved ${label} in this browser. The game is paused.` : `Saved ${label} in this browser.`)
    } catch {
      setMessage('Arcade could not save this state. Browser storage may be full or unavailable.')
    } finally {
      setBusy(false)
    }
  }

  const resumeSave = async (id: number) => {
    const bridge = bridgeRef.current
    if (!bridge || !currentRomRef.current) return
    setBusy(true)
    try {
      const record = await loadGbaState(id)
      if (!record || record.romHash !== currentRomRef.current.hash) {
        setMessage('That save is no longer available for this ROM.')
        await refreshSaves(currentRomRef.current.hash)
        return
      }
      bridge.loadState(record.snapshot)
      bridge.run()
      setMessage(`Resumed ${record.label}.`)
      requestAnimationFrame(() => screenRef.current?.focus())
    } catch {
      setMessage('Arcade could not load this save state. The current game was left as it was.')
    } finally {
      setBusy(false)
    }
  }

  const exportSave = async (state: SaveStateMeta) => {
    if (!currentRomRef.current) return
    setBusy(true)
    try {
      const record = await loadGbaState(state.id)
      if (!record || record.romHash !== currentRomRef.current.hash) throw new Error('Save state no longer available.')
      const portable = await createPortableGbaSave(record.romHash, record.label, record.snapshot, record.thumbnail)
      const safeName = currentRomRef.current.name.replace(/\.gba$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '-') || 'game'
      downloadFile(`arcade-${safeName}-save.json`, new Blob([JSON.stringify(portable)], { type: 'application/json' }))
      setMessage('Portable save-state file downloaded to this device.')
    } catch {
      setMessage('Arcade could not export this save state.')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async (id: number) => {
    if (!currentRomRef.current) return
    setBusy(true)
    try {
      await removeGbaSave(id)
      await refreshSaves(currentRomRef.current.hash)
      setMessage('Save state deleted from this browser.')
    } catch {
      setMessage('Arcade could not delete that save state.')
    } finally {
      setDeletePending(null)
      setBusy(false)
    }
  }

  const commitRename = async (id: number) => {
    if (!currentRomRef.current) return
    setBusy(true)
    try {
      await renameGbaSave(id, renameValue)
      await refreshSaves(currentRomRef.current.hash)
      setRenamePending(null)
      setMessage('Save state renamed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Arcade could not rename that save state.')
    } finally {
      setBusy(false)
    }
  }

  const toggleAudio = () => {
    const bridge = bridgeRef.current
    if (!bridge) return
    try {
      if (bridge.audioEnabled) bridge.disableAudio()
      else bridge.enableAudio()
      setAudioEnabled(bridge.audioEnabled)
    } catch {
      setMessage('This browser could not enable audio. The game remains playable without sound.')
    }
  }

  const leaveCabinet = () => {
    if (currentRomRef.current && !window.confirm('Leave this game? Unsaved progress in memory will be lost. Choose Save state first if you want to resume later.')) return
    onBack()
  }

  return (
    <section className="gba-view" aria-labelledby="gba-title">
      <button className="back-link" type="button" onClick={leaveCabinet} disabled={busy}><span aria-hidden="true">←</span> All games</button>
      <div className="gba-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> PLAY FROM YOUR DEVICE</p>
          <h1 id="gba-title">Game Boy Advance<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="gba-lede">Open a game you own and play it in your browser. ROM files stay on your device and are never uploaded.</p>
        </div>
        <label className="gba-open-button">
          <span>{busy ? 'Working…' : currentRom ? 'Choose another ROM' : 'Choose a .gba file'}</span>
          <input ref={fileInput} type="file" accept=".gba,application/octet-stream" onChange={handleRomChange} disabled={busy} />
        </label>
      </div>

      <p className="gba-legal-note">Use only games you have the right to use. Arcade does not provide games, ROM downloads, or BIOS files. The emulator and all saves run locally in this browser.</p>
      <p className="gba-emulator-credit">Emulator: GBA Kit 0.9.0 under the MIT license. <a href="/licenses/gba-kit-MIT.txt" target="_blank" rel="noreferrer">Read the license</a>.</p>

      <div className="gba-layout">
        <div ref={cabinetRef} className={`gba-cabinet${fullscreenMode === 'viewport' ? ' is-immersive' : ''}`}>
          <div className="gba-cabinet-heading">
            <span>ARCADE / GBA</span>
            <span className="gba-gamepad-status" role="status" aria-live="polite">{gamepadCount ? `${gamepadCount} PAD${gamepadCount === 1 ? '' : 'S'} READY` : 'NO PAD'}</span>
            <span className={`gba-status gba-status-${bridgeState}`}>{bridgeState === 'running' ? 'RUNNING' : bridgeState === 'paused' ? 'PAUSED' : 'NO GAME'}</span>
          </div>
          <div className="gba-bezel">
            <div ref={screenRef} className="gba-screen-stage" tabIndex={0} onKeyDown={handleKeyboardDown} onKeyUp={handleKeyboardUp} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                const bridge = bridgeRef.current
                if (bridge) releaseInputSource(bridge, heldKeys.current, 'keyboard')
              }
            }}>
              <canvas ref={canvasRef} className="gba-screen" aria-label={currentRom ? `Game screen for ${currentRom.name}` : 'Game Boy Advance screen. Choose a ROM to play.'} onPointerDown={() => screenRef.current?.focus()} />
              {!currentRom && <div className="gba-screen-empty"><span>INSERT YOUR GAME</span><small>Choose a .gba file from this device</small></div>}
            </div>
          </div>
          <div className="gba-controls" aria-label="Game Boy Advance controls">
            <div className="gba-dpad" aria-label="Direction controls">
              <button type="button" aria-label="Up" className="gba-dpad-up" onPointerDown={(event) => pressTouchButton(event, 'ArrowUp')} onPointerUp={() => releaseTouchButton('ArrowUp')} onPointerCancel={() => releaseTouchButton('ArrowUp')} onLostPointerCapture={() => releaseTouchButton('ArrowUp')} onKeyDown={(event) => handleControlKeyDown(event, 'ArrowUp')} onKeyUp={(event) => handleControlKeyUp(event, 'ArrowUp')}>↑</button>
              <button type="button" aria-label="Left" className="gba-dpad-left" onPointerDown={(event) => pressTouchButton(event, 'ArrowLeft')} onPointerUp={() => releaseTouchButton('ArrowLeft')} onPointerCancel={() => releaseTouchButton('ArrowLeft')} onLostPointerCapture={() => releaseTouchButton('ArrowLeft')} onKeyDown={(event) => handleControlKeyDown(event, 'ArrowLeft')} onKeyUp={(event) => handleControlKeyUp(event, 'ArrowLeft')}>←</button>
              <span className="gba-dpad-center" aria-hidden="true" />
              <button type="button" aria-label="Right" className="gba-dpad-right" onPointerDown={(event) => pressTouchButton(event, 'ArrowRight')} onPointerUp={() => releaseTouchButton('ArrowRight')} onPointerCancel={() => releaseTouchButton('ArrowRight')} onLostPointerCapture={() => releaseTouchButton('ArrowRight')} onKeyDown={(event) => handleControlKeyDown(event, 'ArrowRight')} onKeyUp={(event) => handleControlKeyUp(event, 'ArrowRight')}>→</button>
              <button type="button" aria-label="Down" className="gba-dpad-down" onPointerDown={(event) => pressTouchButton(event, 'ArrowDown')} onPointerUp={() => releaseTouchButton('ArrowDown')} onPointerCancel={() => releaseTouchButton('ArrowDown')} onLostPointerCapture={() => releaseTouchButton('ArrowDown')} onKeyDown={(event) => handleControlKeyDown(event, 'ArrowDown')} onKeyUp={(event) => handleControlKeyUp(event, 'ArrowDown')}>↓</button>
            </div>
            <div className="gba-face-buttons">
              {touchButtons.slice(0, 2).map((button) => <button key={button.key} type="button" className={button.className} onPointerDown={(event) => pressTouchButton(event, button.key)} onPointerUp={() => releaseTouchButton(button.key)} onPointerCancel={() => releaseTouchButton(button.key)} onLostPointerCapture={() => releaseTouchButton(button.key)} onKeyDown={(event) => handleControlKeyDown(event, button.key)} onKeyUp={(event) => handleControlKeyUp(event, button.key)}>{button.label}</button>)}
            </div>
            <div className="gba-shoulder-buttons">
              {touchButtons.slice(2, 4).map((button) => <button key={button.key} type="button" className={button.className} onPointerDown={(event) => pressTouchButton(event, button.key)} onPointerUp={() => releaseTouchButton(button.key)} onPointerCancel={() => releaseTouchButton(button.key)} onLostPointerCapture={() => releaseTouchButton(button.key)} onKeyDown={(event) => handleControlKeyDown(event, button.key)} onKeyUp={(event) => handleControlKeyUp(event, button.key)}>{button.label}</button>)}
            </div>
            <div className="gba-system-buttons">
              {touchButtons.slice(4).map((button) => <button key={button.key} type="button" className={button.className} onPointerDown={(event) => pressTouchButton(event, button.key)} onPointerUp={() => releaseTouchButton(button.key)} onPointerCancel={() => releaseTouchButton(button.key)} onLostPointerCapture={() => releaseTouchButton(button.key)} onKeyDown={(event) => handleControlKeyDown(event, button.key)} onKeyUp={(event) => handleControlKeyUp(event, button.key)}>{button.label}</button>)}
            </div>
          </div>
          <p className="gba-key-hint">Keyboard: arrows · Z A · X B · A R · S L · Enter Start · Backspace Select · Standard controller: D-pad / stick · A/B · L/R · Start/Select</p>
          <div className="gba-actions">
            <button className="button button-primary" type="button" onClick={toggleRun} disabled={!currentRom}>{bridgeState === 'running' ? 'Pause game' : 'Start / resume'}<span aria-hidden="true">{bridgeState === 'running' ? 'Ⅱ' : '▶'}</span></button>
            <button className="button button-quiet" type="button" onClick={() => void toggleFullscreen()} disabled={!currentRom} aria-pressed={fullscreenMode !== null}>{fullscreenMode ? 'Exit fullscreen' : 'Fullscreen'}</button>
            <button className="button button-quiet" type="button" onClick={restart} disabled={!currentRom}>Restart</button>
            <button className="button button-quiet" type="button" onClick={toggleAudio} disabled={!currentRom} aria-pressed={audioEnabled}>{audioEnabled ? 'Sound on' : 'Sound off'}</button>
            <button className="button button-quiet" type="button" onClick={() => void createSave()} disabled={!currentRom || busy}>Save state</button>
          </div>
          <p className="gba-message" role="status" aria-live="polite">{message}</p>
        </div>

        <aside className="gba-save-panel" aria-labelledby="gba-saves-title">
          <div className="gba-panel-heading"><div><p className="eyebrow">ON THIS BROWSER</p><h2 id="gba-saves-title">Save states</h2></div><span>{currentRom ? saveStates.length : '—'}</span></div>
          {currentRom ? <>
            <p className="gba-rom-current">{currentRom.name}</p>
            <div className="gba-save-tools"><button type="button" className="button button-quiet" onClick={() => saveInput.current?.click()} disabled={busy}>Import save</button><input ref={saveInput} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void handleSaveImport(event)} /></div>
            {saveStates.length === 0 ? <p className="gba-empty-saves">No save states for this game yet. Start a game, then choose Save state.</p> : <ul className="gba-save-list">
              {saveStates.map((state) => <li className="gba-save-item" key={state.id}>
                {thumbUrls[state.id] && <img className="gba-save-thumb" src={thumbUrls[state.id]} alt={`Preview for ${state.label}`} />}
                <div className="gba-save-copy">
                  {renamePending === state.id ? <form onSubmit={(event) => { event.preventDefault(); void commitRename(state.id) }} className="gba-rename-form"><label className="sr-only" htmlFor={`gba-save-name-${state.id}`}>Save state name</label><input id={`gba-save-name-${state.id}`} value={renameValue} maxLength={40} onChange={(event) => setRenameValue(event.currentTarget.value)} autoFocus /><button type="submit" disabled={busy}>Save</button><button type="button" onClick={() => setRenamePending(null)}>Cancel</button></form> : <><strong>{state.label}</strong><time dateTime={new Date(state.timestamp).toISOString()}>{formatDate(state.timestamp)}</time></>}
                  {deletePending === state.id ? <div className="gba-save-confirm"><span>Delete this state?</span><button type="button" onClick={() => void confirmDelete(state.id)} disabled={busy}>Delete</button><button type="button" onClick={() => setDeletePending(null)}>Keep</button></div> : <div className="gba-save-actions"><button type="button" onClick={() => void resumeSave(state.id)} disabled={busy}>Resume</button><button type="button" onClick={() => void exportSave(state)} disabled={busy}>Export</button><button type="button" onClick={() => { setRenamePending(state.id); setRenameValue(state.label) }} disabled={busy}>Rename</button><button type="button" onClick={() => setDeletePending(state.id)} disabled={busy}>Delete</button></div>}
                </div>
              </li>)}
            </ul>}
          </> : <p className="gba-empty-saves">Choose a .gba file again to find its local save states. Arcade never stores your ROM.</p>}
          <p className="gba-storage-note">Up to {GBA_MAX_SAVE_STATES} save states per game stay in this browser’s storage. At the limit, Arcade confirms before removing the oldest checkpoint. States do not sync. Export one to move it to another device; import it with the same ROM file.</p>

          <div className="gba-recent-list">
            <div className="gba-recent-heading"><h3>Recently played</h3>{recentRoms.length > 0 && <button type="button" onClick={() => setConfirmClearHistory(true)}>Clear history</button>}</div>
            {confirmClearHistory && <div className="gba-save-confirm gba-history-confirm"><span>Clear ROM names and last-played times? Save states stay in this browser.</span><button type="button" onClick={() => { const cleared = clearRecentGbaRoms(); if (cleared) { setRecentRoms([]); setMessage('Local game history cleared. Save states are unchanged.') } else setMessage('Browser storage blocked clearing local game history.'); setConfirmClearHistory(false) }}>Clear</button><button type="button" onClick={() => setConfirmClearHistory(false)}>Keep</button></div>}
            {recentRoms.length === 0 ? <p>No local game history yet.</p> : <ul>{recentRoms.map((rom) => <li key={rom.hash}><span><strong>{rom.name}</strong><small>{formatDate(rom.playedAt)}</small></span>{rom.hash === currentRom?.hash ? <span className="gba-current-tag">OPEN</span> : <span className="gba-local-tag">LOCAL FILE</span>}</li>)}</ul>}
            <small>History stores only the file name, a SHA-256 fingerprint, and the last-played time.</small>
          </div>
        </aside>
      </div>
    </section>
  )
}
