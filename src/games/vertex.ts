export const VERTEX_ROW_COUNT = 5
export const VERTEX_MINIMUM_LOOP_LENGTH = 6

export interface VertexPoint {
  id: number
  row: number
  column: number
  x: number
  y: number
  clue: 0 | 2
}

export interface VertexEdge {
  id: string
  from: number
  to: number
}

export interface VertexPuzzle {
  date: string
  vertices: VertexPoint[]
  edges: VertexEdge[]
  solutionEdges: string[]
}

export interface VertexProgress {
  date: string
  selectedEdges: string[]
  moves: number
}

export interface VertexState extends VertexPuzzle {
  selectedEdges: string[]
  moves: number
  phase: 'playing' | 'complete'
  message: string
}

export type VertexAction =
  | { type: 'toggle-edge'; edgeId: string }
  | { type: 'restart' }

export function createVertexPuzzle(date: string): VertexPuzzle {
  if (!isUtcDateKey(date)) throw new RangeError('Date must be a real UTC date in YYYY-MM-DD format.')

  const random = createRandom(date)
  const vertices: VertexPoint[] = []
  for (let row = 0; row < VERTEX_ROW_COUNT; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      vertices.push({
        id: vertices.length,
        row,
        column,
        x: 28 + 56 * column + 28 * (VERTEX_ROW_COUNT - 1 - row),
        y: 34 + 48 * row,
        clue: 0,
      })
    }
  }

  const edgePairs: Array<[number, number]> = []
  for (let row = 0; row < VERTEX_ROW_COUNT; row += 1) {
    for (let column = 0; column < row; column += 1) {
      edgePairs.push([vertexId(row, column), vertexId(row, column + 1)])
    }
    if (row < VERTEX_ROW_COUNT - 1) {
      for (let column = 0; column <= row; column += 1) {
        edgePairs.push([vertexId(row, column), vertexId(row + 1, column)])
        edgePairs.push([vertexId(row, column), vertexId(row + 1, column + 1)])
      }
    }
  }

  const edges = edgePairs.map(([from, to]) => ({ id: edgeId(from, to), from, to }))
  const neighbors = new Map(vertices.map((vertex) => [vertex.id, [] as number[]]))
  for (const edge of edges) {
    neighbors.get(edge.from)!.push(edge.to)
    neighbors.get(edge.to)!.push(edge.from)
  }

  const cycle = findDailyCycle(random, neighbors)
  const solutionEdges = cycle.map((from, index) => edgeId(from, cycle[(index + 1) % cycle.length]!))
  const loopVertices = new Set(cycle)
  for (const vertex of vertices) if (loopVertices.has(vertex.id)) vertex.clue = 2

  return { date, vertices, edges, solutionEdges }
}

export function createVertexState(date: string, progress?: VertexProgress | null): VertexState {
  const puzzle = createVertexPuzzle(date)
  const selectedEdges: string[] = []
  let moves = 0

  if (progress?.date === date && validVertexProgress(progress)) {
    selectedEdges.push(...progress.selectedEdges)
    moves = progress.moves
  }

  const complete = isVertexSolved(puzzle, selectedEdges)
  return {
    ...puzzle,
    selectedEdges,
    moves,
    phase: complete ? 'complete' : 'playing',
    message: complete
      ? `Loop complete in ${moves} moves. A fresh puzzle arrives tomorrow.`
      : selectedEdges.length > 0
        ? 'Progress restored. Close the loop through the numbered vertices.'
        : 'Connect the vertices to form one closed loop. Every clue shows how many lines meet there.',
  }
}

export function vertexReducer(state: VertexState, action: VertexAction): VertexState {
  if (state.phase === 'complete') return state

  if (action.type === 'restart') {
    if (state.selectedEdges.length === 0 && state.moves === 0) return state
    return {
      ...state,
      selectedEdges: [],
      moves: 0,
      message: 'Board reset. Find one closed loop.',
    }
  }

  if (!state.edges.some((edge) => edge.id === action.edgeId)) return state
  const selected = new Set(state.selectedEdges)
  if (selected.has(action.edgeId)) selected.delete(action.edgeId)
  else selected.add(action.edgeId)
  const selectedEdges = [...selected]
  const moves = state.moves + 1
  const complete = isVertexSolved(state, selectedEdges)
  const matchingClues = countMatchingClues(state, selectedEdges)

  return {
    ...state,
    selectedEdges,
    moves,
    phase: complete ? 'complete' : 'playing',
    message: complete
      ? `Loop complete in ${moves} ${moves === 1 ? 'move' : 'moves'}. A fresh puzzle arrives tomorrow.`
      : `${matchingClues} of ${state.vertices.length} vertex clues match. Build one closed loop.`,
  }
}

