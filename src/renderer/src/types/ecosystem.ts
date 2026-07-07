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
  builtin: boolean
  enabled: boolean
}

export interface MarketSkill {
  id: string
  name: string
  description: string
  sourceId: string
  sourceName: string
  source: string
  installSource: string
  installed: boolean
  url?: string
  origin: 'source' | 'search'
}

export interface MarketSkillResult {
  skills: MarketSkill[]
  command: string
  exitCode: number
  error: string | null
}

export interface MarketInstallResult {
  skill: import('./skills').SkillDetail | null
  commandResult: SkillsCommandResult
}
