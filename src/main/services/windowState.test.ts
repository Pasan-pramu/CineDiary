import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  placeWindow,
  readWindowState,
  writeWindowState,
  type Rect,
  type WindowDefaults
} from './windowState'

// Window size and position between launches (pure logic; files in a temp folder).

const DEFAULTS: WindowDefaults = { width: 1360, height: 860, minWidth: 960, minHeight: 640 }
const PRIMARY: Rect = { x: 0, y: 0, width: 1920, height: 1040 } // 1080p minus the taskbar
const RIGHT: Rect = { x: 1920, y: 0, width: 2560, height: 1400 } // a second monitor

describe('window placement', () => {
  it('uses the default size, centered on the primary screen, the first time', () => {
    expect(placeWindow(null, [PRIMARY], DEFAULTS)).toEqual({
      bounds: { x: 280, y: 90, width: 1360, height: 860 },
      maximized: false
    })
  })

  it('reopens where it was, on any connected screen', () => {
    const saved = { bounds: { x: 2200, y: 100, width: 1500, height: 900 }, maximized: false }
    expect(placeWindow(saved, [PRIMARY, RIGHT], DEFAULTS)).toEqual(saved)
  })

  it('centers on the primary screen when its monitor was unplugged', () => {
    const saved = { bounds: { x: 2200, y: 100, width: 1500, height: 900 }, maximized: false }
    expect(placeWindow(saved, [PRIMARY], DEFAULTS)).toEqual({
      bounds: { x: 210, y: 70, width: 1500, height: 900 },
      maximized: false
    })
  })

  it('keeps it maximized, even when it moves to the primary screen', () => {
    const saved = { bounds: { x: 2200, y: 100, width: 1500, height: 900 }, maximized: true }
    expect(placeWindow(saved, [PRIMARY], DEFAULTS).maximized).toBe(true)
  })

  it('pulls a mostly visible window fully onto its screen', () => {
    const saved = { bounds: { x: 700, y: -40, width: 1360, height: 860 }, maximized: false }
    expect(placeWindow(saved, [PRIMARY], DEFAULTS).bounds).toEqual({
      x: 560,
      y: 0,
      width: 1360,
      height: 860
    })
  })

  it('keeps sizes between the minimum and the screen', () => {
    const tiny = { bounds: { x: 100, y: 100, width: 300, height: 200 }, maximized: false }
    expect(placeWindow(tiny, [PRIMARY], DEFAULTS).bounds).toMatchObject({ width: 960, height: 640 })
    const huge = { bounds: { x: 0, y: 0, width: 4000, height: 3000 }, maximized: false }
    expect(placeWindow(huge, [PRIMARY], DEFAULTS).bounds).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1040
    })
  })
})

describe('window state file', () => {
  let folder: string | null = null
  afterEach(() => {
    if (folder) rmSync(folder, { recursive: true, force: true })
    folder = null
  })
  const file = (): string => {
    folder = mkdtempSync(join(tmpdir(), 'cinediary-window-'))
    return join(folder, 'window-state.json')
  }

  it('round-trips what it wrote', () => {
    const path = file()
    const state = { bounds: { x: 10, y: 20, width: 1200, height: 800 }, maximized: true }
    writeWindowState(path, state)
    expect(readWindowState(path)).toEqual(state)
  })

  it('ignores a missing or corrupt file', () => {
    const path = file()
    expect(readWindowState(path)).toBeNull()
    writeFileSync(path, '{ not json')
    expect(readWindowState(path)).toBeNull()
    writeFileSync(path, JSON.stringify({ bounds: { x: 'left', y: 0, width: 10, height: 10 } }))
    expect(readWindowState(path)).toBeNull()
  })
})
