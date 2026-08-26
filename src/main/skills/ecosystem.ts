import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { spawn } from 'child_process'
import type { ApplicationRule, ProjectRegistration } from './skill-topology'

export interface SkillAgentAdapter {
  id: string
  name: string
  projectPath: string
  globalPath: string | null
  installed: boolean
}

export interface SkillApplicationRoot {
  id: string
  name: string
  path: string
  installed: boolean
}

export interface SkillsCommandInput {
  command: 'add' | 'use' | 'list' | 'find' | 'remove' | 'update' | 'init'
  source?: string
  query?: string
  skills?: string[]
  agents?: string[]
  global?: boolean
  project?: boolean
  all?: boolean
  copy?: boolean
  yes?: boolean
  listOnly?: boolean
  owner?: string
  launchAgent?: string
  name?: string
}

export interface SkillsCommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
}

export interface SkillsCommandLaunchSpec {
  executable: string
  args: string[]
  env: NodeJS.ProcessEnv
}

const home = homedir()
const codexHome = process.env.CODEX_HOME?.trim() || join(home, '.codex')
const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, '.claude')
const dshHome = process.env.DSH_HOME?.trim() || join(home, '.dsh')
const dshAgentsHome = process.env.DSH_AGENTS_HOME?.trim() || join(home, '.agents')
const dshSkillPath = join(dshHome, 'skills')
const dshAgentsSkillPath = join(dshAgentsHome, 'skills')
const vibeHome = process.env.VIBE_HOME?.trim() || join(home, '.vibe')
const hermesHome = process.env.HERMES_HOME?.trim() || join(home, '.hermes')
const autohandHome = process.env.AUTOHAND_HOME?.trim() || join(home, '.autohand')

interface SkillAgentCatalogEntry extends Omit<SkillAgentAdapter, 'installed'> {
  detectPaths: string[]
  projectPaths: string[]
  globalPaths: string[]
}

