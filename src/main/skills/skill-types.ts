export type SkillRootSource = 'default' | 'application' | 'custom'

export type SkillRootCategory = 'codex' | 'application' | 'shared' | 'custom'

export interface SkillRoot {
  id: string
  label: string
  path: string
  readonly: boolean
  defaultRoot: boolean
  exists: boolean
  source: SkillRootSource
  category: SkillRootCategory
  appIds: string[]
  appNames: string[]
  shared: boolean
}

export interface SkillIssue {
  severity: 'error' | 'warning'
  message: string
}

export interface SkillSummary {
  id: string
  name: string
  description: string
  path: string
  skillFilePath: string
  rootId: string
  rootLabel: string
  readonly: boolean
  system: boolean
  modifiedAt: string
  resourceDirs: string[]
  issues: SkillIssue[]
}

export interface SkillDetail extends SkillSummary {
  content: string
  frontmatter: Record<string, string>
  body: string
}

export type SkillFileKind = 'markdown' | 'script' | 'json' | 'text' | 'image' | 'binary'

export interface SkillFileTreeNode {
  name: string
  relativePath: string
  type: 'file' | 'directory'
  kind?: SkillFileKind
  size?: number
  modifiedAt?: string
  children?: SkillFileTreeNode[]
}

export interface SkillFileContent {
  name: string
  relativePath: string
  kind: SkillFileKind
  size: number
  modifiedAt: string
  content: string | null
  truncated: boolean
}

export interface ReadSkillFileInput {
  skillPath: string
  relativePath: string
}

export interface CreateSkillInput {
  rootId: string
  name: string
  description: string
  body?: string
  resourceDirs?: string[]
}

export interface ImportSkillInput {
  sourcePath: string
  rootId?: string
  name?: string
}

export interface UpdateSkillInput {
  path: string
  content: string
}
