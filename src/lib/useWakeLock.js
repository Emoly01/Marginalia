// Keep the screen on while `active` (table view). Uses the Screen Wake Lock
// API where it exists; the browser drops the lock whenever the page is
// hidden, so it is taken again each time the page becomes visible.
import { useEffect } from 'react'

export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined
    let lock = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) next.release()
        else lock = next
      } catch (err) {
        // Refused (battery saver, no user gesture yet…) — the screen just dims as usual.
        console.warn('Wake lock unavailable:', err?.message || err)
      }
    }

    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [active])
}
