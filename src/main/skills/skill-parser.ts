import type { SkillIssue } from './skill-types'

export interface ParsedSkill {
  frontmatter: Record<string, string>
  body: string
  issues: SkillIssue[]
}

export function normalizeSkillName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseSkillMarkdown(content: string): ParsedSkill {
  const issues: SkillIssue[] = []
  const normalized = content.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    return {
      frontmatter: {},
      body: normalized,
      issues: [{ severity: 'error', message: '缺少 YAML frontmatter。' }]
    }
  }

  const end = normalized.indexOf('\n---\n', 4)
  if (end === -1) {
    return {
      frontmatter: {},
      body: normalized,
      issues: [{ severity: 'error', message: 'frontmatter 没有正确结束。' }]
    }
  }

  const frontmatterText = normalized.slice(4, end)
  const body = normalized.slice(end + 5).trimStart()
  const frontmatter: Record<string, string> = {}

  for (const line of frontmatterText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf(':')
    if (separator === -1) {
      issues.push({ severity: 'warning', message: `无法识别 frontmatter 行：${trimmed}` })
      continue
    }

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')

    if (key) {
      frontmatter[key] = value
    }
  }

  if (!frontmatter.name) {
    issues.push({ severity: 'error', message: 'frontmatter 缺少 name。' })
  }

  if (!frontmatter.description) {
    issues.push({ severity: 'error', message: 'frontmatter 缺少 description。' })
  }

  if (body.trim().length === 0) {
    issues.push({ severity: 'warning', message: 'Skill 正文为空。' })
  }

  return { frontmatter, body, issues }
}

export function buildSkillMarkdown(name: string, description: string, body?: string): string {
  const title = name
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')

  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${title || name}\n\n${
    body?.trim() || 'Describe when to use this skill and the workflow it should follow.'
  }\n`
}
