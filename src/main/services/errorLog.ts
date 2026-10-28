import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

// The local error log (userData/logs/cinediary.log). One entry per error: time, where it
// happened (an IPC channel, "renderer", "main"…), the message and the stack frames.
// Never IPC arguments, form input or zod input values, so no diary text ends up in it.
// No Electron imports, so it can be tested; main/logs.ts supplies the folder.

export const LOG_FILE = 'cinediary.log'
export const OLD_LOG_FILE = 'cinediary.old.log'
/** When the log grows past this, it becomes cinediary.old.log (replacing the older one). */
export const MAX_LOG_BYTES = 1_000_000
const MAX_MESSAGE = 500

export interface DescribedError {
  message: string
  /** Stack frames only ("at …" lines); the first stack line repeats the message, so it's dropped. */
  stack: string | null
}

function isZodError(
  error: unknown
): error is { issues: Array<{ path: PropertyKey[]; code: string }> } {
  return (
    error instanceof Error &&
    error.name === 'ZodError' &&
    Array.isArray((error as unknown as { issues?: unknown }).issues)
  )
}

function framesOf(error: Error): string | null {
  const frames = (error.stack ?? '')
    .split('\n')
    .filter((line) => line.trimStart().startsWith('at '))
    .map((line) => `  ${line.trim()}`)
  return frames.length ? frames.join('\n') : null
}

/** What gets written for an error: never values, only where and what kind. */
export function describeError(error: unknown): DescribedError {
  if (isZodError(error)) {
    // A zod message lists the issues; only their paths and codes are safe to keep.
    const issues = error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '(value)'}: ${issue.code}`)
      .join(', ')
    return { message: `Invalid input (${issues})`, stack: framesOf(error as unknown as Error) }
  }
  if (error instanceof Error) {
    return { message: error.message.slice(0, MAX_MESSAGE), stack: framesOf(error) }
  }
  if (typeof error === 'string') return { message: error.slice(0, MAX_MESSAGE), stack: null }
  return { message: 'Unknown error', stack: null }
}

export function formatLogEntry(source: string, error: unknown, now: Date): string {
  const { message, stack } = describeError(error)
  return `[${now.toISOString()}] ${source}: ${message}\n${stack ? `${stack}\n` : ''}`
}

/** Appends one entry to `<folder>/cinediary.log`, rotating it first if it's too big. */
export function writeErrorLog(
  folder: string,
  source: string,
  error: unknown,
  now = new Date()
): void {
  mkdirSync(folder, { recursive: true })
  const file = join(folder, LOG_FILE)
  try {
    if (statSync(file).size > MAX_LOG_BYTES) renameSync(file, join(folder, OLD_LOG_FILE))
  } catch {
    // No log yet.
  }
  appendFileSync(file, formatLogEntry(source, error, now), 'utf8')
}
