import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, Input, Label, TextArea, TextField } from '@heroui/react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FolderInput,
  Globe2,
  Plus,
  RefreshCw,
  Search,
  TerminalSquare,
  Trash2,
  X
} from 'lucide-react'
import { translate, type TranslationKey } from '@/i18n'
import { useAppStore } from '@/stores/app-store'
import type {
  MarketInstallResult,
  MarketSkill,
  MarketSkillResult,
  MarketSource,
  SkillsCommandResult
} from '@/types/ecosystem'
import type { SkillDetail } from '@/types/skills'

type MarketMode = 'browse' | 'search'

const fallbackSources: MarketSource[] = [
  {
    id: 'builtin-vercel-agent-skills',
    name: 'Agent Skills',
    source: 'vercel-labs/agent-skills',
    description: 'skills.sh 生态里的公共技能集合，适合用作探索入口。',
    builtin: true,
    enabled: true
  }
]

function useTranslator(): (
  key: TranslationKey,
  replacements?: Parameters<typeof translate>[2]
) => string {
  const language = useAppStore((state) => state.preferences.language)
  return (key, replacements) => translate(language, key, replacements)
}

export function SkillMarket(): React.JSX.Element {
  const t = useTranslator()
  const { skills: localSkills, refreshSkills } = useAppStore()
  const [sources, setSources] = useState<MarketSource[]>(fallbackSources)
  const [selectedSourceId, setSelectedSourceId] = useState(fallbackSources[0].id)
  const [sourceSkills, setSourceSkills] = useState<MarketSkill[]>([])
  const [searchSkills, setSearchSkills] = useState<MarketSkill[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [mode, setMode] = useState<MarketMode>('browse')
  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('')
  const [sourceInput, setSourceInput] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [showSourceForm, setShowSourceForm] = useState(false)
  const [showCommandOutput, setShowCommandOutput] = useState(false)
  const [loadingSources, setLoadingSources] = useState(false)
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCommand, setLastCommand] = useState<SkillsCommandResult | null>(null)
  const [importedSkill, setImportedSkill] = useState<SkillDetail | null>(null)

  const installedNames = useMemo(
    () => new Set(localSkills.map((skill) => skill.name.toLowerCase())),
    [localSkills]
  )
  const visibleSkills = useMemo(
    () => markLocalInstalled(mode === 'browse' ? sourceSkills : searchSkills, installedNames),
    [installedNames, mode, searchSkills, sourceSkills]
  )
  const selectedSkill =
    visibleSkills.find((skill) => skill.id === selectedSkillId) || visibleSkills[0] || null
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) || fallbackSources[0]
  const commandHasOutput = Boolean(
    lastCommand && `${lastCommand.stdout}${lastCommand.stderr}`.trim()
  )

  useEffect(() => {
    let mounted = true

    async function loadSources(): Promise<void> {
      setLoadingSources(true)
      setError(null)
      try {
        const nextSources = await window.aiHelper.invoke<MarketSource[]>('market:listSources')
        if (!mounted) return
        const normalizedSources = nextSources.length ? nextSources : fallbackSources
        setSources(normalizedSources)
        setSelectedSourceId((current) =>
          normalizedSources.some((source) => source.id === current)
            ? current
            : normalizedSources[0].id
        )
      } catch (error) {
        if (!mounted) return
        setSources(fallbackSources)
        setSelectedSourceId(fallbackSources[0].id)
        setError(formatMarketError(error))
      } finally {
        if (mounted) setLoadingSources(false)
      }
    }

    void loadSources()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedSourceId) return
    void loadSourceSkills(selectedSourceId)
  }, [selectedSourceId])

  useEffect(() => {
    setSelectedSkillId((current) =>
      visibleSkills.some((skill) => skill.id === current) ? current : visibleSkills[0]?.id || ''
    )
  }, [visibleSkills])

  async function loadSourceSkills(sourceId = selectedSourceId): Promise<void> {
    const source = sources.find((item) => item.id === sourceId) || fallbackSources[0]
    setMode('browse')
    setShowSourceForm(false)
    setLoadingSkills(true)
    setError(null)
    try {
      const result = await window.aiHelper.invoke<MarketSkillResult>('market:listSkills', {
        sourceId: source.id
      })
      setSourceSkills(result.skills)
      if (result.error) setError(result.error)
      setLastCommand(commandResultFromMarket(result))
    } catch (error) {
      setSourceSkills([])
      setError(formatMarketError(error))
    } finally {
      setLoadingSkills(false)
    }
  }

  async function searchMarket(): Promise<void> {
    if (!query.trim()) return
    setMode('search')
    setShowSourceForm(false)
    setLoadingSkills(true)
    setError(null)
    try {
      const result = await window.aiHelper.invoke<MarketSkillResult>('market:search', {
        query,
        owner
      })
      setSearchSkills(result.skills)
      if (result.error) setError(result.error)
      setLastCommand(commandResultFromMarket(result))
    } catch (error) {
      setSearchSkills([])
      setError(formatMarketError(error))
    } finally {
      setLoadingSkills(false)
    }
  }

  async function addSource(): Promise<void> {
    if (!sourceInput.trim()) return
    setRunning(true)
    setError(null)
    try {
      const nextSources = await window.aiHelper.invoke<MarketSource[]>('market:addSource', {
        source: sourceInput,
        name: sourceName
      })
      const normalizedSources = nextSources.length ? nextSources : fallbackSources
      setSources(normalizedSources)
      const added = normalizedSources.find((source) => source.source === sourceInput.trim())
      setSelectedSourceId(added?.id || normalizedSources[0].id)
      setSourceInput('')
      setSourceName('')
      setShowSourceForm(false)
    } catch (error) {
      setError(formatMarketError(error))
    } finally {
      setRunning(false)
    }
  }

  async function removeSource(source: MarketSource): Promise<void> {
    if (source.builtin) return
    if (!confirm(t('market.deleteSourceConfirm', { name: source.name }))) return

    setRunning(true)
    setError(null)
    try {
      const nextSources = await window.aiHelper.invoke<MarketSource[]>(
        'market:removeSource',
        source.id
      )
      const normalizedSources = nextSources.length ? nextSources : fallbackSources
      setSources(normalizedSources)
      setSelectedSourceId((current) => (current === source.id ? normalizedSources[0].id : current))
    } catch (error) {
      setError(formatMarketError(error))
    } finally {
      setRunning(false)
    }
  }

  async function installSkill(skill: MarketSkill): Promise<void> {
    setRunning(true)
    setError(null)
    try {
      const result = await window.aiHelper.invoke<MarketInstallResult>('market:install', {
        source: skill.installSource,
        skillName: skill.name,
        copy: true
      })
      setLastCommand(result.commandResult)
      setShowCommandOutput(result.commandResult.exitCode !== 0)
      if (result.commandResult.exitCode !== 0) {
        setError(
          stripErrorPrefix(
            `${result.commandResult.stdout}\n${result.commandResult.stderr}`.trim() ||
              t('market.installFailed')
          )
        )
      }
      await refreshSkills()
      if (mode === 'browse') await loadSourceSkills(selectedSourceId)
      else await searchMarket()
    } catch (error) {
      setError(formatMarketError(error))
    } finally {
      setRunning(false)
    }
  }

  async function importLocalSkill(): Promise<void> {
    setRunning(true)
    setError(null)
    try {
      const result = await window.aiHelper.invoke<SkillDetail | null>('market:importLocal', {})
      if (result) {
        setImportedSkill(result)
        await refreshSkills()
      }
    } catch (error) {
      setError(formatMarketError(error))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="market-workbench">
      <section className="market-list-pane">
        <div className="market-heading">
          <div>
            <h2>{t('market.title')}</h2>
            <p>{mode === 'browse' ? selectedSource.description : t('market.searchPlaceholder')}</p>
          </div>
          <Button
            aria-label={t('market.refresh')}
            isIconOnly
            size="md"
            variant="secondary"
            isDisabled={loadingSkills}
            onPress={() => void loadSourceSkills()}
          >
            <RefreshCw size={17} className={loadingSkills ? 'spin' : ''} />
          </Button>
        </div>

        <div className="market-toolbar">
          <TextField
            className="search-field"
            fullWidth
            variant="secondary"
            aria-label={t('market.searchMarket')}
          >
            <Search className="search-field-icon" size={16} aria-hidden="true" />
            <Input
              className="search-input"
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('market.searchPlaceholder')}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchMarket()
              }}
            />
          </TextField>
          <TextField className="market-owner-field" value={owner} onChange={setOwner}>
            <Input placeholder="Owner" />
          </TextField>
          <Button
            size="md"
            variant="primary"
            isDisabled={loadingSkills || !query.trim()}
            onPress={() => void searchMarket()}
          >
            <Search size={16} />
            {t('market.search')}
          </Button>
        </div>

        <div className="market-source-strip" aria-label={t('market.source')}>
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={`market-source-chip${selectedSourceId === source.id ? ' active' : ''}`}
              onClick={() => setSelectedSourceId(source.id)}
            >
              <Globe2 size={14} />
              <span>{source.name}</span>
              {source.builtin && <small>{t('market.builtin')}</small>}
            </button>
          ))}
          <Button size="sm" variant="ghost" onPress={() => setShowSourceForm(true)}>
            <Plus size={14} />
            {t('market.addSource')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={running}
            onPress={() => void importLocalSkill()}
          >
            <FolderInput size={14} />
            {t('market.importLocal')}
          </Button>
          {loadingSources && (
            <span className="market-inline-muted">{t('market.loadingSources')}</span>
          )}
        </div>

        {error && (
          <div className="error-banner market-error">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}
        {importedSkill && (
          <div className="market-success">
            <Check size={15} />
            <span>{t('market.imported', { name: importedSkill.name })}</span>
          </div>
        )}

        <div className="market-context-row">
          <span>
            {mode === 'browse' ? selectedSource.source : `${t('market.search')}：${query}`}
          </span>
          <strong>{t('market.skillCount', { count: visibleSkills.length })}</strong>
        </div>

        <div className="market-skill-list">
          {visibleSkills.map((skill) => (
            <SkillMarketRow
              key={skill.id}
              skill={skill}
              active={selectedSkill?.id === skill.id && !showSourceForm}
              onSelect={() => {
                setShowSourceForm(false)
                setSelectedSkillId(skill.id)
              }}
            />
          ))}
          {!loadingSkills && visibleSkills.length === 0 && (
            <div className="empty-state compact-empty">
              <Globe2 size={30} />
              <p>{mode === 'browse' ? t('market.emptyBrowse') : t('market.emptySearch')}</p>
            </div>
          )}
          {loadingSkills && (
            <div className="empty-state compact-empty">
              <RefreshCw size={30} className="spin" />
              <p>{t('market.loading')}</p>
            </div>
          )}
        </div>
      </section>

      <section className="market-detail-pane">
        {showSourceForm ? (
          <MarketSourceForm
            sourceInput={sourceInput}
            sourceName={sourceName}
            running={running}
            onSourceChange={setSourceInput}
            onNameChange={setSourceName}
            onCancel={() => setShowSourceForm(false)}
            onAdd={() => void addSource()}
          />
        ) : selectedSkill ? (
          <MarketSkillDetail
            skill={selectedSkill}
            commandResult={lastCommand}
            commandHasOutput={commandHasOutput}
            showCommandOutput={showCommandOutput}
            selectedSource={selectedSource}
            isDisabled={running}
            onInstall={() => void installSkill(selectedSkill)}
            onToggleCommand={() => setShowCommandOutput((open) => !open)}
            onRemoveSource={
              selectedSource && !selectedSource.builtin
                ? () => void removeSource(selectedSource)
                : undefined
            }
          />
        ) : (
          <MarketEmptyDetail
            source={selectedSource}
            lastCommand={lastCommand}
            hasError={Boolean(error)}
            running={running}
            onRefresh={() => void loadSourceSkills()}
            onImport={() => void importLocalSkill()}
            onAddSource={() => setShowSourceForm(true)}
            onRemoveSource={
              selectedSource && !selectedSource.builtin
                ? () => void removeSource(selectedSource)
                : undefined
            }
          />
        )}
      </section>
    </div>
  )
}

