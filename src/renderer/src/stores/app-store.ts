import { create } from 'zustand'
import type { AppMetrics, AppPreferences } from '@/i18n'
import type {
  SkillApplication,
  SkillBackupRecord,
  SkillCatalogSnapshot,
  SkillDetail,
  ProjectDiscoveryStatus,
  SkillProject,
  SkillRoot,
  SkillSummary
} from '@/types/skills'

let removeCatalogChangedListener: (() => void) | null = null

export type ViewType = 'market' | 'local-share' | 'local' | 'skill-settings' | 'settings'

interface CreateSkillForm {
  rootId: string
  name: string
  description: string
  body: string
  resourceDirs: string[]
}

interface AppState {
  initialized: boolean
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  localShareDraftSkillPath: string | null
  setLocalShareDraftSkillPath: (path: string | null) => void

  skillRoots: SkillRoot[]
  applications: SkillApplication[]
  projects: SkillProject[]
  skills: SkillSummary[]
  selectedSkill: SkillDetail | null
  backups: SkillBackupRecord[]
  search: string
  rootFilter: string
  issueFilter: 'all' | 'issues'
  libraryPerspective: 'application' | 'project'
  preferences: AppPreferences
  appMetrics: AppMetrics | null
  projectDiscovery: ProjectDiscoveryStatus
  projectScanRoots: string[]
  projectScanRunning: boolean
  loading: boolean
  saving: boolean
  error: string | null

  initialize: () => Promise<void>
  loadAppMetrics: () => Promise<void>
  updatePreferences: (preferences: Partial<AppPreferences>) => Promise<void>
  refreshSkills: (mode?: 'quick' | 'deep') => Promise<void>
  cancelProjectScan: () => Promise<void>
  addProjectScanRoot: () => Promise<void>
  removeProjectScanRoot: (path: string) => Promise<void>
  selectSkill: (path: string) => Promise<void>
  updateSelectedContent: (content: string) => void
  saveSelectedSkill: () => Promise<void>
  deleteSelectedSkill: () => Promise<void>
  revealSelectedSkill: () => Promise<void>
  addSkillRoot: () => Promise<void>
  addProject: () => Promise<void>
  removeProject: (id: string) => Promise<void>
  saveApplicationRule: (rule: SkillApplication) => Promise<void>
  removeApplicationRule: (id: string) => Promise<void>
  createSkill: (form: CreateSkillForm) => Promise<void>
  setSearch: (search: string) => void
  setRootFilter: (rootId: string) => void
  setIssueFilter: (filter: 'all' | 'issues') => void
  setLibraryPerspective: (perspective: 'application' | 'project') => void
  clearError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  currentView: 'local',
  setCurrentView: (view) => set({ currentView: view }),
  localShareDraftSkillPath: null,
  setLocalShareDraftSkillPath: (path) => set({ localShareDraftSkillPath: path }),

  skillRoots: [],
  applications: [],
  projects: [],
  skills: [],
  selectedSkill: null,
  backups: [],
  search: '',
  rootFilter: 'all',
  issueFilter: 'all',
  libraryPerspective: 'application',
  preferences: {
    themeMode: 'system',
    language: 'zh-CN',
    autoScanOnStart: true
  },
  appMetrics: null,
  projectDiscovery: {
    phase: 'idle', mode: null, discoveredProjects: 0, scannedDirectories: 0,
    truncatedRoots: [], completedAt: null
  },
  projectScanRoots: [],
  projectScanRunning: false,
  loading: false,
  saving: false,
  error: null,

