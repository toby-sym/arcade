import { useEffect, useReducer, useRef } from 'react'
import { useArcadeSound } from '../audio/arcadeAudio'
import { utcDateKey } from './dailyPattern'
import { createVertexState, vertexProgress, vertexReducer, type VertexAction, type VertexProgress } from './vertex'

interface VertexGameProps {
  onBack: () => void
  bestMoves: number | null
  progress: VertexProgress | null
  onSaveProgress: (progress: VertexProgress) => void
}

export function VertexGame({ onBack, bestMoves, progress, onSaveProgress }: VertexGameProps) {
  const today = utcDateKey()
  const playSound = useArcadeSound()
  const firstEdgeRef = useRef<SVGGElement>(null)
  const [state, dispatch] = useReducer(
    vertexReducer,
    { date: today, progress: progress?.date === today ? progress : null },
    ({ date, progress: saved }) => createVertexState(date, saved),
  )

  useEffect(() => {
    firstEdgeRef.current?.focus()
  }, [])

  const sendAction = (action: VertexAction) => {
    const next = vertexReducer(state, action)
    if (next === state) return
    dispatch(action)
    if (next.moves !== state.moves) onSaveProgress(vertexProgress(next))
    if (state.phase !== 'complete' && next.phase === 'complete') playSound('win')
  }

  const resetDisabled = state.phase === 'complete' || (state.moves === 0 && state.selectedEdges.length === 0)

  return (
    <section className="snake-view vertex-view" aria-labelledby="vertex-title">
      <button className="back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All games
      </button>
      <div className="snake-layout vertex-layout">
        <div className="snake-copy vertex-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DAILY LOOP · UTC</p>
          <h1 id="vertex-title">Vertex<span className="title-period" aria-hidden="true">.</span></h1>
          <p className="snake-lede">A small triangle grid. One loop to find.</p>
          <div className="how-to-play">
            <h2>How to play</h2>
            <p>Connect the edges to make one continuous closed loop. Each numbered vertex tells you how many lines should meet there. A fresh triangle puzzle arrives daily.</p>
          </div>
          <div className="score-card vertex-score" aria-label={`${state.moves} moves. ${bestMoves === null ? 'No personal best yet.' : `Best solve: ${bestMoves} moves.`}`}>
            <div className="vertex-run-stat">
              <span className="score-caption">TODAY · {state.date}</span>
              <strong className="score-value">{state.moves}</strong>
              <span className="score-unit">edge changes</span>
            </div>
            <div className="local-best-readout">
              <span className="score-caption">BEST SOLVE · THIS BROWSER</span>
              <strong className="score-value">{bestMoves === null ? '—' : bestMoves}</strong>
              <span className="score-unit">moves</span>
            </div>
          </div>
          <p className="vertex-local-note">Your daily loop and best solve stay in this browser. They do not sync.</p>
        </div>

        <div className="play-column vertex-play-column">
          <div className="vertex-console">
            <div className="frame-topline">
              <span>FIELD 19</span>
              <span className={`frame-light ${state.phase === 'complete' ? 'phase-complete' : ''}`}><i />{state.phase === 'complete' ? 'SOLVED' : `${state.selectedEdges.length} LINES`}</span>
            </div>
            <svg className="vertex-board" viewBox="0 0 280 260" role="group" aria-label="Triangular Vertex loop puzzle. Each numbered point shows the required number of connected lines.">
              {state.edges.map((edge) => {
                const from = state.vertices[edge.from]!
                const to = state.vertices[edge.to]!
                const selected = state.selectedEdges.includes(edge.id)
                return (
                  <g
                    className="vertex-edge-control"
                    key={edge.id}
                    ref={edge.id === state.edges[0]?.id ? firstEdgeRef : null}
                    role="button"
                    tabIndex={0}
                    aria-label={`Line from vertex ${edge.from + 1} (clue ${from.clue}) to vertex ${edge.to + 1} (clue ${to.clue}), ${selected ? 'selected' : 'not selected'}`}
                    aria-pressed={selected}
                    onClick={() => sendAction({ type: 'toggle-edge', edgeId: edge.id })}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      sendAction({ type: 'toggle-edge', edgeId: edge.id })
                    }}
                  >
                    <line className="vertex-edge-hit" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                    <line className={`vertex-edge-line${selected ? ' vertex-edge-selected' : ''}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                  </g>
                )
              })}
              {state.vertices.map((vertex) => (
                <g className="vertex-point" key={vertex.id} role="img" aria-label={`Vertex ${vertex.id + 1}, ${vertex.clue} lines required`}>
                  <circle cx={vertex.x} cy={vertex.y} r="11" aria-hidden="true" />
                  <text x={vertex.x} y={vertex.y + 3.5} aria-hidden="true">{vertex.clue}</text>
                </g>
              ))}
            </svg>
            <div className="vertex-actions">
              <button className="button button-secondary" type="button" onClick={() => sendAction({ type: 'restart' })} disabled={resetDisabled}>Restart board</button>
            </div>
            <p className="vertex-status" role="status" aria-live="polite">{state.message}</p>
            <div className="vertex-console-footer"><span>CLICK · TOUCH · TAB · ENTER</span><span>{state.selectedEdges.length} / {state.edges.length} LINES</span></div>
          </div>
          <p className="vertex-keyboard-hint">Tab to a line, then press Enter or Space to add or remove it. Click or tap any line too.</p>
        </div>
      </div>
    </section>
  )
}
