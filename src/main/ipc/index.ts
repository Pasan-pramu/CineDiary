import { registerStatsHandlers } from './stats.ipc'
import { registerTitleHandlers } from './titles.ipc'
import { registerWatchEntryHandlers } from './watchEntries.ipc'

let registered = false

export function registerIpcHandlers(): void {
  if (registered) return
  registerTitleHandlers()
  registerWatchEntryHandlers()
  registerStatsHandlers()
  registered = true
}
