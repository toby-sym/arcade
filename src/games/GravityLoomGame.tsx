import { useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createGravityLoomState,
  gravityLoomProgress,
  gravityLoomReducer,
  GRAVITY_LOOM_BOARD_SIZE,
  GRAVITY_LOOM_STAGE_COUNT,
  type GravityLoomDirection,
  type GravityLoomProgress,
} from './gravityLoom'

interface GravityLoomGameProps {
  onBack: () => void
  bestMoves: number | null
  progress: GravityLoomProgress | null
  onSaveProgress: (progress: GravityLoomProgress | null) => void
  reduceMotion: boolean
}

const DIRECTIONS: Array<{ direction: GravityLoomDirection; label: string; symbol: string }> = [
  { direction: 'up', label: 'North', symbol: '↑' },
  { direction: 'right', label: 'East', symbol: '→' },
  { direction: 'down', label: 'South', symbol: '↓' },
  { direction: 'left', label: 'West', symbol: '←' },
]

export function GravityLoomGame({ onBack, bestMoves, progress, onSaveProgress, reduceMotion }: GravityLoomGameProps) {
  const today = utcDateKey()
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    gravityLoomReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createGravityLoomState(date, saved),
  )
  const puzzle = state.puzzles[state.stageIndex]!
  const wallSet = new Set(puzzle.walls)
  const portalIndices = new Set(puzzle.portals ?? [])
  const phaseLabel = state.phase === 'complete' ? 'COMPLETE' : state.phase.toUpperCase()

  function sendAction(action: Parameters<typeof gravityLoomReducer>[1]) {
    const next = gravityLoomReducer(state, action)
    if (next === state) return
    dispatch(action)
    onSaveProgress(gravityLoomProgress(next))
    if (next.phase === 'complete' && state.phase !== 'complete') playSound('win')
    else if (next.outcome === 'receiver') playSound('score')
    else if (next.outcome === 'portal') playSound('score')
    else if (next.outcome === 'wall') playSound(next.spark === state.spark ? 'miss' : 'hit')
  }

  const focusBoard = () => window.requestAnimationFrame(() => boardRef.current?.focus())
  const start = () => {
    sendAction({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusBoard()
  }
  const restart = () => {
    sendAction({ type: 'restart' })
    focusBoard()
  }
  const tilt = (direction: GravityLoomDirection) => sendAction({ type: 'tilt', direction })

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      sendAction({ type: state.phase === 'paused' ? 'resume' : 'pause' })
      return
    }
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      restart()
      return
    }
    if ((event.key === ' ' || event.code === 'Space') && (state.phase === 'ready' || state.phase === 'paused')) {
      event.preventDefault()
      start()
      return
    }
    const keys: Record<string, GravityLoomDirection> = {
      ArrowUp: 'up', w: 'up',
      ArrowRight: 'right', d: 'right',
      ArrowDown: 'down', s: 'down',
      ArrowLeft: 'left', a: 'left',
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const direction = keys[key]
    if (direction) {
      event.preventDefault()
      tilt(direction)
    }
  }

  return (
    <section className="snake-view gravity-loom-view" aria-labelledby="gravity-loom-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout gravity-loom-layout">
        <div className="snake-copy gravity-loom-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY LOGIC · UTC</p>
          <h1 id="gravity-loom-title">Gravity Loom<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Turn the chamber. Find the line. Light every receiver.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Tilt the chamber in one of four directions. The spark rolls until a wall stops it. Pass through the paired portals to cross the board, then guide the spark into the receiver.</p>
            <p>Clear four chambers to finish today's route. A tilt counts even if the spark cannot move. The daily loom is the same for everyone on a UTC date.</p>
            <p>Use the <strong>Arrow keys</strong> or <strong>W A S D</strong>, or tap a direction. <strong>Space</strong> starts or resumes, <strong>Escape</strong> pauses, and <strong>R</strong> restarts the route.</p>
          </div>

          <div className="score-card gravity-loom-score" aria-label={`Total tilts ${state.totalMoves}. Chamber ${state.stageIndex + 1} of ${GRAVITY_LOOM_STAGE_COUNT}. ${state.stageMoves} tilts in this chamber. ${state.completedStageMoves.length} receivers lit. ${bestMoves === null ? 'No local best yet.' : `Local best ${bestMoves} tilts.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">TOTAL TILTS</span>
              <strong className="score-value">{String(state.totalMoves).padStart(2, '0')}</strong>
              <span className="score-unit">moves</span>
            </div>
            <div className="breakout-stats">
              <span><strong>{state.stageIndex + 1}</strong> / {GRAVITY_LOOM_STAGE_COUNT} chambers</span>
              <span><strong>{state.stageMoves}</strong> this chamber</span>
              <span><strong>{state.completedStageMoves.length}</strong> receivers lit</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FEWEST TILTS · THIS BROWSER</span>
              <strong className="score-value">{bestMoves === null ? '—' : String(bestMoves).padStart(2, '0')}</strong>
              <span className="score-unit">moves</span>
            </div>
          </div>
          <p className="gravity-loom-local-note">Your fewest-tilt solve is saved in this browser and does not sync.</p>

          <div className="game-actions">
            {state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start the loom <span aria-hidden="true">→</span></button>
            ) : state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'pause' })}>Pause route <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume route <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Play today's loom again <span aria-hidden="true">→</span></button>
            )}
            {state.phase !== 'ready' && <button className="button button-quiet" type="button" onClick={restart}>Restart route</button>}
          </div>
        </div>

        <div className="play-column gravity-loom-play-column">
          <div className={`gravity-loom-console${reduceMotion ? ' is-reduced-motion' : ''}`} onKeyDown={handleKeyDown}>
            <div className="frame-topline">
              <span>CHAMBER {String(state.stageIndex + 1).padStart(2, '0')}</span>
              <span className={`frame-light${state.phase === 'complete' ? ' phase-complete' : ''}`}><i />{phaseLabel}</span>
            </div>
            <div className="gravity-loom-target">
              <span className="score-caption">CURRENT ROUTE</span>
              <strong><i className="gravity-spark-glyph" /> Spark to receiver {state.stageIndex + 1}</strong>
              <span>PAR {puzzle.par} {puzzle.par === 1 ? 'TILT' : 'TILTS'} · {puzzle.portals ? 'PAIRED PORTALS' : 'NO PORTALS'}</span>
            </div>

            <div className="gravity-loom-field">
              <div ref={boardRef} className="gravity-loom-board" role="grid" aria-label={`Gravity Loom chamber ${state.stageIndex + 1} board, ${GRAVITY_LOOM_BOARD_SIZE} by ${GRAVITY_LOOM_BOARD_SIZE}`} tabIndex={0}>
                {Array.from({ length: GRAVITY_LOOM_BOARD_SIZE }, (_, row) => (
                  <div className="gravity-loom-row" role="row" key={row}>
                    {Array.from({ length: GRAVITY_LOOM_BOARD_SIZE }, (_, column) => {
                      const index = row * GRAVITY_LOOM_BOARD_SIZE + column
                      const isWall = wallSet.has(index)
                      const isPortal = portalIndices.has(index)
                      const isPortalA = puzzle.portals?.[0] === index
                      const isReceiver = puzzle.receiver === index
                      const isSpark = state.spark === index
                      const tileType = isWall ? 'stone wall' : isPortal ? 'paired portal' : isReceiver ? 'receiver' : isSpark ? 'spark' : 'open floor'
                      return (
                        <div className={`gravity-loom-cell${isWall ? ' is-wall' : ''}${isPortal ? ` is-portal is-portal-${isPortalA ? 'a' : 'b'}` : ''}${isReceiver ? ' is-receiver' : ''}${isSpark ? ' has-spark' : ''}`} role="gridcell" aria-label={`Row ${row + 1}, column ${column + 1}: ${tileType}`} key={index}>
                          {isWall ? <span aria-hidden="true">▰</span> : isPortal ? <span className="gravity-portal-glyph" aria-hidden="true">↗</span> : isReceiver ? <span className="gravity-receiver-glyph" aria-hidden="true">◎</span> : null}
                          {isSpark && <span className="gravity-loom-spark" aria-hidden="true">✦</span>}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {(state.phase === 'ready' || state.phase === 'paused' || state.phase === 'complete') && (
                <div className="gravity-loom-overlay">
                  <strong>{state.phase === 'ready' ? 'TUNE THE CHAMBER' : state.phase === 'paused' ? 'ROUTE PAUSED' : 'THE LOOM IS LIT'}</strong>
                  <span>{state.phase === 'ready' ? 'Roll the spark into the glowing receiver.' : state.phase === 'paused' ? 'The spark is held in place.' : `${state.totalMoves} tilts · ${state.completedStageMoves.join(' / ')} across the four chambers`}</span>
                  {state.phase === 'ready' && <button className="button button-primary" type="button" onClick={start}>Start the loom</button>}
                  {state.phase === 'paused' && <button className="button button-primary" type="button" onClick={start}>Resume route</button>}
                  {state.phase === 'complete' && <button className="button button-primary" type="button" onClick={restart}>Play today's loom again</button>}
                </div>
              )}
            </div>

            <div className="gravity-loom-controls" role="group" aria-label="Tilt the chamber">
              {DIRECTIONS.map(({ direction, label, symbol }) => (
                <button className={`gravity-tilt-button gravity-tilt-${direction}`} type="button" key={direction} aria-label={`Tilt gravity ${label.toLowerCase()}`} disabled={state.phase !== 'playing'} onClick={() => tilt(direction)}>
                  <span aria-hidden="true">{symbol}</span><strong>{label}</strong>
                </button>
              ))}
            </div>
            <p className="gravity-loom-status" role="status" aria-live="polite">{state.message}</p>
            <div className="gravity-loom-console-footer"><span>ARROWS · W A S D · TOUCH</span><span>ROUTE {String(state.stageIndex + 1).padStart(2, '0')} / 04</span></div>
          </div>
          <p className="gravity-loom-keyboard-hint">Focus the chamber to tilt. The spark stops at a wall or receiver; portals carry it across the board.</p>
        </div>
      </div>
    </section>
  )
}
