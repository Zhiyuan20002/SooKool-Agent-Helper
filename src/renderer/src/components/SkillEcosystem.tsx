import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Chip, ListBox, Pagination, ScrollShadow, Select, Skeleton, Spinner } from '@heroui/react'
import {
  AgentIcon,
  Anthropic,
  DeepSeek,
  HermesAgent,
  HuggingFace,
  ModelScope,
  Nvidia,
  OpenAI,
  OpenClaw,
  Tencent,
  Vercel,
  agentMappings
} from '@lobehub/icons'
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowLeft,
  Boxes,
  Check,
  ChevronRight,
  Code2,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  FolderGit2,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Trash2,
  X
} from 'lucide-react'
import { resolveAppLanguage, translate, type AppLanguage, type TranslationKey } from '@/i18n'
import { localizeMarketCategory, marketCategoryKey, type MarketCategoryKey } from '@/market-categories'
import { fileViewLabels, localizedInstallStatus, localizedSourceDescription, localizedSourceName, localizeSkillWarning, marketCopy, marketPaletteCopy, marketSearchScopeCopy, marketText, unknownFileCountCopy } from '@/market-copy'
import { buildMarketFileTree, type MarketFileTreeNode } from '@/market-file-tree'
import { createBoundedMarketCache, createMarketResultCollector, createMarketTaskScheduler } from '@/market-load-utils'
import { MARKET_PALETTES, marketPaletteStyle } from '@/market-palettes'
import { splitMarketHighlight } from '@/market-search-utils'
import { useAppStore } from '@/stores/app-store'
import { MarkdownRenderer } from './MarkdownRenderer'
import type {
  MarketInstallResult,
  MarketInstallTarget,
  MarketPreviewFile,
  MarketSkill,
  MarketSkillPreview,
  MarketSkillResult,
  MarketSource,
  MarketPalette
} from '@/types/ecosystem'

type PreviewTab = 'overview' | 'content' | 'files'
type SortMode = 'featured' | 'name' | 'source'
const rendererCatalogMaxAgeMs = 15 * 60 * 1000
const remoteCatalogBatchSize = 100
const remoteMarketKinds = new Set(['skillhub', 'redskill', 'modelscope', 'clawhub'])

const fallbackSources: MarketSource[] = [
  {
    id: 'builtin-anthropic-skills',
    name: 'Anthropic',
    source: 'anthropics/skills',
    description: 'Official Agent Skills examples from Anthropic.',
    kind: 'git',
    palette: 'morandi',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-openclaw-skills',
    name: 'OpenClaw',
    source: 'https://github.com/openclaw/openclaw/tree/main/skills',
    description: 'Official Agent Skills compatible workflows from OpenClaw.',
    kind: 'git',
    palette: 'matisse',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-hermes-skills',
    name: 'Hermes',
    source: 'https://github.com/NousResearch/hermes-agent/tree/main/optional-skills',
    description: 'Official optional skills maintained for Hermes Agent.',
    kind: 'git',
    palette: 'rococo',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-openai-skills',
    name: 'OpenAI',
    source: 'https://github.com/openai/skills/tree/main/skills/.curated',
    description: 'Curated Skills maintained by OpenAI for Codex.',
    kind: 'git',
    palette: 'memphis',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-vercel-agent-skills',
    name: 'Vercel Labs',
    source: 'vercel-labs/agent-skills',
    description: 'Curated Agent Skills maintained by Vercel Labs.',
    kind: 'git',
    palette: 'mondrian',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-huggingface-skills',
    name: 'Hugging Face',
    source: 'https://github.com/huggingface/skills/tree/main/skills',
    description: 'Official model, dataset, and training workflow Skills.',
    kind: 'git',
    palette: 'macaron',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-nvidia-skills',
    name: 'NVIDIA',
    source: 'NVIDIA/skills',
    description: 'Official AI and accelerated computing Agent Skills.',
    kind: 'git',
    palette: 'matisse',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-tencent-skillhub',
    name: 'Tencent SkillHub',
    source: 'https://api.skillhub.cn',
    description: 'Tencent SkillHub catalog with discovery and downloads.',
    kind: 'skillhub',
    palette: 'mondrian',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-redskill',
    name: 'REDnote Red Skill',
    source: 'https://redskill.xiaohongshu.net',
    description: 'Official REDnote Red Skill market.',
    kind: 'redskill',
    palette: 'rococo',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-modelscope-skills',
    name: 'ModelScope Skills',
    source: 'https://modelscope.cn/skills',
    description: 'Official ModelScope Skills catalog.',
    kind: 'modelscope',
    palette: 'memphis',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-clawhub',
    name: 'ClawHub',
    source: 'https://clawhub.ai',
    description: 'OpenClaw public skill registry with semantic search and versioned downloads.',
    kind: 'clawhub',
    palette: 'matisse',
    builtin: true,
    enabled: true
  }
]

function useTranslator(): (
  key: TranslationKey,
  replacements?: Parameters<typeof translate>[2]
) => string {
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  return (key, replacements) => translate(language, key, replacements)
}

