import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import AdmZip from 'adm-zip'
import { extractCompatibleZip } from './archive-extractor.ts'

function modelScopeStyleArchive(): Buffer {
  const zip = new AdmZip()
  zip.addFile('skill/SKILL.md', Buffer.from('---\nname: compatible\n---\n'))
  let archive = zip.toBuffer()
  let endRecord = -1
  for (let index = archive.length - 22; index >= 0; index -= 1) {
    if (archive.readUInt32LE(index) === 0x06054b50) {
      endRecord = index
      break
    }
  }
  assert.notEqual(endRecord, -1)
  archive.writeUInt16LE(150, endRecord + 20)
  return Buffer.concat([archive, Buffer.alloc(40, 1)])
}

test('extracts a valid ModelScope ZIP whose comment length is rejected by yauzl', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-compatible-zip-'))
  try {
    const archive = join(root, 'skill.zip')
    const destination = join(root, 'output')
    writeFileSync(archive, modelScopeStyleArchive())

    await extractCompatibleZip(archive, destination)
    assert.match(readFileSync(join(destination, 'skill', 'SKILL.md'), 'utf-8'), /name: compatible/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('rejects archive entries that escape the destination', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-compatible-zip-'))
  try {
    const archive = join(root, 'unsafe.zip')
    const zip = new AdmZip()
    zip.addFile('aa/outside.txt', Buffer.from('unsafe'))
    const buffer = zip.toBuffer()
    const safeName = Buffer.from('aa/outside.txt')
    const unsafeName = Buffer.from('../outside.txt')
    let offset = buffer.indexOf(safeName)
    while (offset >= 0) {
      unsafeName.copy(buffer, offset)
      offset = buffer.indexOf(safeName, offset + safeName.length)
    }
    writeFileSync(archive, buffer)

    await assert.rejects(extractCompatibleZip(archive, join(root, 'output')), /不安全的路径/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
