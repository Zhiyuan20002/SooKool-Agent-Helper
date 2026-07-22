import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  ListBox,
  Select,
  ScrollShadow,
  Spinner,
  Tabs,
  TextField,
  Tooltip
} from '@heroui/react'
import { AgentIcon, Antigravity, Qwen, agentMappings } from '@lobehub/icons'
import {
  AlertTriangle,
  AppWindow,
  ArchiveRestore,
  ArrowRightLeft,
  BookText,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  CopyPlus,
  Cpu,
  Database,
  Eraser,
  File as FileIcon,
  FileCode2,
  FileText,
  Folder,
  FolderCog,
  FolderSearch,
  HardDrive,
  Image,
  Languages,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react'
import { resolveAppLanguage, translate, type AppLanguage, type AppLanguagePreference, type AppMetrics, type ThemeMode, type TranslationKey } from '@/i18n'
import { fileViewLabels, localizeSkillWarning, marketText, skillFileCopy } from '@/market-copy'
import {
  buildSkillLibraryTree,
  type SkillLibraryNode
} from '@/skill-library-tree'
import type { ViewType } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import type { SkillAgentAdapter, SkillsCommandResult } from '@/types/ecosystem'
import type {
  SkillApplication,
  SkillDetail,
  SkillFileContent,
  SkillFileKind,
  SkillFileTreeNode,
  SkillProject,
  SkillRoot,
  SkillSummary
} from '@/types/skills'
import { SkillMarket } from './SkillEcosystem'
import { MarkdownRenderer } from './MarkdownRenderer'
import { LocalShare } from './local-share/LocalShare'

const skillMarkdownPath = 'SKILL.md'

function useTranslator(): (
  key: TranslationKey,
  replacements?: Parameters<typeof translate>[2]
) => string {
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  return (key, replacements) => translate(language, key, replacements)
}

export function SkillLibrary({ view }: { view: ViewType }): React.JSX.Element {
  if (view === 'market') return <SkillMarket />
  if (view === 'local-share') return <LocalShare />
  if (view === 'settings') return <SettingsView scope="general" />
  if (view === 'skill-settings') return <SettingsView scope="skills" />
  return <SkillsView />
}

function SkillsView(): React.JSX.Element {
  const t = useTranslator()
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  const topologyCopy = skillTopologyCopy(t)
  const {
    skills,
    applications,
    projects,
    selectedSkill,
    skillRoots,
    search,
    rootFilter,
    issueFilter,
    libraryPerspective,
    loading,
    saving,
    error,
    setSearch,
    setRootFilter,
    setIssueFilter,
    setLibraryPerspective,
    refreshSkills,
    selectSkill,
    deleteSelectedSkill,
    revealSelectedSkill,
    clearError,
    setCurrentView,
    setLocalShareDraftSkillPath
  } = useAppStore()

  const [applying, setApplying] = useState(false)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())
  const [fileTree, setFileTree] = useState<SkillFileTreeNode[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState(skillMarkdownPath)
  const [selectedFileContent, setSelectedFileContent] = useState<SkillFileContent | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const rootById = useMemo(() => new Map(skillRoots.map((root) => [root.id, root])), [skillRoots])

  const filteredSkills = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return skills.filter((skill) => {
      const root = rootById.get(skill.rootId)
      const matchesSearch =
        !normalizedSearch ||
        skill.name.toLowerCase().includes(normalizedSearch) ||
        skill.description.toLowerCase().includes(normalizedSearch) ||
        skill.path.toLowerCase().includes(normalizedSearch)
      const matchesRoot = matchesRootFilter(skill, root, rootFilter)
      const matchesIssues = issueFilter === 'all' || skill.issues.length > 0
      return matchesSearch && matchesRoot && matchesIssues
    })
  }, [skills, search, rootFilter, issueFilter, rootById])

  const libraryTree = useMemo(
    () =>
      buildSkillLibraryTree(
        libraryPerspective,
        { applications, projects, roots: skillRoots, skills: filteredSkills },
        {
          shared: t('root.shared'),
          system: t('skills.scope.system'),
          unclassified: t('topology.unclassified')
        }
      ),
    [applications, projects, skillRoots, filteredSkills, libraryPerspective, t]
  )

  const applicationRootCount = applications.length
  const selectedRoot = selectedSkill ? rootById.get(selectedSkill.rootId) : null
  const searchActive = search.trim().length > 0
  const accordionExpandedIds = searchActive
    ? new Set(flattenLibraryNodeIds(libraryTree))
    : expandedGroupIds

  useEffect(() => {
    if (searchActive) return

    setExpandedGroupIds((current) => {
      const validIds = new Set(flattenLibraryNodeIds(libraryTree))
      const next = new Set([...current].filter((id) => validIds.has(id)))

      return sameSet(current, next) ? current : next
    })
  }, [libraryTree, searchActive])

  useEffect(() => {
    let mounted = true

    async function loadFiles(): Promise<void> {
      if (!selectedSkill) {
        setFileTree([])
        setSelectedFilePath(skillMarkdownPath)
        setSelectedFileContent(null)
        setFileError(null)
        return
      }

      setLoadingFile(true)
      setFileError(null)
      setSelectedFilePath(skillMarkdownPath)
      setSelectedFileContent(null)

      try {
        const nextTree = await window.aiHelper.invoke<SkillFileTreeNode[]>(
          'skill:listFiles',
          selectedSkill.path
        )
        if (!mounted) return
        setFileTree(ensureSkillMarkdownNode(nextTree, selectedSkill))
        setLoadingFile(false)
      } catch (error) {
        if (!mounted) return
        setFileTree(ensureSkillMarkdownNode([], selectedSkill))
        setFileError(stripErrorPrefix(String(error)))
        setLoadingFile(false)
      }
    }

    void loadFiles()
    return () => {
      mounted = false
    }
  }, [selectedSkill?.path])

  useEffect(() => {
    let mounted = true

    async function loadFileContent(): Promise<void> {
      if (!selectedSkill || selectedFilePath === skillMarkdownPath) {
        setSelectedFileContent(null)
        setFileError(null)
        return
      }

      setLoadingFile(true)
      setFileError(null)

      try {
        const nextContent = await window.aiHelper.invoke<SkillFileContent>('skill:readFile', {
          skillPath: selectedSkill.path,
          relativePath: selectedFilePath
        })
        if (!mounted) return
        setSelectedFileContent(nextContent)
        setLoadingFile(false)
      } catch (error) {
        if (!mounted) return
        setSelectedFileContent(null)
        setFileError(stripErrorPrefix(String(error)))
        setLoadingFile(false)
      }
    }

    void loadFileContent()
    return () => {
      mounted = false
    }
  }, [selectedSkill?.path, selectedFilePath])

  function toggleGroup(groupId: string): void {
    setExpandedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div className="skill-workbench">
      <section className="list-pane">
        <div className="pane-heading">
          <div>
            <div className="module-title"><BookText size={24} /><h2>{t('skills.title')}</h2></div>
            <p>{t('skills.count', { count: skills.length })}</p>
          </div>
          <div className="heading-actions">
            <IconButton label={t('settings.directories.title')} onPress={() => setCurrentView('skill-settings')}>
              <FolderCog size={17} />
            </IconButton>
            <IconButton label={t('skills.refresh')} onPress={() => void refreshSkills()}>
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </IconButton>
          </div>
        </div>

        <div className="library-controls">
          <div className="library-overview">
            <MetricCard value={skills.length} label={t('skills.metric.all')} icon={BookText} />
            <MetricCard
              value={applicationRootCount}
              label={t('skills.metric.apps')}
              icon={AppWindow}
            />
          </div>

          <Tabs
            className="library-perspective-tabs"
            aria-label={t('skills.title')}
            selectedKey={libraryPerspective}
            onSelectionChange={(key) => {
              if (key === 'application' || key === 'project') setLibraryPerspective(key)
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab id="application">
                  {topologyCopy.byApplication}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="project">
                  {topologyCopy.byProject}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          <div className="library-filter-grid">
            <TextField
              className="search-field"
              fullWidth
              variant="secondary"
              aria-label={t('skills.search')}
            >
              <Search className="search-field-icon" size={16} aria-hidden="true" />
              <Input
                className="search-input"
                fullWidth
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('skills.search')}
              />
            </TextField>

            <QuietSelect
              ariaLabel={t('skills.filter.source')}
              value={rootFilter}
              onChange={setRootFilter}
              items={buildRootFilterItems(skillRoots, t)}
            />
            <QuietSelect
              ariaLabel={t('skills.filter.status')}
              value={issueFilter}
              onChange={(value) => setIssueFilter(value as 'all' | 'issues')}
              items={[
                { id: 'all', label: t('skills.status.all') },
                { id: 'issues', label: t('skills.status.issues') }
              ]}
            />
          </div>
        </div>

        <ScrollShadow className="skill-list" size={24}>
          {libraryTree.map((node) => (
            <SkillLibraryTreeNodeView
              key={node.id}
              node={node}
              depth={0}
              expandedIds={accordionExpandedIds}
              selectedPath={selectedSkill?.path}
              onToggle={toggleGroup}
              onSelect={(path) => void selectSkill(path)}
            />
          ))}
          {libraryTree.length === 0 && (
            <div className="empty-state skill-list-empty-state">
              <FolderSearch size={34} />
              <p>{libraryPerspective === 'project' && projects.length === 0 ? topologyCopy.noProjects : t('skills.noMatches')}</p>
            </div>
          )}
        </ScrollShadow>
      </section>

      <section className="detail-pane">
        {error && (
          <div className="error-banner">
            <span>{stripErrorPrefix(error)}</span>
            <Button variant="ghost" size="sm" onPress={clearError}>
              {t('skills.apply.close')}
            </Button>
          </div>
        )}

        {!selectedSkill ? (
          <div className="detail-empty">
            <FileCode2 size={42} />
            <p>{t('skills.detail.empty')}</p>
          </div>
        ) : (
          <>
            <div className="detail-header">
              <div className="detail-title-row">
                <div className="title-row">
                  <h2>{selectedSkill.name}</h2>
                  {selectedSkill.readonly && (
                    <Chip className="status-pill readonly" color="default" size="sm" variant="soft">
                      {t('access.readonly')}
                    </Chip>
                  )}
                  {selectedSkill.issues.length === 0 && (
                    <Chip className="status-pill valid" color="success" size="sm" variant="soft">
                      <Check size={13} /> {t('skills.validated')}
                    </Chip>
                  )}
                </div>
                <div className="detail-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setLocalShareDraftSkillPath(selectedSkill.path)
                      setCurrentView('local-share')
                    }}
                  >
                    <Share2 size={15} />
                    {t('nav.localShare')}
                  </Button>
                  <Button
                    className={applying ? 'transfer-mode-button active' : 'transfer-mode-button'}
                    size="sm"
                    variant={applying ? 'secondary' : 'primary'}
                    onPress={() => setApplying((open) => !open)}
                  >
                    <ArrowRightLeft size={15} />
                    {t('skills.apply.title')}
                  </Button>
                  <IconButton label={t('skills.reveal')} onPress={() => void revealSelectedSkill()}>
                    <FolderSearch size={17} />
                  </IconButton>
                  <IconButton
                    label={t('skills.copyPath')}
                    onPress={() => void navigator.clipboard.writeText(selectedSkill.path)}
                  >
                    <Copy size={17} />
                  </IconButton>
                  <IconButton
                    label={skillFileCopy(language).deleteSkill}
                    variant="danger"
                    isDisabled={selectedSkill.readonly || saving}
                    onPress={() => {
                      if (confirm(t('skills.deleteConfirm', { name: selectedSkill.name })))
                        void deleteSelectedSkill()
                    }}
                  >
                    <Trash2 size={17} />
                  </IconButton>
                </div>
              </div>
              <p className="detail-description">{selectedSkill.description}</p>
            </div>

            <div className="meta-grid">
              <Meta
                label={t('market.sourceLabel')}
                value={formatRootDisplayLabel(selectedRoot, selectedSkill.rootLabel, t)}
                icon={<SettingsRootIcon root={selectedRoot ?? undefined} className="meta-icon" />}
              />
              <Meta
                label={t('skills.metric.apps')}
                value={formatRootApps(selectedRoot, t)}
                icon={<SettingsRootIcon root={selectedRoot ?? undefined} className="meta-icon" />}
              />
              <Meta
                label={t('skills.modified')}
                value={formatDate(selectedSkill.modifiedAt, language)}
                icon={<Clock3 className="meta-icon" />}
              />
            </div>

            {applying ? (
              <ApplySkillPanel
                skill={selectedSkill}
                onClose={() => setApplying(false)}
                onApplied={() => void refreshSkills()}
              />
            ) : (
              <>
                {selectedSkill.issues.length > 0 && (
                  <div className="issues">
                    {selectedSkill.issues.map((issue, index) => (
                      <div key={`${issue.message}-${index}`} className={`issue ${issue.severity}`}>
                        <AlertTriangle size={15} />
                        <span>{localizeSkillWarning(issue.message, language)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <SkillFileBrowser
                  skill={selectedSkill}
                  root={selectedRoot}
                  fileTree={fileTree}
                  selectedPath={selectedFilePath}
                  selectedContent={selectedFileContent}
                  loading={loadingFile}
                  error={fileError}
                  onSelect={setSelectedFilePath}
                />
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function SkillFileBrowser({
  skill,
  root,
  fileTree,
  selectedPath,
  selectedContent,
  loading,
  error,
  onSelect
}: {
  skill: SkillDetail
  root?: SkillRoot | null
  fileTree: SkillFileTreeNode[]
  selectedPath: string
  selectedContent: SkillFileContent | null
  loading: boolean
  error: string | null
  onSelect: (path: string) => void
}): React.JSX.Element {
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  const copy = skillFileCopy(language)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const selectedNode = findFileNode(fileTree, selectedPath)
  const isSkillMarkdown = selectedPath === skillMarkdownPath
  const title = selectedNode?.name || selectedContent?.name || skillMarkdownPath
  const subtitle = selectedNode?.relativePath || selectedContent?.relativePath || selectedPath
  const previewFile: SkillFileContent | null = isSkillMarkdown
    ? {
        name: skillMarkdownPath,
        relativePath: skillMarkdownPath,
        kind: 'markdown',
        size: skill.content.length,
        modifiedAt: skill.modifiedAt,
        content: skill.content,
        truncated: false
      }
    : selectedContent

  return (
    <div className={`skill-file-browser${sidebarCollapsed ? ' file-sidebar-collapsed' : ''}`}>
      <aside className="file-sidebar" aria-label={copy.fileList}>
        <div className="file-sidebar-header">
          <div>
            <strong>{copy.content}</strong>
            <span>{formatSkillRelativePath(skill, root)}</span>
          </div>
          <div className="file-sidebar-actions">
            {loading && <small>{copy.loading}</small>}
            <Button
              className="file-sidebar-toggle"
              aria-label={copy.collapse}
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => setSidebarCollapsed(true)}
            >
              <PanelLeftClose size={15} />
            </Button>
          </div>
        </div>
        <ScrollShadow className="file-tree" size={24}>
          {fileTree.map((node) => (
            <FileTreeNode
              key={node.relativePath}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
          {fileTree.length === 0 && !loading && <div className="file-empty">{copy.empty}</div>}
        </ScrollShadow>
      </aside>

      <section className="file-preview">
        <div className="file-preview-header">
          <div className="file-preview-title">
            {sidebarCollapsed && (
              <Button
                className="file-sidebar-toggle"
                aria-label={copy.expand}
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => setSidebarCollapsed(false)}
              >
                <PanelLeftOpen size={15} />
              </Button>
            )}
            <div>
              <strong>{title}</strong>
              <span>{subtitle}</span>
            </div>
          </div>
          <span className="file-kind-badge">
            {isSkillMarkdown
              ? 'Markdown'
              : formatFileKind(selectedContent?.kind || selectedNode?.kind, language)}
          </span>
        </div>

        {error && !isSkillMarkdown ? (
          <div className="file-preview-state">{error}</div>
        ) : loading && !isSkillMarkdown ? (
          <div className="file-preview-state">{copy.loading}</div>
        ) : (
          <FilePreviewContent file={previewFile} />
        )}
      </section>
    </div>
  )
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelect
}: {
  node: SkillFileTreeNode
  depth: number
  selectedPath: string
  onSelect: (path: string) => void
}): React.JSX.Element {
  if (node.type === 'directory') {
    return (
      <div className="file-tree-group">
        <div className="file-tree-folder" style={{ paddingLeft: 10 + depth * 14 }}>
          <Folder size={15} />
          <span>{node.name}</span>
        </div>
        {node.children?.map((child) => (
          <FileTreeNode
            key={child.relativePath}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  const active = node.relativePath === selectedPath

  return (
    <button
      type="button"
      className={`file-tree-file${active ? ' active' : ''}`}
      style={{ paddingLeft: 10 + depth * 14 }}
      onClick={() => onSelect(node.relativePath)}
    >
      <FileKindIcon kind={node.kind} />
      <span>{node.name}</span>
    </button>
  )
}

function FileKindIcon({ kind }: { kind?: SkillFileKind }): React.JSX.Element {
  if (kind === 'markdown') return <FileText size={15} />
  if (kind === 'script' || kind === 'json') return <FileCode2 size={15} />
  if (kind === 'image') return <Image size={15} />
  return <FileIcon size={15} />
}

function FilePreviewContent({ file }: { file: SkillFileContent | null }): React.JSX.Element {
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  const copy = skillFileCopy(language)
  const labels = fileViewLabels(language)
  const [view, setView] = useState<'preview' | 'source'>('preview')
  useEffect(() => setView('preview'), [file?.relativePath])
  if (!file) return <div className="file-preview-state">{copy.select}</div>

  const html = /\.html?$/i.test(file.name)
  const svg = file.name.toLowerCase().endsWith('.svg')
  if ((html && file.content) || (svg && file.content && file.dataUrl)) {
    return <div>
      <div className="file-view-switch"><button type="button" className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>{labels.preview}</button><button type="button" className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>{labels.source}</button></div>
      {view === 'source' ? <ScrollShadow className="file-preview-code text" orientation="horizontal" size={24}><pre>{file.content}</pre></ScrollShadow> : html ? <iframe className="file-html-preview" sandbox="" srcDoc={sandboxLocalHtml(file.content)} title={file.name} /> : <div className="file-image-preview"><img src={file.dataUrl} alt={file.name} /></div>}
    </div>
  }

  if (file.content === null) {
    if (file.kind === 'image' && file.dataUrl) {
      return <div className="file-image-preview"><img src={file.dataUrl} alt={file.name} /></div>
    }
    return (
      <div className="file-preview-state">
        <FileKindIcon kind={file.kind} />
        <span>{marketText(copy.unsupported, { kind: formatFileKind(file.kind, language) })}</span>
        <small>{formatBytes(file.size)}</small>
      </div>
    )
  }

  if (file.kind === 'markdown') {
    return (
      <ScrollShadow className="markdown-preview" size={24}>
        <MarkdownRenderer content={file.content} />
        {file.truncated && <div className="file-truncated-note">{copy.truncated}</div>}
      </ScrollShadow>
    )
  }

  return (
    <ScrollShadow className={`file-preview-code ${file.kind}`} orientation="horizontal" size={24}>
      <pre>
      {file.content}
      {file.truncated ? `\n\n-- ${copy.truncated} --` : ''}
      </pre>
    </ScrollShadow>
  )
}

function sandboxLocalHtml(content: string): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">`
  return /<head[\s>]/i.test(content) ? content.replace(/<head([^>]*)>/i, `<head$1>${policy}`) : `${policy}${content}`
}

function ApplySkillPanel({
  skill,
  onClose,
  onApplied
}: {
  skill: SkillDetail
  onClose: () => void
  onApplied: () => void
}): React.JSX.Element {
  const t = useTranslator()
  const projects = useAppStore((state) => state.projects)
  const [agents, setAgents] = useState<SkillAgentAdapter[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [runningCommand, setRunningCommand] = useState<'add' | 'remove' | null>(null)
  const [result, setResult] = useState<SkillsCommandResult | null>(null)
  const [targetScope, setTargetScope] = useState<'system' | 'project'>('system')
  const [projectId, setProjectId] = useState('')
  const selectedProject = projects.find((project) => project.id === projectId)

  useEffect(() => {
    let mounted = true

    async function loadAgents(): Promise<void> {
      const nextAgents = await window.aiHelper.invoke<SkillAgentAdapter[]>('ecosystem:agents')
      if (!mounted) return
      const installedAgents = nextAgents.filter((agent) => agent.installed)
      const installedIds = installedAgents.map((agent) => agent.id)
      setAgents(installedAgents)
      setSelectedAgents((current) => {
        const retained = current.filter((id) => installedIds.includes(id))
        if (retained.length > 0) return retained
        if (installedIds.includes('codex')) return ['codex']
        return installedIds.slice(0, 1)
      })
    }

    void loadAgents()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const availableIds = agents
      .filter((agent) => targetScope === 'system' ? Boolean(agent.globalPath) : Boolean(projectId && agent.projectPath))
      .map((agent) => agent.id)
    setSelectedAgents((current) => current.filter((id) => availableIds.includes(id)))
  }, [agents, projectId, targetScope])

  async function run(command: 'add' | 'remove'): Promise<void> {
    setRunningCommand(command)
    const nextResult = await window.aiHelper.invoke<SkillsCommandResult>('skill:transfer', {
      operation: command,
      skillPath: skill.path,
      applicationIds: selectedAgents,
      scope: targetScope,
      projectId: targetScope === 'project' ? projectId : undefined
    })
    setResult(nextResult)
    setRunningCommand(null)
    onApplied()
  }

  function toggleAgent(id: string): void {
    setSelectedAgents((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  return (
    <Card className="apply-workspace" variant="secondary">
      <Card.Header className="apply-header">
        <div className="apply-heading-copy">
          <Card.Title>{t('skills.apply.heading')}</Card.Title>
          <Card.Description>{t('skills.apply.description')}</Card.Description>
        </div>
        <Button
          className="apply-close-button"
          aria-label={t('skills.apply.close')}
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={onClose}
        >
          <X size={16} />
        </Button>
      </Card.Header>

      <Card.Content className="apply-content-shell">
        <ScrollShadow className="apply-content" size={24}>
        <div className="apply-selection-bar">
          <span>{t('skills.apply.select')}</span>
          <Chip color="accent" size="sm" variant="soft">
            <Chip.Label>{t('skills.apply.selected', { count: selectedAgents.length })}</Chip.Label>
          </Chip>
        </div>
        <div className="install-options">
          <Tabs
            className="apply-scope-tabs"
            aria-label={t('skills.apply.select')}
            selectedKey={targetScope}
            onSelectionChange={(key) => {
              const nextScope = key === 'project' ? 'project' : 'system'
              setTargetScope(nextScope)
              if (nextScope === 'project' && !projectId && projects[0]) setProjectId(projects[0].id)
            }}
          >
            <Tabs.ListContainer><Tabs.List>
              <Tabs.Tab id="system">{t('skills.scope.system')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="project">{t('skills.scope.project')}<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List></Tabs.ListContainer>
          </Tabs>
          {targetScope === 'project' && (
            <Select
              className="project-picker"
              aria-label={t('topology.projectDirectories')}
              selectedKey={projectId || null}
              onSelectionChange={(key) => setProjectId(key ? String(key) : '')}
            >
              <Select.Trigger>
                <Select.Value>{projects.find((project) => project.id === projectId)?.name || t('topology.projectDirectories')}</Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom start">
                <ScrollShadow className="project-picker-scroll" size={20}>
                  <ListBox aria-label={t('topology.projectDirectories')}>
                    {projects.map((project) => (
                      <ListBox.Item key={project.id} id={project.id} textValue={`${project.name} — ${project.path}`}>
                        <span className="project-picker-option">
                          <strong>{project.name}</strong>
                          <small>{project.path}</small>
                        </span>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </ScrollShadow>
              </Select.Popover>
            </Select>
          )}
        </div>
        <div className="apply-agent-grid">
          {agents.map((agent) => {
            const selected = selectedAgents.includes(agent.id)
            const targetPath = targetScope === 'system'
              ? agent.globalPath
              : selectedProject && agent.projectPath
                ? resolveProjectSkillPath(selectedProject.path, agent.projectPath)
                : null
            const displayPath = targetScope === 'project' && selectedProject && targetPath
              ? `${selectedProject.name}/${projectRelativeDisplayPath(selectedProject.path, targetPath)}`
              : targetPath
                ? systemRelativeDisplayPath(targetPath)
                : null
            return (
              <Checkbox
                key={agent.id}
                className={`apply-agent${selected ? ' selected' : ''}`}
                id={`apply-agent-${agent.id}`}
                isDisabled={runningCommand !== null || !targetPath}
                isSelected={selected}
                variant="secondary"
                onChange={(isSelected) => {
                  if (isSelected !== selected) toggleAgent(agent.id)
                }}
              >
                <Checkbox.Content className="apply-agent-content">
                  <SoftwareIcon agent={agent} className="apply-agent-icon" />
                  <span className="apply-agent-copy">
                    <strong>{agent.name}</strong>
                    <small>{displayPath || t('topology.projectPath')}</small>
                  </span>
                  <Checkbox.Control className="apply-agent-control">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
            )
          })}
          {agents.length === 0 && <div className="apply-empty">{t('skills.apply.empty')}</div>}
        </div>

        {result && <InlineCommandOutput result={result} />}
        </ScrollShadow>
      </Card.Content>

      <footer className="apply-footer">
        <span>{t('skills.apply.selected', { count: selectedAgents.length })}</span>
        <div className="apply-actions">
          <Button
            isPending={runningCommand === 'remove'}
            variant="ghost"
            size="sm"
            isDisabled={selectedAgents.length === 0 || runningCommand !== null || (targetScope === 'project' && !projectId)}
            onPress={() => void run('remove')}
          >
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : <Trash2 size={14} />}
                {isPending ? t('skills.apply.removing') : t('skills.apply.remove')}
              </>
            )}
          </Button>
          <Button
            isPending={runningCommand === 'add'}
            variant="primary"
            size="sm"
            isDisabled={selectedAgents.length === 0 || runningCommand !== null || (targetScope === 'project' && !projectId)}
            onPress={() => void run('add')}
          >
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : <CopyPlus size={14} />}
                {isPending ? t('skills.apply.transferring') : t('skills.apply.add')}
              </>
            )}
          </Button>
        </div>
      </footer>
    </Card>
  )
}

function InlineCommandOutput({ result }: { result: SkillsCommandResult }): React.JSX.Element {
  const t = useTranslator()
  const output = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim()

  return (
    <div className={`inline-command-output${result.exitCode === 0 ? ' success' : ' failure'}`}>
      <div className="inline-command-summary">
        {result.exitCode === 0 ? <Check size={15} /> : <AlertTriangle size={15} />}
        <strong>{result.exitCode === 0 ? t('command.done') : t('command.failed')}</strong>
      </div>
      <details>
        <summary>{t('skills.apply.details')}</summary>
        <code>{result.command}</code>
        <ScrollShadow className="inline-command-scroll" orientation="horizontal" size={20}><pre>{output || t('command.empty')}</pre></ScrollShadow>
      </details>
    </div>
  )
}

function QuietSelect({
  ariaLabel,
  value,
  items,
  onChange
}: {
  ariaLabel: string
  value: string
  items: Array<{ id: string; label: string }>
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <Select
      fullWidth
      variant="secondary"
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label={ariaLabel}>
          {items.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
              {item.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

function SkillLibraryTreeNodeView({
  node,
  depth,
  expandedIds,
  selectedPath,
  onToggle,
  onSelect
}: {
  node: SkillLibraryNode
  depth: number
  expandedIds: Set<string>
  selectedPath?: string
  onToggle: (id: string) => void
  onSelect: (path: string) => void
}): React.JSX.Element {
  const t = useTranslator()
  const expanded = expandedIds.has(node.id)
  const contentId = `skill-group-${node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const count = countLibraryNodeSkills(node)
  const Icon = node.kind === 'application'
    ? AppWindow
    : node.kind === 'shared'
      ? Share2
      : node.kind === 'project'
        ? Folder
        : BookText
  const applicationIcon = node.kind === 'application'
    ? renderApplicationIcon([node.applicationId, node.label], 22)
    : null
  return (
    <section className={`skill-group skill-tree-depth-${Math.min(depth, 3)} skill-tree-kind-${node.kind}`} aria-label={node.label}>
      <button
        type="button"
        className="skill-group-heading"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => onToggle(node.id)}
      >
        <span className="skill-group-icon settings-row-icon-fallback">
          {applicationIcon || <Icon size={18} />}
        </span>
        <span className="skill-group-title">
          <strong>{node.label}</strong>
          <span>{node.path || (node.kind === 'system' ? t('skills.tree.systemDirectory') : node.kind === 'project' ? t('skills.tree.projectDirectory') : node.kind === 'shared' ? t('root.shared') : t('skills.tree.application'))}</span>
        </span>
        <span className="skill-group-actions">
          <span className="skill-group-count">{count}</span>
          <ChevronDown className="skill-group-chevron" size={14} />
        </span>
      </button>
      {expanded && (
        <div id={contentId} className="skill-group-items">
          {node.skills.map((skill) => (
            <SkillListItem
              key={`${node.id}:${skill.id}`}
              skill={skill}
              active={selectedPath === skill.path}
              onPress={() => onSelect(skill.path)}
            />
          ))}
          {node.children.map((child) => (
            <SkillLibraryTreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function countLibraryNodeSkills(node: SkillLibraryNode): number {
  return node.skills.length + node.children.reduce((total, child) => total + countLibraryNodeSkills(child), 0)
}

function flattenLibraryNodeIds(nodes: SkillLibraryNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...flattenLibraryNodeIds(node.children)])
}

function SkillListItem({
  skill,
  active,
  onPress
}: {
  skill: SkillSummary
  active: boolean
  onPress: () => void
}): React.JSX.Element {
  const t = useTranslator()

  return (
    <Button className="skill-row" variant={active ? 'secondary' : 'ghost'} onPress={onPress}>
      <div className="row-main">
        <div>
          <strong>{skill.name}</strong>
          <p>{skill.description}</p>
        </div>
        {skill.issues.length > 0 && <AlertTriangle size={16} className="warn-icon" />}
      </div>
      {skill.readonly && <div className="row-meta">
        <Chip size="sm" variant="tertiary" color="default">
          {t('access.readonly')}
        </Chip>
      </div>}
    </Button>
  )
}

type SettingsSectionId = 'general' | 'resources' | 'applications' | 'projects' | 'backups'

function SettingsView({ scope }: { scope: 'general' | 'skills' }): React.JSX.Element {
  const t = useTranslator()
  const {
    backups,
    skillRoots,
    applications,
    projects,
    skills,
    preferences,
    appMetrics,
    projectDiscovery,
    projectScanRoots,
    projectScanRunning,
    addProject,
    removeProject,
    saveApplicationRule,
    removeApplicationRule,
    loadAppMetrics,
    updatePreferences,
    refreshSkills,
    cancelProjectScan,
    addProjectScanRoot,
    removeProjectScanRoot
  } = useAppStore()
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(scope === 'general' ? 'general' : 'applications')
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleName, setRuleName] = useState('')
  const [systemPath, setSystemPath] = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [resourceCleaning, setResourceCleaning] = useState<string | null>(null)
  const [resourceNotice, setResourceNotice] = useState('')
  const customRoots = skillRoots.filter((root) => root.source === 'custom')
  const existingRoots = skillRoots.filter((root) => root.exists)
  const language = resolveAppLanguage(preferences.language)
  const topologyCopy = skillTopologyCopy(t)
  const allSettingsSections: Array<{
    id: SettingsSectionId
    label: string
    icon: React.ElementType
  }> = [
    { id: 'general', label: t('settings.tabs.general'), icon: SlidersHorizontal },
    { id: 'resources', label: t('settings.tabs.resources'), icon: HardDrive },
    { id: 'applications', label: topologyCopy.applications, icon: AppWindow },
    { id: 'projects', label: topologyCopy.projects, icon: FolderSearch },
    { id: 'backups', label: t('settings.tabs.backups'), icon: ArchiveRestore }
  ]
  const settingsSections = allSettingsSections.filter((section) => scope === 'general' ? section.id === 'general' || section.id === 'resources' : section.id === 'applications' || section.id === 'projects' || section.id === 'backups')

  useEffect(() => setActiveSection(scope === 'general' ? 'general' : 'applications'), [scope])

  useEffect(() => {
    if (activeSection === 'resources') void loadAppMetrics()
  }, [activeSection, loadAppMetrics])

  async function cleanResource(id: 'market-catalogs' | 'market-previews' | 'browser-cache' | 'logs' | 'all'): Promise<void> {
    const before = appMetrics?.storage.totalBytes ?? 0
    setResourceCleaning(id)
    setResourceNotice('')
    try {
      const storage = await window.aiHelper.invoke<AppMetrics['storage']>('app:clearResource', id)
      await loadAppMetrics()
      setResourceNotice(t('settings.resources.cleaned', { size: formatBytes(Math.max(0, before - storage.totalBytes)) }))
    } finally {
      setResourceCleaning(null)
    }
  }

  async function submitApplicationRule(): Promise<void> {
    if (!ruleName.trim() || (!systemPath.trim() && !projectPath.trim())) return
    await saveApplicationRule({
      id: `custom-${crypto.randomUUID()}`,
      name: ruleName.trim(),
      source: 'custom',
      detectionPaths: [],
      systemSkillPaths: systemPath.trim() ? [systemPath.trim()] : [],
      projectSkillPaths: projectPath.trim() ? [projectPath.trim()] : []
    })
    setRuleName('')
    setSystemPath('')
    setProjectPath('')
    setShowRuleForm(false)
  }

  return (
    <div className="single-pane settings-pane">
      <div className="pane-heading">
        <div>
          {scope === 'skills' ? <div className="module-title"><Settings2 size={24} /><h2>{t('settings.skill.title')}</h2></div> : <h2>{t('settings.title')}</h2>}
          <p>{scope === 'general' ? t('settings.description') : t('settings.skill.description')}</p>
        </div>
        {scope === 'skills' && <div className="heading-actions">
          <Button size="sm" variant="secondary" onPress={() => { setActiveSection('applications'); setShowRuleForm(true) }}><Plus size={16} />{topologyCopy.addApplication}</Button>
          <Button size="sm" variant="primary" onPress={() => { setActiveSection('projects'); void addProject() }}><Folder size={16} />{topologyCopy.addProject}</Button>
        </div>}
      </div>

      {scope === 'skills' && <div className="settings-grid">
        <MetricCard value={skills.length} label={t('settings.metrics.skills')} icon={BookText} />
        <MetricCard
          value={existingRoots.length}
          label={t('settings.metrics.detectedRoots')}
          icon={FolderSearch}
        />
        <MetricCard
          value={applications.length}
          label={topologyCopy.applications}
          icon={Folder}
        />
        <MetricCard
          value={backups.length}
          label={t('settings.metrics.backups')}
          icon={ArchiveRestore}
        />
      </div>}

      <div className="settings-layout">
        <aside className="settings-nav" aria-label={t('settings.title')}>
          {settingsSections.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                type="button"
                className={`settings-nav-item${activeSection === section.id ? ' active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <Icon size={17} />
                <span>{section.label}</span>
              </button>
            )
          })}
        </aside>

        <ScrollShadow className={`settings-detail${activeSection === 'applications' || activeSection === 'projects' || activeSection === 'backups' ? ' scroll-contained' : ''}`} size={24}>
          {activeSection === 'general' && (
            <div className="settings-section">
              <div className="settings-section-heading">
                <div>
                  <h3>{t('settings.general.title')}</h3>
                  <p>{t('settings.general.description')}</p>
                </div>
              </div>

              <SettingsControlRow
                icon={Palette}
                title={t('settings.appearance')}
                control={
                  <QuietSelect
                    ariaLabel={t('settings.appearance')}
                    value={preferences.themeMode}
                    onChange={(value) => void updatePreferences({ themeMode: value as ThemeMode })}
                    items={[
                      { id: 'system', label: t('settings.theme.system') },
                      { id: 'light', label: t('settings.theme.light') },
                      { id: 'dark', label: t('settings.theme.dark') }
                    ]}
                  />
                }
              />

              <SettingsControlRow
                icon={Languages}
                title={t('settings.language')}
                control={
                  <QuietSelect
                    ariaLabel={t('settings.language')}
                    value={preferences.language}
                    onChange={(value) => void updatePreferences({ language: value as AppLanguagePreference })}
                    items={[
                      { id: 'system', label: t('settings.language.system') },
                      { id: 'zh-CN', label: t('settings.language.zh') },
                      { id: 'zh-HK', label: t('settings.language.zhHK') },
                      { id: 'en-US', label: t('settings.language.en') },
                      { id: 'ja-JP', label: t('settings.language.ja') },
                      { id: 'fr-FR', label: t('settings.language.fr') },
                      { id: 'ko-KR', label: t('settings.language.ko') },
                      { id: 'es-ES', label: t('settings.language.es') },
                      { id: 'pt-BR', label: t('settings.language.pt') },
                      { id: 'ar', label: t('settings.language.ar') }
                    ]}
                  />
                }
              />

              <SettingsControlRow
                icon={RefreshCw}
                title={t('settings.autoScan')}
                description={t('settings.autoScan.description')}
                control={
                  <Tabs className="settings-auto-scan-tabs" aria-label={t('settings.autoScan')} selectedKey={preferences.autoScanOnStart ? 'on' : 'off'} onSelectionChange={(key) => void updatePreferences({ autoScanOnStart: key === 'on' })}>
                    <Tabs.ListContainer><Tabs.List>
                      <Tabs.Tab id="on">{t('settings.status.on')}<Tabs.Indicator /></Tabs.Tab>
                      <Tabs.Tab id="off">{t('settings.status.off')}<Tabs.Indicator /></Tabs.Tab>
                    </Tabs.List></Tabs.ListContainer>
                  </Tabs>
                }
              />

            </div>
          )}

          {activeSection === 'resources' && (
            <div className="settings-section">
              <div className="settings-section-heading">
                <div>
                  <h3>{t('settings.resources.title')}</h3>
                  <p>{t('settings.resources.description')}</p>
                </div>
                <IconButton
                  label={t('settings.resources.refresh')}
                  onPress={() => void loadAppMetrics()}
                >
                  <RefreshCw size={17} />
                </IconButton>
              </div>

              <div className="settings-resource-grid">
                <ResourceMetric
                  label={t('settings.resources.rss')}
                  value={formatBytes(appMetrics?.memory.rss || 0)}
                />
                <ResourceMetric
                  label={t('settings.resources.heapUsed')}
                  value={formatBytes(appMetrics?.memory.heapUsed || 0)}
                />
                <ResourceMetric
                  label={t('settings.resources.heapTotal')}
                  value={formatBytes(appMetrics?.memory.heapTotal || 0)}
                />
                <ResourceMetric
                  label={t('settings.resources.external')}
                  value={formatBytes(appMetrics?.memory.external || 0)}
                />
                <ResourceMetric
                  label={t('settings.resources.arrayBuffers')}
                  value={formatBytes(appMetrics?.memory.arrayBuffers || 0)}
                />
                <ResourceMetric
                  label={t('settings.resources.uptime')}
                  value={formatDuration(appMetrics?.uptime || 0)}
                />
              </div>

              <div className="settings-info-list">
                <InfoRow
                  label={t('settings.resources.appVersion')}
                  value={appMetrics?.version || '-'}
                />
                <InfoRow
                  label={t('settings.resources.runtime')}
                  value={appMetrics ? `${appMetrics.platform} / ${appMetrics.arch}` : '-'}
                />
              </div>

              <div className="resource-subsection-heading">
                <div>
                  <h4><Cpu size={16} />{t('settings.resources.processes')}</h4>
                </div>
              </div>
              <div className="resource-process-list">
                {(appMetrics?.processes || []).map((item) => (
                  <div className="resource-process-row" key={`${item.type}-${item.pid}`}>
                    <div>
                      <strong>{formatProcessName(item.type, item.name)}</strong>
                      <span>PID {item.pid}</span>
                    </div>
                    <span><b>{t('settings.resources.cpu')}</b>{item.cpuPercent.toFixed(1)}%</span>
                    <span><b>{t('settings.resources.memory')}</b>{formatBytes(item.memory?.workingSet || 0)}</span>
                  </div>
                ))}
              </div>

              <div className="resource-subsection-heading resource-storage-heading">
                <div>
                  <h4><Database size={16} />{t('settings.resources.storage')}</h4>
                  <p>{t('settings.resources.storageDescription')}</p>
                </div>
                <div className="resource-storage-actions">
                  {resourceNotice && <span>{resourceNotice}</span>}
                  <strong>{t('settings.resources.storageTotal')}: {formatBytes(appMetrics?.storage.totalBytes || 0)}</strong>
                  <Button
                    size="sm"
                    variant="secondary"
                    isPending={resourceCleaning === 'all'}
                    isDisabled={Boolean(resourceCleaning) || !appMetrics?.storage.totalBytes}
                    onPress={() => void cleanResource('all')}
                  >
                    <Eraser size={15} />{resourceCleaning === 'all' ? t('settings.resources.cleaning') : t('settings.resources.cleanAll')}
                  </Button>
                </div>
              </div>
              <div className="resource-storage-list">
                {(appMetrics?.storage.categories || []).map((category) => {
                  const copy = resourceCategoryCopy(category.id, t)
                  return (
                    <section className="resource-storage-card" key={category.id}>
                        <div className="resource-storage-card-head">
                          <span className="resource-storage-icon" aria-hidden="true">
                            {resourceCategoryIcon(category.id)}
                          </span>
                          <div className="resource-storage-main">
                            <strong>{copy.title}</strong>
                            <p>{copy.description}</p>
                          </div>
                          <strong className="resource-storage-size">{formatBytes(category.bytes)}</strong>
                        </div>
                        <span className="resource-storage-path" title={category.path}>{category.path}</span>
                        <div className="resource-storage-footer">
                          <span className="resource-storage-meta">
                          <span>{t('settings.resources.files', { count: category.files })} · {t('settings.resources.directories', { count: category.directories })}</span>
                          </span>
                          <Button
                            size="sm"
                            variant="tertiary"
                            isPending={resourceCleaning === category.id}
                            isDisabled={Boolean(resourceCleaning) || category.bytes === 0}
                            onPress={() => void cleanResource(category.id)}
                          >
                            {resourceCleaning === category.id ? t('settings.resources.cleaning') : t('settings.resources.clean')}
                          </Button>
                        </div>
                    </section>
                  )
                })}
              </div>
            </div>
          )}

          {activeSection === 'applications' && (
            <div className="settings-section settings-section-scroll">
              <div className="settings-section-heading">
                <div>
                  <h3>{topologyCopy.applicationRules}</h3>
                  <p>{topologyCopy.applicationDescription}</p>
                </div>
              </div>
              {showRuleForm && <Card className="topology-rule-form" variant="secondary">
                <Card.Content>
                  <TextField><Input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder={topologyCopy.applicationName} /></TextField>
                  <TextField><Input value={systemPath} onChange={(event) => setSystemPath(event.target.value)} placeholder={topologyCopy.systemPath} /></TextField>
                  <TextField><Input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} placeholder={topologyCopy.projectPath} /></TextField>
                  <div className="heading-actions"><Button size="sm" variant="ghost" onPress={() => setShowRuleForm(false)}>{topologyCopy.cancel}</Button><Button size="sm" variant="primary" onPress={() => void submitApplicationRule()}>{topologyCopy.save}</Button></div>
                </Card.Content>
              </Card>}
              <ScrollShadow className="root-list" size={24}>
                {applications.map((application) => (
                  <div key={application.id} className="root-row">
                    <ApplicationRuleIcon application={application} />
                    <div className="settings-row-main">
                      <strong>{application.name}</strong>
                      <p>{topologyCopy.systemLabel}: {application.systemSkillPaths.join(', ') || '-'}</p>
                      <p>{topologyCopy.projectLabel}: {application.projectSkillPaths.join(', ') || '-'}</p>
                    </div>
                    {application.source === 'custom' ? <IconButton label={topologyCopy.remove} variant="danger" onPress={() => void removeApplicationRule(application.id)}><Trash2 size={16} /></IconButton> : <span className="settings-row-meta">{topologyCopy.builtin}</span>}
                  </div>
                ))}
                {customRoots.length > 0 && <div className="legacy-root-heading">{topologyCopy.unclassified}</div>}
                {customRoots.map((root) => <div key={root.id} className="root-row"><SettingsRootIcon root={root} /><div className="settings-row-main"><strong>{root.label}</strong><p>{root.path}</p></div><span className="settings-row-meta">{topologyCopy.unclassified}</span></div>)}
              </ScrollShadow>
            </div>
          )}

          {activeSection === 'projects' && (
            <div className="settings-section settings-section-scroll">
              <div className="settings-section-heading">
                <div><h3>{topologyCopy.projectDirectories}</h3><p>{topologyCopy.projectDescription}</p></div>
                <div className="heading-actions">
                  {projectScanRunning ? (
                    <Button size="sm" variant="secondary" onPress={() => void cancelProjectScan()}><X size={15} />{t('discovery.cancel')}</Button>
                  ) : <>
                    <Button size="sm" variant="secondary" onPress={() => void refreshSkills('quick')}><RefreshCw size={15} />{t('discovery.quickScan')}</Button>
                    <Button size="sm" variant="primary" onPress={() => void refreshSkills('deep')}><FolderSearch size={15} />{t('discovery.deepScan')}</Button>
                  </>}
                </div>
              </div>
              <div className="project-discovery-strip">
                <span className={`project-discovery-dot${projectScanRunning ? ' scanning' : ''}`} />
                <span>{projectScanRunning ? t('discovery.scanning') : t('discovery.ready')}</span>
                <span>{t('discovery.found', { count: projectDiscovery.discoveredProjects })}</span>
                {projectDiscovery.scannedDirectories > 0 && <span>{t('discovery.checked', { count: projectDiscovery.scannedDirectories })}</span>}
                {projectDiscovery.completedAt && <span>{t('discovery.lastScan', { time: formatDate(projectDiscovery.completedAt, language) })}</span>}
              </div>
              <div className="scan-root-heading">
                <div><strong>{t('discovery.scanLocations')}</strong><p>{t('discovery.scanLocationsDescription')}</p></div>
                <Button size="sm" variant="ghost" onPress={() => void addProjectScanRoot()}><Plus size={15} />{t('discovery.addLocation')}</Button>
              </div>
              {projectScanRoots.length > 0 && <div className="scan-root-list">
                {projectScanRoots.map((path) => <div key={path} className="scan-root-row"><Folder size={16} /><span title={path}>{path}</span><IconButton label={t('discovery.removeLocation')} variant="danger" onPress={() => void removeProjectScanRoot(path)}><Trash2 size={15} /></IconButton></div>)}
              </div>}
              <ScrollShadow className="root-list" size={24}>
                {flattenProjects(projects).map(({ project, depth }) => <div key={project.id} className="root-row" style={{ paddingLeft: 12 + depth * 18 }}><span className="settings-row-icon settings-row-icon-fallback"><Folder size={24} /></span><div className="settings-row-main"><strong>{project.name}</strong><p>{project.path}</p><p>{project.parentProjectId ? topologyCopy.nestedProject : topologyCopy.rootProject}</p></div><IconButton label={project.source === 'auto' ? t('discovery.ignoreProject') : topologyCopy.removeRegistration} variant="danger" onPress={() => { if (confirm(project.source === 'auto' ? t('discovery.ignoreProjectConfirm') : topologyCopy.removeProjectConfirm)) void removeProject(project.id) }}><Trash2 size={16} /></IconButton></div>)}
                {projects.length === 0 && <div className="empty-state compact-empty"><FolderSearch size={30} /><p>{topologyCopy.noProjects}</p></div>}
              </ScrollShadow>
            </div>
          )}

          {activeSection === 'backups' && (
            <div className="settings-section settings-section-scroll">
              <div className="settings-section-heading">
                <div>
                  <h3>{t('settings.backups.title')}</h3>
                  <p>{t('settings.backups.description')}</p>
                </div>
              </div>
              <ScrollShadow className="root-list" size={24}>
                {backups.map((backup) => (
                  <div key={backup.id} className="root-row">
                    <span className="settings-row-icon settings-row-icon-fallback">
                      <Folder size={28} strokeWidth={1.8} />
                    </span>
                    <div className="settings-row-main">
                      <strong>{backup.skillName}</strong>
                      <p>{backup.originalPath}</p>
                      <p>{backup.backupPath}</p>
                    </div>
                    <span className="settings-row-meta">
                      {formatDate(backup.createdAt, language)}
                    </span>
                  </div>
                ))}
                {backups.length === 0 && (
                  <div className="empty-state compact-empty">
                    <Trash2 size={30} />
                    <p>{t('settings.backups.empty')}</p>
                  </div>
                )}
              </ScrollShadow>
            </div>
          )}
        </ScrollShadow>
      </div>
    </div>
  )
}

function SettingsControlRow({
  icon: Icon,
  title,
  description,
  control
}: {
  icon: React.ElementType
  title: string
  description?: string
  control: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="settings-control-row">
      <span className="settings-row-icon settings-row-icon-fallback">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <div className="settings-row-main">
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-control">{control}</div>
    </div>
  )
}

function ResourceMetric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="resource-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="settings-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SettingsRootIcon({
  root,
  className = 'settings-row-icon'
}: {
  root?: SkillRoot
  className?: string
}): React.JSX.Element {
  if (root?.category === 'shared' || root?.shared) {
    return (
      <span className={`${className} shared-root-icon`}>
        <Share2 size={22} strokeWidth={1.8} />
      </span>
    )
  }

  const icon = root
    ? renderApplicationIcon([root.appIds, root.appNames, root.label], 32)
    : null

  if (icon) {
    return (
      <span className={className}>
        {icon}
      </span>
    )
  }

  return (
    <span className={`${className} settings-row-icon-fallback`}>
      <Folder size={28} strokeWidth={1.8} />
    </span>
  )
}

function SoftwareIcon({
  agent,
  className
}: {
  agent: SkillAgentAdapter
  className: string
}): React.JSX.Element {
  const icon = renderApplicationIcon([
    agent.id,
    agent.name,
    agent.globalPath,
    agent.projectPath
  ], 24)

  if (icon) {
    return (
      <span className={className}>
        {icon}
      </span>
    )
  }

  return (
    <span className={`${className} settings-row-icon-fallback`}>
      <Folder size={24} strokeWidth={1.8} />
    </span>
  )
}

function ApplicationRuleIcon({ application }: { application: SkillApplication }): React.JSX.Element {
  const icon = renderApplicationIcon([
    application.id,
    application.name,
    application.systemSkillPaths,
    application.projectSkillPaths
  ], 24)

  if (icon) {
    return (
      <span className="settings-row-icon">
        {icon}
      </span>
    )
  }

  return (
    <span className="settings-row-icon settings-row-icon-fallback">
      <AppWindow size={24} strokeWidth={1.8} />
    </span>
  )
}

function renderApplicationIcon(
  candidates: Array<string | string[] | null | undefined>,
  size: number
): React.JSX.Element | null {
  const text = candidates.flat().filter((candidate): candidate is string => Boolean(candidate)).join(' ').toLowerCase()
  if (text.includes('lingma')) return <AgentIcon agent="qoder" size={size} type="color" />
  if (text.includes('iflow')) return <Qwen.Color size={size} />
  if (text.includes('antigravity')) return <Antigravity.Color size={size} />

  const lobeAgent = findLobeAgentNameFromCandidates(candidates)
  if (!lobeAgent) return null
  if (lobeAgent === 'kimi') {
    return <AgentIcon agent="kimi" size={size} type="mono" style={{ color: '#171717' }} />
  }
  return <AgentIcon agent={lobeAgent} size={size} type="color" />
}

function IconButton({
  label,
  isDisabled,
  children,
  variant = 'secondary',
  onPress
}: {
  label: string
  isDisabled?: boolean
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger'
  onPress: () => void
}): React.JSX.Element {
  return (
    <Tooltip delay={350} closeDelay={100}>
      <Button
        aria-label={label}
        isDisabled={isDisabled}
        isIconOnly
        size="md"
        variant={variant}
        onPress={onPress}
      >
        {children}
      </Button>
      <Tooltip.Content showArrow placement="bottom">
        <Tooltip.Arrow />
        <span>{label}</span>
      </Tooltip.Content>
    </Tooltip>
  )
}

function MetricCard({
  value,
  label,
  icon: Icon
}: {
  value: number
  label: string
  icon?: React.ElementType
}): React.JSX.Element {
  return (
    <Card className="metric-card" variant="tertiary">
      <Card.Content className="metric-card-content">
        <div className="metric-label-row">
          {Icon && (
            <span className="metric-icon">
              <Icon size={15} />
            </span>
          )}
          <span className="metric-label">{label}</span>
        </div>
        <strong>{value}</strong>
      </Card.Content>
    </Card>
  )
}
function Meta({
  label,
  value,
  icon
}: {
  label: string
  value: string
  icon?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <div className="meta-value">
        {icon}
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function formatDate(value: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function stripErrorPrefix(value: string): string {
  return value.replace(/^Error:\s*/, '')
}

function findFileNode(
  nodes: SkillFileTreeNode[],
  relativePath: string
): SkillFileTreeNode | undefined {
  for (const node of nodes) {
    if (node.relativePath === relativePath) return node
    if (node.children) {
      const child = findFileNode(node.children, relativePath)
      if (child) return child
    }
  }
  return undefined
}

function ensureSkillMarkdownNode(
  nodes: SkillFileTreeNode[],
  skill: SkillDetail
): SkillFileTreeNode[] {
  if (findFileNode(nodes, skillMarkdownPath)) return nodes

  return [
    {
      name: skillMarkdownPath,
      relativePath: skillMarkdownPath,
      type: 'file',
      kind: 'markdown',
      size: skill.content.length,
      modifiedAt: skill.modifiedAt
    },
    ...nodes
  ]
}

function formatFileKind(kind: SkillFileKind | undefined, language: AppLanguage): string {
  if (kind === 'markdown') return 'Markdown'
  if (kind === 'script') return translate(language, 'format.script')
  if (kind === 'json') return 'JSON'
  if (kind === 'text') return translate(language, 'format.text')
  if (kind === 'image') return translate(language, 'format.image')
  return translate(language, 'format.file')
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60)
  if (totalMinutes < 1) return '< 1 min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`
}

function formatProcessName(type: string, name?: string): string {
  if (name?.trim()) return name
  return type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function resourceCategoryCopy(
  id: AppMetrics['storage']['categories'][number]['id'],
  t: ReturnType<typeof useTranslator>
): { title: string; description: string } {
  const keys = {
    'market-catalogs': ['settings.resources.marketCatalogs', 'settings.resources.marketCatalogsDescription'],
    'market-previews': ['settings.resources.marketPreviews', 'settings.resources.marketPreviewsDescription'],
    'browser-cache': ['settings.resources.browserCache', 'settings.resources.browserCacheDescription'],
    logs: ['settings.resources.logs', 'settings.resources.logsDescription']
  } as const
  return { title: t(keys[id][0]), description: t(keys[id][1]) }
}

function resourceCategoryIcon(id: AppMetrics['storage']['categories'][number]['id']): React.JSX.Element {
  if (id === 'market-catalogs') return <Database size={18} strokeWidth={1.8} />
  if (id === 'market-previews') return <FileText size={18} strokeWidth={1.8} />
  if (id === 'browser-cache') return <HardDrive size={18} strokeWidth={1.8} />
  return <BookText size={18} strokeWidth={1.8} />
}

function resolveProjectSkillPath(projectRoot: string, relativePath: string): string {
  if (relativePath.startsWith('/')) return relativePath
  return `${projectRoot.replace(/\/+$/, '')}/${relativePath.replace(/^\.\//, '').replace(/^\/+/, '')}`
}

function projectRelativeDisplayPath(projectRoot: string, targetPath: string): string {
  const normalizedRoot = projectRoot.replace(/\/+$/, '')
  if (targetPath === normalizedRoot) return '.'
  if (targetPath.startsWith(`${normalizedRoot}/`)) return targetPath.slice(normalizedRoot.length + 1)
  return targetPath.replace(/^\.\//, '')
}

function systemRelativeDisplayPath(targetPath: string): string {
  return targetPath
    .replace(/^\/Users\/[^/]+(?=\/|$)/, '~')
    .replace(/^\/home\/[^/]+(?=\/|$)/, '~')
    .replace(/^[A-Za-z]:\\Users\\[^\\]+(?=\\|$)/i, '~')
}

function flattenProjects(projects: SkillProject[]): Array<{ project: SkillProject; depth: number }> {
  const children = new Map<string | null, SkillProject[]>()
  for (const project of projects) {
    const group = children.get(project.parentProjectId) || []
    group.push(project)
    children.set(project.parentProjectId, group)
  }
  const visit = (parentId: string | null, depth: number): Array<{ project: SkillProject; depth: number }> =>
    (children.get(parentId) || [])
      .sort((left, right) => left.name.localeCompare(right.name))
      .flatMap((project) => [{ project, depth }, ...visit(project.id, depth + 1)])
  return visit(null, 0)
}

function skillTopologyCopy(t: ReturnType<typeof useTranslator>) {
  return {
    applications: t('topology.applicationRules'),
    projects: t('topology.projectDirectories'),
    byApplication: t('topology.byApplication'),
    byProject: t('topology.byProject'),
    addApplication: t('topology.addApplicationRule'),
    addProject: t('topology.addProjectDirectory'),
    applicationRules: t('topology.applicationRules'),
    applicationDescription: t('topology.applicationDescription'),
    applicationName: t('topology.applicationName'),
    systemPath: t('topology.systemSkillPath'),
    projectPath: t('topology.projectSkillPath'),
    cancel: t('topology.cancel'),
    save: t('topology.saveRule'),
    systemLabel: t('topology.systemDirectory'),
    projectLabel: t('topology.projectPath'),
    builtin: t('topology.builtin'),
    remove: t('topology.removeRule'),
    unclassified: t('topology.unclassified'),
    projectDirectories: t('topology.projectDirectories'),
    projectDescription: t('topology.projectDescription'),
    nestedProject: t('topology.nestedProject'),
    rootProject: t('topology.rootProject'),
    removeRegistration: t('topology.removeRegistration'),
    removeProjectConfirm: t('topology.removeProjectConfirm'),
    noProjects: t('topology.noProjects')
  }
}

function formatSkillRelativePath(skill: SkillDetail, root?: SkillRoot | null): string {
  if (!root?.path) return skill.name
  const rootPath = root.path.replace(/[/\\]+$/, '')
  const skillPath = skill.path.replace(/[/\\]+$/, '')
  const prefix = `${rootPath}/`
  if (skillPath === rootPath) return '.'
  if (skillPath.startsWith(prefix)) return skillPath.slice(prefix.length) || skill.name
  return skill.name
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false
  for (const item of left) {
    if (!right.has(item)) return false
  }
  return true
}

function findLobeAgentNameFromCandidates(
  candidates: Array<string | string[] | null | undefined>
): string | null {
  const flattenedCandidates = candidates
    .flat()
    .filter((candidate): candidate is string => Boolean(candidate))
  const normalizedCandidates = flattenedCandidates.map((candidate) => normalizeAgentText(candidate))

  for (const mapping of agentMappings) {
    for (const keyword of mapping.keywords) {
      const normalizedKeyword = normalizeAgentText(keyword)
      if (
        normalizedKeyword &&
        normalizedCandidates.some((candidate) => candidate.includes(normalizedKeyword))
      ) {
        return keyword
      }
    }
  }

  return null
}

function normalizeAgentText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function matchesRootFilter(
  skill: SkillSummary,
  root: SkillRoot | undefined,
  filter: string
): boolean {
  if (filter === 'all') return true
  if (filter.startsWith('category:')) {
    return root?.category === filter.slice('category:'.length)
  }
  return skill.rootId === filter
}

function buildRootFilterItems(
  skillRoots: SkillRoot[],
  t: (key: TranslationKey, replacements?: Parameters<typeof translate>[2]) => string
): Array<{ id: string; label: string }> {
  const existingRoots = skillRoots.filter((root) => root.exists)
  return [
    { id: 'all', label: t('skills.root.all') },
    { id: 'category:codex', label: t('root.codex') },
    { id: 'category:shared', label: t('skills.root.shared') },
    { id: 'category:application', label: t('skills.root.application') },
    { id: 'category:custom', label: t('skills.root.custom') },
    ...existingRoots.map((root) => ({ id: root.id, label: formatRootDisplayLabel(root, root.label, t) }))
  ]
}

function formatRootDisplayLabel(root: SkillRoot | null | undefined, fallback: string, t: ReturnType<typeof useTranslator>): string {
  if (root?.category === 'shared' || root?.shared) return t('root.shared')
  return fallback
}

function formatRootKind(
  root: SkillRoot,
  t: (key: TranslationKey, replacements?: Parameters<typeof translate>[2]) => string
): string {
  if (root.category === 'codex') return t('root.codex')
  if (root.category === 'shared') return t('root.shared')
  if (root.category === 'custom') return t('root.custom')
  if (root.category === 'application') return t('root.application')
  return root.defaultRoot ? t('root.default') : t('root.custom')
}

function formatRootApps(
  root: SkillRoot | null | undefined,
  t: (key: TranslationKey, replacements?: Parameters<typeof translate>[2]) => string
): string {
  if (!root) return '-'
  if (root.appNames.length === 0) return formatRootKind(root, t)
  return root.appNames.join(', ')
}
