import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { RoutingAppType } from '../../shared/routing-types.ts'

export interface RoutingLivePaths {
  claudeSettingsPath: string
  codexAuthPath: string
  codexConfigPath: string
  geminiEnvPath: string
  geminiSettingsPath: string
  backupDir: string
  ccSwitchSettingsPath?: string
}

export interface LiveSwitchTarget {
  appType: RoutingAppType
  providerKey: string
  providerId: string
  source: 'cc-switch' | 'sookool'
}

export interface LiveSwitchTransaction {
  beginStateCommit(): void
  commit(): void
  rollback(): void
}

export function updateCcSwitchCurrentSetting(
  path: string,
  appType: RoutingAppType,
  providerId: string
): () => void {
  const previous = snapshot(path)
  const settings = readJsonObject(path)
  settings[`current_provider_${appType.replace('-', '_')}`] = providerId
  atomicWrite(path, `${JSON.stringify(settings, null, 2)}\n`)
  return () => restore(previous)
}

interface FileSnapshot { path: string; existed: boolean; content?: Buffer }

export function switchLiveConfig(
  appType: RoutingAppType,
  settings: Record<string, unknown>,
  paths: RoutingLivePaths,
  target?: LiveSwitchTarget
): LiveSwitchTransaction {
  const writes = buildWrites(appType, settings, paths, target)
  mkdirSync(paths.backupDir, { recursive: true, mode: 0o700 })
  chmodSync(paths.backupDir, 0o700)
  pruneBackups(paths.backupDir, 10)
  const snapshots = writes.map(({ path }) => snapshot(path))
  const operationDir = join(paths.backupDir, `.pending-${Date.now()}-${randomUUID()}`)
  mkdirSync(operationDir, { mode: 0o700 })
  const manifestPath = join(operationDir, 'manifest.json')
  const manifest = {
    status: 'prepared',
    createdAt: new Date().toISOString(),
    appType,
    target,
    files: snapshots.map((item, index) => ({ path: item.path, existed: item.existed, backup: item.existed ? `${index}.bak` : null }))
  }
  snapshots.forEach((item, index) => {
    if (item.existed) writeFileSync(join(operationDir, `${index}.bak`), item.content ?? Buffer.alloc(0), { mode: 0o600 })
  })
  writeManifest(manifestPath, manifest)
  try {
    for (const write of writes) atomicWrite(write.path, write.content)
    manifest.status = 'live-written'
    writeManifest(manifestPath, manifest)
  } catch (error) {
    for (const item of snapshots) restore(item)
    manifest.status = 'rolled-back'
    writeManifest(manifestPath, manifest)
    throw error
  }
  return {
    beginStateCommit: () => { manifest.status = 'state-committing'; writeManifest(manifestPath, manifest) },
    commit: () => { manifest.status = 'committed'; writeManifest(manifestPath, manifest) },
    rollback: () => {
      for (const item of snapshots) restore(item)
      manifest.status = 'rolled-back'
      writeManifest(manifestPath, manifest)
    }
  }
}

