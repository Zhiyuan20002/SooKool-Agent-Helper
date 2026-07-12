import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { buildSkillTopology } from './skill-topology.ts'

test('resolves system and nested project skill locations from application rules', () => {
  const workspace = resolve('/workspace')
  const child = resolve('/workspace/packages/child')
  const topology = buildSkillTopology({
    applications: [
      {
        id: 'codex',
        name: 'Codex',
        source: 'builtin',
        detectionPaths: [],
        systemSkillPaths: ['/home/user/.codex/skills'],
        projectSkillPaths: ['.agents/skills']
      }
    ],
    projects: [
      { id: 'workspace', name: 'Workspace', path: workspace },
      { id: 'child', name: 'Child', path: child }
    ]
  })

  assert.equal(
    topology.projects.find((project) => project.id === 'child')?.parentProjectId,
    'workspace'
  )
  assert.deepEqual(
    topology.locations.map(({ applicationIds, projectId, scope, path }) => ({
      applicationIds,
      projectId,
      scope,
      path
    })),
    [
      {
        applicationIds: ['codex'],
        projectId: null,
        scope: 'system',
        path: resolve('/home/user/.codex/skills')
      },
      {
        applicationIds: ['codex'],
        projectId: 'workspace',
        scope: 'project',
        path: resolve(workspace, '.agents/skills')
      },
      {
        applicationIds: ['codex'],
        projectId: 'child',
        scope: 'project',
        path: resolve(child, '.agents/skills')
      }
    ]
  )
})

test('deduplicates shared physical locations while retaining all application bindings', () => {
  const topology = buildSkillTopology({
    applications: [
      {
        id: 'codex',
        name: 'Codex',
        source: 'builtin',
        detectionPaths: [],
        systemSkillPaths: [],
        projectSkillPaths: ['.agents/skills']
      },
      {
        id: 'cursor',
        name: 'Cursor',
        source: 'builtin',
        detectionPaths: [],
        systemSkillPaths: [],
        projectSkillPaths: ['.agents/skills']
      }
    ],
    projects: [{ id: 'project', name: 'Project', path: '/workspace/project' }]
  })

  assert.equal(topology.locations.length, 1)
  assert.deepEqual(topology.locations[0].applicationIds, ['codex', 'cursor'])
})

test('rejects project skill rules that escape through internal traversal', () => {
  assert.throws(
    () =>
      buildSkillTopology({
        applications: [
          {
            id: 'unsafe',
            name: 'Unsafe',
            source: 'custom',
            detectionPaths: [],
            systemSkillPaths: [],
            projectSkillPaths: ['skills/../../outside']
          }
        ],
        projects: [{ id: 'project', name: 'Project', path: '/workspace/project' }]
      }),
    /不能超出项目目录/
  )
})

test('assigns a shared physical location to the nearest registered project', () => {
  const topology = buildSkillTopology({
    applications: [
      {
        id: 'parent-rule',
        name: 'Parent rule',
        source: 'custom',
        detectionPaths: [],
        systemSkillPaths: [],
        projectSkillPaths: ['packages/child/.agents/skills']
      },
      {
        id: 'child-rule',
        name: 'Child rule',
        source: 'custom',
        detectionPaths: [],
        systemSkillPaths: [],
        projectSkillPaths: ['.agents/skills']
      }
    ],
    projects: [
      { id: 'parent', name: 'Parent', path: '/workspace' },
      { id: 'child', name: 'Child', path: '/workspace/packages/child' }
    ]
  })

  assert.equal(topology.locations.length, 3)
  const shared = topology.locations.find(
    (location) => location.path === resolve('/workspace/packages/child/.agents/skills')
  )
  assert.equal(shared?.projectId, 'child')
  assert.deepEqual(shared?.applicationIds, ['child-rule', 'parent-rule'])
})
