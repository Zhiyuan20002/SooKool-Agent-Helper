import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createBlankProviderForm,
  createProviderFormFromPreset,
  routingProviderPresets
} from './routing-provider-presets.ts'

test('built-in provider presets have unique ids and safe public defaults', () => {
  assert.equal(
    new Set(routingProviderPresets.map((preset) => preset.id)).size,
    routingProviderPresets.length
  )
  assert.equal(routingProviderPresets.length, 9)

  for (const preset of routingProviderPresets) {
    assert.ok(preset.name.trim())
    assert.match(preset.baseUrl, /^https:\/\//)
    assert.match(preset.websiteUrl, /^https:\/\//)
    assert.match(preset.apiKeyUrl, /^https:\/\//)
    assert.ok(preset.icon)
    assert.match(preset.iconColor, /^#[0-9a-f]{6}$/i)
    assert.equal(preset.applications[0], 'claude')
    assert.equal(preset.applications.includes('claude-desktop'), false)
    assert.match(preset.applicationConfigs.claude?.baseUrl ?? '', /^https:\/\//)
    if (preset.applications.includes('codex')) {
      assert.match(preset.applicationConfigs.codex?.baseUrl ?? '', /^https:\/\//)
      assert.equal(preset.applicationConfigs.codex?.wireApi, 'responses')
    } else {
      assert.equal(preset.applicationConfigs.codex, undefined)
    }
  }
})

test('creates a provider form from a preset without carrying credentials', () => {
  const preset = routingProviderPresets.find((item) => item.id === 'deepseek')
  assert.ok(preset)

  const form = createProviderFormFromPreset(preset)

  assert.equal(form.name, 'DeepSeek')
  assert.equal(form.baseUrl, 'https://api.deepseek.com/anthropic')
  assert.equal(form.model, 'deepseek-v4-pro')
  assert.equal(form.defaultHaikuModel, 'deepseek-v4-flash')
  assert.equal(form.defaultSonnetModel, 'deepseek-v4-pro')
  assert.equal(form.defaultOpusModel, 'deepseek-v4-pro')
  assert.equal(form.apiKeyField, 'ANTHROPIC_AUTH_TOKEN')
  assert.equal(form.icon, 'deepseek')
  assert.equal(form.apiKey, '')
  assert.deepEqual(form.applications, ['claude'])
  assert.equal(form.applicationConfigs?.claude?.baseUrl, 'https://api.deepseek.com/anthropic')

  form.applicationConfigs!.claude!.baseUrl = 'changed'
  assert.equal(preset.applicationConfigs.claude?.baseUrl, 'https://api.deepseek.com/anthropic')
})

test('creates a blank custom form with the existing application defaults', () => {
  assert.deepEqual(createBlankProviderForm(), {
    applications: ['claude', 'codex', 'gemini'],
    applicationConfigs: {
      claude: {},
      codex: { wireApi: 'responses' },
      gemini: {}
    },
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    defaultHaikuModel: '',
    defaultSonnetModel: '',
    defaultOpusModel: '',
    websiteUrl: '',
    apiKeyUrl: '',
    category: 'custom',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: '',
    iconColor: '',
    notes: ''
  })
})
