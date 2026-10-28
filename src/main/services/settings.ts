import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { safeStorage } from 'electron'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { settings } from '../db/schema'
import type { AppSettings, TmdbTokenStatus } from '../../shared/types'
import type { AppearanceMode } from '../../shared/theme'
import { assertImagePath } from './posters'
import { dataFolder } from '../dataFolder'

const DISPLAY_NAME = 'display_name'
const BANNER_FILE = 'banner_file'
/** Encrypted with safeStorage (OS-level, tied to this computer), stored as base64. */
const TMDB_TOKEN = 'tmdb_token_encrypted'
/** 'off' turns background TMDB re-sync off; anything else (or missing) means on. */
const TMDB_BACKGROUND_SYNC = 'tmdb_background_sync'
/** 'light' | 'dark'; missing = follow the system. */
const APPEARANCE = 'appearance'

export function readSetting(key: string): string | null {
  return getDatabase().select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
}

export function writeSetting(key: string, value: string | null): void {
  const database = getDatabase()
  if (value === null) {
    database.delete(settings).where(eq(settings.key, key)).run()
  } else {
    database
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run()
  }
}

export function getSettings(): AppSettings {
  return {
    displayName: readSetting(DISPLAY_NAME),
    bannerFile: readSetting(BANNER_FILE),
    tmdbToken: getTmdbTokenStatus(),
    tmdbBackgroundSync: isTmdbBackgroundSyncOn(),
    appearance: getAppearance()
  }
}

export function getAppearance(): AppearanceMode {
  const value = readSetting(APPEARANCE)
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function saveAppearance(mode: AppearanceMode): void {
  writeSetting(APPEARANCE, mode === 'system' ? null : mode)
}

export function isTmdbBackgroundSyncOn(): boolean {
  return readSetting(TMDB_BACKGROUND_SYNC) !== 'off'
}

export function setTmdbBackgroundSync(on: boolean): AppSettings {
  writeSetting(TMDB_BACKGROUND_SYNC, on ? null : 'off')
  return getSettings()
}

/**
 * The saved TMDB token, decrypted. Main process only — never send it to the renderer.
 * Returns null when none is saved or it can't be decrypted on this computer.
 */
export function getTmdbToken(): string | null {
  const stored = readSetting(TMDB_TOKEN)
  if (!stored) return null
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'))
  } catch {
    return null
  }
}

function getTmdbTokenStatus(): TmdbTokenStatus {
  if (!readSetting(TMDB_TOKEN)) return { state: 'none', hint: null }
  const token = getTmdbToken()
  return token ? { state: 'saved', hint: token.slice(-4) } : { state: 'unreadable', hint: null }
}

export function setTmdbToken(token: string): AppSettings {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage isn’t available on this computer, so the token can’t be saved.')
  }
  writeSetting(TMDB_TOKEN, safeStorage.encryptString(token).toString('base64'))
  return getSettings()
}

export function removeTmdbToken(): AppSettings {
  writeSetting(TMDB_TOKEN, null)
  return getSettings()
}

/** An empty name clears it (the greeting then has no name). */
export function setDisplayName(name: string): AppSettings {
  writeSetting(DISPLAY_NAME, name.trim() || null)
  return getSettings()
}

function getBannersDirectory(): string {
  return join(dataFolder(), 'banners')
}

/** Full path of the custom banner, or null when using the built-in design. */
export function resolveBannerPath(): string | null {
  const file = readSetting(BANNER_FILE)
  if (!file) return null
  const directory = getBannersDirectory()
  const path = resolve(directory, file)
  if (!path.startsWith(`${directory}\\`) && !path.startsWith(`${directory}/`)) return null
  return existsSync(path) ? path : null
}

function deleteBannerFile(): void {
  const path = resolveBannerPath()
  if (path) unlinkSync(path)
}

/** Copies the chosen image into userData/banners; a new file name on every change. */
export function setBannerImage(filePath: string): AppSettings {
  const extension = assertImagePath(filePath)
  mkdirSync(getBannersDirectory(), { recursive: true })
  const file = `banner-${randomUUID()}${extension}`
  copyFileSync(filePath, join(getBannersDirectory(), file))
  deleteBannerFile()
  writeSetting(BANNER_FILE, file)
  return getSettings()
}

export function removeBannerImage(): AppSettings {
  deleteBannerFile()
  writeSetting(BANNER_FILE, null)
  return getSettings()
}
