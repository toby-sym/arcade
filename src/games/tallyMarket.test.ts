import { describe, expect, it } from 'vitest'
import {
  createTallyMarketState,
  isTallyMarketSolved,
  pauseTallyMarket,
  placeTallyMarketTile,
  playAgainTallyMarket,
  restartTallyMarket,
  resumeTallyMarket,
  selectTallyMarketTile,
  startTallyMarket,
  tallyMarketProgress,
  tallyMarketPuzzleForDate,
  tallyMarketTotals,
  undoTallyMarket,
  validTallyMarketProgress,
} from './tallyMarket'

describe('Tally Market', () => {
  it('builds repeatable UTC puzzles with three reachable targets', () => {
    for (const date of ['2026-01-01', '2026-05-28', '2026-11-20', '2027-12-31']) {
      const puzzle = tallyMarketPuzzleForDate(date)
      expect(tallyMarketPuzzleForDate(date)).toEqual(puzzle)
      expect(puzzle.tiles.map((tile) => tile.value).sort((left, right) => left - right)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1))
      expect(puzzle.targets).toHaveLength(3)
      expect(puzzle.targets.every((target) => target > 12)).toBe(true)
      expect(puzzle.targets).toHaveLength(new Set(puzzle.targets).size)
      expect(findSolution(puzzle.tiles, puzzle.targets)).not.toBeNull()
    }
    expect(() => tallyMarketPuzzleForDate('2026-02-30')).toThrow(RangeError)
  })

  it('places each tile once, rejects overshoots, and completes exact totals', () => {
    const puzzle = tallyMarketPuzzleForDate('2026-11-20')
    const solution = findSolution(puzzle.tiles, puzzle.targets)!
    const overshoot = findOvershootScenario(puzzle.tiles, puzzle.targets)
    expect(overshoot).not.toBeNull()
    let blockedState = startTallyMarket(createTallyMarketState(puzzle.date))
    for (const placement of overshoot!.placements) {
      blockedState = placeTallyMarketTile(selectTallyMarketTile(blockedState, placement.tileId), placement.market)
    }
    blockedState = selectTallyMarketTile(blockedState, overshoot!.tileId)
    const blocked = placeTallyMarketTile(blockedState, overshoot!.market)
    expect(blocked.placements).toEqual(blockedState.placements)
    expect(blocked.actions).toBe(blockedState.actions)
    expect(blocked.message).toContain('past')

    let state = startTallyMarket(createTallyMarketState(puzzle.date))
    expect(state.phase).toBe('playing')

    const first = solution[0]!
    state = selectTallyMarketTile(state, first.tileId)
    state = placeTallyMarketTile(state, first.market)
    expect(state.actions).toBe(1)
    expect(state.placements).toEqual([first])
    expect(selectTallyMarketTile(state, first.tileId)).toBe(state)

    for (const placement of solution.slice(1)) {
      state = placeTallyMarketTile(selectTallyMarketTile(state, placement.tileId), placement.market)
    }
    expect(state.phase).toBe('complete')
    expect(state.actions).toBe(solution.length)
    expect(tallyMarketTotals(state, state.placements)).toEqual(puzzle.targets)
    expect(isTallyMarketSolved(state, state.placements)).toBe(true)
    expect(tallyMarketProgress(state)).toEqual({ date: puzzle.date, placements: solution, actions: solution.length })
  })

  it('counts undo and restart actions, pauses cleanly, and starts a fresh attempt', () => {
    const puzzle = tallyMarketPuzzleForDate('2026-11-20')
    const solution = findSolution(puzzle.tiles, puzzle.targets)!
    let state = startTallyMarket(createTallyMarketState(puzzle.date))
    state = placeTallyMarketTile(selectTallyMarketTile(state, solution[0]!.tileId), solution[0]!.market)
    state = undoTallyMarket(state)
    expect(state.actions).toBe(2)
    expect(state.placements).toHaveLength(0)
    expect(state.phase).toBe('playing')

    state = placeTallyMarketTile(selectTallyMarketTile(state, solution[0]!.tileId), solution[0]!.market)
    state = restartTallyMarket(state)
    expect(state.actions).toBe(4)
    expect(state.placements).toHaveLength(0)

    expect(pauseTallyMarket(state).phase).toBe('paused')
    expect(resumeTallyMarket(pauseTallyMarket(state)).phase).toBe('playing')
    expect(playAgainTallyMarket({ ...state, phase: 'complete', actions: 30 }).actions).toBe(0)
  })

  it('restores only valid same-day progress', () => {
    const puzzle = tallyMarketPuzzleForDate('2026-11-20')
    const solution = findSolution(puzzle.tiles, puzzle.targets)!
    const progress = { date: puzzle.date, placements: solution.slice(0, 2), actions: 3 }
    expect(validTallyMarketProgress(progress)).toBe(true)
    expect(createTallyMarketState(puzzle.date, progress).placements).toEqual(progress.placements)
    expect(createTallyMarketState('2026-11-21', progress).placements).toEqual([])
    expect(validTallyMarketProgress({ ...progress, placements: [solution[0], solution[0]] })).toBe(false)
    expect(validTallyMarketProgress({ ...progress, actions: 1 })).toBe(false)
  })
})

function findSolution(tiles: ReturnType<typeof tallyMarketPuzzleForDate>['tiles'], targets: number[]) {
  const placements: Array<{ tileId: number; market: number }> = []
  const used = new Set<number>()

  const assignMarket = (market: number): boolean => {
    if (market === targets.length) return true
    return chooseTiles(market, 0, 0)
  }

  const chooseTiles = (market: number, startIndex: number, sum: number): boolean => {
    if (sum === targets[market]) return assignMarket(market + 1)
    if (sum > targets[market]!) return false
    for (let index = startIndex; index < tiles.length; index += 1) {
      const tile = tiles[index]!
      if (used.has(tile.id)) continue
      used.add(tile.id)
      placements.push({ tileId: tile.id, market })
      if (chooseTiles(market, index + 1, sum + tile.value)) return true
      placements.pop()
      used.delete(tile.id)
    }
    return false
  }

  return assignMarket(0) ? placements.map((placement) => ({ ...placement })) : null
}

function findOvershootScenario(tiles: ReturnType<typeof tallyMarketPuzzleForDate>['tiles'], targets: number[]) {
  for (let market = 0; market < targets.length; market += 1) {
    for (let firstIndex = 0; firstIndex < tiles.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < tiles.length; secondIndex += 1) {
        const first = tiles[firstIndex]!
        const second = tiles[secondIndex]!
        const subtotal = first.value + second.value
        if (subtotal >= targets[market]!) continue
        const overshoot = tiles.find((tile) => tile.id !== first.id && tile.id !== second.id && subtotal + tile.value > targets[market]!)
        if (overshoot) return { market, tileId: overshoot.id, placements: [{ tileId: first.id, market }, { tileId: second.id, market }] }
      }
    }
  }
  return null
}
