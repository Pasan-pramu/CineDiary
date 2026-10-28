import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  describeError,
  formatLogEntry,
  LOG_FILE,
  MAX_LOG_BYTES,
  OLD_LOG_FILE,
  writeErrorLog
} from './errorLog'

// The error log keeps channel, message and stack only: never input values or diary text.

const NOW = new Date('2026-10-28T09:30:00.000Z')
let folder: string

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'cinediary-log-'))
})
afterEach(() => rmSync(folder, { recursive: true, force: true }))

describe('describeError', () => {
  it('keeps the message and only the stack frames', () => {
    const error = new Error('Title not found.')
    const described = describeError(error)
    expect(described.message).toBe('Title not found.')
    expect(described.stack).toMatch(/^ {2}at /)
    expect(described.stack).not.toContain('Title not found.')
  })

  it('never writes zod input values, only paths and issue codes', () => {
    const schema = z.object({ thoughts: z.string().max(5), rating: z.number().int() })
    const result = schema.safeParse({ thoughts: 'my secret diary entry', rating: 'ten' })
    expect(result.success).toBe(false)
    const described = describeError(result.error)
    expect(described.message).toBe('Invalid input (thoughts: too_big, rating: invalid_type)')
    expect(JSON.stringify(described)).not.toContain('secret')
    expect(JSON.stringify(described)).not.toContain('ten')
  })

  it('handles strings and anything else', () => {
    expect(describeError('plain')).toEqual({ message: 'plain', stack: null })
    expect(describeError({ some: 'object' })).toEqual({ message: 'Unknown error', stack: null })
  })

  it('cuts very long messages', () => {
    expect(describeError(new Error('x'.repeat(5000))).message).toHaveLength(500)
  })
})

describe('writeErrorLog', () => {
  it('appends time, source, message and stack', () => {
    writeErrorLog(folder, 'titles:get', new Error('Title not found.'), NOW)
    writeErrorLog(folder, 'renderer', 'second', NOW)
    const log = readFileSync(join(folder, LOG_FILE), 'utf8')
    expect(log.startsWith('[2026-10-28T09:30:00.000Z] titles:get: Title not found.\n  at ')).toBe(
      true
    )
    expect(log.endsWith('[2026-10-28T09:30:00.000Z] renderer: second\n')).toBe(true)
  })

  it('creates the folder when needed', () => {
    const nested = join(folder, 'logs')
    writeErrorLog(nested, 'main', 'hello', NOW)
    expect(existsSync(join(nested, LOG_FILE))).toBe(true)
  })

  it('moves a full log to cinediary.old.log and starts a new one', () => {
    writeFileSync(join(folder, LOG_FILE), 'x'.repeat(MAX_LOG_BYTES + 1))
    writeErrorLog(folder, 'main', 'after rotation', NOW)
    expect(readFileSync(join(folder, OLD_LOG_FILE), 'utf8')).toHaveLength(MAX_LOG_BYTES + 1)
    expect(readFileSync(join(folder, LOG_FILE), 'utf8')).toBe(
      formatLogEntry('main', 'after rotation', NOW)
    )
  })
})
