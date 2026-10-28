// Appearance: the user's choice, and the theme actually shown.

export type AppearanceMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/**
 * The window's background before the page has painted (prevents a flash on startup).
 * Must match --color-background in src/renderer/src/styles/index.css.
 */
export const THEME_BACKGROUND: Record<ResolvedTheme, string> = {
  dark: '#0b1020',
  light: '#f6f5fb'
}
