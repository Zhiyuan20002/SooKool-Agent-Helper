import React, { useEffect, useState } from 'react'
import { Button, Input, ListBox, Select, Spinner, TextField } from '@heroui/react'
import { AgentIcon } from '@lobehub/icons'
import Bailian from '@lobehub/icons/es/Bailian'
import DeepSeek from '@lobehub/icons/es/DeepSeek'
import Kimi from '@lobehub/icons/es/Kimi'
import Minimax from '@lobehub/icons/es/Minimax'
import ModelScope from '@lobehub/icons/es/ModelScope'
import OpenRouter from '@lobehub/icons/es/OpenRouter'
import SiliconCloud from '@lobehub/icons/es/SiliconCloud'
import Stepfun from '@lobehub/icons/es/Stepfun'
import Zhipu from '@lobehub/icons/es/Zhipu'
import {
  AlertCircle,
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CircleDot,
  Clock3,
  Database,
  KeyRound,
  Network,
  Play,
  Plus,
  Power,
  RefreshCw,
  Route,
  Save,
  Server,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import type {
  ProxyRoutingAppType,
  RoutingAppType,
  RoutingProxyAppConfig,
  RoutingProxySnapshot,
  RoutingProviderAppConfig,
  RoutingProviderSummary,
  RoutingSnapshot,
  RoutingUsageGroup,
  RoutingUsageSnapshot
} from '../../../shared/routing-types'
import type { ViewType } from '@/stores/app-store'
import {
  createBlankProviderForm,
  createProviderFormFromPreset,
  routingProviderPresets,
  type NewRoutingProviderForm
} from '../routing-provider-presets'
import '../routing-provider-presets.css'

const appLabels: Record<RoutingAppType, string> = {
  claude: 'Claude Code',
  'claude-desktop': 'Claude Desktop',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  opencode: 'OpenCode',
  openclaw: 'OpenClaw',
  hermes: 'Hermes Agent'
}

const categoryOptions = [
  { value: 'official', label: '官方' },
  { value: 'cn_official', label: '国内官方' },
  { value: 'cloud_provider', label: '云服务商' },
  { value: 'aggregator', label: '聚合服务' },
  { value: 'third_party', label: '第三方' },
  { value: 'custom', label: '自定义' }
]

const apiKeyFieldOptions = [
  { value: 'ANTHROPIC_AUTH_TOKEN', label: 'ANTHROPIC_AUTH_TOKEN' },
  { value: 'ANTHROPIC_API_KEY', label: 'ANTHROPIC_API_KEY' }
]

const providerIconComponents: Record<string, React.ComponentType<{ size?: number }>> = {
  bailian: Bailian.Color,
  bailiancodingplan: Bailian.Color,
  deepseek: DeepSeek.Color,
  kimi: Kimi.Color,
  kimicodingplan: Kimi.Color,
  minimax: Minimax.Color,
  minimaxcodingplan: Minimax.Color,
  modelscope: ModelScope.Color,
  openrouter: OpenRouter,
  siliconcloud: SiliconCloud.Color,
  siliconflow: SiliconCloud.Color,
  stepfun: Stepfun.Color,
  stepfuncodingplan: Stepfun.Color,
  zhipu: Zhipu.Color
}

type ProviderForm = NewRoutingProviderForm

export function ModelRouting({ view }: { view: ViewType }): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<RoutingSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      setSnapshot(await window.aiHelper.routing.getSnapshot())
    } catch (cause) {
      setError(stripError(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading && !snapshot) return <RoutingLoading />
  if (!snapshot) return <RoutingError message={error ?? '无法读取模型路由数据'} onRetry={load} />
  if (view === 'routing-providers') {
    return <ProvidersPage snapshot={snapshot} onChanged={load} />
  }
  if (view === 'routing-proxy') {
    return <LocalRoutingPage routing={snapshot} />
  }
  if (view === 'routing-usage') {
    return <RoutingUsagePage />
  }
  return <RoutingOverview snapshot={snapshot} onRefresh={load} />
}

function RoutingOverview({
  snapshot,
  onRefresh
}: {
  snapshot: RoutingSnapshot
  onRefresh: () => Promise<void>
}): React.JSX.Element {
  const activeApps = snapshot.apps.filter((app) => app.providerCount > 0)
  const currentCount = activeApps.filter((app) => app.currentProviderKey).length
  return (
    <section className="routing-page">
      <RoutingHeader title="路由总览" />
      <div className="routing-hero">
        <div>
          <span className="routing-hero-label">已连接应用</span>
          <strong>{activeApps.length}</strong>
        </div>
        <div>
          <span className="routing-hero-label">当前路由已识别</span>
          <strong>{currentCount}</strong>
        </div>
        <div>
          <span className="routing-hero-label">供应商配置</span>
          <strong>{snapshot.providers.length}</strong>
        </div>
      </div>
      <div className="routing-app-list">
        {snapshot.apps.map((app) => (
          <AppRouteRow key={app.id} app={app} providers={snapshot.providers} onChanged={onRefresh} />
        ))}
      </div>
    </section>
  )
}

function AppRouteRow({
  app,
  providers,
  onChanged
}: {
  app: RoutingSnapshot['apps'][number]
  providers: RoutingProviderSummary[]
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const available = providers.filter((provider) => provider.applications.some((item) => item.appType === app.id))
  const [selectedKey, setSelectedKey] = useState(app.currentProviderKey ?? available[0]?.key ?? '')
  const selectedAdapter = available.find((provider) => provider.key === selectedKey)
    ?.applications.find((application) => application.appType === app.id)
  const switchable = app.id === 'claude' || app.id === 'codex' || app.id === 'gemini'
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activate = async (): Promise<void> => {
    if (!selectedKey) return
    try {
      setActivating(true)
      setError(null)
      await window.aiHelper.routing.activateProvider({ key: selectedKey, appType: app.id })
      await onChanged()
    } catch (cause) {
      setError(stripError(cause))
    } finally {
      setActivating(false)
    }
  }
  return (
    <div className="routing-app-row">
      <AppGlyph app={app.id} />
      <div className="routing-app-copy">
        <strong>{appLabels[app.id]}</strong>
        <span>{app.providerCount > 0 ? `${app.providerCount} 个可用供应商` : '尚未配置供应商'}</span>
      </div>
      <div className="routing-current-provider">
        {app.currentProviderName ? <><CircleDot size={14} /><span>{app.currentProviderName}</span></> : <span className="routing-muted">未识别当前路由</span>}
      </div>
      <div className="routing-activation-control">
        <Select className="routing-provider-select" variant="secondary" aria-label={`${appLabels[app.id]} 供应商`} selectedKey={selectedKey || null} isDisabled={!available.length || activating} onSelectionChange={(key) => setSelectedKey(String(key))}>
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover placement="bottom end">
            <ListBox aria-label={`${appLabels[app.id]} 供应商`}>
              {available.map((provider) => (
                <ListBox.Item key={provider.key} id={provider.key} textValue={provider.name}><span>{provider.name}</span><ListBox.ItemIndicator /></ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button size="sm" variant="secondary" isDisabled={!switchable || !selectedKey || selectedKey === app.currentProviderKey || activating || selectedAdapter?.requiresProxy} onPress={() => void activate()}>
          {activating ? <Spinner size="sm" /> : selectedAdapter?.requiresProxy ? '需本地路由' : switchable ? '激活' : '待接入'}
        </Button>
        {error && <span className="routing-activation-error" title={error}><AlertCircle size={14} /></span>}
      </div>
    </div>
  )
}

function ProvidersPage({
  snapshot,
  onChanged
}: {
  snapshot: RoutingSnapshot
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const providers = snapshot.providers
  const [selectedKey, setSelectedKey] = useState<string | null>(providers[0]?.key ?? null)
  const [form, setForm] = useState<ProviderForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = providers.find((provider) => provider.key === selectedKey) ?? providers[0]

  const beginEdit = (provider?: RoutingProviderSummary): void => {
    setError(null)
    setForm(provider ? {
      key: provider.key,
      applications: provider.applications.map((application) => application.appType),
      applicationConfigs: Object.fromEntries(provider.applications.map((application) => [
        application.appType,
        {
          baseUrl: application.baseUrl ?? '',
          model: application.model ?? '',
          wireApi: application.wireApi,
          defaultHaikuModel: application.defaultHaikuModel ?? '',
          defaultSonnetModel: application.defaultSonnetModel ?? '',
          defaultOpusModel: application.defaultOpusModel ?? '',
          autoCompactWindow: application.autoCompactWindow ?? '',
          apiTimeoutMs: application.apiTimeoutMs ?? '',
          disableNonessentialTraffic: application.disableNonessentialTraffic ?? false
        }
      ])),
      name: provider.name,
      baseUrl: provider.baseUrl ?? '',
      apiKey: '',
      model: provider.model ?? '',
      defaultHaikuModel: provider.defaultHaikuModel ?? '',
      defaultSonnetModel: provider.defaultSonnetModel ?? '',
      defaultOpusModel: provider.defaultOpusModel ?? '',
      websiteUrl: provider.websiteUrl ?? '',
      apiKeyUrl: provider.apiKeyUrl ?? '',
      category: provider.category ?? 'custom',
      apiKeyField: provider.apiKeyField ?? 'ANTHROPIC_AUTH_TOKEN',
      icon: provider.icon ?? '',
      iconColor: provider.iconColor ?? '',
      notes: provider.notes ?? ''
    } : createBlankProviderForm())
  }

  const save = async (): Promise<void> => {
    if (!form) return
    try {
      setSaving(true)
      setError(null)
      const saved = await window.aiHelper.routing.saveProvider(form)
      await onChanged()
      setSelectedKey(saved.key)
      setForm(null)
    } catch (cause) {
      setError(stripError(cause))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (provider: RoutingProviderSummary): Promise<void> => {
    if (!confirm(`确定删除“${provider.name}”吗？此操作不可撤销。`)) return
    try {
      setError(null)
      await window.aiHelper.routing.deleteProvider({ key: provider.key })
      setSelectedKey(null)
      await onChanged()
    } catch (cause) {
      setError(stripError(cause))
    }
  }

  if (form) {
    return (
      <section className="routing-page routing-editor-page">
        {error && <div className="routing-error-banner"><AlertCircle size={15} /><span>{error}</span></div>}
        <ProviderEditor form={form} setForm={setForm} saving={saving} onCancel={() => setForm(null)} onSave={save} />
      </section>
    )
  }

  return (
    <section className="routing-page routing-providers-page">
      <RoutingHeader
        title="供应商"
        action={<Button size="sm" variant="primary" onPress={() => beginEdit()}><Plus size={15} />新增</Button>}
      />
      {error && <div className="routing-error-banner"><AlertCircle size={15} /><span>{error}</span></div>}
      <div className="routing-provider-workbench">
        <div className="routing-provider-list">
          {providers.map((provider) => (
            <button
              type="button"
              className={`routing-provider-row ${selected?.key === provider.key ? 'selected' : ''}`}
              key={provider.key}
              onClick={() => { setSelectedKey(provider.key); setForm(null) }}
            >
              <ProviderGlyph provider={provider} />
              <span className="routing-provider-row-copy">
                <strong>{provider.name}</strong>
                <small>{provider.baseUrl ?? '未设置 API 地址'}</small>
              </span>
              <span className="routing-provider-apps">
                {provider.applications.map((application) => (
                  <AppGlyph key={application.appType} app={application.appType} compact />
                ))}
              </span>
              {provider.isCurrent && <span className="routing-current-dot" title="当前供应商" />}
            </button>
          ))}
          {providers.length === 0 && (
            <div className="routing-empty-list"><Server size={28} /><span>这个应用还没有供应商</span></div>
          )}
        </div>
        <div className="routing-provider-detail">
          {selected ? (
            <ProviderDetail provider={selected} onEdit={() => beginEdit(selected)} onDelete={() => void remove(selected)} />
          ) : (
            <div className="routing-detail-empty"><Route size={36} /><p>选择一个供应商，或新建配置。</p></div>
          )}
        </div>
      </div>
    </section>
  )
}

function ProviderDetail({
  provider,
  onEdit,
  onDelete
}: {
  provider: RoutingProviderSummary
  onEdit: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <div className="routing-detail-content">
      <div className="routing-detail-title">
        <ProviderGlyph provider={provider} large />
        <div><h2>{provider.name}</h2><span>{provider.applications.map((item) => appLabels[item.appType]).join(' · ')}</span></div>
        {provider.isCurrent && <span className="routing-status-badge"><Check size={13} />当前使用</span>}
      </div>
      <div className="routing-source-callout">
        {provider.source === 'cc-switch' ? <Database size={16} /> : <ShieldCheck size={16} />}
        <div>
          <strong>{provider.source === 'cc-switch' ? '来自 CC-Switch' : '由 SooKool 管理'}</strong>
          <span>{provider.source === 'cc-switch' ? '原数据保持可读、可管理；编辑结果保存在 SooKool 数据目录。' : '数据保存在 SooKool 独立目录。'}</span>
        </div>
      </div>
      <dl className="routing-detail-grid">
        <div><dt>API 地址</dt><dd>{provider.baseUrl ?? '未设置'}</dd></div>
        <div><dt>模型</dt><dd>{provider.model ?? '由应用或服务端决定'}</dd></div>
        <div><dt>凭据</dt><dd>{provider.hasSecret ? '已配置' : '未配置'}</dd></div>
        <div><dt>分类</dt><dd>{provider.category ?? '自定义'}</dd></div>
        {provider.applications.some((item) => item.appType === 'claude' || item.appType === 'claude-desktop') && <div><dt>Claude 认证字段</dt><dd>{provider.apiKeyField ?? 'ANTHROPIC_AUTH_TOKEN'}</dd></div>}
        <div><dt>官方网站</dt><dd>{provider.websiteUrl ?? '未设置'}</dd></div>
        <div><dt>API Key 获取地址</dt><dd>{provider.apiKeyUrl ?? '未设置'}</dd></div>
        {provider.defaultHaikuModel && <div><dt>Haiku 默认模型</dt><dd>{provider.defaultHaikuModel}</dd></div>}
        {provider.defaultSonnetModel && <div><dt>Sonnet 默认模型</dt><dd>{provider.defaultSonnetModel}</dd></div>}
        {provider.defaultOpusModel && <div><dt>Opus 默认模型</dt><dd>{provider.defaultOpusModel}</dd></div>}
      </dl>
      <div className="routing-adapter-summary">
        {provider.applications.map((application) => (
          <section key={application.appType} className="routing-adapter-card">
            <h3><AppGlyph app={application.appType} compact />{appLabels[application.appType]}</h3>
            <dl>
              <div><dt>API 地址</dt><dd>{application.baseUrl ?? '未设置'}</dd></div>
              <div><dt>模型</dt><dd>{application.model ?? '由服务端决定'}</dd></div>
              {application.wireApi && <div><dt>接口模式</dt><dd>Responses API</dd></div>}
              {application.requiresProxy && <div><dt>兼容状态</dt><dd>依赖 CC-Switch 本地路由，暂不可直接激活或编辑</dd></div>}
            </dl>
          </section>
        ))}
      </div>
      {provider.notes && <p className="routing-notes">{provider.notes}</p>}
      <div className="routing-detail-actions">
        <Button variant="primary" isDisabled={provider.applications.some((application) => application.requiresProxy)} onPress={onEdit}>编辑</Button>
        <Button variant="danger-soft" isDisabled={provider.isCurrent} onPress={onDelete}><Trash2 size={15} />删除</Button>
      </div>
    </div>
  )
}

function ProviderEditor({
  form,
  setForm,
  saving,
  onCancel,
  onSave
}: {
  form: ProviderForm
  setForm: React.Dispatch<React.SetStateAction<ProviderForm | null>>
  saving: boolean
  onCancel: () => void
  onSave: () => Promise<void>
}): React.JSX.Element {
  const update = (key: keyof ProviderForm, value: string): void =>
    setForm((current) => current ? { ...current, [key]: value } : current)
  const updateApplication = (
    appType: RoutingAppType,
    patch: Partial<RoutingProviderAppConfig>
  ): void => setForm((current) => current ? {
    ...current,
    applicationConfigs: {
      ...current.applicationConfigs,
      [appType]: { ...current.applicationConfigs?.[appType], ...patch }
    }
  } : current)
  const toggleApplication = (appType: RoutingAppType): void => setForm((current) => {
    if (!current) return current
    const applications = current.applications ?? []
    return {
      ...current,
      applications: applications.includes(appType)
        ? applications.filter((item) => item !== appType)
        : [...applications, appType],
      applicationConfigs: {
        ...current.applicationConfigs,
        [appType]: current.applicationConfigs?.[appType]
          ?? (appType === 'codex' ? { wireApi: 'responses' } : {})
      }
    }
  })
  const hasClaudeApplication = form.applications?.some((app) => app === 'claude' || app === 'claude-desktop')
  return (
    <div className="routing-editor">
      <div className="routing-editor-header">
        <Button isIconOnly size="sm" variant="ghost" aria-label="返回" onPress={onCancel}><ArrowLeft size={16} /></Button>
        <div><h2>{form.key ? '编辑供应商' : '新建供应商'}</h2></div>
      </div>
      {!form.key && (
        <div className="routing-preset-picker" aria-label="内置供应商">
          {routingProviderPresets.map((preset) => {
            const selected = form.name === preset.name && form.baseUrl === preset.baseUrl
            return (
              <Button
                key={preset.id}
                className="routing-preset-option"
                variant={selected ? 'secondary' : 'ghost'}
                onPress={() => setForm(createProviderFormFromPreset(preset))}
              >
                <span className="routing-preset-option-content">
                  <RoutingProviderIcon icon={preset.icon} size={22} />
                  <span className="routing-preset-option-copy">
                    <strong>{preset.name}</strong>
                    <span>{preset.description}</span>
                  </span>
                </span>
              </Button>
            )
          })}
        </div>
      )}
      <div className="routing-app-picker" aria-label="可用应用">
        {(['claude', 'claude-desktop', 'codex', 'gemini', 'opencode', 'openclaw', 'hermes'] as RoutingAppType[]).map((app) => (
          <Button key={app} size="sm" variant={form.applications?.includes(app) ? 'secondary' : 'ghost'} onPress={() => toggleApplication(app)}>
            <span className="routing-app-picker-content">
              <AppGlyph app={app} compact />
              <span>{appLabels[app]}</span>
            </span>
          </Button>
        ))}
      </div>
      <div className="routing-form-section">
        <h3>基础信息</h3>
        <div className="routing-form-grid">
          <RoutingField label="名称" value={form.name} placeholder="例如：公司网关" onChange={(value) => update('name', value)} />
          <RoutingSelectField label="供应商分类" value={form.category ?? 'custom'} options={categoryOptions} onChange={(value) => update('category', value)} />
          <RoutingField label="官方网站" value={form.websiteUrl ?? ''} placeholder="https://example.com" onChange={(value) => update('websiteUrl', value)} />
          <RoutingField label="API Key 获取地址" value={form.apiKeyUrl ?? ''} placeholder="https://example.com/api-keys" onChange={(value) => update('apiKeyUrl', value)} />
          <RoutingField label="备注" value={form.notes ?? ''} placeholder="可选" onChange={(value) => update('notes', value)} />
        </div>
      </div>
      <div className="routing-form-section">
        <h3>连接配置</h3>
        <div className="routing-form-grid">
          <RoutingField label="API Key" type="password" value={form.apiKey} placeholder={form.key ? '留空则沿用已有凭据' : '输入 API Key'} onChange={(value) => update('apiKey', value)} />
          {hasClaudeApplication && <RoutingSelectField label="Claude 认证字段" value={form.apiKeyField ?? 'ANTHROPIC_AUTH_TOKEN'} options={apiKeyFieldOptions} onChange={(value) => update('apiKeyField', value)} />}
        </div>
      </div>
      {form.applications?.map((appType) => {
        const config = form.applicationConfigs?.[appType] ?? {}
        const isClaude = appType === 'claude' || appType === 'claude-desktop'
        return (
          <div className="routing-form-section routing-adapter-form" key={appType}>
            <h3><AppGlyph app={appType} compact />{appLabels[appType]} 配置</h3>
            <div className="routing-form-grid">
              <RoutingField label="API 地址" value={config.baseUrl ?? ''} placeholder="https://api.example.com" onChange={(value) => updateApplication(appType, { baseUrl: value })} />
              <RoutingField label="主模型" value={config.model ?? ''} placeholder="由服务端决定" onChange={(value) => updateApplication(appType, { model: value })} />
              {appType === 'codex' && <div className="routing-field"><span className="routing-field-label">Codex 接口模式</span><span>Responses API（直连）</span></div>}
              {isClaude && <RoutingField label="Haiku 默认模型" value={config.defaultHaikuModel ?? ''} placeholder="可选" onChange={(value) => updateApplication(appType, { defaultHaikuModel: value })} />}
              {isClaude && <RoutingField label="Sonnet 默认模型" value={config.defaultSonnetModel ?? ''} placeholder="可选" onChange={(value) => updateApplication(appType, { defaultSonnetModel: value })} />}
              {isClaude && <RoutingField label="Opus 默认模型" value={config.defaultOpusModel ?? ''} placeholder="可选" onChange={(value) => updateApplication(appType, { defaultOpusModel: value })} />}
              {isClaude && <RoutingField label="自动压缩窗口" value={config.autoCompactWindow ?? ''} placeholder="可选，例如 262144" onChange={(value) => updateApplication(appType, { autoCompactWindow: value })} />}
              {isClaude && <RoutingField label="API 超时（毫秒）" value={config.apiTimeoutMs ?? ''} placeholder="可选" onChange={(value) => updateApplication(appType, { apiTimeoutMs: value })} />}
              {isClaude && <RoutingSelectField label="禁用非必要流量" value={config.disableNonessentialTraffic ? 'true' : 'false'} options={[{ value: 'false', label: '关闭' }, { value: 'true', label: '开启' }]} onChange={(value) => updateApplication(appType, { disableNonessentialTraffic: value === 'true' })} />}
            </div>
          </div>
        )
      })}
      <div className="routing-editor-actions">
        <Button variant="ghost" onPress={onCancel}>取消</Button>
        <Button variant="primary" isDisabled={saving || !form.name.trim() || !form.applications?.length} onPress={() => void onSave()}>
          {saving ? <Spinner size="sm" /> : <Save size={15} />}保存
        </Button>
      </div>
    </div>
  )
}

function RoutingField({
  label,
  value,
  placeholder,
  type = 'text',
  onChange
}: {
  label: string
  value: string
  placeholder: string
  type?: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <TextField className="routing-field" variant="secondary">
      <span className="routing-field-label">{label}</span>
      <Input value={value} type={type} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </TextField>
  )
}

function RoutingSelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="routing-field">
      <span className="routing-field-label">{label}</span>
      <Select variant="secondary" aria-label={label} selectedKey={value} onSelectionChange={(key) => onChange(String(key))}>
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox aria-label={label}>
            {options.map((option) => (
              <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                <span>{option.label}</span><ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  )
}

function RoutingHeader({ title, action }: { title: string; action?: React.ReactNode }): React.JSX.Element {
  return <header className="routing-header"><h1>{title}</h1>{action}</header>
}

function AppGlyph({ app, compact = false }: { app: RoutingAppType; compact?: boolean }): React.JSX.Element {
  const agent = app === 'claude'
    ? 'claude-code'
    : app === 'claude-desktop'
      ? 'claude'
      : app === 'gemini'
        ? 'gemini'
        : app
  return <span className={`routing-app-glyph app-${app} ${compact ? 'compact' : ''}`}><AgentIcon agent={agent} size={compact ? 16 : 28} type="color" /></span>
}

function ProviderGlyph({ provider, large = false }: { provider: RoutingProviderSummary; large?: boolean }): React.JSX.Element {
  return <span className={`routing-provider-glyph ${large ? 'large' : ''}`} style={provider.iconColor ? { color: provider.iconColor } : undefined}>{provider.icon && providerIconComponents[provider.icon] ? <RoutingProviderIcon icon={provider.icon} size={large ? 28 : 20} /> : provider.hasSecret ? <KeyRound size={large ? 20 : 15} /> : <Server size={large ? 20 : 15} />}</span>
}

function RoutingProviderIcon({ icon, size }: { icon: string; size: number }): React.JSX.Element | null {
  const Icon = providerIconComponents[icon]
  return Icon ? <Icon size={size} /> : null
}

function RoutingLoading(): React.JSX.Element {
  return <div className="routing-centered"><Spinner size="lg" /><span>正在读取模型路由…</span></div>
}

function RoutingError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }): React.JSX.Element {
  return <div className="routing-centered"><AlertCircle size={34} /><strong>模型路由暂时不可用</strong><span>{message}</span><Button onPress={() => void onRetry()}>重试</Button></div>
}

function LocalRoutingPage({ routing }: { routing: RoutingSnapshot }): React.JSX.Element {
  const [routingState, setRoutingState] = useState(routing)
  const [snapshot, setSnapshot] = useState<RoutingProxySnapshot | null>(null)
  const [portDraft, setPortDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      const next = await window.aiHelper.routing.getProxySnapshot()
      setSnapshot(next)
      setPortDraft(String(next.global.listenPort))
    } catch (cause) {
      setError(stripError(cause))
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    if (!snapshot?.status.running) return
    const timer = window.setInterval(() => void window.aiHelper.routing.getProxySnapshot()
      .then(setSnapshot)
      .catch((cause) => setError(stripError(cause))), 2000)
    return () => window.clearInterval(timer)
  }, [snapshot?.status.running])

  const mutate = async (operation: () => Promise<RoutingProxySnapshot>): Promise<void> => {
    try {
      setBusy(true)
      setError(null)
      const next = await operation()
      setSnapshot(next)
      setPortDraft(String(next.global.listenPort))
    } catch (cause) {
      setError(stripError(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!snapshot) return <RoutingLoading />
  const status = snapshot.status
  return (
    <section className="routing-page routing-proxy-page">
      <RoutingHeader title="本地路由" />
      {error && <div className="routing-error-banner"><AlertCircle size={15} /><span>{error}</span></div>}
      <div className={`routing-proxy-status ${status.running ? 'running' : ''}`}>
        <div className="routing-proxy-status-main">
          <span className="routing-proxy-status-icon"><Network size={20} /></span>
          <div>
            <strong>{status.running ? '本地路由正在运行' : '本地路由尚未启动'}</strong>
            <span>http://{status.address === '::1' ? '[::1]' : status.address}:{status.port}</span>
          </div>
        </div>
        <div className="routing-proxy-live-metrics">
          <span><b>{status.totalRequests}</b> 请求</span>
          <span><b>{status.activeConnections}</b> 处理中</span>
          <span><b>{status.failoverCount}</b> 次切换</span>
        </div>
        <Button
          variant={status.running ? 'danger-soft' : 'primary'}
          isDisabled={busy}
          onPress={() => void mutate(status.running ? window.aiHelper.routing.stopProxy : window.aiHelper.routing.startProxy)}
        >
          {busy ? <Spinner size="sm" /> : status.running ? <Power size={15} /> : <Play size={15} />}
          {status.running ? '停止' : '启动'}
        </Button>
      </div>

      <section className="routing-proxy-settings">
        <div className="routing-section-heading"><h2>服务设置</h2></div>
        <div className="routing-proxy-global-grid">
          <div className="routing-field">
            <span className="routing-field-label">监听地址</span>
            <Select variant="secondary" aria-label="监听地址" selectedKey={snapshot.global.listenAddress} onSelectionChange={(key) => void mutate(() => window.aiHelper.routing.updateProxyConfig({ global: { listenAddress: String(key) } }))}>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover><ListBox aria-label="监听地址"><ListBox.Item id="127.0.0.1" textValue="127.0.0.1">127.0.0.1<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="::1" textValue="::1">::1<ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover>
            </Select>
          </div>
          <TextField className="routing-field" variant="secondary">
            <span className="routing-field-label">监听端口</span>
            <Input value={portDraft} inputMode="numeric" onChange={(event) => setPortDraft(event.target.value)} onBlur={() => {
              const port = Number(portDraft)
              if (port !== snapshot.global.listenPort) void mutate(() => window.aiHelper.routing.updateProxyConfig({ global: { listenPort: port } }))
            }} />
          </TextField>
          <div className="routing-field routing-inline-setting">
            <span><b>记录请求用量</b><small>只保存模型、Token、耗时和状态，不保存对话内容。</small></span>
            <Button size="sm" variant={snapshot.global.enableLogging ? 'secondary' : 'ghost'} onPress={() => void mutate(() => window.aiHelper.routing.updateProxyConfig({ global: { enableLogging: !snapshot.global.enableLogging } }))}>
              {snapshot.global.enableLogging ? '已开启' : '已关闭'}
            </Button>
          </div>
        </div>
      </section>

      <section className="routing-proxy-settings">
        <div className="routing-section-heading"><h2>应用路由</h2></div>
        <div className="routing-proxy-apps">
          {snapshot.apps.map((app) => (
            <ProxyAppCard
              key={app.appType}
              app={app}
              routing={routingState}
              disabled={busy}
              onUpdate={(patch) => mutate(() => window.aiHelper.routing.updateProxyConfig({ app: { appType: app.appType, ...patch } }))}
              onActivate={async (key) => {
                try {
                  setBusy(true)
                  setError(null)
                  setRoutingState(await window.aiHelper.routing.activateProvider({ key, appType: app.appType }))
                  setSnapshot(await window.aiHelper.routing.getProxySnapshot())
                } catch (cause) {
                  setError(stripError(cause))
                } finally {
                  setBusy(false)
                }
              }}
            />
          ))}
        </div>
      </section>
    </section>
  )
}

function ProxyAppCard({
  app,
  routing,
  disabled,
  onUpdate,
  onActivate
}: {
  app: RoutingProxyAppConfig
  routing: RoutingSnapshot
  disabled: boolean
  onUpdate: (patch: Partial<Omit<RoutingProxyAppConfig, 'appType'>>) => Promise<void>
  onActivate: (key: string) => Promise<void>
}): React.JSX.Element {
  const appSummary = routing.apps.find((candidate) => candidate.id === app.appType)
  const providers = routing.providers.filter((provider) => provider.applications.some((adapter) => adapter.appType === app.appType && adapter.baseUrl && !adapter.requiresProxy))
  const currentIsNative = providers.some((provider) => provider.key === appSummary?.currentProviderKey)
  const fallbackProviders = providers
    .filter((provider) => provider.key !== appSummary?.currentProviderKey)
    .sort((left, right) => {
      const leftIndex = app.queue.indexOf(left.key)
      const rightIndex = app.queue.indexOf(right.key)
      if (leftIndex < 0 && rightIndex < 0) return 0
      if (leftIndex < 0) return 1
      if (rightIndex < 0) return -1
      return leftIndex - rightIndex
    })
  const toggleQueue = (key: string): void => {
    const queue = app.queue.includes(key) ? app.queue.filter((item) => item !== key) : [...app.queue, key]
    void onUpdate({ queue })
  }
  return (
    <article className={`routing-proxy-app ${app.enabled ? 'enabled' : ''}`}>
      <div className="routing-proxy-app-head">
        <AppGlyph app={app.appType} />
        <div><strong>{appLabels[app.appType]}</strong><span>{appSummary?.currentProviderName ?? '尚未激活供应商'}</span></div>
        <Button size="sm" variant={app.enabled ? 'secondary' : 'ghost'} isDisabled={disabled || (!app.enabled && !currentIsNative)} onPress={() => void onUpdate({ enabled: !app.enabled })}>{app.enabled ? '已启用' : '启用'}</Button>
      </div>
      <div className="routing-proxy-app-options">
        <div className="routing-field">
          <span className="routing-field-label">主供应商</span>
          <Select variant="secondary" aria-label={`${appLabels[app.appType]} 主供应商`} selectedKey={currentIsNative ? appSummary?.currentProviderKey ?? null : null} isDisabled={disabled || !providers.length} onSelectionChange={(key) => {
            const selected = String(key)
            if (selected && selected !== appSummary?.currentProviderKey) void onActivate(selected)
          }}>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover><ListBox aria-label={`${appLabels[app.appType]} 主供应商`}>{providers.map((provider) => <ListBox.Item key={provider.key} id={provider.key} textValue={provider.name}><span>{provider.name}</span><ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
          </Select>
        </div>
        <div className="routing-inline-setting">
          <span><b>自动故障转移</b><small>上游超时或返回可重试错误时切换。</small></span>
          <Button size="sm" variant={app.autoFailoverEnabled ? 'secondary' : 'ghost'} isDisabled={disabled} onPress={() => void onUpdate({ autoFailoverEnabled: !app.autoFailoverEnabled })}>{app.autoFailoverEnabled ? '已开启' : '已关闭'}</Button>
        </div>
        <div className="routing-proxy-number-grid">
          <ProxyNumberField label="最大重试" value={app.maxRetries} min={0} max={10} onCommit={(value) => onUpdate({ maxRetries: value })} />
          <ProxyNumberField label="首字节超时（秒）" value={app.streamingFirstByteTimeout} min={5} max={600} onCommit={(value) => onUpdate({ streamingFirstByteTimeout: value })} />
          <ProxyNumberField label="流空闲超时（秒）" value={app.streamingIdleTimeout} min={5} max={3600} onCommit={(value) => onUpdate({ streamingIdleTimeout: value })} />
          <ProxyNumberField label="非流式超时（秒）" value={app.nonStreamingTimeout} min={10} max={3600} onCommit={(value) => onUpdate({ nonStreamingTimeout: value })} />
          <ProxyNumberField label="熔断阈值" value={app.failureThreshold} min={1} max={20} onCommit={(value) => onUpdate({ failureThreshold: value })} />
          <ProxyNumberField label="半开恢复阈值" value={app.successThreshold} min={1} max={10} onCommit={(value) => onUpdate({ successThreshold: value })} />
          <ProxyNumberField label="恢复等待（秒）" value={app.cooldownSeconds} min={5} max={3600} onCommit={(value) => onUpdate({ cooldownSeconds: value })} />
          <ProxyNumberField label="错误率阈值" value={app.errorRateThreshold} min={0.1} max={1} step={0.1} onCommit={(value) => onUpdate({ errorRateThreshold: value })} />
          <ProxyNumberField label="熔断最小样本" value={app.minRequests} min={1} max={1000} onCommit={(value) => onUpdate({ minRequests: value })} />
        </div>
        <div className="routing-proxy-queue">
          <span className="routing-field-label">备用供应商</span>
          <div>
            {fallbackProviders.map((provider) => {
              const queueIndex = app.queue.indexOf(provider.key)
              return <Button key={provider.key} size="sm" variant={queueIndex >= 0 ? 'secondary' : 'ghost'} isDisabled={disabled} onPress={() => toggleQueue(provider.key)}>{queueIndex >= 0 ? `${queueIndex + 1}. ${provider.name}` : provider.name}</Button>
            })}
            {providers.length <= 1 && <small>添加更多兼容供应商后可配置。</small>}
          </div>
        </div>
      </div>
    </article>
  )
}

function ProxyNumberField({ label, value, min, max, step, onCommit }: { label: string; value: number; min: number; max: number; step?: number; onCommit: (value: number) => Promise<void> }): React.JSX.Element {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return <TextField className="routing-field" variant="secondary"><span className="routing-field-label">{label}</span><Input type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { const next = Number(draft); if (next !== value) void onCommit(next) }} /></TextField>
}

function RoutingUsagePage(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<RoutingUsageSnapshot | null>(null)
  const [days, setDays] = useState<1 | 7 | 30>(7)
  const [appType, setAppType] = useState<ProxyRoutingAppType | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      setSnapshot(await window.aiHelper.routing.getUsage({ days, appType }))
    } catch (cause) {
      setError(stripError(cause))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [days, appType])
  return (
    <section className="routing-page routing-usage-page">
      <RoutingHeader title="用量统计" />
      <div className="routing-usage-toolbar">
        <Select className="routing-usage-filter" variant="secondary" aria-label="统计周期" selectedKey={String(days)} onSelectionChange={(key) => setDays(Number(key) as 1 | 7 | 30)}><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox aria-label="统计周期"><ListBox.Item id="1">今天<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="7">近 7 天<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="30">近 30 天<ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover></Select>
        <Select className="routing-usage-filter" variant="secondary" aria-label="应用筛选" selectedKey={appType ?? 'all'} onSelectionChange={(key) => setAppType(String(key) === 'all' ? undefined : String(key) as ProxyRoutingAppType)}><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox aria-label="应用筛选"><ListBox.Item id="all">全部应用<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="claude">Claude Code<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="codex">Codex<ListBox.ItemIndicator /></ListBox.Item><ListBox.Item id="gemini">Gemini CLI<ListBox.ItemIndicator /></ListBox.Item></ListBox></Select.Popover></Select>
        <Button isIconOnly size="sm" variant="ghost" aria-label="刷新" onPress={() => void load()}><RefreshCw size={15} className={loading ? 'spin' : ''} /></Button>
      </div>
      {error && <div className="routing-error-banner"><AlertCircle size={15} /><span>{error}</span></div>}
      {!snapshot ? <RoutingLoading /> : <UsageContent snapshot={snapshot} />}
    </section>
  )
}

function UsageContent({ snapshot }: { snapshot: RoutingUsageSnapshot }): React.JSX.Element {
  const maxDaily = Math.max(1, ...snapshot.daily.map((item) => item.totalTokens))
  return <>
    <div className="routing-usage-hero">
      <UsageMetric icon={<Activity size={16} />} label="请求" value={formatNumber(snapshot.summary.totalRequests)} />
      <UsageMetric icon={<BarChart3 size={16} />} label="Token" value={formatCompact(snapshot.summary.totalTokens)} />
      <UsageMetric icon={<Check size={16} />} label="成功率" value={`${Math.round(snapshot.summary.successRate * 100)}%`} />
      <UsageMetric icon={<Database size={16} />} label="费用" value={formatCost(snapshot.summary.totalCostUsd)} />
    </div>
    <div className="routing-usage-layout">
      <section className="routing-usage-panel routing-usage-trend">
        <div className="routing-section-heading"><h2>每日用量</h2><span>Token</span></div>
        <div className="routing-usage-chart">
          {snapshot.daily.map((item) => <div className="routing-usage-bar-column" key={item.date} title={`${item.date} · ${formatNumber(item.totalTokens)} Token`}><span className="routing-usage-bar" style={{ height: `${Math.max(item.totalTokens ? 6 : 1, item.totalTokens / maxDaily * 100)}%` }} /><small>{snapshot.days === 30 ? item.date.slice(8) : item.date.slice(5)}</small></div>)}
        </div>
      </section>
      <UsageRanking title="供应商" groups={snapshot.providers} />
      <UsageRanking title="模型" groups={snapshot.models} />
    </div>
    <section className="routing-usage-panel routing-usage-recent">
      <div className="routing-section-heading"><h2>最近请求</h2><span>{snapshot.ccSwitchAvailable ? '包含 CC-Switch 历史数据' : 'SooKool 本地数据'}</span></div>
      {snapshot.recent.length ? <div className="routing-usage-table">
        <div className="routing-usage-table-head"><span>时间</span><span>应用 / 供应商</span><span>模型</span><span>Token</span><span>耗时</span><span>状态</span></div>
        {snapshot.recent.slice(0, 20).map((item) => <div className="routing-usage-table-row" key={`${item.source}:${item.requestId}`}><span>{formatTime(item.createdAt)}</span><span><b>{appLabels[item.appType as RoutingAppType] ?? item.appType}</b><small>{item.providerName}</small></span><span>{item.model || '未识别'}</span><span>{formatCompact(item.inputTokens + item.outputTokens + item.cacheReadTokens + item.cacheCreationTokens)}</span><span>{item.latencyMs} ms</span><span className={item.statusCode >= 200 && item.statusCode < 400 ? 'success' : 'failed'}>{item.statusCode || '失败'}</span></div>)}
      </div> : <div className="routing-usage-empty"><Clock3 size={24} /><span>还没有请求记录</span></div>}
    </section>
  </>
}

function UsageMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): React.JSX.Element {
  return <div><span className="routing-usage-metric-icon">{icon}</span><span>{label}</span><strong>{value}</strong></div>
}

function UsageRanking({ title, groups }: { title: string; groups: RoutingUsageGroup[] }): React.JSX.Element {
  const max = Math.max(1, ...groups.map((group) => group.totalTokens))
  return <section className="routing-usage-panel routing-usage-ranking"><div className="routing-section-heading"><h2>{title}</h2></div>{groups.slice(0, 5).map((group) => <div className="routing-usage-rank" key={group.key}><div><strong>{group.name}</strong><span>{formatCompact(group.totalTokens)} Token</span></div><span className="routing-usage-rank-track"><i style={{ width: `${Math.max(4, group.totalTokens / max * 100)}%` }} /></span></div>)}{!groups.length && <div className="routing-usage-empty"><span>暂无数据</span></div>}</section>
}

function formatNumber(value: number): string { return new Intl.NumberFormat('zh-CN').format(value) }
function formatCompact(value: number): string { return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value) }
function formatCost(value: number): string { return value ? `$${value.toFixed(value < 0.01 ? 4 : 2)}` : '$0.00' }
function formatTime(value: number): string { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value) }

function stripError(error: unknown): string {
  return String(error).replace(/^Error:\s*/, '').replace(/^Error invoking remote method '[^']+':\s*/, '')
}
