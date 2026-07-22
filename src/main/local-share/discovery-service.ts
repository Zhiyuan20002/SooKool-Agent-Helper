import dgram, { type RemoteInfo, type Socket } from 'node:dgram'
import { isIP } from 'node:net'
import type { DeviceIdentity } from './device-identity'
import type { LocalShareDevice } from './local-share-types'

const MULTICAST_ADDRESS = '239.255.83.75'
const DISCOVERY_PORT = 53319
const DEVICE_TTL_MS = 12_000

interface DiscoveryPacket {
  protocol: 'sookool-local-share/1'
  type: 'announce' | 'response'
  id: string
  alias: string
  port: number
  fingerprint: string
}

export function isPrivateNetworkAddress(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, '')
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split('.').map(Number)
    return (
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 169 && b === 254)
    )
  }
  return (
    normalized === '::1' ||
    normalized.toLowerCase().startsWith('fe80:') ||
    normalized.toLowerCase().startsWith('fd') ||
    normalized.toLowerCase().startsWith('fc')
  )
}

export class DiscoveryService {
  private socket: Socket | null = null
  private announceTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly devices = new Map<string, LocalShareDevice>()
  private readonly identity: DeviceIdentity
  private readonly httpsPort: number
  private readonly isTrusted: (id: string, fingerprint: string) => boolean
  private readonly onChange: (devices: LocalShareDevice[]) => void

  constructor(
    identity: DeviceIdentity,
    httpsPort: number,
    isTrusted: (id: string, fingerprint: string) => boolean,
    onChange: (devices: LocalShareDevice[]) => void
  ) {
    this.identity = identity
    this.httpsPort = httpsPort
    this.isTrusted = isTrusted
    this.onChange = onChange
  }

  async start(): Promise<void> {
    if (this.socket) return
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    this.socket = socket
    socket.on('message', (message, remote) => this.onMessage(message, remote))
    socket.on('error', () => this.stop())
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject)
      socket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
        socket.removeListener('error', reject)
        try {
          socket.addMembership(MULTICAST_ADDRESS)
          socket.setMulticastTTL(1)
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
    this.announce('announce')
    this.announceTimer = setInterval(() => this.announce('announce'), 3_000)
    this.cleanupTimer = setInterval(() => this.cleanup(), 3_000)
  }

  stop(): void {
    if (this.announceTimer) clearInterval(this.announceTimer)
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    this.announceTimer = null
    this.cleanupTimer = null
    this.socket?.close()
    this.socket = null
    this.devices.clear()
    this.onChange([])
  }

  private announce(type: DiscoveryPacket['type'], target?: RemoteInfo): void {
    if (!this.socket) return
    const packet: DiscoveryPacket = {
      protocol: 'sookool-local-share/1',
      type,
      id: this.identity.id,
      alias: this.identity.alias,
      port: this.httpsPort,
      fingerprint: this.identity.fingerprint
    }
    const message = Buffer.from(JSON.stringify(packet))
    this.socket.send(message, target?.port ?? DISCOVERY_PORT, target?.address ?? MULTICAST_ADDRESS)
  }

  private onMessage(message: Buffer, remote: RemoteInfo): void {
    if (!isPrivateNetworkAddress(remote.address) || message.byteLength > 4_096) return
    let packet: DiscoveryPacket
    try {
      packet = JSON.parse(message.toString('utf8')) as DiscoveryPacket
    } catch {
      return
    }
    if (packet.protocol !== 'sookool-local-share/1' || packet.id === this.identity.id) return
    if (
      !packet.id ||
      !packet.alias ||
      !packet.fingerprint ||
      !Number.isInteger(packet.port) ||
      packet.port < 1 ||
      packet.port > 65_535
    )
      return
    const device: LocalShareDevice = {
      id: packet.id,
      alias: packet.alias.slice(0, 80),
      address: remote.address.replace(/^::ffff:/, ''),
      port: packet.port,
      fingerprint: packet.fingerprint,
      trusted: this.isTrusted(packet.id, packet.fingerprint),
      lastSeenAt: new Date().toISOString()
    }
    this.devices.set(device.id, device)
    this.onChange(this.list())
    if (packet.type === 'announce') this.announce('response', remote)
  }

  private cleanup(): void {
    const cutoff = Date.now() - DEVICE_TTL_MS
    let changed = false
    for (const [id, device] of this.devices) {
      if (new Date(device.lastSeenAt).getTime() < cutoff) {
        this.devices.delete(id)
        changed = true
      }
    }
    if (changed) this.onChange(this.list())
  }

  private list(): LocalShareDevice[] {
    return [...this.devices.values()].sort((a, b) => a.alias.localeCompare(b.alias))
  }
}
