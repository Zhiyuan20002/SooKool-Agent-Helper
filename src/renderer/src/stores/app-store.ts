import { create } from 'zustand'
import type { AppMetrics, AppPreferences } from '@/i18n'
import type { SkillBackupRecord, SkillDetail, SkillRoot, SkillSummary } from '@/types/skills'

export type ViewType = 'market' | 'local' | 'settings'

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

  skillRoots: SkillRoot[]
  skills: SkillSummary[]
  selectedSkill: SkillDetail | null
  backups: SkillBackupRecord[]
  search: string
  rootFilter: string
  issueFilter: 'all' | 'issues'
  preferences: AppPreferences
  appMetrics: AppMetrics | null
  loading: boolean
  saving: boolean
  error: string | null

  initialize: () => Promise<void>
  loadAppMetrics: () => Promise<void>
  updatePreferences: (preferences: Partial<AppPreferences>) => Promise<void>
  refreshSkills: () => Promise<void>
  selectSkill: (path: string) => Promise<void>
  updateSelectedContent: (content: string) => void
  saveSelectedSkill: () => Promise<void>
  deleteSelectedSkill: () => Promise<void>
  revealSelectedSkill: () => Promise<void>
  addSkillRoot: () => Promise<void>
  createSkill: (form: CreateSkillForm) => Promise<void>
  setSearch: (search: string) => void
  setRootFilter: (rootId: string) => void
  setIssueFilter: (filter: 'all' | 'issues') => void
  clearError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  currentView: 'local',
  setCurrentView: (view) => set({ currentView: view }),

  skillRoots: [],
  skills: [],
  selectedSkill: null,
  backups: [],
  search: '',
  rootFilter: 'all',
  issueFilter: 'all',
  preferences: {
    themeMode: 'system',
    language: 'zh-CN',
    autoScanOnStart: true
  },
  appMetrics: null,
  loading: false,
  saving: false,
  error: null,

  initialize: async () => {
    try {
      set({ loading: true })
      const preferences = await window.aiHelper.invoke<AppPreferences>('settings:get')
      const [skillRoots, skills, backups, appMetrics] = await Promise.all([
        window.aiHelper.invoke<SkillRoot[]>('skillRoot:list'),
        preferences.autoScanOnStart
          ? window.aiHelper.invoke<SkillSummary[]>('skill:list')
          : Promise.resolve([]),
        window.aiHelper.invoke<SkillBackupRecord[]>('backup:list'),
        window.aiHelper.invoke<AppMetrics>('app:metrics')
      ])
      set({
        preferences,
        skillRoots,
        skills,
        backups,
        appMetrics,
        selectedSkill: skills[0]
          ? await window.aiHelper.invoke<SkillDetail>('skill:read', skills[0].path)
          : null,
        initialized: true,
        loading: false
      })
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

  refreshSkills: async () => {
    try {
      set({ loading: true, error: null })
      const [skillRoots, skills, backups] = await Promise.all([
        window.aiHelper.invoke<SkillRoot[]>('skillRoot:list'),
        window.aiHelper.invoke<SkillSummary[]>('skill:list'),
        window.aiHelper.invoke<SkillBackupRecord[]>('backup:list')
      ])
      const selectedPath = get().selectedSkill?.path
      const nextSelected =
        selectedPath && skills.some((skill) => skill.path === selectedPath)
          ? await window.aiHelper.invoke<SkillDetail>('skill:read', selectedPath)
          : skills[0]
            ? await window.aiHelper.invoke<SkillDetail>('skill:read', skills[0].path)
            : null

      set({ skillRoots, skills, backups, selectedSkill: nextSelected, loading: false })
    } catch (error) {
      set({ loading: false, error: String(error) })
    }
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
  clearError: () => set({ error: null })
}))
