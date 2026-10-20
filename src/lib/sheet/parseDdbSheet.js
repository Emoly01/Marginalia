// D&D Beyond PDF fields → a structured character sheet. Pure: takes the
// [{ page, fieldName, value, rect }] list readPdfFields() produces (or the
// fixture) and never invents rules text — every string here came off the PDF.
import {
  normalizeFieldName,
  buildFieldMap,
  caseInsensitiveLookup,
  cleanValue,
  parseNumber,
  spellKey,
  joinBoxes,
  numberedValues,
} from './normalize'

// Bump when the parsed shape changes, so stored sheets can be re-parsed
// from their raw fields.
export const PARSER_VERSION = 1

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const ABILITY_NAMES = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

// `field` is the value box; prof/mod boxes are `${prof}Prof` / `${mod}Mod`.
// Animal Handling and Sleight of Hand are the irregular ones on the export.
export const SKILLS = [
  { key: 'acrobatics', label: 'Acrobatics', ability: 'dex', field: 'Acrobatics' },
  { key: 'animalHandling', label: 'Animal Handling', ability: 'wis', field: 'Animal', prof: 'AnimalHandling', mod: 'Animal' },
  { key: 'arcana', label: 'Arcana', ability: 'int', field: 'Arcana' },
  { key: 'athletics', label: 'Athletics', ability: 'str', field: 'Athletics' },
  { key: 'deception', label: 'Deception', ability: 'cha', field: 'Deception' },
  { key: 'history', label: 'History', ability: 'int', field: 'History' },
  { key: 'insight', label: 'Insight', ability: 'wis', field: 'Insight' },
  { key: 'intimidation', label: 'Intimidation', ability: 'cha', field: 'Intimidation' },
  { key: 'investigation', label: 'Investigation', ability: 'int', field: 'Investigation' },
  { key: 'medicine', label: 'Medicine', ability: 'wis', field: 'Medicine' },
  { key: 'nature', label: 'Nature', ability: 'int', field: 'Nature' },
  { key: 'perception', label: 'Perception', ability: 'wis', field: 'Perception' },
  { key: 'performance', label: 'Performance', ability: 'cha', field: 'Performance' },
  { key: 'persuasion', label: 'Persuasion', ability: 'cha', field: 'Persuasion' },
  { key: 'religion', label: 'Religion', ability: 'int', field: 'Religion' },
  { key: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dex', field: 'SleightofHand', prof: 'SleightOfHand', mod: 'SleightofHand' },
  { key: 'stealth', label: 'Stealth', ability: 'dex', field: 'Stealth' },
  { key: 'survival', label: 'Survival', ability: 'wis', field: 'Survival' },
]

// The letter D&D Beyond prints in a skill's proficiency box.
export const PROFICIENCY_MARKS = {
  P: 'proficient',
  E: 'expertise',
  H: 'half', // Jack of All Trades
}

const ACTION_SECTIONS = {
  ACTIONS: 'action',
  'BONUS ACTIONS': 'bonus',
  REACTIONS: 'reaction',
  SPECIAL: 'special',
}

const HEADER_LINE = /^\s*===\s*(.+?)\s*===\s*$/

function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function tidyText(lines) {
  return lines
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * "Bard 5" → [{ class: 'Bard', level: 5 }];
 * "Bard 3 / Warlock 2" → [{ Bard, 3 }, { Warlock, 2 }].
 */
export function parseClassLevel(text) {
  return cleanValue(text)
    .split('/')
    .map((part) => part.trim().match(/^(.*?)\s+(\d+)$/))
    .filter(Boolean)
    .map((m) => ({ class: m[1].trim(), level: Number(m[2]) }))
}

/** "5d8" → [{ count: 5, die: 8 }]; "3d8 + 2d10" → two entries. */
export function parseHitDice(text) {
  return [...cleanValue(text).matchAll(/(\d+)\s*d\s*(\d+)/gi)].map((m) => ({
    count: Number(m[1]),
    die: Number(m[2]),
  }))
}

/** "=== CANTRIPS ===" → 0, "=== 2nd LEVEL ===" → 2, else null. */
export function parseSpellLevelHeader(text) {
  const s = cleanValue(text)
  if (/cantrip/i.test(s)) return 0
  const m = s.match(/(\d+)\s*(?:st|nd|rd|th)?\s+level/i)
  return m ? Number(m[1]) : null
}

/** "4 Slots OOOO" → 4, "(At Will)" → null. */
export function parseSlotHeader(text) {
  const m = cleanValue(text).match(/(\d+)\s*slots?/i)
  return m ? Number(m[1]) : null
}

/**
 * Split "=== ARMOR === \nLight Armor \n\n=== TOOLS === …" into
 * { armor: ['Light Armor'], tools: [...] }.
 */
export function parseProficiencies(text) {
  const out = {}
  let key = null
  for (const line of cleanValue(text).split('\n')) {
    const h = line.match(HEADER_LINE)
    if (h) {
      key = h[1].toLowerCase()
      out[key] = []
      continue
    }
    if (!key || !line.trim()) continue
    out[key].push(...line.split(',').map((s) => s.trim()).filter(Boolean))
  }
  return out
}

/**
 * The Actions boxes: sections of entries, where an entry starts with an
 * unindented name line ("Bardic Inspiration • 4 / Short Rest") followed by
 * indented description. A box break drops the indent, so an unindented line
 * that reads as a sentence is treated as more description.
 */
export function parseActions(text) {
  const entries = []
  let section = 'action'
  let current = null
  const finish = () => {
    if (current) {
      const { lines, ...entry } = current
      entries.push({ ...entry, text: tidyText(lines) })
    }
    current = null
  }
  for (const line of text.split('\n')) {
    const h = line.match(HEADER_LINE)
    if (h) {
      finish()
      section = ACTION_SECTIONS[h[1].toUpperCase()] ?? h[1].toLowerCase()
      continue
    }
    if (!line.trim()) {
      current?.lines.push('')
      continue
    }
    const indented = /^\s/.test(line)
    const sentence = /[.!?]\s*$/.test(line)
    if (current && (indented || sentence)) {
      current.lines.push(line.trim())
      continue
    }
    finish()
    const [name, ...rest] = line.trim().split(' • ')
    current = { section, name: name.trim(), uses: rest.join(' • ').trim(), lines: [] }
  }
  finish()
  return entries
}

/**
 * The FeaturesTraits boxes, already joined: `=== GROUP ===` headers, then
 * features as "* Name • Source page" followed by body text. Lines starting
 * with "|" are D&D Beyond's option/usage lines and are kept separately.
 */
export function parseFeatures(text) {
  const features = []
  let group = ''
  let current = null
  const finish = () => {
    if (current) {
      features.push({
        name: current.name,
        group: current.group,
        source: current.source,
        text: tidyText(current.lines),
        notes: current.notes,
      })
    }
    current = null
  }
  for (const line of text.split('\n')) {
    const h = line.match(HEADER_LINE)
    if (h) {
      finish()
      group = titleCase(h[1])
      continue
    }
    const f = line.match(/^\*\s+(.+?)\s*$/)
    if (f) {
      finish()
      const [name, ...rest] = f[1].split(' • ')
      current = { name: name.trim(), group, source: rest.join(' • ').trim(), lines: [], notes: [] }
      continue
    }
    if (!current) continue
    const note = line.match(/^\s*\|\s?(.*)$/)
    if (note) {
      const n = note[1].replace(/\s*•\s*$/, '').trim()
      if (n) current.notes.push(n)
    } else {
      current.lines.push(line)
    }
  }
  finish()
  return features
}

/**
 * "Wpn Name", "Wpn Name 2", "Wpn1 AtkBonus", "Wpn2 Damage", "Wpn Notes 3"…
 * → [{ name, bonus, damage, notes }] in row order.
 */
export function parseAttacks(map) {
  const rows = {}
  const re = /^Wpn ?(\d*) ?(Name|AtkBonus|Damage|Notes) ?(\d*)$/i
  for (const [k, v] of Object.entries(map)) {
    const m = k.match(re)
    if (!m) continue
    const idx = Number(m[1] || m[3] || 1)
    const prop = { name: 'name', atkbonus: 'bonus', damage: 'damage', notes: 'notes' }[m[2].toLowerCase()]
    rows[idx] = rows[idx] ?? { name: '', bonus: '', damage: '', notes: '' }
    rows[idx][prop] = cleanValue(v)
  }
  return Object.entries(rows)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, r]) => r)
    .filter((r) => r.name)
}

