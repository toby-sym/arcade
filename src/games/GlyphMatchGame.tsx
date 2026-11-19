import { useEffect, useReducer, useRef, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  GLYPH_MATCH_PAIR_COUNT,
  GLYPH_SYMBOLS,
  createGlyphMatchState,
  glyphMatchProgress,
  glyphMatchReducer,
  type GlyphMatchAction,
  type GlyphMatchProgress,
} from './glyphMatch'

const GLYPH_NAMES = ['star', 'moon', 'diamond', 'triangle', 'circle', 'flower', 'hexagon', 'wave']

interface GlyphMatchGameProps {
  onBack: () => void
  bestMoves: number | null
  progress: GlyphMatchProgress | null
  reduceMotion: boolean
  onSaveProgress: (progress: GlyphMatchProgress) => void
}

export function GlyphMatchGame({ onBack, bestMoves, progress, reduceMotion, onSaveProgress }: GlyphMatchGameProps) {
  const today = utcDateKey()
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([])
  const playSound = useArcadeSound()
  const [state, dispatch] = useReducer(
    glyphMatchReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createGlyphMatchState(date, saved),
  )

  useEffect(() => {
    tileRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (!state.mismatch) return
    const timeout = window.setTimeout(() => dispatch({ type: 'hide-mismatch' }), reduceMotion ? 450 : 780)
    return () => window.clearTimeout(timeout)
  }, [state.mismatch, reduceMotion])

  const sendAction = (action: GlyphMatchAction) => {
    const next = glyphMatchReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (next.matchedIndices !== state.matchedIndices || next.moves !== state.moves) onSaveProgress(glyphMatchProgress(next))
    if (next.matchedIndices.length > state.matchedIndices.length) {
      playSound(next.phase === 'complete' ? 'win' : 'score')
    }
  }

  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[event.key]
    if (direction === undefined || !(event.target instanceof HTMLButtonElement)) return
    const index = Number(event.target.dataset.index)
    const row = Math.floor(index / 4)
    const column = index % 4
    if ((event.key === 'ArrowLeft' && column === 0)
      || (event.key === 'ArrowRight' && column === 3)
      || (event.key === 'ArrowUp' && row === 0)
      || (event.key === 'ArrowDown' && row === 3)) return
    event.preventDefault()
    tileRefs.current[index + direction]?.focus()
  }

  const progressLabel = `${state.matchedIndices.length / 2} of ${GLYPH_MATCH_PAIR_COUNT} pairs found. ${state.moves} ${state.moves === 1 ? 'turn' : 'turns'}.`
  const resetDisabled = state.phase === 'complete'
    || (state.matchedIndices.length === 0 && state.moves === 0 && state.revealedIndices.length === 0)

  return (
    <section className="snake-view glyphmatch-view" aria-labelledby="glyphmatch-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout glyphmatch-layout">
        <div className="snake-copy glyphmatch-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY PAIRS · UTC</p>
          <h1 id="glyphmatch-title">Glyph Match<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Sixteen tiles. Eight pairs. A fresh board each day.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Turn over two tiles at a time. Keep the matching pairs face up and remember where each glyph lives. Find all eight pairs in as few turns as you can.</p>
          </div>
          <div className="score-card glyphmatch-score" aria-label={`${progressLabel} ${bestMoves === null ? 'No personal best yet.' : `Best solve: ${bestMoves} ${bestMoves === 1 ? 'turn' : 'turns'}.`}`}>
            <div className="glyphmatch-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.matchedIndices.length / 2}<small> / {GLYPH_MATCH_PAIR_COUNT}</small></strong>
              <span className="score-unit">pairs found</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestMoves === null ? '—' : bestMoves}</strong>
              <span className="score-unit">{bestMoves === 1 ? 'turn' : 'turns'}</span>
            </div>
          </div>
          <p className="glyphmatch-local-note">Your daily board and best solve stay in this browser. They do not sync.</p>
        </div>

        <div className="play-column glyphmatch-play-column">
          <div className="glyphmatch-console">
            <div className="frame-topline">
              <span>FIELD 18</span>
              <span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i />{state.phase === 'complete' ? 'SOLVED' : `${state.moves} ${state.moves === 1 ? 'TURN' : 'TURNS'}`}</span>
            </div>
            <div className="glyphmatch-board" role="group" aria-label="Sixteen tile matching board" onKeyDown={handleGridKeyDown}>
              {state.glyphs.map((glyph, index) => {
                const matched = state.matchedIndices.includes(index)
                const revealed = state.revealedIndices.includes(index)
                const visible = matched || revealed
                const name = GLYPH_NAMES[GLYPH_SYMBOLS.indexOf(glyph as typeof GLYPH_SYMBOLS[number])] ?? 'glyph'
                return (
                  <button
                    className={`glyphmatch-tile${visible ? ' glyphmatch-tile-visible' : ''}${matched ? ' glyphmatch-tile-matched' : ''}${state.mismatch && revealed ? ' glyphmatch-tile-mismatch' : ''}`}
                    type="button"
                    key={index}
                    data-index={index}
                    ref={(element) => { tileRefs.current[index] = element }}
                    aria-label={visible ? `Tile ${index + 1}, ${name}${matched ? ', matched' : ', revealed'}` : `Tile ${index + 1}, face down`}
                    aria-pressed={visible}
                    disabled={matched || state.mismatch || state.phase === 'complete'}
                    onClick={() => sendAction({ type: 'select', index })}
                  >
                    <span aria-hidden={!visible}>{visible ? glyph : '✧'}</span>
                  </button>
                )
              })}
            </div>
            <div className="glyphmatch-actions">
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'restart' })} disabled={resetDisabled}>Restart board</button>
            </div>
            <p className="glyphmatch-status" role="status" aria-live="polite">{state.message}</p>
            <div className="glyphmatch-console-footer"><span>CLICK · TOUCH · ARROWS</span><span>{state.moves} TURNS</span></div>
          </div>
          <p className="glyphmatch-keyboard-hint">Select a tile with Enter or Space. Use arrow keys to move around the board.</p>
        </div>
      </div>
    </section>
  )
}
