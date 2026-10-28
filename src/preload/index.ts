import { contextBridge, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CineDiaryApi } from '../shared/api'
import type { ResolvedTheme } from '../shared/theme'

// Set data-theme on <html> before the page paints, and keep it in sync when the theme changes.
function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement
  if (root) {
    root.dataset.theme = theme
    return
  }
  // <html> doesn't exist yet: set it the moment the parser creates it.
  const observer = new MutationObserver(() => {
    if (!document.documentElement) return
    document.documentElement.dataset.theme = theme
    observer.disconnect()
  })
  observer.observe(document, { childList: true })
}

// Synchronous on purpose: one tiny call that must finish before the first paint (also after a
// reload, when the theme may have changed since the window was created).
const initialTheme: unknown = electronAPI.ipcRenderer.sendSync('theme:initial')
applyTheme(initialTheme === 'light' ? 'light' : 'dark')
electronAPI.ipcRenderer.on('theme:changed', (_event, theme: ResolvedTheme) => applyTheme(theme))

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
    collection: (query) => electronAPI.ipcRenderer.invoke('titles:collection', query),
    credits: (id) => electronAPI.ipcRenderer.invoke('titles:credits', id)
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
    setHighlight: (id, isHighlight) =>
      electronAPI.ipcRenderer.invoke('watchEntries:setHighlight', id, isHighlight)
  },
  moods: {
    list: () => electronAPI.ipcRenderer.invoke('moods:list'),
    create: (input) => electronAPI.ipcRenderer.invoke('moods:create', input),
    update: (id, input) => electronAPI.ipcRenderer.invoke('moods:update', id, input),
    setHidden: (id, hidden) => electronAPI.ipcRenderer.invoke('moods:setHidden', id, hidden),
    reorder: (ids) => electronAPI.ipcRenderer.invoke('moods:reorder', ids),
    delete: (id) => electronAPI.ipcRenderer.invoke('moods:delete', id)
  },
  reasons: {
    list: () => electronAPI.ipcRenderer.invoke('reasons:list'),
    create: (label) => electronAPI.ipcRenderer.invoke('reasons:create', label),
    rename: (id, label) => electronAPI.ipcRenderer.invoke('reasons:rename', id, label),
    setHidden: (id, hidden) => electronAPI.ipcRenderer.invoke('reasons:setHidden', id, hidden),
    reorder: (ids) => electronAPI.ipcRenderer.invoke('reasons:reorder', ids),
    delete: (id) => electronAPI.ipcRenderer.invoke('reasons:delete', id)
  },
  stats: {
    insights: (period) => electronAPI.ipcRenderer.invoke('stats:insights', period),
    feelings: (period) => electronAPI.ipcRenderer.invoke('stats:feelings', period),
    chapters: () => electronAPI.ipcRenderer.invoke('stats:chapters')
  },
  dashboard: {
    get: () => electronAPI.ipcRenderer.invoke('dashboard:get')
  },
  recommendations: {
    options: () => electronAPI.ipcRenderer.invoke('recommendations:options'),
    get: (query) => electronAPI.ipcRenderer.invoke('recommendations:get', query),
    discover: (query) => electronAPI.ipcRenderer.invoke('recommendations:discover', query)
  },
  settings: {
    get: () => electronAPI.ipcRenderer.invoke('settings:get'),
    setDisplayName: (name) => electronAPI.ipcRenderer.invoke('settings:setDisplayName', name),
    pickBanner: () => electronAPI.ipcRenderer.invoke('settings:pickBanner'),
    removeBanner: () => electronAPI.ipcRenderer.invoke('settings:removeBanner'),
    setTmdbToken: (token) => electronAPI.ipcRenderer.invoke('settings:setTmdbToken', token),
    removeTmdbToken: () => electronAPI.ipcRenderer.invoke('settings:removeTmdbToken'),
    setTmdbBackgroundSync: (on) =>
      electronAPI.ipcRenderer.invoke('settings:setTmdbBackgroundSync', on),
    setAppearance: (mode) => electronAPI.ipcRenderer.invoke('settings:setAppearance', mode)
  },
  tmdb: {
    search: (query) => electronAPI.ipcRenderer.invoke('tmdb:search', query),
    thumbnail: (posterPath) => electronAPI.ipcRenderer.invoke('tmdb:thumbnail', posterPath),
    pick: (type, tmdbId) => electronAPI.ipcRenderer.invoke('tmdb:pick', type, tmdbId),
    testConnection: (token) => electronAPI.ipcRenderer.invoke('tmdb:testConnection', token),
    link: (input) => electronAPI.ipcRenderer.invoke('tmdb:link', input),
    refreshAll: () => electronAPI.ipcRenderer.invoke('tmdb:refreshAll'),
    cancelRefresh: () => electronAPI.ipcRenderer.invoke('tmdb:cancelRefresh'),
    syncProgress: () => electronAPI.ipcRenderer.invoke('tmdb:syncProgress'),
    onSyncProgress: (listener) =>
      electronAPI.ipcRenderer.on('tmdb:syncProgress', (_event, progress) => listener(progress))
  },
  timeline: {
    page: (query, before) => electronAPI.ipcRenderer.invoke('timeline:page', query, before),
    overview: (query) => electronAPI.ipcRenderer.invoke('timeline:overview', query),
    chapters: () => electronAPI.ipcRenderer.invoke('timeline:chapters'),
    createChapter: (input) => electronAPI.ipcRenderer.invoke('timeline:createChapter', input),
    updateChapter: (id, input) =>
      electronAPI.ipcRenderer.invoke('timeline:updateChapter', id, input),
    deleteChapter: (id) => electronAPI.ipcRenderer.invoke('timeline:deleteChapter', id)
  },
  search: {
    global: (text) => electronAPI.ipcRenderer.invoke('search:global', text)
  },
  app: {
    info: () => electronAPI.ipcRenderer.invoke('app:info'),
    openLogs: () => electronAPI.ipcRenderer.invoke('app:openLogs'),
    logError: (report) => electronAPI.ipcRenderer.send('app:logError', report)
  },
  theme: {
    current: () => electronAPI.ipcRenderer.invoke('theme:current'),
    onChange: (listener) =>
      electronAPI.ipcRenderer.on('theme:changed', (_event, theme) => listener(theme))
  },
  backup: {
    status: () => electronAPI.ipcRenderer.invoke('backup:status'),
    create: () => electronAPI.ipcRenderer.invoke('backup:create'),
    chooseAutoFolder: () => electronAPI.ipcRenderer.invoke('backup:chooseAutoFolder'),
    setAuto: (options) => electronAPI.ipcRenderer.invoke('backup:setAuto', options),
    snoozeReminder: () => electronAPI.ipcRenderer.invoke('backup:snoozeReminder'),
    pickRestore: () => electronAPI.ipcRenderer.invoke('backup:pickRestore'),
    cancelRestore: () => electronAPI.ipcRenderer.invoke('backup:cancelRestore'),
    restore: () => electronAPI.ipcRenderer.invoke('backup:restore'),
    exportJson: () => electronAPI.ipcRenderer.invoke('export:json'),
    exportCsv: () => electronAPI.ipcRenderer.invoke('export:csv'),
    openDataFolder: () => electronAPI.ipcRenderer.invoke('backup:openDataFolder'),
    openBackupsFolder: () => electronAPI.ipcRenderer.invoke('backup:openBackupsFolder')
  },
  connectivity: {
    get: () => electronAPI.ipcRenderer.invoke('connectivity:get'),
    check: () => electronAPI.ipcRenderer.invoke('connectivity:check'),
    onChange: (listener) =>
      electronAPI.ipcRenderer.on('connectivity:changed', (_event, status) => listener(status))
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
