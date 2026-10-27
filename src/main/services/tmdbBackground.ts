import { BrowserWindow } from 'electron'
import type { TmdbError, TmdbSyncProgress } from '../../shared/types'
import { getConnectivity } from './connectivity'
import { getTmdbToken, isTmdbBackgroundSyncOn } from './settings'
import { librarySyncStore, listTitlesToSync, tmdbClient } from './tmdbLibrary'
import { runSyncBatch, shouldPause, syncTitle } from './tmdbSync'

// Quiet background re-sync (only while the app is open) and the manual "Refresh all" run.

/** TMDB's terms reportedly limit caching to ~6 months, so refresh after ~5. */
const STALE_AFTER_DAYS = 150
const START_DELAY_MS = 60_000
/** One title per tick: a few per minute. */
const TICK_MS = 20_000
const PAUSE_AFTER_ERROR_MS = 10 * 60_000
const PAUSE_AFTER_RATE_LIMIT_MS = 15 * 60_000
/** Manual refresh goes faster, still well under TMDB's limits. */
const MANUAL_DELAY_MS = 300

let started = false
/** Set while a restore runs: no new TMDB work starts. */
let suspended = false
let busy = false
let pausedUntil = 0
let manualRun: { cancelled: boolean } | null = null
let progress: TmdbSyncProgress = {
  running: false,
  done: 0,
  total: 0,
  stoppedReason: null,
  message: null
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function pauseAfter(error: TmdbError): void {
  if (!shouldPause(error)) return
  pausedUntil =
    Date.now() + (error.code === 'rate_limited' ? PAUSE_AFTER_RATE_LIMIT_MS : PAUSE_AFTER_ERROR_MS)
}

function setProgress(next: TmdbSyncProgress): void {
  progress = next
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('tmdb:syncProgress', progress)
  }
}

function blockedReason(): string | null {
  if (getTmdbToken() === null) return 'Add your TMDB token first.'
  if (!getConnectivity().online) return 'You’re offline. Try again when you’re back online.'
  return null
}

async function tick(): Promise<void> {
  if (suspended || busy || manualRun || Date.now() < pausedUntil) return
  if (!isTmdbBackgroundSyncOn() || blockedReason()) return
  const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000).toISOString()
  const [id] = listTitlesToSync(staleBefore, 1)
  if (id === undefined) return
  busy = true
  try {
    const result = await syncTitle(id, tmdbClient, librarySyncStore)
    if (!result.ok) pauseAfter(result.error)
  } finally {
    busy = false
  }
}

export function startBackgroundSync(): void {
  if (started) return
  started = true
  setTimeout(() => {
    void tick()
    setInterval(() => void tick(), TICK_MS)
  }, START_DELAY_MS)
}

export function getSyncProgress(): TmdbSyncProgress {
  return progress
}

/** Refreshes every TMDB title now (same rules: my edits and personal data are never touched). */
export function refreshAll(): TmdbSyncProgress {
  if (manualRun || suspended) return progress
  const blocked = blockedReason()
  if (blocked) {
    setProgress({ running: false, done: 0, total: 0, stoppedReason: 'error', message: blocked })
    return progress
  }
  const ids = listTitlesToSync(null)
  const run = { cancelled: false }
  manualRun = run
  setProgress({ running: true, done: 0, total: ids.length, stoppedReason: null, message: null })
  void (async () => {
    while (busy) await sleep(100) // let a background title finish first
    const result = await runSyncBatch(ids, tmdbClient, librarySyncStore, {
      delayMs: MANUAL_DELAY_MS,
      sleep,
      shouldStop: () => run.cancelled,
      onProgress: (done, total) => setProgress({ ...progress, done, total })
    })
    manualRun = null
    if (result.stopped && result.stopped !== 'cancelled') pauseAfter(result.stopped)
    setProgress({
      running: false,
      done: result.done,
      total: result.total,
      stoppedReason:
        result.stopped === null ? null : result.stopped === 'cancelled' ? 'cancelled' : 'error',
      message: result.stopped && result.stopped !== 'cancelled' ? result.stopped.message : null
    })
  })()
  return progress
}

export function cancelRefresh(): void {
  if (manualRun) manualRun.cancelled = true
}

/**
 * Stops all TMDB work before a restore: no new background ticks, the manual refresh is
 * cancelled, and this resolves once the title being synced (if any) has finished.
 */
export async function suspendTmdbSync(): Promise<void> {
  suspended = true
  cancelRefresh()
  while (busy || manualRun) await sleep(100)
}

/** Lets TMDB work continue again (e.g. after a restore that didn't happen). */
export function resumeTmdbSync(): void {
  suspended = false
}
