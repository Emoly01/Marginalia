// Open the search palette from anywhere: openSearch(). Same tiny pub/sub
// shape as toast.js; <SearchPalette /> listens.
const listeners = new Set()

export function openSearch() {
  listeners.forEach((fn) => fn())
}

export function onOpenSearch(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
