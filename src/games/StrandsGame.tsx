import { useEffect, useReducer, useRef } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createStrandsState,
  strandsProgress,
  strandsReducer,
  type StrandsAction,
  type StrandsProgress,
} from './strands'

interface StrandsGameProps {
  onBack: () => void
  bestHints: number | null
  progress: StrandsProgress | null
  onSaveProgress: (progress: StrandsProgress) => void
}

export function StrandsGame({ onBack, bestHints, progress, onSaveProgress }: StrandsGameProps) {
  const today = utcDateKey()
  const firstCellRef = useRef<HTMLButtonElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    strandsReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createStrandsState(date, saved),
  )
  const foundIndexes = new Map<string, number>()
  state.foundWords.forEach((word, index) => foundIndexes.set(word, index))
  const foundCellWords = new Map<number, string>()
  for (const word of state.foundWords) {
    for (const index of state.paths[word]!) foundCellWords.set(index, word)
  }
  const selectionWord = state.selection.map((index) => state.grid[index]!).join('')

  useEffect(() => {
    firstCellRef.current?.focus()
  }, [])

  const sendAction = (action: StrandsAction) => {
    const next = strandsReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (action.type === 'hint' || next.foundWords.length > state.foundWords.length) {
      onSaveProgress(strandsProgress(next))
    }
    if (next.foundWords.length > state.foundWords.length) {
      playSound(next.phase === 'complete' ? 'win' : 'score')
    }
  }

  return (
    <section className="snake-view strands-view" aria-labelledby="strands-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout strands-layout">
        <div className="snake-copy strands-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY WORD SEARCH · UTC</p>
          <h1 id="strands-title">Strands<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Trace the theme through a tangled field of letters.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Find five theme words and one spanning word. Tap neighboring letters in order; diagonal steps count. The spanning word touches both sides of the board.</p>
          </div>
          <div className="score-card strands-score" aria-label={`${state.foundWords.length} of 6 words found. ${state.hintsUsed} hints used. ${bestHints === null ? 'No personal best yet.' : `Best: ${bestHints} hints.`}`}>
            <div className="strands-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.foundWords.length}<small> / 6</small></strong>
              <span className="score-unit">words found</span>
            </div>
            <div className="strands-run-stat">
              <span className="score-caption">HINTS</span>
              <strong className="score-value">{state.hintsUsed}</strong>
              <span className="score-unit">used</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST · THIS BROWSER</span>
              <strong className="score-value">{bestHints === null ? '—' : bestHints}</strong>
              <span className="score-unit">{bestHints === 1 ? 'hint' : 'hints'}</span>
            </div>
          </div>
          <p className="strands-theme"><span>THEME</span><strong>{state.theme}</strong></p>
          <p className="strands-local-note">The same board is shared for this UTC date. Progress and your fewest hints stay in this browser.</p>
        </div>

        <div className="play-column strands-play-column">
          <div className="strands-console">
            <div className="frame-topline">
              <span>FIELD 13</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'LIVE' : 'SOLVED'}</span>
            </div>

            <div className="strands-found" aria-label="Words found">
              {state.foundWords.length > 0 ? state.foundWords.map((word) => (
                <span className={word === state.spangram ? 'strands-found-spangram' : ''} key={word}>
                  {word === state.spangram ? '★ ' : ''}{word}
                </span>
              )) : <span className="strands-found-empty">Your words will appear here.</span>}
            </div>

            {state.phase === 'playing' ? (
              <div className="strands-grid" role="group" aria-label="Six rows of eight letters. Select neighboring letters to trace a word." aria-describedby="strands-status">
                {state.grid.map((letter, index) => {
                  const row = Math.floor(index / 8)
                  const column = index % 8
                  const selectedAt = state.selection.indexOf(index)
                  const foundWord = foundCellWords.get(index)
                  const foundNumber = foundWord ? foundIndexes.get(foundWord)! : -1
                  const classes = [
                    'strands-cell',
                    selectedAt >= 0 ? 'cell-selected' : '',
                    foundNumber >= 0 ? `cell-found cell-found-${foundNumber}` : '',
                    foundWord === state.spangram ? 'cell-spangram' : '',
                    state.hintedCells.includes(index) && !foundWord ? 'cell-hinted' : '',
                  ].filter(Boolean).join(' ')
                  const selectedText = selectedAt >= 0 ? `, step ${selectedAt + 1} in current path` : ''
                  const foundText = foundWord ? `, part of ${foundWord === state.spangram ? 'the spanning word' : 'a found word'}` : ''
                  const hintText = state.hintedCells.includes(index) && !foundWord ? ', hint revealed' : ''
                  return (
                    <button
                      key={index}
                      ref={index === 0 ? firstCellRef : undefined}
                      className={classes}
                      type="button"
                      aria-label={`Row ${row + 1}, column ${column + 1}, ${letter}${selectedText}${foundText}${hintText}`}
                      aria-pressed={selectedAt >= 0}
                      onClick={() => sendAction({ type: 'select', index })}
                    >
                      {letter}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="strands-complete" role="status">
                <span>BOARD SOLVED</span>
                <strong>All five theme words and the spanning word found.</strong>
                <small>A fresh board arrives tomorrow.</small>
              </div>
            )}

            {state.phase === 'playing' && (
              <>
                <div className="strands-selection" aria-label="Current path">
                  <span>PATH</span><strong>{selectionWord || '—'}</strong>
                </div>
                <div className="strands-actions">
                  <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'undo' })} disabled={state.selection.length === 0}>Undo</button>
                  <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'clear' })} disabled={state.selection.length === 0}>Clear path</button>
                  <button className="button button-primary" type="button" onClick={() => sendAction({ type: 'hint' })} disabled={state.hintsUsed >= 48}>Hint</button>
                </div>
              </>
            )}

            <p className="strands-status" id="strands-status" role="status" aria-live="polite">{state.message}</p>
            <div className="strands-console-footer"><span>ROW {state.selection.length ? Math.floor(state.selection.at(-1)! / 8) + 1 : '—'}</span><span>{state.foundWords.length} / 6 FOUND</span></div>
          </div>
          <p className="strands-keyboard-hint">Tab to a letter · Enter or Space to select · Undo the last step</p>
        </div>
      </div>
    </section>
  )
}
