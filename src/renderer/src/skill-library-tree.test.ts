import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSkillLibraryTree } from './skill-library-tree.ts'
import type { SkillApplication, SkillProject, SkillRoot, SkillSummary } from './types/skills.ts'

const applications: SkillApplication[] = [
  {
    id: 'codex',
    name: 'Codex',
    source: 'builtin',
    detectionPaths: [],
    systemSkillPaths: [],
    projectSkillPaths: []
  },
  {
    id: 'claude',
    name: 'Claude',
    source: 'builtin',
    detectionPaths: [],
    systemSkillPaths: [],
    projectSkillPaths: []
  }
]
const projects: SkillProject[] = [
  { id: 'parent', name: 'Parent', path: '/parent', parentProjectId: null },
  { id: 'child', name: 'Child', path: '/parent/child', parentProjectId: 'parent' }
]
const roots: SkillRoot[] = [
  root('system', 'system', null, ['codex']),
  root('parent-codex', 'project', 'parent', ['codex']),
  root('child-shared', 'project', 'child', ['codex', 'claude'])
]
const skills: SkillSummary[] = [
  skill('global', 'system'),
  skill('parent skill', 'parent-codex'),
  skill('child skill', 'child-shared')
]

test('builds application-first groups with system and nested project branches', () => {
  const tree = buildSkillLibraryTree(
    'application',
    { applications, projects, roots, skills },
    { shared: '共享技能', system: '系统技能', unclassified: '待归类目录' }
  )
  assert.equal(tree[0].kind, 'shared')
  assert.equal(tree[0].label, '共享技能')
  assert.equal(tree[0].children[0].children[0].children[0].label, '共享技能')
  assert.equal(tree[0].children[0].children[0].children[0].path, '.agents/skills')
  const codex = tree.find((node) => node.id === 'application:codex')
  assert.deepEqual(
    codex?.children.map((node) => node.label),
    ['系统技能', 'Parent']
  )
  assert.equal(codex?.children[0].path, '/system')
  assert.equal(codex?.children[1].children.length, 0)
  assert.equal(tree.some((node) => node.id === 'application:claude'), false)
  assert.deepEqual(tree[0].children[0].children[0].children[0].skills.map((item) => item.name), ['child skill'])
})

test('builds project-first groups with applications as the second level', () => {
  const tree = buildSkillLibraryTree(
    'project',
    { applications, projects, roots, skills },
    { shared: '共享技能', system: '系统技能', unclassified: '待归类目录' }
  )
  assert.deepEqual(
    tree.map((node) => node.label),
    ['Parent']
  )
  assert.deepEqual(
    tree[0].children.map((node) => node.label),
    ['Codex', 'Child']
  )
  assert.deepEqual(
    tree[0].children[1].children.map((node) => node.label),
    ['共享技能']
  )
  assert.equal(tree[0].children[1].children[0].path, '.agents/skills')
})

test('omits applications and projects whose directories contain no Skills', () => {
  const applicationTree = buildSkillLibraryTree(
    'application',
    { applications, projects, roots, skills: [] },
    { shared: 'Shared skills', system: 'System skills', unclassified: 'Unclassified' }
  )
  assert.deepEqual(applicationTree, [])

  const projectTree = buildSkillLibraryTree(
    'project',
    { applications, projects, roots, skills: [] },
    { shared: 'Shared skills', system: 'System skills', unclassified: 'Unclassified' }
  )
  assert.deepEqual(projectTree, [])
})

test('shows a shared system space as system skills with a home-relative path', () => {
  const sharedRoot = {
    ...root('shared-system', 'system', null, ['codex', 'claude']),
    path: '/Users/example/.agents/skills'
  }
  const sharedSkill = {
    ...skills[0],
    id: 'shared-skill',
    name: 'shared-skill',
    rootId: sharedRoot.id,
    applicationIds: sharedRoot.appIds
  }
  const tree = buildSkillLibraryTree(
    'application',
    { applications, projects: [], roots: [sharedRoot], skills: [sharedSkill] },
    { shared: '共享目录', system: '系统技能', unclassified: '待归类目录' }
  )

  assert.equal(tree.length, 1)
  assert.equal(tree[0].label, '共享目录')
  assert.equal(tree[0].children[0].label, '系统技能')
  assert.equal(tree[0].children[0].path, '~/.agents/skills')
})

function root(
  id: string,
  scope: 'system' | 'project',
  projectId: string | null,
  appIds: string[]
): SkillRoot {
  const path = id === 'parent-codex'
    ? '/parent/.agents/skills'
    : id === 'child-shared'
      ? '/parent/child/.agents/skills'
      : `/${id}`
  return {
    id,
    label: id,
    path,
    readonly: false,
    defaultRoot: false,
    exists: true,
    source: 'application',
    category: appIds.length > 1 ? 'shared' : 'application',
    appIds,
    appNames: appIds,
    shared: appIds.length > 1,
    scope,
    projectId
  }
}

function skill(name: string, rootId: string): SkillSummary {
  const rootValue = roots.find((item) => item.id === rootId)!
  return {
    id: name,
    name,
    description: name,
    path: `/${name}`,
    skillFilePath: `/${name}/SKILL.md`,
    rootId,
    rootLabel: rootId,
    readonly: false,
    system: false,
    modifiedAt: '',
    resourceDirs: [],
    issues: [],
    applicationIds: rootValue.appIds,
    projectId: rootValue.projectId,
    scope: rootValue.scope
  }
}
