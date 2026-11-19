import { useEffect, useReducer, useRef } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  connectionsProgress,
  connectionsReducer,
  createConnectionsState,
  visibleConnectionsWords,
  type ConnectionsAction,
  type ConnectionsProgress,
} from './connections'

interface ConnectionsGameProps {
  onBack: () => void
  bestMistakes: number | null
  progress: ConnectionsProgress | null
  onSaveProgress: (progress: ConnectionsProgress) => void
}

export function ConnectionsGame({ onBack, bestMistakes, progress, onSaveProgress }: ConnectionsGameProps) {
  const today = utcDateKey()
  const firstWordRef = useRef<HTMLButtonElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    connectionsReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createConnectionsState(date, saved),
  )
  const solvedGroups = state.groups.filter((group) => state.solvedGroupIds.includes(group.id))
  const words = visibleConnectionsWords(state)

  useEffect(() => {
    firstWordRef.current?.focus()
  }, [])

  const sendAction = (action: ConnectionsAction) => {
    const next = connectionsReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (action.type !== 'shuffle') onSaveProgress(connectionsProgress(next))
    if (next.solvedGroupIds.length > state.solvedGroupIds.length) {
      playSound(next.phase === 'won' ? 'win' : 'score')
    } else if (next.mistakes > state.mistakes && next.phase === 'lost') {
      playSound('lose')
    }
  }

  return (
    <section className="snake-view connections-view" aria-labelledby="connections-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout connections-layout">
        <div className="snake-copy connections-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY GROUPING · UTC</p>
          <h1 id="connections-title">Connections<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Sixteen words. Four ideas hiding in plain sight.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Choose four words that share a connection, then submit them. Find all four groups before you make four mistakes. Some words could fit more than one idea.</p>
          </div>
          <div className="score-card connections-score" aria-label={`Groups found: ${state.solvedGroupIds.length} of 4. Mistakes: ${state.mistakes} of 4. ${state.phase === 'won' ? 'Board solved.' : state.phase === 'lost' ? 'Board complete.' : 'Board in progress.'} ${bestMistakes === null ? 'No personal best yet.' : `Best: ${bestMistakes} mistakes.`}`}>
            <div className="connections-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.solvedGroupIds.length}<small> / 4</small></strong>
              <span className="score-unit">groups found</span>
            </div>
            <div className="connections-run-stat">
              <span className="score-caption">MISTAKES</span>
              <strong className="score-value">{state.mistakes}<small> / 4</small></strong>
              <span className="score-unit">used</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST · THIS BROWSER</span>
              <strong className="score-value">{bestMistakes === null ? '—' : bestMistakes}</strong>
              <span className="score-unit">{bestMistakes === 1 ? 'mistake' : 'mistakes'}</span>
            </div>
          </div>
          <p className="keyboard-hint">Select four words · Submit the set</p>
          <p className="connections-local-note">The same board is shared for this UTC date. Progress and your fewest mistakes stay in this browser.</p>
        </div>

        <div className="play-column connections-play-column">
          <div className="connections-console">
            <div className="frame-topline">
              <span>FIELD 11</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()}</span>
            </div>

            {solvedGroups.length > 0 && (
              <div className="connections-found" aria-label="Groups found">
                {solvedGroups.map((group) => (
                  <div className={`connections-found-group group-${group.color}`} key={group.id}>
                    <strong>{group.label}</strong>
                    <span>{group.words.join(' · ')}</span>
                  </div>
                ))}
              </div>
            )}

            {state.phase === 'lost' && (
              <div className="connections-found connections-solutions" aria-label="Remaining groups">
                {state.groups.filter((group) => !state.solvedGroupIds.includes(group.id)).map((group) => (
                  <div className={`connections-found-group group-${group.color}`} key={group.id}>
                    <strong>{group.label}</strong>
                    <span>{group.words.join(' · ')}</span>
                  </div>
                ))}
              </div>
            )}

            {state.phase === 'playing' ? (
              <div className="connections-grid" role="group" aria-label="Sixteen words. Select four that share a connection." aria-describedby="connections-status">
                {words.map((word, index) => (
                  <button
                    key={word}
                    ref={index === 0 ? firstWordRef : undefined}
                    className={`connections-tile${state.selectedWords.includes(word) ? ' tile-selected' : ''}`}
                    type="button"
                    aria-pressed={state.selectedWords.includes(word)}
                    onClick={() => sendAction({ type: 'toggle', word })}
                  >
                    {word}
                  </button>
                ))}
              </div>
            ) : (
              <div className={`connections-result phase-${state.phase}`} role="status">
                <span>{state.phase === 'won' ? 'BOARD SOLVED' : 'BOARD COMPLETE'}</span>
                <strong>{state.phase === 'won' ? 'All four groups found.' : 'A fresh board arrives tomorrow.'}</strong>
              </div>
            )}

            {state.phase === 'playing' && (
              <div className="connections-actions">
                <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'shuffle' })}>Shuffle</button>
                <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'clear' })} disabled={state.selectedWords.length === 0}>Deselect all</button>
                <button className="button button-primary connections-submit" type="button" onClick={() => sendAction({ type: 'submit' })} disabled={state.selectedWords.length !== 4}>Submit set</button>
              </div>
            )}

            <div className="connections-console-footer"><span>DAILY BOARD · {state.date}</span><span>{state.phase === 'playing' ? `${4 - state.mistakes} MISTAKES LEFT` : 'SEE YOU TOMORROW'}</span></div>
          </div>
          <p id="connections-status" className="connections-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}
