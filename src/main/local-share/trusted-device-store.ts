import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface TrustedDevice {
  id: string
  alias: string
  fingerprint: string
  trustedAt: string
}

export class TrustedDeviceStore {
  private readonly path: string

  constructor(path: string) {
    this.path = path
  }

  list(): TrustedDevice[] {
    if (!existsSync(this.path)) return []
    try {
      const value = JSON.parse(readFileSync(this.path, 'utf8')) as unknown
      return Array.isArray(value) ? (value as TrustedDevice[]) : []
    } catch {
      return []
    }
  }

  isTrusted(id: string, fingerprint: string): boolean {
    return this.list().some((device) => device.id === id && device.fingerprint === fingerprint)
  }

  trust(device: Pick<TrustedDevice, 'id' | 'alias' | 'fingerprint'>): void {
    const devices = this.list().filter((item) => item.id !== device.id)
    devices.push({ ...device, trustedAt: new Date().toISOString() })
    this.save(devices)
  }

  remove(id: string): void {
    this.save(this.list().filter((device) => device.id !== id))
  }

  private save(devices: TrustedDevice[]): void {
    mkdirSync(join(this.path, '..'), { recursive: true })
    const temporaryPath = `${this.path}.tmp`
    writeFileSync(temporaryPath, `${JSON.stringify(devices, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporaryPath, this.path)
  }
}
