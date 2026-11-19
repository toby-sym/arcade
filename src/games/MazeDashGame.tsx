import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useHeldKeys } from '../hooks/useHeldKeys'
import {
  createMazeDashState,
  isMazeDashWall,
  MAZE_DASH_EXIT,
  MAZE_DASH_ROWS,
  MAZE_DASH_WIDTH,
  mazeDashReducer,
  type MazeDashDirection,
} from './mazeDash'

interface MazeDashGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
}

export function MazeDashGame({ onBack, bestScore, onRecordScore }: MazeDashGameProps) {
  const [state, dispatch] = useReducer(mazeDashReducer, undefined, createMazeDashState)
  const boardRef = useRef<HTMLDivElement>(null)
  const statusLabel = state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()

  useEffect(() => {
    if (state.score > 0) onRecordScore(state.score)
  }, [onRecordScore, state.score])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  const move = (direction: MazeDashDirection) => dispatch({ type: 'move', direction })
  const holdMove = useHeldKeys({
    ArrowUp: () => move('up'),
    w: () => move('up'),
    ArrowRight: () => move('right'),
    d: () => move('right'),
    ArrowDown: () => move('down'),
    s: () => move('down'),
    ArrowLeft: () => move('left'),
    a: () => move('left'),
  }, state.phase === 'playing', 145)

  const focusBoard = () => window.requestAnimationFrame(() => boardRef.current?.focus())
  const start = () => {
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusBoard()
  }
  const restart = () => {
    dispatch({ type: 'restart' })
    focusBoard()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    holdMove(event)
    if (event.defaultPrevented) return
    if (event.code === 'Space' && state.phase === 'ready') {
      event.preventDefault()
      start()
    } else if (event.key === 'Escape' && state.phase === 'playing') {
      event.preventDefault()
      dispatch({ type: 'pause' })
    } else if (event.key === 'Escape' && state.phase === 'paused') {
      event.preventDefault()
      dispatch({ type: 'resume' })
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      restart()
    }
  }

  const cellDescription = state.phase === 'ready'
    ? 'Ready to play. Collect every gem and reach the open exit.'
    : state.phase === 'playing'
      ? `${state.pellets.length} gems remain. ${state.lives} lives left. Sentries advance every other move.`
      : state.phase === 'paused'
        ? 'Game paused.'
        : state.phase === 'won'
          ? `Maze cleared with ${state.score} points.`
          : `Run over with ${state.score} points.`

  return (
    <section className="snake-view maze-dash-view" aria-labelledby="maze-dash-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout maze-dash-layout">
        <div className="snake-copy maze-dash-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> ARCADE CLASSIC · FIELD 24</p>
          <h1 id="maze-dash-title">Maze Dash<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Sweep up the gems. Keep one step ahead of the sentries.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Collect every gem, then reach the exit in the lower-right corner. Sentries move after every other step and cost a life if they catch you.</p>
            <p>Hold the <strong>arrow keys</strong> or <strong>WASD</strong> to move. On a phone, tap the direction pad. Press <strong>Space</strong> to start, <strong>Escape</strong> to pause, or <strong>R</strong> to restart.</p>
          </div>
          <div className="score-card maze-dash-score" aria-label={`Score ${state.score}. ${state.lives} lives remaining. ${state.pellets.length} gems remaining. ${bestScore === null ? 'No local best yet.' : `Local best ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">THIS RUN</span>
              <strong className="score-value">{String(state.score).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats"><span><strong>{state.lives}</strong> lives left</span><span><strong>{state.pellets.length}</strong> gems left</span></div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
          </div>
          <div className="game-actions">
            {state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start maze <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Play again <span aria-hidden="true">→</span></button>
            )}
            <button className="button button-quiet" type="button" onClick={restart}>Restart maze</button>
          </div>
          <p className="keyboard-hint">Hold arrows / WASD · Space starts · Escape pauses · R restarts</p>
        </div>

        <div className="play-column maze-dash-play-column">
          <div className="maze-dash-console">
            <div className="frame-topline">
              <span>FIELD 24 · GEM RUN</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <div className="maze-board-shell">
              <div
                ref={boardRef}
                className={`maze-board phase-${state.phase}`}
                role="group"
                aria-label={`Maze Dash board. ${cellDescription}`}
                tabIndex={0}
                onKeyDown={handleKeyDown}
              >
                {MAZE_DASH_ROWS.map((_, rowIndex) => (
                  <div className="maze-row" key={rowIndex} aria-hidden="true">
                    {Array.from({ length: MAZE_DASH_WIDTH }, (_, columnIndex) => {
                      const cell = rowIndex * MAZE_DASH_WIDTH + columnIndex
                      const wall = isMazeDashWall(cell)
                      const sentryIndex = state.sentries.indexOf(cell)
                      const exitOpen = state.pellets.length === 0
                      return (
                        <div className={`maze-cell${wall ? ' is-wall' : ''}${cell === MAZE_DASH_EXIT ? ` maze-exit${exitOpen ? ' is-open' : ''}` : ''}`} key={cell}>
                          {state.pellets.includes(cell) && <i className="maze-gem" />}
                          {cell === MAZE_DASH_EXIT && <i className="maze-exit-mark" />}
                          {sentryIndex >= 0 && <i className={`maze-sentry sentry-${sentryIndex + 1}`} />}
                          {state.player === cell && <i className="maze-player" />}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {(state.phase === 'paused' || state.phase === 'won' || state.phase === 'lost') && (
                  <div className="maze-dash-overlay" aria-live="polite">
                    <strong>{state.phase === 'paused' ? 'Run paused' : state.phase === 'won' ? 'Maze cleared!' : 'Run over'}</strong>
                    <span>{state.phase === 'paused' ? 'Resume when you are ready.' : state.phase === 'won' ? `You cleared the maze with ${state.score} points.` : 'The sentries caught you. Play again for another run.'}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="maze-dash-console-footer"><span>13 × 13 · {state.pellets.length} GEMS</span><span>{state.lives} LIVES · {state.score} POINTS</span></div>
          </div>
          <div className="maze-dash-touch-controls" role="group" aria-label="Maze Dash direction pad">
            <button className="button button-secondary maze-pad-up" type="button" aria-label="Move up" disabled={state.phase !== 'playing'} onClick={() => move('up')}>↑</button>
            <button className="button button-secondary maze-pad-left" type="button" aria-label="Move left" disabled={state.phase !== 'playing'} onClick={() => move('left')}>←</button>
            <button className="button button-secondary maze-pad-down" type="button" aria-label="Move down" disabled={state.phase !== 'playing'} onClick={() => move('down')}>↓</button>
            <button className="button button-secondary maze-pad-right" type="button" aria-label="Move right" disabled={state.phase !== 'playing'} onClick={() => move('right')}>→</button>
          </div>
          <p className="maze-dash-status" role="status" aria-live="polite">{cellDescription}</p>
        </div>
      </div>
    </section>
  )
}