export function SkillMarket(): React.JSX.Element {
  const t = useTranslator()
  const { refreshSkills } = useAppStore()
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  const copy = marketCopy(language)
  const searchScopeCopy = marketSearchScopeCopy(language)
  const shellRef = useRef<HTMLDivElement>(null)
  const listTopRef = useRef<HTMLDivElement>(null)
  const catalogRequestRef = useRef(0)
  const previewRequestRef = useRef(0)
  const marketSchedulerRef = useRef(createMarketTaskScheduler(3))
  const preloadTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const catalogMemoryRef = useRef(createBoundedMarketCache<string, { skills: MarketSkill[]; cachedAt: number; total?: number; pageSize?: number; paginationMode?: 'page' | 'cursor'; hasMore?: boolean }>(12))
  const preloadRequestsRef = useRef(new Map<string, Promise<void>>())
  const [sources, setSources] = useState<MarketSource[]>(fallbackSources)
  const [selectedSourceId, setSelectedSourceId] = useState('builtin-anthropic-skills')
  const [skills, setSkills] = useState<MarketSkill[]>([])
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<MarketCategoryKey>('all')
  const [sortMode, setSortMode] = useState<SortMode>('featured')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadProgress, setLoadProgress] = useState<{ completed: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<MarketSkill | null>(null)
  const [preview, setPreview] = useState<MarketSkillPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [page, setPage] = useState(1)
  const [columnCount, setColumnCount] = useState(2)
  const pageSize = columnCount * 10
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogBatchPage, setCatalogBatchPage] = useState(1)
  const [paginationMode, setPaginationMode] = useState<'page' | 'cursor'>('page')
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    void initializeMarket()
  }, [])

  useEffect(() => () => {
    for (const timer of preloadTimersRef.current.values()) clearTimeout(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      const apiSources = sources.filter((source) =>
        source.enabled && remoteMarketKinds.has(source.kind)
      )
      void (async () => {
        for (const source of apiSources) {
          if (cancelled) return
          await preloadCatalog(source)
        }
      })()
    }, 2_500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sources, pageSize])

  useEffect(() => {
    if (!sources.length || selectedSourceId === 'search' || showSources) return
    void loadCatalog(selectedSourceId)
  }, [selectedSourceId, showSources, pageSize])

  useEffect(() => {
    const gridArea = listTopRef.current
    if (!gridArea) return
    const observer = new ResizeObserver(([entry]) => {
      // Keep pagination in lockstep with the CSS grid: 440px minimum card width + 12px gap.
      const columns = Math.max(1, Math.floor((entry.contentRect.width + 12) / (440 + 12)))
      setColumnCount(columns)
    })
    observer.observe(gridArea)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [selectedSourceId, activeCategory, query, sortMode, columnCount])

  async function initializeMarket(): Promise<void> {
    try {
      const next = await window.aiHelper.invoke<MarketSource[]>('market:listSources')
      setSources(next.length ? next : fallbackSources)
    } catch (error) {
      setError(formatError(error))
    }
  }

  async function loadCatalog(sourceId = selectedSourceId, refresh = false): Promise<void> {
    const requestId = ++catalogRequestRef.current
    if (refresh) catalogMemoryRef.current.delete(sourceId)
    const source = sources.find((item) => item.id === sourceId)
    if (!source) return
    const isRemote = remoteMarketKinds.has(source.kind)
    const cachedLocal = refresh ? undefined : catalogMemoryRef.current.get(sourceId)
    const local = isRemote && cachedLocal?.pageSize !== pageSize ? undefined : cachedLocal
    const localIsFresh = Boolean(local && Date.now() - local.cachedAt < rendererCatalogMaxAgeMs)
    const canKeepCurrent = (refresh && selectedSourceId === sourceId && skills.length > 0) || Boolean(local)
    setLoading(!canKeepCurrent)
    setRefreshing(canKeepCurrent)
    setLoadProgress(null)
    if (!canKeepCurrent) setSkills([])
    setActiveCategory('all')
    setError(null)
    shellRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    let hasCachedContent = canKeepCurrent
    try {
      if (local) {
        setSkills(local.skills)
        setCatalogTotal(local.total ?? local.skills.length)
        setCatalogBatchPage(1)
        setPaginationMode(local.paginationMode || 'page')
        setHasMore(Boolean(local.hasMore))
        setLoading(false)
        if (localIsFresh) return
        setRefreshing(true)
      }
      if (!isRemote && !refresh && !local) {
        const cached = await window.aiHelper.invoke<MarketSkillResult>('market:listCachedSkills', { sourceId })
        if (requestId !== catalogRequestRef.current) return
        if (cached.cacheHit) {
          hasCachedContent = true
          const nextSkills = dedupeSkills(cached.skills)
          catalogMemoryRef.current.set(sourceId, { skills: nextSkills, cachedAt: cached.cachedAt || Date.now() })
          setSkills(nextSkills)
          setLoading(false)
          if (!cached.isStale) return
          setRefreshing(true)
        }
      }
      const result = await marketSchedulerRef.current.schedule(() =>
        window.aiHelper.invoke<MarketSkillResult>('market:listSkills', {
          sourceId,
          refresh: refresh || hasCachedContent,
          page: 1,
          pageSize: isRemote ? pageSize : undefined
        })
      , 'high')
      if (requestId !== catalogRequestRef.current) return
      if (result.error) {
        if (!hasCachedContent) setSkills([])
        setError(result.error)
      } else {
        const nextSkills = dedupeSkills(result.skills)
        const total = result.total ?? nextSkills.length
        catalogMemoryRef.current.set(sourceId, { skills: nextSkills, cachedAt: Date.now(), total, pageSize: result.pageSize, paginationMode: result.paginationMode, hasMore: result.hasMore })
        setSkills(nextSkills)
        setCatalogTotal(total)
        setCatalogBatchPage(1)
        setPaginationMode(result.paginationMode || 'page')
        setHasMore(Boolean(result.hasMore))
      }
    } catch (error) {
      if (requestId === catalogRequestRef.current) setError(formatError(error))
    } finally {
      if (requestId === catalogRequestRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  async function searchAllMarkets(): Promise<void> {
    if (!query.trim()) return
    const requestId = ++catalogRequestRef.current
    setLoading(true)
    setRefreshing(false)
    setSkills([])
    setActiveCategory('all')
    setError(null)
    shellRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    const enabledSources = sources.filter((source) => source.enabled)
    const total = enabledSources.length + 1
    let completed = 0
    let failed = 0
    setLoadProgress({ completed, total })

    const collector = createMarketResultCollector(
      (skill: MarketSkill) => `${skill.source.toLowerCase()}:${skill.name.toLowerCase()}`,
      (next) => {
        if (requestId !== catalogRequestRef.current) return
        setSkills(next)
        setLoading(false)
        setRefreshing(true)
      }
    )
    const publish = (next: MarketSkill[]): void => {
      if (requestId !== catalogRequestRef.current) return
      collector.add(next)
    }
    const markComplete = (didFail = false): void => {
      if (requestId !== catalogRequestRef.current) return
      completed += 1
      if (didFail) failed += 1
      setLoadProgress({ completed, total })
    }

    try {
      setSelectedSourceId('search')
      const publicTask = marketSchedulerRef.current.schedule(() =>
        window.aiHelper.invoke<MarketSkillResult>('market:searchPublic', { query })
      )
        .then((result) => { publish(result.skills); markComplete(Boolean(result.error)) })
        .catch(() => markComplete(true))

      const sourcesWithoutLocalCache = enabledSources.filter((source) => !catalogMemoryRef.current.get(source.id))
      const cachedBatchPromise = sourcesWithoutLocalCache.length
        ? window.aiHelper.invoke<Record<string, MarketSkillResult>>('market:listCachedSkillsBatch', {
            sourceIds: sourcesWithoutLocalCache.map((source) => source.id)
          }).catch(() => ({}))
        : Promise.resolve({} as Record<string, MarketSkillResult>)

      const sourceTasks = enabledSources.map(async (source) => {
        const isRemote = remoteMarketKinds.has(source.kind)
        const local = catalogMemoryRef.current.get(source.id)
        if (local) {
          publish(local.skills.filter((skill) => marketSkillMatchesQuery(skill, query)))
          if (!isRemote && Date.now() - local.cachedAt < rendererCatalogMaxAgeMs) {
            markComplete()
            return
          }
        }
        let cached: MarketSkillResult | null = null
        try {
          if (!local) {
            cached = (await cachedBatchPromise)[source.id] || null
            if (!cached) throw new Error('Catalog cache unavailable')
            const nextSkills = dedupeSkills(cached.skills)
            if (cached.cacheHit) {
              catalogMemoryRef.current.set(source.id, { skills: nextSkills, cachedAt: cached.cachedAt || Date.now() })
              publish(nextSkills.filter((skill) => marketSkillMatchesQuery(skill, query)))
            }
            if (!isRemote && cached.cacheHit && !cached.isStale) {
              markComplete()
              return
            }
          }
        } catch {
          // A broken cache for one source must not block its network request or other sources.
        }
        try {
          const result = await marketSchedulerRef.current.schedule(() =>
            window.aiHelper.invoke<MarketSkillResult>('market:listSkills', {
              sourceId: source.id,
              refresh: Boolean(local || cached?.isStale),
              page: 1,
              pageSize: isRemote ? remoteCatalogBatchSize : undefined,
              query: isRemote ? query.trim() : undefined
            })
          )
          const nextSkills = dedupeSkills(result.skills)
          if (!result.error) catalogMemoryRef.current.set(source.id, { skills: nextSkills, cachedAt: Date.now() })
          publish(nextSkills.filter((skill) => marketSkillMatchesQuery(skill, query)))
          markComplete(Boolean(result.error))
        } catch {
          markComplete(true)
        }
      })
      await Promise.all([publicTask, ...sourceTasks])
      if (requestId !== catalogRequestRef.current) return
      collector.flush()
      if (failed) setError(marketText(copy.partialFailure, { count: failed }))
    } catch (error) {
      if (requestId === catalogRequestRef.current) setError(formatError(error))
    } finally {
      if (requestId === catalogRequestRef.current) {
        setLoading(false)
        setRefreshing(false)
        setLoadProgress(null)
      }
    }
  }

  async function openPreview(skill: MarketSkill): Promise<void> {
    const requestId = ++previewRequestRef.current
    setSelectedSkill(skill)
    setPreview(null)
    setPreviewLoading(true)
    setError(null)
    try {
      const detail = await marketSchedulerRef.current.schedule(() =>
        window.aiHelper.invoke<MarketSkillPreview>('market:preview', {
          source: skill.installSource,
          sourceId: skill.sourceId === 'search' ? undefined : skill.sourceId,
          skillName: marketSkillLocator(skill)
        })
      , 'high')
      if (requestId !== previewRequestRef.current) return
      setPreview(detail)
    } catch (error) {
      if (requestId === previewRequestRef.current) setError(formatError(error))
    } finally {
      if (requestId === previewRequestRef.current) setPreviewLoading(false)
    }
  }

  const categories = useMemo(
    () => ['all' as MarketCategoryKey, ...new Set(skills.map((skill) => marketCategoryKey(skill.category)))],
    [skills]
  )
  const visibleSkills = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = skills.filter((skill) => {
      const matchesCategory = activeCategory === 'all' || marketCategoryKey(skill.category) === activeCategory
      const matchesQuery =
        !normalized ||
        selectedSourceId === 'search' ||
        skill.name.toLowerCase().includes(normalized) ||
        skill.description.toLowerCase().includes(normalized) ||
        skill.author.toLowerCase().includes(normalized) ||
        skill.sourceName.toLowerCase().includes(normalized) ||
        skill.tags.some((tag) => tag.toLowerCase().includes(normalized))
        || localizeMarketCategory(skill.category, language).toLowerCase().includes(normalized)
      return matchesCategory && matchesQuery
    })
    return [...filtered].sort((left, right) => {
      if (sortMode === 'name') return left.name.localeCompare(right.name)
      if (sortMode === 'source') return left.sourceName.localeCompare(right.sourceName)
      return Number(right.installed) - Number(left.installed) || left.name.localeCompare(right.name)
    })
  }, [activeCategory, language, query, selectedSourceId, skills, sortMode])

  const selectedSource = sources.find((source) => source.id === selectedSourceId)
  const remoteCatalog = Boolean(selectedSource && remoteMarketKinds.has(selectedSource.kind))
  const effectiveTotal = remoteCatalog && activeCategory === 'all' && !query.trim() ? catalogTotal : visibleSkills.length
  const pageCount = Math.max(1, Math.ceil(effectiveTotal / pageSize))
  const pagedSkills = remoteCatalog ? visibleSkills : visibleSkills.slice((page - 1) * pageSize, page * pageSize)

  async function changePage(nextPage: number): Promise<void> {
    requestAnimationFrame(() => listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    if (!remoteCatalog || !selectedSource) {
      setPage(nextPage)
      return
    }
    if (nextPage === catalogBatchPage) {
      setPage(nextPage)
      return
    }
    const requestId = ++catalogRequestRef.current
    setRefreshing(true)
    setError(null)
    try {
      const result = await marketSchedulerRef.current.schedule(() =>
        window.aiHelper.invoke<MarketSkillResult>('market:listSkills', {
          sourceId: selectedSource.id,
          page: nextPage,
          pageSize
        })
      , 'high')
      if (requestId !== catalogRequestRef.current) return
      if (result.error) throw new Error(result.error)
      setSkills(dedupeSkills(result.skills))
      setCatalogTotal(result.total ?? catalogTotal)
      setCatalogBatchPage(nextPage)
      setPage(nextPage)
      setPaginationMode(result.paginationMode || paginationMode)
      setHasMore(Boolean(result.hasMore))
    } catch (error) {
      if (requestId === catalogRequestRef.current) setError(formatError(error))
    } finally {
      if (requestId === catalogRequestRef.current) setRefreshing(false)
    }
  }

  function scheduleSourcePreload(source: MarketSource): void {
    if (source.id === selectedSourceId || preloadTimersRef.current.has(source.id)) return
    const timer = setTimeout(() => {
      preloadTimersRef.current.delete(source.id)
      void preloadCatalog(source)
    }, 450)
    preloadTimersRef.current.set(source.id, timer)
  }

  function cancelSourcePreload(sourceId: string): void {
    const timer = preloadTimersRef.current.get(sourceId)
    if (!timer) return
    clearTimeout(timer)
    preloadTimersRef.current.delete(sourceId)
  }

  function selectSource(source: MarketSource): void {
    cancelSourcePreload(source.id)
    catalogRequestRef.current += 1
    setSelectedSourceId(source.id)
    setActiveCategory('all')
    setError(null)
    const cachedLocal = catalogMemoryRef.current.get(source.id)
    const local = remoteMarketKinds.has(source.kind) && cachedLocal?.pageSize !== pageSize ? undefined : cachedLocal
    setSkills(local?.skills || [])
    setCatalogTotal(local?.total ?? local?.skills.length ?? 0)
    setCatalogBatchPage(1)
    setPaginationMode(local?.paginationMode || 'page')
    setHasMore(Boolean(local?.hasMore))
    setLoading(!local)
    setRefreshing(false)
  }

  async function preloadCatalog(source: MarketSource): Promise<void> {
    const local = catalogMemoryRef.current.get(source.id)
    const isRemote = remoteMarketKinds.has(source.kind)
    if (local && (!isRemote || local.pageSize === pageSize) && Date.now() - local.cachedAt < rendererCatalogMaxAgeMs) return
    const running = preloadRequestsRef.current.get(source.id)
    if (running) return running
    const request = marketSchedulerRef.current.schedule(async () => {
      try {
        const cached = await window.aiHelper.invoke<MarketSkillResult>('market:listCachedSkills', { sourceId: source.id })
        const cachedSkills = dedupeSkills(cached.skills)
        if (!isRemote && cached.cacheHit) {
          catalogMemoryRef.current.set(source.id, { skills: cachedSkills, cachedAt: cached.cachedAt || Date.now() })
          if (!cached.isStale) return
        }
        const result = await window.aiHelper.invoke<MarketSkillResult>('market:listSkills', {
          sourceId: source.id,
          refresh: Boolean(cached.isStale),
          page: 1,
          pageSize: isRemote ? pageSize : undefined
        })
        if (!result.error) {
          catalogMemoryRef.current.set(source.id, {
            skills: dedupeSkills(result.skills),
            cachedAt: Date.now(),
            total: result.total,
            pageSize: result.pageSize,
            paginationMode: result.paginationMode,
            hasMore: result.hasMore
          })
        }
      } catch {
        // Idle and intent preloads are best-effort and never surface errors before selection.
      }
    }, 'low').finally(() => {
      if (preloadRequestsRef.current.get(source.id) === request) preloadRequestsRef.current.delete(source.id)
    })
    preloadRequestsRef.current.set(source.id, request)
    return request
  }

  if (showSources) {
    return (
      <SourceManager
        sources={sources}
        error={error}
        onClose={() => { setShowSources(false); setError(null) }}
        onChange={(next) => setSources(next.length ? next : fallbackSources)}
        onError={(message) => setError(message)}
      />
    )
  }

  if (selectedSkill) {
    return (
      <MarketSkillDetail
        skill={selectedSkill}
        palette={sources.find((source) => source.id === selectedSkill.sourceId)?.palette || 'morandi'}
        preview={preview}
        loading={previewLoading}
        error={error}
        onClose={() => { previewRequestRef.current += 1; setSelectedSkill(null); setPreview(null); setPreviewLoading(false) }}
        onInstalled={async (result) => {
          await refreshSkills()
          catalogMemoryRef.current.clear()
          const succeeded = result.targets.filter((target) => target.success)
          setNotice(marketText(copy.installedTo, { names: succeeded.map((target) => target.name).join(', ') }))
          setSelectedSkill(null)
          setPreview(null)
          await loadCatalog(selectedSourceId)
        }}
        onError={(message) => setError(message)}
      />
    )
  }

  return (
    <ScrollShadow className="marketplace-shell" ref={shellRef} size={24}>
      <header className="marketplace-header">
        <div className="marketplace-title">
          <div className="module-title"><Store size={25} /><h1>{t('market.title')}</h1></div>
          <p>{copy.subtitle}</p>
        </div>
        <div className="marketplace-header-actions">
          <Button variant="secondary" size="md" onPress={() => setShowSources(true)}>
            <Settings2 size={16} />{copy.manage}
          </Button>
          <Button aria-label={t('market.refresh')} isIconOnly variant="secondary" size="md" onPress={() => void (selectedSourceId === 'search' ? searchAllMarkets() : loadCatalog(selectedSourceId, true))}>
            <RefreshCw size={17} className={loading || refreshing ? 'spin' : ''} />
          </Button>
        </div>
      </header>

      <section className="marketplace-controls">
        <div className="marketplace-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void searchAllMarkets()
            }}
            placeholder={copy.searchPlaceholder}
            aria-label={t('market.searchMarket')}
          />
          {query && <button type="button" aria-label={copy.clear} onClick={() => setQuery('')}><X size={15} /></button>}
        </div>
        <Button variant="primary" size="md" isDisabled={!query.trim() || loading} onPress={() => void searchAllMarkets()}>
          {copy.publicSearch}
        </Button>
      </section>

      <div className="market-source-rail" aria-label={copy.sourcesAria}>
        {sources.map((source) => (
          <button
            key={source.id}
            type="button"
            className={selectedSourceId === source.id ? 'active' : ''}
            onMouseEnter={() => scheduleSourcePreload(source)}
            onMouseLeave={() => cancelSourcePreload(source.id)}
            onFocus={() => scheduleSourcePreload(source)}
            onBlur={() => cancelSourcePreload(source.id)}
            onClick={() => selectSource(source)}
          >
            <MarketSourceIcon source={source} />
            <span className="market-source-label">{localizedSourceName(source.id, source.name, language)}</span>
            {source.builtin && <small>{copy.builtin}</small>}
          </button>
        ))}
        {selectedSourceId === 'search' && <button type="button" className="active"><Search size={14} />{copy.publicResults}</button>}
      </div>

      <div className="market-category-bar">
        <div className="market-categories">
          {categories.map((category) => (
            <button key={category} type="button" className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)}>
              {localizeMarketCategory(category, language)}
            </button>
          ))}
        </div>
        <div className="market-sort">
          <ArrowDownAZ size={14} />
          <Select className="market-sort-select" variant="secondary" aria-label={copy.sortFeatured} selectedKey={sortMode} onSelectionChange={(key) => setSortMode(String(key) as SortMode)}>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox aria-label={copy.sortFeatured}>
                <ListBox.Item className="market-sort-option" id="featured" textValue={copy.sortFeatured}><span>{copy.sortFeatured}</span><ListBox.ItemIndicator /></ListBox.Item>
                <ListBox.Item className="market-sort-option" id="name" textValue={copy.sortName}><span>{copy.sortName}</span><ListBox.ItemIndicator /></ListBox.Item>
                <ListBox.Item className="market-sort-option" id="source" textValue={copy.sortSource}><span>{copy.sortSource}</span><ListBox.ItemIndicator /></ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </div>

      {(loading || refreshing) && (
        <div className="market-loading market-loading-top" role="status" aria-live="polite">
          <Spinner color="accent" size="sm" />
          <strong>{marketText(copy.loading, { name: selectedSource ? localizedSourceName(selectedSource.id, selectedSource.name, language) : copy.catalog })}</strong>
          <span>{loadProgress ? `${loadProgress.completed} / ${loadProgress.total}` : copy.loadingHint}</span>
        </div>
      )}

      {!loading && (error || notice) && (
        <div className={error ? 'market-message error' : 'market-message success'}>
          {error ? <AlertTriangle size={15} /> : <Check size={15} />}
          <span>{error || notice}</span>
          <button type="button" onClick={() => { setError(null); setNotice(null) }}><X size={14} /></button>
        </div>
      )}

      <div ref={listTopRef} className="market-list-anchor" />
      {loading && <MarketGridSkeleton count={Math.max(4, Math.min(columnCount * 3, 12))} />}
      {!loading && <div className="marketplace-context">
        <div>
          <strong>{selectedSource ? localizedSourceName(selectedSource.id, selectedSource.name, language) : copy.publicResults}</strong>
          <span>{selectedSource ? localizedSourceDescription(selectedSource.id, selectedSource.description, language) : copy.publicDescription}</span>
        </div>
        <span>{paginationMode === 'cursor'
          ? (language === 'zh-CN' ? `本页 ${visibleSkills.length} 个 Skill` : `${visibleSkills.length} Skills on this page`)
          : marketText(copy.count, { count: effectiveTotal })}</span>
      </div>}

      {!loading && <main className="market-grid">
        {pagedSkills.map((skill, index) => (
          <MarketCard key={skill.id} skill={skill} palette={sources.find((source) => source.id === skill.sourceId)?.palette || 'morandi'} language={language} query={query} colorIndex={categoryColorIndex(skill.category, index)} onPreview={() => void openPreview(skill)} />
        ))}
        {visibleSkills.length === 0 && (
          <div className="market-empty">
            <Boxes size={34} />
            <h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p>
            <div className="market-search-scope">
              <Search size={13} />
              <span>{searchScopeCopy.label}</span>
              <strong>{selectedSource ? localizedSourceName(selectedSource.id, selectedSource.name, language) : searchScopeCopy.allMarkets}</strong>
              <i>·</i>
              <strong>{localizeMarketCategory(activeCategory, language)}</strong>
            </div>
            {query && <Button variant="secondary" onPress={() => void searchAllMarkets()}>{copy.publicSearch}</Button>}
          </div>
        )}
      </main>}

      {!loading && paginationMode === 'cursor' && remoteCatalog && (
        <MarketCursorPagination page={page} hasMore={hasMore} copy={copy} language={language} onChange={(next) => void changePage(next)} />
      )}
      {!loading && paginationMode === 'page' && pageCount > 1 && (
        <MarketPagination page={page} total={effectiveTotal} pageSize={pageSize} copy={copy} onChange={(next) => void changePage(next)} />
      )}

    </ScrollShadow>
  )
}

