import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatRelative } from './formatRelative'

const NOW = new Date('2026-07-19T12:00:00Z')
const secondsAgo = (s) => new Date(NOW.getTime() - s * 1000)

describe('formatRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for null, undefined, and invalid input', () => {
    expect(formatRelative(null)).toBe('')
    expect(formatRelative(undefined)).toBe('')
    expect(formatRelative('not a date')).toBe('')
  })

  it('formats recent times', () => {
    expect(formatRelative(secondsAgo(10))).toBe('just now')
    expect(formatRelative(secondsAgo(45))).toBe('45s ago')
    expect(formatRelative(secondsAgo(5 * 60))).toBe('5m ago')
    expect(formatRelative(secondsAgo(3 * 3600))).toBe('3h ago')
  })

  it('formats days, weeks, months, and years', () => {
    expect(formatRelative(secondsAgo(26 * 3600))).toBe('yesterday')
    expect(formatRelative(secondsAgo(3 * 86400))).toBe('3 days ago')
    expect(formatRelative(secondsAgo(14 * 86400))).toBe('2w ago')
    expect(formatRelative(secondsAgo(60 * 86400))).toBe('2mo ago')
    expect(formatRelative(secondsAgo(730 * 86400))).toBe('2y ago')
  })

  it('accepts Firestore Timestamp-like objects', () => {
    const timestamp = { toDate: () => secondsAgo(5 * 60) }
    expect(formatRelative(timestamp)).toBe('5m ago')
  })

  it('accepts ISO strings', () => {
    expect(formatRelative(secondsAgo(3 * 3600).toISOString())).toBe('3h ago')
  })
})
