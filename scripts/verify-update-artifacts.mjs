import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import YAML from 'yaml'

const releaseDirectory = resolve(process.argv[2] || 'release')
const files = new Set(readdirSync(releaseDirectory))

verifyMetadata('latest-mac.yml', ['.zip'])
verifyMetadata('latest.yml', ['.exe'])

for (const extension of ['.dmg', '.zip', '.exe']) {
  if (![...files].some((file) => file.endsWith(extension))) {
    throw new Error(`Missing ${extension} release artifact in ${releaseDirectory}`)
  }
}

if (![...files].some((file) => file.endsWith('.blockmap'))) {
  throw new Error(`Missing differential-update blockmap in ${releaseDirectory}`)
}

console.log(`Update artifact verification passed: ${releaseDirectory}`)

function verifyMetadata(filename, expectedExtensions) {
  const metadataPath = join(releaseDirectory, filename)
  if (!existsSync(metadataPath)) throw new Error(`Missing update metadata: ${filename}`)

  const metadata = YAML.parse(readFileSync(metadataPath, 'utf8'))
  const entries = Array.isArray(metadata?.files) ? metadata.files : []
  if (entries.length === 0) throw new Error(`${filename} does not contain update files`)

  for (const entry of entries) {
    const artifact = basename(decodeURIComponent(String(entry.url || '')))
    if (!artifact || !files.has(artifact)) {
      throw new Error(`${filename} references a missing artifact: ${artifact || '(empty URL)'}`)
    }
    if (typeof entry.sha512 !== 'string' || entry.sha512.length < 40) {
      throw new Error(`${filename} is missing SHA-512 metadata for ${artifact}`)
    }
  }

  for (const extension of expectedExtensions) {
    if (!entries.some((entry) => String(entry.url || '').endsWith(extension))) {
      throw new Error(`${filename} does not reference a ${extension} updater artifact`)
    }
  }
}
