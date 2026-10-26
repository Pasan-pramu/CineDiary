import { contextBridge, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CineDiaryApi } from '../shared/api'

const api: CineDiaryApi = {
  titles: {
    list: () => electronAPI.ipcRenderer.invoke('titles:list'),
    get: (id) => electronAPI.ipcRenderer.invoke('titles:get', id),
    delete: (id) => electronAPI.ipcRenderer.invoke('titles:delete', id),
    listGenres: () => electronAPI.ipcRenderer.invoke('titles:listGenres'),
    create: (input) => electronAPI.ipcRenderer.invoke('titles:create', input),
    update: (input) => electronAPI.ipcRenderer.invoke('titles:update', input),
    setStatus: (id, status) => electronAPI.ipcRenderer.invoke('titles:setStatus', id, status),
    toggleFavorite: (id) => electronAPI.ipcRenderer.invoke('titles:toggleFavorite', id),
    collection: (query) => electronAPI.ipcRenderer.invoke('titles:collection', query)
  },
  posters: {
    pick: () => electronAPI.ipcRenderer.invoke('posters:pick'),
    prepareDropped: (file) =>
      electronAPI.ipcRenderer.invoke('posters:prepare', webUtils.getPathForFile(file))
  },
  watchEntries: {
    list: (titleId) => electronAPI.ipcRenderer.invoke('watchEntries:list', titleId),
    journal: (query) => electronAPI.ipcRenderer.invoke('watchEntries:journal', query),
    start: (input) => electronAPI.ipcRenderer.invoke('watchEntries:start', input),
    finish: (input) => electronAPI.ipcRenderer.invoke('watchEntries:finish', input),
    create: (input) => electronAPI.ipcRenderer.invoke('watchEntries:create', input),
    update: (input) => electronAPI.ipcRenderer.invoke('watchEntries:update', input),
    delete: (id) => electronAPI.ipcRenderer.invoke('watchEntries:delete', id),
    incrementEpisodes: (id) => electronAPI.ipcRenderer.invoke('watchEntries:incrementEpisodes', id),
    listReasons: () => electronAPI.ipcRenderer.invoke('reasons:list'),
    createReason: (label) => electronAPI.ipcRenderer.invoke('reasons:create', label)
  },
  stats: {
    get: () => electronAPI.ipcRenderer.invoke('stats:get')
  }
}

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
