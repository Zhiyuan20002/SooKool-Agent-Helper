import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import AdmZip from 'adm-zip'
import {
  LOCAL_SHARE_PROTOCOL,
  type SkillDifference,
  type SkillDifferenceFile,
  type SkillManifest,
  type SkillManifestFile
} from './local-share-types.ts'

const MAX_FILES = 5_000
const MAX_FILE_BYTES = 128 * 1024 * 1024
const MAX_TOTAL_BYTES = 512 * 1024 * 1024
const ignoredNames = new Set(['.DS_Store', 'Thumbs.db'])
const ignoredDirectories = new Set(['.git', 'node_modules'])
const textExtensions = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.html',
  '.py',
  '.sh',
  '.toml',
  '.xml',
  '.svg',
  '.csv'
])
const sha256Pattern = /^[a-f0-9]{64}$/

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizePath(path: string): string {
  return path.split(sep).join('/')
}

function parseSkillMetadata(
  content: string,
  fallback: string
): { name: string; description: string } {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/)
  const body = frontmatter?.[1] ?? ''
  const value = (key: string): string =>
    body
      .match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]
      ?.trim()
      .replace(/^['"]|['"]$/g, '') ?? ''
  return { name: value('name') || fallback, description: value('description') }
}

export function buildSkillManifest(
  skillDirectory: string,
  parentHash: string | null = null
): SkillManifest {
  const root = resolve(skillDirectory)
  const files: SkillManifestFile[] = []
  let totalBytes = 0

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      if (ignoredNames.has(entry.name)) continue
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
      const path = join(directory, entry.name)
      const relativePath = normalizePath(relative(root, path))
      const stats = lstatSync(path)
      if (stats.isSymbolicLink()) throw new Error(`Skill 包不能包含符号链接：${relativePath}`)
      if (stats.isDirectory()) {
        visit(path)
        continue
      }
      if (!stats.isFile()) throw new Error(`Skill 包包含不支持的文件类型：${relativePath}`)
      if (stats.size > MAX_FILE_BYTES) throw new Error(`文件过大：${relativePath}`)
      totalBytes += stats.size
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Skill 包解压后不能超过 512 MB。')
      if (files.length >= MAX_FILES) throw new Error('Skill 包文件数量不能超过 5000。')
      const content = readFileSync(path)
      const extension = relativePath.includes('.')
        ? `.${relativePath.split('.').pop()?.toLowerCase()}`
        : ''
      files.push({
        path: relativePath,
        size: stats.size,
        sha256: sha256(content),
        text: textExtensions.has(extension),
        executable: (stats.mode & 0o111) !== 0
      })
    }
  }

  visit(root)
  if (!files.some((file) => file.path === 'SKILL.md')) throw new Error('Skill 目录缺少 SKILL.md。')
  const metadata = parseSkillMetadata(readFileSync(join(root, 'SKILL.md'), 'utf8'), basename(root))
  const contentHash = sha256(
    files
      .map(
        ({ path, size, sha256: hash, executable }) =>
          `${path}\0${size}\0${hash}\0${executable ? 'x' : '-'}`
      )
      .join('\n')
  )
  return {
    protocol: LOCAL_SHARE_PROTOCOL,
    name: metadata.name,
    description: metadata.description,
    contentHash,
    parentHash,
    totalBytes,
    createdAt: new Date().toISOString(),
    files
  }
}

export function compareSkillManifests(
  local: SkillManifest,
  incoming: SkillManifest
): SkillDifference {
  const localFiles = new Map(local.files.map((file) => [file.path, file]))
  const incomingFiles = new Map(incoming.files.map((file) => [file.path, file]))
  const files: SkillDifferenceFile[] = [...new Set([...localFiles.keys(), ...incomingFiles.keys()])]
    .sort()
    .map((path) => {
      const localFile = localFiles.get(path)
      const incomingFile = incomingFiles.get(path)
      const change = !localFile
        ? 'added'
        : !incomingFile
          ? 'deleted'
          : localFile.sha256 === incomingFile.sha256 &&
              localFile.executable === incomingFile.executable
            ? 'unchanged'
            : 'modified'
      return { path, change, local: localFile, incoming: incomingFile }
    })
  const summary = { added: 0, modified: 0, deleted: 0, unchanged: 0 }
  files.forEach((file) => summary[file.change]++)
  return {
    status: local.contentHash === incoming.contentHash ? 'identical' : 'changed',
    summary,
    files
  }
}

