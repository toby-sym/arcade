import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import {
  createTallyMarketState,
  pauseTallyMarket,
  placeTallyMarketTile,
  playAgainTallyMarket,
  restartTallyMarket,
  resumeTallyMarket,
  selectTallyMarketTile,
  startTallyMarket,
  tallyMarketProgress,
  tallyMarketTotals,
  TALLY_MARKET_NAMES,
  TALLY_MARKET_TILE_VALUES,
  undoTallyMarket,
  type TallyMarketProgress,
} from './tallyMarket'

export function TallyMarketGame({
  onBack,
  bestActions,
  progress,
  onSaveProgress,
  reduceMotion,
}: {
  onBack: () => void
  bestActions: number | null
  progress: TallyMarketProgress | null
  onSaveProgress: (progress: TallyMarketProgress) => void
  reduceMotion: boolean
}) {
  const date = utcDateKey()
  const [state, setState] = useState(() => createTallyMarketState(date, progress))
  const consoleRef = useRef<HTMLDivElement>(null)
  const basketButtons = useRef<Array<HTMLButtonElement | null>>(Array(TALLY_MARKET_NAMES.length).fill(null))
  const tileButtons = useRef<Array<HTMLButtonElement | null>>(Array(TALLY_MARKET_TILE_VALUES.length).fill(null))
  const mainActionButton = useRef<HTMLButtonElement>(null)
  const pauseButton = useRef<HTMLButtonElement>(null)
  const playSound = useArcadeSound()
  const totals = tallyMarketTotals(state, state.placements)
  const placedTileIds = new Set(state.placements.map((placement) => placement.tileId))
  const selectedTile = state.selectedTileId === null ? null : state.tiles.find((tile) => tile.id === state.selectedTileId) ?? null

  useEffect(() => {
    consoleRef.current?.focus()
  }, [])

  function apply(action: TallyMarketAction) {
    const next = action(state)
    if (next === state) return
    setState(next)
    if (next.placements !== state.placements || next.actions !== state.actions) onSaveProgress(tallyMarketProgress(next))
    if (next.phase === 'complete' && state.phase !== 'complete') {
      playSound('win')
    } else if (next.placements !== state.placements) {
      playSound(next.placements.length > state.placements.length ? 'hit' : 'signal')
    }

    if (next.phase === 'complete') {
      window.requestAnimationFrame(() => mainActionButton.current?.focus())
    } else if (next.phase === 'paused' || state.phase === 'paused') {
      window.requestAnimationFrame(() => pauseButton.current?.focus())
    } else if (next.selectedTileId !== state.selectedTileId && next.selectedTileId !== null) {
      const tile = next.tiles.find((candidate) => candidate.id === next.selectedTileId)
      const nextTotals = tallyMarketTotals(next, next.placements)
      const market = next.targets.findIndex((target, index) => nextTotals[index]! < target && nextTotals[index]! + (tile?.value ?? 0) <= target)
      if (market >= 0) window.requestAnimationFrame(() => basketButtons.current[market]?.focus())
    } else if (next.placements.length > state.placements.length) {
      const used = new Set(next.placements.map((placement) => placement.tileId))
      const followingTile = next.tiles.find((tile) => !used.has(tile.id))
      if (followingTile) window.requestAnimationFrame(() => tileButtons.current[followingTile.id]?.focus())
    } else if (next.placements.length < state.placements.length) {
      const restoredTileId = state.placements[state.placements.length - 1]?.tileId
      const firstTileId = next.tiles.find((tile) => !next.placements.some((placement) => placement.tileId === tile.id))?.id
      const focusTile = restoredTileId ?? firstTileId
      if (focusTile !== undefined) window.requestAnimationFrame(() => tileButtons.current[focusTile]?.focus())
    } else if (next.phase === 'playing' && state.phase === 'ready') {
      const firstTile = next.tiles[0]
      if (firstTile) window.requestAnimationFrame(() => tileButtons.current[firstTile.id]?.focus())
    }
  }

  function beginAttempt() {
    apply(startTallyMarket)
  }

  function togglePause() {
    apply(state.phase === 'paused' ? resumeTallyMarket : pauseTallyMarket)
  }

  function beginAgain() {
    const next = playAgainTallyMarket(state)
    setState(next)
    onSaveProgress(tallyMarketProgress(next))
    const firstTile = next.tiles[0]
    if (firstTile) window.requestAnimationFrame(() => tileButtons.current[firstTile.id]?.focus())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.repeat) return
    const key = event.key.toLowerCase()
    if (event.key === 'Escape' && (state.phase === 'playing' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    if (key === 'r') {
      event.preventDefault()
      apply(restartTallyMarket)
    } else if ((key === 'z' || event.key === 'Backspace') && state.phase === 'playing') {
      event.preventDefault()
      apply(undoTallyMarket)
    }
  }

  const phaseLabel = state.phase === 'ready' ? 'BOARD READY'
    : state.phase === 'playing' ? 'MARKET OPEN'
      : state.phase === 'paused' ? 'PAUSED' : 'TOTALS MET'
  const instruction = state.phase === 'complete'
    ? `All three baskets closed in ${state.actions} actions.`
    : state.phase === 'paused'
      ? 'The market is paused. Your basket totals are held.'
      : selectedTile
        ? `Number ${selectedTile.value} is selected. Choose a basket that can fit it.`
        : 'Choose a tile, then add it to a basket without passing its target.'

  return (
    <section className={`snake-view tallymarket-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="tallymarket-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout tallymarket-layout">
        <div className="snake-copy tallymarket-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY SUM MARKET · UTC</p>
          <h1 id="tallymarket-title">Tally Market<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">A dozen number tags. Three open baskets. Make every total land exactly.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Each number tile can be used once. Select a tile, then a basket. Reach all three target totals without going over; some tiles are decoys, so leave them on the rack.</p>
            <p><strong>Undo</strong> returns the last tile and counts as an action. <strong>Escape</strong> pauses; <strong>R</strong> restarts the current attempt. A new shared puzzle arrives at midnight UTC.</p>
          </div>
          <div className="score-card tallymarket-score" aria-label={`Today ${state.date}. ${state.actions} actions. ${bestActions === null ? 'No personal best yet.' : `Fewest actions ${bestActions}.`}`}>
            <div className="tallymarket-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{String(state.actions).padStart(2, '0')}</strong>
              <span className="score-unit">actions so far</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FEWEST · THIS BROWSER</span>
              <strong className="score-value">{bestActions === null ? '—' : String(bestActions).padStart(2, '0')}</strong>
              <span className="score-unit">actions to close the market</span>
            </div>
          </div>
          <p className="tallymarket-local-note">Your fewest-action clear stays in this browser and does not sync.</p>
        </div>

        <div className="play-column tallymarket-play-column">
          <div className={`tallymarket-console phase-${state.phase}`} ref={consoleRef} tabIndex={-1} aria-label="Tally Market daily puzzle">
            <div className="frame-topline"><span>FIELD 49</span><span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i /> {phaseLabel}</span></div>
            <div className="tallymarket-roundline">
              <div><span>DAILY MARKET</span><strong>{state.date} · {TALLY_MARKET_TILE_VALUES.length} TAGS</strong></div>
              <b>{state.actions}<small> ACTIONS</small></b>
            </div>

            <div className="tallymarket-baskets" role="group" aria-label="Target baskets">
              {TALLY_MARKET_NAMES.map((market, index) => {
                const complete = totals[index] === state.targets[index]
                const itemCount = state.placements.filter((placement) => placement.market === index).length
                const disabled = state.phase !== 'playing' || selectedTile === null || complete
                return (
                  <button
                    className={`tallymarket-basket${complete ? ' is-complete' : ''}${selectedTile && !disabled ? ' is-open' : ''}`}
                    type="button"
                    key={market}
                    ref={(element) => { basketButtons.current[index] = element }}
                    aria-label={`${market} basket, ${totals[index]} of ${state.targets[index]}, ${itemCount} tiles${complete ? ', target reached' : ''}`}
                    disabled={disabled}
                    onClick={() => apply((current) => placeTallyMarketTile(current, index))}
                  >
                    <span className="tallymarket-basket-heading"><strong>{market}</strong><small>{itemCount} {itemCount === 1 ? 'TAG' : 'TAGS'}</small></span>
                    <span className="tallymarket-basket-total"><b>{totals[index]}</b><i>/</i><strong>{state.targets[index]}</strong></span>
                    <span className="tallymarket-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (totals[index]! / state.targets[index]!) * 100)}%` }} /></span>
                    <span className="tallymarket-basket-items">
                      {state.placements.filter((placement) => placement.market === index).map((placement) => {
                        const tile = state.tiles.find((candidate) => candidate.id === placement.tileId)!
                        return <i key={tile.id} aria-hidden="true">{tile.value}</i>
                      })}
                      {itemCount === 0 && <em>{selectedTile ? `ADD ${selectedTile.value}` : 'CHOOSE A TILE'}</em>}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="tallymarket-rack-heading"><span>NUMBER RACK</span><small>USE EACH TAG ONCE</small></div>
            <div className="tallymarket-rack" role="group" aria-label="Number tiles">
              {state.tiles.map((tile) => {
                const used = placedTileIds.has(tile.id)
                const selected = state.selectedTileId === tile.id
                return (
                  <button
                    className={`tallymarket-tile${selected ? ' is-selected' : ''}${used ? ' is-used' : ''}`}
                    type="button"
                    key={tile.id}
                    ref={(element) => { tileButtons.current[tile.id] = element }}
                    aria-label={`Number tile ${tile.value}${used ? ', already used' : selected ? ', selected' : ''}`}
                    aria-pressed={selected}
                    disabled={used || state.phase !== 'playing'}
                    onClick={() => apply((current) => selectTallyMarketTile(current, tile.id))}
                  >{String(tile.value).padStart(2, '0')}</button>
                )
              })}
            </div>

            {state.phase !== 'playing' && (
              <div className="tallymarket-overlay">
                <div>
                  <span>{state.phase === 'ready' ? 'MARKET OPENS' : state.phase === 'paused' ? 'MARKET PAUSED' : 'ALL TOTALS MET'}</span>
                  <strong>{state.phase === 'ready' ? 'Three baskets, one rack.' : state.phase === 'paused' ? 'Take your time.' : `${state.actions} actions.`}</strong>
                  <p>{state.phase === 'ready' ? 'Use the daily number tags to reach each target exactly.' : instruction}</p>
                </div>
              </div>
            )}
            <p className="tallymarket-status" role="status" aria-live="polite">{state.message}</p>
            <div className="tallymarket-actions">
              {state.phase === 'ready' ? <button className="tallymarket-action tallymarket-action-primary" type="button" ref={mainActionButton} onClick={beginAttempt}>Open market <kbd>ENTER</kbd></button>
                : state.phase === 'complete' ? <button className="tallymarket-action tallymarket-action-primary" type="button" ref={mainActionButton} onClick={beginAgain}>Try today again <kbd>ENTER</kbd></button>
                  : <button className="tallymarket-action tallymarket-action-pause" type="button" ref={pauseButton} onClick={togglePause}>{state.phase === 'paused' ? 'Resume puzzle' : 'Pause'} <kbd>ESC</kbd></button>}
              {state.phase === 'playing' && <>
                <button className="tallymarket-action" type="button" onClick={() => apply(undoTallyMarket)} disabled={state.placements.length === 0}>Undo last tile <kbd>Z</kbd></button>
                <button className="tallymarket-action" type="button" onClick={() => apply(restartTallyMarket)} disabled={state.placements.length === 0}>Restart <kbd>R</kbd></button>
              </>}
            </div>
          </div>
          <p className="tallymarket-footnote">Puzzles are generated in this app and run locally. Your daily progress stays in this browser.</p>
        </div>
      </div>
    </section>
  )
}

type TallyMarketAction = (state: ReturnType<typeof createTallyMarketState>) => ReturnType<typeof createTallyMarketState>
