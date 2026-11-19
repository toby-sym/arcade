import { describe, expect, it } from 'vitest'
import {
  CONNECTIONS_DAILY_BOARD_COUNT,
  CONNECTIONS_GROUP_SIZE,
  CONNECTIONS_MISTAKE_LIMIT,
  connectionsProgress,
  connectionsReducer,
  createConnectionsState,
  validConnectionsProgress,
  visibleConnectionsWords,
} from './connections'

const DATE = '2026-11-19'

function chooseGroup(state: ReturnType<typeof createConnectionsState>, groupId: string) {
  const group = state.groups.find((candidate) => candidate.id === groupId)!
  return group.words.reduce((next, word) => connectionsReducer(next, { type: 'toggle', word }), state)
}

describe('daily Connections puzzle', () => {
  it('creates the same complete board for everyone on a UTC date', () => {
    const first = createConnectionsState(DATE)
    const second = createConnectionsState(DATE)

    expect(first.words).toEqual(second.words)
    expect(new Set(first.words).size).toBe(16)
    expect(first.groups).toHaveLength(4)
    expect(first.groups.every((group) => group.words.length === CONNECTIONS_GROUP_SIZE)).toBe(true)
    expect(first.groups.flatMap((group) => group.words).sort()).toEqual([...first.words].sort())
    expect(createConnectionsState('2026-11-20').words).not.toEqual(first.words)

    const signatures = new Set<string>()
    for (let offset = 0; offset < CONNECTIONS_DAILY_BOARD_COUNT; offset += 1) {
      const date = new Date(`${DATE}T00:00:00.000Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      const daily = createConnectionsState(date.toISOString().slice(0, 10))
      expect(new Set(daily.words).size).toBe(16)
      expect(daily.groups.flatMap((group) => group.words).sort()).toEqual([...daily.words].sort())
      signatures.add([...daily.words].sort().join(','))
    }
    expect(signatures.size).toBe(CONNECTIONS_DAILY_BOARD_COUNT)
  })

  it('selects, submits, reveals and restores a solved group', () => {
    let state = createConnectionsState(DATE)
    const group = state.groups[0]!
    state = chooseGroup(state, group.id)
    expect(state.selectedWords).toEqual(group.words)

    state = connectionsReducer(state, { type: 'submit' })
    expect(state.solvedGroupIds).toContain(group.id)
    expect(state.selectedWords).toEqual([])
    expect(visibleConnectionsWords(state)).toHaveLength(12)

    const restored = createConnectionsState(DATE, connectionsProgress(state))
    expect(restored.solvedGroupIds).toEqual([group.id])
    expect(restored.mistakes).toBe(0)
    expect(restored.phase).toBe('playing')
  })

  it('reports a near miss and ends the board after four mistakes', () => {
    let state = createConnectionsState(DATE)
    const firstGroup = state.groups[0]!
    const secondGroup = state.groups[1]!
    const wrongWords = [...firstGroup.words.slice(0, 3), secondGroup.words[0]!]

    for (let mistake = 1; mistake <= CONNECTIONS_MISTAKE_LIMIT; mistake += 1) {
      state = wrongWords.reduce((next, word) => connectionsReducer(next, { type: 'toggle', word }), state)
      state = connectionsReducer(state, { type: 'submit' })
      expect(state.mistakes).toBe(mistake)
      if (mistake === 1) expect(state.message).toContain('One away')
    }

    expect(state.phase).toBe('lost')
    expect(state.solvedGroupIds).toEqual([])
    expect(connectionsReducer(state, { type: 'toggle', word: firstGroup.words[0]! })).toBe(state)
  })

  it('limits selection to four, allows deselection, clear and shuffle', () => {
    let state = createConnectionsState(DATE)
    const [first, second, third, fourth, fifth] = state.words
    for (const word of [first!, second!, third!, fourth!, fifth!]) {
      state = connectionsReducer(state, { type: 'toggle', word })
    }
    expect(state.selectedWords).toHaveLength(4)

    state = connectionsReducer(state, { type: 'toggle', word: first! })
    expect(state.selectedWords).toHaveLength(3)
    state = connectionsReducer(state, { type: 'clear' })
    expect(state.selectedWords).toEqual([])

    const beforeShuffle = visibleConnectionsWords(state)
    state = connectionsReducer(state, { type: 'shuffle' })
    expect(visibleConnectionsWords(state)).not.toEqual(beforeShuffle)
  })

  it('completes after finding all four groups and keeps daily data valid', () => {
    let state = createConnectionsState(DATE)
    for (const group of state.groups) {
      state = chooseGroup(state, group.id)
      state = connectionsReducer(state, { type: 'submit' })
    }

    expect(state.phase).toBe('won')
    expect(state.solvedGroupIds).toHaveLength(4)
    expect(validConnectionsProgress(connectionsProgress(state))).toBe(true)
  })

  it('restores selections but rejects malformed saved progress', () => {
    const state = createConnectionsState(DATE)
    const selected = state.words.slice(0, 2)
    const saved = { ...connectionsProgress(state), selectedWords: selected }
    expect(validConnectionsProgress(saved)).toBe(true)
    expect(createConnectionsState(DATE, saved).selectedWords).toEqual(selected)
    expect(validConnectionsProgress({ ...saved, mistakes: CONNECTIONS_MISTAKE_LIMIT + 1 })).toBe(false)
    expect(validConnectionsProgress({ ...saved, selectedWords: ['NOT-A-WORD'] })).toBe(false)
  })

  it('rejects invalid date keys', () => {
    expect(() => createConnectionsState('2026-02-30')).toThrow(RangeError)
  })
})
