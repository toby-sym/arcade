import { useEffect, useReducer } from 'react'
import { createPatternState, patternReducer } from './pattern'

const tileNames = ['Top left', 'Top right', 'Bottom left', 'Bottom right']

export function PatternGame({ onBack }: { onBack: () => void }) {
  const [game, dispatch] = useReducer(patternReducer, undefined, createPatternState)
  const active = game.phase === 'showing' || game.phase === 'input'

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

  const start = () => dispatch({ type: 'start', tile: randomTile() })
  const choose = (tile: number) => {
    if (game.phase !== 'input') return
    dispatch({ type: 'choose', tile, nextTile: randomTile() })
  }

  const phaseLabels = {
    ready: 'READY',
    showing: 'WATCH',
    input: 'REPEAT',
    paused: 'PAUSED',
    failed: 'ROUND OVER',
  }
  const footerProgress = game.phase === 'input'
    ? `REPEAT ${game.inputIndex + 1} / ${game.sequence.length}`
    : game.sequence.length > 0
      ? `PATTERN ${game.sequence.length} ${game.sequence.length === 1 ? 'TILE' : 'TILES'}`
      : 'PATTERN —'

  return (
    <section className="snake-view pattern-view" aria-labelledby="pattern-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout pattern-layout">
        <div className="snake-copy pattern-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="pattern-title">Remember<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Watch a growing pattern of lights. Then tap them back in the same order.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Start with one tile. Watch the lights, then repeat the pattern in order. Each round adds a tile. A mistake ends the run.</p>
          </div>
          <div className="score-card" aria-label={`${game.completedRounds} rounds cleared this run`}>
            <span className="score-caption">ROUNDS CLEARED</span>
            <strong className="score-value">{String(game.completedRounds).padStart(2, '0')}</strong>
            <span className="score-unit">in this run</span>
          </div>
          <div className="game-actions">
            {game.phase === 'ready' ? (
              <button className="button button-primary" type="button" onClick={start}>Start game <span aria-hidden="true">→</span></button>
            ) : game.phase === 'failed' ? (
              <button className="button button-primary" type="button" onClick={start}>Play again <span aria-hidden="true">→</span></button>
            ) : game.phase === 'paused' ? (
              <button className="button button-primary" type="button" onClick={() => dispatch({ type: 'resume' })}>Resume <span aria-hidden="true">→</span></button>
            ) : (
              <button className="button button-secondary" type="button" onClick={() => dispatch({ type: 'pause' })}>Pause <span className="pause-mark" aria-hidden="true"><i /><i /></span></button>
            )}
            {active && <button className="button button-quiet" type="button" onClick={() => dispatch({ type: 'reset' })}>Restart</button>}
          </div>
          <p className="keyboard-hint">Tab to a tile. Press Enter or Space to repeat it.</p>
        </div>

        <div className="play-column pattern-play-column">
          <div className={`pattern-console phase-${game.phase}`}>
            <div className="frame-topline">
              <span>ROUND {String(game.sequence.length || 1).padStart(2, '0')}</span>
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
