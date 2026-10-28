import { author, productName } from '../../package.json'

// Who the app is. The display name and author come from package.json, which electron-builder
// also reads for the installer, shortcuts, Settings → Apps and the .exe's file properties.
// Renaming = changing `productName` there. See "Renaming" in CLAUDE.md.

/** The display name ("CineDiary"): window title, sidebar, texts, shortcuts, installer. */
export const APP_NAME: string = productName

/** The developer, shown in Settings → About and as the publisher in Windows. */
export const APP_AUTHOR: string = author

// NEVER CHANGE the values below: they tie installs, upgrades and your data together.

/** Windows app id: installs, upgrades, taskbar grouping. Same as appId in electron-builder.yml. */
export const APP_ID = 'com.pasan.cinediary'

/** The folder in %APPDATA% for the installed app (the default data folder lives here). */
export const DATA_FOLDER_NAME = 'cinediary'

/** The folder in %APPDATA% for `npm run dev` / `npm start`, so dev never touches the real diary. */
export const DEV_DATA_FOLDER_NAME = 'cinediary-dev'
