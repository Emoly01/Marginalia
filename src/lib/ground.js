// Night vellum or day vellum, chosen per device (not per campaign, not
// synced): stored in localStorage, defaulting to night. "auto" means night
// at the table and day at the desk.
import { useEffect, useState } from 'react'

export const GROUND_PREFS = [
  { value: 'night', label: 'Night vellum' },
  { value: 'day', label: 'Day vellum' },
  { value: 'auto', label: 'Night at the table, day at the desk' },
]

const KEY = 'marginalia.ground'
const listeners = new Set()

export function readGroundPref(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(KEY)
    return GROUND_PREFS.some((g) => g.value === v) ? v : 'night'
  } catch {
    return 'night'
  }
}

export function writeGroundPref(value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, value)
  } catch {
    // Private mode or blocked storage: the choice lasts until reload.
  }
  listeners.forEach((fn) => fn(value))
}

/** A preference and where I am → the ground to draw. */
export function resolveGround(pref, place = 'desk') {
  if (pref === 'day') return 'day'
  if (pref === 'auto') return place === 'table' ? 'night' : 'day'
  return 'night'
}

/** The current preference, updating everywhere when it changes. */
export function useGroundPref() {
  const [pref, setPref] = useState(readGroundPref)
  useEffect(() => {
    listeners.add(setPref)
    return () => listeners.delete(setPref)
  }, [])
  return [pref, writeGroundPref]
}
