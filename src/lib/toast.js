// Tiny pub/sub for transient notifications.
// Call toast('message') from anywhere; the <Toasts /> component renders them.
const listeners = new Set()

export function toast(message, type = 'error') {
  listeners.forEach((fn) => fn({ message, type }))
}

export function onToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
