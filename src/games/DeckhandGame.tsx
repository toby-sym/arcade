import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  DECKHAND_SUITS,
  advanceDeckhandTime,
  createDeckhandState,
  deckhandRankLabel,
  deckhandSuitSymbol,
  drawDeckhandCard,
  formatDeckhandTime,
  moveDeckhandCard,
  moveSelectedDeckhandCard,
  newDeckhandDeal,
  pauseDeckhand,
  resumeDeckhand,
  restartDeckhand,
  selectDeckhandCard,
  startDeckhand,
  undoDeckhand,
  type DeckhandCard,
  type DeckhandSource,
  type DeckhandSuit,
  type DeckhandTarget,
} from './deckhand'

export function DeckhandGame({
  onBack,
  bestSeconds,
  onRecordTime,
  reduceMotion,
}: {
  onBack: () => void
  bestSeconds: number | null
  onRecordTime: (seconds: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createDeckhandState)
  const boardRef = useRef<HTMLDivElement>(null)
  const lastRecordedSeconds = useRef<number | null>(null)
  const playSound = useArcadeSound()
  const phaseLabel = state.phase === 'ready' ? 'DEAL READY'
    : state.phase === 'playing' ? 'TABLE LIVE'
      : state.phase === 'paused' ? 'PAUSED' : 'ALL HOME'
  const cardsHome = DECKHAND_SUITS.reduce((count, suit) => count + state.foundations[suit].length, 0)

  useEffect(() => {
    if (state.phase !== 'playing') return
    const timer = window.setInterval(() => setState((current) => advanceDeckhandTime(current)), 1000)
    return () => window.clearInterval(timer)
  }, [state.phase])

  useEffect(() => {
    if (state.phase !== 'complete' || lastRecordedSeconds.current === state.elapsedSeconds) return
    lastRecordedSeconds.current = state.elapsedSeconds
    onRecordTime(Math.max(1, Math.ceil(state.elapsedSeconds)))
    playSound('win')
  }, [onRecordTime, playSound, state.elapsedSeconds, state.phase])

  function focusBoard() {
    window.requestAnimationFrame(() => boardRef.current?.focus())
  }

  function start() {
    lastRecordedSeconds.current = null
    setState((current) => startDeckhand(current))
    focusBoard()
  }

  function restart() {
    lastRecordedSeconds.current = null
    setState((current) => restartDeckhand(current))
    focusBoard()
  }

  function newDeal() {
    lastRecordedSeconds.current = null
    setState((current) => newDeckhandDeal(current))
    focusBoard()
  }

  function togglePause() {
    setState((current) => current.phase === 'paused' ? resumeDeckhand(current) : pauseDeckhand(current))
  }

  function undo() {
    setState((current) => undoDeckhand(current))
  }

  function draw() {
    const next = drawDeckhandCard(state)
    if (next !== state) {
      setState(next)
      playSound('hit')
    }
  }

  function moveOrSelect(source: DeckhandSource, destination: DeckhandTarget) {
    const moved = moveDeckhandCard(state, source, destination)
    if (moved !== state) {
      setState(moved)
      playSound(destination.kind === 'foundation' ? 'score' : 'hit')
      return true
    }
    return false
  }

  function handleCardSource(source: DeckhandSource) {
    if (state.phase !== 'playing') return
    setState((current) => selectDeckhandCard(current, source))
  }

  function handleTableauClick(column: number, cardIndex: number | null) {
    if (state.phase !== 'playing') return
    if (state.selection) {
      const moved = moveSelectedDeckhandCard(state, { kind: 'tableau', column })
      if (moved !== state) {
        setState(moved)
        playSound('hit')
        return
      }
      if (cardIndex === null) return
    }
    if (cardIndex !== null) setState((current) => selectDeckhandCard(current, { kind: 'tableau', column, cardIndex }))
  }

  function handleFoundationClick(suit: DeckhandSuit) {
    if (state.phase !== 'playing') return
    if (state.selection) {
      if (moveOrSelect(state.selection, { kind: 'foundation', suit })) return
    }
    if (state.foundations[suit].length > 0) handleCardSource({ kind: 'foundation', suit })
  }

  function handleWasteClick() {
    if (state.phase !== 'playing') return
    if (state.selection?.kind === 'waste') {
      setState((current) => selectDeckhandCard(current, { kind: 'waste' }))
      return
    }
    handleCardSource({ kind: 'waste' })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && (state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    if (event.repeat) return
    const key = event.key.toLowerCase()
    if (key === 'r') {
      event.preventDefault()
      restart()
    } else if (key === 'z' || key === 'backspace') {
      event.preventDefault()
      undo()
    }
  }

  return (
    <section className={`snake-view deckhand-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="deckhand-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout deckhand-layout">
        <div className="snake-copy deckhand-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="deckhand-title">Deckhand<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Clear the table. Bring every suit home.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Build each suit foundation from ace to king. On the table, stack cards downward in alternating colors. Move a face-up run together; an empty column takes a king.</p>
            <p>Select a card, then its destination. Draw or recycle the stock as needed. Use <strong>Tab, Enter, and Space</strong> to move between card controls, <strong>Z</strong> to undo, <strong>Escape</strong> to pause, and <strong>R</strong> to restart the deal.</p>
          </div>
          <div className="score-card deckhand-score" aria-label={`Time ${formatDeckhandTime(state.elapsedSeconds)}. ${cardsHome} of 52 cards home. ${bestSeconds === null ? 'No local fastest clear yet.' : `Local fastest clear ${formatDeckhandTime(bestSeconds)}.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">TIME</span>
              <strong className="score-value">{formatDeckhandTime(state.elapsedSeconds)}</strong>
              <span className="score-unit">{cardsHome} of 52 cards home</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FASTEST CLEAR HERE</span>
              <strong>{bestSeconds === null ? '—' : formatDeckhandTime(bestSeconds)}</strong>
              <span className="score-unit">local time</span>
            </div>
          </div>
          <p className="deckhand-local-note">Your fastest clear stays in this browser and does not sync.</p>
        </div>

        <div className="play-column deckhand-play-column">
          <div className={`deckhand-console phase-${state.phase}`}>
            <div className="frame-topline"><span>SEVEN-COLUMN SOLITAIRE</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="deckhand-table-top">
              <button className="deckhand-slot deckhand-stock" type="button" disabled={state.phase !== 'playing'} onClick={draw} aria-label={state.stock.length ? `Draw a card from stock. ${state.stock.length} cards remain.` : state.waste.length ? 'Recycle the waste into stock.' : 'Stock is empty.'}>
                {state.stock.length ? <span className="deckhand-card-back" aria-hidden="true"><i>✦</i><b>DECKHAND</b></span> : state.waste.length ? <span className="deckhand-recycle" aria-hidden="true">↻</span> : <span className="deckhand-slot-mark" aria-hidden="true">·</span>}
                <small>{state.stock.length ? `${state.stock.length} IN STOCK` : state.waste.length ? 'RECYCLE' : 'EMPTY'}</small>
              </button>
              <button className={`deckhand-slot deckhand-waste${selected(state.selection, { kind: 'waste' }) ? ' is-selected' : ''}`} type="button" disabled={state.phase !== 'playing' || state.waste.length === 0} onClick={handleWasteClick} aria-pressed={selected(state.selection, { kind: 'waste' })} aria-label={state.waste.length ? `${describeCard(state.waste.at(-1)!)} in waste. Select card.` : 'Waste pile is empty.'}>
                {state.waste.length ? <CardFace card={state.waste.at(-1)!} compact /> : <span className="deckhand-slot-mark" aria-hidden="true">·</span>}
                <small>WASTE</small>
              </button>
              <div className="deckhand-foundations" role="group" aria-label="Suit foundations">
                {DECKHAND_SUITS.map((suit) => {
                  const topCard = state.foundations[suit].at(-1)
                  const source = { kind: 'foundation', suit } as const
                  return <button key={suit} className={`deckhand-slot deckhand-foundation${selected(state.selection, source) ? ' is-selected' : ''}`} type="button" disabled={state.phase !== 'playing'} onClick={() => handleFoundationClick(suit)} aria-pressed={selected(state.selection, source)} aria-label={`Foundation ${suit}${topCard ? `, ${describeCard(topCard)}` : ', empty'}. Select or move a card.`}>
                    {topCard ? <CardFace card={topCard} compact /> : <span className={`deckhand-foundation-mark suit-${suit}`} aria-hidden="true">{deckhandSuitSymbol(suit)}</span>}
                    <small>{suit.toUpperCase()}</small>
                  </button>
                })}
              </div>
            </div>

            <div className="deckhand-tableau" ref={boardRef} role="group" aria-label="Seven tableau columns" tabIndex={-1}>
              {state.tableau.map((column, columnIndex) => <div key={columnIndex} className={`deckhand-column${column.cards.length === 0 ? ' is-empty' : ''}`} role="group" aria-label={`Column ${columnIndex + 1}, ${column.cards.length} cards, ${column.faceUpFrom} facedown`} onClick={() => handleTableauClick(columnIndex, null)}>
                {column.cards.length === 0 && <span className="deckhand-empty-column" aria-hidden="true">K</span>}
                {column.cards.map((card, cardIndex) => {
                  const faceUp = cardIndex >= column.faceUpFrom
                  if (!faceUp) return <span key={card.id} className="deckhand-card-back deckhand-tableau-back" style={{ top: `${(column.cards.length - 1 - cardIndex) * 15}px`, zIndex: cardIndex }} aria-hidden="true"><i>✦</i></span>
                  const source = { kind: 'tableau', column: columnIndex, cardIndex } as const
                  const top = (column.cards.length - 1 - cardIndex) * 27
                  return <button key={card.id} type="button" className={`deckhand-card deckhand-tableau-card suit-${card.suit}${selected(state.selection, source) ? ' is-selected' : ''}`} style={{ top: `${top}px`, zIndex: cardIndex }} disabled={state.phase !== 'playing'} onClick={(event) => { event.stopPropagation(); handleTableauClick(columnIndex, cardIndex) }} aria-pressed={selected(state.selection, source)} aria-label={`${describeCard(card)}${cardIndex < column.cards.length - 1 ? ` with ${column.cards.length - cardIndex - 1} cards above` : ''}. Select card run.`}>
                    <CardFace card={card} />
                  </button>
                })}
              </div>)}
            </div>

            <p className="deckhand-status" role="status" aria-live="polite">{state.message}</p>
            <div className="deckhand-actions" role="group" aria-label="Solitaire controls">
              {state.phase === 'ready' ? <button className="deckhand-action deckhand-action-primary" type="button" onClick={start}>Start deal <span aria-hidden="true">▶</span></button>
                : state.phase === 'complete' ? <button className="deckhand-action deckhand-action-primary" type="button" onClick={newDeal}>New deal <span aria-hidden="true">↻</span></button>
                  : <button className="deckhand-action deckhand-action-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume deal' : 'Pause deal'} <kbd>ESC</kbd></button>}
              <button className="deckhand-action" type="button" disabled={state.phase !== 'playing' || state.history.length === 0} onClick={undo}>Undo <kbd>Z</kbd></button>
              <button className="deckhand-action" type="button" onClick={restart}>Restart deal <kbd>R</kbd></button>
              {state.phase === 'ready' && <button className="deckhand-action" type="button" onClick={newDeal}>Shuffle deal</button>}
            </div>
            <div className="deckhand-console-footer"><span>SELECT A CARD · CHOOSE A PILE</span><span>ACE → KING · RED / BLACK</span></div>
          </div>
          <p className="deckhand-footnote">Deals are generated locally and have a clear path. Records stay on this browser.</p>
        </div>
      </div>
    </section>
  )
}

function CardFace({ card, compact = false }: { card: DeckhandCard; compact?: boolean }) {
  const symbol = deckhandSuitSymbol(card.suit)
  const rank = deckhandRankLabel(card.rank)
  return <span className={`deckhand-card-face${compact ? ' is-compact' : ''}`} aria-hidden="true">
    <span className="deckhand-card-corner"><b>{rank}</b><i>{symbol}</i></span>
    <span className="deckhand-card-center">{symbol}</span>
    {!compact && <span className="deckhand-card-corner is-inverted"><b>{rank}</b><i>{symbol}</i></span>}
  </span>
}

function describeCard(card: DeckhandCard): string {
  const rank = card.rank === 1 ? 'Ace' : card.rank === 11 ? 'Jack' : card.rank === 12 ? 'Queen' : card.rank === 13 ? 'King' : String(card.rank)
  return `${rank} of ${card.suit}`
}

function selected(first: DeckhandSource | null, second: DeckhandSource): boolean {
  return first?.kind === second.kind
    && (first.kind === 'waste' && second.kind === 'waste'
      || first.kind === 'tableau' && second.kind === 'tableau' && first.column === second.column && first.cardIndex === second.cardIndex
      || first.kind === 'foundation' && second.kind === 'foundation' && first.suit === second.suit)
}
