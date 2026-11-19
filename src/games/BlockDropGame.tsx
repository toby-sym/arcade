import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { useHeldKeys } from '../hooks/useHeldKeys'
import { blockDropReducer, createBlockDropState, getGhostY, getPieceCells, gravityInterval, type BlockType } from './blockDrop'

interface BlockDropGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
}

export function BlockDropGame({ onBack, bestScore, onRecordScore }: BlockDropGameProps) {
  const [state, dispatch] = useReducer(blockDropReducer, undefined, createBlockDropState)
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const previousAudioState = useRef({ lines: state.lines, phase: state.phase })
  const isFresh = state.score === 0 && state.lines === 0 && state.board.every((row) => row.every((cell) => cell === null))
  const statusLabel = state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), gravityInterval(state.level))
    return () => window.clearInterval(timer)
  }, [state.level, state.phase])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (state.score > 0) onRecordScore(state.score)
  }, [onRecordScore, state.score])

  useEffect(() => {
    const previous = previousAudioState.current
    if (state.phase === 'over' && previous.phase !== 'over') playSound('lose')
    else if (state.lines > previous.lines) playSound('wave')
    previousAudioState.current = { lines: state.lines, phase: state.phase }
  }, [playSound, state.lines, state.phase])

  const focusBoard = () => window.requestAnimationFrame(() => boardRef.current?.focus())
  const start = () => {
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusBoard()
  }
  const restart = () => {
    dispatch({ type: 'restart' })
    focusBoard()
  }
  const playAgain = () => {
    dispatch({ type: 'restart' })
    dispatch({ type: 'start' })
    focusBoard()
  }

  const handleHeldKey = useHeldKeys({
    ArrowLeft: () => dispatch({ type: 'move', dx: -1 }),
    a: () => dispatch({ type: 'move', dx: -1 }),
    ArrowRight: () => dispatch({ type: 'move', dx: 1 }),
    d: () => dispatch({ type: 'move', dx: 1 }),
    ArrowDown: () => dispatch({ type: 'softDrop' }),
    s: () => dispatch({ type: 'softDrop' }),
  }, state.phase === 'playing', 100)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    handleHeldKey(event)
    if (event.defaultPrevented) return

    if (event.code === 'Space') {
      event.preventDefault()
      if (state.phase === 'ready') dispatch({ type: 'start' })
      else if (state.phase === 'playing' && !event.repeat) {
        playSound('fire')
        dispatch({ type: 'hardDrop' })
      }
    } else if ((event.key === 'ArrowUp' || event.key.toLowerCase() === 'x') && !event.repeat) {
      event.preventDefault()
      dispatch({ type: 'rotate', direction: 1 })
    } else if (event.key.toLowerCase() === 'z' && !event.repeat) {
      event.preventDefault()
      dispatch({ type: 'rotate', direction: -1 })
    } else if (event.key.toLowerCase() === 'c' || event.key === 'Shift') {
      event.preventDefault()
      dispatch({ type: 'hold' })
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

  const ghostY = getGhostY(state)
  const ghostCells = new Set(getPieceCells(state.current).map(({ x, y }) => `${state.current.x + x},${ghostY + y}`))
  const currentCells = new Set(getPieceCells(state.current).map(({ x, y }) => `${state.current.x + x},${state.current.y + y}`))

  return (
    <section className="snake-view blockdrop-view" aria-labelledby="blockdrop-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout blockdrop-layout">
        <div className="snake-copy blockdrop-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="blockdrop-title">Block Drop<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Find the fit, clear the row, and keep the stack under control.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Fill a row to clear it. The blocks fall faster as you clear rows. Keep the stack below the top of the screen.</p>
          </div>
          <div className="score-card blockdrop-score" aria-label={`Score: ${state.score}. ${state.lines} rows cleared. Level ${state.level}. ${bestScore === null ? 'No personal best yet.' : `Local best: ${bestScore} points.`}`}>
            <div className="blockdrop-stat"><span className="score-caption">SCORE</span><strong className="score-value">{String(state.score).padStart(5, '0')}</strong></div>
            <div className="breakout-stats"><span><strong>{state.lines}</strong> rows</span><span><strong>{state.level}</strong> level</span></div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : String(bestScore).padStart(5, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
          </div>
          <div className="game-actions">
            {state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>{isFresh ? 'Start game' : 'Continue'} <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={playAgain}>Play again</button>
            )}
            {(!isFresh || state.phase === 'playing' || state.phase === 'paused') && state.phase !== 'over' && (
              <button className="button button-quiet" type="button" onClick={restart}>Restart</button>
            )}
          </div>
          <p className="keyboard-hint">← / → move · ↓ soft drop · ↑ / X rotate · Space drop · C hold · Esc pause</p>
        </div>

        <div className="play-column blockdrop-play-column">
          <div className="blockdrop-console">
            <div className="frame-topline">
              <span>FIELD 09</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <div className="blockdrop-screen">
              <div
                ref={boardRef}
                className={`blockdrop-board phase-${state.phase}`}
                role="group"
                aria-label={`Block Drop playfield. ${state.lines} rows cleared. Level ${state.level}.`}
                aria-describedby="blockdrop-instructions"
                tabIndex={0}
                onKeyDown={handleKeyDown}
              >
                {state.board.flatMap((row, y) => row.map((type, x) => {
                  const position = `${x},${y}`
                  const current = currentCells.has(position)
                  const ghost = ghostCells.has(position) && !current && y >= 0
                  const cellType = current ? state.current.type : type ?? (ghost ? state.current.type : null)
                  return <span key={position} className={`blockdrop-cell${cellType ? ` block-${cellType}` : ''}${current ? ' cell-current' : ''}${ghost ? ' cell-ghost' : ''}`} aria-hidden="true" />
                }))}
                {state.phase !== 'playing' && (
                  <div className="blockdrop-overlay" aria-hidden="true">
                    <strong>{state.phase === 'ready' ? 'Stack the blocks' : state.phase === 'paused' ? 'Paused' : 'Board full'}</strong>
                    <span>{state.phase === 'ready' ? 'Clear a row and chase a new high score.' : state.phase === 'paused' ? 'Take a breather. Your stack is safe.' : `Final score · ${state.score} points`}</span>
                  </div>
                )}
              </div>
              <aside className="blockdrop-side-panel" aria-label="Piece preview and game stats">
                <PiecePreview type={state.hold} label="HOLD" />
                <div className="blockdrop-next-list" aria-label="Next pieces">
                  <span className="score-caption">NEXT</span>
                  {state.next.slice(0, 3).map((type, index) => <PiecePreview key={`${type}-${index}`} type={type} label={`Next piece ${index + 1}`} />)}
                </div>
                <div className="blockdrop-side-stats"><span>LINES<strong>{String(state.lines).padStart(2, '0')}</strong></span><span>LEVEL<strong>{String(state.level).padStart(2, '0')}</strong></span></div>
              </aside>
            </div>
            <div className="blockdrop-console-footer"><span>ARROWS · X / Z · SPACE · C</span><span>{state.lines} LINES · LV {state.level}</span></div>
          </div>
          <div className="blockdrop-touch-controls" role="group" aria-label="Touch controls">
            <button className="dpad-button" type="button" aria-label="Move left one column" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'move', dx: -1 })}>←</button>
            <button className="button button-quiet blockdrop-action" type="button" aria-label="Rotate clockwise" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'rotate', direction: 1 })}>↻</button>
            <button className="dpad-button" type="button" aria-label="Soft drop one row" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'softDrop' })}>↓</button>
            <button className="button button-quiet blockdrop-action" type="button" aria-label="Hold piece" disabled={state.phase !== 'playing' || !state.canHold} onClick={() => dispatch({ type: 'hold' })}>HOLD</button>
            <button className="dpad-button" type="button" aria-label="Move right one column" disabled={state.phase !== 'playing'} onClick={() => dispatch({ type: 'move', dx: 1 })}>→</button>
            <button className="button button-primary blockdrop-drop-button" type="button" disabled={state.phase !== 'playing'} onClick={() => { playSound('fire'); dispatch({ type: 'hardDrop' }) }}>Drop</button>
          </div>
          <p id="blockdrop-instructions" className="blockdrop-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}

function PiecePreview({ type, label }: { type: BlockType | null; label: string }) {
  const cells = type ? getPieceCells({ type, rotation: 0, x: 0, y: 0 }) : []
  return (
    <div className="blockdrop-piece-preview" role="img" aria-label={type ? `${label}: ${pieceName(type)}` : `${label}: empty`}>
      <span className="score-caption">{label}</span>
      <div className="blockdrop-preview-grid" aria-hidden="true">
        {cells.map((cell, index) => <i key={index} className={`block-${type}`} style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1 }} />)}
      </div>
    </div>
  )
}

function pieceName(type: BlockType): string {
  return ({ i: 'line', j: 'left hook', l: 'right hook', o: 'square', s: 'left zigzag', t: 'tee', z: 'right zigzag' })[type]
}