function MarketGridSkeleton({ count }: { count: number }): React.JSX.Element {
  return (
    <main className="market-grid market-grid-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="market-card market-card-skeleton" key={index}>
          <Skeleton animationType="pulse" className="market-card-skeleton-cover" />
          <div className="market-card-skeleton-body">
            <Skeleton animationType="pulse" className="market-card-skeleton-title" />
            <Skeleton animationType="pulse" className="market-card-skeleton-meta" />
            <Skeleton animationType="pulse" className="market-card-skeleton-line" />
            <Skeleton animationType="pulse" className="market-card-skeleton-line short" />
            <div className="market-card-skeleton-tags"><Skeleton animationType="pulse" /><Skeleton animationType="pulse" /></div>
          </div>
        </article>
      ))}
    </main>
  )
}

function MarketPagination({ page, total, pageSize, copy, onChange }: { page: number; total: number; pageSize: number; copy: ReturnType<typeof marketCopy>; onChange: (page: number) => void }): React.JSX.Element {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const items = paginationItems(page, pages)
  return (
    <Pagination className="market-pagination" size="sm" aria-label={copy.pagination}>
      <Pagination.Summary>{marketText(copy.pageSummary, { page, pages, total })}</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item><Pagination.Previous isDisabled={page === 1} onPress={() => onChange(page - 1)}><Pagination.PreviousIcon />{copy.previous}</Pagination.Previous></Pagination.Item>
        {items.map((item, index) => item === 'ellipsis'
          ? <Pagination.Item key={`ellipsis-${index}`}><Pagination.Ellipsis /></Pagination.Item>
          : <Pagination.Item key={item}><Pagination.Link isActive={item === page} onPress={() => onChange(item)}>{item}</Pagination.Link></Pagination.Item>)}
        <Pagination.Item><Pagination.Next isDisabled={page === pages} onPress={() => onChange(page + 1)}>{copy.next}<Pagination.NextIcon /></Pagination.Next></Pagination.Item>
      </Pagination.Content>
    </Pagination>
  )
}

