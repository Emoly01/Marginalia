// Registers the service worker, and when a new version is waiting offers a
// reload instead of taking one — a reload mid-session is your call.
import { useRegisterSW } from 'virtual:pwa-register/react'

// Long-lived tabs (table view all evening) never navigate, so ask now and then.
const UPDATE_CHECK_MS = 60 * 60 * 1000

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_MS)
    },
    onRegisterError(err) {
      console.error('Service worker registration failed:', err)
    },
  })

  if (!needRefresh) return null
  return (
    <div className="update-prompt" role="status">
      <span>A new version of Marginalia is ready.</span>
      <button className="btn-primary btn-primary--sm" onClick={() => updateServiceWorker(true)}>Reload</button>
      <button className="btn" onClick={() => setNeedRefresh(false)}>Later</button>
    </div>
  )
}
