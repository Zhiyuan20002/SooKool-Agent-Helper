import AdmZip from 'adm-zip'

const maxArchiveEntries = 5_000
const maxArchiveFileBytes = 128 * 1024 * 1024
const maxArchiveExpandedBytes = 512 * 1024 * 1024

export async function extractCompatibleZip(archivePath: string, destination: string): Promise<void> {
  let archive: AdmZip
  try {
    archive = new AdmZip(archivePath)
  } catch (error) {
    throw new Error(`技能包格式无效或已损坏：${normalizeArchiveError(error)}`)
  }

  const entries = archive.getEntries()
  if (!entries.length) throw new Error('技能包中没有可读取的文件。')
  if (entries.length > maxArchiveEntries) throw new Error('技能包包含过多文件，已停止解压。')

  let expandedBytes = 0
  for (const entry of entries) {
    validateEntryPath(entry.entryName)
    if (entry.isDirectory) continue
    const size = Number(entry.header.size)
    if (!Number.isFinite(size) || size < 0 || size > maxArchiveFileBytes) {
      throw new Error(`技能包文件过大：${entry.entryName}`)
    }
    expandedBytes += size
    if (expandedBytes > maxArchiveExpandedBytes) throw new Error('技能包解压后的总大小超过安全限制。')
  }

  await new Promise<void>((resolve, reject) => {
    archive.extractAllToAsync(destination, true, false, (error) => {
      if (error) reject(new Error(`技能包解压失败：${normalizeArchiveError(error)}`))
      else resolve()
    })
  })
}

function validateEntryPath(entryName: string): void {
  const normalized = entryName.replaceAll('\\', '/')
  const segments = normalized.split('/')
  if (
    !normalized ||
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    /^[a-z]:\//i.test(normalized) ||
    segments.includes('..')
  ) {
    throw new Error(`技能包包含不安全的路径：${entryName}`)
  }
}

function normalizeArchiveError(error: unknown): string {
  return String(error).replace(/^(?:Error:\s*)+/, '')
}
