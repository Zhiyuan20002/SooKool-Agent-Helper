import { createHash, randomUUID, X509Certificate } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { generate } from 'selfsigned'

export interface DeviceIdentity {
  id: string
  alias: string
  certificate: string
  privateKey: string
  fingerprint: string
}

interface SavedIdentity {
  id: string
  alias: string
  certificate: string
  privateKey: string
}

export function loadOrCreateDeviceIdentity(
  identityPath: string,
  alias = hostname()
): DeviceIdentity {
  mkdirSync(join(identityPath, '..'), { recursive: true })
  let saved: SavedIdentity
  if (existsSync(identityPath)) {
    saved = JSON.parse(readFileSync(identityPath, 'utf8')) as SavedIdentity
  } else {
    const certificates = generate([{ name: 'commonName', value: `SooKool Local Share ${alias}` }], {
      algorithm: 'sha256',
      days: 3650,
      keySize: 2048,
      extensions: [
        { name: 'basicConstraints', cA: true },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: true },
        { name: 'extKeyUsage', serverAuth: true, clientAuth: true }
      ]
    })
    saved = {
      id: randomUUID(),
      alias: alias.trim() || 'SooKool 设备',
      certificate: certificates.cert,
      privateKey: certificates.private
    }
    const temporaryPath = `${identityPath}.tmp`
    writeFileSync(temporaryPath, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporaryPath, identityPath)
  }
  const certificate = new X509Certificate(saved.certificate)
  return { ...saved, fingerprint: normalizeFingerprint(certificate.fingerprint256) }
}

export function normalizeFingerprint(value: string): string {
  return value.replaceAll(':', '').toLowerCase()
}

export function pairingCode(...parts: string[]): string {
  const hex = createHash('sha256')
    .update([...parts].sort().join(':'))
    .digest('hex')
    .slice(0, 12)
  return String(Number.parseInt(hex, 16) % 1_000_000).padStart(6, '0')
}
