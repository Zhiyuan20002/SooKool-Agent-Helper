import type { SettingsStore } from '../settings/settings-store.ts'
import {
  discoverProjects,
  defaultProjectScanRoots,
  type ProjectDiscoveryOptions,
  type ProjectDiscoveryRecord,
  type ProjectDiscoverySnapshot
} from './project-discovery.ts'
import type { ApplicationRule, ProjectRegistration } from './skill-topology.ts'
import { collectRecentWorkspacePaths } from './project-workspace-sources.ts'
import { collectIndexedProjectPaths } from './project-system-index.ts'
import { watch, type FSWatcher } from 'node:fs'

export class ProjectDiscoveryManager {
  private runningRefresh: Promise<ProjectDiscoverySnapshot & { mode: ProjectDiscoveryMode }> | null = null
  private abortController: AbortController | null = null
  private lastSnapshot: (ProjectDiscoverySnapshot & { mode: ProjectDiscoveryMode }) | null = null
  private readonly settings: SettingsStore
  private readonly sources: ProjectDiscoverySources
  private readonly onChanged?: () => void
  private watchers: FSWatcher[] = []
  private watchRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private latestApplications: ApplicationRule[] = []
  private latestRegisteredProjects: ProjectRegistration[] = []

  constructor(
    settings: SettingsStore,
    sources: Partial<ProjectDiscoverySources> = {},
    onChanged?: () => void
  ) {
    this.settings = settings
    this.sources = {
      recentWorkspaces: sources.recentWorkspaces ?? collectRecentWorkspacePaths,
      indexedProjects: sources.indexedProjects ?? collectIndexedProjectPaths
    }
    this.onChanged = onChanged
  }

  getProjects(registeredProjects = this.settings.getProjects()): ProjectRegistration[] {
    const manualPaths = new Set(registeredProjects.map((project) => project.path))
    const cached = this.settings.getProjectDiscoveryRecords()
      .filter((record) => record.status === 'active' && !manualPaths.has(record.path))
      .map((record): ProjectRegistration => ({
        id: record.id,
        name: record.name,
        path: record.path,
        source: 'auto'
      }))
    return [...registeredProjects, ...cached]
  }

  getStatus(): ProjectDiscoveryStatus {
    const records = this.settings.getProjectDiscoveryRecords()
    return {
      phase: this.runningRefresh ? 'scanning' : this.lastSnapshot?.cancelled ? 'cancelled' : 'idle',
      mode: this.lastSnapshot?.mode ?? null,
      discoveredProjects: records.filter((record) => record.status === 'active').length,
      scannedDirectories: this.lastSnapshot?.scannedDirectories ?? 0,
      truncatedRoots: this.lastSnapshot?.truncatedRoots ?? [],
      completedAt: this.lastSnapshot?.completedAt ?? null
    }
  }

  cancel(): void {
    this.abortController?.abort()
  }

  refresh(
    applications: ApplicationRule[],
    registeredProjects = this.settings.getProjects(),
    options: Omit<ProjectDiscoveryOptions, 'cachedRecords'> & { mode?: ProjectDiscoveryMode } = {}
  ): Promise<ProjectDiscoverySnapshot & { mode: ProjectDiscoveryMode }> {
    if (this.runningRefresh) return this.runningRefresh
    this.latestApplications = applications
    this.latestRegisteredProjects = registeredProjects
    const mode = options.mode ?? 'quick'
    this.abortController = new AbortController()
    const projectSkillPaths = applications.flatMap((application) => application.projectSkillPaths)
    this.runningRefresh = Promise.all([
      this.sources.recentWorkspaces(),
      mode === 'deep' ? this.sources.indexedProjects(projectSkillPaths, this.abortController.signal) : Promise.resolve([])
    ]).then(([workspacePaths, indexedPaths]) => discoverProjects(
      applications,
      registeredProjects,
      {
        ...options,
        workspacePaths: [...workspacePaths, ...(options.workspacePaths ?? [])],
        indexedPaths: [...indexedPaths, ...(options.indexedPaths ?? [])],
        cachedRecords: this.settings.getProjectDiscoveryRecords(),
        scanRoots: options.scanRoots ?? [...defaultProjectScanRoots(), ...this.settings.getProjectScanRoots()],
        maxDirectoriesPerRoot: options.maxDirectoriesPerRoot ?? (mode === 'deep' ? 4_000 : 1_000),
        signal: this.abortController?.signal,
        ignoredPaths: this.settings.getIgnoredProjectPaths()
      }
    )).then((snapshot) => {
      if (!snapshot.cancelled) this.settings.saveProjectDiscoveryRecords(snapshot.records)
      const result = { ...snapshot, mode }
      this.lastSnapshot = result
      if (!snapshot.cancelled) this.updateWatchers(snapshot.records)
      return result
    }).finally(() => {
      this.runningRefresh = null
      this.abortController = null
    })
    return this.runningRefresh
  }

  dispose(): void {
    if (this.watchRefreshTimer) clearTimeout(this.watchRefreshTimer)
    this.watchers.forEach((watcher) => watcher.close())
    this.watchers = []
  }

  private updateWatchers(records: ProjectDiscoveryRecord[]): void {
    if (!this.onChanged) return
    this.watchers.forEach((watcher) => watcher.close())
    this.watchers = []
    const evidencePaths = [...new Set(
      records.filter((record) => record.status === 'active').flatMap((record) => record.evidencePaths)
    )].slice(0, 128)
    for (const path of evidencePaths) {
      try {
        const watcher = watch(path, { recursive: process.platform === 'darwin' || process.platform === 'win32' }, () => {
          this.scheduleWatchedRefresh()
        })
        watcher.on('error', () => watcher.close())
        this.watchers.push(watcher)
      } catch {
        // A disappearing or inaccessible Skill Space must not stop other watchers.
      }
    }
  }

  private scheduleWatchedRefresh(): void {
    if (this.watchRefreshTimer) clearTimeout(this.watchRefreshTimer)
    this.watchRefreshTimer = setTimeout(() => {
      this.watchRefreshTimer = null
      void this.refresh(this.latestApplications, this.latestRegisteredProjects, {
        mode: 'quick',
        scanRoots: []
      }).then(() => this.onChanged?.()).catch(() => undefined)
    }, 900)
  }
}

interface ProjectDiscoverySources {
  recentWorkspaces: () => Promise<string[]>
  indexedProjects: (projectSkillPaths: string[], signal?: AbortSignal) => Promise<string[]>
}

export type ProjectDiscoveryMode = 'quick' | 'deep'

export interface ProjectDiscoveryStatus {
  phase: 'idle' | 'scanning' | 'cancelled'
  mode: ProjectDiscoveryMode | null
  discoveredProjects: number
  scannedDirectories: number
  truncatedRoots: string[]
  completedAt: string | null
}
