import type { ElectronAPI } from '@electron-toolkit/preload'
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

declare global {
  interface Window {
    electron: ElectronAPI
    aiHelper: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
      onNavigate: (callback: (view: 'local' | 'market' | 'settings') => void) => () => void
      onSkillCatalogChanged?: (callback: (catalog: unknown) => void) => () => void
      routing: {
        getSnapshot: () => Promise<RoutingSnapshot>
        saveProvider: (input: RoutingProviderInput) => Promise<RoutingProviderSummary>
        deleteProvider: (input: DeleteRoutingProviderInput) => Promise<RoutingSnapshot>
        activateProvider: (input: ActivateRoutingProviderInput) => Promise<RoutingSnapshot>
        getProxySnapshot: () => Promise<RoutingProxySnapshot>
        updateProxyConfig: (input: UpdateRoutingProxyInput) => Promise<RoutingProxySnapshot>
        startProxy: () => Promise<RoutingProxySnapshot>
        stopProxy: () => Promise<RoutingProxySnapshot>
        getUsage: (input?: RoutingUsageQuery) => Promise<RoutingUsageSnapshot>
      }
    }
  }
}
