import { app, BrowserWindow, net } from 'electron'
import type { ConnectivityStatus } from '../../shared/types'

// Online/offline state for the whole app. The local database never depends on this; it only
// decides whether TMDB features are enabled. The renderer is told about changes by push events.

const CHECK_URL = 'https://api.themoviedb.org/3/configuration'
const CHECK_INTERVAL_MS = 30_000
const CHECK_TIMEOUT_MS = 5_000

let status: ConnectivityStatus = { online: true, checkedAt: new Date().toISOString() }
let checking: Promise<ConnectivityStatus> | null = null
let started = false

function update(online: boolean): ConnectivityStatus {
  const changed = online !== status.online
  status = { online, checkedAt: new Date().toISOString() }
  if (changed) {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('connectivity:changed', status)
    }
  }
  return status
}

/** Any HTTP answer from TMDB (even 401 without a token) means we can reach it. */
async function reachTmdb(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
  try {
    await net.fetch(CHECK_URL, { method: 'HEAD', cache: 'no-store', signal: controller.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Runs one check; overlapping calls share the check that's already running. */
export function checkConnectivity(): Promise<ConnectivityStatus> {
  checking ??= (async () => {
    const online = net.isOnline() && (await reachTmdb())
    return update(online)
  })().finally(() => {
    checking = null
  })
  return checking
}

export function getConnectivity(): ConnectivityStatus {
  return status
}

/** Checks now, every 30 seconds, and whenever a window gets focus. */
export function startConnectivityMonitor(): void {
  if (started) return
  started = true
  status = { online: net.isOnline(), checkedAt: new Date().toISOString() }
  void checkConnectivity()
  setInterval(() => void checkConnectivity(), CHECK_INTERVAL_MS)
  app.on('browser-window-focus', () => void checkConnectivity())
}
