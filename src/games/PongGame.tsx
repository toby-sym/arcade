import { useEffect, useReducer, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useHeldKeys } from '../hooks/useHeldKeys'
import {
  PONG_BALL_RADIUS,
  PONG_HEIGHT,
  PONG_LEFT_X,
  PONG_PADDLE_HEIGHT,
  PONG_PADDLE_WIDTH,
  PONG_RIGHT_X,
  PONG_WIDTH,
  pongReducer,
  createPongState,
  type PongDifficulty,
} from './pong'

interface PongGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
  difficulty: PongDifficulty
  onDifficultyChange: (difficulty: PongDifficulty) => void
}

export function PongGame({ onBack, bestScore, onRecordScore, difficulty, onDifficultyChange }: PongGameProps) {
  const [state, dispatch] = useReducer(pongReducer, difficulty, createPongState)
  const boardRef = useRef<HTMLDivElement>(null)
  const isFresh = state.score === 0 && state.opponentScore === 0
  const canChooseDifficulty = isFresh && state.phase === 'ready'

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 16)
    return () => window.clearInterval(timer)
  }, [state.phase])

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

  const focusBoard = () => window.requestAnimationFrame(() => boardRef.current?.focus())
  const start = () => {
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'start' })
    focusBoard()
  }
  const restart = () => {
    dispatch({ type: 'restart' })
    focusBoard()
  }

  const handleHeldKey = useHeldKeys({
    ArrowUp: () => dispatch({ type: 'movePaddle', centerY: state.paddleY + PONG_PADDLE_HEIGHT / 2 - 6 }),
    w: () => dispatch({ type: 'movePaddle', centerY: state.paddleY + PONG_PADDLE_HEIGHT / 2 - 6 }),
    ArrowDown: () => dispatch({ type: 'movePaddle', centerY: state.paddleY + PONG_PADDLE_HEIGHT / 2 + 6 }),
    s: () => dispatch({ type: 'movePaddle', centerY: state.paddleY + PONG_PADDLE_HEIGHT / 2 + 6 }),
  }, state.phase !== 'paused' && state.phase !== 'over')

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    handleHeldKey(event)
    if (event.defaultPrevented) return
    const key = event.key.toLowerCase()
    if (event.code === 'Space' && state.phase === 'ready') {
      event.preventDefault()
      dispatch({ type: 'start' })
    } else if (event.key === 'Escape' && state.phase === 'playing') {
      event.preventDefault()
      dispatch({ type: 'pause' })
    } else if (event.key === 'Escape' && state.phase === 'paused') {
      event.preventDefault()
      dispatch({ type: 'resume' })
    } else if (key === 'r') {
      event.preventDefault()
      restart()
    }
  }

  const movePaddleToPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (state.phase === 'paused' || state.phase === 'over') return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.height === 0) return
    const centerY = ((event.clientY - bounds.top) / bounds.height) * PONG_HEIGHT
    dispatch({ type: 'movePaddle', centerY })
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    movePaddleToPointer(event)
    if (typeof event.currentTarget.setPointerCapture === 'function' && event.pointerId !== undefined) {
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Pointer capture is optional. */ }
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || event.buttons > 0) movePaddleToPointer(event)
  }

  const statusLabel = state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()

  return (
    <section className="snake-view pong-view" aria-labelledby="pong-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout pong-layout">
        <div className="snake-copy pong-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="pong-title">Pong<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">A quick rally against the computer. Find the angle, return the ball, and reach five points.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Move with the up and down arrow keys or W and S while the playfield is focused. On a phone, drag up or down across the field.</p>
          </div>
          <fieldset className="pong-pace-setting" disabled={!canChooseDifficulty}>
            <legend>Computer pace</legend>
            {(['calm', 'steady', 'quick'] as const).map((pace) => (
              <label key={pace}>
                <input
                  type="radio"
                  name="pong-difficulty"
                  value={pace}
                  checked={difficulty === pace}
                  onChange={() => {
                    dispatch({ type: 'setDifficulty', difficulty: pace })
                    onDifficultyChange(pace)
                  }}
                />
                <span>{pace}</span>
              </label>
            ))}
          </fieldset>
          <div className="score-card pong-score" aria-label={`You ${state.score}, computer ${state.opponentScore}. ${bestScore === null ? 'No personal best yet.' : `Local best: ${bestScore} points.`}`}>
            <span className="score-caption">YOU</span>
            <strong className="pong-score-value">{state.score}</strong>
            <span className="pong-score-divider" aria-hidden="true">:</span>
            <strong className="pong-score-value">{state.opponentScore}</strong>
            <span className="score-caption pong-opponent-caption">COMPUTER</span>
            <div className="local-best-readout">
              <span className="score-caption">MOST POINTS IN THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : bestScore}</strong>
              <span className="score-unit">in a match</span>
            </div>
          </div>
          <div className="game-actions">
            {state.phase === 'playing' ? (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            ) : state.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={start}>Resume <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' && isFresh ? (
              <button className="button button-primary" type="button" onClick={start}>Start match <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Serve <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Play again</button>
            )}
            {(!isFresh || state.phase === 'playing' || state.phase === 'paused') && state.phase !== 'over' && (
              <button className="button button-quiet" type="button" onClick={restart}>Restart</button>
            )}
          </div>
          <p className="keyboard-hint">Space to serve · Esc to pause · R to restart</p>
        </div>

        <div className="play-column pong-play-column">
          <div className="pong-console">
            <div className="frame-topline">
              <span>FIELD 05</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <div
              ref={boardRef}
              className={`pong-field phase-${state.phase}`}
              tabIndex={0}
              role="group"
              aria-label="Pong playfield"
              aria-describedby="pong-instructions"
              onKeyDown={handleKeyDown}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
            >
              <span className="pong-center-line" aria-hidden="true" />
              <span className="pong-score-lamp pong-player-lamp" aria-hidden="true">{state.score}</span>
              <span className="pong-score-lamp pong-opponent-lamp" aria-hidden="true">{state.opponentScore}</span>
              <span className="pong-paddle pong-player-paddle" aria-hidden="true" style={{ left: `${(PONG_LEFT_X / PONG_WIDTH) * 100}%`, top: `${(state.paddleY / PONG_HEIGHT) * 100}%`, width: `${(PONG_PADDLE_WIDTH / PONG_WIDTH) * 100}%`, height: `${(PONG_PADDLE_HEIGHT / PONG_HEIGHT) * 100}%` }} />
              <span className="pong-paddle pong-computer-paddle" aria-hidden="true" style={{ left: `${(PONG_RIGHT_X / PONG_WIDTH) * 100}%`, top: `${(state.opponentY / PONG_HEIGHT) * 100}%`, width: `${(PONG_PADDLE_WIDTH / PONG_WIDTH) * 100}%`, height: `${(PONG_PADDLE_HEIGHT / PONG_HEIGHT) * 100}%` }} />
              <span className="pong-ball" aria-hidden="true" style={{ left: `${((state.ball.x - PONG_BALL_RADIUS) / PONG_WIDTH) * 100}%`, top: `${((state.ball.y - PONG_BALL_RADIUS) / PONG_HEIGHT) * 100}%`, width: `${(PONG_BALL_RADIUS * 2 / PONG_WIDTH) * 100}%`, height: `${(PONG_BALL_RADIUS * 2 / PONG_HEIGHT) * 100}%` }} />
              {state.phase !== 'playing' && (
                <div className="pong-overlay" aria-hidden="true">
                  <strong>{state.phase === 'ready' ? (isFresh ? 'Ready to rally?' : 'Point scored') : state.phase === 'paused' ? 'Paused' : state.winner === 'player' ? 'Match won!' : 'Match over'}</strong>
                  <span>{state.phase === 'ready' ? (isFresh ? 'First to five takes the match.' : 'Serve when you are ready.') : state.phase === 'paused' ? 'Take a breath, then resume.' : `Final score · ${state.score} to ${state.opponentScore}`}</span>
                </div>
              )}
            </div>
            <div className="pong-console-footer"><span>ARROWS / W S · SPACE</span><span>FIRST TO 5</span></div>
          </div>
          <p id="pong-instructions" className="pong-status" role="status" aria-live="polite">{state.message} {state.phase === 'playing' ? 'Move with the arrow keys or drag vertically in the field.' : ''}</p>
        </div>
      </div>
    </section>
  )
}