function parseInventory(map, get) {
  const items = []
  for (const [k, v] of Object.entries(map)) {
    const m = k.match(/^Eq Name(\d+)$/i)
    if (!m || !cleanValue(v)) continue
    items.push({
      row: Number(m[1]),
      name: cleanValue(v),
      qty: parseNumber(get(`Eq Qty${m[1]}`)) ?? 1,
      weight: cleanValue(get(`Eq Weight${m[1]}`)),
    })
  }
  items.sort((a, b) => a.row - b.row)
  return {
    currency: Object.fromEntries(
      ['cp', 'sp', 'ep', 'gp', 'pp'].map((c) => [c, parseNumber(get(c.toUpperCase())) ?? 0])
    ),
    items: items.map(({ name, qty, weight }) => ({ name, qty, weight })),
    attuned: numberedValues(map, 'Attuned Name').map(cleanValue).filter(Boolean),
    carried: {
      weight: cleanValue(get('Weight Carried')),
      encumbered: cleanValue(get('Encumbered')),
      pushDragLift: cleanValue(get('PushDragLift')),
    },
  }
}

function parseSpellcasting(map) {
  const byIndex = {}
  for (const [k, v] of Object.entries(map)) {
    const m = k.match(/^spellCasting(Ability|Class)(\d+)$|^spell(SaveDC|AtkBonus)(\d+)$/i)
    if (!m) continue
    const prop = (m[1] || m[3]).toLowerCase()
    const idx = Number(m[2] ?? m[4])
    byIndex[idx] = byIndex[idx] ?? { class: '', ability: '', saveDC: null, attackBonus: null }
    if (prop === 'ability') byIndex[idx].ability = cleanValue(v)
    if (prop === 'class') byIndex[idx].class = cleanValue(v)
    if (prop === 'savedc') byIndex[idx].saveDC = parseNumber(v)
    if (prop === 'atkbonus') byIndex[idx].attackBonus = parseNumber(v)
  }
  return Object.entries(byIndex)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, s]) => s)
}