export function assertSafeRelativePath(path: string): void {
  if (
    !path ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    path.split(/[\\/]/).includes('..')
  ) {
    throw new Error(`Skill 包包含不安全路径：${path}`)
  }
}

export function assertValidSkillManifest(value: unknown): asserts value is SkillManifest {
  if (!value || typeof value !== 'object') throw new Error('Skill 清单格式无效。')
  const manifest = value as Partial<SkillManifest>
  if (
    manifest.protocol !== LOCAL_SHARE_PROTOCOL ||
    typeof manifest.name !== 'string' ||
    !manifest.name.trim() ||
    manifest.name.length > 200 ||
    typeof manifest.description !== 'string' ||
    manifest.description.length > 10_000 ||
    typeof manifest.contentHash !== 'string' ||
    !sha256Pattern.test(manifest.contentHash) ||
    (manifest.parentHash !== null &&
      (typeof manifest.parentHash !== 'string' || !sha256Pattern.test(manifest.parentHash))) ||
    !Number.isSafeInteger(manifest.totalBytes) ||
    (manifest.totalBytes ?? -1) < 0 ||
    (manifest.totalBytes ?? 0) > MAX_TOTAL_BYTES ||
    typeof manifest.createdAt !== 'string' ||
    Number.isNaN(Date.parse(manifest.createdAt)) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length === 0 ||
    manifest.files.length > MAX_FILES
  ) {
    throw new Error('Skill 清单格式无效。')
  }

  const paths = new Set<string>()
  let totalBytes = 0
  for (const file of manifest.files) {
    if (
      !file ||
      typeof file !== 'object' ||
      typeof file.path !== 'string' ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      file.size > MAX_FILE_BYTES ||
      typeof file.sha256 !== 'string' ||
      !sha256Pattern.test(file.sha256) ||
      typeof file.text !== 'boolean' ||
      typeof file.executable !== 'boolean'
    ) {
      throw new Error('Skill 清单包含无效文件记录。')
    }
    assertSafeRelativePath(file.path)
    if (paths.has(file.path)) throw new Error('Skill 清单包含重复文件路径。')
    paths.add(file.path)
    totalBytes += file.size
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Skill 清单总大小超过安全限制。')
  }
  if (!paths.has('SKILL.md') || totalBytes !== manifest.totalBytes)
    throw new Error('Skill 清单文件统计无效。')
  const contentHash = sha256(
    manifest.files
      .map(
        ({ path, size, sha256: hash, executable }) =>
          `${path}\0${size}\0${hash}\0${executable ? 'x' : '-'}`
      )
      .join('\n')
  )
  if (contentHash !== manifest.contentHash) throw new Error('Skill 清单内容哈希无效。')
}

