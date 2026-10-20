import { describe, it, expect } from 'vitest'
import { createAutoLogger } from './autoLog'

function setup() {
  let t = 0
  let n = 0
  const entries = {}
  const logger = createAutoLogger({
    now: () => t,
    write: (e) => {
      const id = `e${++n}`
      entries[id] = e
      return id
    },
    update: (id, patch) => {
      entries[id] = { ...entries[id], ...patch }
    },
  })
  return { logger, entries, tick: (ms) => (t += ms) }
}

const hit = (from, to) => ({ type: 'hp', payload: { from, to, damage: from - to, healed: 0, absorbed: 0 } })
const mend = (from, to) => ({ type: 'hp', payload: { from, to, damage: 0, healed: to - from, absorbed: 0 } })

describe('createAutoLogger', () => {
  it('merges HP taps within the window into one entry', () => {
    const { logger, entries, tick } = setup()
    logger.log(hit(38, 35))
    tick(2000)
    logger.log(hit(35, 32))
    tick(9000)
    logger.log(hit(32, 29))
    expect(Object.keys(entries)).toEqual(['e1'])
    expect(entries.e1.text).toBe('took 9 damage · 38 → 29')
    expect(entries.e1.auto).toEqual({ type: 'hp', payload: { from: 38, to: 29, damage: 9, healed: 0, absorbed: 0 } })
  })

  it('shows both directions when a burst mixes damage and healing', () => {
    const { logger, entries } = setup()
    logger.log(hit(38, 29))
    logger.log(mend(29, 31))
    expect(entries.e1.text).toBe('HP 38 → 31 (−9, +2)')
  })

  it('starts a new entry after the window', () => {
    const { logger, entries, tick } = setup()
    logger.log(hit(38, 35))
    tick(10_001)
    logger.log(hit(35, 30))
    expect(Object.values(entries).map((e) => e.text)).toEqual(['took 3 damage · 38 → 35', 'took 5 damage · 35 → 30'])
  })

  it('does not merge across other entries or a reset', () => {
    const { logger, entries } = setup()
    logger.log(hit(38, 35))
    logger.log({ type: 'slot', payload: { level: 1, spent: true, left: 3, max: 4 } })
    logger.log(hit(35, 30))
    logger.reset()
    logger.log(hit(30, 28))
    expect(Object.values(entries).map((e) => e.text)).toEqual([
      'took 3 damage · 38 → 35',
      'spent a 1st-level slot (3/4 left)',
      'took 5 damage · 35 → 30',
      'took 2 damage · 30 → 28',
    ])
  })

  it('ignores a null entry', () => {
    const { logger, entries } = setup()
    expect(logger.log(null)).toBeNull()
    expect(entries).toEqual({})
  })
})
