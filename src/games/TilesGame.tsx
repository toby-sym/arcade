import { useEffect, useReducer, useRef } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import { createTilesState, isTilesIndexFree, TILE_PATTERNS, tilesProgress, tilesReducer, type TilesAction, type TilesProgress } from './tiles'

interface TilesGameProps {
  onBack: () => void
  bestMistakes: number | null
  progress: TilesProgress | null
  onSaveProgress: (progress: TilesProgress) => void
}

export function TilesGame({ onBack, bestMistakes, progress, onSaveProgress }: TilesGameProps) {
  const today = utcDateKey()
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([])
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    tilesReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createTilesState(date, saved),
  )

  useEffect(() => {
    const firstFree = state.patterns.findIndex((_, index) => isTilesIndexFree(index, state.clearedIndices))
    if (firstFree >= 0) tileRefs.current[firstFree]?.focus()
  }, [])

  const sendAction = (action: TilesAction) => {
    const next = tilesReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (next.moves !== state.moves) onSaveProgress(tilesProgress(next))
    if (next.clearedIndices.length > state.clearedIndices.length) {
      playSound(next.phase === 'complete' ? 'win' : 'score')
    } else if (next.mistakes > state.mistakes) {
      playSound('miss')
    }
  }

  const resetDisabled = state.phase === 'complete'
    || (state.clearedIndices.length === 0 && state.moves === 0 && state.selectedIndex === null)

  return (
    <section className="snake-view tiles-view" aria-labelledby="tiles-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout tiles-layout">
        <div className="snake-copy tiles-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY PATTERNS · UTC</p>
          <h1 id="tiles-title">Tiles<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Clear today’s patterns from the open edges inward.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>All twenty patterns stay visible. Match identical free tiles to clear them. A tile is free when its left or right side is open; blocked tiles become available as their neighbors are cleared.</p>
          </div>
          <div className="score-card tiles-score" aria-label={`${state.moves} moves and ${state.mistakes} ${state.mistakes === 1 ? 'mistake' : 'mistakes'}. ${bestMistakes === null ? 'No personal best yet.' : `Best solve: ${bestMistakes} mistakes.`}`}>
            <div className="tiles-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.clearedIndices.length / 2}<small> / 10</small></strong>
              <span className="score-unit">pairs cleared</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestMistakes === null ? '—' : bestMistakes}</strong>
              <span className="score-unit">{bestMistakes === 1 ? 'mistake' : 'mistakes'}</span>
            </div>
          </div>
          <p className="tiles-local-note">Your daily clears and best solve stay in this browser. They do not sync.</p>
        </div>

        <div className="play-column tiles-play-column">
          <div className="tiles-console">
            <div className="frame-topline">
              <span>FIELD 20</span>
              <span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i />{state.phase === 'complete' ? 'SOLVED' : `${state.moves} ${state.moves === 1 ? 'MOVE' : 'MOVES'}`}</span>
            </div>
            <div className="tiles-board" role="group" aria-label="Four row by five column pattern matching board">
              {state.patterns.map((pattern, index) => {
                const cleared = state.clearedIndices.includes(index)
                const free = isTilesIndexFree(index, state.clearedIndices)
                const selected = state.selectedIndex === index
                const patternName = TILE_PATTERNS.find((item) => item.id === pattern)!.id
                const patternIndex = TILE_PATTERNS.findIndex((item) => item.id === pattern)
                return (
                  <button
                    className={`tiles-tile tiles-pattern-${patternIndex}${free ? ' tiles-tile-free' : ' tiles-tile-blocked'}${selected ? ' tiles-tile-selected' : ''}${cleared ? ' tiles-tile-cleared' : ''}`}
                    type="button"
                    key={index}
                    ref={(element) => { tileRefs.current[index] = element }}
                    aria-label={cleared ? `Tile ${index + 1}, ${patternName}, pair cleared` : `Tile ${index + 1}, ${patternName}, ${free ? 'free' : 'blocked'}${selected ? ', selected' : ''}`}
                    aria-pressed={selected}
                    disabled={!free || cleared || state.phase === 'complete'}
                    onClick={() => sendAction({ type: 'select', index })}
                  >
                    <span aria-hidden="true">{cleared ? '' : TILE_PATTERNS.find((item) => item.id === pattern)!.symbol}</span>
                  </button>
                )
              })}
            </div>
            <div className="tiles-actions">
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'restart' })} disabled={resetDisabled}>Restart board</button>
            </div>
            <p className="tiles-status" role="status" aria-live="polite">{state.message}</p>
            <div className="tiles-console-footer"><span>CLICK · TOUCH · TAB · ENTER</span><span>{state.mistakes} {state.mistakes === 1 ? 'MISTAKE' : 'MISTAKES'}</span></div>
          </div>
          <p className="tiles-keyboard-hint">Select a free tile with Enter or Space. Blocked patterns unlock when a side opens.</p>
        </div>
      </div>
    </section>
  )
}