  initialize: async () => {
    try {
      set({ loading: true })
      const preferences = await window.aiHelper.invoke<AppPreferences>('settings:get')
      const [catalog, backups, appMetrics, projectScanRoots] = await Promise.all([
        window.aiHelper.invoke<SkillCatalogSnapshot>('skillCatalog:get', {
          refresh: preferences.autoScanOnStart
        }),
        window.aiHelper.invoke<SkillBackupRecord[]>('backup:list'),
        window.aiHelper.invoke<AppMetrics>('app:metrics'),
        window.aiHelper.invoke<string[]>('projectScanRoot:list').catch(() => [])
      ])
      set({
        preferences,
        skillRoots: catalog.roots,
        applications: catalog.applications,
        projects: catalog.projects,
        skills: preferences.autoScanOnStart ? catalog.skills : [],
        backups,
        appMetrics,
        projectDiscovery: catalog.discovery ?? get().projectDiscovery,
        projectScanRoots,
        selectedSkill: preferences.autoScanOnStart && catalog.skills[0]
          ? await window.aiHelper.invoke<SkillDetail>('skill:read', catalog.skills[0].path)
          : null,
        initialized: true,
        loading: false
      })
      removeCatalogChangedListener?.()
      removeCatalogChangedListener = window.aiHelper.onSkillCatalogChanged?.((value) => {
        const catalog = value as SkillCatalogSnapshot
        set({
          skillRoots: catalog.roots,
          applications: catalog.applications,
          projects: catalog.projects,
          skills: catalog.skills,
          projectDiscovery: catalog.discovery ?? get().projectDiscovery
        })
      }) ?? null
    } catch (error) {
      set({ initialized: true, loading: false, error: String(error) })
    }
  },

