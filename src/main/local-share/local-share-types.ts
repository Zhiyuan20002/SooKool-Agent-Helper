export const LOCAL_SHARE_PROTOCOL = 'sookool-local-share/1'

export interface SkillManifestFile {
  path: string
  size: number
  sha256: string
  text: boolean
  executable: boolean
}

export interface SkillManifest {
  protocol: typeof LOCAL_SHARE_PROTOCOL
  name: string
  description: string
  contentHash: string
  parentHash: string | null
  totalBytes: number
  createdAt: string
  files: SkillManifestFile[]
}

export type SkillFileChange = 'added' | 'modified' | 'deleted' | 'unchanged'

export interface SkillDifferenceFile {
  path: string
  change: SkillFileChange
  local?: SkillManifestFile
  incoming?: SkillManifestFile
}

export interface SkillDifference {
  status: 'identical' | 'changed'
  summary: Record<SkillFileChange, number>
  files: SkillDifferenceFile[]
}

export interface LocalShareDevice {
  id: string
  alias: string
  address: string
  port: number
  fingerprint: string
  trusted: boolean
  lastSeenAt: string
}

export interface LocalShareHistoryEvent {
  id: string
  direction: 'sent' | 'received' | 'applied' | 'restored'
  status: 'completed' | 'cancelled' | 'failed'
  skillName: string
  contentHash: string
  parentHash: string | null
  deviceId: string | null
  deviceAlias: string | null
  objectPath: string
  targetPath: string | null
  bytes: number
  createdAt: string
  completedAt: string
  detail?: string
}

export interface IncomingShareRequest {
  id: string
  device: LocalShareDevice
  manifest: SkillManifest
  pairingCode: string
  createdAt: string
}

export interface LocalShareInboxItem {
  id: string
  eventId: string
  sender: Pick<LocalShareDevice, 'id' | 'alias' | 'fingerprint'>
  manifest: SkillManifest
  packagePath: string
  receivedAt: string
  status: 'ready' | 'applied'
}

export interface LocalShareState {
  enabled: boolean
  expiresAt: string | null
  identity: { id: string; alias: string; fingerprint: string }
  devices: LocalShareDevice[]
  trustedDevices: Array<{
    id: string
    alias: string
    fingerprint: string
    trustedAt: string
  }>
  incomingRequests: IncomingShareRequest[]
  inbox: LocalShareInboxItem[]
  history: LocalShareHistoryEvent[]
  activeTransfers: Array<{
    id: string
    direction: 'send' | 'receive'
    skillName: string
    deviceAlias: string
    status: 'waiting' | 'transferring' | 'completed' | 'cancelled' | 'failed'
    progress: number
    pairingCode?: string
  }>
}
