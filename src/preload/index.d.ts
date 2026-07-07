import type { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    aiHelper: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
    }
  }
}
