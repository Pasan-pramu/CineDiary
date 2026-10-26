import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CineDiaryApi } from '../shared/api'

// Custom APIs for renderer
const api: CineDiaryApi = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  Object.assign(globalThis, { electron: electronAPI, api })
}
