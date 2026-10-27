import { registerBackupHandlers } from './backup.ipc'
import { registerConnectivityHandlers } from './connectivity.ipc'
import { registerDashboardHandlers } from './dashboard.ipc'
import { registerSettingsHandlers } from './settings.ipc'
import { registerStatsHandlers } from './stats.ipc'
import { registerTitleHandlers } from './titles.ipc'
import { registerTimelineHandlers } from './timeline.ipc'
import { registerTmdbHandlers } from './tmdb.ipc'
import { registerWatchEntryHandlers } from './watchEntries.ipc'

let registered = false

export function registerIpcHandlers(): void {
  if (registered) return
  registerTitleHandlers()
  registerWatchEntryHandlers()
  registerStatsHandlers()
  registerDashboardHandlers()
  registerSettingsHandlers()
  registerTmdbHandlers()
  registerConnectivityHandlers()
  registerBackupHandlers()
  registerTimelineHandlers()
  registered = true
}
