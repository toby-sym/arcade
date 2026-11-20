import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  BEAMWORKS_BOARD_SIZE,
  BEAMWORKS_PUZZLES,
  beamworksColumn,
  beamworksRow,
  createBeamworksState,
  pauseBeamworks,
  restartBeamworks,
  resumeBeamworks,
  rotateBeamworksMirror,
  startBeamworks,
  traceBeam,
  undoBeamworks,
} from './beamworks'

export function BeamworksGame({
  onBack,
  bestTurns,
  onRecordTurns,
  reduceMotion,
}: {
  onBack: () => void
  bestTurns: number | null
  onRecordTurns: (turns: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createBeamworksState)
  const boardRef = useRef<HTMLDivElement>(null)
  const lastRecordedTurns = useRef<number | null>(null)
  const playSound = useArcadeSound()
  const puzzle = BEAMWORKS_PUZZLES[state.stageIndex]!
  const beam = traceBeam(puzzle, state.mirrors)

  useEffect(() => {
    if (state.phase !== 'complete' || lastRecordedTurns.current === state.turns) return
    lastRecordedTurns.current = state.turns
    onRecordTurns(state.turns)
    playSound('win')
  }, [onRecordTurns, playSound, state.phase, state.turns])

  function focusBoard() {
    window.requestAnimationFrame(() => boardRef.current?.focus())
  }

  function start() {
    lastRecordedTurns.current = null
    setState(startBeamworks(state))
    focusBoard()
  }

  function restart() {
    lastRecordedTurns.current = null
    setState(restartBeamworks(state))
    focusBoard()
  }

  function rotate(index: number) {
    const next = rotateBeamworksMirror(state, index)
    if (next === state) return
    setState(next)
    playSound(next.stageIndex > state.stageIndex ? 'score' : 'hit')
  }

  function togglePause() {
    setState((current) => current.phase === 'paused' ? resumeBeamworks(current) : pauseBeamworks(current))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && (state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    if (event.repeat) return
    const key = event.key.toLowerCase()
    if (key === 'r') {
      event.preventDefault()
      restart()
      return
    }
    if (key === 'z' || key === 'backspace') {
      event.preventDefault()
      setState((current) => undoBeamworks(current))
      return
    }
    const index = Number(event.key) - 1
    if (Number.isInteger(index) && index >= 0 && index < state.mirrors.length) {
      event.preventDefault()
      rotate(index)
    }
  }

  const phaseLabel = state.phase === 'ready' ? 'STANDBY'
    : state.phase === 'playing' ? 'CIRCUIT LIVE'
      : state.phase === 'paused' ? 'PAUSED' : 'ROUTE CLEAR'
  const description = state.phase === 'complete'
    ? `All four receivers lit in ${state.turns} mirror turns.`
    : state.phase === 'paused'
      ? 'The circuit is paused.'
      : `${puzzle.title}, circuit ${state.stageIndex + 1} of ${BEAMWORKS_PUZZLES.length}. The beam ${beam.reachedReceiver ? 'reaches the receiver.' : `currently travels ${beam.lastDirection}.`}`
  const linePoints = beam.cells.map((index) => `${beamworksColumn(index) * 64 + 32},${beamworksRow(index) * 64 + 32}`).join(' ')

  return (
    <section className={`snake-view beamworks-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="beamworks-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout beamworks-layout">
        <div className="snake-copy beamworks-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="beamworks-title">Beamworks<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Turn the mirrors. Find the line. Light the receiver.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>The beam leaves the source and travels in a straight line until a mirror bends it. Rotate each mirror once to switch its diagonal, then route the light into the receiver. Clear four original circuits.</p>
            <p>Tap a mirror or press <strong>1–4</strong> in order. <strong>Z</strong> undoes one turn, <strong>Escape</strong> pauses, and <strong>R</strong> restarts the route.</p>
          </div>
          <div className="score-card beamworks-score" aria-label={`Total mirror turns ${state.turns}. Circuit ${state.stageIndex + 1} of ${BEAMWORKS_PUZZLES.length}. ${bestTurns === null ? 'No local best yet.' : `Local best ${bestTurns} turns.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">MIRROR TURNS</span>
              <strong className="score-value">{String(state.turns).padStart(2, '0')}</strong>
              <span className="score-unit">{state.stageTurns} in this circuit</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong>{bestTurns === null ? '—' : String(bestTurns).padStart(2, '0')}</strong>
              <span className="score-unit">turns</span>
            </div>
          </div>
          <p className="beamworks-local-note">Your fewest mirror turns across four circuits stays in this browser and does not sync.</p>
        </div>

        <div className="play-column beamworks-play-column">
          <div className={`beamworks-console phase-${state.phase}`}>
            <div className="frame-topline"><span>FIELD 41</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="beamworks-roundline">
              <div><span>CIRCUIT {String(state.stageIndex + 1).padStart(2, '0')} / 04</span><strong>{puzzle.title}</strong></div>
              <b>{state.turns}<small> TURNS</small></b>
            </div>
            <div className="beamworks-progress" aria-label={`${state.completedStageTurns.length} of ${BEAMWORKS_PUZZLES.length} circuits cleared`}>
              {BEAMWORKS_PUZZLES.map((item, index) => <span key={item.title} className={index < state.completedStageTurns.length ? 'is-clear' : index === state.stageIndex ? 'is-current' : ''} />)}
            </div>

            <div
              className="beamworks-board-frame"
              ref={boardRef}
              role="group"
              tabIndex={0}
              aria-label="Beamworks circuit. Use 1 to 4 to rotate a mirror, Z to undo, Escape to pause, and R to restart."
            >
              <svg className="beamworks-board" viewBox={`0 0 ${BEAMWORKS_BOARD_SIZE * 64} ${BEAMWORKS_BOARD_SIZE * 64}`} role="img" aria-label={`${puzzle.title} beam path. ${beam.reachedReceiver ? 'Receiver lit.' : 'Receiver is dark.'}`}>
                <defs>
                  <linearGradient id="beamworks-beam" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f9ffb4" /><stop offset=".5" stopColor="#d8ff70" /><stop offset="1" stopColor="#72e0eb" /></linearGradient>
                  <radialGradient id="beamworks-receiver"><stop stopColor="#fff7dc" /><stop offset=".5" stopColor="#d8ff70" /><stop offset="1" stopColor="#7cae4e" /></radialGradient>
                </defs>
                {Array.from({ length: BEAMWORKS_BOARD_SIZE ** 2 }, (_, index) => {
                  const row = beamworksRow(index)
                  const column = beamworksColumn(index)
                  const x = column * 64
                  const y = row * 64
                  const blocker = puzzle.blockers.includes(index)
                  const mirrorIndex = state.mirrors.findIndex((mirror) => mirror.cell === index)
                  const mirror = mirrorIndex >= 0 ? state.mirrors[mirrorIndex] : null
                  return (
                    <g key={index}>
                      <rect className="beamworks-cell" x={x + 1} y={y + 1} width="62" height="62" rx="4" />
                      {blocker && <g className="beamworks-blocker"><rect x={x + 7} y={y + 7} width="50" height="50" rx="5" /><path d={`M${x + 19} ${y + 19}l26 26M${x + 45} ${y + 19}l-26 26`} /></g>}
                      {mirror && <g className={`beamworks-mirror ${mirror.angle === 'slash' ? 'is-slash' : 'is-backslash'}`}>
                        <rect x={x + 7} y={y + 7} width="50" height="50" rx="7" />
                        <path d={mirror.angle === 'slash' ? `M${x + 18} ${y + 46}L${x + 46} ${y + 18}` : `M${x + 18} ${y + 18}L${x + 46} ${y + 46}`} />
                        <circle cx={x + 32} cy={y + 32} r="4" />
                        <text x={x + 32} y={y + 58} textAnchor="middle">{mirrorIndex + 1}</text>
                      </g>}
                    </g>
                  )
                })}
                <polyline className={`beamworks-ray${beam.reachedReceiver ? ' is-connected' : ''}`} points={linePoints} />
                <g className="beamworks-source">
                  <circle cx={beamworksColumn(puzzle.source.cell) * 64 + 32} cy={beamworksRow(puzzle.source.cell) * 64 + 32} r="22" />
                  <path d={puzzle.source.direction === 'right' ? 'M20 0h20m-7-7 7 7-7 7' : puzzle.source.direction === 'left' ? 'M44 0H24m7-7-7 7 7 7' : puzzle.source.direction === 'up' ? 'M0 44V24m-7 7 7-7 7 7' : 'M0 20v20m-7-7 7 7 7-7'} transform={`translate(${beamworksColumn(puzzle.source.cell) * 64 + 32} ${beamworksRow(puzzle.source.cell) * 64 + 32})`} />
                </g>
                <g className={`beamworks-receiver${beam.reachedReceiver ? ' is-lit' : ''}`}>
                  <circle cx={beamworksColumn(puzzle.receiver) * 64 + 32} cy={beamworksRow(puzzle.receiver) * 64 + 32} r="23" />
                  <circle cx={beamworksColumn(puzzle.receiver) * 64 + 32} cy={beamworksRow(puzzle.receiver) * 64 + 32} r="9" />
                </g>
              </svg>
            </div>

            <div className="beamworks-hint" role="status" aria-live="polite"><strong>{beam.reachedReceiver ? 'RECEIVER LIT' : 'TRACE THE BEAM'}</strong><span>{state.phase === 'paused' ? 'Paused. Resume to turn a mirror.' : puzzle.hint}</span></div>
            <div className="beamworks-mirror-controls" role="group" aria-label="Rotate mirrors">
              {state.mirrors.map((mirror, index) => (
                <button className={`beamworks-mirror-button ${mirror.angle === 'slash' ? 'is-slash' : 'is-backslash'}`} key={`${mirror.cell}-${index}`} type="button" onClick={() => rotate(index)} disabled={state.phase !== 'playing'} aria-label={`Rotate mirror ${index + 1}, currently ${mirror.angle === 'slash' ? 'slash' : 'backslash'}`}>
                  <span className="beamworks-mirror-key">{index + 1}</span><span className="beamworks-mirror-glyph" aria-hidden="true">{mirror.angle === 'slash' ? '/' : '\\'}</span>
                  <span><strong>Mirror {index + 1}</strong><small>{mirror.angle === 'slash' ? 'SLASH' : 'BACKSLASH'}</small></span>
                </button>
              ))}
            </div>
            <div className="beamworks-actions">
              {state.phase === 'ready' ? <button className="beamworks-action beamworks-action-primary" type="button" onClick={start}>Start circuit <span aria-hidden="true">▶</span></button>
                : state.phase === 'complete' ? <button className="beamworks-action beamworks-action-primary" type="button" onClick={start}>Play again <span aria-hidden="true">↻</span></button>
                  : <button className="beamworks-action beamworks-action-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume route' : 'Pause route'} <kbd>ESC</kbd></button>}
              <button className="beamworks-action beamworks-action-undo" type="button" onClick={() => setState((current) => undoBeamworks(current))} disabled={state.phase !== 'playing' || state.history.length === 0}>Undo <kbd>Z</kbd></button>
              <button className="beamworks-action beamworks-action-restart" type="button" onClick={restart}>Restart</button>
            </div>
            <div className="beamworks-console-footer"><span>1–4 / TOUCH MIRRORS</span><span>Z UNDO · R RESTART</span></div>
          </div>
          <p className="beamworks-footnote">Each press turns one mirror once. The beam path updates immediately; holding a key does not repeat.</p>
          <span className="sr-only" aria-live="polite">{description}</span>
        </div>
      </div>
    </section>
  )
}
