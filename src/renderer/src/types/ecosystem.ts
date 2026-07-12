export interface SkillAgentAdapter {
  id: string
  name: string
  projectPath: string
  globalPath: string | null
  installed: boolean
}

export interface SkillsCommandInput {
  command: 'add' | 'use' | 'list' | 'find' | 'remove' | 'update' | 'init'
  source?: string
  query?: string
  skills?: string[]
  agents?: string[]
  global?: boolean
  project?: boolean
  all?: boolean
  copy?: boolean
  yes?: boolean
  listOnly?: boolean
  owner?: string
  launchAgent?: string
  name?: string
}

export interface SkillsCommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
}

export interface MarketSource {
  id: string
  name: string
  source: string
  description: string
  kind: 'skills-sh' | 'skillhub' | 'redskill' | 'modelscope' | 'clawhub' | 'lobehub' | 'git' | 'local'
  palette: MarketPalette
  builtin: boolean
  enabled: boolean
}

export type MarketPalette = 'memphis' | 'macaron' | 'rococo' | 'mondrian' | 'morandi' | 'matisse'

export interface MarketSkill {
  id: string
  name: string
  description: string
  author: string
  version?: string
  category: string
  tags: string[]
  sourceId: string
  sourceName: string
  source: string
  installSource: string
  installed: boolean
  installedOn: string[]
  compatibleAgents: string[]
  sourcePath?: string
  fileCount?: number
  hasScripts?: boolean
  url?: string
  origin: 'source' | 'search'
}

export interface MarketPreviewFile {
  name: string
  relativePath: string
  kind: 'markdown' | 'script' | 'json' | 'text' | 'image' | 'binary'
  size: number
  content: string | null
  dataUrl?: string
  truncated: boolean
}

export interface MarketSkillPreview extends MarketSkill {
  content: string
  body: string
  files: MarketPreviewFile[]
  warnings: string[]
  fetchedAt: string
}

export interface MarketInstallTarget {
  id: string
  name: string
  path: string
  systemPath: string | null
  projectPath: string | null
  installed: boolean
  selectedByDefault: boolean
}

export interface MarketSkillResult {
  skills: MarketSkill[]
  command: string
  exitCode: number
  error: string | null
  failedSourceCount?: number
  publicSearchFailed?: boolean
  cacheHit?: boolean
  isStale?: boolean
  cachedAt?: number
  total?: number
  page?: number
  pageSize?: number
  paginationMode?: 'page' | 'cursor'
  hasMore?: boolean
}

export interface LobeHubStatus {
  ready: boolean
  profile?: { name?: string; description?: string; source?: string }
  error?: string
}

export interface MarketInstallResult {
  skill: import('./skills').SkillDetail | null
  commandResult: SkillsCommandResult
  targets: Array<{ id: string; name: string; path: string; success: boolean }>
}
