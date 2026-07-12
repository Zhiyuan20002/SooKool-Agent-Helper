import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  onNavigate: (callback: (view: 'local' | 'market' | 'settings') => void) => {
    const listener = (_event: IpcRendererEvent, view: 'local' | 'market' | 'settings') =>
      callback(view)
    ipcRenderer.on('menu:navigate', listener)
    return () => ipcRenderer.removeListener('menu:navigate', listener)
  },
  onSkillCatalogChanged: (callback: (catalog: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, catalog: unknown) => callback(catalog)
    ipcRenderer.on('skillCatalog:changed', listener)
    return () => ipcRenderer.removeListener('skillCatalog:changed', listener)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('aiHelper', api)
} else {
  const target = window as typeof window & {
    electron: typeof electronAPI
    aiHelper: typeof api
  }
  target.electron = electronAPI
  target.aiHelper = api
}
