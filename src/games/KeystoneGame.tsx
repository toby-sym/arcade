import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  allSocketsCovered,
  createKeystoneState,
  KEYSTONE_BOARD_SIZE,
  KEYSTONE_PUZZLES,
  keystoneColumn,
  keystoneRow,
  moveKeystone,
  pauseKeystone,
  resumeKeystone,
  restartKeystone,
  startKeystone,
  undoKeystone,
  type KeystoneDirection,
} from './keystone'

const directions: Array<{ direction: KeystoneDirection; label: string; symbol: string; key: string }> = [
  { direction: 'up', label: 'North', symbol: '↑', key: '↑ / W' },
  { direction: 'right', label: 'East', symbol: '→', key: '→ / D' },
  { direction: 'down', label: 'South', symbol: '↓', key: '↓ / S' },
  { direction: 'left', label: 'West', symbol: '←', key: '← / A' },
]

export function KeystoneGame({
  onBack,
  bestMoves,
  onRecordMoves,
  reduceMotion,
}: {
  onBack: () => void
  bestMoves: number | null
  onRecordMoves: (moves: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createKeystoneState)
  const boardRef = useRef<HTMLDivElement>(null)
  const lastRecordedMoves = useRef<number | null>(null)
  const playSound = useArcadeSound()
  const puzzle = KEYSTONE_PUZZLES[state.stageIndex]!
  const doorsOpen = allSocketsCovered(puzzle, state.crates)

  useEffect(() => {
    if (state.phase !== 'complete' || lastRecordedMoves.current === state.moves) return
    lastRecordedMoves.current = state.moves
    onRecordMoves(state.moves)
    playSound('win')
  }, [onRecordMoves, playSound, state.moves, state.phase])

  function focusBoard() {
    window.requestAnimationFrame(() => boardRef.current?.focus())
  }

  function start() {
    lastRecordedMoves.current = null
    setState(startKeystone(state))
    focusBoard()
  }

  function restart() {
    lastRecordedMoves.current = null
    setState(restartKeystone(state))
    focusBoard()
  }

  function move(direction: KeystoneDirection) {
    const next = moveKeystone(state, direction)
    if (next === state) return
    setState(next)
    if (next.pushes > state.pushes) playSound('hit')
    if (next.stageIndex > state.stageIndex) playSound('score')
  }

  function togglePause() {
    setState((current) => current.phase === 'paused' ? resumeKeystone(current) : pauseKeystone(current))
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
      setState((current) => undoKeystone(current))
      return
    }
    const keyboardDirections: Record<string, KeystoneDirection> = {
      ArrowUp: 'up', w: 'up',
      ArrowRight: 'right', d: 'right',
      ArrowDown: 'down', s: 'down',
      ArrowLeft: 'left', a: 'left',
    }
    const direction = keyboardDirections[event.key.length === 1 ? key : event.key]
    if (direction) {
      event.preventDefault()
      move(direction)
    }
  }

  const phaseLabel = state.phase === 'ready' ? 'STANDBY'
    : state.phase === 'playing' ? 'ROOM LIVE'
      : state.phase === 'paused' ? 'PAUSED' : 'ROUTE CLEAR'
  const description = state.phase === 'complete'
    ? `All four chambers cleared in ${state.moves} moves.`
    : state.phase === 'paused'
      ? 'The current chamber is paused.'
      : `${puzzle.title}, chamber ${state.stageIndex + 1} of ${KEYSTONE_PUZZLES.length}. ${state.crates.length} blocks and ${puzzle.switches.length} sockets.`

  return (
    <section className={`snake-view keystone-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="keystone-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout keystone-layout">
        <div className="snake-copy keystone-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="keystone-title">Keystone<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Push one block into place. Open a door. Find the way through.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Push every block onto a floor socket to power the lock. You can push blocks, but never pull them. Once all sockets are covered, reach the exit to open the next chamber.</p>
            <p>Use the <strong>Arrow keys</strong> or <strong>W A S D</strong>, or tap a direction. <strong>Z</strong> undoes one move, <strong>Escape</strong> pauses, and <strong>R</strong> restarts the route.</p>
          </div>
          <div className="score-card keystone-score" aria-label={`Total moves ${state.moves}. Chamber ${state.stageIndex + 1} of ${KEYSTONE_PUZZLES.length}. ${bestMoves === null ? 'No local best yet.' : `Local best ${bestMoves} moves.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">TOTAL MOVES</span>
              <strong className="score-value">{String(state.moves).padStart(2, '0')}</strong>
              <span className="score-unit">{state.stageMoves} in this chamber</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong>{bestMoves === null ? '—' : String(bestMoves).padStart(2, '0')}</strong>
              <span className="score-unit">moves</span>
            </div>
          </div>
          <p className="keystone-local-note">Your fewest moves across the four chambers stays in this browser and does not sync.</p>
        </div>

        <div className="play-column keystone-play-column">
          <div className={`keystone-console phase-${state.phase}`}>
            <div className="frame-topline"><span>FIELD 40</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="keystone-roundline">
              <div><span>CHAMBER {String(state.stageIndex + 1).padStart(2, '0')} / 04</span><strong>{puzzle.title}</strong></div>
              <b>{state.moves}<small> MOVES</small></b>
            </div>
            <div className="keystone-progress" aria-label={`${state.completedStageMoves.length} of ${KEYSTONE_PUZZLES.length} chambers cleared`}>
              {KEYSTONE_PUZZLES.map((item, index) => <span key={item.title} className={index < state.completedStageMoves.length ? 'is-clear' : index === state.stageIndex ? 'is-current' : ''} />)}
            </div>

            <div
              className="keystone-board-frame"
              ref={boardRef}
              role="group"
              tabIndex={0}
              aria-label="Keystone chamber. Use arrow keys or W A S D to move, Z to undo, Escape to pause, and R to restart."
            >
              <svg className="keystone-board" viewBox={`0 0 ${KEYSTONE_BOARD_SIZE * 64} ${KEYSTONE_BOARD_SIZE * 64}`} role="img" aria-label={`${puzzle.title} board. ${doorsOpen ? 'The lock is powered and the door is open.' : 'The door is locked.'} ${state.crates.length} blocks remain.`}>
                <defs>
                  <linearGradient id="keystone-crate" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f0bd57" /><stop offset="1" stopColor="#aa7430" /></linearGradient>
                  <radialGradient id="keystone-player"><stop stopColor="#fff7dc" /><stop offset=".62" stopColor="#78e4ec" /><stop offset="1" stopColor="#278eaa" /></radialGradient>
                </defs>
                {Array.from({ length: KEYSTONE_BOARD_SIZE ** 2 }, (_, index) => {
                  const row = keystoneRow(index)
                  const column = keystoneColumn(index)
                  const wall = row === 0 || column === 0 || row === KEYSTONE_BOARD_SIZE - 1 || column === KEYSTONE_BOARD_SIZE - 1 || puzzle.walls.includes(index)
                  const door = puzzle.doors.includes(index)
                  const switchIndex = puzzle.switches.indexOf(index)
                  const crateIndex = state.crates.indexOf(index)
                  const isExit = puzzle.exit === index
                  const x = column * 64
                  const y = row * 64
                  return (
                    <g key={index}>
                      <rect className={`keystone-floor${wall ? ' is-wall' : ''}`} x={x + 1} y={y + 1} width="62" height="62" rx="4" />
                      {!wall && switchIndex >= 0 && <g className={`keystone-socket${crateIndex >= 0 ? ' is-covered' : ''}`}><circle cx={x + 32} cy={y + 32} r="19" /><path d={`M${x + 25} ${y + 32}h14M${x + 32} ${y + 25}v14`} /></g>}
                      {!wall && isExit && <g className="keystone-exit"><circle cx={x + 32} cy={y + 32} r="22" /><path d={`M${x + 32} ${y + 19}v26M${x + 19} ${y + 32}h26`} /></g>}
                      {!wall && door && <g className={`keystone-door${doorsOpen ? ' is-open' : ''}`}><rect x={x + 12} y={y + 8} width="40" height="48" rx="5" /><path d={`M${x + 24} ${y + 8}v48M${x + 40} ${y + 8}v48`} /><circle cx={x + 45} cy={y + 32} r="2" /></g>}
                      {!wall && crateIndex >= 0 && <g className="keystone-crate"><rect x={x + 8} y={y + 8} width="48" height="48" rx="6" /><path d={`M${x + 18} ${y + 18}l28 28M${x + 46} ${y + 18}L${x + 18} ${y + 46}`} /><circle cx={x + 32} cy={y + 32} r="5" /></g>}
                      {!wall && state.player === index && <g className="keystone-player"><circle cx={x + 32} cy={y + 32} r="20" /><circle cx={x + 32} cy={y + 32} r="6" /></g>}
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="keystone-chamber-note" role="status" aria-live="polite"><strong>{doorsOpen ? 'LOCK POWERED' : `${puzzle.switches.length - state.crates.filter((crate) => puzzle.switches.includes(crate)).length} SOCKET${puzzle.switches.length === 1 ? '' : 'S'} TO FILL`}</strong><span>{state.phase === 'paused' ? 'Paused. Resume to move.' : puzzle.hint}</span></div>
            <div className="keystone-direction-pad" role="group" aria-label="Move one square">
              {directions.map(({ direction, label, symbol, key }) => (
                <button className={`keystone-direction direction-${direction}`} key={direction} type="button" onClick={() => move(direction)} disabled={state.phase !== 'playing'} aria-label={`Move ${label.toLowerCase()}, key ${key}`}>
                  <span aria-hidden="true">{symbol}</span><small>{label}</small>
                </button>
              ))}
            </div>
            <div className="keystone-actions">
              {state.phase === 'ready' ? <button className="keystone-action keystone-action-primary" type="button" onClick={start}>Start route <span aria-hidden="true">▶</span></button>
                : state.phase === 'complete' ? <button className="keystone-action keystone-action-primary" type="button" onClick={start}>Play again <span aria-hidden="true">↻</span></button>
                  : <button className="keystone-action keystone-action-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume route' : 'Pause route'} <kbd>ESC</kbd></button>}
              <button className="keystone-action keystone-action-undo" type="button" onClick={() => setState((current) => undoKeystone(current))} disabled={state.phase !== 'playing' || state.history.length === 0}>Undo <kbd>Z</kbd></button>
              <button className="keystone-action keystone-action-restart" type="button" onClick={restart}>Restart</button>
            </div>
            <div className="keystone-console-footer"><span>ARROWS / W A S D / TOUCH</span><span>Z UNDO · R RESTART</span></div>
          </div>
          <p className="keystone-footnote">A move counts only when the player or a block changes square. Undo removes one move from the count.</p>
          <span className="sr-only" aria-live="polite">{description}</span>
        </div>
      </div>
    </section>
  )
}
