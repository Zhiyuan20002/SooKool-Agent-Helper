export type UpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'up-to-date'
  | 'error'

export type UpdateErrorCode = 'network' | 'metadata' | 'verification' | 'unknown'

export interface UpdateState {
  phase: UpdatePhase
  currentVersion: string
  availableVersion: string | null
  releaseDate: string | null
  progressPercent: number | null
  transferredBytes: number | null
  totalBytes: number | null
  bytesPerSecond: number | null
  lastCheckedAt: string | null
  errorCode: UpdateErrorCode | null
}
