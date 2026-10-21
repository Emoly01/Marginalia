// Live play state (HP, slots, resources, rests…) as pure functions.
//
// `character/play` stores only what has been *used*; maxima come from the
// imported sheet. derivePlayState() combines the two, and each action below
// takes that derived state and returns { patch, log }: `patch` is a
// Firestore field-path update ({ 'slotsUsed.2': 1 }), `log` describes the
// change for the session log, and a null result means "nothing to do"
// (spending a slot you don't have, healing at full HP).
//
// Values in patches are absolute, computed from the local cache, rather than
// increment() — increment can't clamp at 0 or at the maximum, and with one
// device at the table there is no concurrent writer to protect against.

export const CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
]

export const MAX_EXHAUSTION = 6

export function emptyPlay() {
  return {
    hpCurrent: null, // null = full
    hpTemp: 0,
    slotsUsed: {},
    resourcesUsed: {},
    resources: [],
    hitDiceUsed: 0,
    conditions: [],
    exhaustion: 0, // 0–6; a counter, not a condition toggle
    concentration: null,
    deathSaves: { successes: 0, failures: 0 },
  }
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const whole = (n) => Math.max(0, Math.floor(Number(n) || 0))
const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th')

/**
 * Parsed sheet + play doc → everything a tracker needs to render.
 */
export function derivePlayState(sheet, play) {
  const p = { ...emptyPlay(), ...(play ?? {}) }
  const maxHp = sheet?.combat?.maxHp ?? 0
  const current = p.hpCurrent == null ? maxHp : clamp(p.hpCurrent, 0, maxHp)

  const slots = Object.entries(sheet?.slots ?? {})
    .map(([level, max]) => {
      const used = clamp(whole(p.slotsUsed?.[level]), 0, max)
      return { level: Number(level), max, used, left: max - used }
    })
    .sort((a, b) => a.level - b.level)

  const resources = (p.resources ?? []).map((r) => {
    const used = clamp(whole(p.resourcesUsed?.[r.id]), 0, r.max)
    return { ...r, used, left: r.max - used }
  })

  const dice = sheet?.combat?.hitDice?.dice ?? []
  const hitDiceMax = dice.reduce((n, d) => n + d.count, 0)
  const hitDiceUsed = clamp(whole(p.hitDiceUsed), 0, hitDiceMax)

  return {
    hp: { current, max: maxHp, temp: whole(p.hpTemp) },
    slots,
    resources,
    hitDice: { max: hitDiceMax, used: hitDiceUsed, left: hitDiceMax - hitDiceUsed, dice },
    // "Exhaustion" was a condition toggle before it became a counter.
    conditions: (p.conditions ?? []).filter((c) => c !== 'Exhaustion'),
    exhaustion: clamp(
      whole(p.exhaustion) || ((p.conditions ?? []).includes('Exhaustion') ? 1 : 0),
      0,
      MAX_EXHAUSTION
    ),
    concentration: p.concentration ?? null,
    deathSaves: {
      successes: clamp(whole(p.deathSaves?.successes), 0, 3),
      failures: clamp(whole(p.deathSaves?.failures), 0, 3),
    },
  }
}

export function damage(state, amount) {
  const n = whole(amount)
  if (!n) return null
  const { current, temp } = state.hp
  const absorbed = Math.min(temp, n)
  const to = Math.max(0, current - (n - absorbed))
  return {
    patch: { hpCurrent: to, hpTemp: temp - absorbed },
    log: { type: 'hp', payload: { from: current, to, damage: n, healed: 0, absorbed } },
  }
}

export function heal(state, amount) {
  const n = whole(amount)
  const { current, max } = state.hp
  const to = Math.min(max, current + n)
  if (!n || to === current) return null
  const patch = { hpCurrent: to === max ? null : to }
  // Any healing brings you back from 0, which ends the death-save count.
  if (current === 0) patch.deathSaves = { successes: 0, failures: 0 }
  return { patch, log: { type: 'hp', payload: { from: current, to, damage: 0, healed: to - current, absorbed: 0 } } }
}

export function setTemp(state, amount) {
  const n = whole(amount)
  if (n === state.hp.temp) return null
  return { patch: { hpTemp: n }, log: { type: 'temp', payload: { from: state.hp.temp, to: n } } }
}

export function spendSlot(state, level) {
  const s = state.slots.find((x) => x.level === Number(level))
  if (!s || s.left <= 0) return null
  return {
    patch: { [`slotsUsed.${s.level}`]: s.used + 1 },
    log: { type: 'slot', payload: { level: s.level, spent: true, left: s.left - 1, max: s.max } },
  }
}

export function restoreSlot(state, level) {
  const s = state.slots.find((x) => x.level === Number(level))
  if (!s || s.used <= 0) return null
  return {
    patch: { [`slotsUsed.${s.level}`]: s.used - 1 },
    log: { type: 'slot', payload: { level: s.level, spent: false, left: s.left + 1, max: s.max } },
  }
}

export function spendResource(state, id) {
  const r = state.resources.find((x) => x.id === id)
  if (!r || r.left <= 0) return null
  return {
    patch: { [`resourcesUsed.${r.id}`]: r.used + 1 },
    log: { type: 'resource', payload: { id: r.id, name: r.name, spent: true, left: r.left - 1, max: r.max } },
  }
}

export function restoreResource(state, id) {
  const r = state.resources.find((x) => x.id === id)
  if (!r || r.used <= 0) return null
  return {
    patch: { [`resourcesUsed.${r.id}`]: r.used - 1 },
    log: { type: 'resource', payload: { id: r.id, name: r.name, spent: false, left: r.left + 1, max: r.max } },
  }
}

/**
 * Cast a spell: one log line ("cast Hold Person (2nd-level slot)") and,
 * in the same write, whatever it costs — a slot of `slotLevel`, or a use of
 * the free-cast resource `resourceId` — plus concentration when the spell
 * needs it. Cantrips cost nothing. Null when the cost can't be paid.
 */
export function castSpell(state, { name, level = 0, slotLevel = level, resourceId = null, concentration = false }) {
  const patch = {}
  let paidWith = null
  if (resourceId) {
    const r = state.resources.find((x) => x.id === resourceId)
    if (!r || r.left <= 0) return null
    patch[`resourcesUsed.${r.id}`] = r.used + 1
    paidWith = { kind: 'free', name: r.name }
  } else if (level > 0) {
    const s = state.slots.find((x) => x.level === Number(slotLevel))
    if (!s || s.left <= 0 || s.level < level) return null
    patch[`slotsUsed.${s.level}`] = s.used + 1
    paidWith = { kind: 'slot', level: s.level, left: s.left - 1, max: s.max }
  }
  const dropped = concentration && state.concentration && state.concentration !== name ? state.concentration : null
  if (concentration) patch.concentration = name
  return { patch, log: { type: 'cast', payload: { name, paidWith, concentration: Boolean(concentration), dropped } } }
}

/**
 * Short rest: short-rest resources come back; optionally spend hit dice.
 * The dice are rolled at the table, so the caller passes the total healed
 * (rolls + CON) rather than this rolling anything.
 */
export function shortRest(state, { hitDiceSpent = 0, healed = 0 } = {}) {
  const spent = Math.min(whole(hitDiceSpent), state.hitDice.left)
  const patch = {}
  const regained = []
  for (const r of state.resources) {
    if (r.reset === 'short' && r.used > 0) {
      patch[`resourcesUsed.${r.id}`] = 0
      regained.push(r.name)
    }
  }
  let hpTo = state.hp.current
  if (spent) {
    patch.hitDiceUsed = state.hitDice.used + spent
    hpTo = Math.min(state.hp.max, state.hp.current + whole(healed))
    if (hpTo !== state.hp.current) {
      patch.hpCurrent = hpTo === state.hp.max ? null : hpTo
      if (state.hp.current === 0) patch.deathSaves = { successes: 0, failures: 0 }
    }
  }
  return {
    patch,
    log: { type: 'shortRest', payload: { regained, hitDiceSpent: spent, from: state.hp.current, to: hpTo } },
  }
}

/**
 * Long rest, 2024 rules: full HP, every slot, every resource, every hit
 * die, and one level of exhaustion off. Temporary HP, death saves and
 * concentration end too.
 */
export function longRest(state) {
  const patch = {
    hpCurrent: null,
    hpTemp: 0,
    slotsUsed: {},
    resourcesUsed: {},
    hitDiceUsed: 0,
    deathSaves: { successes: 0, failures: 0 },
    concentration: null,
  }
  if (state.exhaustion > 0) {
    patch.exhaustion = state.exhaustion - 1
    // An old "Exhaustion" toggle becomes the counter from here on.
    patch.conditions = state.conditions
  }
  return {
    patch,
    log: {
      type: 'longRest',
      payload: {
        from: state.hp.current,
        to: state.hp.max,
        droppedConcentration: state.concentration,
        exhaustion: patch.exhaustion ?? null,
      },
    },
  }
}

/** Exhaustion level, 0–6. Only the level is shown — never rules text. */
export function setExhaustion(state, level) {
  const to = clamp(whole(level), 0, MAX_EXHAUSTION)
  if (to === state.exhaustion) return null
  return {
    patch: { exhaustion: to, conditions: state.conditions },
    log: { type: 'exhaustion', payload: { from: state.exhaustion, to } },
  }
}

/** The conditions overlay's "Clear all": every condition and all exhaustion. */
export function clearConditions(state) {
  if (!state.conditions.length && !state.exhaustion) return null
  return {
    patch: { conditions: [], exhaustion: 0 },
    log: { type: 'conditionsCleared', payload: { conditions: state.conditions, exhaustion: state.exhaustion } },
  }
}

export function toggleCondition(state, name) {
  const has = state.conditions.includes(name)
  return {
    patch: { conditions: has ? state.conditions.filter((c) => c !== name) : [...state.conditions, name] },
    log: { type: 'condition', payload: { name, on: !has } },
  }
}

export function setConcentration(state, spellName) {
  const next = spellName || null
  if (next === state.concentration) return null
  return {
    patch: { concentration: next },
    log: { type: 'concentration', payload: { from: state.concentration, to: next } },
  }
}

/** kind: 'success' | 'failure' | 'reset'. */
export function deathSave(state, kind) {
  const { successes, failures } = state.deathSaves
  if (kind === 'reset') {
    if (!successes && !failures) return null
    return { patch: { deathSaves: { successes: 0, failures: 0 } }, log: { type: 'deathSave', payload: { kind } } }
  }
  const key = kind === 'success' ? 'successes' : 'failures'
  if (state.deathSaves[key] >= 3) return null
  const next = { successes, failures, [key]: state.deathSaves[key] + 1 }
  return { patch: { deathSaves: next }, log: { type: 'deathSave', payload: { kind, ...next } } }
}

/**
 * Apply a field-path patch to a plain play object — what Firestore will do
 * with it — so the hook can act on the result before the snapshot arrives.
 */
export function applyPatch(play, patch) {
  const next = structuredClone(play ?? {})
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split('.')
    let obj = next
    for (const k of keys.slice(0, -1)) obj = obj[k] = { ...(obj[k] ?? {}) }
    obj[keys[keys.length - 1]] = value
  }
  return next
}

