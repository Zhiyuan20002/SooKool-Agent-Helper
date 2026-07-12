# Skill Catalog

The Skill Catalog describes where Skills live, what scope they have, and which applications can use them.

## Language

**Skill Space**:
A physical directory that owns one canonical collection of Skills.
_Avoid_: Skill application, source application

**Shared Skill Space**:
A Skill Space that is not owned by one application and can be consumed by multiple compatible applications. It can have system or project scope; `.agent` and `.agents/skills` are shared spaces rather than applications.
_Avoid_: Shared application, duplicated application directory

**Application Skill Space**:
A Skill Space owned by one application, such as Codex or Claude Code.
_Avoid_: Application rule

**Scope**:
The boundary in which a Skill Space applies: system-wide or within a project.
_Avoid_: Ownership

**Application Binding**:
The relationship declaring that an application can consume a Skill Space; it does not transfer ownership or duplicate Skills.
_Avoid_: Application ownership

**Project**:
A directory hierarchy in which project-scoped Skill Spaces can exist.
_Avoid_: Project Skill Space

**Project Candidate**:
A directory suggested by a Discovery Source that may own project-scoped Skill Spaces but has not yet been confirmed by Project Evidence.
_Avoid_: Unverified Project

**Discovery Source**:
A mechanism that suggests Project Candidates, such as a manual registration, a recent workspace, or a bounded directory scan.
_Avoid_: Scanner

**Project Evidence**:
A verified project-scoped Skill Space containing at least one Skill and proving that a Project Candidate is a Project.
_Avoid_: Project marker

**Discovery Record**:
The durable observation connecting a Project with its Discovery Sources, Project Evidence, and confirmation status.
_Avoid_: Project cache
