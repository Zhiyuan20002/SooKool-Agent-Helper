import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
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
