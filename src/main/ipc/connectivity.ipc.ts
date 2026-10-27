import { ipcMain } from 'electron'
import { checkConnectivity, getConnectivity } from '../services/connectivity'

export function registerConnectivityHandlers(): void {
  ipcMain.handle('connectivity:get', () => getConnectivity())
  ipcMain.handle('connectivity:check', () => checkConnectivity())
}
