import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  CloseButton,
  InputGroup,
  Label,
  ListBox,
  ProgressBar,
  Radio,
  RadioGroup,
  ScrollShadow,
  Select,
  Spinner,
  Tabs,
  TextField,
  Tooltip
} from '@heroui/react'
import {
  ArrowDownToLine,
  Check,
  Clock3,
  FileDiff,
  History,
  Laptop,
  PackageCheck,
  RadioTower,
  Search,
  Send,
  ShieldCheck,
  ShieldQuestion,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { resolveAppLanguage, type AppLanguage } from '@/i18n'
import { fillLocalShareCopy, localShareCopy, type LocalShareCopy } from '@/local-share-copy'
import type { SkillRoot } from '@/types/skills'
import type { InboxInspection, LocalShareState } from '@/types/local-share'

type LocalShareTab = 'nearby' | 'inbox' | 'history'

const emptyState: LocalShareState = {
  enabled: false,
  expiresAt: null,
  identity: { id: '', alias: '', fingerprint: '' },
  devices: [],
  incomingRequests: [],
  inbox: [],
  history: [],
  activeTransfers: []
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function formatTime(value: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function localizeError(error: unknown, language: AppLanguage, copy: LocalShareCopy): string {
  const raw = String(error).replace(/^(?:Error:\s*)+/, '')
  if (/私有网络|private network|有效的私有网络地址/i.test(raw)) return copy.invalidAddress
  if (/可写入|writable Skill Space/i.test(raw)) return copy.noWritableSpace
  return language === 'zh-CN' ? raw : copy.genericError
}

export function LocalShare(): React.JSX.Element {
  const skills = useAppStore((value) => value.skills)
  const roots = useAppStore((value) => value.skillRoots)
  const language = resolveAppLanguage(useAppStore((value) => value.preferences.language))
  const copy = localShareCopy(language)
  const draftSkillPath = useAppStore((value) => value.localShareDraftSkillPath)
  const setDraftSkillPath = useAppStore((value) => value.setLocalShareDraftSkillPath)
  const [state, setState] = useState<LocalShareState>(emptyState)
  const [tab, setTab] = useState<LocalShareTab>('nearby')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<Set<string>>(
    () => new Set(draftSkillPath ? [draftSkillPath] : [])
  )
  const [manualAddress, setManualAddress] = useState('')
  const [targetRoots, setTargetRoots] = useState<Record<string, string>>({})
  const [inspections, setInspections] = useState<Record<string, InboxInspection>>({})
  const writableRoots = useMemo(() => roots.filter((root) => !root.readonly), [roots])
  const visibleSkills = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return skills
    return skills.filter((skill) =>
      `${skill.name} ${skill.description} ${skill.rootLabel}`.toLocaleLowerCase().includes(query)
    )
  }, [search, skills])

  useEffect(() => {
    setDraftSkillPath(null)
  }, [setDraftSkillPath])

  useEffect(() => {
    let active = true
    void window.aiHelper
      .invoke<LocalShareState>('localShare:getState')
      .then((value) => {
        if (active) setState(value)
      })
      .catch((reason) => setError(localizeError(reason, language, copy)))
      .finally(() => setLoading(false))
    const remove = window.aiHelper.onLocalShareChanged?.((value) =>
      setState(value as LocalShareState)
    )
    return () => {
      active = false
      remove?.()
    }
  }, [])

  useEffect(() => {
    if (!selectedDeviceId && state.devices[0]) setSelectedDeviceId(state.devices[0].id)
  }, [selectedDeviceId, state.devices])

  const run = async (operation: () => Promise<LocalShareState>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      setState(await operation())
      return true
    } catch (reason) {
      setError(localizeError(reason, language, copy))
      return false
    } finally {
      setBusy(false)
    }
  }

  const toggleSharing = (): void => {
    void run(() =>
      window.aiHelper.invoke<LocalShareState>(
        state.enabled ? 'localShare:disable' : 'localShare:enable'
      )
    )
  }

  const addManualDevice = (): void => {
    const match = manualAddress.trim().match(/^([^:]+)(?::(\d+))?$/)
    if (!match) {
      setError(copy.invalidAddress)
      return
    }
    void run(() =>
      window.aiHelper.invoke<LocalShareState>('localShare:addManualDevice', {
        address: match[1],
        port: Number(match[2] || 53318)
      })
    ).then((success) => {
      if (success) setManualAddress('')
    })
  }

  const sendSelected = async (): Promise<void> => {
    if (!selectedDeviceId || selectedSkillPaths.size === 0) return
    setBusy(true)
    setError(null)
    try {
      let nextState = state
      for (const skillPath of selectedSkillPaths) {
        nextState = await window.aiHelper.invoke<LocalShareState>('localShare:send', {
          deviceId: selectedDeviceId,
          skillPath
        })
      }
      setState(nextState)
    } catch (reason) {
      setError(localizeError(reason, language, copy))
    } finally {
      setBusy(false)
    }
  }

  const inspectInbox = async (itemId: string, skillName: string): Promise<void> => {
    const rootId = targetRoots[itemId] || writableRoots[0]?.id
    if (!rootId) {
      setError(copy.noWritableSpace)
      return
    }
    try {
      const inspection = await window.aiHelper.invoke<InboxInspection>('localShare:inspectInbox', {
        itemId,
        rootId,
        skillName
      })
      setInspections((values) => ({ ...values, [itemId]: inspection }))
    } catch (reason) {
      setError(localizeError(reason, language, copy))
    }
  }

  const applyInbox = (itemId: string, skillName: string, targetName?: string): void => {
    const rootId = targetRoots[itemId] || writableRoots[0]?.id
    if (!rootId) {
      setError(copy.noWritableSpace)
      return
    }
    void run(() =>
      window.aiHelper.invoke<LocalShareState>('localShare:applyInbox', {
        itemId,
        rootId,
        skillName,
        targetName
      })
    )
  }

  if (loading) {
    return (
      <div className="local-share-loading">
        <Spinner size="lg" />
        <span>{copy.loading}</span>
      </div>
    )
  }

  return (
    <section className="local-share-view">
      <div className="local-share-frame">
        <header className="local-share-header">
          <div className="local-share-heading">
            <h1>{copy.title}</h1>
          </div>
          <div className="local-share-status">
            <div className={`share-trust-ring ${state.enabled ? 'active' : ''}`}>
              <Laptop size={19} />
            </div>
            <div className="local-share-identity-copy">
              <strong>{state.identity.alias}</strong>
              <span>{state.enabled ? copy.visible : copy.hidden}</span>
            </div>
            <Button
              size="sm"
              variant={state.enabled ? 'secondary' : 'primary'}
              isPending={busy}
              onPress={toggleSharing}
            >
              {state.enabled ? <WifiOff size={15} /> : <Wifi size={15} />}
              {state.enabled ? copy.stop : copy.start}
            </Button>
          </div>
        </header>

        {error && (
          <Alert status="danger" className="local-share-alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{copy.errorTitle}</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
            <CloseButton aria-label={copy.close} onPress={() => setError(null)} />
          </Alert>
        )}

        <Tabs
          className="local-share-tabs"
          aria-label={copy.title}
          selectedKey={tab}
          onSelectionChange={(key) => setTab(String(key) as LocalShareTab)}
        >
          <Tabs.ListContainer>
            <Tabs.List>
              <Tabs.Tab id="nearby">
                <RadioTower size={16} />
                {copy.nearby}
                <Chip size="sm" variant="soft">
                  {state.devices.length}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="inbox">
                <ArrowDownToLine size={16} />
                {copy.inbox}
                <Chip size="sm" variant="soft">
                  {state.incomingRequests.length +
                    state.inbox.filter((item) => item.status === 'ready').length}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="history">
                <History size={16} />
                {copy.history}
                <Chip size="sm" variant="soft">
                  {state.history.length}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        {tab === 'nearby' && (
          <NearbyPanel
            state={state}
            skills={visibleSkills}
            search={search}
            selectedDeviceId={selectedDeviceId}
            selectedSkillPaths={selectedSkillPaths}
            busy={busy}
            manualAddress={manualAddress}
            onSearch={setSearch}
            onManualAddress={setManualAddress}
            onAddManual={addManualDevice}
            onDevice={setSelectedDeviceId}
            onSkill={(path) =>
              setSelectedSkillPaths((current) => {
                const next = new Set(current)
                if (next.has(path)) next.delete(path)
                else next.add(path)
                return next
              })
            }
            onSend={() => void sendSelected()}
            copy={copy}
          />
        )}
        {tab === 'inbox' && (
          <InboxPanel
            state={state}
            writableRoots={writableRoots}
            targetRoots={targetRoots}
            inspections={inspections}
            busy={busy}
            onTarget={(itemId, rootId) =>
              setTargetRoots((value) => ({ ...value, [itemId]: rootId }))
            }
            onRespond={(requestId, decision) =>
              void run(() =>
                window.aiHelper.invoke<LocalShareState>('localShare:respond', {
                  requestId,
                  decision
                })
              )
            }
            onInspect={(itemId, name) => void inspectInbox(itemId, name)}
            onApply={applyInbox}
            copy={copy}
            language={language}
          />
        )}
        {tab === 'history' && (
          <HistoryPanel
            state={state}
            busy={busy}
            onRestore={(id) =>
              void run(() => window.aiHelper.invoke<LocalShareState>('localShare:restore', id))
            }
            copy={copy}
            language={language}
          />
        )}
      </div>
    </section>
  )
}