export function recoverLiveSwitchTransactions(
  paths: RoutingLivePaths,
  finalizeState: (target: LiveSwitchTarget) => void
): void {
  if (!existsSync(paths.backupDir)) return
  for (const entry of readdirSync(paths.backupDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const directory = join(paths.backupDir, entry.name)
    const manifestPath = join(directory, 'manifest.json')
    if (!existsSync(manifestPath)) {
      if (entry.name.startsWith('.pending-')) rmSync(directory, { recursive: true, force: true })
      continue
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      status: string
      target?: LiveSwitchTarget
      files: Array<{ path: string; existed: boolean; backup: string | null }>
    }
    if (manifest.status === 'state-committing' && manifest.target) {
      finalizeState(manifest.target)
      manifest.status = 'committed'
      writeManifest(manifestPath, manifest)
    } else if (manifest.status === 'prepared' || manifest.status === 'live-written') {
      for (const file of manifest.files) restore({
        path: file.path,
        existed: file.existed,
        content: file.backup ? readFileSync(join(directory, file.backup)) : undefined
      })
      manifest.status = 'rolled-back'
      writeManifest(manifestPath, manifest)
    }
  }
}

function buildWrites(
  appType: RoutingAppType,
  settings: Record<string, unknown>,
  paths: RoutingLivePaths,
  target?: LiveSwitchTarget
): Array<{ path: string; content: string }> {
  const ccSwitchWrite = target?.source === 'cc-switch' && paths.ccSwitchSettingsPath
    ? [{
        path: paths.ccSwitchSettingsPath,
        content: `${JSON.stringify({
          ...readJsonObject(paths.ccSwitchSettingsPath),
          [`current_provider_${appType.replace('-', '_')}`]: target.providerId
        }, null, 2)}\n`
      }]
    : []
  if (appType === 'claude') {
    const sanitized = structuredClone(settings)
    delete sanitized.meta
    delete sanitized.icon
    delete sanitized.iconColor
    const existing = readJsonObject(paths.claudeSettingsPath)
    const merged = { ...existing, ...sanitized }
    if (isObject(existing.env) || isObject(sanitized.env)) {
      merged.env = mergeProviderEnv(
        isObject(existing.env) ? existing.env : {},
        isObject(sanitized.env) ? sanitized.env : {},
        [
          'ANTHROPIC_AUTH_TOKEN',
          'ANTHROPIC_API_KEY',
          'ANTHROPIC_BASE_URL',
          'ANTHROPIC_MODEL',
          'ANTHROPIC_DEFAULT_HAIKU_MODEL',
          'ANTHROPIC_DEFAULT_SONNET_MODEL',
          'ANTHROPIC_DEFAULT_OPUS_MODEL',
          'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
          'API_TIMEOUT_MS',
          'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'
        ]
      )
    }
    return [{ path: paths.claudeSettingsPath, content: `${JSON.stringify(merged, null, 2)}\n` }, ...ccSwitchWrite]
  }
  if (appType === 'codex') {
    const auth = { ...readJsonObject(paths.codexAuthPath), ...(isObject(settings.auth) ? settings.auth : {}) }
    const config = patchCodexConfig(
      existsSync(paths.codexConfigPath) ? readFileSync(paths.codexConfigPath, 'utf8') : '',
      typeof settings.config === 'string' ? settings.config : ''
    )
    return [
      { path: paths.codexAuthPath, content: `${JSON.stringify(auth, null, 2)}\n` },
      { path: paths.codexConfigPath, content: config.endsWith('\n') ? config : `${config}\n` },
      ...ccSwitchWrite
    ]
  }
  if (appType === 'gemini') {
    const envText = patchEnvText(
      existsSync(paths.geminiEnvPath) ? readFileSync(paths.geminiEnvPath, 'utf8') : '',
      isObject(settings.env) ? settings.env : {},
      ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GEMINI_BASE_URL', 'GEMINI_MODEL']
    )
    const existing = readJsonObject(paths.geminiSettingsPath)
    const config = isObject(settings.config) ? { ...existing, ...settings.config } : existing
    return [
      { path: paths.geminiEnvPath, content: envText },
      { path: paths.geminiSettingsPath, content: `${JSON.stringify(config, null, 2)}\n` },
      ...ccSwitchWrite
    ]
  }
  throw new Error(`尚不支持切换 ${appType} 的实时配置`)
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temporaryPath = `${path}.tmp-${randomUUID()}`
  try {
    writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    chmodSync(temporaryPath, 0o600)
    renameSync(temporaryPath, path)
    chmodSync(path, 0o600)
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
    throw error
  }
}

function writeManifest(path: string, value: unknown): void {
  atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`)
}

function snapshot(path: string): FileSnapshot {
  const existed = existsSync(path)
  return { path, existed, content: existed ? readFileSync(path) : undefined }
}

function restore(item: FileSnapshot): void {
  if (item.existed) {
    atomicWrite(item.path, (item.content ?? Buffer.alloc(0)).toString('utf8'))
  } else if (existsSync(item.path)) {
    unlinkSync(item.path)
  }
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {}
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (!isObject(parsed)) throw new Error(`配置文件不是 JSON 对象: ${path}`)
  return parsed
}

function patchEnvText(existing: string, next: Record<string, unknown>, providerKeys: string[]): string {
  const owned = new Set([...providerKeys, ...Object.keys(next)])
  const lines = existing.split(/(?<=\n)/).filter((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    return !match || !owned.has(match[1])
  })
  const additions = Object.entries(next)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => `${key}=${quoteEnv(value)}\n`)
  return `${lines.join('').replace(/\n?$/, '\n')}${additions.join('')}`
}

function mergeProviderEnv(
  existing: Record<string, unknown>,
  next: Record<string, unknown>,
  providerKeys: string[]
): Record<string, unknown> {
  const merged = { ...existing }
  for (const key of providerKeys) delete merged[key]
  return { ...merged, ...next }
}

function quoteEnv(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error('环境变量值不能包含换行符')
  return /^[A-Za-z0-9_./:@-]*$/.test(value) ? value : `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function patchCodexConfig(existing: string, desired: string): string {
  if (!desired.trim()) return existing
  const topLevelKeys = new Set(['model_provider', 'model', 'model_reasoning_effort', 'disable_response_storage', 'model_context_window', 'model_auto_compact_token_limit'])
  const providerName = desired.match(/^\s*model_provider\s*=\s*"([^"]+)"/m)?.[1]
  const desiredSection = providerName ? `model_providers.${providerName}` : undefined
  const strip = (text: string): string[] => {
    let section = ''
    return text.split(/\r?\n/).filter((line) => {
      const heading = line.match(/^\s*\[([^\]]+)]/)
      if (heading) section = heading[1]
      if (desiredSection && (section === desiredSection || section.startsWith(`${desiredSection}.`))) return false
      const key = !section ? line.match(/^\s*([A-Za-z0-9_]+)\s*=/)?.[1] : undefined
      return !key || !topLevelKeys.has(key)
    })
  }
  let desiredCurrentSection = ''
  const desiredLines = desired.split(/\r?\n/).filter((line) => {
    const heading = line.match(/^\s*\[([^\]]+)]/)
    if (heading) desiredCurrentSection = heading[1]
    if (desiredCurrentSection.startsWith('model_providers.')) return true
    const key = line.match(/^\s*([A-Za-z0-9_]+)\s*=/)?.[1]
    return !key || topLevelKeys.has(key)
  })
  const preserved = strip(existing).join('\n').trim()
  return `${preserved ? `${preserved}\n\n` : ''}${desiredLines.join('\n').trim()}\n`
}

function pruneBackups(directory: string, keep: number): void {
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const manifestPath = join(directory, name, 'manifest.json')
      if (!existsSync(manifestPath)) return false
      try {
        const status = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { status?: string }).status
        return status === 'committed' || status === 'rolled-back'
      } catch {
        return false
      }
    })
    .sort()
  for (const name of entries.slice(0, Math.max(0, entries.length - keep + 1))) {
    rmSync(join(directory, name), { recursive: true, force: true })
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