export function vertexProgress(state: VertexState): VertexProgress {
  return { date: state.date, selectedEdges: [...state.selectedEdges], moves: state.moves }
}

export function validVertexProgress(value: unknown): value is VertexProgress {
  if (!isRecord(value) || !isUtcDateKey(value.date) || !Array.isArray(value.selectedEdges)) return false
  if (value.selectedEdges.length > 40 || !value.selectedEdges.every((edgeId) => typeof edgeId === 'string')) return false
  if (new Set(value.selectedEdges).size !== value.selectedEdges.length) return false
  if (!Number.isSafeInteger(value.moves) || (value.moves as number) < value.selectedEdges.length || (value.moves as number) > 9999) return false
  const edgeIds = new Set(createVertexPuzzle(value.date).edges.map((edge) => edge.id))
  return value.selectedEdges.every((edgeId) => edgeIds.has(edgeId as string))
}

function isVertexSolved(puzzle: Pick<VertexPuzzle, 'vertices' | 'edges'>, selectedEdges: string[]): boolean {
  if (!isSingleLoop(puzzle.edges, selectedEdges)) return false
  const selected = new Set(selectedEdges)
  return puzzle.vertices.every((vertex) => {
    const degree = puzzle.edges.reduce((count, edge) => count + (selected.has(edge.id) && (edge.from === vertex.id || edge.to === vertex.id) ? 1 : 0), 0)
    return degree === vertex.clue
  })
}

function countMatchingClues(puzzle: Pick<VertexPuzzle, 'vertices' | 'edges'>, selectedEdges: string[]): number {
  const selected = new Set(selectedEdges)
  return puzzle.vertices.filter((vertex) => {
    const degree = puzzle.edges.reduce((count, edge) => count + (selected.has(edge.id) && (edge.from === vertex.id || edge.to === vertex.id) ? 1 : 0), 0)
    return degree === vertex.clue
  }).length
}

function isSingleLoop(edges: VertexEdge[], selectedEdges: string[]): boolean {
  if (selectedEdges.length < VERTEX_MINIMUM_LOOP_LENGTH) return false
  const selected = new Set(selectedEdges)
  const neighbors = new Map<number, number[]>()
  for (const edge of edges) {
    if (!selected.has(edge.id)) continue
    neighbors.set(edge.from, [...(neighbors.get(edge.from) ?? []), edge.to])
    neighbors.set(edge.to, [...(neighbors.get(edge.to) ?? []), edge.from])
  }
  if ([...neighbors.values()].some((next) => next.length !== 2)) return false

  const start = neighbors.keys().next().value as number | undefined
  if (start === undefined) return false
  const visited = new Set<number>([start])
  const queue = [start]
  while (queue.length) {
    const current = queue.shift()!
    for (const next of neighbors.get(current) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      queue.push(next)
    }
  }
  return visited.size === neighbors.size && [...neighbors.values()].reduce((sum, next) => sum + next.length, 0) === selectedEdges.length * 2
}

function findDailyCycle(random: () => number, neighbors: Map<number, number[]>): number[] {
  const targetLengths = [9, 8, 10, 7, 11, 6]
  for (const target of targetLengths) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const start = Math.floor(random() * neighbors.size)
      const path = [start]
      const visited = new Set(path)
      if (extendCycle(path, visited, target, neighbors, random)) return path
    }
  }
  return [0, 1, 3, 6, 10, 11, 12, 13, 14, 9, 5, 2]
}

function extendCycle(path: number[], visited: Set<number>, target: number, neighbors: Map<number, number[]>, random: () => number): boolean {
  const current = path[path.length - 1]!
  if (path.length === target) return neighbors.get(current)!.includes(path[0]!)

  const candidates = [...neighbors.get(current)!].filter((candidate) => !visited.has(candidate))
  shuffle(candidates, random)
  for (const candidate of candidates) {
    path.push(candidate)
    visited.add(candidate)
    if (extendCycle(path, visited, target, neighbors, random)) return true
    visited.delete(candidate)
    path.pop()
  }
  return false
}

function vertexId(row: number, column: number): number {
  return row * (row + 1) / 2 + column
}

function edgeId(from: number, to: number): string {
  return from < to ? `${from}-${to}` : `${to}-${from}`
}

function createRandom(seed: string): () => number {
  let state = 2166136261
  for (const character of seed) {
    state ^= character.charCodeAt(0)
    state = Math.imul(state, 16777619)
  }
  if (state === 0) state = 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!]
  }
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
