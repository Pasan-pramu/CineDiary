import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APP_AUTHOR, APP_ID, APP_NAME, DATA_FOLDER_NAME, DEV_DATA_FOLDER_NAME } from './app'

// The app's identity must stay consistent between the code and the installer config.

const builderConfig = readFileSync(new URL('../../electron-builder.yml', import.meta.url), 'utf8')

describe('app identity', () => {
  it('uses the same app id as the installer (never change it)', () => {
    expect(builderConfig.split(/\r?\n/)).toContain(`appId: ${APP_ID}`)
    expect(APP_ID).toBe('com.pasan.cinediary')
  })

  it('keeps the data folders fixed, whatever the display name', () => {
    expect(DATA_FOLDER_NAME).toBe('cinediary')
    expect(DEV_DATA_FOLDER_NAME).toBe('cinediary-dev')
  })

  it('reads the display name and author from package.json', () => {
    expect(APP_NAME).toBeTruthy()
    expect(APP_AUTHOR).toBeTruthy()
  })
})
