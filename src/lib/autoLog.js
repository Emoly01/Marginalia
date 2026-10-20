// Turns play-state actions into session log entries, merging a burst of HP
// taps into one line: three quick "−3" taps become "took 9 damage · 38 → 29"
// instead of three entries. Storage is injected, so this stays pure.
import { describeLog } from './play'

export const COALESCE_MS = 10_000

/**
 * create({ write, update, now }) → { log(entry), reset() }
 *   write({ text, auto }) → id   — adds a log entry, returns its id
 *   update(id, { text, auto })   — rewrites an existing entry
 * `entry` is the `log` an action in play.js returns.
 */
export function createAutoLogger({ write, update, now = () => Date.now(), windowMs = COALESCE_MS }) {
  let lastHp = null // { id, at, from, to, damage, healed, absorbed }

  const hpAuto = (h) => ({
    type: 'hp',
    payload: { from: h.from, to: h.to, damage: h.damage, healed: h.healed, absorbed: h.absorbed },
  })

  return {
    log(entry) {
      if (!entry) return null
      const t = now()
      if (entry.type === 'hp' && lastHp && t - lastHp.at <= windowMs) {
        const p = entry.payload
        lastHp = {
          ...lastHp,
          at: t,
          to: p.to,
          damage: lastHp.damage + p.damage,
          healed: lastHp.healed + p.healed,
          absorbed: lastHp.absorbed + p.absorbed,
        }
        const auto = hpAuto(lastHp)
        update(lastHp.id, { text: describeLog(auto), auto })
        return lastHp.id
      }
      const id = write({ text: describeLog(entry), auto: { type: entry.type, payload: entry.payload } })
      lastHp = entry.type === 'hp' ? { id, at: t, ...entry.payload } : null
      return id
    },
    // Anything else logged in between (a note, a spell) ends the burst.
    reset() {
      lastHp = null
    },
  }
}
