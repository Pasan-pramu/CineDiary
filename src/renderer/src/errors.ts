import { useSyncExternalStore } from 'react'

// Errors in the renderer. Something you did that failed gets a toast; background work
// (connectivity, thumbnails, sync progress) is only logged. Everything ends up in the local
// error log (userData/logs) as message + stack; IPC failures are already logged by the main
// process with their channel, so they aren't sent twice.

export interface Toast {
  id: number
  message: string
  tone: 'error' | 'success'
}

const TOAST_MS = 6000
let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

export function showToast(message: string, tone: Toast['tone'] = 'error'): void {
  // The same message twice in a row (e.g. typing in a broken search) shows once.
  if (toasts.some((toast) => toast.message === message)) return
  const id = nextId++
  toasts = [...toasts, { id, message, tone }].slice(-3)
  emit()
  window.setTimeout(() => dismissToast(id), TOAST_MS)
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => toasts
  )
}

const IPC_ERROR = /^Error invoking remote method '([^']+)'/

/** Writes a renderer error to the local log (not IPC errors: main logged those already). */
export function logError(source: string, error: unknown, extraStack?: string): void {
  const message = error instanceof Error ? error.message : String(error)
  if (IPC_ERROR.test(message)) return
  const stack = [error instanceof Error ? error.stack : null, extraStack].filter(Boolean).join('\n')
  try {
    window.api.app.logError({ source, message: message.slice(0, 2000), stack: stack || null })
  } catch {
    // Logging must never break the page.
  }
}

/**
 * The reason to show the user, without the IPC wrapper ("Error invoking remote method…") and,
 * for invalid input, the first validation message instead of zod's JSON.
 */
export function userMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const text = raw.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
  try {
    const issues: unknown = JSON.parse(text)
    if (Array.isArray(issues)) {
      const first: unknown = issues[0]
      if (first && typeof first === 'object' && 'message' in first)
        return String((first as { message: unknown }).message)
    }
  } catch {
    // Not zod's JSON: the message itself.
  }
  return text
}

/** For something the user did: `.catch(failed('Couldn’t load your collection.'))`. */
export function failed(message: string): (error: unknown) => void {
  return (error) => {
    logError('renderer', error)
    showToast(message)
  }
}

/** For background work: logged, no toast. */
export function quietly(source: string): (error: unknown) => void {
  return (error) => logError(source, error)
}

/** Last resort for promises nobody caught (wired up in main.tsx). */
export function reportUnexpected(error: unknown): void {
  logError('renderer', error)
  showToast('Something didn’t work. The details are in the error log (Settings → About).')
}