// Spell-row fields. D&D Beyond uses `spellNameN`, `spellSourceN`, … for the
// main list, and an unprefixed scheme (`SpellNameN`, `CastingTimeN`,
// `NotesN`, `PreparedN`, …) for overflow rows. Matching is case-sensitive on
// purpose: the two schemes differ only by the leading "spell"/"Spell".
const SPELL_PROPS = 'Source|SaveHit|CastingTime|Range|Components|Duration|Page|Notes|Prepared'
const SPELL_ROW_PREFIXED = new RegExp(`^spell(Name|${SPELL_PROPS})(\\d+)$`)
const SPELL_ROW_UNPREFIXED = new RegExp(`^(SpellName|${SPELL_PROPS})(\\d+)$`)
const SPELL_HEADER = /^(?:spell)?(slot)?header(\d+)$/i

const xOverlaps = (a, b) => a[0] < b[2] && b[0] < a[2]

/** "1/LR, V/S/M" → { max: 1, reset: 'long' }; "1/SR" → short; else null. */
export function parseFreeUse(notes) {
  const m = cleanValue(notes).match(/(\d+)\s*\/\s*(LR|SR)\b/i)
  return m ? { max: Number(m[1]), reset: m[2].toUpperCase() === 'SR' ? 'short' : 'long' } : null
}

