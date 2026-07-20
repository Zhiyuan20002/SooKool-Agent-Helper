import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ActivateRoutingProviderInput,
  DeleteRoutingProviderInput,
  RoutingProxySnapshot,
  RoutingProviderInput,
  RoutingProviderSummary,
  RoutingSnapshot,
  RoutingUsageQuery,
  RoutingUsageSnapshot,
  UpdateRoutingProxyInput
} from '../shared/routing-types'

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
  },
  routing: {
    getSnapshot: (): Promise<RoutingSnapshot> => ipcRenderer.invoke('routing:getSnapshot'),
    saveProvider: (input: RoutingProviderInput): Promise<RoutingProviderSummary> =>
      ipcRenderer.invoke('routing:saveProvider', input),
    deleteProvider: (input: DeleteRoutingProviderInput): Promise<RoutingSnapshot> =>
      ipcRenderer.invoke('routing:deleteProvider', input),
    activateProvider: (input: ActivateRoutingProviderInput): Promise<RoutingSnapshot> =>
      ipcRenderer.invoke('routing:activateProvider', input),
    getProxySnapshot: (): Promise<RoutingProxySnapshot> =>
      ipcRenderer.invoke('routing:getProxySnapshot'),
    updateProxyConfig: (input: UpdateRoutingProxyInput): Promise<RoutingProxySnapshot> =>
      ipcRenderer.invoke('routing:updateProxyConfig', input),
    startProxy: (): Promise<RoutingProxySnapshot> => ipcRenderer.invoke('routing:startProxy'),
    stopProxy: (): Promise<RoutingProxySnapshot> => ipcRenderer.invoke('routing:stopProxy'),
    getUsage: (input?: RoutingUsageQuery): Promise<RoutingUsageSnapshot> =>
      ipcRenderer.invoke('routing:getUsage', input)
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
