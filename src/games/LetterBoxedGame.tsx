import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createLetterBoxedState,
  letterBoxedProgress,
  letterBoxedReducer,
  type LetterBoxedAction,
  type LetterBoxedProgress,
} from './letterBoxed'

interface LetterBoxedGameProps {
  onBack: () => void
  bestWords: number | null
  progress: LetterBoxedProgress | null
  onSaveProgress: (progress: LetterBoxedProgress) => void
}

const SIDE_NAMES = ['top', 'right', 'bottom', 'left'] as const

export function LetterBoxedGame({ onBack, bestWords, progress, onSaveProgress }: LetterBoxedGameProps) {
  const today = utcDateKey()
  const boardRef = useRef<HTMLDivElement>(null)
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    letterBoxedReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createLetterBoxedState(date, saved),
  )

  useEffect(() => {
    boardRef.current?.focus()
  }, [])

  const sendAction = (action: LetterBoxedAction) => {
    const next = letterBoxedReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (next.words.length !== state.words.length) onSaveProgress(letterBoxedProgress(next))
    if (next.phase === 'complete' && state.phase !== 'complete') playSound('win')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) return
    if (event.key === 'Enter') {
      event.preventDefault()
      sendAction({ type: 'submit' })
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      sendAction({ type: 'backspace' })
    } else if (/^[a-z]$/i.test(event.key)) {
      event.preventDefault()
      sendAction({ type: 'letter', letter: event.key })
    }
  }

  const previousLastLetter = state.words.at(-1)?.at(-1)
  const progressLabel = `${state.coveredLetters.length} of ${state.letters.length} letters covered. ${state.words.length} ${state.words.length === 1 ? 'word' : 'words'} in the chain.`

  return (
    <section className="snake-view letterboxed-view" aria-labelledby="letterboxed-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout letterboxed-layout">
        <div className="snake-copy letterboxed-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY WORD CHAIN · UTC</p>
          <h1 id="letterboxed-title">Letter Boxed<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Four sides. Twelve letters. Link words to light up the whole box.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Make words using the letters around the box. Switch sides between every pair of letters. Each new word starts with the last letter of the word before it. Cover all twelve letters to solve the daily puzzle.</p>
          </div>
          <div className="score-card letterboxed-score" aria-label={`${progressLabel} ${bestWords === null ? 'No personal best yet.' : `Best solve: ${bestWords} words.`}`}>
            <div className="letterboxed-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.coveredLetters.length}<small> / 12</small></strong>
              <span className="score-unit">letters covered</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestWords === null ? '—' : bestWords}</strong>
              <span className="score-unit">{bestWords === 1 ? 'word' : 'words'}</span>
            </div>
          </div>
          <p className="letterboxed-local-note">The same box is shared for this UTC date. Your word chain and best solve stay in this browser.</p>
        </div>

        <div className="play-column letterboxed-play-column" onKeyDown={handleKeyDown}>
          <div className="letterboxed-console">
            <div className="frame-topline">
              <span>FIELD 16</span>
              <span className={`frame-light phase-${state.phase}`}><i /> {state.phase === 'playing' ? 'LIVE' : 'SOLVED'}</span>
            </div>

            <div ref={boardRef} className="letterboxed-board" role="group" aria-label="Letter Boxed letter sides" aria-describedby="letterboxed-status" tabIndex={0}>
              {state.sides.map((side, sideIndex) => (
                <div className={`letterboxed-side letterboxed-${SIDE_NAMES[sideIndex]}`} key={SIDE_NAMES[sideIndex]} role="group" aria-label={`${SIDE_NAMES[sideIndex]} side: ${side.join(', ')}`}>
                  {sideIndex === 0 && <span className="letterboxed-side-label">TOP</span>}
                  {sideIndex === 1 && <span className="letterboxed-side-label">RIGHT</span>}
                  {sideIndex === 2 && <span className="letterboxed-side-label">BOTTOM</span>}
                  {sideIndex === 3 && <span className="letterboxed-side-label">LEFT</span>}
                  {side.map((letter) => (
                    <button
                      key={letter}
                      className={`letterboxed-letter${state.coveredLetters.includes(letter) ? ' letter-covered' : ''}${state.draft.includes(letter) ? ' letter-in-draft' : ''}`}
                      type="button"
                      aria-label={`${letter}, ${SIDE_NAMES[sideIndex]} side${state.coveredLetters.includes(letter) ? ', already covered' : ''}`}
                      aria-pressed={state.draft.includes(letter)}
                      disabled={state.phase === 'complete'}
                      onClick={() => sendAction({ type: 'letter', letter })}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              ))}

              <div className="letterboxed-center" aria-live="polite" aria-atomic="true">
                <span>{state.phase === 'complete' ? 'BOX COMPLETE' : previousLastLetter ? `NEXT WORD STARTS WITH ${previousLastLetter}` : 'BUILD YOUR FIRST WORD'}</span>
                <output aria-label={`Current word: ${state.draft || 'empty'}`}>{state.draft || '···'}</output>
                <small>{state.phase === 'complete' ? `${state.words.length} ${state.words.length === 1 ? 'word' : 'words'} used` : 'Switch sides each letter'}</small>
              </div>
            </div>

            {state.words.length > 0 && (
              <ol className="letterboxed-chain" aria-label="Submitted word chain">
                {state.words.map((word, index) => <li key={`${word}-${index}`}><span>{index + 1}</span>{word}</li>)}
              </ol>
            )}

            <div className="letterboxed-actions">
              <button className="button button-secondary" type="button" disabled={!state.draft || state.phase === 'complete'} onClick={() => sendAction({ type: 'backspace' })}>⌫ Delete</button>
              <button className="button button-quiet" type="button" disabled={!state.draft || state.phase === 'complete'} onClick={() => sendAction({ type: 'clear' })}>Clear word</button>
              <button className="button button-primary" type="button" disabled={!state.draft || state.phase === 'complete'} onClick={() => sendAction({ type: 'submit' })}>Enter word</button>
              {state.words.length > 0 && <button className="button button-quiet letterboxed-undo" type="button" onClick={() => sendAction({ type: 'undo' })}>Undo last word</button>}
            </div>

            {state.phase === 'complete' && <div className="letterboxed-complete" role="status"><strong>All twelve letters connected.</strong><small>A fresh box arrives tomorrow.</small></div>}
            <p className="letterboxed-status" id="letterboxed-status" role="status" aria-live="polite">{state.message}</p>
            <div className="letterboxed-console-footer"><span>{state.words.length} {state.words.length === 1 ? 'WORD' : 'WORDS'} IN CHAIN</span><span>{state.coveredLetters.length} / 12 LETTERS</span></div>
          </div>
          <p className="letterboxed-keyboard-hint">Type A–Z · Enter submits · Backspace deletes · Tap side letters to build</p>
        </div>
      </div>
    </section>
  )
}
