import type { SkillApplication, SkillProject, SkillRoot, SkillSummary } from './types/skills'

export type SkillLibraryPerspective = 'application' | 'project'
export type SkillLibraryNodeKind = 'application' | 'shared' | 'system' | 'project'

export interface SkillLibraryNode {
  id: string
  label: string
  kind: SkillLibraryNodeKind
  skills: SkillSummary[]
  children: SkillLibraryNode[]
  applicationId?: string
  projectId?: string
  rootId?: string
  path?: string
}

export interface SkillLibraryData {
  applications: SkillApplication[]
  projects: SkillProject[]
  roots: SkillRoot[]
  skills: SkillSummary[]
}

export interface SkillLibraryLabels {
  shared: string
  system: string
  unclassified: string
}

export function buildSkillLibraryTree(
  perspective: SkillLibraryPerspective,
  data: SkillLibraryData,
  labels: SkillLibraryLabels
): SkillLibraryNode[] {
  const rootById = new Map(data.roots.map((root) => [root.id, root]))
  const childrenByProject = new Map<string | null, SkillProject[]>()
  for (const project of data.projects) {
    const children = childrenByProject.get(project.parentProjectId) || []
    children.push(project)
    childrenByProject.set(project.parentProjectId, children)
  }
  for (const children of childrenByProject.values()) {
    children.sort((left, right) => left.name.localeCompare(right.name))
  }

  const skillsFor = (
    applicationId: string,
    scope: 'system' | 'project',
    projectId: string | null
  ) =>
    data.skills.filter((skill) => {
      const root = rootById.get(skill.rootId)
      return (
        root?.scope === scope &&
        root.projectId === projectId &&
        !isSharedRoot(root) &&
        root.appIds.includes(applicationId)
      )
    })

  const sharedRootNodes = (
    scope: 'system' | 'project',
    projectId: string | null
  ): SkillLibraryNode[] =>
    data.roots.flatMap((root) => {
      if (!isSharedRoot(root) || root.scope !== scope || root.projectId !== projectId) return []
      const skills = data.skills.filter((skill) => skill.rootId === root.id)
      if (!skills.length) return []
      return [{
        id: `shared:${root.id}`,
        label: scope === 'system' ? labels.system : labels.shared,
        kind: scope === 'system' ? 'system' as const : 'shared' as const,
        skills,
        children: [],
        projectId: root.projectId ?? undefined,
        rootId: root.id,
        path: displaySkillSpacePath(root, data.projects)
      }]
    })

  const buildSharedProjectNode = (project: SkillProject): SkillLibraryNode | null => {
    const spaces = sharedRootNodes('project', project.id)
    const children = (childrenByProject.get(project.id) || [])
      .map(buildSharedProjectNode)
      .filter((node): node is SkillLibraryNode => Boolean(node))
    if (!spaces.length && !children.length) return null
    return {
      id: `shared:project:${project.id}`,
      label: project.name,
      kind: 'project',
      skills: [],
      children: [...spaces, ...children],
      projectId: project.id
    }
  }

  if (perspective === 'application') {
    const applicationNodes: SkillLibraryNode[] = data.applications.flatMap((application) => {
      const systemSkills = skillsFor(application.id, 'system', null)
      const projectNodes = (childrenByProject.get(null) || [])
        .map((project) =>
          applicationProjectNode(project, application.id, childrenByProject, skillsFor)
        )
        .filter((node): node is SkillLibraryNode => Boolean(node))
      const children: SkillLibraryNode[] = []
      if (systemSkills.length) {
        const systemPaths = displaySkillPaths(systemSkills, rootById, data.projects)
        children.push({
          id: `application:${application.id}:system`,
          label: labels.system,
          kind: 'system',
          skills: systemSkills,
          children: [],
          applicationId: application.id,
          path: systemPaths.join(' · ')
        })
      }
      children.push(...projectNodes)
      if (!children.length) return []
      return [
        {
          id: `application:${application.id}`,
          label: application.name,
          kind: 'application' as const,
          skills: [],
          children,
          applicationId: application.id
        }
      ]
    })
    const sharedChildren = [
      ...sharedRootNodes('system', null),
      ...(childrenByProject.get(null) || [])
        .map(buildSharedProjectNode)
        .filter((node): node is SkillLibraryNode => Boolean(node))
    ]
    const sharedNodes: SkillLibraryNode[] = sharedChildren.length
      ? [{
          id: 'shared',
          label: labels.shared,
          kind: 'shared',
          skills: [],
          children: sharedChildren
        }]
      : []
    const unassignedSkills = data.skills.filter((skill) => {
      const root = rootById.get(skill.rootId)
      return !root || root.appIds.length === 0
    })
    if (unassignedSkills.length) {
      applicationNodes.push({
        id: 'application:unassigned',
        label: labels.unclassified,
        kind: 'system',
        skills: unassignedSkills,
        children: []
      })
    }
    return [...sharedNodes, ...applicationNodes]
  }

  const buildProjectNode = (project: SkillProject): SkillLibraryNode | null => {
    const sharedNodes = sharedRootNodes('project', project.id)
    const applicationNodes = data.applications.flatMap((application) => {
      const skills = skillsFor(application.id, 'project', project.id)
      if (!skills.length) return []
      return [
        {
          id: `project:${project.id}:application:${application.id}`,
          label: application.name,
          kind: 'application' as const,
          skills,
          children: [],
          applicationId: application.id,
          projectId: project.id
        }
      ]
    })
    const projectNodes = (childrenByProject.get(project.id) || [])
      .map(buildProjectNode)
      .filter((node): node is SkillLibraryNode => Boolean(node))
    if (!sharedNodes.length && !applicationNodes.length && !projectNodes.length) return null
    return {
      id: `project:${project.id}`,
      label: project.name,
      kind: 'project',
      skills: [],
      children: [...sharedNodes, ...applicationNodes, ...projectNodes],
      projectId: project.id
    }
  }

  return (childrenByProject.get(null) || [])
    .map(buildProjectNode)
    .filter((node): node is SkillLibraryNode => Boolean(node))
}

