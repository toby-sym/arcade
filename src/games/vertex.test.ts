import { describe, expect, it } from 'vitest'
import { createVertexPuzzle, createVertexState, validVertexProgress, vertexProgress, vertexReducer } from './vertex'

describe('daily Vertex loop puzzles', () => {
  it('generates the same valid triangle graph and loop for a UTC date', () => {
    const puzzle = createVertexPuzzle('2025-06-12')
    expect(createVertexPuzzle('2025-06-12')).toEqual(puzzle)
    expect(createVertexPuzzle('2025-06-13')).not.toEqual(puzzle)
    expect(puzzle.vertices).toHaveLength(15)
    expect(puzzle.edges).toHaveLength(30)
    expect(puzzle.solutionEdges.length).toBeGreaterThanOrEqual(6)
    expect(new Set(puzzle.solutionEdges).size).toBe(puzzle.solutionEdges.length)

    const degree = new Map(puzzle.vertices.map((vertex) => [vertex.id, 0]))
    for (const edgeId of puzzle.solutionEdges) {
      const edge = puzzle.edges.find((candidate) => candidate.id === edgeId)
      expect(edge).toBeDefined()
      degree.set(edge!.from, degree.get(edge!.from)! + 1)
      degree.set(edge!.to, degree.get(edge!.to)! + 1)
    }
    for (const vertex of puzzle.vertices) expect(degree.get(vertex.id)).toBe(vertex.clue)
  })

  it('keeps every daily board solvable across a month of dates', () => {
    for (let day = 1; day <= 30; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`
      const initial = createVertexState(date)
      const solved = initial.solutionEdges.reduce((state, edgeId) => vertexReducer(state, { type: 'toggle-edge', edgeId }), initial)
      expect(solved.phase).toBe('complete')
    }
  })

  it('completes only after all clues form one closed loop', () => {
    const initial = createVertexState('2025-06-12')
    let state = initial

    for (const edgeId of initial.solutionEdges) state = vertexReducer(state, { type: 'toggle-edge', edgeId })

    expect(state.phase).toBe('complete')
    expect(state.moves).toBe(initial.solutionEdges.length)
    expect(state.message).toContain('Loop complete')
    expect(vertexProgress(state).selectedEdges).toEqual(initial.solutionEdges)
    expect(vertexReducer(state, { type: 'restart' })).toBe(state)
  })

  it('allows mistakes to be toggled off and resets the same daily puzzle', () => {
    const initial = createVertexState('2025-06-12')
    const wrongEdge = initial.edges.find((edge) => !initial.solutionEdges.includes(edge.id))!
    let state = vertexReducer(initial, { type: 'toggle-edge', edgeId: wrongEdge.id })
    expect(state.phase).toBe('playing')
    expect(state.selectedEdges).toEqual([wrongEdge.id])
    state = vertexReducer(state, { type: 'toggle-edge', edgeId: wrongEdge.id })
    expect(state.selectedEdges).toEqual([])
    expect(state.moves).toBe(2)
    expect(vertexReducer(state, { type: 'toggle-edge', edgeId: 'missing-edge' })).toBe(state)

    const reset = vertexReducer(state, { type: 'toggle-edge', edgeId: initial.solutionEdges[0]! })
    const restarted = vertexReducer(reset, { type: 'restart' })
    expect(restarted.date).toBe(initial.date)
    expect(restarted.solutionEdges).toEqual(initial.solutionEdges)
    expect(restarted.selectedEdges).toEqual([])
    expect(restarted.moves).toBe(0)
  })

  it('restores only valid daily edge selections and move counts', () => {
    const puzzle = createVertexPuzzle('2025-06-12')
    const progress = { date: puzzle.date, selectedEdges: puzzle.solutionEdges.slice(0, 2), moves: 4 }
    const restored = createVertexState(puzzle.date, progress)
    expect(restored.selectedEdges).toEqual(progress.selectedEdges)
    expect(restored.moves).toBe(4)
    expect(validVertexProgress(progress)).toBe(true)

    expect(validVertexProgress({ ...progress, date: '2025-02-30' })).toBe(false)
    expect(validVertexProgress({ ...progress, selectedEdges: ['bogus-edge'] })).toBe(false)
    expect(validVertexProgress({ ...progress, moves: 1 })).toBe(false)
    expect(validVertexProgress({ ...progress, selectedEdges: [progress.selectedEdges[0], progress.selectedEdges[0]], moves: 2 })).toBe(false)
  })
})
