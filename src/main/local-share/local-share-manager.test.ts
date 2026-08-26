import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalShareManager } from './local-share-manager.ts'

async function waitUntil(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('condition timed out')
}

test('invalid sharing durations are rejected before the network server starts', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-local-share-duration-'))
  const manager = new LocalShareManager({ rootPath: root, port: 0, discovery: false })
  await assert.rejects(manager.enable(Number.NaN), /共享时长无效/)
  assert.equal(manager.port, 0)
  assert.equal(manager.getState().enabled, false)
  manager.dispose()
})

test('manual devices survive automatic discovery refreshes', () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-local-share-manual-'))
  const manager = new LocalShareManager({ rootPath: root, port: 0, discovery: false })
  manager.addKnownDevice({
    id: 'manual',
    alias: 'Manual',
    address: '192.168.1.20',
    port: 53318,
    fingerprint: 'aa',
    trusted: false,
    lastSeenAt: new Date().toISOString()
  })
  const internal = manager as unknown as {
    discoveredDevices: Map<string, ReturnType<LocalShareManager['getState']>['devices'][number]>
    rebuildDevices: () => void
  }
  internal.discoveredDevices = new Map([
    [
      'automatic',
      {
        id: 'automatic',
        alias: 'Automatic',
        address: '192.168.1.21',
        port: 53318,
        fingerprint: 'bb',
        trusted: false,
        lastSeenAt: new Date().toISOString()
      }
    ]
  ])
  internal.rebuildDevices()

  assert.deepEqual(
    manager
      .getState()
      .devices.map((device) => device.id)
      .sort(),
    ['automatic', 'manual']
  )
  manager.dispose()
})

test('a sender rejects a pairing code that was not independently derived', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-local-share-pairing-'))
  const manager = new LocalShareManager({ rootPath: root, port: 0, discovery: false })
  manager.addKnownDevice({
    id: 'peer',
    alias: 'Peer',
    address: '127.0.0.1',
    port: 53318,
    fingerprint: 'aa',
    trusted: false,
    lastSeenAt: new Date().toISOString()
  })
  const internal = manager as unknown as {
    enabled: boolean
    requestJson: () => Promise<{
      statusCode: number
      value: { requestId: string; pairingCode: string }
    }>
  }
  internal.enabled = true
  internal.requestJson = async () => ({
    statusCode: 202,
    value: { requestId: 'request', pairingCode: 'forged' }
  })
  const skill = join(root, 'demo')
  mkdirSync(skill)
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: demo\ndescription: Shared\n---\n')

  await assert.rejects(manager.sendSkill('peer', skill), /配对码校验失败/)
  manager.dispose()
})

test('terminal transfers are removed from active state after a short receipt window', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-local-share-transfer-cleanup-'))
  const manager = new LocalShareManager({
    rootPath: root,
    port: 0,
    discovery: false,
    completedTransferRetentionMs: 10
  })
  const internal = manager as unknown as {
    activeTransfers: ReturnType<LocalShareManager['getState']>['activeTransfers']
    updateTransfer: (
      id: string,
      patch: Partial<ReturnType<LocalShareManager['getState']>['activeTransfers'][number]>
    ) => void
  }
  internal.activeTransfers.push({
    id: 'transfer',
    direction: 'send',
    skillName: 'demo',
    deviceAlias: 'Peer',
    status: 'waiting',
    progress: 0
  })
  internal.updateTransfer('transfer', { status: 'completed', progress: 1 })
  await waitUntil(() => manager.getState().activeTransfers.length === 0)
  manager.dispose()
})

