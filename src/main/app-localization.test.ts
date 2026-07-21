import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { appDisplayNames, getAppDisplayName } from './app-localization.ts'
import type { AppLanguage } from './settings/settings-store.ts'

const bundleLocales: Array<[AppLanguage, string]> = [
  ['zh-CN', 'zh-Hans'],
  ['en-US', 'en'],
  ['zh-HK', 'zh-HK'],
  ['ja-JP', 'ja'],
  ['fr-FR', 'fr'],
  ['ko-KR', 'ko'],
  ['es-ES', 'es'],
  ['pt-BR', 'pt-BR'],
  ['ar', 'ar']
]

test('keeps runtime and macOS bundle display names aligned for every language', () => {
  for (const [language, bundleLocale] of bundleLocales) {
    const displayName = appDisplayNames[language]
    const strings = readFileSync(
      resolve('build', `${bundleLocale}.lproj`, 'InfoPlist.strings'),
      'utf8'
    )

    assert.equal(getAppDisplayName(language), displayName)
    assert.ok(strings.includes(`"CFBundleDisplayName" = "${displayName}";`))
    assert.ok(strings.includes(`"CFBundleName" = "${displayName}";`))
  }
})
