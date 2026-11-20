import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  createFourfoldState,
  dropFourfold,
  FOURFOLD_CELL_COUNT,
  FOURFOLD_COLUMNS,
  FOURFOLD_ROWS,
  getFourfoldCell,
  newFourfoldRound,
  pauseFourfold,
  playFourfoldCpuTurn,
  restartFourfold,
  resumeFourfold,
  startFourfold,
} from './fourfold'

export function FourfoldGame({
  onBack,
  bestWins,
  onRecordWins,
  reduceMotion,
}: {
  onBack: () => void
  bestWins: number | null
  onRecordWins: (wins: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createFourfoldState)
  const [selectedColumn, setSelectedColumn] = useState(3)
  const columnButtons = useRef<Array<HTMLButtonElement | null>>([])
  const nextRoundButton = useRef<HTMLButtonElement>(null)
  const recordedStreak = useRef(0)
  const playSound = useArcadeSound()

  useEffect(() => {
    if (state.phase !== 'cpu-turn') return
    const timer = window.setTimeout(() => {
      const next = playFourfoldCpuTurn(state)
      setState(next)
      if (next.phase === 'lost') window.requestAnimationFrame(() => nextRoundButton.current?.focus())
      else if (next.phase === 'player-turn') {
        playSound('hit')
        focusAvailableColumn(next.board, selectedColumn)
      }
      if (next.phase === 'lost') playSound('miss')
    }, 240)
    return () => window.clearTimeout(timer)
  }, [selectedColumn, state, playSound])

  useEffect(() => {
    if (state.phase !== 'won' || state.streak <= recordedStreak.current) return
    recordedStreak.current = state.streak
    onRecordWins(state.streak)
    playSound('win')
  }, [onRecordWins, playSound, state.phase, state.streak])

  const phaseLabel = state.phase === 'ready' ? 'MATCH READY'
    : state.phase === 'player-turn' ? 'YOUR TURN'
      : state.phase === 'cpu-turn' ? 'OPPONENT MOVES'
        : state.phase === 'paused' ? 'PAUSED'
          : state.phase === 'won' ? 'LINE COMPLETE'
            : state.phase === 'lost' ? 'ROUND LOST' : 'DRAW'
  const opponentMoves = state.phase === 'cpu-turn'
  const playable = state.phase === 'player-turn'

  function focusColumn(column = selectedColumn) {
    window.requestAnimationFrame(() => columnButtons.current[column]?.focus())
  }

  function focusAvailableColumn(board: typeof state.board, preferred: number) {
    const order = Array.from({ length: FOURFOLD_COLUMNS }, (_, offset) => (preferred + offset) % FOURFOLD_COLUMNS)
    const column = order.find((candidate) => getFourfoldCell(board, 0, candidate) === 0)
    if (column !== undefined) {
      setSelectedColumn(column)
      window.requestAnimationFrame(() => columnButtons.current[column]?.focus())
    }
  }

  function start() {
    setState((current) => startFourfold(current))
    focusColumn()
  }

  function playAgain() {
    setState((current) => newFourfoldRound(current))
    focusColumn()
  }

  function restart() {
    recordedStreak.current = 0
    setState((current) => restartFourfold(current))
    setSelectedColumn(3)
    window.requestAnimationFrame(() => columnButtons.current[3]?.focus())
  }

  function togglePause() {
    setState((current) => current.phase === 'paused' ? resumeFourfold(current) : pauseFourfold(current))
    focusColumn()
  }

  function drop(column: number) {
    setSelectedColumn(column)
    const next = dropFourfold(state, column)
    if (next === state) return
    setState(next)
    if (next.phase === 'won') window.requestAnimationFrame(() => nextRoundButton.current?.focus())
    else if (next.phase === 'cpu-turn') playSound('hit')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.repeat) return
    if (event.key === 'Escape' && (state.phase === 'player-turn' || state.phase === 'cpu-turn' || state.phase === 'paused')) {
      event.preventDefault()
      togglePause()
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'r') {
      event.preventDefault()
      restart()
      return
    }
    if (event.target instanceof HTMLButtonElement && !event.target.classList.contains('fourfold-drop')) return
    if (!playable) return
    const nextColumn = key === 'arrowleft' || key === 'a' ? Math.max(0, selectedColumn - 1)
      : key === 'arrowright' || key === 'd' ? Math.min(FOURFOLD_COLUMNS - 1, selectedColumn + 1) : null
    if (nextColumn !== null) {
      event.preventDefault()
      setSelectedColumn(nextColumn)
      columnButtons.current[nextColumn]?.focus()
    }
    if ((key === 'enter' || key === ' ') && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault()
      drop(selectedColumn)
    }
  }

  const boardLabel = `${FOURFOLD_COLUMNS} columns by ${FOURFOLD_ROWS} rows. Your discs are pink. The local opponent's discs are yellow.`
  const detail = state.phase === 'won' ? `You have won ${state.streak} ${state.streak === 1 ? 'round' : 'rounds'} in a row.`
    : state.phase === 'lost' ? 'The local opponent won this round. Start another board.'
      : state.phase === 'draw' ? 'Neither side made a line. The current win streak continues.'
        : state.phase === 'paused' ? 'The match is paused.' : 'Drop a disc into any open column.'

  return (
    <section className={`snake-view fourfold-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="fourfold-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout fourfold-layout">
        <div className="snake-copy fourfold-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="fourfold-title">Fourfold<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">Drop one disc. Read the board. Make a line before your local opponent does.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Take turns dropping a disc into an open column. The disc lands on the lowest open space. Connect four of your color horizontally, vertically, or diagonally to win the round.</p>
            <p>Use the column buttons or the <strong>Left / Right</strong> arrow keys to choose, then press <strong>Enter</strong> to drop. <strong>Escape</strong> pauses and <strong>R</strong> resets the win streak.</p>
          </div>
          <div className="score-card fourfold-score" aria-label={`Current win streak ${state.streak}. ${bestWins === null ? 'No local record yet.' : `Local best streak ${bestWins}.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">WIN STREAK</span>
              <strong className="score-value">{String(state.streak).padStart(2, '0')}</strong>
              <span className="score-unit">{state.phase === 'won' ? 'keep it going' : 'rounds in a row'}</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST IN THIS BROWSER</span>
              <strong>{bestWins === null ? '—' : String(bestWins).padStart(2, '0')}</strong>
              <span className="score-unit">wins in a row</span>
            </div>
          </div>
          <p className="fourfold-local-note">Your longest win streak stays saved in this browser and does not sync.</p>
        </div>

        <div className="play-column fourfold-play-column">
          <div className={`fourfold-console phase-${state.phase}`}>
            <div className="frame-topline"><span>FIELD 47</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="fourfold-turnline">
              <div><span>LOCAL MATCH / FIRST TO FOUR IN A ROW</span><strong>{opponentMoves ? 'Opponent choosing a column' : state.message}</strong></div>
              <div className="fourfold-side-mark" aria-label={state.phase === 'cpu-turn' ? 'Yellow opponent turn' : 'Pink player turn'}><i className={state.phase === 'cpu-turn' ? 'is-cpu' : ''} /></div>
            </div>
            <div className="fourfold-column-controls" aria-label="Choose a column">
              {Array.from({ length: FOURFOLD_COLUMNS }, (_, column) => {
                const full = getFourfoldCell(state.board, 0, column) !== 0
                return (
                  <button
                    className={`fourfold-drop${selectedColumn === column ? ' is-selected' : ''}`}
                    key={column}
                    ref={(element) => { columnButtons.current[column] = element }}
                    type="button"
                    aria-label={`Drop in column ${column + 1}${full ? ', full' : ''}`}
                    disabled={!playable || full}
                    onFocus={() => setSelectedColumn(column)}
                    onClick={() => drop(column)}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                )
              })}
            </div>
            <div className="fourfold-board-frame">
              <div className="fourfold-board" role="img" aria-label={`${boardLabel} ${detail}`}>
                {Array.from({ length: FOURFOLD_CELL_COUNT }, (_, index) => {
                  const row = Math.floor(index / FOURFOLD_COLUMNS)
                  const column = index % FOURFOLD_COLUMNS
                  const disc = getFourfoldCell(state.board, row, column)
                  return <span className={`fourfold-cell${disc === 1 ? ' is-player' : ''}${disc === 2 ? ' is-cpu' : ''}`} key={index} style={{ gridColumn: column + 1, gridRow: row + 1 }} aria-hidden="true">{disc === 0 ? '' : '●'}</span>
                })}
              </div>
              {state.phase !== 'player-turn' && state.phase !== 'cpu-turn' && (
                <div className="fourfold-overlay">
                  <div>
                    <span>{state.phase === 'ready' ? 'BOARD READY' : state.phase === 'paused' ? 'MATCH PAUSED' : state.phase === 'won' ? 'FOUR IN A ROW' : state.phase === 'lost' ? 'OPPONENT LINE' : 'NO OPEN CELLS'}</span>
                    <strong>{state.phase === 'ready' ? 'Take the center.' : state.phase === 'paused' ? 'Hold your line.' : state.phase === 'won' ? 'Round to you.' : state.phase === 'lost' ? 'Next board.' : 'A draw.'}</strong>
                    <p>{state.phase === 'ready' ? 'Choose a column and make the first move.' : state.phase === 'paused' ? 'Resume when you are ready.' : detail}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="fourfold-status" role="status" aria-live="polite">{state.message}</p>
            <div className="fourfold-legend"><span><i className="legend-player" />YOU</span><span><i className="legend-cpu" />LOCAL OPPONENT</span></div>
            <div className="fourfold-actions">
              {state.phase === 'ready' ? <button className="fourfold-action fourfold-action-primary" type="button" onClick={start}>Start match <kbd>ENTER</kbd></button>
                : state.phase === 'won' || state.phase === 'lost' || state.phase === 'draw' ? <button className="fourfold-action fourfold-action-primary" type="button" ref={nextRoundButton} onClick={playAgain}>Next round <kbd>ENTER</kbd></button>
                  : <button className="fourfold-action fourfold-action-pause" type="button" onClick={togglePause}>{state.phase === 'paused' ? 'Resume match' : 'Pause'} <kbd>ESC</kbd></button>}
              <button className="fourfold-action" type="button" onClick={restart}>Restart streak <kbd>R</kbd></button>
            </div>
          </div>
          <p className="fourfold-footnote">The opponent runs locally in your browser. No network match or account is involved.</p>
        </div>
      </div>
    </section>
  )
}