/**
 * Spell rows + level headers → { spells, slots }. Each row is assigned the
 * level of the nearest header above it on the same page and in the same
 * column (by rect; PDF y grows upward). Rows with no header above them —
 * a list continuing into a new column or page — inherit the level of the
 * row before them in reading order. Rows repeating a spell name (a spell
 * granted by several features) are merged, keeping every source and note.
 */
export function parseSpells(fields) {
  const rows = {}
  const headers = {}
  for (const f of fields) {
    const name = normalizeFieldName(f.fieldName)
    const h = name.match(SPELL_HEADER)
    if (h) {
      const idx = h[2]
      headers[idx] = headers[idx] ?? { page: f.page }
      if (h[1]) headers[idx].slots = parseSlotHeader(f.value)
      else {
        headers[idx].level = parseSpellLevelHeader(f.value)
        headers[idx].rect = f.rect
        headers[idx].page = f.page
      }
      continue
    }
    let m = name.match(SPELL_ROW_PREFIXED)
    let scheme = 'p'
    if (!m) {
      m = name.match(SPELL_ROW_UNPREFIXED)
      scheme = 'u'
    }
    if (!m) continue
    const prop = m[1] === 'SpellName' ? 'Name' : m[1]
    const id = `${scheme}${m[2]}`
    rows[id] = rows[id] ?? { id, order: Number(m[2]), scheme }
    rows[id][prop] = cleanValue(f.value)
    if (prop === 'Name') {
      rows[id].page = f.page
      rows[id].rect = f.rect
    }
  }

  const levelHeaders = Object.values(headers).filter((h) => h.level != null && h.rect)
  const slots = {}
  for (const h of levelHeaders) {
    if (h.level > 0 && h.slots != null) slots[String(h.level)] = h.slots
  }

  const named = Object.values(rows).filter((r) => r.Name && r.rect)
  for (const r of named) {
    const above = levelHeaders.filter(
      (h) => h.page === r.page && xOverlaps(h.rect, r.rect) && h.rect[1] >= r.rect[3] - 2
    )
    above.sort((a, b) => a.rect[1] - b.rect[1])
    r.level = above.length ? above[0].level : null
  }

  // Reading order: page, then column (left edge), then top to bottom. A
  // header sets the level for whatever follows it, even in the next column.
  const byReadingOrder = (a, b) =>
    a.page - b.page || Math.round(a.rect[0] / 40) - Math.round(b.rect[0] / 40) || b.rect[1] - a.rect[1]
  const walk = [...named, ...levelHeaders.map((h) => ({ header: true, ...h }))].sort(byReadingOrder)
  let carry = null
  for (const r of walk) {
    if (r.header) carry = r.level
    else if (r.level == null) r.level = carry
    else carry = r.level
  }
  named.sort(byReadingOrder)

  const spells = []
  const byKey = {}
  for (const r of named) {
    const key = spellKey(r.Name)
    let s = byKey[key]
    if (!s) {
      s = byKey[key] = {
        key,
        name: r.Name,
        level: r.level,
        sources: [],
        castingTime: r.CastingTime ?? '',
        range: r.Range ?? '',
        components: r.Components ?? '',
        duration: r.Duration ?? '',
        saveHit: r.SaveHit ?? '',
        reference: r.Page ?? '',
        notes: [],
        concentration: /concentration/i.test(r.Duration ?? ''),
        alwaysPrepared: false,
        prepared: r.Prepared ?? '',
        freeUse: null,
      }
      spells.push(s)
    }
    if (r.Source && !s.sources.includes(r.Source)) s.sources.push(r.Source)
    if (r.Notes && !s.notes.includes(r.Notes)) s.notes.push(r.Notes)
    if (r.Prepared === 'P' || /always prepared/i.test(r.Source ?? '')) s.alwaysPrepared = true
    s.freeUse = s.freeUse ?? parseFreeUse(r.Notes)
  }
  return { spells, slots }
}