function MarketCursorPagination({ page, hasMore, copy, language, onChange }: { page: number; hasMore: boolean; copy: ReturnType<typeof marketCopy>; language: string; onChange: (page: number) => void }): React.JSX.Element {
  return (
    <Pagination className="market-pagination" size="sm" aria-label={copy.pagination}>
      <Pagination.Summary>{language === 'zh-CN' ? `第 ${page} 页` : `Page ${page}`}</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item><Pagination.Previous isDisabled={page === 1} onPress={() => onChange(page - 1)}><Pagination.PreviousIcon />{copy.previous}</Pagination.Previous></Pagination.Item>
        <Pagination.Item><Pagination.Next isDisabled={!hasMore} onPress={() => onChange(page + 1)}>{copy.next}<Pagination.NextIcon /></Pagination.Next></Pagination.Item>
      </Pagination.Content>
    </Pagination>
  )
}

function paginationItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis', total]
  if (current >= total - 3) return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

function MarketCard({ skill, palette, language, query, colorIndex, onPreview }: { skill: MarketSkill; palette: MarketPalette; language: AppLanguage; query: string; colorIndex: number; onPreview: () => void }): React.JSX.Element {
  const copy = marketCopy(language)
  const sourceName = localizedSourceName(skill.sourceId, skill.sourceName, language)
  const category = localizeMarketCategory(skill.category, language)
  return (
    <article className={`market-card tone-card-${colorIndex}`} style={marketPaletteStyle(palette)} role="button" tabIndex={0} onClick={onPreview} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPreview() } }}>
      <div className={`market-card-cover tone-${colorIndex}`}>
        <span className="market-card-initials">{skill.name.slice(0, 2).toUpperCase()}</span>
        <span className="market-card-watermark"><MarketBrandGlyph sourceId={skill.sourceId} /></span>
        <small><MarketHighlight text={category} query={query} /></small>
        {skill.hasScripts && <Code2 className="market-card-script" size={16} />}
      </div>
      <div className="market-card-body">
        <div className="market-card-title-row">
          <div>
            <h2><MarketHighlight text={skill.name} query={query} /></h2>
            <p><MarketHighlight text={skill.author} query={query} /> · <MarketHighlight text={sourceName} query={query} /></p>
          </div>
          {skill.installed && <Chip size="sm" variant="soft" color="success"><Check size={12} />{localizedInstallStatus(language, true)}</Chip>}
        </div>
        <p className="market-card-description"><MarketHighlight text={skill.description} query={query} /></p>
        <div className="market-card-tags">
          {skill.tags.slice(0, 3).map((tag) => <span key={tag}><MarketHighlight text={tag} query={query} /></span>)}
          {skill.version && <span>v{skill.version}</span>}
        </div>
        <div className="market-card-footer">
          <span><FileText size={13} />{skill.fileCount === undefined ? unknownFileCountCopy(language) : marketText(copy.files, { count: skill.fileCount })}</span>
          <button type="button" onClick={(event) => { event.stopPropagation(); onPreview() }}>{copy.preview} <ChevronRight size={14} /></button>
        </div>
      </div>
    </article>
  )
}

