import { useEffect, useReducer, useRef } from 'react'
import { dailyPatternForDate, utcDateKey } from './dailyPattern'
import { createPatternState, patternReducer } from './pattern'

const tileNames = ['Top left', 'Top right', 'Bottom left', 'Bottom right']

export function PatternGame({ onBack, bestRounds, onRecordRounds, dailyCompletedDate, onDailyComplete }: {
  onBack: () => void
  bestRounds: number | null
  onRecordRounds: (rounds: number) => void
  dailyCompletedDate: string | null
  onDailyComplete: (date: string) => void
}) {
  const [game, dispatch] = useReducer(patternReducer, undefined, createPatternState)
  const dailyRunDate = useRef<string | null>(null)
  const canRestart = game.phase === 'showing' || game.phase === 'input' || game.phase === 'paused'
  const completedToday = dailyCompletedDate === utcDateKey()

  useEffect(() => {
    if (game.phase !== 'showing') return
    const delay = game.activeTile === null ? 300 : 440
    const timer = window.setTimeout(() => dispatch({ type: 'advance' }), delay)
    return () => window.clearTimeout(timer)
  }, [game.phase, game.activeTile, game.showIndex, game.sequence.length])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) dispatch({ type: 'pause' })
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [])

  useEffect(() => {
    if (game.completedRounds > (bestRounds ?? 0)) onRecordRounds(game.completedRounds)
  }, [game.completedRounds, bestRounds, onRecordRounds])

  const startPractice = () => dispatch({ type: 'start', tile: randomTile() })
  const startDaily = () => {
    const date = utcDateKey()
    dailyRunDate.current = date
    dispatch({ type: 'startDaily', sequence: dailyPatternForDate(date) })
  }
  const restart = () => game.mode === 'daily' ? startDaily() : dispatch({ type: 'reset' })
  const choose = (tile: number) => {
    if (game.phase !== 'input') return
    if (game.mode === 'daily' && game.inputIndex === game.sequence.length - 1 && game.sequence[game.inputIndex] === tile) {
      onDailyComplete(dailyRunDate.current ?? utcDateKey())
    }
    dispatch({ type: 'choose', tile, nextTile: game.mode === 'daily' ? 0 : randomTile() })
  }

  const phaseLabels = {
    ready: 'READY',
    showing: 'WATCH',
    input: 'REPEAT',
    paused: 'PAUSED',
    failed: 'ROUND OVER',
    complete: 'COMPLETE',
  }
  const footerProgress = game.phase === 'input'
    ? `REPEAT ${game.inputIndex + 1} / ${game.sequence.length}`
    : game.phase === 'complete'
      ? `COMPLETE ${game.sequence.length} / ${game.sequence.length}`
    : game.sequence.length > 0
      ? `PATTERN ${game.sequence.length} ${game.sequence.length === 1 ? 'TILE' : 'TILES'}`
      : 'PATTERN —'
  const bestReadout = bestRounds === null ? 'none yet' : String(bestRounds)
  const patternProgress = game.mode === 'daily' ? game.inputIndex : game.completedRounds
  const scoreDescription = game.mode === 'daily'
    ? `Daily challenge progress: ${game.inputIndex} of ${game.sequence.length} tiles repeated.`
    : `Rounds cleared this run: ${game.completedRounds}. Local best: ${bestReadout}.`

  return (
    <section className="snake-view pattern-view" aria-labelledby="pattern-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout pattern-layout">
        <div className="snake-copy pattern-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="pattern-title">Remember<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Practice a growing pattern, or take on the same eight-tile challenge as everyone today.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Practice adds one tile each round. The daily challenge has a shared eight-tile sequence. Watch the lights, then repeat them in order. A mistake ends the run.</p>
          </div>
          <div className="score-card" aria-label={scoreDescription}>
            <span className="score-caption">{game.mode === 'daily' ? 'TILES REPEATED' : 'ROUNDS CLEARED'}</span>
            <strong className="score-value">{String(patternProgress).padStart(2, '0')}</strong>
            <span className="score-unit">{game.mode === 'daily' ? `of ${game.sequence.length} tiles` : 'in this run'}</span>
            {game.mode === 'practice' && (
              <div className="local-best-readout">
                <span className="score-caption">BEST IN THIS BROWSER</span>
                <strong className="score-value">{bestRounds === null ? '—' : String(bestRounds).padStart(2, '0')}</strong>
                <span className="score-unit">rounds</span>
              </div>
            )}
          </div>
          <div className="game-actions">
            {game.phase === 'ready' ? (
              <div className="pattern-start-actions">
                <button className="button button-primary" type="button" onClick={startPractice}>Start practice <span aria-hidden="true">→</span></button>
                <button className="button button-secondary" type="button" onClick={startDaily}>Daily challenge <span aria-hidden="true">→</span></button>
              </div>
            ) : game.phase === 'failed' ? (
              <button className="button button-primary" type="button" onClick={game.mode === 'daily' ? startDaily : startPractice}>{game.mode === 'daily' ? 'Try daily again' : 'Play again'} <span aria-hidden="true">→</span></button>
            ) : game.phase === 'complete' ? (
              <>
                <button className="button button-primary" type="button" onClick={startDaily}>Try daily again <span aria-hidden="true">→</span></button>
                <button className="button button-quiet" type="button" onClick={() => dispatch({ type: 'reset' })}>Practice</button>
              </>
            ) : game.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={() => dispatch({ type: 'resume' })}>Resume <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            )}
            {canRestart && <button className="button button-quiet" type="button" onClick={restart}>Restart</button>}
          </div>
          {completedToday && game.phase !== 'complete' && (
            <p className="daily-completion-note">Today's shared challenge is complete in this browser. You can still play it again.</p>
          )}
          <p className="keyboard-hint">Tab to a tile. Press Enter or Space to repeat it.</p>
        </div>

        <div className="play-column pattern-play-column">
          <div className={`pattern-console phase-${game.phase}`}>
            <div className="frame-topline">
              <span>{game.mode === 'daily' ? 'DAILY PATTERN · UTC' : `ROUND ${String(game.sequence.length || 1).padStart(2, '0')}`}</span>
              <span className="frame-light"><i /> {phaseLabels[game.phase]}</span>
            </div>
            <div className="pattern-board" role="group" aria-label="Four pattern tiles">
              {tileNames.map((name, tile) => (
                <button
                  className={`pattern-tile pattern-tile-${tile}${game.activeTile === tile ? ' tile-active' : ''}${game.failedTile === tile && game.phase === 'failed' ? ' tile-error' : ''}`}
                  type="button"
                  key={name}
                  aria-label={`${name} tile, ${tile + 1}`}
                  aria-pressed={game.activeTile === tile || (game.phase === 'failed' && game.failedTile === tile)}
                  aria-disabled={game.phase !== 'input'}
                  onClick={() => choose(tile)}
                >
                  <span aria-hidden="true">{tile + 1}</span>
                </button>
              ))}
            </div>
            <div className="pattern-console-footer">
              <span>TOUCH · CLICK · ENTER · SPACE</span>
              <span>{footerProgress}</span>
            </div>
          </div>
          <p className="pattern-status" role="status" aria-live="polite" aria-atomic="true">{game.message}</p>
        </div>
      </div>
    </section>
  )
}

function randomTile() {
  return Math.floor(Math.random() * 4)
}
