// Apply a campaign's ink on the ground this device prefers, for as long as
// the calling screen is shown. place: 'desk' | 'table' (for the "night at
// the table, day at the desk" preference).
import { useEffect } from 'react'
import { applyPalette } from './palette'
import { useGroundPref, resolveGround } from './ground'

export function useInk(palette, place = 'desk') {
  const [pref] = useGroundPref()
  const ground = resolveGround(pref, place)
  useEffect(() => {
    applyPalette(palette, ground)
  }, [palette, ground])
  return ground
}