function SkillMarketRow({
  skill,
  active,
  onSelect
}: {
  skill: MarketSkill
  active: boolean
  onSelect: () => void
}): React.JSX.Element {
  const t = useTranslator()

  return (
    <button
      type="button"
      className={`market-skill-row${active ? ' active' : ''}`}
      onClick={onSelect}
    >
      <span className="market-skill-main">
        <strong>{skill.name}</strong>
        <small>{skill.description}</small>
      </span>
      <span className="market-skill-meta">
        <Chip size="sm" variant="tertiary" color="default">
          {skill.sourceName}
        </Chip>
        {skill.installed && (
          <Chip size="sm" variant="soft" color="success">
            <Check size={12} />
            {t('market.installed')}
          </Chip>
        )}
      </span>
    </button>
  )
}

function MarketSourceForm({
  sourceInput,
  sourceName,
  running,
  onSourceChange,
  onNameChange,
  onCancel,
  onAdd
}: {
  sourceInput: string
  sourceName: string
  running: boolean
  onSourceChange: (value: string) => void
  onNameChange: (value: string) => void
  onCancel: () => void
  onAdd: () => void
}): React.JSX.Element {
  const t = useTranslator()

  return (
    <div className="market-detail-stack">
      <div className="detail-header">
        <div className="detail-title-row">
          <div>
            <h2>{t('market.addSource')}</h2>
            <p className="detail-description">
              支持 GitHub shorthand、Git URL、本地路径或仓库内具体 Skill 路径。
            </p>
          </div>
          <Button
            aria-label={t('skills.apply.close')}
            isIconOnly
            size="md"
            variant="secondary"
            onPress={onCancel}
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="market-source-editor">
        <TextField className="form-field" value={sourceInput} onChange={onSourceChange}>
          <Label>{t('market.source')}</Label>
          <Input placeholder={t('market.sourcePlaceholder')} />
        </TextField>
        <TextField className="form-field" value={sourceName} onChange={onNameChange}>
          <Label>{t('market.name')}</Label>
          <Input placeholder={t('market.optional')} />
        </TextField>
        <Button
          size="md"
          variant="primary"
          isDisabled={!sourceInput.trim() || running}
          onPress={onAdd}
        >
          <Plus size={16} />
          {t('market.addSource')}
        </Button>
      </div>
    </div>
  )
}

