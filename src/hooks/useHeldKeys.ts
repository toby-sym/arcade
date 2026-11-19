import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react'

type HeldKeyActions = Record<string, (deltaMs: number) => void>
const CONTINUOUS_REPEAT_MS = 16
const MAX_FRAME_DELTA_MS = 50

export function useHeldKeys(actions: HeldKeyActions, enabled = true, repeatMs = 16) {
  const actionsRef = useRef(actions)
  const heldKeys = useRef(new Set<string>())
  const enabledRef = useRef(enabled)
  const repeatMsRef = useRef(repeatMs)
  const animationFrame = useRef<number | null>(null)
  const previousFrameTime = useRef<number | null>(null)
  const repeatElapsed = useRef(0)
  actionsRef.current = actions
  enabledRef.current = enabled
  repeatMsRef.current = repeatMs

  const stopRepeating = useCallback(() => {
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
    animationFrame.current = null
    previousFrameTime.current = null
    repeatElapsed.current = 0
  }, [])

  const clearHeldKeys = useCallback(() => {
    heldKeys.current.clear()
    stopRepeating()
  }, [stopRepeating])

  const animate = useCallback((time: number) => {
    animationFrame.current = null
    if (!enabledRef.current || heldKeys.current.size === 0) {
      stopRepeating()
      return
    }

    const elapsedMs = previousFrameTime.current === null
      ? 0
      : Math.min(Math.max(time - previousFrameTime.current, 0), MAX_FRAME_DELTA_MS)
    previousFrameTime.current = time

    if (repeatMsRef.current <= CONTINUOUS_REPEAT_MS) {
      for (const key of heldKeys.current) actionsRef.current[key]?.(elapsedMs)
    } else {
      repeatElapsed.current += elapsedMs
      while (repeatElapsed.current >= repeatMsRef.current) {
        for (const key of heldKeys.current) actionsRef.current[key]?.(repeatMsRef.current)
        repeatElapsed.current -= repeatMsRef.current
      }
    }

    animationFrame.current = window.requestAnimationFrame(animate)
  }, [stopRepeating])

  useEffect(() => {
    const release = (event: globalThis.KeyboardEvent) => {
      heldKeys.current.delete(normalizeKey(event.key))
      if (heldKeys.current.size === 0) stopRepeating()
    }
    const clearWhenHidden = () => {
      if (document.hidden) clearHeldKeys()
    }
    window.addEventListener('keyup', release)
    window.addEventListener('blur', clearHeldKeys)
    document.addEventListener('visibilitychange', clearWhenHidden)
    return () => {
      window.removeEventListener('keyup', release)
      window.removeEventListener('blur', clearHeldKeys)
      document.removeEventListener('visibilitychange', clearWhenHidden)
      clearHeldKeys()
    }
  }, [clearHeldKeys, stopRepeating])

  useEffect(() => {
    if (!enabled) {
      clearHeldKeys()
    }
  }, [clearHeldKeys, enabled])

  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    const key = normalizeKey(event.key)
    const action = actionsRef.current[key]
    if (!action) return
    event.preventDefault()
    if (!enabledRef.current) return
    if (heldKeys.current.has(key)) return

    if (heldKeys.current.size === 0) {
      previousFrameTime.current = window.performance.now()
      repeatElapsed.current = 0
    }
    heldKeys.current.add(key)
    action(Math.min(repeatMsRef.current, CONTINUOUS_REPEAT_MS))
    if (animationFrame.current === null) animationFrame.current = window.requestAnimationFrame(animate)
  }, [animate])
}

function normalizeKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key
}
