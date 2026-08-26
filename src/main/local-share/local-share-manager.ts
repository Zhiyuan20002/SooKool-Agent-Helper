import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import https, { type RequestOptions, type Server } from 'node:https'
import { join } from 'node:path'
import { TLSSocket } from 'node:tls'
import { DiscoveryService, isPrivateNetworkAddress } from './discovery-service.ts'
import {
  loadOrCreateDeviceIdentity,
  normalizeFingerprint,
  pairingCode,
  type DeviceIdentity
} from './device-identity.ts'
import type {
  IncomingShareRequest,
  LocalShareDevice,
  LocalShareInboxItem,
  LocalShareState,
  SkillDifference,
  SkillManifest
} from './local-share-types.ts'
import { RevisionStore } from './revision-store.ts'
import {
  assertValidSkillManifest,
  buildSkillManifest,
  compareSkillManifests,
  createSharePackage,
  extractSharePackage
} from './skill-package.ts'
import { TrustedDeviceStore } from './trusted-device-store.ts'

interface PendingRequest extends IncomingShareRequest {
  status: 'pending' | 'accepted' | 'uploading' | 'rejected' | 'cancelled' | 'uploaded'
  uploadToken: string | null
  peerFingerprint: string
  expiresAt: string
}

interface LocalShareManagerOptions {
  rootPath: string
  alias?: string
  port?: number
  discovery?: boolean
  completedTransferRetentionMs?: number
  onChange?: (state: LocalShareState) => void
}

interface JsonResponse<T> {
  statusCode: number
  value: T
}

const REQUEST_TTL_MS = 2 * 60_000
const REQUEST_TIMEOUT_MS = 10_000
const MAX_JSON_RESPONSE_BYTES = 64 * 1024
const MAX_SHARE_DURATION_MS = 60 * 60_000
const MAX_PENDING_REQUESTS = 32
const MAX_PENDING_PER_DEVICE = 3
const MAX_PREPARES_PER_MINUTE = 20
const COMPLETED_TRANSFER_RETENTION_MS = 5_000

export class LocalShareManager {
  private readonly rootPath: string
  private readonly preferredPort: number
  private readonly useDiscovery: boolean
  private readonly onChange: (state: LocalShareState) => void
  private readonly completedTransferRetentionMs: number
  private readonly identity: DeviceIdentity
  private readonly trustedDevices: TrustedDeviceStore
  private readonly revisions: RevisionStore
  private server: Server | null = null
  private discovery: DiscoveryService | null = null
  private enabled = false
  private expiresAt: string | null = null
  private expiryTimer: NodeJS.Timeout | null = null
  private pendingShutdown = false
  private devices = new Map<string, LocalShareDevice>()
  private discoveredDevices = new Map<string, LocalShareDevice>()
  private manualDevices = new Map<string, LocalShareDevice>()
  private requests = new Map<string, PendingRequest>()
  private prepareAttempts = new Map<string, number[]>()
  private inbox: LocalShareInboxItem[] = []
  private activeTransfers: LocalShareState['activeTransfers'] = []
  private transferCleanupTimers = new Map<string, NodeJS.Timeout>()

  constructor(options: LocalShareManagerOptions) {
    this.rootPath = options.rootPath
    this.preferredPort = options.port ?? 53318
    this.useDiscovery = options.discovery !== false
    this.onChange = options.onChange ?? (() => undefined)
    this.completedTransferRetentionMs =
      options.completedTransferRetentionMs ?? COMPLETED_TRANSFER_RETENTION_MS
    mkdirSync(this.rootPath, { recursive: true })
    this.identity = loadOrCreateDeviceIdentity(
      join(this.rootPath, 'identity', 'device.json'),
      options.alias
    )
    this.trustedDevices = new TrustedDeviceStore(join(this.rootPath, 'trusted-devices.json'))
    this.revisions = new RevisionStore(this.rootPath)
    this.inbox = this.loadInbox()
  }

  getState(): LocalShareState {
    return {
      enabled: this.enabled,
      expiresAt: this.expiresAt,
      identity: {
        id: this.identity.id,
        alias: this.identity.alias,
        fingerprint: this.identity.fingerprint
      },
      devices: [...this.devices.values()].sort((a, b) => a.alias.localeCompare(b.alias)),
      trustedDevices: this.trustedDevices.list().sort((a, b) => a.alias.localeCompare(b.alias)),
      incomingRequests: [...this.requests.values()]
        .filter((request) => request.status === 'pending' && !this.isRequestExpired(request))
        .map(
          ({
            status: _status,
            uploadToken: _token,
            peerFingerprint: _fingerprint,
            expiresAt: _expiresAt,
            ...request
          }) => request
        ),
      inbox: [...this.inbox].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
      history: this.revisions.listHistory(),
      activeTransfers: [...this.activeTransfers]
    }
  }