const agentCatalog: SkillAgentCatalogEntry[] = [
  adapter('aider-desk', 'AiderDesk', '.aider-desk/skills', '~/.aider-desk/skills', [
    '~/.aider-desk'
  ]),
  adapter('amp', 'Amp', '.agents/skills', '~/.config/agents/skills', ['~/.config/amp']),
  adapter('antigravity', 'Antigravity', '.agents/skills', '~/.gemini/antigravity/skills', [
    '~/.gemini/antigravity'
  ]),
  adapter(
    'antigravity-cli',
    'Antigravity CLI',
    '.agents/skills',
    '~/.gemini/antigravity-cli/skills',
    ['~/.gemini/antigravity-cli']
  ),
  adapter('astrbot', 'AstrBot', 'data/skills', '~/.astrbot/data/skills', [
    'data/skills',
    '~/.astrbot'
  ]),
  adapter('autohand-code', 'Autohand Code CLI', '.autohand/skills', `${autohandHome}/skills`, [
    autohandHome
  ]),
  adapter('augment', 'Augment', '.augment/skills', '~/.augment/skills', ['~/.augment']),
  adapter('bob', 'IBM Bob', '.bob/skills', '~/.bob/skills', ['~/.bob']),
  adapter('claude-code', 'Claude Code', '.claude/skills', `${claudeHome}/skills`, [claudeHome]),
  adapter('openclaw', 'OpenClaw', 'skills', '~/.openclaw/skills', [
    '~/.openclaw',
    '~/.clawdbot',
    '~/.moltbot'
  ]),
  adapter('cline', 'Cline', '.agents/skills', '~/.agents/skills', ['~/.cline']),
  adapter('codearts-agent', 'CodeArts Agent', '.codeartsdoer/skills', '~/.codeartsdoer/skills', [
    '~/.codeartsdoer'
  ]),
  adapter('codebuddy', 'CodeBuddy', '.codebuddy/skills', '~/.codebuddy/skills', [
    '.codebuddy',
    '~/.codebuddy'
  ]),
  adapter('codemaker', 'Codemaker', '.codemaker/skills', '~/.codemaker/skills', ['~/.codemaker']),
  adapter('codestudio', 'Code Studio', '.codestudio/skills', '~/.codestudio/skills', [
    '~/.codestudio'
  ]),
  adapter('codex', 'Codex', '.agents/skills', `${codexHome}/skills`, [codexHome, '/etc/codex']),
  adapter('command-code', 'Command Code', '.commandcode/skills', '~/.commandcode/skills', [
    '~/.commandcode'
  ]),
  adapter('continue', 'Continue', '.continue/skills', '~/.continue/skills', [
    '.continue',
    '~/.continue'
  ]),
  adapter('cortex', 'Cortex Code', '.cortex/skills', '~/.snowflake/cortex/skills', [
    '~/.snowflake/cortex'
  ]),
  adapter('crush', 'Crush', '.crush/skills', '~/.config/crush/skills', ['~/.config/crush']),
  adapter('cursor', 'Cursor', '.agents/skills', '~/.cursor/skills', ['~/.cursor']),
  adapter(
    'deepseek-harness',
    'DeepSeek Harness',
    '.dsh/skills',
    dshSkillPath,
    [dshHome, '.dsh'],
    {
      projectPaths: ['.dsh/skills', '.agents/skills'],
      globalPaths: [dshSkillPath, dshAgentsSkillPath]
    }
  ),
  adapter('deepagents', 'Deep Agents', '.agents/skills', '~/.deepagents/agent/skills', [
    '~/.deepagents'
  ]),
  adapter('devin', 'Devin for Terminal', '.devin/skills', '~/.config/devin/skills', [
    '~/.config/devin'
  ]),
  adapter('dexto', 'Dexto', '.agents/skills', '~/.agents/skills', ['~/.dexto']),
  adapter('droid', 'Droid', '.factory/skills', '~/.factory/skills', ['~/.factory']),
  adapter('eve', 'Eve', 'agent/skills', null, ['agent']),
  adapter('firebender', 'Firebender', '.agents/skills', '~/.firebender/skills', ['~/.firebender']),
  adapter('forgecode', 'ForgeCode', '.forge/skills', '~/.forge/skills', ['~/.forge']),
  adapter('gemini-cli', 'Gemini CLI', '.agents/skills', '~/.gemini/skills', ['~/.gemini']),
  adapter('github-copilot', 'GitHub Copilot', '.agents/skills', '~/.copilot/skills', [
    '~/.copilot'
  ]),
  adapter('goose', 'Goose', '.goose/skills', '~/.config/goose/skills', ['~/.config/goose']),
  adapter('hermes-agent', 'Hermes Agent', '.hermes/skills', `${hermesHome}/skills`, [hermesHome]),
  adapter('inference-sh', 'inference.sh', '.inferencesh/skills', '~/.inferencesh/skills', [
    '~/.inferencesh'
  ]),
  adapter('jazz', 'Jazz', '.jazz/skills', '~/.jazz/skills', ['.jazz', '~/.jazz']),
  adapter('junie', 'Junie', '.junie/skills', '~/.junie/skills', ['~/.junie']),
  adapter('iflow-cli', 'iFlow CLI', '.iflow/skills', '~/.iflow/skills', ['~/.iflow']),
  adapter('kilo', 'Kilo Code', '.kilocode/skills', '~/.kilocode/skills', ['~/.kilocode']),
  adapter('kimi-code-cli', 'Kimi Code CLI', '.agents/skills', '~/.agents/skills', [
    '~/.kimi-code',
    '~/.kimi'
  ]),
  adapter('kiro-cli', 'Kiro CLI', '.kiro/skills', '~/.kiro/skills', ['~/.kiro']),
  adapter('kode', 'Kode', '.kode/skills', '~/.kode/skills', ['~/.kode']),
  adapter('lingma', 'Lingma', '.lingma/skills', '~/.lingma/skills', ['~/.lingma']),
  adapter('loaf', 'Loaf', '.agents/skills', '~/.agents/skills', ['~/.loaf']),
  adapter('mcpjam', 'MCPJam', '.mcpjam/skills', '~/.mcpjam/skills', ['~/.mcpjam']),
  adapter('mistral-vibe', 'Mistral Vibe', '.vibe/skills', `${vibeHome}/skills`, [vibeHome]),
  adapter('moxby', 'Moxby', '.moxby/skills', '~/.moxby/skills', ['~/.moxby']),
  adapter('mux', 'Mux', '.mux/skills', '~/.mux/skills', ['~/.mux']),
  adapter('opencode', 'OpenCode', '.agents/skills', '~/.config/opencode/skills', [
    '~/.config/opencode'
  ]),
  adapter('openhands', 'OpenHands', '.openhands/skills', '~/.openhands/skills', ['~/.openhands']),
  adapter('ona', 'Ona', '.ona/skills', '~/.ona/skills', ['~/.ona']),
  adapter('pi', 'Pi', '.pi/skills', '~/.pi/agent/skills', ['~/.pi/agent']),
  adapter('qoder', 'Qoder', '.qoder/skills', '~/.qoder/skills', ['~/.qoder']),
  adapter('qoder-cn', 'Qoder CN', '.qoder/skills', '~/.qoder-cn/skills', ['~/.qoder-cn']),
  adapter('qwen-code', 'Qwen Code', '.qwen/skills', '~/.qwen/skills', ['~/.qwen']),
  adapter('replit', 'Replit', '.agents/skills', '~/.config/agents/skills', ['.replit']),
  adapter('reasonix', 'Reasonix', '.reasonix/skills', '~/.reasonix/skills', ['~/.reasonix']),
  adapter('rovodev', 'Rovo Dev', '.rovodev/skills', '~/.rovodev/skills', ['~/.rovodev']),
  adapter('roo', 'Roo Code', '.roo/skills', '~/.roo/skills', ['~/.roo']),
  adapter('tabnine-cli', 'Tabnine CLI', '.tabnine/agent/skills', '~/.tabnine/agent/skills', [
    '~/.tabnine'
  ]),
  adapter('terramind', 'Terramind', '.terramind/skills', '~/.terramind/skills', ['~/.terramind']),
  adapter('tinycloud', 'Tinycloud', '.tinycloud/skills', '~/.tinycloud/skills', ['~/.tinycloud']),
  adapter('trae', 'Trae', '.trae/skills', '~/.trae/skills', ['~/.trae']),
  adapter('trae-cn', 'Trae CN', '.trae/skills', '~/.trae-cn/skills', ['~/.trae-cn']),
  adapter('warp', 'Warp', '.agents/skills', '~/.agents/skills', ['~/.warp']),
  adapter('windsurf', 'Windsurf', '.windsurf/skills', '~/.codeium/windsurf/skills', [
    '~/.codeium/windsurf'
  ]),
  adapter('zed', 'Zed', '.agents/skills', '~/.agents/skills', ['~/.config/zed']),
  adapter('zencoder', 'Zencoder', '.zencoder/skills', '~/.zencoder/skills', ['~/.zencoder']),
  adapter('zenflow', 'Zenflow', '.zencoder/skills', '~/.zencoder/skills', ['~/.zencoder']),
  adapter('neovate', 'Neovate', '.neovate/skills', '~/.neovate/skills', ['~/.neovate']),
  adapter('pochi', 'Pochi', '.pochi/skills', '~/.pochi/skills', ['~/.pochi']),
  adapter('promptscript', 'PromptScript', '.agents/skills', null, [
    '.promptscript',
    'promptscript.yaml'
  ]),
  adapter('adal', 'AdaL', '.adal/skills', '~/.adal/skills', ['~/.adal']),
  adapter('universal', 'Universal', '.agents/skills', '~/.config/agents/skills', [])
]