/** A log description from an action → the line shown in the session log. */
export function describeLog({ type, payload: p }) {
  switch (type) {
    case 'hp': {
      const arrow = `${p.from} → ${p.to}`
      if (p.damage && p.healed) return `HP ${arrow} (−${p.damage}, +${p.healed})`
      if (p.damage) return `took ${p.damage} damage${p.absorbed ? ` (${p.absorbed} to temp HP)` : ''} · ${arrow}`
      return `healed ${p.healed} · ${arrow}`
    }
    case 'temp':
      return p.to ? `temp HP ${p.to}` : 'temp HP gone'
    case 'slot':
      return `${p.spent ? 'spent' : 'restored'} a ${ordinal(p.level)}-level slot (${p.left}/${p.max} left)`
    case 'resource':
      return `${p.spent ? 'used' : 'restored'} ${p.name} (${p.left}/${p.max} left)`
    case 'shortRest': {
      const parts = ['short rest']
      if (p.regained.length) parts.push(`regained ${p.regained.join(', ')}`)
      if (p.hitDiceSpent) parts.push(`spent ${p.hitDiceSpent} hit ${p.hitDiceSpent === 1 ? 'die' : 'dice'} · ${p.from} → ${p.to}`)
      return parts.join(' · ')
    }
    case 'cast': {
      let line = `cast ${p.name}`
      if (p.paidWith?.kind === 'slot') line += ` (${ordinal(p.paidWith.level)}-level slot, ${p.paidWith.left}/${p.paidWith.max} left)`
      if (p.paidWith?.kind === 'free') line += ' (free cast)'
      if (p.concentration) line += p.dropped ? ` · concentrating, dropped ${p.dropped}` : ' · concentrating'
      return line
    }
    case 'longRest': {
      let line = 'long rest · HP, slots, resources and hit dice restored'
      if (p.exhaustion != null) line += p.exhaustion ? ` · exhaustion ${p.exhaustion}` : ' · no longer exhausted'
      if (p.droppedConcentration) line += ` · dropped concentration on ${p.droppedConcentration}`
      return line
    }
    case 'exhaustion':
      return p.to ? `exhaustion ${p.to}` : 'no longer exhausted'
    case 'conditionsCleared':
      return 'conditions cleared'
    case 'condition':
      return p.on ? `now ${p.name}` : `no longer ${p.name}`
    case 'concentration':
      return p.to ? `concentrating on ${p.to}` : `dropped concentration on ${p.from}`
    case 'deathSave':
      if (p.kind === 'reset') return 'death saves reset'
      return `death save ${p.kind} (${p.successes} ✓ / ${p.failures} ✗)`
    default:
      return type
  }
}