function MarketHighlight({ text, query }: { text: string; query: string }): React.JSX.Element {
  return (
    <>
      {splitMarketHighlight(text, query).map((segment, index) =>
        segment.matched
          ? <mark className="market-keyword-highlight" key={`${segment.text}-${index}`}>{segment.text}</mark>
          : <React.Fragment key={`${segment.text}-${index}`}>{segment.text}</React.Fragment>
      )}
    </>
  )
}

function MarketSourceIcon({ source }: { source: MarketSource }): React.JSX.Element {
  const iconProps = { size: 18 }
  let icon: React.ReactNode

  switch (source.id) {
    case 'builtin-tencent-skillhub':
      icon = <Tencent.Color {...iconProps} />
      break
    case 'builtin-redskill':
      icon = <RedSkillLogo className="redskill-source-logo" />
      break
    case 'builtin-modelscope-skills':
      icon = <ModelScope.Color {...iconProps} />
      break
    case 'builtin-clawhub':
      icon = <OpenClaw.Color {...iconProps} />
      break
    case 'builtin-vercel-agent-skills':
      icon = <Vercel {...iconProps} />
      break
    case 'builtin-anthropic-skills':
      icon = <Anthropic {...iconProps} />
      break
    case 'builtin-openclaw-skills':
      icon = <OpenClaw.Color {...iconProps} />
      break
    case 'builtin-hermes-skills':
      icon = <HermesAgent {...iconProps} />
      break
    case 'builtin-openai-skills':
      icon = <OpenAI {...iconProps} />
      break
    case 'builtin-huggingface-skills':
      icon = <HuggingFace.Color {...iconProps} />
      break
    case 'builtin-nvidia-skills':
      icon = <Nvidia.Color {...iconProps} />
      break
    default:
      icon = <FolderGit2 size={17} />
  }

  return <span className="market-source-icon">{icon}</span>
}

function MarketBrandGlyph({ sourceId }: { sourceId: string }): React.JSX.Element {
  const iconProps = { size: 42 }
  switch (sourceId) {
    case 'builtin-vercel-agent-skills': return <Vercel {...iconProps} />
    case 'builtin-anthropic-skills': return <Anthropic {...iconProps} />
    case 'builtin-openclaw-skills': return <OpenClaw {...iconProps} />
    case 'builtin-hermes-skills': return <HermesAgent {...iconProps} />
    case 'builtin-openai-skills': return <OpenAI {...iconProps} />
    case 'builtin-huggingface-skills': return <HuggingFace {...iconProps} />
    case 'builtin-nvidia-skills': return <Nvidia {...iconProps} />
    case 'builtin-tencent-skillhub': return <Tencent {...iconProps} />
    case 'builtin-redskill': return <RedSkillLogo monochrome />
    case 'builtin-modelscope-skills': return <ModelScope {...iconProps} />
    case 'builtin-clawhub': return <OpenClaw {...iconProps} />
    default: return <FolderGit2 {...iconProps} />
  }
}