function isSharedRoot(root: SkillRoot): boolean {
  return root.shared || root.appIds.length > 1 || root.category === 'shared'
}

function displaySkillPaths(
  skills: SkillSummary[],
  rootById: Map<string, SkillRoot>,
  projects: SkillProject[]
): string[] {
  const rootIds = [...new Set(skills.map((skill) => skill.rootId))]
  return rootIds.flatMap((rootId) => {
    const root = rootById.get(rootId)
    return root ? [displaySkillSpacePath(root, projects)] : []
  })
}

function displaySkillSpacePath(root: SkillRoot, projects: SkillProject[]): string {
  const normalizedPath = root.path.replaceAll('\\', '/').replace(/\/$/, '')
  if (root.scope === 'project' && root.projectId) {
    const project = projects.find((item) => item.id === root.projectId)
    const projectPath = project?.path.replaceAll('\\', '/').replace(/\/$/, '')
    if (projectPath && normalizedPath.startsWith(`${projectPath}/`)) {
      return normalizedPath.slice(projectPath.length + 1)
    }
  }
  return normalizedPath
    .replace(/^\/Users\/[^/]+(?=\/|$)/, '~')
    .replace(/^\/home\/[^/]+(?=\/|$)/, '~')
    .replace(/^[A-Za-z]:\/Users\/[^/]+(?=\/|$)/i, '~')
}

function applicationProjectNode(
  project: SkillProject,
  applicationId: string,
  childrenByProject: Map<string | null, SkillProject[]>,
  skillsFor: (
    applicationId: string,
    scope: 'system' | 'project',
    projectId: string | null
  ) => SkillSummary[]
): SkillLibraryNode | null {
  const skills = skillsFor(applicationId, 'project', project.id)
  const children = (childrenByProject.get(project.id) || [])
    .map((child) => applicationProjectNode(child, applicationId, childrenByProject, skillsFor))
    .filter((node): node is SkillLibraryNode => Boolean(node))
  if (!skills.length && !children.length) return null
  return {
    id: `application:${applicationId}:project:${project.id}`,
    label: project.name,
    kind: 'project',
    skills,
    children,
    applicationId,
    projectId: project.id
  }
}
