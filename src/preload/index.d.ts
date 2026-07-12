import type { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    aiHelper: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
      onNavigate: (callback: (view: 'local' | 'market' | 'settings') => void) => () => void
      onSkillCatalogChanged?: (callback: (catalog: unknown) => void) => () => void
    }
  }
}
