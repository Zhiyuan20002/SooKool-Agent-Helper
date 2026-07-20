import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveAppLanguage, SettingsStore } from './settings-store.ts'

test('preserves legacy skill roots as unclassified locations during schema migration', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sookool-settings-'))
  const path = join(directory, 'settings.json')
  writeFileSync(
    path,
    JSON.stringify({ skillRoots: [{ id: 'legacy', label: 'Legacy', path: '/skills' }] })
  )

  const settings = new SettingsStore(path)
  assert.equal(settings.read().schemaVersion, 2)
  assert.deepEqual(settings.getLegacySkillRoots(), [
    { id: 'legacy', label: 'Legacy', path: '/skills' }
  ])
  assert.deepEqual(settings.getProjects(), [])
  assert.deepEqual(settings.getApplicationRules(), [])
})

test('stores project registrations and custom application rules independently', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sookool-settings-'))
  const settings = new SettingsStore(join(directory, 'settings.json'))

  settings.saveProjects([{ id: 'project', name: 'Project', path: '/workspace/project' }])
  settings.saveApplicationRules([
    {
      id: 'custom-app',
      name: 'Custom App',
      source: 'custom',
      detectionPaths: [],
      systemSkillPaths: ['/home/user/.custom/skills'],
      projectSkillPaths: ['.custom/skills']
    }
  ])

  assert.equal(settings.getProjects()[0].id, 'project')
  assert.equal(settings.getApplicationRules()[0].projectSkillPaths[0], '.custom/skills')
})

test('persists market palette overrides without affecting existing market sources', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sookool-settings-'))
  const settings = new SettingsStore(join(directory, 'settings.json'))

  settings.saveMarketSources([{ id: 'custom', name: 'Custom', source: '/skills', palette: 'morandi' }])
  settings.saveMarketSourcePalettes({ 'builtin-anthropic-skills': 'rococo' })

  assert.equal(settings.getMarketSources()[0].palette, 'morandi')
  assert.equal(settings.getMarketSourcePalettes()['builtin-anthropic-skills'], 'rococo')
})

test('stores unique additional project scan roots', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sookool-settings-'))
  const settings = new SettingsStore(join(directory, 'settings.json'))

  settings.saveProjectScanRoots(['/Volumes/Work', '/Volumes/Work', '/workspace'])

  assert.deepEqual(settings.getProjectScanRoots(), ['/Volumes/Work', '/workspace'])
})

test('migrates the legacy Traditional Chinese preference to Hong Kong Chinese', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sookool-settings-'))
  const path = join(directory, 'settings.json')
  const legacyLanguage = ['zh', 'TW'].join('-')
  writeFileSync(path, JSON.stringify({ appPreferences: { language: legacyLanguage } }))

  const settings = new SettingsStore(path)
  assert.equal(settings.getAppPreferences().language, 'zh-HK')
})

test('resolves Traditional Chinese system locales to Hong Kong Chinese', () => {
  assert.equal(resolveAppLanguage('system', 'zh-HK'), 'zh-HK')
  assert.equal(resolveAppLanguage('system', 'zh-Hant'), 'zh-HK')
  assert.equal(resolveAppLanguage('system', ['zh', 'TW'].join('-')), 'zh-HK')
})
