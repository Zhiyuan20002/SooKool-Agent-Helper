import type { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    aiHelper: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
      onNavigate: (
        callback: (view: 'local' | 'market' | 'local-share' | 'settings') => void
      ) => () => void
      onSkillCatalogChanged?: (callback: (catalog: unknown) => void) => () => void
      onLocalShareChanged?: (callback: (state: unknown) => void) => () => void
      onUpdateStateChanged?: (callback: (state: unknown) => void) => () => void
    }
  }
}
