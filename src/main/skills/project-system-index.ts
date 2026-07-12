import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

const execFileAsync = promisify(execFile)

/** Uses the host file index as a fast, non-recursive coverage adapter when available. */
export async function collectIndexedProjectPaths(projectSkillPaths: string[], signal?: AbortSignal): Promise<string[]> {
  if (process.platform !== 'darwin') return []
  try {
    const { stdout } = await execFileAsync('/usr/bin/mdfind', [
      'kMDItemFSName == "SKILL.md"c'
    ], { maxBuffer: 8 * 1024 * 1024, timeout: 15_000, signal })
    return inferProjectPathsFromSkillFiles(
      stdout.split('\n').filter(Boolean),
      projectSkillPaths
    )
  } catch {
    return []
  }
}

export function inferProjectPathsFromSkillFiles(
  skillFiles: string[],
  projectSkillPaths: string[]
): string[] {
  const projects = new Set<string>()
  for (const skillFile of skillFiles) {
    const normalizedFile = resolve(skillFile)
    const segments = normalizedFile.split(sep)
    for (const configuredPath of projectSkillPaths) {
      if (!configuredPath || isAbsolute(configuredPath)) continue
      const marker = configuredPath.replaceAll('\\', '/').replace(/^\.\//, '').split('/')
      for (let index = 0; index <= segments.length - marker.length; index += 1) {
        if (!marker.every((part, offset) => segments[index + offset] === part)) continue
        const skillRoot = segments.slice(0, index + marker.length).join(sep) || sep
        const rel = relative(skillRoot, normalizedFile)
        const projectPath = segments.slice(0, index).join(sep) || sep
        if (!rel.startsWith('..') && resolve(projectPath) !== resolve(homedir())) projects.add(projectPath)
      }
    }
  }
  return [...projects]
}
