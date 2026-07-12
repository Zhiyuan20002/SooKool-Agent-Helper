import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import type { ApplicationRule, ProjectRegistration } from '../skills/skill-topology'
import type { ProjectDiscoveryRecord } from '../skills/project-discovery'

export interface SavedSkillRoot {
  id: string
  label: string
  path: string
  readonly?: boolean
}

export interface SkillBackupRecord {
  id: string
  skillName: string
  originalPath: string
  backupPath: string
  createdAt: string
}

export interface SavedMarketSource {
  id: string
  name: string
  source: string
  description?: string
  kind?: 'skills-sh' | 'skillhub' | 'redskill' | 'modelscope' | 'clawhub' | 'lobehub' | 'git' | 'local'
  palette?: MarketPalette
  enabled?: boolean
}

export type MarketPalette = 'memphis' | 'macaron' | 'rococo' | 'mondrian' | 'morandi' | 'matisse'

export type ThemeMode = 'system' | 'light' | 'dark'

export type AppLanguage =
  | 'zh-CN'
  | 'zh-TW'
  | 'en-US'
  | 'ja-JP'
  | 'fr-FR'
  | 'ko-KR'
  | 'es-ES'
  | 'pt-BR'
  | 'ar'
export type AppLanguagePreference = AppLanguage | 'system'

export interface AppPreferences {
  themeMode: ThemeMode
  language: AppLanguagePreference
  autoScanOnStart: boolean
}

interface SettingsData {
  schemaVersion: 2
  skillRoots: SavedSkillRoot[]
  applicationRules: ApplicationRule[]
  projects: ProjectRegistration[]
  projectDiscoveryRecords: ProjectDiscoveryRecord[]
  projectScanRoots: string[]
  ignoredProjectPaths: string[]
  backups: SkillBackupRecord[]
  marketSources: SavedMarketSource[]
  marketSourcePalettes: Record<string, MarketPalette>
  appPreferences: AppPreferences
}

export const defaultAppPreferences: AppPreferences = {
  themeMode: 'system',
  language: 'zh-CN',
  autoScanOnStart: true
}

const defaultSettings: SettingsData = {
  schemaVersion: 2,
  skillRoots: [],
  applicationRules: [],
  projects: [],
  projectDiscoveryRecords: [],
  projectScanRoots: [],
  ignoredProjectPaths: [],
  backups: [],
  marketSources: [],
  marketSourcePalettes: {},
  appPreferences: defaultAppPreferences
}

