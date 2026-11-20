import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import {
  createPeglineState,
  nextPeglineBoard,
  pausePegline,
  peglineCell,
  peglineColumn,
  peglineRow,
  peglineTargets,
  PEGLINE_BOARD_SIZE,
  PEGLINE_PUZZLES,
  restartPegline,
  resumePegline,
  retryPeglineBoard,
  selectPeglineCell,
  startPegline,
} from './pegline'

export function PeglineGame({
  onBack,
  bestMoves,
  onRecordMoves,
  reduceMotion,
}: {
  onBack: () => void
  bestMoves: number | null
  onRecordMoves: (moves: number) => void
  reduceMotion: boolean
}) {
  const [state, setState] = useState(createPeglineState)
  const socketButtons = useRef<Array<HTMLButtonElement | null>>(Array(PEGLINE_BOARD_SIZE ** 2).fill(null))
  const actionButton = useRef<HTMLButtonElement>(null)
  const recordedMoves = useRef<number | null>(null)
  const playSound = useArcadeSound()
  const puzzle = PEGLINE_PUZZLES[state.stageIndex]!
  const targets = new Set(peglineTargets(state))
  const pegsLeft = state.board.filter((cell) => cell === 2).length

  useEffect(() => {
    if (state.phase !== 'complete' || recordedMoves.current === state.moves) return
    recordedMoves.current = state.moves
    onRecordMoves(state.moves)
    playSound('win')
  }, [onRecordMoves, playSound, state.moves, state.phase])

  function focusFirstPeg(board: typeof state.board) {
    const firstPeg = board.findIndex((cell) => cell === 2)
    if (firstPeg >= 0) window.requestAnimationFrame(() => socketButtons.current[firstPeg]?.focus())
  }

  function startRoute() {
    setState((current) => startPegline(current))
    focusFirstPeg(state.board)
  }

  function nextBoard() {
    const next = nextPeglineBoard(state)
    setState(next)
    focusFirstPeg(next.board)
  }

  function retryBoard() {
    const next = retryPeglineBoard(state)
    setState(next)
    focusFirstPeg(next.board)
  }

  function restartRoute() {
    recordedMoves.current = null
    setState(restartPegline(state))
    window.requestAnimationFrame(() => actionButton.current?.focus())
  }

  function playAgain() {
    recordedMoves.current = null
    const next = startPegline(restartPegline(state))
    setState(next)
    focusFirstPeg(next.board)
  }

  function togglePause() {
    const next = state.phase === 'paused' ? resumePegline(state) : pausePegline(state)
    setState(next)
    if (next.phase === 'playing' && state.phase === 'paused') {
      const focusIndex = state.selectedCell ?? state.board.findIndex((cell) => cell === 2)
      if (focusIndex >= 0) window.requestAnimationFrame(() => socketButtons.current[focusIndex]?.focus())
    }
  }

  function activateCell(index: number) {
    const next = selectPeglineCell(state, index)
    if (next === state) return
    setState(next)
    if (next.moves > state.moves) playSound('hit')
    else if (next.selectedCell !== state.selectedCell && next.selectedCell !== null) playSound('signal')
    if (next.phase === 'stage-clear') {
      playSound('score')
      window.requestAnimationFrame(() => actionButton.current?.focus())
    }
    if (next.phase === 'stuck') {
      playSound('miss')
      window.requestAnimationFrame(() => actionButton.current?.focus())
    }
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
      restartRoute()
      return
    }
    if (!(event.target instanceof HTMLButtonElement) || !event.target.classList.contains('pegline-socket')) return
    const direction = event.key === 'ArrowUp' ? [-1, 0]
      : event.key === 'ArrowRight' ? [0, 1]
        : event.key === 'ArrowDown' ? [1, 0]
          : event.key === 'ArrowLeft' ? [0, -1] : null
    if (!direction) return
    event.preventDefault()
    const startIndex = Number(event.target.dataset.pegCell)
    let row = peglineRow(startIndex) + direction[0]!
    let column = peglineColumn(startIndex) + direction[1]!
    while (row >= 0 && row < PEGLINE_BOARD_SIZE && column >= 0 && column < PEGLINE_BOARD_SIZE) {
      const index = peglineCell(row, column)
      if (state.board[index] !== 0) {
        socketButtons.current[index]?.focus()
        return
      }
      row += direction[0]!
      column += direction[1]!
    }
  }

  const phaseLabel = state.phase === 'ready' ? 'BOARD READY'
    : state.phase === 'playing' ? 'BOARD LIVE'
      : state.phase === 'paused' ? 'PAUSED'
        : state.phase === 'stage-clear' ? 'TARGET HELD'
          : state.phase === 'stuck' ? 'NO ROUTE' : 'ROUTE CLEAR'
  const instruction = state.phase === 'complete'
    ? `All three boards cleared in ${state.moves} moves.`
    : state.phase === 'stuck'
      ? 'The current board needs a fresh route.'
      : state.phase === 'paused'
        ? 'The current board is paused.'
        : `${puzzle.title}, board ${state.stageIndex + 1} of ${PEGLINE_PUZZLES.length}. ${pegsLeft} pegs remain.`

  return (
    <section className={`snake-view pegline-view${reduceMotion ? ' reduce-motion' : ''}`} aria-labelledby="pegline-title" onKeyDown={handleKeyDown}>
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> All games</button>
      <div className="snake-layout pegline-layout">
        <div className="snake-copy pegline-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> NOW PLAYING</p>
          <h1 id="pegline-title">Pegline<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">One jump clears a space. Keep a path open and leave one peg on the center target.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Select a peg, then move it two sockets in a straight line over a neighboring peg. The jumped peg is removed. Clear all but one, with the last peg on the glowing target, to advance.</p>
            <p>Tap or click a peg and one of its highlighted sockets. Keyboard users can use <strong>Tab</strong> or the <strong>Arrow keys</strong> to choose a socket, then press <strong>Enter</strong> or <strong>Space</strong>. <strong>Escape</strong> pauses and <strong>R</strong> restarts all three boards.</p>
          </div>
          <div className="score-card pegline-score" aria-label={`Total moves ${state.moves}. Board ${state.stageIndex + 1} of ${PEGLINE_PUZZLES.length}. ${bestMoves === null ? 'No local best yet.' : `Local best ${bestMoves} moves.`}`}>
            <div className="breakout-score-main">
              <span className="score-caption">TOTAL MOVES</span>
              <strong className="score-value">{String(state.moves).padStart(2, '0')}</strong>
              <span className="score-unit">{state.stageMoves} on this board</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">FEWEST / THIS BROWSER</span>
              <strong>{bestMoves === null ? '—' : String(bestMoves).padStart(2, '0')}</strong>
              <span className="score-unit">moves to clear all three</span>
            </div>
          </div>
          <p className="pegline-local-note">Your fewest-move clear stays saved in this browser and does not sync.</p>
        </div>

        <div className="play-column pegline-play-column">
          <div className={`pegline-console phase-${state.phase}`}>
            <div className="frame-topline"><span>FIELD 48</span><span className="frame-light"><i /> {phaseLabel}</span></div>
            <div className="pegline-roundline">
              <div><span>BOARD {String(state.stageIndex + 1).padStart(2, '0')} / 03</span><strong>{puzzle.title}</strong></div>
              <b>{state.moves}<small> MOVES</small></b>
            </div>
            <div className="pegline-progress" aria-label={`${state.stageIndex + (state.phase === 'stage-clear' || state.phase === 'complete' ? 1 : 0)} of ${PEGLINE_PUZZLES.length} boards cleared`}>
              {PEGLINE_PUZZLES.map((item, index) => {
                const boardCleared = index < state.stageIndex || (index === state.stageIndex && (state.phase === 'stage-clear' || state.phase === 'complete'))
                return <span key={item.title} className={boardCleared ? 'is-clear' : index === state.stageIndex ? 'is-current' : ''} />
              })}
            </div>
            <div className="pegline-board-frame">
              <div className="pegline-board" role="group" aria-label={`${puzzle.title}. Five by five pegboard. Select a peg, then a highlighted destination.`}>
                {state.board.map((contents, index) => {
                  if (contents === 0) return <span className="pegline-outside" key={index} aria-hidden="true" />
                  const row = peglineRow(index)
                  const column = peglineColumn(index)
                  const isPeg = contents === 2
                  const isSelected = state.selectedCell === index
                  const isGoal = puzzle.target === index
                  const isTarget = targets.has(index)
                  const label = `Row ${row + 1}, column ${column + 1}, ${isPeg ? 'peg' : 'empty socket'}${isGoal ? ', final target' : ''}${isSelected ? ', selected' : ''}${isTarget ? ', legal jump destination' : ''}`
                  return (
                    <button
                      className={`pegline-socket${isPeg ? ' is-peg' : ' is-empty'}${isSelected ? ' is-selected' : ''}${isTarget ? ' is-target' : ''}${isGoal ? ' is-goal' : ''}`}
                      key={index}
                      ref={(element) => { socketButtons.current[index] = element }}
                      type="button"
                      data-peg-cell={index}
                      aria-label={label}
                      aria-pressed={isSelected}
                      disabled={state.phase !== 'playing'}
                      onClick={() => activateCell(index)}
                    >
                      <span className="pegline-marble" aria-hidden="true">{isPeg ? '●' : ''}</span>
                    </button>
                  )
                })}
              </div>
              {state.phase !== 'playing' && (
                <div className="pegline-overlay">
                  <div>
                    <span>{state.phase === 'ready' ? 'ROUTE READY' : state.phase === 'paused' ? 'BOARD PAUSED' : state.phase === 'stage-clear' ? 'TARGET HELD' : state.phase === 'stuck' ? 'ROUTE BLOCKED' : 'ALL BOARDS CLEAR'}</span>
                    <strong>{state.phase === 'ready' ? 'One peg remains.' : state.phase === 'paused' ? 'Take your time.' : state.phase === 'stage-clear' ? `${puzzle.title} cleared.` : state.phase === 'stuck' ? 'Try a new route.' : `${state.moves} moves.`}</strong>
                    <p>{state.phase === 'ready' ? 'Clear each pegboard and finish on its center target.' : state.phase === 'stage-clear' ? `${state.stageMoves} jumps on this board. Continue to the next layout.` : instruction}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="pegline-status" role="status" aria-live="polite">{state.message}</p>
            <div className="pegline-legend"><span><i className="legend-marble" />MARBLE</span><span><i className="legend-target" />FINAL SOCKET</span><span>{pegsLeft} LEFT</span></div>
            <div className="pegline-actions">
              {state.phase === 'ready' ? <button className="pegline-action pegline-action-primary" type="button" ref={actionButton} onClick={startRoute}>Start route <kbd>ENTER</kbd></button>
                : state.phase === 'stage-clear' ? <button className="pegline-action pegline-action-primary" type="button" ref={actionButton} onClick={nextBoard}>Next board <kbd>ENTER</kbd></button>
                  : state.phase === 'stuck' ? <button className="pegline-action pegline-action-primary" type="button" ref={actionButton} onClick={retryBoard}>Retry board <kbd>ENTER</kbd></button>
                    : state.phase === 'complete' ? <button className="pegline-action pegline-action-primary" type="button" ref={actionButton} onClick={playAgain}>Play again <kbd>ENTER</kbd></button>
                      : <button className="pegline-action pegline-action-pause" type="button" ref={actionButton} onClick={togglePause}>{state.phase === 'paused' ? 'Resume board' : 'Pause'} <kbd>ESC</kbd></button>}
              {state.phase !== 'ready' && state.phase !== 'complete' && <button className="pegline-action" type="button" onClick={restartRoute}>Restart route <kbd>R</kbd></button>}
            </div>
          </div>
          <p className="pegline-footnote">All three layouts and moves run in this browser. No account or online game service is involved.</p>
        </div>
      </div>
    </section>
  )
}