function RedSkillLogo({ className, monochrome = false }: { className?: string; monochrome?: boolean }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 1024 1024" aria-hidden="true">
      {!monochrome && <path d="M512 2.27555555a509.72444445 509.72444445 0 1 0 0 1019.4488889A509.72444445 509.72444445 0 0 0 512 2.27555555z" fill="#ff0035" />}
      <path d="M651.37322667 388.93795555c3.64088889 0 5.53415111 0 5.53415111 5.6069689v46.38492444c0 3.64088889-1.82044445 5.53415111-5.53415111 5.53415111h-25.99594667c-5.53415111 0-7.42741333 1.82044445-7.42741333 7.42741333v161.29137778c0 3.71370667 1.89326222 5.60696889 5.60696888 5.60696889h46.38492445c5.53415111 0 7.35459555 1.82044445 7.35459555 7.42741333v44.41884445c0 5.60696889-1.82044445 7.50023111-7.35459555 7.50023111-29.70965333-1.89326222-61.16693333-1.89326222-92.76984889-1.89326222H482.58161778c-5.53415111 0-7.35459555 0-3.64088889-5.53415112 7.35459555-14.85482667 14.78200889-31.53009778 24.02986666-46.38492444 1.89326222-3.64088889 3.71370667-5.53415111 9.32067556-5.53415111h46.38492444c4.36906667 0 5.31569778-1.16508445 5.46133334-4.51470222V451.99815111c0-5.53415111-1.82044445-7.35459555-7.28177778-5.53415111h-25.99594666c-5.60696889 0-7.42741333-1.82044445-7.42741334-5.53415111v-44.56448c0-5.53415111 1.82044445-7.35459555 7.42741334-7.35459556h120.51342222zM391.77784889 617.14887111c12.96156445 5.53415111 27.81639111 3.64088889 42.5984 3.64088889h37.13706666c3.64088889 0 5.53415111 1.89326222 3.6408889 5.60696889-9.24785778 16.74808889-16.67527111 33.42336-25.9231289 50.09863111-1.82044445 3.64088889-3.64088889 3.64088889-7.42741333 3.64088889-9.24785778-1.82044445-20.38897778-1.82044445-35.24380444-1.82044444-11.06830222 0-27.81639111 1.89326222-40.77795556-1.82044445-5.53415111-1.89326222-7.42741333-3.71370667-3.64088889-7.42741333 9.17504-16.74808889 16.60245333-31.53009778 24.02986667-48.20536889 1.89326222-1.89326222 1.89326222-5.60696889 5.60696889-3.71370667z m393.07036444-244.81336889c3.71370667 0 5.60696889 1.89326222 5.60696889 5.60696889 0 12.96156445 0 12.96156445 12.96156445 12.96156444 16.74808889 0 31.53009778 3.71370667 44.49166222 11.14112 18.56853333 11.14112 25.99594667 29.63683555 25.99594666 50.02581334v37.13706666c0 5.53415111 1.82044445 7.42741333 7.42741334 7.42741334 20.38897778 0 37.06424889 5.53415111 50.02581333 22.20942222a55.55996445 55.55996445 0 0 1 11.14112 33.42336V626.32391111c0 27.81639111-16.74808889 48.20536889-44.49166222 51.91907556a75.73048889 75.73048889 0 0 1-35.24380445-1.82044445 48.05973333 48.05973333 0 0 1-33.35054222-42.67121777c0-5.53415111 1.82044445-3.64088889 5.53415112-3.6408889h46.38492444c5.53415111 0 7.42741333-1.89326222 7.42741333-7.5002311v-48.2053689c0-12.96156445-7.42741333-20.38897778-20.38897777-20.38897777h-70.4876089c-3.71370667 0-5.60696889 1.89326222-5.60696888 5.53415111 1.89326222 18.56853333 1.89326222 37.13706667 1.89326222 57.52604444v55.63278222c0 5.53415111-1.89326222 7.42741333-7.42741334 7.42741333h-44.49166222c-5.60696889 0-7.42741333-1.89326222-7.42741333-7.42741333V561.44327111c0-5.53415111-1.89326222-7.42741333-7.42741333-7.42741333h-42.67121778c-5.53415111 0-7.42741333 0-7.42741334-5.53415111v-46.38492445c0-5.53415111 1.89326222-5.53415111 7.42741334-5.53415111h44.49166222c5.60696889 0 7.42741333-1.89326222 5.60696889-7.42741333v-35.24380445c0-5.60696889-1.89326222-5.60696889-7.42741333-5.60696888h-25.99594667c-3.64088889 0-5.53415111 0-5.53415111-5.53415112v-46.38492444c0-3.64088889 1.89326222-5.53415111 5.53415111-5.53415111h25.99594667c3.64088889 0 5.53415111-1.82044445 5.53415111-5.53415111 0-11.35957333 0-12.81592889 9.97603555-12.96156445h41.94304z m-543.29344-5.53415111c5.53415111 0 7.42741333 1.82044445 7.42741334 7.42741334-1.45635555 34.73408-1.74762667 67.42926222-1.82044445 98.81372444V626.32391111a52.35598222 52.35598222 0 0 1-7.50023111 27.81639111c-9.24785778 18.56853333-25.92312889 24.10268445-46.31210666 22.28224a41.72458667 41.72458667 0 0 1-38.95751112-31.53009777c-5.60696889-18.56853333-5.60696889-16.74808889 12.96156445-18.56853334 7.42741333 0 16.74808889 3.71370667 22.28224-1.82044444 3.64088889-3.71370667 1.82044445-12.96156445 1.82044444-20.38897778V374.15594667c0-5.60696889 1.89326222-7.42741333 7.42741333-7.42741334h42.67121778zM148.78492445 451.99815111c-3.64088889 40.77795555-5.53415111 81.55591111-11.06830223 122.40668444a160.92728889 160.92728889 0 0 1-29.70965333 74.20131556c1.89326222 0 0 1.82044445 0 3.64088889-11.14112-20.38897778-20.38897778-40.77795555-31.53009778-61.16693333-1.82044445-1.82044445-1.82044445-3.64088889 0-5.53415112 7.42741333-16.74808889 7.42741333-33.35054222 7.42741334-51.91907555l5.60696888-81.55591111c0-3.78652445 1.82044445-5.60696889 5.53415112-5.60696889h48.20536888c3.71370667 0 5.53415111 0 5.53415112 5.53415111zM337.96551111 446.464c5.53415111 0 5.53415111 1.82044445 7.42741334 7.42741333 1.82044445 37.13706667 5.53415111 74.20131555 9.24785777 111.26556445 0 3.64088889 0 9.24785778 1.89326223 12.96156444 3.64088889 7.42741333 1.82044445 14.85482667-1.89326223 22.28224-7.42741333 14.78200889-14.78200889 31.53009778-22.20942222 46.31210667-1.89326222 5.60696889-3.71370667 5.60696889-7.42741333 0-12.96156445-20.38897778-20.38897778-40.77795555-25.99594667-64.80782222C293.54666667 559.47719111 293.54666667 535.37450667 291.58058667 513.16508445c-1.82044445-20.38897778-3.64088889-38.95751111-5.53415112-59.3464889 0-5.60696889 0-7.42741333 7.42741334-7.42741333 7.42741333 1.82044445 14.85482667 0 22.20942222 0h22.28224z m144.61610667-74.20131555c5.60696889 0 5.60696889 1.89326222 3.71370667 5.60696888l-33.35054223 66.77390222c-1.82044445 1.82044445-1.82044445 3.64088889-3.71370667 7.35459556-1.82044445 3.71370667 0 5.60696889 3.71370667 7.42741334 3.64088889 1.89326222 3.64088889-1.82044445 5.53415111-3.6408889 1.89326222-3.78652445 3.71370667-5.60696889 9.32067556-5.60696888h44.41884444c5.60696889 0 5.60696889 1.82044445 3.78652445 5.53415111-14.85482667 27.81639111-27.81639111 57.52604445-42.67121778 85.34243555-5.53415111 11.14112-3.64088889 14.85482667 9.24785778 14.85482667 3.71370667-1.89326222 11.14112-1.89326222 18.56853333-1.89326222-7.42741333 12.96156445-12.96156445 25.99594667-18.56853333 38.95751111-3.64088889 9.24785778-9.24785778 11.14112-16.67527111 11.14112h-42.5984c-3.71370667 0-7.42741333 0-11.14112-1.89326222-13.03438222-3.64088889-16.74808889-12.96156445-13.03438222-25.92312889 7.42741333-20.38897778 18.56853333-38.95751111 27.8163911-59.34648889 1.89326222-3.71370667 3.71370667-5.60696889 5.6069689-11.14112h-37.13706667c-14.78200889-3.71370667-20.38897778-12.96156445-14.78200889-27.81639111 5.53415111-16.74808889 14.85482667-33.35054222 22.20942222-48.20536889 9.32067555-16.74808889 16.74808889-35.24380445 25.99594667-51.91907556 1.82044445-3.71370667 3.64088889-5.60696889 9.24785777-5.60696889h44.49166223z m315.30097777 74.20131555c-3.71370667 0-5.60696889 1.82044445-5.60696888 5.53415111v38.95751111c0 3.71370667 1.89326222 5.60696889 5.60696888 5.60696889h20.38897778c3.64088889 0 5.53415111-1.89326222 5.53415112-5.60696889v-30.58346667c-0.21845333-13.90819555-2.76707555-13.90819555-25.9231289-13.90819555z m126.04757334-57.52604445c13.03438222 1.89326222 24.10268445 14.85482667 24.10268444 29.70965334s-11.06830222 25.99594667-25.92312888 27.81639111h-14.85482667c-18.49571555 0-18.49571555 0-18.49571556-18.56853333 0-5.53415111 0-12.96156445 1.82044445-18.49571556 3.71370667-14.85482667 16.74808889-22.28224 33.35054222-20.38897778z" fill={monochrome ? 'currentColor' : '#fff'} />
    </svg>
  )
}

