import { app, dialog, net, protocol, screen, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import windowsIcon from '../../resources/icon.ico?asset'
import { getSqlite, migrateDatabase, openDatabase } from './db/client'
import { seedDefaultReasons } from './db/seed'
import { registerIpcHandlers } from './ipc'
import { clearTemporaryPosters, resolveBackdropPath, resolvePosterPath } from './services/posters'
import { resolveBannerPath } from './services/settings'
import { startConnectivityMonitor } from './services/connectivity'
import { initTheme, resolvedTheme } from './services/theme'
import { THEME_BACKGROUND } from '../shared/theme'
import { startBackgroundSync } from './services/tmdbBackground'
import {
  backupBeforeUpgrade,
  cleanUpBackupLeftovers,
  scheduleAutoBackup
} from './services/backupManager'
import { needsUpgradeBackup, readDiaryVersion, writeAppVersion } from './services/versionBackup'
import { getTitle } from './services/titles'
import {
  placeWindow,
  readWindowState,
  writeWindowState,
  type WindowDefaults
} from './services/windowState'
import { logError } from './logs'
import { initDataLocation, setUserDataFolder } from './dataFolder'
import { registerDataStartupHandlers } from './ipc/dataLocation.ipc'
import { registerAppHandlers } from './ipc/app.ipc'
import { APP_ID, APP_NAME } from '../shared/app'

// Before anything reads it: %APPDATA%\cinediary (installed) or cinediary-dev (development).
setUserDataFolder()

// Anything that escapes a handler still ends up in the error log (userData/logs).
process.on('unhandledRejection', (reason) => logError('main', reason))
process.on('uncaughtException', (error) => {
  logError('main', error)
  dialog.showErrorBox(`${APP_NAME} ran into a problem`, error.message)
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'poster',
    privileges: { standard: true, secure: true, supportFetchAPI: true }
  },
  {
    scheme: 'banner',
    privileges: { standard: true, secure: true, supportFetchAPI: true }
  }
])

const WINDOW_DEFAULTS: WindowDefaults = { width: 1360, height: 860, minWidth: 960, minHeight: 640 }

function windowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

/** Saves size, position and maximized state shortly after they change, and on close. */
function rememberWindowState(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined
  const save = (): void => {
    clearTimeout(timer)
    if (window.isDestroyed()) return
    try {
      writeWindowState(windowStatePath(), {
        bounds: window.getNormalBounds(),
        maximized: window.isMaximized()
      })
    } catch (error) {
      console.warn('Could not save the window position', error)
    }
  }
  const saveSoon = (): void => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  window.on('resize', saveSoon)
  window.on('move', saveSoon)
  window.on('maximize', saveSoon)
  window.on('unmaximize', saveSoon)
  window.on('close', save)
}

function createWindow(): void {
  // Opens where it was last time (or centered on the primary screen if that spot is gone).
  const primary = screen.getPrimaryDisplay()
  const workAreas = [
    primary.workArea,
    ...screen
      .getAllDisplays()
      .filter((display) => display.id !== primary.id)
      .map((display) => display.workArea)
  ]
  const placement = placeWindow(readWindowState(windowStatePath()), workAreas, WINDOW_DEFAULTS)

  // The window starts in the theme's background color and the preload sets the theme before
  // the first paint, so there's no dark/white flash on startup.
  const mainWindow = new BrowserWindow({
    backgroundColor: THEME_BACKGROUND[resolvedTheme()],
    ...placement.bounds,
    minWidth: WINDOW_DEFAULTS.minWidth,
    minHeight: WINDOW_DEFAULTS.minHeight,
    title: APP_NAME,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'win32' ? { icon: windowsIcon } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (placement.maximized) mainWindow.maximize()
    mainWindow.show()
  })
  rememberWindowState(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Where is the diary? If the chosen data folder is missing (e.g. its drive is unplugged), the
  // window shows "Can't find your diary" instead of quietly starting an empty database.
  const location = initDataLocation()
  if (location.state !== 'ok') {
    console.warn(
      `${APP_NAME} data folder not available: ${location.folder ?? 'unreadable pointer'}`
    )
    registerDataStartupHandlers(true)
    registerAppHandlers()
    createWindow()
    return
  }
  const databasePath = openDatabase()
  console.info(`${APP_NAME} database: ${databasePath}`)
  // The first start of a new version backs the diary up before any migration touches it.
  const diary = readDiaryVersion(getSqlite())
  if (
    needsUpgradeBackup(diary, app.getVersion()) &&
    !(await backupBeforeUpgrade(diary.lastVersion))
  ) {
    app.quit()
    return
  }
  try {
    migrateDatabase()
  } catch (error) {
    // The upgrade runs in one transaction, so the diary is exactly as it was: say so and stop.
    logError('main', error)
    dialog.showErrorBox(
      `${APP_NAME} couldn’t upgrade your diary`,
      `${error instanceof Error ? error.message : String(error)}\n\nYour diary was not changed.`
    )
    app.quit()
    return
  }
  writeAppVersion(getSqlite(), app.getVersion())
  clearTemporaryPosters()
  // The database opened fine, so leftovers of an earlier restore can go.
  void cleanUpBackupLeftovers()
  seedDefaultReasons()
  registerIpcHandlers()
  protocol.handle('poster', (request) => {
    const parsedUrl = new URL(request.url)
    // poster://backdrops/<titleId> serves the TMDB backdrop downloaded for that title.
    if (parsedUrl.hostname === 'backdrops') {
      const id = parsedUrl.pathname.match(/^\/(\d+)$/)?.[1]
      const backdropFile = id ? getTitle(Number(id))?.backdropFile : null
      if (!backdropFile) return new Response('Not found', { status: 404 })
      const backdropPath = resolveBackdropPath(backdropFile)
      if (!existsSync(backdropPath)) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(backdropPath).toString())
    }
    const titleId =
      parsedUrl.hostname === 'titles'
        ? parsedUrl.pathname.match(/^\/(\d+)$/)?.[1]
        : parsedUrl.pathname.match(/^\/titles\/(\d+)$/)?.[1]
    if (!titleId) return new Response('Not found', { status: 404 })
    if (!/^\d+$/.test(titleId)) return new Response('Not found', { status: 404 })
    const title = getTitle(Number(titleId))
    if (!title?.posterFile) return new Response('Not found', { status: 404 })
    const posterPath = resolvePosterPath(title.posterFile)
    if (!existsSync(posterPath)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(posterPath).toString())
  })
  // banner://current serves the custom dashboard banner chosen in Settings.
  protocol.handle('banner', () => {
    const bannerPath = resolveBannerPath()
    if (!bannerPath) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(bannerPath).toString())
  })
  // Windows app id: taskbar grouping and pinning match the installed shortcuts.
  electronApp.setAppUserModelId(APP_ID)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initTheme()
  createWindow()
  startConnectivityMonitor()
  startBackgroundSync()
  scheduleAutoBackup()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
