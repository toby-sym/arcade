import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useHeldKeys } from '../hooks/useHeldKeys'
import { useArcadeSound } from '../audio/arcadeAudio'
import { createInvadersState, invadersReducer } from './invaders'

interface InvadersGameProps {
  onBack: () => void
  bestScore: number | null
  onRecordScore: (score: number) => void
}

export function InvadersGame({ onBack, bestScore, onRecordScore }: InvadersGameProps) {
  const [state, dispatch] = useReducer(invadersReducer, undefined, createInvadersState)
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const previousAudioState = useRef({ score: state.score, phase: state.phase })
  const isFresh = state.score === 0 && state.lives === 3 && state.playerX === 50

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 50)
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
    previousAudioState.current = { score: state.score, phase: state.phase }
  }, [playSound, state.phase, state.score])

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
    ArrowLeft: () => dispatch({ type: 'movePlayer', amount: -1.2 }),
    a: () => dispatch({ type: 'movePlayer', amount: -1.2 }),
    ArrowRight: () => dispatch({ type: 'movePlayer', amount: 1.2 }),
    d: () => dispatch({ type: 'movePlayer', amount: 1.2 }),
  }, state.phase !== 'paused' && state.phase !== 'over' && state.phase !== 'won')

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    handleHeldKey(event)
    if (event.defaultPrevented) return

    if (event.code === 'Space') {
      event.preventDefault()
      if (state.phase === 'ready') {
        dispatch({ type: 'start' })
        dispatch({ type: 'shoot' })
        playSound('fire')
      } else if (state.phase === 'playing') {
        if (state.playerShots.length === 0) playSound('fire')
        dispatch({ type: 'shoot' })
      }
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

  const statusLabel = state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()

  return (
    <section className="snake-view invaders-view" aria-labelledby="invaders-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout invaders-layout">
        <div className="snake-copy invaders-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="invaders-title">Space Invaders<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Hold the line, pick your shots, and keep the formation out of the cabinet.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Move with the left and right arrows or A and D. Press Space or Fire to shoot. On a phone, use the direction buttons and Fire.</p>
          </div>
          <div className="score-card invaders-score" aria-label={`Score: ${state.score}. ${state.lives} ${state.lives === 1 ? 'ship' : 'ships'} remaining. ${bestScore === null ? 'No personal best yet.' : `Local best: ${bestScore} points.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">THIS RUN</span>
              <strong className="score-value">{String(state.score).padStart(3, '0')}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="breakout-stats"><span><strong>{state.lives}</strong> {state.lives === 1 ? 'ship' : 'ships'}</span><span><strong>{state.aliens.filter((alien) => alien.alive).length}</strong> invaders</span></div>
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
              <button className="button button-primary" type="button" onClick={start}>{isFresh ? 'Start game' : 'Continue'} <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-primary" type="button" onClick={playAgain}>Play again</button>
            )}
            {(!isFresh || state.phase === 'playing' || state.phase === 'paused') && state.phase !== 'over' && state.phase !== 'won' && (
              <button className="button button-quiet" type="button" onClick={restart}>Restart</button>
            )}
          </div>
          <p className="keyboard-hint">Arrows / A D to move · Space to fire · Esc to pause · R to restart</p>
        </div>

        <div className="play-column invaders-play-column">
          <div className="invaders-console">
            <div className="frame-topline">
              <span>FIELD 06</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {statusLabel}</span>
            </div>
            <div
              ref={boardRef}
              className={`invaders-field phase-${state.phase}`}
              tabIndex={0}
              role="group"
              aria-label="Space Invaders playfield"
              aria-describedby="invaders-instructions"
              onKeyDown={handleKeyDown}
            >
              {state.aliens.filter((alien) => alien.alive).map((alien) => (
                <span key={alien.id} className={`invader invader-row-${alien.row}`} style={{ left: `${alien.x}%`, top: `${alien.y}%` }} />
              ))}
              {state.playerShots.map((shot, index) => <span key={`player-shot-${index}`} className="invader-shot invader-player-shot" aria-hidden="true" style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />)}
              {state.enemyShots.map((shot, index) => <span key={`enemy-shot-${index}`} className="invader-shot invader-enemy-shot" aria-hidden="true" style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />)}
              <span className="invader-player" aria-hidden="true" style={{ left: `${state.playerX}%` }} />
              {state.phase !== 'playing' && (
                <div className="invaders-overlay" aria-hidden="true">
                  <strong>{state.phase === 'ready' ? 'Defend the cabinet' : state.phase === 'paused' ? 'Paused' : state.phase === 'won' ? 'Formation cleared!' : 'Game over'}</strong>
                  <span>{state.phase === 'ready' ? 'The squadron is moving in.' : state.phase === 'paused' ? 'Take a breath, then resume.' : state.phase === 'won' ? `${state.score} points · nice shooting.` : `Final score · ${state.score} points`}</span>
                </div>
              )}
            </div>
            <div className="invaders-console-footer"><span>ARROWS / A D · SPACE</span><span>{state.lives} SHIPS</span></div>
          </div>
          <div className="invaders-touch-controls" role="group" aria-label="Touch controls">
            <button className="dpad-button" type="button" aria-label="Move left" onClick={() => dispatch({ type: 'movePlayer', amount: -8 })}>←</button>
            <button className="button button-primary invaders-fire-button" type="button" disabled={state.phase !== 'playing' && state.phase !== 'ready'} onClick={() => { if (state.phase === 'ready') dispatch({ type: 'start' }); if (state.playerShots.length === 0) playSound('fire'); dispatch({ type: 'shoot' }) }}>Fire</button>
            <button className="dpad-button" type="button" aria-label="Move right" onClick={() => dispatch({ type: 'movePlayer', amount: 8 })}>→</button>
          </div>
          <p id="invaders-instructions" className="invaders-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}
