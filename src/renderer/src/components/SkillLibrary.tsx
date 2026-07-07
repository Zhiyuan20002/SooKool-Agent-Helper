import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, Input, ListBox, Select, TextField } from '@heroui/react'
import { AgentIcon, agentMappings } from '@lobehub/icons'
import {
  AlertTriangle,
  AppWindow,
  ArchiveRestore,
  BookText,
  Check,
  ChevronDown,
  Copy,
  Download,
  File as FileIcon,
  FileCode2,
  FileText,
  Folder,
  FolderSearch,
  HardDrive,
  Image,
  Languages,
  Palette,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react'
import { translate, type AppLanguage, type ThemeMode, type TranslationKey } from '@/i18n'
import type { ViewType } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'
import type { SkillAgentAdapter, SkillsCommandInput, SkillsCommandResult } from '@/types/ecosystem'
import type {
  SkillDetail,
  SkillFileContent,
  SkillFileKind,
  SkillFileTreeNode,
  SkillRoot,
  SkillRootCategory,
  SkillSummary
} from '@/types/skills'
import { SkillMarket } from './SkillEcosystem'

const skillMarkdownPath = 'SKILL.md'

function useTranslator(): (
  key: TranslationKey,
  replacements?: Parameters<typeof translate>[2]
) => string {
  const language = useAppStore((state) => state.preferences.language)
  return (key, replacements) => translate(language, key, replacements)
}

export function SkillLibrary({ view }: { view: ViewType }): React.JSX.Element {
  if (view === 'market') return <SkillMarket />
  if (view === 'settings') return <SettingsView />
  return <SkillsView />
}

function SkillsView(): React.JSX.Element {
  const t = useTranslator()
  const language = useAppStore((state) => state.preferences.language)
  const {
    skills,
    selectedSkill,
    skillRoots,
    search,
    rootFilter,
    issueFilter,
    loading,
    saving,
    error,
    setSearch,
    setRootFilter,
    setIssueFilter,
    refreshSkills,
    selectSkill,
    deleteSelectedSkill,
    revealSelectedSkill,
    clearError
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

  const groupedSkills = useMemo(
    () => groupSkillsByRoot(filteredSkills, skillRoots),
    [filteredSkills, skillRoots]
  )

  const applicationRootCount = skillRoots.filter(
    (root) => root.exists && root.source === 'application'
  ).length
  const selectedRoot = selectedSkill ? rootById.get(selectedSkill.rootId) : null
  const searchActive = search.trim().length > 0
  const accordionExpandedIds = searchActive
    ? new Set(groupedSkills.map((group) => group.id))
    : expandedGroupIds

  useEffect(() => {
    if (searchActive) return

    setExpandedGroupIds((current) => {
      const validIds = new Set(groupedSkills.map((group) => group.id))
      const next = new Set([...current].filter((id) => validIds.has(id)))

      return sameSet(current, next) ? current : next
    })
  }, [groupedSkills, searchActive])

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
            <h2>{t('skills.title')}</h2>
            <p>{t('skills.count', { count: skills.length })}</p>
          </div>
          <div className="heading-actions">
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

        <div className="skill-list">
          {groupedSkills.map((group) => {
            const collapsed = !accordionExpandedIds.has(group.id)
            const contentId = `skill-group-${group.id}`
            return (
              <section key={group.id} className="skill-group" aria-label={group.label}>
                <button
                  type="button"
                  className="skill-group-heading"
                  aria-expanded={!collapsed}
                  aria-controls={contentId}
                  onClick={() => toggleGroup(group.id)}
                >
                  <SettingsRootIcon root={group.root} className="skill-group-icon" />
                  <span className="skill-group-title">
                    <strong>{group.label}</strong>
                    <span>{formatGroupSubtitle(group.root, t)}</span>
                  </span>
                  <span className="skill-group-actions">
                    <span className="skill-group-count">{group.skills.length}</span>
                    <ChevronDown className="skill-group-chevron" size={14} />
                  </span>
                </button>
                {!collapsed && (
                  <div id={contentId} className="skill-group-items">
                    {group.skills.map((skill) => (
                      <SkillListItem
                        key={skill.id}
                        skill={skill}
                        root={group.root}
                        active={selectedSkill?.path === skill.path}
                        onPress={() => void selectSkill(skill.path)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
          {filteredSkills.length === 0 && (
            <div className="empty-state">
              <FolderSearch size={34} />
              <p>{t('skills.noMatches')}</p>
            </div>
          )}
        </div>
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
                  <Button size="sm" variant="primary" onPress={() => setApplying((open) => !open)}>
                    <Download size={15} />
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
                    label="删除 Skill"
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
              <Meta label={t('market.sourceLabel')} value={selectedSkill.rootLabel} />
              <Meta label={t('skills.metric.apps')} value={formatRootApps(selectedRoot, t)} />
              <Meta label={t('market.status')} value={formatAccess(selectedSkill, t)} />
              <Meta
                label={t('skills.modified')}
                value={formatDate(selectedSkill.modifiedAt, language)}
              />
            </div>

            {applying && (
              <ApplySkillPanel
                skill={selectedSkill}
                onClose={() => setApplying(false)}
                onApplied={() => void refreshSkills()}
              />
            )}

            {selectedSkill.issues.length > 0 && (
              <div className="issues">
                {selectedSkill.issues.map((issue, index) => (
                  <div key={`${issue.message}-${index}`} className={`issue ${issue.severity}`}>
                    <AlertTriangle size={15} />
                    <span>{issue.message}</span>
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
    <div className="skill-file-browser">
      <aside className="file-sidebar" aria-label="Skill 文件列表">
        <div className="file-sidebar-header">
          <div>
            <strong>技能内容</strong>
            <span>{formatSkillRelativePath(skill, root)}</span>
          </div>
          {loading && <small>加载中</small>}
        </div>
        <div className="file-tree">
          {fileTree.map((node) => (
            <FileTreeNode
              key={node.relativePath}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
          {fileTree.length === 0 && !loading && <div className="file-empty">无文件</div>}
        </div>
      </aside>

      <section className="file-preview">
        <div className="file-preview-header">
          <div>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
          <span className="file-kind-badge">
            {isSkillMarkdown
              ? 'Markdown'
              : formatFileKind(selectedContent?.kind || selectedNode?.kind)}
          </span>
        </div>

        {error && !isSkillMarkdown ? (
          <div className="file-preview-state">{error}</div>
        ) : loading && !isSkillMarkdown ? (
          <div className="file-preview-state">加载中</div>
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
  if (!file) return <div className="file-preview-state">选择一个文件</div>

  if (file.content === null) {
    return (
      <div className="file-preview-state">
        <FileKindIcon kind={file.kind} />
        <span>{formatFileKind(file.kind)} 文件暂不支持预览</span>
        <small>{formatBytes(file.size)}</small>
      </div>
    )
  }

  if (file.kind === 'markdown') {
    return (
      <div className="markdown-preview">
        <MarkdownPreview content={file.content} />
        {file.truncated && <div className="file-truncated-note">文件较大，已截断预览</div>}
      </div>
    )
  }

  return (
    <pre className={`file-preview-code ${file.kind}`}>
      {file.content}
      {file.truncated ? '\n\n-- 文件较大，已截断预览 --' : ''}
    </pre>
  )
}

function MarkdownPreview({ content }: { content: string }): React.JSX.Element {
  const blocks = parseMarkdownBlocks(content)

  return (
    <div className="markdown-preview-content">
      {blocks.map((block, index) => {
        if (block.type === 'frontmatter') {
          return (
            <pre key={index} className="markdown-frontmatter">
              {block.content}
            </pre>
          )
        }

        if (block.type === 'code') {
          return (
            <pre key={index} className="markdown-code-block">
              <code>{block.content}</code>
            </pre>
          )
        }

        if (block.type === 'heading') {
          const children = renderInlineMarkdown(block.content)
          if (block.level === 1) return <h1 key={index}>{children}</h1>
          if (block.level === 2) return <h2 key={index}>{children}</h2>
          if (block.level === 3) return <h3 key={index}>{children}</h3>
          return <h4 key={index}>{children}</h4>
        }

        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </Tag>
          )
        }

        if (block.type === 'quote') {
          return <blockquote key={index}>{renderInlineMarkdown(block.content)}</blockquote>
        }

        if (block.type === 'rule') return <hr key={index} />

        return <p key={index}>{renderInlineMarkdown(block.content)}</p>
      })}
    </div>
  )
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
  const [agents, setAgents] = useState<SkillAgentAdapter[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SkillsCommandResult | null>(null)

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

  async function run(command: 'add' | 'remove'): Promise<void> {
    const input: SkillsCommandInput =
      command === 'add'
        ? {
            command,
            source: skill.path,
            agents: selectedAgents,
            global: true,
            copy: true,
            yes: true
          }
        : {
            command,
            skills: [skill.name],
            agents: selectedAgents,
            global: true,
            yes: true
          }

    setRunning(true)
    const nextResult = await window.aiHelper.invoke<SkillsCommandResult>('ecosystem:run', input)
    setResult(nextResult)
    setRunning(false)
    onApplied()
  }

  function toggleAgent(id: string): void {
    setSelectedAgents((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  return (
    <Card className="apply-panel" variant="secondary">
      <Card.Header className="apply-header">
        <div>
          <Card.Title>转移技能</Card.Title>
          <Card.Description>把当前 Skill 转移到已检测的软件目录。</Card.Description>
        </div>
        <Button className="apply-close-button" variant="secondary" size="sm" onPress={onClose}>
          <X size={14} />
          关闭
        </Button>
      </Card.Header>

      <Card.Content className="apply-content">
        <div className="apply-agent-grid">
          {agents.map((agent) => (
            <Button
              key={agent.id}
              className="apply-agent"
              variant={selectedAgents.includes(agent.id) ? 'secondary' : 'ghost'}
              size="sm"
              onPress={() => toggleAgent(agent.id)}
            >
              <SoftwareIcon agent={agent} className="apply-agent-icon" />
              <span className="apply-agent-copy">
                <strong>{agent.name}</strong>
                <small>{agent.globalPath || agent.projectPath}</small>
              </span>
            </Button>
          ))}
          {agents.length === 0 && (
            <div className="apply-empty">
              未检测到可应用的软件。可以在设置与备份里添加技能目录。
            </div>
          )}
        </div>

        <div className="apply-actions">
          <Button
            variant="primary"
            size="sm"
            isDisabled={selectedAgents.length === 0 || running}
            onPress={() => void run('add')}
          >
            <Download size={14} />
            {running ? '执行中' : '转移到选中软件'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isDisabled={selectedAgents.length === 0 || running}
            onPress={() => void run('remove')}
          >
            <Trash2 size={14} />
            从选中软件移除
          </Button>
        </div>

        {result && <InlineCommandOutput result={result} />}
      </Card.Content>
    </Card>
  )
}

function InlineCommandOutput({ result }: { result: SkillsCommandResult }): React.JSX.Element {
  const output = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim()

  return (
    <Card className="inline-command-output" variant="tertiary">
      <Card.Header>
        <Card.Title>{result.exitCode === 0 ? '执行完成' : '执行失败'}</Card.Title>
        <Card.Description>{result.command}</Card.Description>
      </Card.Header>
      <pre>{output || '命令没有输出。'}</pre>
    </Card>
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

function SkillListItem({
  skill,
  root,
  active,
  onPress
}: {
  skill: SkillSummary
  root?: SkillRoot
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
      <div className="row-meta">
        <Chip size="sm" variant="tertiary" color="default">
          {skill.rootLabel}
        </Chip>
        {root && (
          <Chip size="sm" variant="tertiary" color="default">
            {formatRootKind(root, t)}
          </Chip>
        )}
        {root?.shared && (
          <Chip size="sm" variant="tertiary" color="default">
            {root.appNames.length || 'Multiple'} shared
          </Chip>
        )}
        {skill.system && (
          <Chip size="sm" variant="tertiary" color="default">
            System
          </Chip>
        )}
        {skill.readonly && (
          <Chip size="sm" variant="tertiary" color="default">
            {t('access.readonly')}
          </Chip>
        )}
      </div>
    </Button>
  )
}

type SettingsSectionId = 'general' | 'resources' | 'directories' | 'backups'

function SettingsView(): React.JSX.Element {
  const t = useTranslator()
  const {
    backups,
    skillRoots,
    skills,
    preferences,
    appMetrics,
    addSkillRoot,
    loadAppMetrics,
    updatePreferences
  } = useAppStore()
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general')
  const customRoots = skillRoots.filter((root) => root.source === 'custom')
  const existingRoots = skillRoots.filter((root) => root.exists)
  const language = preferences.language
  const settingsSections: Array<{
    id: SettingsSectionId
    label: string
    icon: React.ElementType
  }> = [
    { id: 'general', label: t('settings.tabs.general'), icon: SlidersHorizontal },
    { id: 'resources', label: t('settings.tabs.resources'), icon: HardDrive },
    { id: 'directories', label: t('settings.tabs.directories'), icon: FolderSearch },
    { id: 'backups', label: t('settings.tabs.backups'), icon: ArchiveRestore }
  ]

  return (
    <div className="single-pane settings-pane">
      <div className="pane-heading">
        <div>
          <h2>{t('settings.title')}</h2>
          <p>{t('settings.description')}</p>
        </div>
        <Button size="md" variant="primary" onPress={() => void addSkillRoot()}>
          <Plus size={16} />
          {t('settings.addSkillRoot')}
        </Button>
      </div>

      <div className="settings-grid">
        <MetricCard value={skills.length} label={t('settings.metrics.skills')} icon={BookText} />
        <MetricCard
          value={existingRoots.length}
          label={t('settings.metrics.detectedRoots')}
          icon={FolderSearch}
        />
        <MetricCard
          value={customRoots.length}
          label={t('settings.metrics.customRoots')}
          icon={Folder}
        />
        <MetricCard
          value={backups.length}
          label={t('settings.metrics.backups')}
          icon={ArchiveRestore}
        />
      </div>

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

        <section className="settings-detail">
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
                    onChange={(value) => void updatePreferences({ language: value as AppLanguage })}
                    items={[
                      { id: 'zh-CN', label: t('settings.language.zh') },
                      { id: 'en-US', label: t('settings.language.en') }
                    ]}
                  />
                }
              />

              <SettingsControlRow
                icon={RefreshCw}
                title={t('settings.autoScan')}
                description={t('settings.autoScan.description')}
                control={
                  <div className="settings-segmented">
                    <button
                      type="button"
                      className={preferences.autoScanOnStart ? 'active' : ''}
                      onClick={() => void updatePreferences({ autoScanOnStart: true })}
                    >
                      {t('settings.status.on')}
                    </button>
                    <button
                      type="button"
                      className={!preferences.autoScanOnStart ? 'active' : ''}
                      onClick={() => void updatePreferences({ autoScanOnStart: false })}
                    >
                      {t('settings.status.off')}
                    </button>
                  </div>
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
            </div>
          )}

          {activeSection === 'directories' && (
            <div className="settings-section">
              <div className="settings-section-heading">
                <div>
                  <h3>{t('settings.directories.title')}</h3>
                  <p>{t('settings.directories.description')}</p>
                </div>
              </div>
              <div className="root-list">
                {existingRoots.map((root) => (
                  <div key={root.id} className="root-row">
                    <SettingsRootIcon root={root} />
                    <div className="settings-row-main">
                      <strong>{root.label}</strong>
                      <p>{root.path}</p>
                      <p>{formatRootApps(root, t)}</p>
                    </div>
                    <span className="settings-row-meta">{formatRootKind(root, t)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'backups' && (
            <div className="settings-section">
              <div className="settings-section-heading">
                <div>
                  <h3>{t('settings.backups.title')}</h3>
                  <p>{t('settings.backups.description')}</p>
                </div>
              </div>
              <div className="root-list">
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
              </div>
            </div>
          )}
        </section>
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
  const agent = root ? findLobeAgentName(root) : null

  if (agent) {
    return (
      <span className={className}>
        <AgentIcon agent={agent} size={32} type="color" />
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
  const lobeAgent = findLobeAgentNameFromCandidates([
    agent.id,
    agent.name,
    agent.globalPath,
    agent.projectPath
  ])

  if (lobeAgent) {
    return (
      <span className={className}>
        <AgentIcon agent={lobeAgent} size={28} type="color" />
      </span>
    )
  }

  return (
    <span className={`${className} settings-row-icon-fallback`}>
      <Folder size={24} strokeWidth={1.8} />
    </span>
  )
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
    <span title={label}>
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
    </span>
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
function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
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

type MarkdownBlock =
  | { type: 'frontmatter' | 'code' | 'paragraph' | 'quote'; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'rule' }

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, lineIndex) => lineIndex > 0 && line.trim() === '---')
    if (end > 0) {
      blocks.push({ type: 'frontmatter', content: lines.slice(0, end + 1).join('\n') })
      index = end + 1
    }
  }

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2]
      })
      index += 1
      continue
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', content: quoteLines.join(' ') })
      continue
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].trim()
        const marker = ordered ? /^\d+\.\s+(.+)$/.exec(item) : /^[-*]\s+(.+)$/.exec(item)
        if (!marker) break
        items.push(marker[1])
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const next = lines[index].trim()
      if (
        !next ||
        next.startsWith('```') ||
        /^#{1,4}\s+/.test(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        next.startsWith('>') ||
        /^[-*_]{3,}$/.test(next)
      ) {
        break
      }
      paragraphLines.push(next)
      index += 1
    }
    blocks.push({ type: 'paragraph', content: paragraphLines.join(' ') })
  }

  return blocks
}

function renderInlineMarkdown(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content))) {
    if (match.index > lastIndex) nodes.push(content.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(<code key={`${match.index}-code`}>{token.slice(1, -1)}</code>)
    } else {
      nodes.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>)
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < content.length) nodes.push(content.slice(lastIndex))
  return nodes
}

function formatFileKind(kind?: SkillFileKind): string {
  if (kind === 'markdown') return 'Markdown'
  if (kind === 'script') return '脚本'
  if (kind === 'json') return 'JSON'
  if (kind === 'text') return '文本'
  if (kind === 'image') return '图片'
  return '文件'
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
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

function findLobeAgentName(root: SkillRoot): string | null {
  if (root.shared && root.appNames.length !== 1) return null

  return findLobeAgentNameFromCandidates([root.appIds, root.appNames, root.label])
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

function formatAccess(
  skill: SkillDetail,
  t: (key: TranslationKey, replacements?: Parameters<typeof translate>[2]) => string
): string {
  if (skill.system) return t('access.systemReadonly')
  if (skill.readonly) return t('access.readonly')
  return t('access.editable')
}

interface SkillGroup {
  id: string
  label: string
  root?: SkillRoot
  skills: SkillSummary[]
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
    ...existingRoots.map((root) => ({ id: root.id, label: root.label }))
  ]
}

function groupSkillsByRoot(skills: SkillSummary[], roots: SkillRoot[]): SkillGroup[] {
  const rootById = new Map(roots.map((root) => [root.id, root]))
  const groups = new Map<string, SkillGroup>()

  for (const skill of skills) {
    const root = rootById.get(skill.rootId)
    const id = root?.id || skill.rootId
    const group = groups.get(id) || {
      id,
      label: root?.label || skill.rootLabel,
      root,
      skills: []
    }
    group.skills.push(skill)
    groups.set(id, group)
  }

  return [...groups.values()].sort(compareSkillGroups)
}

function compareSkillGroups(left: SkillGroup, right: SkillGroup): number {
  const categoryDiff =
    rootCategoryOrder(left.root?.category) - rootCategoryOrder(right.root?.category)
  if (categoryDiff !== 0) return categoryDiff
  return left.label.localeCompare(right.label)
}

function rootCategoryOrder(category?: SkillRootCategory): number {
  if (category === 'codex') return 0
  if (category === 'shared') return 1
  if (category === 'application') return 2
  if (category === 'custom') return 3
  return 4
}

function formatGroupSubtitle(
  root: SkillRoot | undefined,
  t: (key: TranslationKey, replacements?: Parameters<typeof translate>[2]) => string
): string {
  if (!root) return t('root.unregistered')
  if (root.shared && root.appNames.length > 0) return root.appNames.join(', ')
  if (root.appNames.length > 0) return root.path
  return formatRootKind(root, t)
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
