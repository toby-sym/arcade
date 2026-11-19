import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import { createDailyWordState, dailyWordReducer, getLetterStatuses, type DailyWordAction, type DailyWordProgress, type LetterMark } from './dailyWord'

interface DailyWordGameProps {
  onBack: () => void
  bestSolve: number | null
  progress: DailyWordProgress | null
  onSaveProgress: (progress: DailyWordProgress) => void
}

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL']

export function DailyWordGame({ onBack, bestSolve, progress, onSaveProgress }: DailyWordGameProps) {
  const today = utcDateKey()
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    dailyWordReducer,
    { date: today, guesses: progress?.date === today ? progress.guesses : [] },
    ({ date, guesses }) => createDailyWordState(date, guesses),
  )
  const keyStatuses = getLetterStatuses(state.guesses)

  useEffect(() => {
    boardRef.current?.focus()
  }, [])

  const sendAction = (action: DailyWordAction) => {
    const next = dailyWordReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (action.type === 'submit' && next.guesses.length > state.guesses.length) {
      onSaveProgress({ date: next.date, guesses: next.guesses.map((guess) => guess.word), phase: next.phase })
      if (next.phase === 'won' && state.phase !== 'won') {
        playSound('win')
      } else if (next.phase === 'lost' && state.phase !== 'lost') {
        playSound('lose')
      }
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
    <section className="snake-view wordgame-view" aria-labelledby="wordgame-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout wordgame-layout">
        <div className="snake-copy wordgame-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY WORD · UTC</p>
          <h1 id="wordgame-title">Word Guess<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">One five-letter word. Six rows to find it. A new puzzle each day.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Guess a five-letter word. Green letters are in the right place; gold letters belong somewhere else. A letter only counts once when it appears more than once.</p>
          </div>
          <div className="score-card wordgame-score" aria-label={`Today's guesses: ${state.guesses.length} of 6. ${state.phase === 'won' ? 'Puzzle solved.' : state.phase === 'lost' ? 'Puzzle complete.' : 'Puzzle in progress.'} ${bestSolve === null ? 'No personal best yet.' : `Best solve: ${bestSolve} guesses.`}`}>
            <div className="wordgame-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.guesses.length}<small> / 6</small></strong>
              <span className="score-unit">guesses used</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestSolve === null ? '—' : bestSolve}</strong>
              <span className="score-unit">{bestSolve === null ? 'guesses' : bestSolve === 1 ? 'guess' : 'guesses'}</span>
            </div>
          </div>
          <p className="keyboard-hint">Type letters · Enter to guess · Backspace to edit</p>
          <p className="wordgame-local-note">The daily word is the same for everyone on this UTC date. Your guesses and best solve stay in this browser.</p>
        </div>

        <div className="play-column wordgame-play-column" onKeyDown={handleKeyDown}>
          <div className="wordgame-console">
            <div className="frame-topline">
              <span>FIELD 10</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'LIVE' : state.phase.toUpperCase()}</span>
            </div>
            <div
              ref={boardRef}
              className={`wordgame-board phase-${state.phase}`}
              role="group"
              aria-label={`Daily Word playfield. ${state.guesses.length} of 6 guesses used.`}
              aria-describedby="wordgame-instructions"
              tabIndex={0}
            >
              {Array.from({ length: 6 }, (_, rowIndex) => {
                const submitted = state.guesses[rowIndex]
                const liveRow = rowIndex === state.guesses.length && state.phase === 'playing'
                const word = submitted?.word ?? (liveRow ? state.draft : '')
                const rowLabel = submitted
                  ? `Guess ${rowIndex + 1}: ${submitted.word.split('').map((letter, index) => `${letter}, ${submitted.marks[index]}`).join('; ')}`
                  : liveRow ? `Guess ${rowIndex + 1} in progress: ${word || 'empty'}` : `Guess ${rowIndex + 1} empty`
                return (
                  <div className={`wordgame-row${liveRow ? ' row-current' : ''}`} key={rowIndex} role="group" aria-label={rowLabel}>
                    {Array.from({ length: 5 }, (_, column) => {
                      const mark = submitted?.marks[column]
                      const letter = word[column] ?? ''
                      return <span key={column} className={`wordgame-tile${mark ? ` tile-${mark}` : ''}${letter && !mark ? ' tile-filled' : ''}`} aria-hidden="true">{letter}</span>
                    })}
                  </div>
                )
              })}
              {state.phase !== 'playing' && (
                <div className="wordgame-result" role="status">
                  <span>{state.phase === 'won' ? 'PUZZLE SOLVED' : 'PUZZLE COMPLETE'}</span>
                  <strong>{state.answer}</strong>
                </div>
              )}
            </div>
            <div className="wordgame-console-footer"><span>DAILY WORD · {state.date}</span><span>{state.phase === 'playing' ? `${6 - state.guesses.length} LEFT` : 'SEE YOU TOMORROW'}</span></div>
          </div>
          <div className="wordgame-keyboard" role="group" aria-label="On-screen letter keyboard">
            {KEY_ROWS.map((row, rowIndex) => (
              <div className="wordgame-key-row" key={rowIndex}>
                {row.split('').map((letter) => <LetterKey key={letter} letter={letter} mark={keyStatuses[letter]} disabled={state.phase !== 'playing'} onClick={() => sendAction({ type: 'letter', letter })} />)}
              </div>
            ))}
            <div className="wordgame-key-row wordgame-key-row-last">
              <button className="wordgame-key wordgame-key-wide" type="button" disabled={state.phase !== 'playing'} onClick={() => sendAction({ type: 'submit' })}>ENTER</button>
              {'ZXCVBNM'.split('').map((letter) => <LetterKey key={letter} letter={letter} mark={keyStatuses[letter]} disabled={state.phase !== 'playing'} onClick={() => sendAction({ type: 'letter', letter })} />)}
              <button className="wordgame-key wordgame-key-wide" type="button" aria-label="Delete last letter" disabled={state.phase !== 'playing'} onClick={() => sendAction({ type: 'backspace' })}>⌫</button>
            </div>
          </div>
          <p id="wordgame-instructions" className="wordgame-status" role="status" aria-live="polite">{state.message}</p>
        </div>
      </div>
    </section>
  )
}

function LetterKey({ letter, mark, disabled, onClick }: { letter: string; mark?: LetterMark; disabled: boolean; onClick: () => void }) {
  return <button className={`wordgame-key${mark ? ` key-${mark}` : ''}`} type="button" aria-label={`Letter ${letter}${mark ? `, ${mark}` : ''}`} disabled={disabled} onClick={onClick}>{letter}</button>
}