export function listSkillAgentAdapters(cwd = process.cwd()): SkillAgentAdapter[] {
  return agentCatalog.map((entry) => ({
    id: entry.id,
    name: entry.name,
    projectPath: entry.projectPath,
    globalPath: entry.globalPath ? expandPath(entry.globalPath) : null,
    installed: entry.detectPaths.some((path) => existsSync(resolveDetectPath(path, cwd)))
  }))
}

export function listSkillApplicationRoots(cwd = process.cwd()): SkillApplicationRoot[] {
  return agentCatalog
    .filter((entry) => entry.globalPaths.length > 0)
    .map((entry) => {
      const path = expandPath(entry.globalPaths[0])
      const installed =
        (entry.globalPath ? existsSync(expandPath(entry.globalPath)) : false) ||
        entry.detectPaths.some((detectPath) => existsSync(resolveDetectPath(detectPath, cwd)))

      return {
        id: entry.id,
        name: entry.name,
        path,
        installed
      }
    })
    .filter((entry) => entry.installed)
}

export function listBuiltinApplicationRules(
  projects: ProjectRegistration[] = [],
  cwd = process.cwd()
): ApplicationRule[] {
  return agentCatalog
    .filter((entry) => {
      const globalInstalled = entry.globalPath
        ? existsSync(expandPath(entry.globalPath))
        : false
      const detected = entry.detectPaths.some((path) => existsSync(resolveDetectPath(path, cwd)))
      const projectInstalled = projects.some((project) => {
        const hasSkills = entry.projectPaths.some((path) => existsSync(join(project.path, path)))
        const detectedInProject = entry.detectPaths.some(
          (path) =>
            !path.startsWith('~/') &&
            !path.startsWith('/') &&
            existsSync(resolveDetectPath(path, project.path))
        )
        return detectedInProject || (entry.detectPaths.length === 0 && hasSkills)
      })
      return globalInstalled || detected || projectInstalled
    })
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      source: 'builtin' as const,
      detectionPaths: [...entry.detectPaths],
      systemSkillPaths: entry.globalPaths.map(expandPath),
      projectSkillPaths: [...entry.projectPaths]
    }))
}