function MarketSkillDetail({
  skill,
  palette,
  preview,
  loading,
  error,
  onClose,
  onInstalled,
  onError
}: {
  skill: MarketSkill
  palette: MarketPalette
  preview: MarketSkillPreview | null
  loading: boolean
  error: string | null
  onClose: () => void
  onInstalled: (result: MarketInstallResult) => Promise<void>
  onError: (message: string) => void
}): React.JSX.Element {
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  const copy = marketCopy(language)
  const [tab, setTab] = useState<PreviewTab>('overview')
  const [showInstall, setShowInstall] = useState(false)
  const [selectedFile, setSelectedFile] = useState<MarketPreviewFile | null>(null)
  const [fileView, setFileView] = useState<'preview' | 'source'>('preview')
  const fileTree = useMemo(() => buildMarketFileTree(preview?.files || []), [preview?.files])

  useEffect(() => {
    setTab('overview')
    setShowInstall(false)
    setSelectedFile(null)
  }, [skill.id])

  useEffect(() => {
    if (!preview?.files.length) return
    const skillMarkdown = preview.files.find((file) =>
      file.relativePath.toLowerCase() === 'skill.md' || file.relativePath.toLowerCase().endsWith('/skill.md')
    )
    setSelectedFile(skillMarkdown || preview.files[0])
  }, [preview?.id])

  useEffect(() => setFileView('preview'), [selectedFile?.relativePath])

  return (
    <div className="market-detail-page" style={marketPaletteStyle(palette)}>
      <header className="detail-header market-detail-header">
        <div className="detail-title-row">
          <div className="market-detail-navigation">
            <Button
              className="market-detail-back"
              aria-label={copy.back}
              isIconOnly
              variant="secondary"
              size="sm"
              onPress={onClose}
            >
              <ArrowLeft size={17} />
            </Button>
            <div className="market-detail-identity">
              <div className={`preview-skill-mark tone-${categoryColorIndex(skill.category, 0)}`}>{skill.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <span>{localizeMarketCategory(skill.category, language)}</span>
                <h2>{skill.name}</h2>
                <p>{skill.author} · {localizedSourceName(skill.sourceId, skill.sourceName, language)}{skill.version ? ` · v${skill.version}` : ''}</p>
              </div>
            </div>
          </div>
          <div className="detail-actions">
            {!showInstall && <Button variant="primary" size="sm" isDisabled={!preview || loading} onPress={() => setShowInstall(true)}><Download size={15} />{skill.installed ? copy.reinstallTo : copy.installTo}</Button>}
          </div>
        </div>
      </header>

      <nav className="preview-tabs market-detail-tabs">
        {([['overview', copy.overview], ['content', copy.content], ['files', marketText(copy.fileTab, { count: preview?.files.length ?? '' })]] as Array<[PreviewTab, string]>).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {error && <div className="market-message error market-detail-message"><AlertTriangle size={15} /><span>{error}</span></div>}

      <ScrollShadow className="market-detail-content" size={24}>
          {loading && <div className="preview-loading"><Spinner color="accent" /><span>{copy.reading}</span></div>}
          {!loading && !preview && <div className="preview-loading"><AlertTriangle size={28} /><span>{copy.unavailable}</span></div>}
          {preview && tab === 'overview' && (
            <div className="preview-overview">
              <p className="preview-lead">{preview.description}</p>
              <div className="preview-facts">
                <div><span>{copy.source}</span><strong>{localizedSourceName(preview.sourceId, preview.sourceName, language)}</strong></div>
                <div><span>{copy.files.replace('{count}','')}</span><strong>{preview.files.length}</strong></div>
                <div><span>{copy.status}</span><strong>{localizedInstallStatus(language, preview.installed)}</strong></div>
                <div><span>{copy.scripts}</span><strong>{preview.hasScripts ? copy.hasScripts : copy.noScripts}</strong></div>
              </div>
              <section className="preview-section">
                <h3>{copy.tags}</h3>
                <div className="preview-tags">{preview.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </section>
              <section className="preview-section">
                <h3><ShieldCheck size={16} />{copy.checks}</h3>
                {preview.warnings.length ? preview.warnings.map((warning) => <div className="preview-warning" key={warning}><AlertTriangle size={15} />{localizeSkillWarning(warning, language)}</div>) : <div className="preview-safe"><Check size={15} />{copy.safe}</div>}
              </section>
              {preview.url && <Button variant="secondary" onPress={() => window.open(preview.url)}><ExternalLink size={15} />{copy.openSource}</Button>}
            </div>
          )}
          {preview && tab === 'content' && <MarkdownRenderer content={preview.content} className="market-markdown" showFrontmatter={false} />}
          {preview && tab === 'files' && (
            <div className="market-file-browser">
              <ScrollShadow className="market-file-list" size={24}>
                <MarketFileTreeList nodes={fileTree} selectedPath={selectedFile?.relativePath} onSelect={setSelectedFile} />
              </ScrollShadow>
              <ScrollShadow className="market-file-content" size={24}>
                {selectedFile ? (
                  <>
                    <div className="market-file-heading">
                      <strong>{selectedFile.name}</strong>
                      <span>{formatBytes(selectedFile.size)}</span>
                    </div>
                    {supportsSourceAndPreview(selectedFile) && <FileViewSwitch language={language} value={fileView} onChange={setFileView} />}
                    {fileView === 'preview' && isHtmlFile(selectedFile.name) && selectedFile.content ? (
                      <iframe className="file-html-preview" sandbox="" srcDoc={sandboxHtml(selectedFile.content)} title={selectedFile.name} />
                    ) : fileView === 'preview' && selectedFile.kind === 'image' && selectedFile.dataUrl ? (
                      <div className="market-image-preview"><img src={selectedFile.dataUrl} alt={selectedFile.name} /></div>
                    ) : selectedFile.content === null ? (
                      <div className="file-preview-state">{copy.unsupported}</div>
                    ) : selectedFile.kind === 'markdown' ? (
                      <MarkdownRenderer content={selectedFile.content} className="market-markdown" showFrontmatter={false} />
                    ) : (
                      <ScrollShadow className="market-code-scroll" orientation="horizontal" size={24}><pre>{selectedFile.content}</pre></ScrollShadow>
                    )}
                  </>
                ) : (
                  <div className="file-preview-state">{copy.selectFile}</div>
                )}
              </ScrollShadow>
            </div>
          )}
      </ScrollShadow>

      {showInstall && preview && (
        <section className="market-detail-install">
          <InstallPanel skill={preview} onCancel={() => setShowInstall(false)} onInstalled={onInstalled} onError={onError} />
        </section>
      )}
    </div>
  )
}

function FileViewSwitch({ language, value, onChange }: { language: AppLanguage; value: 'preview' | 'source'; onChange: (value: 'preview' | 'source') => void }): React.JSX.Element {
  const labels = fileViewLabels(language)
  return <div className="file-view-switch"><button type="button" className={value === 'preview' ? 'active' : ''} onClick={() => onChange('preview')}>{labels.preview}</button><button type="button" className={value === 'source' ? 'active' : ''} onClick={() => onChange('source')}>{labels.source}</button></div>
}

function supportsSourceAndPreview(file: { name: string; content: string | null; dataUrl?: string }): boolean {
  return Boolean(file.content && (isHtmlFile(file.name) || file.name.toLowerCase().endsWith('.svg')) && (file.dataUrl || isHtmlFile(file.name)))
}

function isHtmlFile(name: string): boolean { return /\.html?$/i.test(name) }

function sandboxHtml(content: string): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">`
  return /<head[\s>]/i.test(content) ? content.replace(/<head([^>]*)>/i, `<head$1>${policy}`) : `${policy}${content}`
}

function MarketFileTreeList({ nodes, selectedPath, onSelect, depth = 0 }: { nodes: MarketFileTreeNode[]; selectedPath?: string; onSelect: (file: MarketPreviewFile) => void; depth?: number }): React.JSX.Element {
  return <>{nodes.map((node) => node.type === 'directory' ? (
    <div className="market-file-tree-group" key={node.relativePath}>
      <div className="market-file-folder" style={{ paddingLeft: 10 + depth * 14 }}><Folder size={15} /><span>{node.name}</span></div>
      <MarketFileTreeList nodes={node.children || []} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
    </div>
  ) : (
    <button key={node.relativePath} type="button" style={{ paddingLeft: 10 + depth * 14 }} className={selectedPath === node.relativePath ? 'active' : ''} onClick={() => node.file && onSelect(node.file)}>
      {node.file?.kind === 'image' ? <FileText size={15} /> : node.file?.kind === 'script' ? <FileCode2 size={15} /> : <FileText size={15} />}
      <span>{node.name}</span>
    </button>
  ))}</>
}

function InstallPanel({ skill, onCancel, onInstalled, onError }: { skill: MarketSkillPreview; onCancel: () => void; onInstalled: (result: MarketInstallResult) => Promise<void>; onError: (message: string) => void }): React.JSX.Element {
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  const projects = useAppStore((state) => state.projects)
  const copyText = marketCopy(language)
  const [targets, setTargets] = useState<MarketInstallTarget[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scope, setScope] = useState<'global' | 'project'>('global')
  const [projectId, setProjectId] = useState('')
  const [copy, setCopy] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    void window.aiHelper.invoke<MarketInstallTarget[]>('market:listInstallTargets').then((next) => {
      setTargets(next)
      const preferred = next.filter((target) => skill.installedOn.includes(target.id)).map((target) => target.id)
      setSelected(new Set(preferred.length ? preferred : next.slice(0, 1).map((target) => target.id)))
    }).catch((error) => onError(formatError(error)))
  }, [skill.id])

  useEffect(() => {
    const available = new Set(targets.filter((target) => scope === 'global' ? target.systemPath : target.projectPath).map((target) => target.id))
    setSelected((current) => new Set([...current].filter((id) => available.has(id))))
  }, [scope, targets])

  async function install(): Promise<void> {
    if (!selected.size) return
    if (scope === 'project' && !projectId) return
    setRunning(true)
    try {
      const result = await window.aiHelper.invoke<MarketInstallResult>('market:install', {
        source: skill.installSource,
        skillName: marketSkillLocator(skill),
        agents: [...selected],
        global: scope === 'global',
        projectId: scope === 'project' ? projectId : undefined,
        copy
      })
      const failed = result.targets.filter((target) => !target.success)
      const succeeded = result.targets.filter((target) => target.success)
      if (failed.length) onError(`${failed.map((target) => target.name).join(', ')}: ${translate(language, 'market.installFailed')}`)
      if (succeeded.length) await onInstalled(result)
      else throw new Error(`${result.commandResult.stdout}\n${result.commandResult.stderr}`.trim() || translate(language, 'market.installFailed'))
    } catch (error) {
      onError(formatError(error))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="install-panel">
      <div className="install-panel-heading"><div><strong>{copyText.chooseLocation}</strong><span>{copyText.multiTarget}</span></div><button type="button" onClick={onCancel}><X size={15} /></button></div>
      <ScrollShadow className="install-targets" size={20}>
        {targets.map((target) => (
          <label key={target.id} className={selected.has(target.id) ? 'selected' : ''}>
            <input type="checkbox" disabled={scope === 'global' ? !target.systemPath : !target.projectPath} checked={selected.has(target.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(target.id)) next.delete(target.id); else next.add(target.id); return next })} />
            <InstallTargetIcon target={target} />
            <span><strong>{target.name}</strong><small>{scope === 'global' ? target.systemPath || copyText.noTargets : target.projectPath || copyText.noTargets}</small></span>
            {selected.has(target.id) && <Check size={15} />}
          </label>
        ))}
        {!targets.length && <div className="install-empty">{copyText.noTargets}</div>}
      </ScrollShadow>
      <div className="install-options">
        <div className="install-segmented"><button type="button" className={scope === 'global' ? 'active' : ''} onClick={() => setScope('global')}>{copyText.global}</button><button type="button" className={scope === 'project' ? 'active' : ''} onClick={() => setScope('project')}>{copyText.project}</button></div>
        {scope === 'project' && <select className="project-picker" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{copyText.chooseProject}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} — {project.path}</option>)}</select>}
        <label className="copy-option"><input type="checkbox" checked={copy} onChange={(event) => setCopy(event.target.checked)} /><span><strong>{copyText.copy}</strong><small>{copyText.copyHint}</small></span></label>
      </div>
      <Button variant="primary" isDisabled={!selected.size || running || (scope === 'project' && !projectId)} onPress={() => void install()}>{running ? <RefreshCw size={16} className="spin" /> : <PackageCheck size={16} />}{running ? copyText.installing : marketText(copyText.installApps, { count: selected.size })}</Button>
    </div>
  )
}