/**
 * Field list → structured sheet. See DATA_MODEL.md (`character/sheet.data`)
 * for the shape.
 */
export function parseDdbSheet(fields) {
  const list = Array.isArray(fields) ? fields : (fields?.fields ?? [])
  const map = buildFieldMap(list)
  const get = caseInsensitiveLookup(map)
  const text = (name) => cleanValue(get(name))

  const classes = parseClassLevel(get('CLASS LEVEL'))

  const abilities = {}
  for (const key of ABILITY_KEYS) {
    const abbr = key.toUpperCase()
    abilities[key] = {
      score: parseNumber(get(abbr)),
      mod: parseNumber(get(`${abbr}mod`)),
      save: parseNumber(get(`ST ${ABILITY_NAMES[key]}`)),
      saveProficient: Boolean(text(`${abbr}Prof`)),
    }
  }

  const skills = SKILLS.map((s) => {
    const mark = text(`${s.prof ?? s.field}Prof`).toUpperCase()
    const ability = text(`${s.mod ?? s.field}Mod`).toLowerCase()
    return {
      key: s.key,
      label: s.label,
      ability: ABILITY_KEYS.includes(ability) ? ability : s.ability,
      bonus: parseNumber(get(s.field)),
      proficiency: PROFICIENCY_MARKS[mark] ?? null,
    }
  })

  const { spells, slots } = parseSpells(list)

  return {
    identity: {
      name: text('CharacterName'),
      classLevel: text('CLASS LEVEL'),
      classes,
      level: classes.reduce((n, c) => n + c.level, 0) || null,
      species: text('RACE'),
      background: text('BACKGROUND'),
      xp: text('EXPERIENCE POINTS'),
      alignment: text('ALIGNMENT'),
      faith: text('FAITH'),
      size: text('SIZE'),
      age: text('AGE'),
      height: text('HEIGHT'),
      weight: text('WEIGHT'),
      eyes: text('EYES'),
      skin: text('SKIN'),
      hair: text('HAIR'),
      gender: text('GENDER'),
    },
    abilities,
    skills,
    combat: {
      ac: parseNumber(get('AC')),
      initiative: parseNumber(get('Init')),
      speed: text('Speed'),
      profBonus: parseNumber(get('ProfBonus')),
      maxHp: parseNumber(get('MaxHP')),
      tempHp: parseNumber(get('TempHP')) ?? 0,
      hitDice: { total: text('Total'), dice: parseHitDice(get('Total')) },
      passives: {
        perception: parseNumber(get('Passive1')),
        insight: parseNumber(get('Passive2')),
        investigation: parseNumber(get('Passive3')),
      },
      senses: text('AdditionalSenses'),
      defenses: text('Defenses'),
    },
    proficiencies: parseProficiencies(get('ProficienciesLang')),
    actions: parseActions(joinBoxes(numberedValues(map, 'Actions'))),
    attacks: parseAttacks(map),
    features: parseFeatures(joinBoxes(numberedValues(map, 'FeaturesTraits'))),
    inventory: parseInventory(map, get),
    personality: {
      traits: text('PersonalityTraits'),
      ideals: text('Ideals'),
      bonds: text('Bonds'),
      flaws: text('Flaws'),
      backstory: text('Backstory'),
      appearance: text('Appearance'),
      allies: text('AlliesOrganizations'),
      additionalNotes: joinBoxes(numberedValues(map, 'AdditionalNotes').map(cleanValue)),
    },
    spellcasting: parseSpellcasting(map),
    slots,
    spells,
  }
}
