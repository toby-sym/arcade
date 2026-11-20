type PadButton = number | { pressed?: boolean; value?: number } | null | undefined

export type StandardGamepadLike = {
  connected?: boolean
  mapping?: string
  buttons?: ArrayLike<PadButton>
  axes?: ArrayLike<number>
} | null

const BUTTON_KEYS = [
  [0, 'z'], // A
  [1, 'x'], // B
  [4, 's'], // L shoulder
  [5, 'a'], // R shoulder
  [6, 's'], // L trigger
  [7, 'a'], // R trigger
  [8, 'Backspace'], // Select
  [9, 'Enter'], // Start
  [12, 'ArrowUp'],
  [13, 'ArrowDown'],
  [14, 'ArrowLeft'],
  [15, 'ArrowRight'],
] as const

export function readStandardGamepads(gamepads: ArrayLike<StandardGamepadLike>): { connectedCount: number; keys: Set<string> } {
  const keys = new Set<string>()
  let connectedCount = 0

  for (const pad of Array.from(gamepads)) {
    if (!pad || pad.connected === false || pad.mapping !== 'standard') continue
    connectedCount += 1

    for (const [index, key] of BUTTON_KEYS) {
      const button = pad.buttons?.[index]
      const pressed = typeof button === 'number' ? button >= 0.5 : !!button && (button.pressed || (button.value ?? 0) >= 0.5)
      if (pressed) keys.add(key)
    }

    const x = pad.axes?.[0] ?? 0
    const y = pad.axes?.[1] ?? 0
    if (x <= -0.5) keys.add('ArrowLeft')
    if (x >= 0.5) keys.add('ArrowRight')
    if (y <= -0.5) keys.add('ArrowUp')
    if (y >= 0.5) keys.add('ArrowDown')
  }

  return { connectedCount, keys }
}