test('two local instances pair, transfer into quarantine, inspect and explicitly apply a skill', async (context) => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-local-share-e2e-'))
  const sender = new LocalShareManager({
    rootPath: join(root, 'sender'),
    alias: 'Sender',
    port: 0,
    discovery: false
  })
  const receiver = new LocalShareManager({
    rootPath: join(root, 'receiver'),
    alias: 'Receiver',
    port: 0,
    discovery: false
  })
  context.after(() => {
    sender.dispose()
    receiver.dispose()
  })
  await sender.enable()
  await receiver.enable()

  const senderState = sender.getState()
  const receiverState = receiver.getState()
  sender.addKnownDevice({
    ...receiverState.identity,
    address: '127.0.0.1',
    port: receiver.port,
    trusted: false,
    lastSeenAt: new Date().toISOString()
  })

  const skill = join(root, 'demo')
  mkdirSync(skill)
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: demo\ndescription: Shared\n---\n')
  const transfer = sender.sendSkill(receiverState.identity.id, skill)
  await waitUntil(() => receiver.getState().incomingRequests.length === 1)
  const request = receiver.getState().incomingRequests[0]
  assert.match(request.pairingCode, /^\d{6}$/)
  await waitUntil(() => sender.getState().activeTransfers[0]?.pairingCode === request.pairingCode)
  assert.equal(request.device.id, senderState.identity.id)
  assert.equal(existsSync(join(root, 'installed')), false)

  receiver.respondToRequest(request.id, 'trust')
  await transfer
  assert.equal(
    receiver
      .getState()
      .activeTransfers.some(
        (candidate) => candidate.direction === 'receive' && candidate.status === 'completed'
      ),
    true
  )
  assert.equal(receiver.getState().trustedDevices[0]?.id, senderState.identity.id)
  receiver.forgetTrustedDevice(senderState.identity.id)
  assert.equal(receiver.getState().trustedDevices.length, 0)
  const item = receiver.getState().inbox[0]
  assert.equal(item.status, 'ready')
  assert.equal(receiver.inspectInbox(item.id).relationship, 'new')

  const destination = join(root, 'installed')
  mkdirSync(destination)
  writeFileSync(join(destination, 'SKILL.md'), '---\nname: demo\ndescription: Local change\n---\n')
  assert.equal(receiver.inspectInbox(item.id, destination).relationship, 'conflict')
  receiver.applyInbox(item.id, destination)
  assert.match(readFileSync(join(destination, 'SKILL.md'), 'utf8'), /description: Shared/)
  assert.equal(
    receiver.getState().history.some((event) => event.direction === 'applied'),
    true
  )

  receiver.addKnownDevice({
    ...senderState.identity,
    address: '127.0.0.1',
    port: sender.port,
    trusted: false,
    lastSeenAt: new Date().toISOString()
  })
  writeFileSync(
    join(destination, 'SKILL.md'),
    '---\nname: demo\ndescription: Updated after receiving\n---\n'
  )
  const reverseTransfer = receiver.sendSkill(senderState.identity.id, destination)
  await waitUntil(() => sender.getState().incomingRequests.length === 1)
  const reverseRequest = sender.getState().incomingRequests[0]
  sender.respondToRequest(reverseRequest.id, 'accept-once')
  await reverseTransfer
  const reverseItem = sender.getState().inbox[0]
  assert.equal(sender.inspectInbox(reverseItem.id, skill).relationship, 'update')

  const reopened = new LocalShareManager({
    rootPath: join(root, 'receiver'),
    alias: 'Ignored',
    port: 0,
    discovery: false
  })
  assert.equal(reopened.getState().inbox[0].status, 'applied')
  assert.equal(reopened.getState().identity.id, receiverState.identity.id)
  reopened.dispose()
})

test('disabling sharing invalidates pending approvals and upload sessions', async (context) => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-local-share-expiry-'))
  const sender = new LocalShareManager({
    rootPath: join(root, 'sender'),
    alias: 'Sender',
    port: 0,
    discovery: false
  })
  const receiver = new LocalShareManager({
    rootPath: join(root, 'receiver'),
    alias: 'Receiver',
    port: 0,
    discovery: false
  })
  context.after(() => {
    sender.dispose()
    receiver.dispose()
  })
  await sender.enable()
  await receiver.enable()
  const receiverState = receiver.getState()
  sender.addKnownDevice({
    ...receiverState.identity,
    address: '127.0.0.1',
    port: receiver.port,
    trusted: false,
    lastSeenAt: new Date().toISOString()
  })
  const skill = join(root, 'demo')
  mkdirSync(skill)
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: demo\ndescription: Shared\n---\n')
  const transfer = sender.sendSkill(receiverState.identity.id, skill)
  await waitUntil(() => receiver.getState().incomingRequests.length === 1)

  await receiver.disable()
  assert.equal(receiver.getState().incomingRequests.length, 0)
  await assert.rejects(transfer)
})

test('sharing expiry waits for an incoming upload to finish', async (context) => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-local-share-incoming-expiry-'))
  const sender = new LocalShareManager({
    rootPath: join(root, 'sender'),
    alias: 'Sender',
    port: 0,
    discovery: false
  })
  const receiver = new LocalShareManager({
    rootPath: join(root, 'receiver'),
    alias: 'Receiver',
    port: 0,
    discovery: false
  })
  context.after(() => {
    sender.dispose()
    receiver.dispose()
  })
  const internal = receiver as unknown as {
    readBuffer: (request: import('node:http').IncomingMessage, limit: number) => Promise<Buffer>
  }
  const originalReadBuffer = internal.readBuffer.bind(receiver)
  internal.readBuffer = async (request, limit) => {
    if (request.headers['content-type'] === 'application/zip')
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    return originalReadBuffer(request, limit)
  }

  await sender.enable()
  await receiver.enable()
  const receiverState = receiver.getState()
  sender.addKnownDevice({
    ...receiverState.identity,
    address: '127.0.0.1',
    port: receiver.port,
    trusted: false,
    lastSeenAt: new Date().toISOString()
  })
  const skill = join(root, 'demo')
  mkdirSync(skill)
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: demo\ndescription: Shared\n---\n')
  const transfer = sender.sendSkill(receiverState.identity.id, skill)
  await waitUntil(() => receiver.getState().incomingRequests.length === 1)
  await receiver.enable(700)
  receiver.respondToRequest(receiver.getState().incomingRequests[0].id, 'accept-once')

  await transfer
  assert.equal(receiver.getState().inbox.length, 1)
  await waitUntil(() => !receiver.getState().enabled)
})