function MarketSkillDetail({
  skill,
  commandResult,
  commandHasOutput,
  showCommandOutput,
  selectedSource,
  isDisabled,
  onInstall,
  onToggleCommand,
  onRemoveSource
}: {
  skill: MarketSkill
  commandResult: SkillsCommandResult | null
  commandHasOutput: boolean
  showCommandOutput: boolean
  selectedSource: MarketSource
  isDisabled: boolean
  onInstall: () => void
  onToggleCommand: () => void
  onRemoveSource?: () => void
}): React.JSX.Element {
  const t = useTranslator()

  return (
    <div className="market-detail-stack">
      <div className="detail-header">
        <div className="detail-title-row">
          <div className="title-row">
            <h2>{skill.name}</h2>
            {skill.installed && (
              <Chip className="status-pill valid" color="success" size="sm" variant="soft">
                <Check size={13} /> {t('market.installed')}
              </Chip>
            )}
          </div>
          <div className="detail-actions">
            {skill.url && (
              <Button
                aria-label={t('market.openSource')}
                isIconOnly
                size="md"
                variant="secondary"
                onPress={() => window.open(skill.url)}
              >
                <ExternalLink size={16} />
              </Button>
            )}
            {onRemoveSource && (
              <Button
                aria-label={t('market.removeSource')}
                isIconOnly
                size="md"
                variant="danger"
                isDisabled={isDisabled}
                onPress={onRemoveSource}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
        <p className="detail-description">{skill.description}</p>
      </div>

      <div className="meta-grid market-meta-grid">
        <Meta label={t('market.sourceLabel')} value={skill.sourceName} />
        <Meta label={t('market.installSource')} value={skill.installSource} />
        <Meta
          label={t('market.status')}
          value={skill.installed ? t('market.installed') : t('market.notInstalled')}
        />
        <Meta label={t('market.source')} value={selectedSource.source} />
      </div>

      <div className="market-primary-actions">
        <Button size="md" variant="primary" isDisabled={isDisabled} onPress={onInstall}>
          <Download size={16} />
          {skill.installed ? t('market.reinstallSkill') : t('market.installSkill')}
        </Button>
        <Button
          size="md"
          variant="secondary"
          isDisabled={!commandHasOutput}
          onPress={onToggleCommand}
        >
          <TerminalSquare size={16} />
          {showCommandOutput ? t('skills.apply.close') : t('market.commandOutput')}
          <ChevronDown size={14} className={showCommandOutput ? 'rotate-180' : ''} />
        </Button>
      </div>

      {showCommandOutput && (
        <CommandOutput commandResult={commandResult} title={t('market.lastCommand')} />
      )}
    </div>
  )
}

function MarketEmptyDetail({
  source,
  lastCommand,
  hasError,
  running,
  onRefresh,
  onImport,
  onAddSource,
  onRemoveSource
}: {
  source: MarketSource
  lastCommand: SkillsCommandResult | null
  hasError: boolean
  running: boolean
  onRefresh: () => void
  onImport: () => void
  onAddSource: () => void
  onRemoveSource?: () => void
}): React.JSX.Element {
  const t = useTranslator()

  return (
    <div className="market-detail-stack">
      <div className="detail-header">
        <div className="title-row">
          <h2>{source.name}</h2>
          {source.builtin && (
            <Chip size="sm" variant="tertiary" color="default">
              {t('market.builtin')}
            </Chip>
          )}
        </div>
        <p className="detail-description">{source.description}</p>
      </div>

      <div className="market-empty-actions">
        <Button size="md" variant="primary" onPress={onRefresh}>
          <RefreshCw size={16} />
          {t('market.refresh')}
        </Button>
        <Button size="md" variant="secondary" isDisabled={running} onPress={onImport}>
          <FolderInput size={16} />
          {t('market.importLocal')}
        </Button>
        <Button size="md" variant="secondary" onPress={onAddSource}>
          <Plus size={16} />
          {t('market.addSource')}
        </Button>
        {onRemoveSource && (
          <Button size="md" variant="danger" isDisabled={running} onPress={onRemoveSource}>
            <Trash2 size={16} />
            {t('market.removeSource')}
          </Button>
        )}
      </div>

      {hasError && (
        <div className="market-detail-note">
          市场服务或网络暂时不可用。可以先导入本地 Skill，或重启应用后刷新当前来源。
        </div>
      )}

      {lastCommand && <CommandOutput commandResult={lastCommand} title={t('market.lastCommand')} />}
    </div>
  )
}

function CommandOutput({
  commandResult,
  title
}: {
  commandResult: SkillsCommandResult | null
  title: string
}): React.JSX.Element {
  const t = useTranslator()

  return (
    <Card className="market-command-output" variant="tertiary">
      <Card.Header className="pane-heading">
        <div>
          <Card.Title>{title}</Card.Title>
          <Card.Description>{commandResult?.command || t('market.noCommand')}</Card.Description>
        </div>
        <span className="icon-badge">
          <TerminalSquare size={14} />
          CLI
        </span>
      </Card.Header>
      <Card.Content>
        <TextField
          className="module-console-field"
          value={formatCommandOutput(commandResult, t)}
          isReadOnly
          aria-label={t('market.commandOutput')}
        >
          <TextArea className="module-console" />
        </TextField>
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

function markLocalInstalled(skills: MarketSkill[], installedNames: Set<string>): MarketSkill[] {
  return skills.map((skill) => ({
    ...skill,
    installed: skill.installed || installedNames.has(skill.name.toLowerCase())
  }))
}

function commandResultFromMarket(result: MarketSkillResult): SkillsCommandResult {
  return {
    command: result.command,
    stdout: result.skills.length ? `${result.skills.length} 个 Skill` : '',
    stderr: result.error || '',
    exitCode: result.exitCode,
    durationMs: 0
  }
}

function formatCommandOutput(
  result: SkillsCommandResult | null,
  t: (key: TranslationKey, replacements?: Parameters<typeof translate>[2]) => string
): string {
  if (!result) return t('market.noOutput')
  const output = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim()
  return output || t('command.empty')
}

function formatMarketError(error: unknown): string {
  const value = stripErrorPrefix(String(error))
  if (value.includes('No handler registered')) {
    return '市场服务未连接。请重启应用后再试，或先导入本地 Skill。'
  }
  if (value.includes('Failed to clone') || value.includes('unable to access')) {
    return '无法读取远程市场源。请检查网络、代理或换成本地/Git 源。'
  }
  return value
}

function stripErrorPrefix(value: string): string {
  return value.replace(/^Error:\s*/, '').replace(/^Error invoking remote method '[^']+':\s*/, '')
}
