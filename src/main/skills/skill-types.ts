export type SkillRootSource = 'default' | 'application' | 'custom'

export type SkillRootCategory = 'codex' | 'application' | 'shared' | 'custom'

export type SkillScope = 'system' | 'project'

export interface SkillApplication {
  id: string
  name: string
  source: 'builtin' | 'custom'
  detectionPaths: string[]
  systemSkillPaths: string[]
  projectSkillPaths: string[]
}

export interface SkillProject {
  id: string
  name: string
  path: string
  parentProjectId: string | null
  source?: 'manual' | 'auto'
}

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
  scope: SkillScope
  projectId: string | null
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
  applicationIds: string[]
  projectId: string | null
  scope: SkillScope
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
  dataUrl?: string
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

export interface TransferSkillInput {
  operation: 'add' | 'remove'
  skillPath: string
  applicationIds: string[]
  scope: SkillScope
  projectId?: string
}

export interface SkillCatalogSnapshot {
  applications: SkillApplication[]
  projects: SkillProject[]
  roots: SkillRoot[]
  skills: SkillSummary[]
  discovery: ProjectDiscoveryStatus
}

export interface ProjectDiscoveryStatus {
  phase: 'idle' | 'scanning' | 'cancelled'
  mode: 'quick' | 'deep' | null
  discoveredProjects: number
  scannedDirectories: number
  truncatedRoots: string[]
  completedAt: string | null
}
