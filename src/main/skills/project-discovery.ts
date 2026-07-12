import { createHash } from 'node:crypto'
import { access, readdir, realpath, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import type { ApplicationRule, ProjectRegistration } from './skill-topology'

export type ProjectDiscoverySource = 'manual' | 'cache' | 'workspace' | 'system-index' | 'scan-root' | 'git'

export interface ProjectDiscoveryRecord {
  id: string
  name: string
  path: string
  sources: ProjectDiscoverySource[]
  evidencePaths: string[]
  firstDiscoveredAt: string
  lastConfirmedAt: string
  status: 'active' | 'missing'
  missCount?: number
}

export interface ProjectDiscoverySnapshot {
  projects: ProjectRegistration[]
  records: ProjectDiscoveryRecord[]
  scannedDirectories: number
  truncatedRoots: string[]
  completedAt: string
  cancelled: boolean
}

export interface ProjectDiscoveryOptions {
  scanRoots?: string[]
  workspacePaths?: string[]
  indexedPaths?: string[]
  cachedRecords?: ProjectDiscoveryRecord[]
  maxDepth?: number
  maxDirectoriesPerRoot?: number
  now?: Date
  signal?: AbortSignal
  ignoredPaths?: string[]
}

const ignoredDirectories = new Set([
  '.git', '.cache', '.codex', '.claude', '.npm', '.pnpm-store', '.trash',
  'node_modules', 'dist', 'build', 'out', 'Library', 'Applications', 'Downloads'
])

/**
 * Finds projects through high-confidence candidates first, then performs a bounded
 * breadth-first scan per root. Callers get one asynchronous task and do not need
 * to know about budgets, evidence matching, deduplication, or stale records.
 */
export async function discoverProjects(
  applications: ApplicationRule[],
  registeredProjects: ProjectRegistration[],
  options: ProjectDiscoveryOptions = {}
): Promise<ProjectDiscoverySnapshot> {
  const projectSkillPaths = unique(
    applications.flatMap((application) => application.projectSkillPaths)
      .map(normalizeRelativePath)
      .filter(Boolean)
  )
  const skillDirectoryTopLevels = new Set(
    projectSkillPaths.map((path) => path.split('/')[0]).filter(Boolean)
  )
  const now = (options.now ?? new Date()).toISOString()
  const priorByPath = new Map(
    (options.cachedRecords ?? []).map((record) => [pathKey(record.path), record])
  )
  const candidates = new Map<string, { path: string; sources: Set<ProjectDiscoverySource> }>()
  const ignoredPaths = new Set((options.ignoredPaths ?? []).map(pathKey))
  const addCandidate = (path: string, source: ProjectDiscoverySource): void => {
    if (!path) return
    const normalized = resolve(path)
    const key = pathKey(normalized)
    if (ignoredPaths.has(key) && source !== 'manual') return
    const candidate = candidates.get(key) ?? { path: normalized, sources: new Set() }
    candidate.sources.add(source)
    candidates.set(key, candidate)
  }

  registeredProjects.forEach((project) => addCandidate(project.path, 'manual'))
  options.cachedRecords?.forEach((record) => addCandidate(record.path, 'cache'))
  options.workspacePaths?.forEach((path) => addCandidate(path, 'workspace'))
  options.indexedPaths?.forEach((path) => addCandidate(path, 'system-index'))

  const scanRoots = options.scanRoots ?? defaultProjectScanRoots()
  const maxDepth = options.maxDepth ?? 6
  const maxDirectoriesPerRoot = options.maxDirectoriesPerRoot ?? 4_000
  const truncatedRoots: string[] = []
  let scannedDirectories = 0

  for (const scanRoot of unique(scanRoots.map((path) => resolve(path)))) {
    if (options.signal?.aborted) break
    if (!(await isReadableDirectory(scanRoot))) continue
    const queue: Array<{ path: string; depth: number }> = [{ path: scanRoot, depth: 0 }]
    const visited = new Set<string>()
    let rootCount = 0
    while (queue.length && rootCount < maxDirectoriesPerRoot) {
      if (options.signal?.aborted) break
      const current = queue.shift()!
      const canonical = await canonicalPath(current.path)
      if (visited.has(canonical)) continue
      visited.add(canonical)
      rootCount += 1
      scannedDirectories += 1

      const entries = await readDirectory(current.path)
      const hasGit = entries.some((entry) => entry.name === '.git')
      const evidence = await findEvidence(current.path, projectSkillPaths)
      if (evidence.length) addCandidate(current.path, hasGit ? 'git' : 'scan-root')

      if (current.depth >= maxDepth) continue
      const childDirectories = entries
        .filter((entry) => entry.isDirectory()
          && !ignoredDirectories.has(entry.name)
          && !skillDirectoryTopLevels.has(entry.name))
        .map((entry) => join(current.path, entry.name))
      const ranked = await rankDirectoriesByModifiedTime(childDirectories)
      queue.push(...ranked.map((path) => ({ path, depth: current.depth + 1 })))
    }
    if (queue.length) truncatedRoots.push(scanRoot)
  }

  const records: ProjectDiscoveryRecord[] = []
  for (const candidate of candidates.values()) {
    if (options.signal?.aborted) break
    const evidencePaths = await findEvidence(candidate.path, projectSkillPaths)
    const prior = priorByPath.get(pathKey(candidate.path))
    const manual = candidate.sources.has('manual')
    if (!evidencePaths.length && !manual) {
      if (prior) {
        const missCount = (prior.missCount ?? 0) + 1
        records.push({
          ...prior,
          missCount,
          status: missCount >= 3 ? 'missing' : 'active',
          sources: mergeSources(prior.sources, candidate.sources)
        })
      }
      continue
    }
    const sources = mergeSources(prior?.sources ?? [], candidate.sources)
    records.push({
      id: prior?.id ?? automaticProjectId(candidate.path),
      name: basename(candidate.path) || candidate.path,
      path: candidate.path,
      sources,
      evidencePaths,
      firstDiscoveredAt: prior?.firstDiscoveredAt ?? now,
      lastConfirmedAt: evidencePaths.length ? now : (prior?.lastConfirmedAt ?? now),
      status: evidencePaths.length || manual ? 'active' : 'missing',
      missCount: 0
    })
  }

  const activeRecords = records.filter((record) => record.status === 'active')
  const manualByPath = new Map(registeredProjects.map((project) => [pathKey(project.path), project]))
  const projects = activeRecords.map((record): ProjectRegistration => {
    const manual = manualByPath.get(pathKey(record.path))
    return manual ?? { id: record.id, name: record.name, path: record.path, source: 'auto' }
  })

  return {
    projects: uniqueProjects(projects),
    records: records.sort((left, right) => left.path.localeCompare(right.path)),
    scannedDirectories,
    truncatedRoots,
    completedAt: now,
    cancelled: Boolean(options.signal?.aborted)
  }
}

export function defaultProjectScanRoots(): string[] {
  const home = homedir()
  return unique([
    process.cwd(), join(home, 'Developer'), join(home, 'Projects'), join(home, 'Workspace'),
    join(home, 'Workspaces'), join(home, 'Code'), join(home, 'Documents'), join(home, 'Desktop')
  ])
}

async function findEvidence(projectPath: string, projectSkillPaths: string[]): Promise<string[]> {
  const evidence: string[] = []
  for (const relativePath of projectSkillPaths) {
    const skillRoot = resolve(projectPath, relativePath)
    if (!isWithin(skillRoot, projectPath) || !(await isReadableDirectory(skillRoot))) continue
    if (await containsSkillFile(skillRoot, 3)) evidence.push(skillRoot)
  }
  return evidence
}

async function containsSkillFile(directory: string, depth: number): Promise<boolean> {
  if (await isReadableFile(join(directory, 'SKILL.md'))) return true
  if (depth <= 0) return false
  for (const entry of await readDirectory(directory)) {
    if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue
    if (await containsSkillFile(join(directory, entry.name), depth - 1)) return true
  }
  return false
}

async function rankDirectoriesByModifiedTime(paths: string[]): Promise<string[]> {
  const ranked = await Promise.all(paths.map(async (path) => {
    try { return { path, modifiedAt: (await stat(path)).mtimeMs } } catch { return { path, modifiedAt: 0 } }
  }))
  return ranked.sort((left, right) => right.modifiedAt - left.modifiedAt).map((entry) => entry.path)
}

async function readDirectory(path: string) {
  try { return await readdir(path, { withFileTypes: true }) } catch { return [] }
}

async function isReadableDirectory(path: string): Promise<boolean> {
  try { await access(path, constants.R_OK); return (await stat(path)).isDirectory() } catch { return false }
}

async function isReadableFile(path: string): Promise<boolean> {
  try { await access(path, constants.R_OK); return (await stat(path)).isFile() } catch { return false }
}

async function canonicalPath(path: string): Promise<string> {
  try { return await realpath(path) } catch { return resolve(path) }
}

function automaticProjectId(path: string): string {
  return `auto-${createHash('sha1').update(pathKey(path)).digest('hex').slice(0, 16)}`
}

function pathKey(path: string): string {
  const normalized = resolve(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function normalizeRelativePath(path: string): string {
  if (!path || isAbsolute(path)) return ''
  return path.replace(/^\.([/\\])/, '').replaceAll('\\', '/')
}

function isWithin(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function mergeSources(existing: ProjectDiscoverySource[], next: Set<ProjectDiscoverySource>): ProjectDiscoverySource[] {
  return unique([...existing, ...next]).sort() as ProjectDiscoverySource[]
}

function unique<T>(values: T[]): T[] { return [...new Set(values)] }

function uniqueProjects(projects: ProjectRegistration[]): ProjectRegistration[] {
  return [...new Map(projects.map((project) => [pathKey(project.path), project])).values()]
    .sort((left, right) => left.path.localeCompare(right.path))
}
