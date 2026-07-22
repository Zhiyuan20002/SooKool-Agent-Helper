import AdmZip from 'adm-zip'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { basename, join } from 'node:path'
import { replaceDirectoryAtomically } from '../skills/skill-filesystem.ts'
import type { LocalShareHistoryEvent } from './local-share-types.ts'
import {
  assertSafeRelativePath,
  buildSkillManifest,
  createSharePackage,
  extractSharePackage
} from './skill-package.ts'

interface CaptureMetadata {
  direction: LocalShareHistoryEvent['direction']
  status: LocalShareHistoryEvent['status']
  deviceId: string | null
  deviceAlias: string | null
  targetPath?: string | null
  detail?: string
  parentHash?: string | null
}

export class RevisionStore {
  readonly rootPath: string
  readonly objectsPath: string
  readonly eventsPath: string
  readonly stagingPath: string

  constructor(rootPath: string) {
    this.rootPath = rootPath
    this.objectsPath = join(rootPath, 'objects')
    this.eventsPath = join(rootPath, 'events')
    this.stagingPath = join(rootPath, 'staging')
    ;[rootPath, this.objectsPath, this.eventsPath, this.stagingPath].forEach((path) =>
      mkdirSync(path, { recursive: true })
    )
  }

  capture(skillDirectory: string, metadata: CaptureMetadata): LocalShareHistoryEvent {
    const manifest = buildSkillManifest(skillDirectory, metadata.parentHash ?? null)
    const objectPath = join(this.objectsPath, `${manifest.contentHash}.zip`)
    const needsSecureArchive =
      !existsSync(objectPath) || !new AdmZip(objectPath).getEntry('manifest.json')
    if (needsSecureArchive) {
      const temporaryPath = `${objectPath}.${crypto.randomUUID()}.tmp`
      const packaged = createSharePackage(skillDirectory, metadata.parentHash ?? null)
      writeFileSync(temporaryPath, packaged.buffer, { mode: 0o600 })
      renameSync(temporaryPath, objectPath)
    }

    const createdAt = new Date().toISOString()
    const event: LocalShareHistoryEvent = {
      id: crypto.randomUUID(),
      direction: metadata.direction,
      status: metadata.status,
      skillName: manifest.name || basename(skillDirectory),
      contentHash: manifest.contentHash,
      parentHash: manifest.parentHash,
      deviceId: metadata.deviceId,
      deviceAlias: metadata.deviceAlias,
      objectPath,
      targetPath: metadata.targetPath ?? null,
      bytes: manifest.totalBytes,
      createdAt,
      completedAt: createdAt,
      detail: metadata.detail
    }
    this.writeEvent(event)
    return event
  }

  addEvent(event: LocalShareHistoryEvent): void {
    this.writeEvent(event)
  }

  listHistory(): LocalShareHistoryEvent[] {
    return readdirSync(this.eventsPath)
      .filter((name) => name.endsWith('.json'))
      .flatMap((name) => {
        try {
          return [
            JSON.parse(readFileSync(join(this.eventsPath, name), 'utf8')) as LocalShareHistoryEvent
          ]
        } catch {
          return []
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  restore(eventId: string, destination: string): void {
    const event = this.listHistory().find((item) => item.id === eventId)
    if (!event || !existsSync(event.objectPath)) throw new Error('找不到这条历史记录的技能包。')
    const extractionPath = join(this.stagingPath, `restore-${crypto.randomUUID()}`)
    mkdirSync(extractionPath, { recursive: true })
    try {
      const archive = new AdmZip(event.objectPath)
      if (archive.getEntry('manifest.json')) {
        extractSharePackage(readFileSync(event.objectPath), extractionPath)
      } else {
        for (const entry of archive.getEntries())
          assertSafeRelativePath(entry.entryName.replace(/\/$/, ''))
        archive.extractAllTo(extractionPath, true, false)
        buildSkillManifest(extractionPath)
      }
      replaceDirectoryAtomically(extractionPath, destination)
    } finally {
      rmSync(extractionPath, { recursive: true, force: true })
    }
  }

  private writeEvent(event: LocalShareHistoryEvent): void {
    const path = join(this.eventsPath, `${event.id}.json`)
    const temporaryPath = `${path}.tmp`
    writeFileSync(temporaryPath, `${JSON.stringify(event, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    })
    renameSync(temporaryPath, path)
  }
}
