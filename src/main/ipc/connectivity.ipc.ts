import { handle } from '../logs'
import { checkConnectivity, getConnectivity } from '../services/connectivity'

export function registerConnectivityHandlers(): void {
  handle('connectivity:get', () => getConnectivity())
  handle('connectivity:check', () => checkConnectivity())
}