  loadAppMetrics: async () => {
    try {
      const appMetrics = await window.aiHelper.invoke<AppMetrics>('app:metrics')
      set({ appMetrics })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  updatePreferences: async (nextPreferences) => {
    try {
      const preferences = await window.aiHelper.invoke<AppPreferences>(
        'settings:update',
        nextPreferences
      )
      set({ preferences })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  refreshSkills: async (mode = 'quick') => {
    try {
      set({ loading: true, projectScanRunning: true, error: null })
      const [catalog, backups] = await Promise.all([
        window.aiHelper.invoke<SkillCatalogSnapshot>('skillCatalog:get', { refresh: true, mode }),
        window.aiHelper.invoke<SkillBackupRecord[]>('backup:list')
      ])
      const selectedPath = get().selectedSkill?.path
      const nextSelected =
        selectedPath && catalog.skills.some((skill) => skill.path === selectedPath)
          ? await window.aiHelper.invoke<SkillDetail>('skill:read', selectedPath)
          : catalog.skills[0]
            ? await window.aiHelper.invoke<SkillDetail>('skill:read', catalog.skills[0].path)
            : null

      set({
        skillRoots: catalog.roots,
        applications: catalog.applications,
        projects: catalog.projects,
        skills: catalog.skills,
        backups,
        selectedSkill: nextSelected,
        projectDiscovery: catalog.discovery ?? get().projectDiscovery,
        projectScanRunning: false,
        loading: false
      })
    } catch (error) {
      set({ loading: false, projectScanRunning: false, error: String(error) })
    }
  },

  cancelProjectScan: async () => {
    await window.aiHelper.invoke('projectDiscovery:cancel')
  },

  addProjectScanRoot: async () => {
    const projectScanRoots = await window.aiHelper.invoke<string[]>('projectScanRoot:add')
    set({ projectScanRoots })
  },

  removeProjectScanRoot: async (path) => {
    const projectScanRoots = await window.aiHelper.invoke<string[]>('projectScanRoot:remove', path)
    set({ projectScanRoots })
  },

  selectSkill: async (path) => {
    try {
      set({ loading: true, error: null })
      const selectedSkill = await window.aiHelper.invoke<SkillDetail>('skill:read', path)
      set({ selectedSkill, loading: false })
    } catch (error) {
      set({ loading: false, error: String(error) })
    }
  },

  updateSelectedContent: (content) => {
    const selectedSkill = get().selectedSkill
    if (!selectedSkill) return
    set({ selectedSkill: { ...selectedSkill, content } })
  },

  saveSelectedSkill: async () => {
    const selectedSkill = get().selectedSkill
    if (!selectedSkill) return
    try {
      set({ saving: true, error: null })
      const updated = await window.aiHelper.invoke<SkillDetail>('skill:update', {
        path: selectedSkill.path,
        content: selectedSkill.content
      })
      const skills = await window.aiHelper.invoke<SkillSummary[]>('skill:list')
      set({ selectedSkill: updated, skills, saving: false })
    } catch (error) {
      set({ saving: false, error: String(error) })
    }
  },

  deleteSelectedSkill: async () => {
    const selectedSkill = get().selectedSkill
    if (!selectedSkill) return
    try {
      set({ saving: true, error: null })
      await window.aiHelper.invoke('skill:delete', selectedSkill.path)
      const [skills, backups] = await Promise.all([
        window.aiHelper.invoke<SkillSummary[]>('skill:list'),
        window.aiHelper.invoke<SkillBackupRecord[]>('backup:list')
      ])
      set({
        selectedSkill: skills[0]
          ? await window.aiHelper.invoke<SkillDetail>('skill:read', skills[0].path)
          : null,
        skills,
        backups,
        saving: false
      })
    } catch (error) {
      set({ saving: false, error: String(error) })
    }
  },

  revealSelectedSkill: async () => {
    const selectedSkill = get().selectedSkill
    if (!selectedSkill) return
    try {
      await window.aiHelper.invoke('skill:reveal', selectedSkill.path)
    } catch (error) {
      set({ error: String(error) })
    }
  },

  addSkillRoot: async () => {
    try {
      set({ loading: true, error: null })
      const result = await window.aiHelper.invoke<SkillRoot[] | null>('skillRoot:add')
      if (!result) {
        set({ loading: false })
        return
      }
      const skills = await window.aiHelper.invoke<SkillSummary[]>('skill:list')
      set({ skillRoots: result, skills, loading: false })
    } catch (error) {
      set({ loading: false, error: String(error) })
    }
  },

  addProject: async () => {
    try {
      set({ loading: true, error: null })
      const catalog = await window.aiHelper.invoke<SkillCatalogSnapshot | null>('project:add')
      if (catalog) set({ skillRoots: catalog.roots, applications: catalog.applications, projects: catalog.projects, skills: catalog.skills })
      set({ loading: false })
    } catch (error) {
      set({ loading: false, error: String(error) })
    }
  },

  removeProject: async (id) => {
    try {
      const catalog = await window.aiHelper.invoke<SkillCatalogSnapshot>('project:remove', id)
      set({ skillRoots: catalog.roots, applications: catalog.applications, projects: catalog.projects, skills: catalog.skills })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  saveApplicationRule: async (rule) => {
    try {
      const catalog = await window.aiHelper.invoke<SkillCatalogSnapshot>('applicationRule:save', rule)
      set({ skillRoots: catalog.roots, applications: catalog.applications, projects: catalog.projects, skills: catalog.skills })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  removeApplicationRule: async (id) => {
    try {
      const catalog = await window.aiHelper.invoke<SkillCatalogSnapshot>('applicationRule:remove', id)
      set({ skillRoots: catalog.roots, applications: catalog.applications, projects: catalog.projects, skills: catalog.skills })
    } catch (error) {
      set({ error: String(error) })
    }
  },

  createSkill: async (form) => {
    try {
      set({ saving: true, error: null })
      const selectedSkill = await window.aiHelper.invoke<SkillDetail>('skill:create', form)
      const skills = await window.aiHelper.invoke<SkillSummary[]>('skill:list')
      set({ selectedSkill, skills, saving: false, currentView: 'local' })
    } catch (error) {
      set({ saving: false, error: String(error) })
    }
  },

  setSearch: (search) => set({ search }),
  setRootFilter: (rootFilter) => set({ rootFilter }),
  setIssueFilter: (issueFilter) => set({ issueFilter }),
  setLibraryPerspective: (libraryPerspective) => set({ libraryPerspective }),
  clearError: () => set({ error: null })
}))