function NearbyPanel(props: {
  state: LocalShareState
  skills: Array<{ path: string; name: string; description: string; rootLabel: string }>
  search: string
  selectedDeviceId: string
  selectedSkillPaths: Set<string>
  busy: boolean
  manualAddress: string
  onSearch: (value: string) => void
  onManualAddress: (value: string) => void
  onAddManual: () => void
  onDevice: (id: string) => void
  onSkill: (path: string) => void
  onSend: () => void
  copy: LocalShareCopy
}): React.JSX.Element {
  const selectedDevice = props.state.devices.find((device) => device.id === props.selectedDeviceId)
  return (
    <div className="local-share-workspace">
      <Card className="device-shelf" variant="secondary">
        <Card.Header className="local-share-panel-heading">
          <div>
            <Card.Title>{props.copy.receiver}</Card.Title>
            <Card.Description>
              {props.state.enabled ? props.copy.receiverEnabled : props.copy.receiverDisabled}
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content className="device-shelf-content">
          <div className="device-browser">
            {!props.state.enabled ? (
              <div className="compact-empty">
                <WifiOff size={22} />
                <div>
                  <strong>{props.copy.sharingOff}</strong>
                  <span>{props.copy.sharingOffHint}</span>
                </div>
              </div>
            ) : props.state.devices.length === 0 ? (
              <div className="compact-empty">
                <RadioTower size={22} />
                <div>
                  <strong>{props.copy.searching}</strong>
                  <span>{props.copy.searchingHint}</span>
                </div>
              </div>
            ) : (
              <ScrollShadow orientation="horizontal" className="device-scroll" hideScrollBar>
                <RadioGroup
                  aria-label={props.copy.receiver}
                  className="device-options"
                  value={props.selectedDeviceId}
                  onChange={props.onDevice}
                >
                  {props.state.devices.map((device) => (
                    <Radio key={device.id} value={device.id} className="device-option">
                      <Radio.Content>
                        <span className="device-avatar">
                          <Laptop size={18} />
                        </span>
                        <span className="device-copy">
                          <strong>{device.alias}</strong>
                          <small>
                            {device.address}:{device.port}
                          </small>
                        </span>
                        <Chip
                          size="sm"
                          color={device.trusted ? 'success' : 'warning'}
                          variant="soft"
                        >
                          {device.trusted ? (
                            <ShieldCheck size={12} />
                          ) : (
                            <ShieldQuestion size={12} />
                          )}
                          {device.trusted ? props.copy.trusted : props.copy.firstConnection}
                        </Chip>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </ScrollShadow>
            )}
          </div>
          <div className="manual-connect">
            <TextField aria-label={props.copy.manualAddress} isDisabled={!props.state.enabled}>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input
                  value={props.manualAddress}
                  onChange={(event) => props.onManualAddress(event.target.value)}
                  placeholder="192.168.1.8:53318"
                />
              </InputGroup>
            </TextField>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={!props.state.enabled || !props.manualAddress.trim()}
              onPress={props.onAddManual}
            >
              {props.copy.connect}
            </Button>
          </div>
        </Card.Content>
      </Card>

      <Card className="skill-picker-card">
        <Card.Header className="skill-picker-header">
          <div className="skill-picker-title">
            <PackageCheck size={17} aria-hidden="true" />
            <Card.Title>{props.copy.selectSkill}</Card.Title>
          </div>
          <TextField className="share-search-field" aria-label={props.copy.searchSkill}>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Prefix>
                <Search size={15} aria-hidden="true" />
              </InputGroup.Prefix>
              <InputGroup.Input
                value={props.search}
                onChange={(event) => props.onSearch(event.target.value)}
                placeholder={props.copy.searchSkill}
              />
            </InputGroup>
          </TextField>
        </Card.Header>
        <Card.Content className="skill-picker-content">
          <ScrollShadow className="share-skill-list" size={56}>
            {props.skills.map((skill) => {
              const selected = props.selectedSkillPaths.has(skill.path)
              return (
                <Checkbox
                  key={skill.path}
                  className={`share-skill-option${selected ? ' selected' : ''}`}
                  isSelected={selected}
                  variant="secondary"
                  onChange={() => props.onSkill(skill.path)}
                >
                  <Checkbox.Content>
                    <span className="share-skill-copy">
                      <strong>{skill.name}</strong>
                      <small>{skill.description || props.copy.noDescription}</small>
                    </span>
                    <Tooltip delay={300} closeDelay={100}>
                      <Chip size="sm" variant="soft">
                        {skill.rootLabel}
                      </Chip>
                      <Tooltip.Content showArrow placement="top">
                        <Tooltip.Arrow />
                        <span className="skill-path-tooltip">{skill.path}</span>
                      </Tooltip.Content>
                    </Tooltip>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              )
            })}
            {props.skills.length === 0 && (
              <div className="skill-search-empty">{props.copy.noMatches}</div>
            )}
          </ScrollShadow>
        </Card.Content>
        <Card.Footer className="skill-picker-footer">
          <div className="selection-receipt">
            <strong>{props.selectedSkillPaths.size}</strong>
            <span>{props.copy.skillUnit}</span>
            <span className="selection-arrow">→</span>
            <strong className="selection-device">
              {selectedDevice?.alias || props.copy.noDevice}
            </strong>
          </div>
          <Button
            variant="primary"
            isPending={props.busy}
            isDisabled={
              !props.state.enabled || !props.selectedDeviceId || props.selectedSkillPaths.size === 0
            }
            onPress={props.onSend}
          >
            <Send size={16} />
            {props.copy.confirmSend}
          </Button>
        </Card.Footer>
      </Card>

      {props.state.activeTransfers.length > 0 && (
        <Card className="transfer-card" variant="secondary">
          <Card.Content>
            {props.state.activeTransfers.map((transfer) => (
              <div className="transfer-item" key={transfer.id}>
                {transfer.status === 'waiting' && transfer.pairingCode && (
                  <div className="outgoing-pairing">
                    <span>{props.copy.pairingHint}</span>
                    <Chip color="warning" variant="soft">
                      {fillLocalShareCopy(props.copy.pairingCode, {
                        code: transfer.pairingCode
                      })}
                    </Chip>
                  </div>
                )}
                <ProgressBar
                  aria-label={`${transfer.skillName} ${props.copy.progress}`}
                  value={transfer.progress * 100}
                  color={transfer.status === 'failed' ? 'danger' : 'accent'}
                >
                  <div className="transfer-label">
                    <span>
                      {transfer.skillName} · {transfer.deviceAlias}
                    </span>
                    <ProgressBar.Output />
                  </div>
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            ))}
          </Card.Content>
        </Card>
      )}
    </div>
  )
}

function InboxPanel(props: {
  state: LocalShareState
  writableRoots: SkillRoot[]
  targetRoots: Record<string, string>
  inspections: Record<string, InboxInspection>
  busy: boolean
  onTarget: (itemId: string, rootId: string) => void
  onRespond: (id: string, decision: 'accept-once' | 'trust' | 'reject') => void
  onInspect: (id: string, name: string) => void
  onApply: (id: string, name: string, targetName?: string) => void
  copy: LocalShareCopy
  language: AppLanguage
}): React.JSX.Element {
  if (!props.state.incomingRequests.length && !props.state.inbox.length) {
    return (
      <EmptyCard
        icon={<ArrowDownToLine size={28} />}
        title={props.copy.inboxEmpty}
        description={props.copy.inboxEmptyHint}
      />
    )
  }
  return (
    <div className="inbox-list">
      {props.state.incomingRequests.map((request) => (
        <Card key={request.id} className="request-card" variant="secondary">
          <div className="request-icon">
            <ShieldQuestion size={21} />
          </div>
          <Card.Header className="request-copy">
            <div className="request-title-row">
              <Card.Title>
                {fillLocalShareCopy(props.copy.wantsToShare, {
                  device: request.device.alias,
                  skill: request.manifest.name
                })}
              </Card.Title>
              <Chip size="sm" color="warning" variant="soft">
                {props.copy.firstPairing}
              </Chip>
            </div>
            <Card.Description>
              {request.manifest.description || props.copy.noDescription} ·{' '}
              {fillLocalShareCopy(props.copy.files, { count: request.manifest.files.length })} ·{' '}
              {formatBytes(request.manifest.totalBytes)}
            </Card.Description>
            <div
              className="pairing-code"
              aria-label={fillLocalShareCopy(props.copy.pairingCode, { code: request.pairingCode })}
            >
              {request.pairingCode}
            </div>
            <span className="pairing-help">{props.copy.pairingHint}</span>
          </Card.Header>
          <Card.Footer className="request-actions">
            <Button
              size="sm"
              isDisabled={props.busy}
              onPress={() => props.onRespond(request.id, 'accept-once')}
            >
              {props.copy.acceptOnce}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={props.busy}
              onPress={() => props.onRespond(request.id, 'trust')}
            >
              {props.copy.acceptTrust}
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => props.onRespond(request.id, 'reject')}
            >
              {props.copy.reject}
            </Button>
          </Card.Footer>
        </Card>
      ))}

      {props.state.inbox.map((item) => {
        const inspection = props.inspections[item.id]
        return (
          <Card key={item.id} className="inbox-card">
            <Card.Header className="inbox-title">
              <div>
                <Card.Title>{item.manifest.name}</Card.Title>
                <Card.Description>
                  {fillLocalShareCopy(props.copy.from, {
                    device: item.sender.alias,
                    time: formatTime(item.receivedAt, props.language)
                  })}
                </Card.Description>
              </div>
              <Chip
                color={item.status === 'applied' ? 'success' : 'accent'}
                variant="soft"
                size="sm"
              >
                {item.status === 'applied' ? <Check size={13} /> : <ArrowDownToLine size={13} />}
                {item.status === 'applied' ? props.copy.applied : props.copy.quarantined}
              </Chip>
            </Card.Header>
            <Card.Content>
              <p className="inbox-description">
                {item.manifest.description || props.copy.noDescription}
              </p>
              <div className="inbox-meta">
                <span>
                  {fillLocalShareCopy(props.copy.files, { count: item.manifest.files.length })}
                </span>
                <span>{formatBytes(item.manifest.totalBytes)}</span>
                <span className="hash-label">SHA-256 {item.manifest.contentHash.slice(0, 10)}</span>
              </div>
              <div className="inbox-target">
                <Select
                  fullWidth
                  variant="secondary"
                  aria-label={props.copy.targetSpace}
                  selectedKey={props.targetRoots[item.id] || props.writableRoots[0]?.id || ''}
                  onSelectionChange={(key) => props.onTarget(item.id, String(key))}
                >
                  <Label>{props.copy.targetSpace}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox aria-label={props.copy.targetSpace}>
                      {props.writableRoots.map((root) => (
                        <ListBox.Item key={root.id} id={root.id} textValue={root.label}>
                          {root.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => props.onInspect(item.id, item.manifest.name)}
                >
                  <FileDiff size={15} />
                  {props.copy.inspectDifference}
                </Button>
              </div>
              {inspection && <DifferenceSummary inspection={inspection} copy={props.copy} />}
            </Card.Content>
            {item.status === 'ready' && (
              <Card.Footer className="inbox-actions">
                <Button
                  size="sm"
                  isDisabled={props.busy || inspection?.relationship === 'identical'}
                  onPress={() => props.onApply(item.id, item.manifest.name)}
                >
                  {props.copy.useIncoming}
                </Button>
                {inspection?.relationship === 'conflict' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      props.onApply(
                        item.id,
                        item.manifest.name,
                        fillLocalShareCopy(props.copy.copySuffix, {
                          skill: item.manifest.name,
                          device: item.sender.alias
                        })
                      )
                    }
                  >
                    {props.copy.saveCopy}
                  </Button>
                )}
                <span>{props.copy.snapshotHint}</span>
              </Card.Footer>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function DifferenceSummary({
  inspection,
  copy
}: {
  inspection: InboxInspection
  copy: LocalShareCopy
}): React.JSX.Element {
  if (!inspection.difference) {
    return (
      <Alert status="success" className="difference-summary">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{copy.newSkill}</Alert.Title>
          <Alert.Description>{copy.newSkillHint}</Alert.Description>
        </Alert.Content>
      </Alert>
    )
  }
  const { summary, files } = inspection.difference
  const labels = {
    identical: copy.identical,
    update: copy.safeUpdate,
    conflict: copy.conflict,
    new: copy.newSkill
  }
  return (
    <Alert
      status={inspection.relationship === 'conflict' ? 'warning' : 'success'}
      className="difference-summary"
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{labels[inspection.relationship]}</Alert.Title>
        <Alert.Description>{fillLocalShareCopy(copy.differenceCounts, summary)}</Alert.Description>
        <div className="difference-files">
          {files
            .filter((file) => file.change !== 'unchanged')
            .slice(0, 8)
            .map((file) => (
              <span key={file.path} data-change={file.change}>
                {file.change === 'added' ? '+' : file.change === 'deleted' ? '−' : '±'} {file.path}
              </span>
            ))}
        </div>
      </Alert.Content>
    </Alert>
  )
}

function HistoryPanel(props: {
  state: LocalShareState
  busy: boolean
  onRestore: (id: string) => void
  copy: LocalShareCopy
  language: AppLanguage
}): React.JSX.Element {
  if (!props.state.history.length) {
    return (
      <EmptyCard
        icon={<History size={28} />}
        title={props.copy.historyEmpty}
        description={props.copy.historyEmptyHint}
      />
    )
  }
  const labels = {
    sent: props.copy.sent,
    received: props.copy.received,
    applied: props.copy.applied,
    restored: props.copy.restored
  }
  return (
    <div className="history-list">
      {props.state.history.map((event) => (
        <Card key={event.id} className="history-row" variant="transparent">
          <span className={`history-icon ${event.direction}`}>
            {event.direction === 'sent' ? (
              <Send size={16} />
            ) : event.direction === 'received' ? (
              <ArrowDownToLine size={16} />
            ) : (
              <Clock3 size={16} />
            )}
          </span>
          <Card.Header>
            <div className="history-title-line">
              <Card.Title>{event.skillName}</Card.Title>
              {event.status !== 'completed' && (
                <Chip
                  size="sm"
                  variant="soft"
                  color={event.status === 'failed' ? 'danger' : 'default'}
                >
                  {event.status === 'failed' ? props.copy.failed : props.copy.cancelled}
                </Chip>
              )}
            </div>
            <Card.Description>
              {labels[event.direction]}
              {event.deviceAlias ? ` · ${event.deviceAlias}` : ''}
            </Card.Description>
          </Card.Header>
          <Chip size="sm" variant="soft" className="history-hash">
            {event.contentHash.slice(0, 10)}
          </Chip>
          <span className="history-time">{formatTime(event.createdAt, props.language)}</span>
          {event.targetPath && (
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={props.busy}
              onPress={() => props.onRestore(event.id)}
            >
              {props.copy.restoreVersion}
            </Button>
          )}
        </Card>
      ))}
    </div>
  )
}

function EmptyCard(props: {
  icon: React.ReactNode
  title: string
  description: string
}): React.JSX.Element {
  return (
    <Card className="local-share-empty-card" variant="secondary">
      <div className="empty-card-icon">{props.icon}</div>
      <Card.Header>
        <Card.Title>{props.title}</Card.Title>
        <Card.Description>{props.description}</Card.Description>
      </Card.Header>
    </Card>
  )
}
