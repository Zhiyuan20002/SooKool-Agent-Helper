import { createHash } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, normalize, relative, resolve, sep } from 'node:path'

export type ApplicationRuleSource = 'builtin' | 'custom'
export type SkillScope = 'system' | 'project'

export interface ApplicationRule {
  id: string
  name: string
  source: ApplicationRuleSource
  detectionPaths: string[]
  systemSkillPaths: string[]
  projectSkillPaths: string[]
}

export interface ProjectRegistration {
  id: string
  name: string
  path: string
  source?: 'manual' | 'auto'
}

export interface ResolvedProject extends ProjectRegistration {
  parentProjectId: string | null
}

export interface SkillLocation {
  id: string
  scope: SkillScope
  path: string
  projectId: string | null
  applicationIds: string[]
}

export interface SkillTopologyInput {
  applications: ApplicationRule[]
  projects: ProjectRegistration[]
}

export interface SkillTopologySnapshot {
  applications: ApplicationRule[]
  projects: ResolvedProject[]
  locations: SkillLocation[]
}

export function buildSkillTopology(input: SkillTopologyInput): SkillTopologySnapshot {
  const applications = input.applications.map(normalizeApplicationRule)
  const projects = resolveProjectHierarchy(input.projects)
  const projectPathById = new Map(projects.map((project) => [project.id, project.path]))
  const locations = new Map<string, SkillLocation>()

  for (const application of applications) {
    for (const path of application.systemSkillPaths) {
      bindLocation(locations, application.id, 'system', null, expandPath(path), projectPathById)
    }
    for (const project of projects) {
      for (const projectPath of application.projectSkillPaths) {
        bindLocation(
          locations,
          application.id,
          'project',
          project.id,
          resolve(project.path, projectPath),
          projectPathById
        )
      }
    }
  }

  return { applications, projects, locations: [...locations.values()] }
}

function normalizeApplicationRule(rule: ApplicationRule): ApplicationRule {
  return {
    ...rule,
    id: rule.id.trim(),
    name: rule.name.trim(),
    detectionPaths: unique(rule.detectionPaths.map((path) => path.trim()).filter(Boolean)),
    systemSkillPaths: unique(rule.systemSkillPaths.map(expandPath)),
    projectSkillPaths: unique(
      rule.projectSkillPaths
        .map((path) => path.trim())
        .filter(Boolean)
        .map((path) => {
          if (isAbsolute(path)) throw new Error(`项目技能路径必须是相对路径：${path}`)
          const normalized = normalize(
            path.replace(/^\.([/\\])/, '').replaceAll('\\', '/')
          ).replaceAll('\\', '/')
          if (!normalized || normalized === '..' || normalized.startsWith('../')) {
            throw new Error(`项目技能路径不能超出项目目录：${path}`)
          }
          return normalized
        })
    )
  }
}

function resolveProjectHierarchy(projects: ProjectRegistration[]): ResolvedProject[] {
  const normalized = projects.map((project) => ({
    ...project,
    name: project.name.trim(),
    path: expandPath(project.path)
  }))
  const seen = new Set<string>()
  for (const project of normalized) {
    const key = pathKey(project.path)
    if (seen.has(key)) throw new Error(`项目目录重复：${project.path}`)
    seen.add(key)
  }

  return normalized.map((project) => {
    const parents = normalized.filter(
      (candidate) => candidate.id !== project.id && isWithin(project.path, candidate.path)
    )
    parents.sort((left, right) => right.path.length - left.path.length)
    return { ...project, parentProjectId: parents[0]?.id ?? null }
  })
}

function bindLocation(
  locations: Map<string, SkillLocation>,
  applicationId: string,
  scope: SkillScope,
  projectId: string | null,
  path: string,
  projectPathById: Map<string, string>
): void {
  const normalizedPath = resolve(path)
  const key = pathKey(normalizedPath)
  const existing = locations.get(key)
  if (existing) {
    existing.applicationIds = unique([...existing.applicationIds, applicationId]).sort()
    const existingProjectDepth = existing.projectId
      ? (projectPathById.get(existing.projectId)?.length ?? 0)
      : -1
    const nextProjectDepth = projectId ? (projectPathById.get(projectId)?.length ?? 0) : -1
    if (nextProjectDepth > existingProjectDepth) {
      existing.scope = scope
      existing.projectId = projectId
    }
    return
  }
  locations.set(key, {
    id: `location-${createHash('sha1').update(key).digest('hex').slice(0, 16)}`,
    scope,
    path: normalizedPath,
    projectId,
    applicationIds: [applicationId]
  })
}

function expandPath(path: string): string {
  const trimmed = path.trim()
  if (trimmed === '~') return homedir()
  if (trimmed.startsWith(`~${sep}`) || trimmed.startsWith('~/')) {
    return resolve(homedir(), trimmed.slice(2))
  }
  return resolve(trimmed)
}

function isWithin(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function pathKey(path: string): string {
  const resolved = resolve(path)
  const normalized = existsSync(resolved) ? realpathSync.native(resolved) : resolved
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
