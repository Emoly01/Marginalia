// The dossier as the redesign shows it, mapped onto the fields that already
// exist (no new data): Wants = tonight's intention or my Goals, Bonds =
// Relationships, the sealed Secret = "What I know (OOC)", and facts like
// faith, resistances and languages read straight off the imported sheet.
import { stripHtml } from './text'

/**
 * → { wants, wantsFrom, bonds: [{ name, notes }], secret, facts: [{ label, value }] }
 * `sessions` most recent first (listSessions order).
 */
export function dossierSummary(character, sheet, sessions = []) {
  const intention = (sessions ?? []).find((s) => s.intention?.trim())?.intention.trim() ?? ''
  const goals = stripHtml(character?.goals ?? '')
  const bonds = (character?.relationships ?? [])
    .filter((r) => r.name?.trim())
    .map((r) => ({ name: r.name.trim(), notes: (r.notes ?? '').trim(), type: r.type ?? '' }))
  const facts = []
  if (sheet) {
    const add = (label, value) => {
      const v = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value ?? '').trim()
      if (v) facts.push({ label, value: v })
    }
    add('Faith', sheet.identity?.faith)
    add('Defenses', sheet.combat?.defenses)
    add('Senses', sheet.combat?.senses)
    add('Languages', sheet.proficiencies?.languages)
    add('Tools', sheet.proficiencies?.tools)
  }
  return {
    wants: intention || goals,
    wantsFrom: intention ? 'intention' : goals ? 'goals' : null,
    bonds,
    secret: stripHtml(character?.knowledgeOOC ?? ''),
    facts,
  }
}