function InstallTargetIcon({ target }: { target: MarketInstallTarget }): React.JSX.Element {
  const candidates = [target.id, target.name, target.path].map(normalizeAgentText)

  if (candidates.some((candidate) => candidate.includes('deepseek'))) {
    return <span className="install-app-icon"><DeepSeek.Color size={28} /></span>
  }

  for (const mapping of agentMappings) {
    for (const keyword of mapping.keywords) {
      const normalizedKeyword = normalizeAgentText(keyword)
      if (normalizedKeyword && candidates.some((candidate) => candidate.includes(normalizedKeyword))) {
        return (
          <span className="install-app-icon">
            <AgentIcon agent={keyword} size={28} type="color" />
          </span>
        )
      }
    }
  }

  return (
    <span className="install-app-icon fallback">
      {target.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function normalizeAgentText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function SourceManager({ sources, error, onClose, onChange, onError }: { sources: MarketSource[]; error: string | null; onClose: () => void; onChange: (sources: MarketSource[]) => void; onError: (message: string) => void }): React.JSX.Element {
  const language = resolveAppLanguage(useAppStore((state) => state.preferences.language))
  const copy = marketCopy(language)
  const paletteCopy = marketPaletteCopy(language)
  const paletteOptions = Object.entries(paletteCopy.names) as Array<[MarketPalette, string]>
  const [source, setSource] = useState('')
  const [name, setName] = useState('')
  const [running, setRunning] = useState(false)

  async function addSource(): Promise<void> {
    if (!source.trim()) return
    setRunning(true)
    try {
      const next = await window.aiHelper.invoke<MarketSource[]>('market:addSource', { source, name })
      onChange(next)
      setSource('')
      setName('')
    } catch (error) {
      onError(formatError(error))
    } finally {
      setRunning(false)
    }
  }

  async function removeSource(id: string): Promise<void> {
    try {
      const next = await window.aiHelper.invoke<MarketSource[]>('market:removeSource', id)
      onChange(next)
    } catch (error) {
      onError(formatError(error))
    }
  }

  async function updatePalette(sourceId: string, palette: MarketPalette): Promise<void> {
    try {
      const next = await window.aiHelper.invoke<MarketSource[]>('market:updateSourcePalette', { sourceId, palette })
      onChange(next)
    } catch (error) {
      onError(formatError(error))
    }
  }

  return (
    <div className="source-manager-page">
      <header className="detail-header source-manager-header">
        <div className="detail-title-row">
          <div><h2>{copy.manageTitle}</h2><p>{copy.manageBody}</p></div>
          <div className="detail-actions"><Button variant="secondary" size="sm" onPress={onClose}><ArrowLeft size={15} />{copy.back}</Button></div>
        </div>
      </header>
      {error && <div className="market-message error"><AlertTriangle size={15} /><span>{error}</span></div>}
      <ScrollShadow className="source-list" size={24}>
        {sources.map((item) => (
          <div key={item.id} className="source-list-item">
            <span className={`source-kind ${item.kind}`}>{item.builtin ? <MarketSourceIcon source={item} /> : item.kind === 'local' ? 'L' : <FolderGit2 size={20} />}</span>
            <div className="source-list-copy"><strong>{localizedSourceName(item.id, item.name, language)}</strong><span>{item.source}</span><small>{localizedSourceDescription(item.id, item.description, language)}</small></div>
            <div className="source-list-actions">
              <Select className="source-palette-select" variant="secondary" aria-label={paletteCopy.label} selectedKey={item.palette} onSelectionChange={(key) => void updatePalette(item.id, String(key) as MarketPalette)}>
                <Select.Trigger><Select.Value><PaletteSwatches palette={item.palette} /><span>{paletteCopy.names[item.palette]}</span></Select.Value><Select.Indicator /></Select.Trigger>
                <Select.Popover><ListBox aria-label={paletteCopy.label}>{paletteOptions.map(([id, label]) => <ListBox.Item key={id} id={id} textValue={label}><PaletteSwatches palette={id} /><span>{label}</span><ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
              </Select>
              {item.builtin ? <Chip size="sm" variant="tertiary">{copy.builtin}</Chip> : <button type="button" aria-label={copy.deleteSource} onClick={() => void removeSource(item.id)}><Trash2 size={15} /></button>}
            </div>
          </div>
        ))}
      </ScrollShadow>
      <div className="source-add-form">
        <div><label>{copy.sourceAddress}</label><input value={source} onChange={(event) => setSource(event.target.value)} placeholder={translate(language, 'market.sourcePlaceholder')} /></div>
        <div><label>{copy.displayName}</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.optional} /></div>
        <Button variant="primary" isDisabled={!source.trim() || running} onPress={() => void addSource()}><Plus size={16} />{copy.add}</Button>
      </div>
    </div>
  )
}

function PaletteSwatches({ palette }: { palette: MarketPalette }): React.JSX.Element {
  return <span className="palette-swatches" aria-hidden="true">{MARKET_PALETTES[palette].map((tone) => <i key={tone.color} style={{ background: tone.color }} />)}</span>
}

function dedupeSkills(skills: MarketSkill[]): MarketSkill[] {
  const seen = new Set<string>()
  return skills.filter((skill) => {
    const key = `${skill.source.toLowerCase()}:${skill.name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function marketSkillMatchesQuery(skill: MarketSkill, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = [skill.name, skill.description, skill.author, skill.category, skill.sourceName, ...skill.tags]
    .join('\n')
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

function categoryColorIndex(category: string, fallback: number): number {
  let value = fallback
  for (const character of category) value += character.charCodeAt(0)
  return Math.abs(value) % 6
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatError(error: unknown): string {
  return String(error)
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^(?:Error:\s*)+/, '')
}

function marketSkillLocator(skill: MarketSkill): string {
  return skill.sourcePath || skill.name
}
