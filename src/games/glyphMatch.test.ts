import { describe, expect, it } from 'vitest'
import {
  GLYPH_MATCH_PAIR_COUNT,
  GLYPH_MATCH_TILE_COUNT,
  createGlyphMatchPuzzle,
  createGlyphMatchState,
  glyphMatchProgress,
  glyphMatchReducer,
  validGlyphMatchProgress,
} from './glyphMatch'

const DATE = '2026-11-19'

function pairsFor(glyphs: string[]): number[][] {
  const pairs = new Map<string, number[]>()
  glyphs.forEach((glyph, index) => pairs.set(glyph, [...(pairs.get(glyph) ?? []), index]))
  return [...pairs.values()]
}

describe('daily Glyph Match', () => {
  it('creates the same sixteen-tile board for everyone on the same UTC date', () => {
    const puzzle = createGlyphMatchPuzzle(DATE)
    expect(createGlyphMatchPuzzle(DATE)).toEqual(puzzle)
    expect(createGlyphMatchPuzzle('2026-11-20')).not.toEqual(puzzle)
    expect(puzzle.glyphs).toHaveLength(GLYPH_MATCH_TILE_COUNT)
    expect(pairsFor(puzzle.glyphs)).toHaveLength(GLYPH_MATCH_PAIR_COUNT)
    expect(pairsFor(puzzle.glyphs).every((pair) => pair.length === 2)).toBe(true)
    expect(() => createGlyphMatchPuzzle('2026-02-30')).toThrow(RangeError)
  })

  it('reveals one tile without counting a turn, then counts a completed pair attempt', () => {
    const puzzle = createGlyphMatchPuzzle(DATE)
    let state = createGlyphMatchState(DATE)
    const [firstMatch, secondMatch] = pairsFor(puzzle.glyphs)[0]!
    state = glyphMatchReducer(state, { type: 'select', index: firstMatch! })
    expect(state.moves).toBe(0)
    expect(state.revealedIndices).toEqual([firstMatch])
    expect(glyphMatchReducer(state, { type: 'select', index: firstMatch! })).toBe(state)

    state = glyphMatchReducer(state, { type: 'select', index: secondMatch! })
    expect(state.moves).toBe(1)
    expect(state.matchedIndices).toEqual([firstMatch, secondMatch])
    expect(state.message).toBe('Pair found. Keep going.')
  })

  it('holds mismatches briefly and then hides both tiles', () => {
    const puzzle = createGlyphMatchPuzzle(DATE)
    const [firstGlyph, secondGlyph] = pairsFor(puzzle.glyphs).slice(0, 2)
    let state = createGlyphMatchState(DATE)
    state = glyphMatchReducer(state, { type: 'select', index: firstGlyph![0]! })
    state = glyphMatchReducer(state, { type: 'select', index: secondGlyph![0]! })
    expect(state.mismatch).toBe(true)
    expect(state.revealedIndices).toHaveLength(2)
    expect(glyphMatchReducer(state, { type: 'select', index: secondGlyph![1]! })).toBe(state)

    state = glyphMatchReducer(state, { type: 'hide-mismatch' })
    expect(state.mismatch).toBe(false)
    expect(state.revealedIndices).toHaveLength(0)
    expect(state.moves).toBe(1)
    expect(state.message).toBe('No match. Try another pair.')
  })

  it('completes all eight pairs, saves the result, and restores it', () => {
    const puzzle = createGlyphMatchPuzzle(DATE)
    let state = createGlyphMatchState(DATE)
    for (const [first, second] of pairsFor(puzzle.glyphs)) {
      state = glyphMatchReducer(state, { type: 'select', index: first! })
      state = glyphMatchReducer(state, { type: 'select', index: second! })
    }

    expect(state.phase).toBe('complete')
    expect(state.moves).toBe(GLYPH_MATCH_PAIR_COUNT)
    expect(state.matchedIndices).toHaveLength(GLYPH_MATCH_TILE_COUNT)
    const progress = glyphMatchProgress(state)
    expect(validGlyphMatchProgress(progress)).toBe(true)
    expect(createGlyphMatchState(DATE, progress).phase).toBe('complete')
    expect(glyphMatchReducer(state, { type: 'restart' })).toBe(state)
  })

  it('restores valid pairs, rejects corrupted state, and restarts the same board', () => {
    const puzzle = createGlyphMatchPuzzle(DATE)
    const firstPair = pairsFor(puzzle.glyphs)[0]!
    const progress = { date: DATE, matchedIndices: firstPair, moves: 2 }
    const restored = createGlyphMatchState(DATE, progress)
    expect(restored.matchedIndices).toEqual(firstPair)
    expect(restored.moves).toBe(2)
    expect(createGlyphMatchState('2026-11-20', progress).matchedIndices).toHaveLength(0)
    expect(validGlyphMatchProgress({ ...progress, matchedIndices: [firstPair[0]] })).toBe(false)
    expect(validGlyphMatchProgress({ ...progress, matchedIndices: [firstPair[0], firstPair[0]] })).toBe(false)
    expect(validGlyphMatchProgress({ ...progress, date: '2026-02-30' })).toBe(false)

    const reset = glyphMatchReducer(restored, { type: 'restart' })
    expect(reset.matchedIndices).toHaveLength(0)
    expect(reset.moves).toBe(0)
    expect(reset.glyphs).toEqual(puzzle.glyphs)
  })
})