export class SettingsStore {
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  read(): SettingsData {
    if (!existsSync(this.filePath)) {
      return { ...defaultSettings }
    }

    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<SettingsData>
      return {
        schemaVersion: 2,
        skillRoots: Array.isArray(parsed.skillRoots) ? parsed.skillRoots : [],
        applicationRules: Array.isArray(parsed.applicationRules) ? parsed.applicationRules : [],
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        projectDiscoveryRecords: Array.isArray(parsed.projectDiscoveryRecords)
          ? parsed.projectDiscoveryRecords
          : [],
        projectScanRoots: Array.isArray(parsed.projectScanRoots) ? parsed.projectScanRoots : [],
        ignoredProjectPaths: Array.isArray(parsed.ignoredProjectPaths) ? parsed.ignoredProjectPaths : [],
        backups: Array.isArray(parsed.backups) ? parsed.backups : [],
        marketSources: Array.isArray(parsed.marketSources) ? parsed.marketSources : [],
        marketSourcePalettes: normalizeMarketSourcePalettes(parsed.marketSourcePalettes),
        appPreferences: normalizeAppPreferences(parsed.appPreferences)
      }
    } catch {
      return { ...defaultSettings }
    }
  }

  write(data: SettingsData): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
  }

  getSkillRoots(): SavedSkillRoot[] {
    return this.read().skillRoots
  }

  getLegacySkillRoots(): SavedSkillRoot[] {
    return this.read().skillRoots
  }

  saveSkillRoots(skillRoots: SavedSkillRoot[]): void {
    const data = this.read()
    this.write({ ...data, skillRoots })
  }

  getApplicationRules(): ApplicationRule[] {
    return this.read().applicationRules
  }

  saveApplicationRules(applicationRules: ApplicationRule[]): void {
    const data = this.read()
    this.write({ ...data, applicationRules })
  }

  getProjects(): ProjectRegistration[] {
    return this.read().projects
  }

  saveProjects(projects: ProjectRegistration[]): void {
    const data = this.read()
    this.write({ ...data, projects })
  }

  getProjectDiscoveryRecords(): ProjectDiscoveryRecord[] {
    return this.read().projectDiscoveryRecords
  }

  saveProjectDiscoveryRecords(projectDiscoveryRecords: ProjectDiscoveryRecord[]): void {
    const data = this.read()
    this.write({ ...data, projectDiscoveryRecords })
  }

  getProjectScanRoots(): string[] {
    return this.read().projectScanRoots
  }

  saveProjectScanRoots(projectScanRoots: string[]): void {
    const data = this.read()
    this.write({ ...data, projectScanRoots: [...new Set(projectScanRoots)] })
  }

  getIgnoredProjectPaths(): string[] {
    return this.read().ignoredProjectPaths
  }

  saveIgnoredProjectPaths(ignoredProjectPaths: string[]): void {
    const data = this.read()
    this.write({ ...data, ignoredProjectPaths: [...new Set(ignoredProjectPaths)] })
  }

  getBackups(): SkillBackupRecord[] {
    return this.read().backups
  }

  addBackup(record: SkillBackupRecord): void {
    const data = this.read()
    this.write({ ...data, backups: [record, ...data.backups] })
  }

  getMarketSources(): SavedMarketSource[] {
    return this.read().marketSources
  }

  saveMarketSources(marketSources: SavedMarketSource[]): void {
    const data = this.read()
    this.write({ ...data, marketSources })
  }

  getMarketSourcePalettes(): Record<string, MarketPalette> {
    return this.read().marketSourcePalettes
  }

  saveMarketSourcePalettes(marketSourcePalettes: Record<string, MarketPalette>): void {
    const data = this.read()
    this.write({ ...data, marketSourcePalettes })
  }

  getAppPreferences(): AppPreferences {
    return this.read().appPreferences
  }

  saveAppPreferences(appPreferences: Partial<AppPreferences>): AppPreferences {
    const data = this.read()
    const nextPreferences = normalizeAppPreferences({
      ...data.appPreferences,
      ...appPreferences
    })
    this.write({ ...data, appPreferences: nextPreferences })
    return nextPreferences
  }
}

function normalizeAppPreferences(value: unknown): AppPreferences {
  const input =
    value && typeof value === 'object' ? (value as Partial<AppPreferences>) : defaultAppPreferences

  return {
    themeMode: isThemeMode(input.themeMode) ? input.themeMode : defaultAppPreferences.themeMode,
    language: isAppLanguagePreference(input.language) ? input.language : defaultAppPreferences.language,
    autoScanOnStart:
      typeof input.autoScanOnStart === 'boolean'
        ? input.autoScanOnStart
        : defaultAppPreferences.autoScanOnStart
  }
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function isAppLanguagePreference(value: unknown): value is AppLanguagePreference {
  return ['system', 'zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'fr-FR', 'ko-KR', 'es-ES', 'pt-BR', 'ar'].includes(
    String(value)
  )
}

function normalizeMarketSourcePalettes(value: unknown): Record<string, MarketPalette> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, MarketPalette] => isMarketPalette(entry[1]))
  )
}

function isMarketPalette(value: unknown): value is MarketPalette {
  return ['memphis', 'macaron', 'rococo', 'mondrian', 'morandi', 'matisse'].includes(String(value))
}

export function resolveAppLanguage(language: AppLanguagePreference, systemLocale: string): AppLanguage {
  if (language !== 'system') return language
  const locale = systemLocale.toLowerCase()
  if (/^zh-(tw|hk|hant)/.test(locale)) return 'zh-TW'
  if (locale.startsWith('zh')) return 'zh-CN'
  if (locale.startsWith('ja')) return 'ja-JP'
  if (locale.startsWith('fr')) return 'fr-FR'
  if (locale.startsWith('ko')) return 'ko-KR'
  if (locale.startsWith('es')) return 'es-ES'
  if (locale.startsWith('pt')) return 'pt-BR'
  if (locale.startsWith('ar')) return 'ar'
  return 'en-US'
}
