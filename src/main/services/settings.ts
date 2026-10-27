import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { settings } from '../db/schema'
import type { AppSettings } from '../../shared/types'
import { assertImagePath } from './posters'

const DISPLAY_NAME = 'display_name'
const BANNER_FILE = 'banner_file'

function readSetting(key: string): string | null {
  return getDatabase().select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
}

function writeSetting(key: string, value: string | null): void {
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
  return { displayName: readSetting(DISPLAY_NAME), bannerFile: readSetting(BANNER_FILE) }
}

/** An empty name clears it (the greeting then has no name). */
export function setDisplayName(name: string): AppSettings {
  writeSetting(DISPLAY_NAME, name.trim() || null)
  return getSettings()
}

function getBannersDirectory(): string {
  return join(app.getPath('userData'), 'banners')
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
