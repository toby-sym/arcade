import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  createFathomState,
  FATHOM_BOARD_SIZE,
  FATHOM_CELL_COUNT,
  fireFathomShot,
  formatFathomCoordinate,
  getSunkShipIndices,
  newFathomFleet,
  pauseFathom,
  restartFathom,
  resumeFathom,
  scanFathom,
  startFathom,
} from './fathom'

export function FathomGame({
  onBack,
  bestShots,
  onRecordShots,
  reduceMotion,
}: {
  onBack: () => void
  bestShots: number | null
  onRecordShots: (shots: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createFathomState)
  const [selectedCell, setSelectedCell] = useState(0)
  const [scanMode, setScanMode] = useState(false)
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])
  const recordedRun = useRef(false)
  const playSound = useArcadeSound()
  const sunkShips = getSunkShipIndices(state.fleet, state.shots)
  const shotsByCell = new Map(state.shots.map((shot) => [shot.cell, shot]))
  const phaseLabel = state.phase === 'ready' ? 'FLEET HIDDEN'
    : state.phase === 'playing' ? 'SONAR LIVE'
      : state.phase === 'paused' ? 'PAUSED' : 'FLEET CLEARED'

  useEffect(() => {
    if (state.phase !== 'won' || recordedRun.current) return
    recordedRun.current = true
    onRecordShots(state.shots.length)
    playSound('win')
  }, [onRecordShots, playSound, state.phase, state.shots.length])

  function focusSelectedCell() {
    window.requestAnimationFrame(() => cellRefs.current[selectedCell]?.focus())
  }

  function start() {
    recordedRun.current = false
    setState((current) => startFathom(current))
    focusSelectedCell()
  }

  function restart() {
    recordedRun.current = false
    setState((current) => restartFathom(current))
    setSelectedCell(0)
    setScanMode(false)
    window.requestAnimationFrame(() => cellRefs.current[0]?.focus())
  }

  function newFleet() {
    recordedRun.current = false
    setState((current) => newFathomFleet(current))
    setSelectedCell(0)
    setScanMode(false)
    window.requestAnimationFrame(() => cellRefs.current[0]?.focus())
  }

  function togglePause() {
    setState((current) => current.phase === 'paused' ? resumeFathom(current) : pauseFathom(current))
    focusSelectedCell()
  }

  function selectCell(cell: number) {
    setSelectedCell(cell)
    if (state.phase !== 'playing') return
    if (scanMode) {
      const next = scanFathom(state, cell)
      if (next !== state) {
        setState(next)
        setScanMode(false)
        playSound('score')
      }
      return
    }
    const next = fireFathomShot(state, cell)
    if (next !== state) {
      setState(next)
      if (next.phase !== 'won' && next.shots.length > state.shots.length) playSound(next.shots.at(-1)?.result === 'hit' ? 'hit' : 'miss')
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.repeat) return
    if (event.key === 'Escape' && (state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'r') {
      event.preventDefault()
      restart()
      return
    }
    if (key === 'n') {
      event.preventDefault()
      newFleet()
      return
    }
    if (event.target instanceof HTMLButtonElement && !event.target.classList.contains('fathom-cell')) return
    if (state.phase !== 'playing') return
    if (key === 's' && state.scansRemaining > 0) {
      event.preventDefault()
      setScanMode((current) => !current)
      return
    }
    const row = Math.floor(selectedCell / FATHOM_BOARD_SIZE)
    const column = selectedCell % FATHOM_BOARD_SIZE
    const nextCell = key === 'arrowup' ? Math.max(0, row - 1) * FATHOM_BOARD_SIZE + column
      : key === 'arrowdown' ? Math.min(FATHOM_BOARD_SIZE - 1, row + 1) * FATHOM_BOARD_SIZE + column
        : key === 'arrowleft' ? row * FATHOM_BOARD_SIZE + Math.max(0, column - 1)
          : key === 'arrowright' ? row * FATHOM_BOARD_SIZE + Math.min(FATHOM_BOARD_SIZE - 1, column + 1) : null
    if (nextCell !== null) {
      event.preventDefault()
      setSelectedCell(nextCell)
      cellRefs.current[nextCell]?.focus()
      return
    }
    if ((key === 'enter' || key === ' ') && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault()
      selectCell(selectedCell)
    }
  }

  const scanAtCell = new Map(state.scans.map((scan) => [scan.center, scan.echoes]))
  const description = state.phase === 'won'
    ? `All four ships found in ${state.shots.length} shots.`
    : state.phase === 'paused'
      ? 'The search is paused.'
      : `${state.shots.length} shots fired. ${state.fleet.length - sunkShips.length} of ${state.fleet.length} ships remain. ${state.scansRemaining} sonar sweeps remain.`

  return (
    <section className={`snake-view fathom-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="fathom-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout fathom-layout">
        <div className="snake-copy fathom-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="fathom-title">Fathom<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">A quiet patch of sea. A hidden fleet. Trust the echoes.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Mark ocean squares to locate all four hidden ships. Each hull section takes one hit. Use up to three sonar sweeps; each reports the hidden hull sections in a nearby three-by-three patch.</p>
            <p>Click or tap a square to fire. Use <strong>Arrow keys</strong> to move across the grid and <strong>Enter</strong> to fire. Press <strong>S</strong> or select <strong>Sonar sweep</strong>, then choose a square to scan. <strong>Escape</strong> pauses, <strong>R</strong> replays this fleet, and <strong>N</strong> lays a new one.</p>
          </div>
          <div className="score-card fathom-score" aria-label={`${state.shots.length} shots fired. ${state.fleet.length - sunkShips.length} ships remain. ${state.scansRemaining} sonar sweeps remain. ${bestShots === null ? 'No local best yet.' : `Local fewest shots ${bestShots}.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">SHOTS FIRED</span>
              <strong className="score-value">{String(state.shots.length).padStart(2, '0')}</strong>
              <span className="score-unit">{state.fleet.length - sunkShips.length} ships remain</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FEWEST IN THIS BROWSER</span>
              <strong>{bestShots === null ? '—' : String(bestShots).padStart(2, '0')}</strong>
              <span className="score-unit">shots to clear</span>
            </div>
          </div>
          <p className="fathom-local-note">Your fewest shots stay saved in this browser and do not sync.</p>
        </div>

        <div className="play-column fathom-play-column">
          <div className={`fathom-console phase-${state.phase}${scanMode ? ' is-scanning' : ''}`}>
            <div className="frame-topline"><span>FIELD 46</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="fathom-roundline">
              <div><span>OPEN WATER / 08 × 08</span><strong>{scanMode ? 'Choose a sonar centre' : 'Plot a coordinate'}</strong></div>
              <b>{state.scansRemaining}<small> SWEEPS</small></b>
            </div>
            <div className="fathom-instruments" aria-label="Fleet status">
              {state.fleet.map((ship, index) => (
                <span key={ship.name} className={sunkShips.includes(index) ? 'is-sunk' : ''} aria-label={`${ship.name}: ${sunkShips.includes(index) ? 'sunk' : 'still hidden'}`}>
                  <i />{ship.name}
                </span>
              ))}
            </div>
            <div className="fathom-board-frame">
              <div className="fathom-compass" aria-hidden="true"><span>N</span><i /></div>
              <div
                className="fathom-board"
                role="group"
                aria-label="Fathom ocean grid, eight rows by eight columns. Use arrow keys to choose a square and Enter to fire. Press S to enter sonar mode."
                aria-describedby="fathom-grid-help"
              >
                <div className="fathom-coordinates fathom-column-coordinates" aria-hidden="true">
                  {Array.from({ length: FATHOM_BOARD_SIZE }, (_, column) => <span key={column}>{String.fromCharCode(65 + column)}</span>)}
                </div>
                <div className="fathom-grid-main">
                  <div className="fathom-coordinates fathom-row-coordinates" aria-hidden="true">
                    {Array.from({ length: FATHOM_BOARD_SIZE }, (_, row) => <span key={row}>{row + 1}</span>)}
                  </div>
                  <div className="fathom-cells" role="group" aria-label="Ocean coordinates">
                    {Array.from({ length: FATHOM_CELL_COUNT }, (_, cell) => {
                      const shot = shotsByCell.get(cell)
                      const shipIndex = state.fleet.findIndex((ship) => ship.cells.includes(cell))
                      const isSunk = shipIndex >= 0 && sunkShips.includes(shipIndex)
                      const scanEchoes = scanAtCell.get(cell)
                      const insideScan = state.scans.some((scan) => Math.abs(Math.floor(scan.center / FATHOM_BOARD_SIZE) - Math.floor(cell / FATHOM_BOARD_SIZE)) <= 1 && Math.abs(scan.center % FATHOM_BOARD_SIZE - cell % FATHOM_BOARD_SIZE) <= 1)
                      const coordinate = formatFathomCoordinate(cell)
                      const status = shot ? `${isSunk ? 'sunk ship hit' : shot.result}` : insideScan ? 'within sonar sweep' : 'uncharted water'
                      const ariaLabel = `${coordinate}, ${status}${scanEchoes === undefined ? '' : `, sonar: ${scanEchoes} hidden ${scanEchoes === 1 ? 'section' : 'sections'}`}`
                      return (
                        <button
                          className={`fathom-cell${shot?.result === 'hit' ? ' is-hit' : ''}${shot?.result === 'miss' ? ' is-miss' : ''}${isSunk ? ' is-sunk' : ''}${insideScan ? ' in-sonar' : ''}${selectedCell === cell ? ' is-selected' : ''}`}
                          key={cell}
                          ref={(element) => { cellRefs.current[cell] = element }}
                          type="button"
                          aria-label={ariaLabel}
                          tabIndex={selectedCell === cell ? 0 : -1}
                          disabled={state.phase !== 'playing' || Boolean(shot && !scanMode) || (scanMode && state.scansRemaining === 0)}
                          onFocus={() => setSelectedCell(cell)}
                          onClick={() => selectCell(cell)}
                        >
                          {shot?.result === 'hit' ? <i className="fathom-hit-mark">{isSunk ? '×' : '•'}</i>
                            : shot?.result === 'miss' ? <i className="fathom-miss-mark" />
                              : scanEchoes !== undefined ? <b className="fathom-echo-count">{scanEchoes}</b> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              {state.phase !== 'playing' && (
                <div className="fathom-overlay">
                  <div>
                    <span>{state.phase === 'ready' ? 'FLEET HIDDEN' : state.phase === 'paused' ? 'SONAR PAUSED' : 'ALL VESSELS DOWN'}</span>
                    <strong>{state.phase === 'ready' ? 'Read the water.' : state.phase === 'paused' ? 'Hold your bearing.' : 'Clear horizon.'}</strong>
                    <p>{state.phase === 'ready' ? 'Find every hull. A sweep can narrow the search.' : state.phase === 'paused' ? 'Resume the hunt when you are ready.' : `Fleet found in ${state.shots.length} shots.`}</p>
                  </div>
                </div>
              )}
            </div>
            <p className={`fathom-status${scanMode ? ' is-scanning' : ''}`} role="status" aria-live="polite">{state.message}</p>
            <p id="fathom-grid-help" className="fathom-grid-help">{description}</p>
            <div className="fathom-actions">
              <button className={`fathom-action${scanMode ? ' fathom-action-primary is-active' : ''}`} type="button" disabled={state.phase !== 'playing' || state.scansRemaining === 0} aria-pressed={scanMode} onClick={() => setScanMode((current) => !current)}>
                {scanMode ? 'Cancel sonar' : 'Sonar sweep'} <kbd>S</kbd>
              </button>
              {state.phase === 'ready' ? <button className="fathom-action fathom-action-primary" type="button" onClick={start}>Begin search <kbd>ENTER</kbd></button>
                : state.phase === 'won' ? <button className="fathom-action fathom-action-primary" type="button" onClick={newFleet}>New fleet <kbd>N</kbd></button>
                  : <button className="fathom-action fathom-action-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume search' : 'Pause'} <kbd>ESC</kbd></button>}
              <button className="fathom-action" type="button" onClick={restart}>Restart fleet <kbd>R</kbd></button>
            </div>
            <div className="fathom-legend" aria-label="Chart legend">
              <span><i className="legend-hit" />HIT</span><span><i className="legend-miss" />CLEAR</span><span><i className="legend-scan" />SONAR</span>
            </div>
          </div>
          <p className="fathom-footnote">Each ship stays hidden until sunk. The fleet changes on a new search; replays keep the same waters.</p>
        </div>
      </div>
    </section>
  )
}
