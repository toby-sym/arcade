import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react'

type HeldKeyActions = Record<string, () => void>

export function useHeldKeys(actions: HeldKeyActions, enabled = true, repeatMs = 16) {
  const actionsRef = useRef(actions)
  const heldKeys = useRef(new Set<string>())
  const enabledRef = useRef(enabled)
  actionsRef.current = actions
  enabledRef.current = enabled

  useEffect(() => {
    const clear = () => heldKeys.current.clear()
    const release = (event: globalThis.KeyboardEvent) => heldKeys.current.delete(normalizeKey(event.key))
    window.addEventListener('keyup', release)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keyup', release)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      heldKeys.current.clear()
      return
    }
    const timer = window.setInterval(() => {
      for (const key of heldKeys.current) actionsRef.current[key]?.()
    }, repeatMs)
    return () => window.clearInterval(timer)
  }, [enabled, repeatMs])

  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    const key = normalizeKey(event.key)
    const action = actionsRef.current[key]
    if (!action) return
    event.preventDefault()
    if (!enabledRef.current) return
    if (heldKeys.current.has(key)) return
    heldKeys.current.add(key)
    action()
  }, [])
}

function normalizeKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key
}
