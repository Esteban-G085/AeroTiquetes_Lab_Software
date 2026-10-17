import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
const THROTTLE_MS = 1000

/** Llama a onTimeout si no hay actividad del usuario durante timeoutMs. */
export function useIdleTimeout({ enabled, timeoutMs, onTimeout }) {
  const callback = useRef(onTimeout)
  useEffect(() => { callback.current = onTimeout })

  useEffect(() => {
    if (!enabled) return undefined
    let timer
    let last = 0
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => callback.current?.(), timeoutMs)
    }
    const onActivity = () => {
      const now = Date.now()
      if (now - last < THROTTLE_MS) return // mousemove dispara cientos de veces por segundo
      last = now
      arm()
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    arm()
    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [enabled, timeoutMs])
}
