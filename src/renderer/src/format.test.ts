import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatMonthGroup, formatWatchDate, formatWatchDates } from './format'

// How a watch date reads in the UI, as far as it's known (v1.1.0).

describe('watch dates in the UI', () => {
  it('show only what is known', () => {
    expect(formatWatchDate('2019-10-14', 'day')).toMatch(/14/)
    expect(formatWatchDate('2019-10-01', 'month')).toMatch(/Oct.*2019/)
    expect(formatWatchDate('2019-01-01', 'year')).toBe('2019')
    expect(formatWatchDate('0001-01-01', 'unknown')).toBe('Don’t remember when')
    expect(formatWatchDates('2019-10-01', '2019-10-01', 'month')).toMatch(/Oct.*2019/)
    expect(formatWatchDates('0001-01-01', '0001-01-01', 'unknown')).toBe('Don’t remember when')
  })

  it('group headings: months, "Sometime in <year>", and the not-remembered section', () => {
    expect(formatMonthGroup('2019-10')).toMatch(/October.*2019/)
    expect(formatMonthGroup('2019-00')).toBe('Sometime in 2019')
    expect(formatMonthGroup('0000-00')).toBe('Watched, date not remembered')
  })
})

describe('wording', () => {
  it('never shows "Date unknown" anywhere in the UI', () => {
    const root = fileURLToPath(new URL('.', import.meta.url))
    const files = (readdirSync(root, { recursive: true }) as string[]).filter(
      (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file)
    )
    expect(files.length).toBeGreaterThan(20)
    for (const file of files) {
      expect(readFileSync(join(root, file), 'utf8'), file).not.toMatch(/date unknown/i)
    }
  })
})
