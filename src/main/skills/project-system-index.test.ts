import assert from 'node:assert/strict'
import test from 'node:test'
import { homedir } from 'node:os'
import { inferProjectPathsFromSkillFiles } from './project-system-index.ts'

test('infers nested project roots from indexed Skill files', () => {
  const paths = inferProjectPathsFromSkillFiles([
    '/workspace/mono/.agents/skills/review/SKILL.md',
    '/workspace/mono/apps/web/.claude/skills/ui/SKILL.md',
    `${homedir()}/.agents/skills/system/SKILL.md`
  ], ['.agents/skills', '.claude/skills'])

  assert.deepEqual(paths.sort(), [
    '/workspace/mono',
    '/workspace/mono/apps/web'
  ])
})
