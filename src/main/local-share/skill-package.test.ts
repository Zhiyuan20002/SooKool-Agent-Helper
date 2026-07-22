import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import {
  assertValidSkillManifest,
  buildSkillManifest,
  compareSkillManifests,
  createSharePackage,
  extractSharePackage
} from './skill-package.ts'

function createSkill(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'sookool-local-share-skill-'))
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(directory, relativePath)
    mkdirSync(join(filePath, '..'), { recursive: true })
    writeFileSync(filePath, content)
  }
  return directory
}

function setCentralDirectorySize(buffer: Buffer, targetName: string, size: number): Buffer {
  const patched = Buffer.from(buffer)
  for (let offset = 0; offset <= patched.length - 46; offset++) {
    if (patched.readUInt32LE(offset) !== 0x02014b50) continue
    const nameLength = patched.readUInt16LE(offset + 28)
    const name = patched.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')
    if (name === targetName) {
      patched.writeUInt32LE(size, offset + 24)
      return patched
    }
  }
  throw new Error(`central directory entry not found: ${targetName}`)
}

test('a deterministic manifest identifies identical skills and changed files', () => {
  const local = createSkill({
    'SKILL.md': '---\nname: demo\ndescription: Local\n---\n',
    'references/guide.md': 'before\n'
  })
  const incoming = createSkill({
    'SKILL.md': '---\nname: demo\ndescription: Incoming\n---\n',
    'references/guide.md': 'before\n',
    'assets/example.txt': 'new\n'
  })

  const localManifest = buildSkillManifest(local)
  assert.equal(buildSkillManifest(local).contentHash, localManifest.contentHash)

  const difference = compareSkillManifests(localManifest, buildSkillManifest(incoming))
  assert.equal(difference.status, 'changed')
  assert.deepEqual(difference.summary, { added: 1, modified: 1, deleted: 0, unchanged: 1 })
  assert.deepEqual(
    difference.files.map((file) => [file.path, file.change]),
    [
      ['SKILL.md', 'modified'],
      ['assets/example.txt', 'added'],
      ['references/guide.md', 'unchanged']
    ]
  )
})

test('manifest creation rejects symbolic links instead of following them', () => {
  const skill = createSkill({ 'SKILL.md': '---\nname: safe\ndescription: Safe\n---\n' })
  symlinkSync('/tmp', join(skill, 'escape'))

  assert.throws(() => buildSkillManifest(skill), /符号链接/)
})

test('incoming manifests are validated before they are shown for approval', () => {
  assert.throws(
    () => assertValidSkillManifest({ protocol: 'sookool-local-share/1', files: 'invalid' }),
    /清单/
  )
})

test('the uploaded package manifest must exactly match the approved manifest', () => {
  const skill = createSkill({
    'SKILL.md': '---\nname: approved\ndescription: Approved description\n---\n'
  })
  const packaged = createSharePackage(skill)
  const archive = new AdmZip(packaged.buffer)
  const changed = { ...packaged.manifest, name: 'different-name' }
  archive.updateFile('manifest.json', Buffer.from(JSON.stringify(changed)))
  const destination = mkdtempSync(join(tmpdir(), 'sookool-local-share-extract-'))

  assert.throws(
    () => extractSharePackage(archive.toBuffer(), destination, packaged.manifest),
    /清单与已确认内容不一致/
  )
})

test('ignored directories are not included in the transfer archive', () => {
  const skill = createSkill({ 'SKILL.md': '---\nname: safe\ndescription: Safe\n---\n' })
  mkdirSync(join(skill, '.git'))
  writeFileSync(join(skill, '.git', 'unhashed'), 'must not transfer')
  const packaged = createSharePackage(skill)
  const destination = mkdtempSync(join(tmpdir(), 'sookool-local-share-ignored-'))

  extractSharePackage(packaged.buffer, destination, packaged.manifest)
  assert.equal(existsSync(join(destination, '.git', 'unhashed')), false)
})

test('extraction rejects archive files that were not approved in the manifest', () => {
  const skill = createSkill({ 'SKILL.md': '---\nname: safe\ndescription: Safe\n---\n' })
  const packaged = createSharePackage(skill)
  const archive = new AdmZip(packaged.buffer)
  archive.addFile('skill/.git/unhashed', Buffer.from('must not transfer'))
  const destination = mkdtempSync(join(tmpdir(), 'sookool-local-share-extra-'))

  assert.throws(
    () => extractSharePackage(archive.toBuffer(), destination, packaged.manifest),
    /未列入清单/
  )
})

test('executable files keep their executable permission after transfer', () => {
  const skill = createSkill({
    'SKILL.md': '---\nname: executable\ndescription: Executable\n---\n',
    'scripts/run.sh': '#!/bin/sh\n'
  })
  chmodSync(join(skill, 'scripts/run.sh'), 0o755)
  const packaged = createSharePackage(skill)
  const destination = mkdtempSync(join(tmpdir(), 'sookool-local-share-mode-'))

  extractSharePackage(packaged.buffer, destination, packaged.manifest)
  assert.notEqual(statSync(join(destination, 'scripts/run.sh')).mode & 0o111, 0)
})

test('a permission-only change is reported as a modified file', () => {
  const local = createSkill({
    'SKILL.md': '---\nname: permissions\ndescription: Permissions\n---\n',
    'scripts/run.sh': '#!/bin/sh\n'
  })
  const incoming = createSkill({
    'SKILL.md': '---\nname: permissions\ndescription: Permissions\n---\n',
    'scripts/run.sh': '#!/bin/sh\n'
  })
  chmodSync(join(incoming, 'scripts/run.sh'), 0o755)

  const difference = compareSkillManifests(buildSkillManifest(local), buildSkillManifest(incoming))
  assert.equal(difference.status, 'changed')
  assert.equal(difference.files.find((file) => file.path === 'scripts/run.sh')?.change, 'modified')
})

test('a manifest with a forged zero declared size is rejected before decompression', () => {
  const skill = createSkill({ 'SKILL.md': '---\nname: safe\ndescription: Safe\n---\n' })
  const packaged = createSharePackage(skill)
  const forged = setCentralDirectorySize(packaged.buffer, 'manifest.json', 0)
  const destination = mkdtempSync(join(tmpdir(), 'sookool-local-share-zero-manifest-'))

  assert.throws(() => extractSharePackage(forged, destination, packaged.manifest), /声明大小异常/)
})

test('a regular entry with a forged zero size is treated as empty without inflating it', () => {
  const skill = createSkill({
    'SKILL.md': '---\nname: safe\ndescription: Safe\n---\n',
    'payload.txt': 'compressed payload'
  })
  const packaged = createSharePackage(skill)
  const forged = setCentralDirectorySize(packaged.buffer, 'skill/payload.txt', 0)
  const destination = mkdtempSync(join(tmpdir(), 'sookool-local-share-zero-file-'))

  assert.throws(() => extractSharePackage(forged, destination, packaged.manifest), /哈希校验失败/)
})
