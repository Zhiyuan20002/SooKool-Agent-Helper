import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'

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
  enabled?: boolean
}

export type ThemeMode = 'system' | 'light' | 'dark'

export type AppLanguage = 'zh-CN' | 'en-US'

export interface AppPreferences {
  themeMode: ThemeMode
  language: AppLanguage
  autoScanOnStart: boolean
}

interface SettingsData {
  skillRoots: SavedSkillRoot[]
  backups: SkillBackupRecord[]
  marketSources: SavedMarketSource[]
  appPreferences: AppPreferences
}

export const defaultAppPreferences: AppPreferences = {
  themeMode: 'system',
  language: 'zh-CN',
  autoScanOnStart: true
}

const defaultSettings: SettingsData = {
  skillRoots: [],
  backups: [],
  marketSources: [],
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
        skillRoots: Array.isArray(parsed.skillRoots) ? parsed.skillRoots : [],
        backups: Array.isArray(parsed.backups) ? parsed.backups : [],
        marketSources: Array.isArray(parsed.marketSources) ? parsed.marketSources : [],
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

  saveSkillRoots(skillRoots: SavedSkillRoot[]): void {
    const data = this.read()
    this.write({ ...data, skillRoots })
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
    language: isAppLanguage(input.language) ? input.language : defaultAppPreferences.language,
    autoScanOnStart:
      typeof input.autoScanOnStart === 'boolean'
        ? input.autoScanOnStart
        : defaultAppPreferences.autoScanOnStart
  }
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'zh-CN' || value === 'en-US'
}