export function isBuiltinApplicationId(id: string): boolean {
  return agentCatalog.some((application) => application.id === id)
}

export function runSkillsCommand(
  input: SkillsCommandInput,
  cwd = process.cwd(),
  skillsCliPath = join(process.cwd(), 'node_modules/skills/bin/cli.mjs')
): Promise<SkillsCommandResult> {
  const launch = createSkillsCommandLaunchSpec(input, skillsCliPath)
  const args = launch.args.slice(1)
  const startedAt = Date.now()
  return new Promise((resolve) => {
    const child = spawn(launch.executable, launch.args, {
      cwd,
      env: launch.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      resolve({
        command: `skills ${args.join(' ')}`,
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(`${stderr}${error.message}`),
        exitCode: 1,
        durationMs: Date.now() - startedAt
      })
    })
    child.on('close', (code) => {
      resolve({
        command: `skills ${args.join(' ')}`,
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr),
        exitCode: code ?? 0,
        durationMs: Date.now() - startedAt
      })
    })
  })
}

export function createSkillsCommandLaunchSpec(
  input: SkillsCommandInput,
  skillsCliPath: string,
  executable = process.execPath,
  environment: NodeJS.ProcessEnv = process.env
): SkillsCommandLaunchSpec {
  return {
    executable,
    args: [skillsCliPath, ...buildSkillsArgs(input)],
    env: {
      ...environment,
      DISABLE_TELEMETRY: '1',
      ELECTRON_RUN_AS_NODE: '1'
    }
  }
}

function buildSkillsArgs(input: SkillsCommandInput): string[] {
  const args: string[] = [input.command]
  const supportsAgent =
    input.command === 'add' || input.command === 'list' || input.command === 'remove'
  const supportsGlobal =
    input.command === 'add' ||
    input.command === 'list' ||
    input.command === 'remove' ||
    input.command === 'update'
  const supportsProject = input.command === 'update'
  const supportsYes =
    input.command === 'add' || input.command === 'remove' || input.command === 'update'
  if (input.command === 'add' || input.command === 'use') {
    if (input.source?.trim()) args.push(input.source.trim())
  }
  if (input.command === 'find' && input.query?.trim()) args.push(input.query.trim())
  if (input.command === 'init' && input.name?.trim()) args.push(input.name.trim())
  if ((input.command === 'remove' || input.command === 'update') && input.skills?.length) {
    const positionalSkills = input.skills.filter((skill) => skill && skill !== '*')
    args.push(...positionalSkills)
  }
  if (input.command === 'add' || input.command === 'use') {
    for (const skill of input.skills ?? []) args.push('--skill', skill)
  }
  if (input.command === 'remove' && input.skills?.includes('*')) args.push('--skill', '*')
  if (supportsAgent) for (const agent of input.agents ?? []) args.push('--agent', agent)
  if (supportsGlobal && input.global) args.push('--global')
  if (supportsProject && input.project) args.push('--project')
  if ((input.command === 'add' || input.command === 'remove') && input.all) args.push('--all')
  if (input.command === 'add' && input.listOnly) args.push('--list')
  if (input.command === 'add' && input.copy) args.push('--copy')
  if (supportsYes && input.yes) args.push('--yes')
  if (input.command === 'find' && input.owner?.trim()) args.push('--owner', input.owner.trim())
  if (input.launchAgent?.trim() && input.command === 'use')
    args.push('--agent', input.launchAgent.trim())
  return args
}

function adapter(
  id: string,
  name: string,
  projectPath: string,
  globalPath: string | null,
  detectPaths: string[],
  paths: { projectPaths?: string[]; globalPaths?: string[] } = {}
): SkillAgentCatalogEntry {
  return {
    id,
    name,
    projectPath,
    globalPath,
    detectPaths,
    projectPaths: paths.projectPaths ?? [projectPath],
    globalPaths: paths.globalPaths ?? (globalPath ? [globalPath] : [])
  }
}

function resolveDetectPath(path: string, cwd: string): string {
  if (path.startsWith('~/')) return join(home, path.slice(2))
  if (path.startsWith('/')) return path
  return join(cwd, path)
}

function expandPath(path: string): string {
  if (path.startsWith('~/')) return join(home, path.slice(2))
  return path
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '')
}
