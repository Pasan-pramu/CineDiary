import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
  unlinkSync
} from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'

export function getPostersDirectory(): string {
  return join(app.getPath('userData'), 'posters')
}

export function getPosterTempDirectory(): string {
  return join(app.getPath('userData'), 'posters-temp')
}

export function clearTemporaryPosters(): void {
  const directory = getPosterTempDirectory()
  mkdirSync(directory, { recursive: true })
  for (const file of readdirSync(directory)) {
    unlinkSync(join(directory, file))
  }
}

export function assertImagePath(filePath: string): string {
  const extension = extname(filePath).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
    throw new Error('Choose a JPG, PNG, or WebP image.')
  }
  if (!existsSync(filePath)) throw new Error('The selected image could not be found.')
  return extension
}

export function preparePoster(filePath: string): { tempFile: string; previewDataUrl: string } {
  const extension = assertImagePath(filePath)
  const tempFile = `${randomUUID()}${extension}`
  const destination = join(getPosterTempDirectory(), tempFile)
  mkdirSync(getPosterTempDirectory(), { recursive: true })
  copyFileSync(filePath, destination)
  const mime =
    extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
  const previewDataUrl = `data:${mime};base64,${readFileSync(destination, 'base64')}`
  return { tempFile, previewDataUrl }
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

/** Puts downloaded poster bytes (e.g. from TMDB) into the same temporary flow as a picked file. */
export function prepareDownloadedPoster(
  bytes: Uint8Array,
  contentType: string
): { tempFile: string; previewDataUrl: string } {
  const mime = contentType.split(';')[0].trim().toLowerCase()
  const extension = EXTENSIONS[mime]
  if (!extension) throw new Error('The downloaded poster is not a JPG, PNG, or WebP image.')
  const tempFile = `${randomUUID()}${extension}`
  mkdirSync(getPosterTempDirectory(), { recursive: true })
  writeFileSync(join(getPosterTempDirectory(), tempFile), bytes)
  return {
    tempFile,
    previewDataUrl: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
  }
}

export function moveTemporaryPoster(tempFile: string, titleId: number, extension: string): string {
  if (!/^[\w-]+\.(jpg|jpeg|png|webp)$/.test(tempFile)) throw new Error('Invalid temporary poster.')
  const source = resolve(getPosterTempDirectory(), tempFile)
  if (!source.startsWith(`${getPosterTempDirectory()}\\`) || !existsSync(source)) {
    throw new Error('Temporary poster was not found.')
  }
  mkdirSync(getPostersDirectory(), { recursive: true })
  const posterFile = `${titleId}${extension}`
  renameSync(source, join(getPostersDirectory(), posterFile))
  return posterFile
}

export function deleteTemporaryPoster(tempFile: string | undefined): void {
  if (!tempFile || !/^[\w-]+\.(jpg|jpeg|png|webp)$/.test(tempFile)) return
  const path = resolve(getPosterTempDirectory(), tempFile)
  if (path.startsWith(`${getPosterTempDirectory()}\\`) && existsSync(path)) unlinkSync(path)
}

export function deletePosterFile(posterFile: string | null): void {
  if (!posterFile) return
  const posterPath = resolvePosterPath(posterFile)
  if (existsSync(posterPath)) unlinkSync(posterPath)
}

export function resolvePosterPath(posterFile: string): string {
  const postersDirectory = getPostersDirectory()
  const posterPath = resolve(postersDirectory, posterFile)
  if (posterPath !== postersDirectory && !posterPath.startsWith(`${postersDirectory}\\`)) {
    throw new Error('Invalid poster filename')
  }
  return posterPath
}
