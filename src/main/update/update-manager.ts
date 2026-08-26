import type { AppUpdater } from 'electron-updater'
import type { UpdateErrorCode, UpdateState } from '../../shared/update-types'

const DEFAULT_STARTUP_DELAY_MS = 15_000
const DEFAULT_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1_000

interface UpdateManagerOptions {
  updater: AppUpdater
  enabled: boolean
  automaticChecks: boolean
  currentVersion: string
  onStateChanged: (state: UpdateState) => void
  startupDelayMs?: number
  checkIntervalMs?: number
}

export class UpdateManager {
  private readonly updater: AppUpdater
  private readonly enabled: boolean
  private readonly onStateChanged: (state: UpdateState) => void
  private readonly startupDelayMs: number
  private readonly checkIntervalMs: number
  private automaticChecks: boolean
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private intervalTimer: ReturnType<typeof setInterval> | null = null
  private checkInFlight = false
  private started = false
  private state: UpdateState

  constructor(options: UpdateManagerOptions) {
    this.updater = options.updater
    this.enabled = options.enabled
    this.automaticChecks = options.automaticChecks
    this.onStateChanged = options.onStateChanged
    this.startupDelayMs = options.startupDelayMs ?? DEFAULT_STARTUP_DELAY_MS
    this.checkIntervalMs = options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS
    this.state = createInitialUpdateState(options.currentVersion, options.enabled)

    this.updater.autoDownload = true
    this.updater.autoInstallOnAppQuit = false
    this.updater.allowPrerelease = false
    this.updater.allowDowngrade = false
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.registerUpdaterEvents()
    this.emitState()
    this.scheduleAutomaticChecks()
  }

  getState(): UpdateState {
    return { ...this.state }
  }

  setAutomaticChecks(enabled: boolean): void {
    this.automaticChecks = enabled
    this.scheduleAutomaticChecks()
  }

  async checkForUpdates(): Promise<UpdateState> {
    if (!this.enabled || this.checkInFlight) return this.getState()

    this.checkInFlight = true
    this.setState({ phase: 'checking', errorCode: null, progressPercent: null })
    try {
      await this.updater.checkForUpdates()
    } catch (error) {
      this.handleError(error)
    } finally {
      this.checkInFlight = false
    }
    return this.getState()
  }

  installDownloadedUpdate(): boolean {
    if (!this.enabled || this.state.phase !== 'downloaded') return false
    this.setState({ phase: 'installing', errorCode: null })
    this.updater.quitAndInstall(false, true)
    return true
  }

  dispose(): void {
    this.clearTimers()
    this.updater.off('checking-for-update', this.handleChecking)
    this.updater.off('update-available', this.handleAvailable)
    this.updater.off('update-not-available', this.handleNotAvailable)
    this.updater.off('download-progress', this.handleProgress)
    this.updater.off('update-downloaded', this.handleDownloaded)
    this.updater.off('error', this.handleUpdaterError)
  }

  private registerUpdaterEvents(): void {
    this.updater.on('checking-for-update', this.handleChecking)
    this.updater.on('update-available', this.handleAvailable)
    this.updater.on('update-not-available', this.handleNotAvailable)
    this.updater.on('download-progress', this.handleProgress)
    this.updater.on('update-downloaded', this.handleDownloaded)
    this.updater.on('error', this.handleUpdaterError)
  }

  private readonly handleChecking = (): void => {
    this.setState({ phase: 'checking', errorCode: null })
  }

  private readonly handleAvailable = (info: { version: string; releaseDate?: string }): void => {
    this.setState({
      phase: 'available',
      availableVersion: info.version,
      releaseDate: info.releaseDate ?? null,
      lastCheckedAt: new Date().toISOString(),
      errorCode: null
    })
  }

  private readonly handleNotAvailable = (): void => {
    this.setState({
      phase: 'up-to-date',
      availableVersion: null,
      releaseDate: null,
      progressPercent: null,
      transferredBytes: null,
      totalBytes: null,
      bytesPerSecond: null,
      lastCheckedAt: new Date().toISOString(),
      errorCode: null
    })
  }

  private readonly handleProgress = (progress: {
    percent: number
    transferred: number
    total: number
    bytesPerSecond: number
  }): void => {
    this.setState({
      phase: 'downloading',
      progressPercent: clampProgress(progress.percent),
      transferredBytes: progress.transferred,
      totalBytes: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
      errorCode: null
    })
  }

  private readonly handleDownloaded = (info: { version: string; releaseDate?: string }): void => {
    this.setState({
      phase: 'downloaded',
      availableVersion: info.version,
      releaseDate: info.releaseDate ?? this.state.releaseDate,
      progressPercent: 100,
      transferredBytes: this.state.totalBytes,
      bytesPerSecond: 0,
      errorCode: null
    })
  }

  private readonly handleUpdaterError = (error: Error): void => {
    this.handleError(error)
  }

  private handleError(error: unknown): void {
    console.error('[update] Update operation failed', error)
    this.setState({
      phase: 'error',
      lastCheckedAt: new Date().toISOString(),
      errorCode: classifyUpdateError(error)
    })
  }

  private scheduleAutomaticChecks(): void {
    this.clearTimers()
    if (!this.started || !this.enabled || !this.automaticChecks) return

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null
      void this.checkForUpdates()
      this.intervalTimer = setInterval(() => void this.checkForUpdates(), this.checkIntervalMs)
      this.intervalTimer.unref()
    }, this.startupDelayMs)
    this.startupTimer.unref()
  }

  private clearTimers(): void {
    if (this.startupTimer) clearTimeout(this.startupTimer)
    if (this.intervalTimer) clearInterval(this.intervalTimer)
    this.startupTimer = null
    this.intervalTimer = null
  }

  private setState(next: Partial<UpdateState>): void {
    this.state = { ...this.state, ...next }
    this.emitState()
  }

  private emitState(): void {
    this.onStateChanged(this.getState())
  }
}

export function createInitialUpdateState(currentVersion: string, enabled: boolean): UpdateState {
  return {
    phase: enabled ? 'idle' : 'disabled',
    currentVersion,
    availableVersion: null,
    releaseDate: null,
    progressPercent: null,
    transferredBytes: null,
    totalBytes: null,
    bytesPerSecond: null,
    lastCheckedAt: null,
    errorCode: null
  }
}

export function classifyUpdateError(error: unknown): UpdateErrorCode {
  const message = String(error instanceof Error ? error.message : error).toLowerCase()
  if (
    message.includes('enotfound') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('net::') ||
    message.includes('network')
  ) {
    return 'network'
  }
  if (message.includes('404') || message.includes('latest') || message.includes('update info')) {
    return 'metadata'
  }
  if (
    message.includes('sha512') ||
    message.includes('checksum') ||
    message.includes('signature') ||
    message.includes('code signing')
  ) {
    return 'verification'
  }
  return 'unknown'
}

function clampProgress(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}
