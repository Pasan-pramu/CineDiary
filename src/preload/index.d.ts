import { ElectronAPI } from '@electron-toolkit/preload'
import type { CineDiaryApi } from '../shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: CineDiaryApi
  }
}