  async enable(durationMs = 10 * 60_000): Promise<LocalShareState> {
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_SHARE_DURATION_MS)
      throw new Error('共享时长无效。')
    const nextExpiresAt = new Date(Date.now() + durationMs).toISOString()
    const shouldCloseServerOnFailure = !this.server
    let startedDiscovery: DiscoveryService | null = null
    try {
      if (!this.server) await this.startServer()
      if (this.useDiscovery && !this.discovery) {
        startedDiscovery = new DiscoveryService(
          this.identity,
          this.port,
          (id, fingerprint) => this.trustedDevices.isTrusted(id, fingerprint),
          (devices) => {
            this.discoveredDevices = new Map(devices.map((device) => [device.id, device]))
            this.rebuildDevices()
            this.emit()
          }
        )
        await startedDiscovery.start()
        this.discovery = startedDiscovery
      }
    } catch (error) {
      startedDiscovery?.stop()
      this.discovery = null
      if (shouldCloseServerOnFailure) await this.closeServer()
      this.enabled = false
      this.expiresAt = null
      throw error
    }
    this.enabled = true
    this.pendingShutdown = false
    this.expiresAt = nextExpiresAt
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null
      if (this.hasActiveTransfer()) {
        this.pendingShutdown = true
        return
      }
      void this.disable()
    }, durationMs)
    this.emit()
    return this.getState()
  }

  async disable(): Promise<LocalShareState> {
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    this.expiryTimer = null
    this.pendingShutdown = false
    this.expiresAt = null
    this.enabled = false
    this.discovery?.stop()
    this.discovery = null
    for (const request of this.requests.values()) request.status = 'cancelled'
    this.requests.clear()
    this.prepareAttempts.clear()
    await this.closeServer()
    this.devices.clear()
    this.discoveredDevices.clear()
    this.manualDevices.clear()
    this.emit()
    return this.getState()
  }

  dispose(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer)
    for (const timer of this.transferCleanupTimers.values()) clearTimeout(timer)
    this.transferCleanupTimers.clear()
    this.discovery?.stop()
    this.server?.closeAllConnections()
    this.server?.close()
    this.server = null
  }

  get port(): number {
    const address = this.server?.address()
    return typeof address === 'object' && address ? address.port : 0
  }

  addKnownDevice(device: LocalShareDevice): LocalShareState {
    if (!isPrivateNetworkAddress(device.address)) throw new Error('只能连接私有或本机网络地址。')
    this.manualDevices.set(device.id, {
      ...device,
      fingerprint: normalizeFingerprint(device.fingerprint),
      trusted: this.trustedDevices.isTrusted(device.id, normalizeFingerprint(device.fingerprint))
    })
    this.rebuildDevices()
    this.emit()
    return this.getState()
  }

  async addManualDevice(address: string, port = 53318): Promise<LocalShareState> {
    if (!isPrivateNetworkAddress(address) || !Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('请输入有效的私有网络地址和端口。')
    }
    const discovered = await this.performUnpinnedInfoRequest(address, port)
    this.addKnownDevice({
      id: discovered.id,
      alias: discovered.alias,
      address,
      port,
      fingerprint: discovered.fingerprint,
      trusted: this.trustedDevices.isTrusted(discovered.id, discovered.fingerprint),
      lastSeenAt: new Date().toISOString()
    })
    return this.getState()
  }

  forgetTrustedDevice(deviceId: string): LocalShareState {
    this.trustedDevices.remove(deviceId)
    const device = this.devices.get(deviceId)
    if (device) device.trusted = false
    const discovered = this.discoveredDevices.get(deviceId)
    if (discovered) discovered.trusted = false
    const manual = this.manualDevices.get(deviceId)
    if (manual) manual.trusted = false
    this.emit()
    return this.getState()
  }

  respondToRequest(
    requestId: string,
    decision: 'accept-once' | 'trust' | 'reject'
  ): LocalShareState {
    const request = this.requests.get(requestId)
    if (!request || request.status !== 'pending' || this.isRequestExpired(request))
      throw new Error('这条共享请求已经失效。')
    if (decision === 'reject') {
      request.status = 'rejected'
    } else {
      request.status = 'accepted'
      request.uploadToken = randomBytes(32).toString('base64url')
      if (decision === 'trust') this.trustedDevices.trust(request.device)
    }
    this.emit()
    return this.getState()
  }

  async sendSkill(
    deviceId: string,
    skillDirectory: string,
    parentHash: string | null = null
  ): Promise<LocalShareState> {
    if (!this.enabled) throw new Error('请先开启本地共享。')
    const device = this.devices.get(deviceId)
    if (!device) throw new Error('附近设备已经离线。')
    const transferId = crypto.randomUUID()
    const inferredParentHash =
      parentHash ??
      this.revisions
        .listHistory()
        .find(
          (event) =>
            event.targetPath === skillDirectory &&
            (event.direction === 'applied' || event.direction === 'restored')
        )?.contentHash ??
      null
    const packaged = createSharePackage(skillDirectory, inferredParentHash)
    this.activeTransfers.push({
      id: transferId,
      direction: 'send',
      skillName: packaged.manifest.name,
      deviceAlias: device.alias,
      status: 'waiting',
      progress: 0
    })
    this.emit()
    try {
      const prepared = await this.requestJson<{ requestId: string; pairingCode: string }>(
        device,
        'POST',
        '/api/local-share/v1/prepare',
        {
          sender: {
            id: this.identity.id,
            alias: this.identity.alias,
            fingerprint: this.identity.fingerprint
          },
          manifest: packaged.manifest
        }
      )
      if (prepared.statusCode !== 202) throw new Error('对方未能创建接收请求。')
      const expectedPairingCode = pairingCode(
        this.identity.fingerprint,
        device.fingerprint,
        prepared.value.requestId
      )
      if (prepared.value.pairingCode !== expectedPairingCode)
        throw new Error('设备配对码校验失败，连接可能已被拦截。')
      this.updateTransfer(transferId, { pairingCode: expectedPairingCode })
      let token: string | null = null
      for (let attempt = 0; attempt < 240; attempt++) {
        const status = await this.requestJson<{ status: string; uploadToken?: string }>(
          device,
          'GET',
          `/api/local-share/v1/request/${encodeURIComponent(prepared.value.requestId)}`
        )
        if (status.value.status === 'accepted' && status.value.uploadToken) {
          token = status.value.uploadToken
          break
        }
        if (['rejected', 'cancelled'].includes(status.value.status))
          throw new Error('对方拒绝了共享请求。')
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      if (!token) throw new Error('等待对方确认超时。')
      this.updateTransfer(transferId, { status: 'transferring', progress: 0.2 })
      const uploaded = await this.requestBuffer<{ success: boolean }>(
        device,
        'POST',
        `/api/local-share/v1/upload/${encodeURIComponent(prepared.value.requestId)}`,
        packaged.buffer,
        { authorization: `Bearer ${token}`, 'x-package-sha256': packaged.packageHash }
      )
      if (!uploaded.value.success) throw new Error('对方没有完整接收 Skill。')
      this.revisions.capture(skillDirectory, {
        direction: 'sent',
        status: 'completed',
        deviceId: device.id,
        deviceAlias: device.alias,
        parentHash: inferredParentHash
      })
      this.updateTransfer(transferId, { status: 'completed', progress: 1 })
    } catch (error) {
      this.revisions.capture(skillDirectory, {
        direction: 'sent',
        status: 'failed',
        deviceId: device.id,
        deviceAlias: device.alias,
        parentHash: inferredParentHash
      })
      this.updateTransfer(transferId, { status: 'failed', progress: 0 })
      throw error
    }
    return this.getState()
  }

  inspectInbox(
    itemId: string,
    destination?: string
  ): {
    relationship: 'new' | 'identical' | 'update' | 'conflict'
    difference: SkillDifference | null
  } {
    const item = this.inbox.find((candidate) => candidate.id === itemId)
    if (!item) throw new Error('找不到待处理的 Skill。')
    if (!destination || !existsSync(destination)) return { relationship: 'new', difference: null }
    const local = buildSkillManifest(destination)
    const difference = compareSkillManifests(local, item.manifest)
    if (difference.status === 'identical') return { relationship: 'identical', difference }
    if (item.manifest.parentHash === local.contentHash)
      return { relationship: 'update', difference }
    return { relationship: 'conflict', difference }
  }

  applyInbox(itemId: string, destination: string): LocalShareState {
    const item = this.inbox.find((candidate) => candidate.id === itemId)
    if (!item) throw new Error('找不到待处理的 Skill。')
    if (existsSync(destination)) {
      this.revisions.capture(destination, {
        direction: 'applied',
        status: 'completed',
        deviceId: null,
        deviceAlias: null,
        targetPath: destination,
        detail: '应用接收版本前的本地快照'
      })
    }
    this.revisions.restore(item.eventId, destination)
    this.revisions.capture(destination, {
      direction: 'applied',
      status: 'completed',
      deviceId: item.sender.id,
      deviceAlias: item.sender.alias,
      targetPath: destination,
      parentHash: item.manifest.parentHash
    })
    item.status = 'applied'
    this.saveInbox()
    this.emit()
    return this.getState()
  }

  restoreHistory(eventId: string, destination: string): LocalShareState {
    if (existsSync(destination)) {
      this.revisions.capture(destination, {
        direction: 'restored',
        status: 'completed',
        deviceId: null,
        deviceAlias: null,
        targetPath: destination,
        detail: '恢复历史版本前的快照'
      })
    }
    this.revisions.restore(eventId, destination)
    this.revisions.capture(destination, {
      direction: 'restored',
      status: 'completed',
      deviceId: null,
      deviceAlias: null,
      targetPath: destination
    })
    this.emit()
    return this.getState()
  }

  restoreHistoryToRecordedTarget(eventId: string): LocalShareState {
    const event = this.revisions.listHistory().find((item) => item.id === eventId)
    if (!event?.targetPath) throw new Error('这条记录没有可恢复的原目标位置。')
    return this.restoreHistory(eventId, event.targetPath)
  }

  private async startServer(): Promise<void> {
    const server = https.createServer(
      {
        key: this.identity.privateKey,
        cert: this.identity.certificate,
        requestCert: true,
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      (request, response) => void this.handleRequest(request, response)
    )
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error): void => {
        server.close()
        reject(error)
      }
      server.once('error', fail)
      server.listen(this.preferredPort, '0.0.0.0', () => {
        server.removeListener('error', fail)
        resolve()
      })
    })
    this.server = server
  }

  private async handleRequest(
    request: import('node:http').IncomingMessage,
    response: import('node:http').ServerResponse
  ): Promise<void> {
    try {
      const address = request.socket.remoteAddress?.replace(/^::ffff:/, '') ?? ''
      if (!isPrivateNetworkAddress(address))
        return this.respond(response, 403, { error: 'forbidden-network' })
      const peer = (request.socket as TLSSocket).getPeerCertificate()
      const peerFingerprint = normalizeFingerprint(peer.fingerprint256 ?? '')
      if (!peerFingerprint)
        return this.respond(response, 401, { error: 'client-certificate-required' })
      const url = new URL(request.url ?? '/', 'https://local')

      if (request.method === 'GET' && url.pathname === '/api/local-share/v1/info') {
        return this.respond(response, 200, {
          id: this.identity.id,
          alias: this.identity.alias,
          fingerprint: this.identity.fingerprint,
          protocol: 'sookool-local-share/1'
        })
      }

      if (request.method === 'POST' && url.pathname === '/api/local-share/v1/prepare') {
        this.purgeExpiredRequests()
        if (
          this.requests.size >= MAX_PENDING_REQUESTS ||
          !this.allowPrepareAttempt(peerFingerprint) ||
          [...this.requests.values()].filter(
            (pending) =>
              pending.peerFingerprint === peerFingerprint &&
              (pending.status === 'pending' || pending.status === 'accepted')
          ).length >= MAX_PENDING_PER_DEVICE
        ) {
          return this.respond(response, 429, { error: 'too-many-requests' })
        }
        const body = await this.readJson<{
          sender: { id: string; alias: string; fingerprint: string }
          manifest: SkillManifest
        }>(request)
        if (
          !body.sender ||
          typeof body.sender.id !== 'string' ||
          !body.sender.id ||
          typeof body.sender.alias !== 'string' ||
          typeof body.sender.fingerprint !== 'string'
        ) {
          return this.respond(response, 422, { error: 'invalid-sender' })
        }
        assertValidSkillManifest(body.manifest)
        if (normalizeFingerprint(body.sender.fingerprint) !== peerFingerprint)
          return this.respond(response, 401, { error: 'identity-mismatch' })
        const requestId = crypto.randomUUID()
        const device: LocalShareDevice = {
          id: body.sender.id,
          alias: body.sender.alias.slice(0, 80),
          address,
          port: 0,
          fingerprint: peerFingerprint,
          trusted: this.trustedDevices.isTrusted(body.sender.id, peerFingerprint),
          lastSeenAt: new Date().toISOString()
        }
        const pending: PendingRequest = {
          id: requestId,
          device,
          manifest: body.manifest,
          pairingCode: pairingCode(this.identity.fingerprint, peerFingerprint, requestId),
          createdAt: new Date().toISOString(),
          status: 'pending',
          uploadToken: null,
          peerFingerprint,
          expiresAt: new Date(Date.now() + REQUEST_TTL_MS).toISOString()
        }
        this.requests.set(requestId, pending)
        if (device.trusted) {
          pending.status = 'accepted'
          pending.uploadToken = randomBytes(32).toString('base64url')
        }
        this.emit()
        return this.respond(response, 202, { requestId, pairingCode: pending.pairingCode })
      }

      const statusMatch = url.pathname.match(/^\/api\/local-share\/v1\/request\/([^/]+)$/)
      if (request.method === 'GET' && statusMatch) {
        const pending = this.requests.get(decodeURIComponent(statusMatch[1]))
        if (!pending || pending.peerFingerprint !== peerFingerprint)
          return this.respond(response, 404, { error: 'not-found' })
        if (this.isRequestExpired(pending)) {
          pending.status = 'cancelled'
          pending.uploadToken = null
          return this.respond(response, 410, { status: 'cancelled' })
        }
        return this.respond(response, 200, {
          status: pending.status,
          uploadToken: pending.status === 'accepted' ? pending.uploadToken : undefined
        })
      }

      const uploadMatch = url.pathname.match(/^\/api\/local-share\/v1\/upload\/([^/]+)$/)
      if (request.method === 'POST' && uploadMatch) {
        const pending = this.requests.get(decodeURIComponent(uploadMatch[1]))
        const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
        if (
          !pending ||
          pending.peerFingerprint !== peerFingerprint ||
          pending.status !== 'accepted' ||
          this.isRequestExpired(pending) ||
          !token ||
          token !== pending.uploadToken
        ) {
          return this.respond(response, 401, { error: 'invalid-session' })
        }
        pending.status = 'uploading'
        pending.uploadToken = null
        const transferId = `receive:${pending.id}`
        this.activeTransfers.push({
          id: transferId,
          direction: 'receive',
          skillName: pending.manifest.name,
          deviceAlias: pending.device.alias,
          status: 'transferring',
          progress: 0.2
        })
        this.emit()
        try {
          const buffer = await this.readBuffer(request, 512 * 1024 * 1024)
          const expectedPackageHash = request.headers['x-package-sha256']
          const actualPackageHash = createHash('sha256').update(buffer).digest('hex')
          if (expectedPackageHash !== actualPackageHash) throw new Error('package-hash-mismatch')
          const temporary = join(this.revisions.stagingPath, `receive-${pending.id}`)
          rmSync(temporary, { recursive: true, force: true })
          mkdirSync(temporary, { recursive: true })
          try {
            const manifest = extractSharePackage(buffer, temporary, pending.manifest)
            const event = this.revisions.capture(temporary, {
              direction: 'received',
              status: 'completed',
              deviceId: pending.device.id,
              deviceAlias: pending.device.alias,
              parentHash: manifest.parentHash
            })
            this.inbox.push({
              id: crypto.randomUUID(),
              eventId: event.id,
              sender: {
                id: pending.device.id,
                alias: pending.device.alias,
                fingerprint: pending.device.fingerprint
              },
              manifest,
              packagePath: event.objectPath,
              receivedAt: new Date().toISOString(),
              status: 'ready'
            })
            this.saveInbox()
            pending.status = 'uploaded'
            this.updateTransfer(transferId, { status: 'completed', progress: 1 })
            return this.respond(response, 200, { success: true })
          } finally {
            rmSync(temporary, { recursive: true, force: true })
          }
        } catch (error) {
          pending.status = 'cancelled'
          this.updateTransfer(transferId, { status: 'failed', progress: 0 })
          if (error instanceof Error && error.message === 'package-hash-mismatch')
            return this.respond(response, 422, { error: error.message })
          throw error
        }
      }
      this.respond(response, 404, { error: 'not-found' })
    } catch (error) {
      this.respond(response, 400, { error: String(error).replace(/^Error:\s*/, '') })
    }
  }

  private async requestJson<T>(
    device: LocalShareDevice,
    method: string,
    path: string,
    body?: unknown
  ): Promise<JsonResponse<T>> {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
    return this.performRequest<T>(
      device,
      method,
      path,
      payload,
      payload ? { 'content-type': 'application/json' } : undefined
    )
  }

  private requestBuffer<T>(
    device: LocalShareDevice,
    method: string,
    path: string,
    body: Buffer,
    headers?: Record<string, string>
  ): Promise<JsonResponse<T>> {
    return this.performRequest<T>(device, method, path, body, {
      ...headers,
      'content-type': 'application/zip'
    })
  }

  private performRequest<T>(
    device: LocalShareDevice,
    method: string,
    path: string,
    body?: Buffer,
    headers: Record<string, string> = {}
  ): Promise<JsonResponse<T>> {
    return new Promise((resolve, reject) => {
      const options: RequestOptions = {
        host: device.address,
        port: device.port,
        path,
        method,
        key: this.identity.privateKey,
        cert: this.identity.certificate,
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
        agent: false,
        headers: { ...headers, ...(body ? { 'content-length': String(body.byteLength) } : {}) }
      }
      const request = https.request(options, (response) => {
        const certificate = (response.socket as TLSSocket).getPeerCertificate()
        if (
          normalizeFingerprint(certificate.fingerprint256 ?? '') !==
          normalizeFingerprint(device.fingerprint)
        ) {
          response.destroy(new Error('设备证书指纹与发现记录不一致。'))
          return
        }
        const chunks: Buffer[] = []
        let responseBytes = 0
        response.on('data', (chunk: Buffer) => {
          responseBytes += chunk.byteLength
          if (responseBytes > MAX_JSON_RESPONSE_BYTES) {
            response.destroy(new Error('设备响应超过安全限制。'))
            return
          }
          chunks.push(chunk)
        })
        response.on('error', reject)
        response.on('end', () => {
          try {
            const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T
            if ((response.statusCode ?? 500) >= 400)
              return reject(
                new Error((value as { error?: string }).error || `HTTP ${response.statusCode}`)
              )
            resolve({ statusCode: response.statusCode ?? 0, value })
          } catch (error) {
            reject(error)
          }
        })
      })
      const totalTimeoutMs = body
        ? Math.min(10 * 60_000, 30_000 + Math.ceil(body.byteLength / (256 * 1024)) * 1000)
        : REQUEST_TIMEOUT_MS
      const deadline = setTimeout(
        () => request.destroy(new Error('设备请求超过总时限。')),
        totalTimeoutMs
      )
      request.once('close', () => clearTimeout(deadline))
      request.on('error', reject)
      request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('设备响应超时。')))
      if (body) request.write(body)
      request.end()
    })
  }

  private performUnpinnedInfoRequest(
    address: string,
    port: number
  ): Promise<{ id: string; alias: string; fingerprint: string }> {
    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          host: address,
          port,
          path: '/api/local-share/v1/info',
          method: 'GET',
          key: this.identity.privateKey,
          cert: this.identity.certificate,
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          agent: false
        },
        (response) => {
          const certificate = (response.socket as TLSSocket).getPeerCertificate()
          const certificateFingerprint = normalizeFingerprint(certificate.fingerprint256 ?? '')
          const chunks: Buffer[] = []
          let responseBytes = 0
          response.on('data', (chunk: Buffer) => {
            responseBytes += chunk.byteLength
            if (responseBytes > MAX_JSON_RESPONSE_BYTES) {
              response.destroy(new Error('设备响应超过安全限制。'))
              return
            }
            chunks.push(chunk)
          })
          response.on('error', reject)
          response.on('end', () => {
            try {
              const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
                id: string
                alias: string
                fingerprint: string
              }
              if (
                !value.id ||
                !value.alias ||
                normalizeFingerprint(value.fingerprint) !== certificateFingerprint
              ) {
                throw new Error('设备身份信息与 HTTPS 证书不一致。')
              }
              resolve({ ...value, fingerprint: certificateFingerprint })
            } catch (error) {
              reject(error)
            }
          })
        }
      )
      const deadline = setTimeout(
        () => request.destroy(new Error('设备请求超过总时限。')),
        REQUEST_TIMEOUT_MS
      )
      request.once('close', () => clearTimeout(deadline))
      request.on('error', reject)
      request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('设备响应超时。')))
      request.end()
    })
  }

  private readJson<T>(request: import('node:http').IncomingMessage): Promise<T> {
    return this.readBuffer(request, 64 * 1024).then(
      (buffer) => JSON.parse(buffer.toString('utf8')) as T
    )
  }

  private readBuffer(request: import('node:http').IncomingMessage, limit: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let bytes = 0
      request.on('data', (chunk: Buffer) => {
        bytes += chunk.byteLength
        if (bytes > limit) {
          reject(new Error('请求内容超过安全限制。'))
          request.destroy()
        } else chunks.push(chunk)
      })
      request.on('end', () => resolve(Buffer.concat(chunks)))
      request.on('error', reject)
    })
  }

  private respond(
    response: import('node:http').ServerResponse,
    statusCode: number,
    value: unknown
  ): void {
    if (response.headersSent) return
    const body = Buffer.from(JSON.stringify(value))
    response.writeHead(statusCode, {
      'content-type': 'application/json',
      'content-length': body.byteLength
    })
    response.end(body)
  }

  private updateTransfer(
    id: string,
    patch: Partial<LocalShareState['activeTransfers'][number]>
  ): void {
    const transfer = this.activeTransfers.find((item) => item.id === id)
    if (transfer) Object.assign(transfer, patch)
    this.emit()
    if (transfer && ['completed', 'cancelled', 'failed'].includes(transfer.status))
      this.scheduleTransferCleanup(id)
    if (this.pendingShutdown && !this.hasActiveTransfer())
      setImmediate(() => {
        if (this.pendingShutdown && !this.hasActiveTransfer()) void this.disable()
      })
  }

  private hasActiveTransfer(): boolean {
    return this.activeTransfers.some((transfer) =>
      ['waiting', 'transferring'].includes(transfer.status)
    )
  }

  private isRequestExpired(request: PendingRequest): boolean {
    return Date.now() >= Date.parse(request.expiresAt)
  }

  private purgeExpiredRequests(): void {
    for (const [id, request] of this.requests) {
      if (this.isRequestExpired(request)) this.requests.delete(id)
    }
  }

  private allowPrepareAttempt(fingerprint: string): boolean {
    const cutoff = Date.now() - 60_000
    const recent = (this.prepareAttempts.get(fingerprint) ?? []).filter((time) => time > cutoff)
    if (recent.length >= MAX_PREPARES_PER_MINUTE) {
      this.prepareAttempts.set(fingerprint, recent)
      return false
    }
    recent.push(Date.now())
    this.prepareAttempts.set(fingerprint, recent)
    return true
  }

  private closeServer(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.server
      this.server = null
      if (!server) return resolve()
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }

  private loadInbox(): LocalShareInboxItem[] {
    const path = join(this.rootPath, 'inbox.json')
    if (!existsSync(path)) return []
    try {
      const value = JSON.parse(readFileSync(path, 'utf8')) as unknown
      return Array.isArray(value)
        ? (value as LocalShareInboxItem[]).filter(
            (item) => item?.id && item?.manifest?.contentHash && existsSync(item.packagePath)
          )
        : []
    } catch {
      return []
    }
  }

  private saveInbox(): void {
    const path = join(this.rootPath, 'inbox.json')
    const temporaryPath = `${path}.tmp`
    writeFileSync(temporaryPath, `${JSON.stringify(this.inbox, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporaryPath, path)
  }

  private emit(): void {
    this.onChange(this.getState())
  }

  private rebuildDevices(): void {
    this.devices = new Map(this.discoveredDevices)
    for (const [id, device] of this.manualDevices) this.devices.set(id, device)
  }

  private scheduleTransferCleanup(id: string): void {
    const existing = this.transferCleanupTimers.get(id)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.transferCleanupTimers.delete(id)
      this.activeTransfers = this.activeTransfers.filter((transfer) => transfer.id !== id)
      this.emit()
    }, this.completedTransferRetentionMs)
    timer.unref()
    this.transferCleanupTimers.set(id, timer)
  }
}
