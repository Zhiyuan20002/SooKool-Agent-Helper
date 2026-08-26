export interface LocalShareDevice {
  id: string
  alias: string
  address: string
  port: number
  fingerprint: string
  trusted: boolean
  lastSeenAt: string
}

export interface SkillManifestFile {
  path: string
  size: number
  sha256: string
  text: boolean
  executable: boolean
}

export interface SkillManifest {
  name: string
  description: string
  contentHash: string
  parentHash: string | null
  totalBytes: number
  createdAt: string
  files: SkillManifestFile[]
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
  incomingRequests: Array<{
    id: string
    device: LocalShareDevice
    manifest: SkillManifest
    pairingCode: string
    createdAt: string
  }>
  inbox: Array<{
    id: string
    eventId: string
    sender: Pick<LocalShareDevice, 'id' | 'alias' | 'fingerprint'>
    manifest: SkillManifest
    packagePath: string
    receivedAt: string
    status: 'ready' | 'applied'
  }>
  history: Array<{
    id: string
    direction: 'sent' | 'received' | 'applied' | 'restored'
    status: 'completed' | 'cancelled' | 'failed'
    skillName: string
    contentHash: string
    parentHash: string | null
    deviceAlias: string | null
    targetPath: string | null
    bytes: number
    createdAt: string
    detail?: string
  }>
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

export interface InboxInspection {
  relationship: 'new' | 'identical' | 'update' | 'conflict'
  difference: null | {
    status: 'identical' | 'changed'
    summary: { added: number; modified: number; deleted: number; unchanged: number }
    files: Array<{ path: string; change: 'added' | 'modified' | 'deleted' | 'unchanged' }>
  }
}
