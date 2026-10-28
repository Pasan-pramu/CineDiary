import { readFileSync, renameSync, writeFileSync } from 'node:fs'

// Remembers the window's size, position and maximized state between launches, in
// userData/window-state.json (not the database, so a restore never moves the window).
// No Electron imports: index.ts passes in the displays, so this is plain and tested.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState {
  /** The normal (not maximized) bounds. */
  bounds: Rect
  maximized: boolean
}

export interface WindowDefaults {
  width: number
  height: number
  minWidth: number
  minHeight: number
}

/** At least this much of the window must be on one screen, or it's centered on the primary. */
const MIN_VISIBLE_SHARE = 0.5

function isRect(value: unknown): value is Rect {
  if (typeof value !== 'object' || value === null) return false
  const rect = value as Record<string, unknown>
  return ['x', 'y', 'width', 'height'].every(
    (key) => typeof rect[key] === 'number' && Number.isFinite(rect[key])
  )
}

/** The saved state, or null when the file is missing or not what we wrote. */
export function readWindowState(path: string): WindowState | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return null
    const { bounds, maximized } = parsed as Record<string, unknown>
    if (!isRect(bounds)) return null
    return { bounds, maximized: maximized === true }
  } catch {
    return null
  }
}

export function writeWindowState(path: string, state: WindowState): void {
  // Write then rename, so a crash mid-write never leaves half a file.
  writeFileSync(`${path}.tmp`, JSON.stringify(state))
  renameSync(`${path}.tmp`, path)
}

function overlap(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? width * height : 0
}

function centered(width: number, height: number, area: Rect): Rect {
  return {
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2)
  }
}

/**
 * Where the window opens. `workAreas` are the connected screens (without taskbars);
 * the first is the primary display.
 * - No saved state: default size, centered on the primary display.
 * - Sizes are kept between the window's minimum and the screen it lands on.
 * - If less than half the window would be on any screen (e.g. that monitor was unplugged),
 *   it's centered on the primary display instead. Maximized is kept either way.
 */
export function placeWindow(
  saved: WindowState | null,
  workAreas: Rect[],
  defaults: WindowDefaults
): WindowState {
  const primary = workAreas[0]
  const fit = (width: number, height: number, area: Rect): { width: number; height: number } => ({
    width: Math.round(Math.max(defaults.minWidth, Math.min(width, area.width))),
    height: Math.round(Math.max(defaults.minHeight, Math.min(height, area.height)))
  })

  if (!saved) {
    const size = fit(defaults.width, defaults.height, primary)
    return { bounds: centered(size.width, size.height, primary), maximized: false }
  }

  const { bounds } = saved
  const best = workAreas
    .map((area) => ({ area, visible: overlap(bounds, area) }))
    .sort((a, b) => b.visible - a.visible)[0]
  const area = bounds.width * bounds.height
  if (best && area > 0 && best.visible / area >= MIN_VISIBLE_SHARE) {
    const size = fit(bounds.width, bounds.height, best.area)
    // Pull it fully onto that screen if part of it hangs over an edge.
    const x = Math.min(Math.max(bounds.x, best.area.x), best.area.x + best.area.width - size.width)
    const y = Math.min(
      Math.max(bounds.y, best.area.y),
      best.area.y + best.area.height - size.height
    )
    return { bounds: { x, y, ...size }, maximized: saved.maximized }
  }
  const size = fit(bounds.width, bounds.height, primary)
  return { bounds: centered(size.width, size.height, primary), maximized: saved.maximized }
}
