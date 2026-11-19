import { useEffect, useReducer, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useHeldKeys } from '../hooks/useHeldKeys'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  BALL_RADIUS,
  BREAKOUT_HEIGHT,
  BREAKOUT_WIDTH,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_Y,
  breakoutBrickRect,
  breakoutReducer,
  createBreakoutState,
  remainingBricks,
} from './breakout'

const KEYBOARD_PADDLE_SPEED = 375

interface BreakoutGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
}

export function BreakoutGame({ onBack, bestScore, onRecordScore }: BreakoutGameProps) {
  const [state, dispatch] = useReducer(breakoutReducer, undefined, createBreakoutState)
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const previousAudioState = useRef({ score: state.score, lives: state.lives, phase: state.phase, ballVx: state.ball.vx })
  const remaining = remainingBricks(state.bricks)
  const isFresh = state.score === 0 && remaining === state.bricks.length && state.lives === 3

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

  useEffect(() => {
    const previous = previousAudioState.current
    if (state.phase === 'won' && previous.phase !== 'won') playSound('win')
    else if (state.phase === 'over' && previous.phase !== 'over') playSound('lose')
    else if (state.score > previous.score) playSound('hit')
    else if (state.lives < previous.lives) playSound('miss')
    else if (state.phase === 'playing' && previous.phase === 'playing' && Math.sign(state.ball.vx) !== Math.sign(previous.ballVx)) playSound('hit')
    previousAudioState.current = { score: state.score, lives: state.lives, phase: state.phase, ballVx: state.ball.vx }
  }, [playSound, state.ball.vx, state.lives, state.phase, state.score])

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
    ArrowLeft: (deltaMs) => dispatch({ type: 'movePaddle', centerX: state.paddleX + PADDLE_WIDTH / 2 - KEYBOARD_PADDLE_SPEED * deltaMs / 1000 }),
    a: (deltaMs) => dispatch({ type: 'movePaddle', centerX: state.paddleX + PADDLE_WIDTH / 2 - KEYBOARD_PADDLE_SPEED * deltaMs / 1000 }),
    ArrowRight: (deltaMs) => dispatch({ type: 'movePaddle', centerX: state.paddleX + PADDLE_WIDTH / 2 + KEYBOARD_PADDLE_SPEED * deltaMs / 1000 }),
    d: (deltaMs) => dispatch({ type: 'movePaddle', centerX: state.paddleX + PADDLE_WIDTH / 2 + KEYBOARD_PADDLE_SPEED * deltaMs / 1000 }),
  }, state.phase !== 'paused' && state.phase !== 'over' && state.phase !== 'won')

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
    if (state.phase === 'paused' || state.phase === 'over' || state.phase === 'won') return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width === 0) return
    const centerX = ((event.clientX - bounds.left) / bounds.width) * BREAKOUT_WIDTH
    dispatch({ type: 'movePaddle', centerX })
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
    <section className="snake-view breakout-view" aria-labelledby="breakout-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout breakout-layout">
        <div className="snake-copy breakout-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="breakout-title">Breakout<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Clear the wall one brick at a time. Keep the ball in play and make every bounce count.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Move with the left and right arrow keys or A and D. Press Space to launch. On a phone, drag across the field to steer the paddle.</p>
          </div>
          <div className="score-card breakout-score" aria-label={`Score: ${state.score}. ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} remaining. ${bestScore === null ? 'No personal best yet.' : `Local best: ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">THIS RUN</span>
              <strong className="score-value">{String(state.score).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats">
              <span><strong>{state.lives}</strong> {state.lives === 1 ? 'life' : 'lives'}</span>
              <span><strong>{remaining}</strong> bricks</span>
            </div>
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
            ) : state.phase === 'ready' && isFresh ? (
              <button className="button button-primary" type="button" onClick={start}>Start game <span aria-hidden="true">→</span></button>
            ) : state.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Launch ball <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={restart}>Play again</button>
            )}
            {(!isFresh || state.phase === 'playing' || state.phase === 'paused') && state.phase !== 'over' && state.phase !== 'won' && (
              <button className="button button-quiet" type="button" onClick={restart}>Restart</button>
            )}
          </div>
          <p className="keyboard-hint">Space to launch · Esc to pause · R to restart</p>
        </div>

        <div className="play-column breakout-play-column">
          <div className="breakout-console">
            <div className="frame-topline">
              <span>FIELD 04</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <div
              ref={boardRef}
              className={`breakout-field phase-${state.phase}`}
              tabIndex={0}
              role="group"
              aria-label="Breakout playfield"
              aria-describedby="breakout-instructions"
              onKeyDown={handleKeyDown}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
            >
              <div className="breakout-brick-wall" aria-hidden="true">
                {state.bricks.map((alive, index) => {
                  if (!alive) return null
                  const brick = breakoutBrickRect(index)
                  return <span key={index} className={`breakout-brick breakout-brick-row-${Math.floor(index / 8)}`} style={{ left: `${(brick.x / BREAKOUT_WIDTH) * 100}%`, top: `${(brick.y / BREAKOUT_HEIGHT) * 100}%`, width: `${(BRICK_WIDTH / BREAKOUT_WIDTH) * 100}%`, height: `${(BRICK_HEIGHT / BREAKOUT_HEIGHT) * 100}%` }} />
                })}
              </div>
              <span className="breakout-paddle" aria-hidden="true" style={{ left: `${(state.paddleX / BREAKOUT_WIDTH) * 100}%`, top: `${(PADDLE_Y / BREAKOUT_HEIGHT) * 100}%`, width: `${(PADDLE_WIDTH / BREAKOUT_WIDTH) * 100}%`, height: `${(PADDLE_HEIGHT / BREAKOUT_HEIGHT) * 100}%` }} />
              <span className="breakout-ball" aria-hidden="true" style={{ left: `${((state.ball.x - BALL_RADIUS) / BREAKOUT_WIDTH) * 100}%`, top: `${((state.ball.y - BALL_RADIUS) / BREAKOUT_HEIGHT) * 100}%`, width: `${(BALL_RADIUS * 2 / BREAKOUT_WIDTH) * 100}%`, height: `${(BALL_RADIUS * 2 / BREAKOUT_HEIGHT) * 100}%` }} />
              {state.phase !== 'playing' && (
                <div className="breakout-overlay" aria-hidden="true">
                  <strong>{state.phase === 'ready' ? (isFresh ? 'Ready to play?' : 'Ball lost') : state.phase === 'paused' ? 'Paused' : state.phase === 'won' ? 'Wall cleared!' : 'Run over'}</strong>
                  <span>{state.phase === 'ready' ? (isFresh ? 'Clear the wall. Keep the ball up.' : 'Launch again when you are ready.') : state.phase === 'paused' ? 'Take a breath, then resume.' : state.phase === 'won' ? `All bricks cleared · ${state.score} points` : `Final score · ${state.score} points`}</span>
                </div>
              )}
            </div>
            <div className="breakout-console-footer"><span>ARROWS / WASD · SPACE</span><span>{remaining} BRICKS</span></div>
          </div>
          <p id="breakout-instructions" className="breakout-status" role="status" aria-live="polite">{state.message} {state.phase === 'playing' ? 'Move the paddle with the arrow keys or drag in the field.' : ''}</p>
        </div>
      </div>
    </section>
  )
}
