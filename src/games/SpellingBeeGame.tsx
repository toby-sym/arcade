import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createSpellingBeeState,
  scoreSpellingBeeWord,
  spellingBeeProgress,
  spellingBeeReducer,
  visibleSpellingBeeLetters,
  type SpellingBeeAction,
  type SpellingBeeProgress,
} from './spellingBee'

interface SpellingBeeGameProps {
  onBack: () => void
  bestScore: number | null
  progress: SpellingBeeProgress | null
  onSaveProgress: (progress: SpellingBeeProgress) => void
}

const HIVE_POSITIONS = ['hive-top', 'hive-upper-left', 'hive-upper-right', 'hive-center', 'hive-lower-left', 'hive-lower', 'hive-lower-right']

export function SpellingBeeGame({ onBack, bestScore, progress, onSaveProgress }: SpellingBeeGameProps) {
  const today = utcDateKey()
  const playfieldRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    spellingBeeReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createSpellingBeeState(date, saved),
  )
  const foundWords = [...state.foundWords].sort()
  const letters = visibleSpellingBeeLetters(state)
  const progressPercent = state.maxScore === 0 ? 0 : Math.round(state.score / state.maxScore * 100)

  useEffect(() => {
    playfieldRef.current?.focus()
  }, [])

  const sendAction = (action: SpellingBeeAction) => {
    const next = spellingBeeReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (next.foundWords.length > state.foundWords.length) {
      onSaveProgress(spellingBeeProgress(next))
      playSound(next.phase === 'complete' ? 'win' : 'score')
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) return
    if (event.key === 'Enter') {
      event.preventDefault()
      sendAction({ type: 'submit' })
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      sendAction({ type: 'backspace' })
    } else if (/^[a-z]$/i.test(event.key)) {
      event.preventDefault()
      sendAction({ type: 'letter', letter: event.key })
    }
  }

  return (
    <section className="snake-view spelling-bee-view" aria-labelledby="spelling-bee-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout spelling-bee-layout">
        <div className="snake-copy spelling-bee-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY LETTER HIVE · UTC</p>
          <h1 id="spelling-bee-title">Spelling Bee<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Seven letters. Find as many words as you can.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Make words of four or more letters. Every word must use the centre letter; other letters can repeat. Use all seven letters in one word for a pangram bonus.</p>
          </div>
          <div className="score-card spelling-bee-score" aria-label={`Score: ${state.score} of ${state.maxScore} points. ${state.foundWords.length} of ${state.words.length} words found. ${bestScore === null ? 'No personal best yet.' : `Best in this browser: ${bestScore} points.`}`}>
            <div className="bee-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.score}<small> / {state.maxScore}</small></strong>
              <span className="score-unit">points</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST · THIS BROWSER</span>
              <strong className="score-value">{bestScore === null ? '—' : bestScore}</strong>
              <span className="score-unit">points</span>
            </div>
            <div className="bee-progress-readout">
              <div className="bee-progress-caption"><span>WORDS FOUND</span><span>{state.foundWords.length} / {state.words.length}</span></div>
              <div className="bee-progress-track" role="progressbar" aria-label="Daily word list progress" aria-valuemin={0} aria-valuemax={state.words.length} aria-valuenow={state.foundWords.length}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>
          <p className="keyboard-hint">Type letters · Enter to submit · Backspace to edit</p>
          <p className="spelling-bee-local-note">The same hive is shared for this UTC date. Your found words and best score stay in this browser.</p>
        </div>

        <div className="play-column spelling-bee-play-column" onKeyDown={handleKeyDown}>
          <div className="spelling-bee-console">
            <div className="frame-topline">
              <span>FIELD 12</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'LIVE' : 'CLEARED'}</span>
            </div>

            <div
              ref={playfieldRef}
              className={`spelling-bee-playfield phase-${state.phase}`}
              role="group"
              aria-label={`Spelling Bee letter hive. Centre letter ${state.center}. ${state.foundWords.length} of ${state.words.length} words found.`}
              tabIndex={0}
            >
              <div className="spelling-bee-current-word" aria-label={`Current word: ${state.draft || 'empty'}`}>
                <span>{state.draft || 'TYPE A WORD'}</span>
                {state.draft && <button className="bee-clear-word" type="button" aria-label="Clear current word" onClick={() => sendAction({ type: 'clear' })}>×</button>}
              </div>

              {state.phase === 'playing' ? (
                <div className="spelling-bee-hive" role="group" aria-label="Seven letters. The centre letter is required in every word.">
                  {letters.map((letter, index) => (
                    <button
                      className={`spelling-bee-letter ${HIVE_POSITIONS[index]}${letter === state.center ? ' bee-center-letter' : ''}`}
                      key={`${letter}-${index}`}
                      type="button"
                      aria-label={`Letter ${letter}${letter === state.center ? ', centre letter, required' : ''}`}
                      onClick={() => sendAction({ type: 'letter', letter })}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="spelling-bee-complete" role="status">
                  <span>HIVE CLEARED</span>
                  <strong>Every word found.</strong>
                  <small>A new hive arrives tomorrow.</small>
                </div>
              )}

              {state.phase === 'playing' && (
                <div className="spelling-bee-actions">
                  <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'shuffle' })}>Shuffle</button>
                  <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'backspace' })} disabled={!state.draft} aria-label="Delete last letter">⌫</button>
                  <button className="button button-quiet" type="button" onClick={() => sendAction({ type: 'clear' })} disabled={!state.draft}>Clear</button>
                  <button className="button button-primary bee-submit" type="button" onClick={() => sendAction({ type: 'submit' })} disabled={!state.draft}>Enter</button>
                </div>
              )}

              <div className="spelling-bee-console-footer"><span>DAILY HIVE · {state.date}</span><span>{state.phase === 'playing' ? 'REPEATS ALLOWED' : 'SEE YOU TOMORROW'}</span></div>
            </div>
          </div>

          <div className="spelling-bee-found" aria-labelledby="bee-found-title">
            <div className="bee-found-heading">
              <h2 id="bee-found-title">Found words</h2>
              <span>{state.foundWords.length} / {state.words.length}</span>
            </div>
            {foundWords.length > 0 ? (
              <ul className="bee-word-list">
                {foundWords.map((word) => (
                  <li key={word}>
                    <span>{word}</span>
                    {state.pangrams.includes(word) && <small>PANGRAM</small>}
                    <strong>+{scoreSpellingBeeWord(word, new Set([state.center, ...state.outer]))}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bee-no-words">Words you find will appear here.</p>
            )}
          </div>
          <p className="spelling-bee-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}