export function createSharePackage(
  skillDirectory: string,
  parentHash: string | null = null
): {
  manifest: SkillManifest
  buffer: Buffer
  packageHash: string
} {
  const manifest = buildSkillManifest(skillDirectory, parentHash)
  const archive = new AdmZip()
  const root = resolve(skillDirectory)
  for (const file of manifest.files) {
    archive.addFile(`skill/${file.path}`, readFileSync(join(root, file.path)))
  }
  archive.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`))
  const buffer = archive.toBuffer()
  if (buffer.byteLength > MAX_TOTAL_BYTES) throw new Error('Skill 传输包不能超过 512 MB。')
  return { manifest, buffer, packageHash: sha256(buffer) }
}

export function extractSharePackage(
  buffer: Buffer,
  destination: string,
  expectedManifest?: SkillManifest
): SkillManifest {
  if (buffer.byteLength > MAX_TOTAL_BYTES) throw new Error('Skill 传输包不能超过 512 MB。')
  const archive = new AdmZip(buffer)
  const entries = archive.getEntries()
  if (!entries.length || entries.length > MAX_FILES + 2)
    throw new Error('Skill 传输包文件数量异常。')
  let declaredExpandedBytes = 0
  for (const entry of entries) {
    if (entry.isDirectory) continue
    const name = entry.entryName.replaceAll('\\', '/')
    const declaredSize = Number(entry.header.size)
    const entryLimit = name === 'manifest.json' ? 64 * 1024 : MAX_FILE_BYTES
    if (
      !Number.isFinite(declaredSize) ||
      declaredSize < 0 ||
      declaredSize > entryLimit ||
      (name === 'manifest.json' && declaredSize === 0)
    )
      throw new Error(`Skill 传输包文件声明大小异常：${name}`)
    declaredExpandedBytes += declaredSize
    if (declaredExpandedBytes > MAX_TOTAL_BYTES + 64 * 1024)
      throw new Error('Skill 包解压后的声明总大小超过安全限制。')
  }
  const manifestEntries = entries.filter(
    (entry) => entry.entryName.replaceAll('\\', '/') === 'manifest.json' && !entry.isDirectory
  )
  if (manifestEntries.length !== 1) throw new Error('Skill 传输包缺少有效清单。')
  const manifestData = manifestEntries[0].getData()
  if (manifestData.byteLength > 64 * 1024) throw new Error('Skill 清单超过安全限制。')
  const parsed = JSON.parse(manifestData.toString('utf8')) as unknown
  assertValidSkillManifest(parsed)
  const manifest = parsed
  if (expectedManifest && JSON.stringify(manifest) !== JSON.stringify(expectedManifest))
    throw new Error('Skill 传输包清单与已确认内容不一致。')

  const expectedArchivePaths = new Set(manifest.files.map((file) => `skill/${file.path}`))
  const archiveFiles = new Map<string, (typeof entries)[number]>()
  for (const entry of entries) {
    const name = entry.entryName.replaceAll('\\', '/')
    assertSafeRelativePath(name.replace(/\/$/, ''))
    if (name === 'manifest.json') continue
    if (entry.isDirectory) {
      if (
        !name.startsWith('skill/') ||
        ![...expectedArchivePaths].some((path) => path.startsWith(name))
      )
        throw new Error(`Skill 传输包包含未知路径：${name}`)
      continue
    }
    if (!expectedArchivePaths.has(name) || archiveFiles.has(name))
      throw new Error(`Skill 传输包包含未列入清单的文件：${name}`)
    archiveFiles.set(name, entry)
  }
  if (archiveFiles.size !== expectedArchivePaths.size)
    throw new Error('Skill 传输包文件与清单不一致。')

  let expandedBytes = 0
  for (const [name, entry] of archiveFiles) {
    const relativePath = name.slice('skill/'.length)
    const data = Number(entry.header.size) === 0 ? Buffer.alloc(0) : entry.getData()
    if (data.byteLength > MAX_FILE_BYTES) throw new Error(`文件过大：${relativePath}`)
    expandedBytes += data.byteLength
    if (expandedBytes > MAX_TOTAL_BYTES) throw new Error('Skill 包解压后不能超过 512 MB。')
    const target = join(destination, relativePath)
    mkdirSync(dirname(target), { recursive: true })
    const file = manifest.files.find((candidate) => candidate.path === relativePath)
    writeFileSync(target, data, { mode: file?.executable ? 0o700 : 0o600 })
  }
  const actual = buildSkillManifest(destination, manifest.parentHash)
  if (
    actual.contentHash !== manifest.contentHash ||
    actual.name !== manifest.name ||
    actual.description !== manifest.description ||
    actual.parentHash !== manifest.parentHash ||
    actual.totalBytes !== manifest.totalBytes ||
    JSON.stringify(actual.files) !== JSON.stringify(manifest.files)
  ) {
    throw new Error('Skill 传输包哈希校验失败。')
  }
  return actual
}
