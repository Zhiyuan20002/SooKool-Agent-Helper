import { readFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const vscodeFamily = [
  'Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium'
]

/** Reads recent workspace paths from compatible editors without modifying their state. */
export async function collectRecentWorkspacePaths(home = homedir()): Promise<string[]> {
  const roots = process.platform === 'darwin'
    ? vscodeFamily.map((name) => join(home, 'Library', 'Application Support', name, 'User', 'workspaceStorage'))
    : process.platform === 'win32'
      ? vscodeFamily.map((name) => join(process.env.APPDATA || '', name, 'User', 'workspaceStorage'))
      : vscodeFamily.map((name) => join(home, '.config', name, 'User', 'workspaceStorage'))
  const results = new Set<string>()
  for (const root of roots) {
    for (const entry of await readDirectory(root)) {
      if (!entry.isDirectory()) continue
      const workspace = await readJson(join(root, entry.name, 'workspace.json'))
      const folder = toLocalPath(workspace?.folder)
      if (folder) results.add(folder)
      const configuration = toLocalPath(workspace?.workspace)
      if (configuration) results.add(dirname(configuration))
    }
  }
  return [...results]
}

function toLocalPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    if (value.startsWith('file://')) return resolve(fileURLToPath(value))
    if (!value.includes('://')) return resolve(value)
  } catch {
    return null
  }
  return null
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

async function readDirectory(path: string) {
  try { return await readdir(path, { withFileTypes: true }) } catch { return [] }
}
