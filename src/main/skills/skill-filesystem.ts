import { cpSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function isDirectoryPath(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function replaceDirectoryAtomically(
  source: string,
  destination: string,
  filter?: (source: string) => boolean
): void {
  const parent = dirname(destination)
  const suffix = crypto.randomUUID()
  const staging = join(parent, `.sookool-staging-${suffix}`)
  const backup = join(parent, `.sookool-backup-${suffix}`)
  let previousMoved = false
  mkdirSync(parent, { recursive: true })
  try {
    cpSync(source, staging, { recursive: true, dereference: false, filter })
    if (!existsSync(join(staging, 'SKILL.md'))) throw new Error('Skill 目录缺少 SKILL.md。')
    if (existsSync(destination)) {
      renameSync(destination, backup)
      previousMoved = true
    }
    renameSync(staging, destination)
    if (previousMoved) rmSync(backup, { recursive: true, force: true })
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    if (previousMoved && !existsSync(destination) && existsSync(backup)) {
      renameSync(backup, destination)
    }
    throw error
  }
}
