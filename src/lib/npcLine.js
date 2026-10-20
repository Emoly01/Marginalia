// "Name — descriptor" lines, shared by the NPC roster and the live log.

/**
 * Parse "Name — descriptor" into { name, notes }.
 * Separators, in priority order: em dash, en dash, colon, spaced hyphen.
 * A spaced hyphen is required so hyphenated names like "Jean-Luc" stay intact.
 */
export function parseLine(line) {
  const text = line.trim()
  const separators = ['—', '–', ':', ' - ']
  for (const sep of separators) {
    const idx = text.indexOf(sep)
    if (idx > 0) {
      return {
        name: text.slice(0, idx).trim(),
        notes: text.slice(idx + sep.length).trim(),
      }
    }
  }
  return { name: text, notes: '' }
}
