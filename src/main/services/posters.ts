import { existsSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { app } from 'electron'

export function getPostersDirectory(): string {
  return join(app.getPath('userData'), 'posters')
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
