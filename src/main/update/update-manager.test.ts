import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import type { AppUpdater } from 'electron-updater'
import { classifyUpdateError, createInitialUpdateState, UpdateManager } from './update-manager.ts'

class FakeUpdater extends EventEmitter {
  autoDownload = false
  autoInstallOnAppQuit = true
  allowPrerelease = true
  allowDowngrade = true
  checkCount = 0
  installCount = 0

  async checkForUpdates(): Promise<null> {
    this.checkCount += 1
    this.emit('checking-for-update')
    return null
  }

  quitAndInstall(): void {
    this.installCount += 1
  }
}

test('starts disabled outside supported packaged builds', () => {
  assert.equal(createInitialUpdateState('1.2.3', false).phase, 'disabled')
})

test('tracks download progress and only installs a completed update', () => {
  const updater = new FakeUpdater()
  const states: string[] = []
  const manager = new UpdateManager({
    updater: updater as unknown as AppUpdater,
    enabled: true,
    automaticChecks: false,
    currentVersion: '1.0.0',
    onStateChanged: (state) => states.push(state.phase)
  })

  manager.start()
  assert.equal(manager.installDownloadedUpdate(), false)
  updater.emit('update-available', { version: '1.1.0', releaseDate: '2026-08-26' })
  updater.emit('download-progress', {
    percent: 42.5,
    transferred: 425,
    total: 1000,
    bytesPerSecond: 100
  })
  assert.equal(manager.getState().progressPercent, 42.5)
  updater.emit('update-downloaded', { version: '1.1.0' })
  assert.equal(manager.getState().phase, 'downloaded')
  assert.equal(manager.installDownloadedUpdate(), true)
  assert.equal(updater.installCount, 1)
  assert.ok(states.includes('downloading'))
  manager.dispose()
})

test('classifies update failures without exposing raw errors to the renderer', () => {
  assert.equal(classifyUpdateError(new Error('net::ERR_INTERNET_DISCONNECTED')), 'network')
  assert.equal(classifyUpdateError(new Error('latest.yml returned 404')), 'metadata')
  assert.equal(classifyUpdateError(new Error('sha512 checksum mismatch')), 'verification')
  assert.equal(classifyUpdateError(new Error('unexpected updater failure')), 'unknown')
})
