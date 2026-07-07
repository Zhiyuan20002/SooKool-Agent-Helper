export type ThemeMode = 'system' | 'light' | 'dark'

export type AppLanguage = 'zh-CN' | 'en-US'

export interface AppPreferences {
  themeMode: ThemeMode
  language: AppLanguage
  autoScanOnStart: boolean
}

export interface AppMetrics {
  version: string
  platform: string
  arch: string
  memory: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
  }
}

export type TranslationKey =
  | 'app.loading'
  | 'nav.local'
  | 'nav.market'
  | 'nav.settings'
  | 'sidebar.expand'
  | 'sidebar.collapse'
  | 'settings.title'
  | 'settings.description'
  | 'settings.addSkillRoot'
  | 'settings.tabs.general'
  | 'settings.tabs.resources'
  | 'settings.tabs.directories'
  | 'settings.tabs.backups'
  | 'settings.general.title'
  | 'settings.general.description'
  | 'settings.appearance'
  | 'settings.theme.system'
  | 'settings.theme.light'
  | 'settings.theme.dark'
  | 'settings.language'
  | 'settings.language.zh'
  | 'settings.language.en'
  | 'settings.autoScan'
  | 'settings.autoScan.description'
  | 'settings.resources.title'
  | 'settings.resources.description'
  | 'settings.resources.refresh'
  | 'settings.resources.rss'
  | 'settings.resources.heapUsed'
  | 'settings.resources.heapTotal'
  | 'settings.resources.external'
  | 'settings.resources.appVersion'
  | 'settings.resources.runtime'
  | 'settings.directories.title'
  | 'settings.directories.description'
  | 'settings.backups.title'
  | 'settings.backups.description'
  | 'settings.backups.empty'
  | 'settings.metrics.detectedRoots'
  | 'settings.metrics.customRoots'
  | 'settings.metrics.backups'
  | 'settings.metrics.skills'
  | 'settings.status.on'
  | 'settings.status.off'
  | 'skills.title'
  | 'skills.count'
  | 'skills.refresh'
  | 'skills.search'
  | 'skills.filter.source'
  | 'skills.filter.status'
  | 'skills.metric.all'
  | 'skills.metric.apps'
  | 'skills.status.all'
  | 'skills.status.issues'
  | 'skills.root.all'
  | 'skills.root.shared'
  | 'skills.root.application'
  | 'skills.root.custom'
  | 'skills.detail.empty'
  | 'skills.noMatches'
  | 'skills.validated'
  | 'skills.modified'
  | 'skills.reveal'
  | 'skills.copyPath'
  | 'skills.deleteConfirm'
  | 'skills.apply.title'
  | 'skills.apply.description'
  | 'skills.apply.close'
  | 'skills.apply.empty'
  | 'skills.apply.running'
  | 'skills.apply.add'
  | 'skills.apply.remove'
  | 'command.done'
  | 'command.failed'
  | 'command.empty'
  | 'format.script'
  | 'format.text'
  | 'format.image'
  | 'format.file'
  | 'root.unregistered'
  | 'root.codex'
  | 'root.shared'
  | 'root.application'
  | 'root.custom'
  | 'root.default'
  | 'access.systemReadonly'
  | 'access.readonly'
  | 'access.editable'
  | 'market.title'
  | 'market.sources'
  | 'market.importLocal'
  | 'market.builtin'
  | 'market.loadingSources'
  | 'market.source'
  | 'market.sourcePlaceholder'
  | 'market.name'
  | 'market.optional'
  | 'market.addSource'
  | 'market.searchMarket'
  | 'market.searchPlaceholder'
  | 'market.search'
  | 'market.refresh'
  | 'market.sourceContext'
  | 'market.searchResults'
  | 'market.skillCount'
  | 'market.emptyBrowse'
  | 'market.emptySearch'
  | 'market.loading'
  | 'market.selectSkill'
  | 'market.deleteSourceConfirm'
  | 'market.installFailed'
  | 'market.imported'
  | 'market.installed'
  | 'market.reinstall'
  | 'market.install'
  | 'market.openSource'
  | 'market.removeSource'
  | 'market.sourceLabel'
  | 'market.installSource'
  | 'market.status'
  | 'market.type'
  | 'market.notInstalled'
  | 'market.searchResult'
  | 'market.installSkill'
  | 'market.reinstallSkill'
  | 'market.lastCommand'
  | 'market.noCommand'
  | 'market.commandOutput'
  | 'market.noOutput'

type Replacements = Record<string, string | number>

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  'zh-CN': {
    'app.loading': '正在扫描技能库...',
    'nav.local': '技能库',
    'nav.market': '技能市场',
    'nav.settings': '设置',
    'sidebar.expand': '展开侧栏',
    'sidebar.collapse': '收起侧栏',
    'settings.title': '设置',
    'settings.description': '管理应用偏好、资源占用、技能目录和备份。',
    'settings.addSkillRoot': '添加技能目录',
    'settings.tabs.general': '通用',
    'settings.tabs.resources': '资源',
    'settings.tabs.directories': '技能目录',
    'settings.tabs.backups': '备份',
    'settings.general.title': '通用设置',
    'settings.general.description': '调整应用显示、语言和启动后的基础行为。',
    'settings.appearance': '外观',
    'settings.theme.system': '跟随系统',
    'settings.theme.light': '浅色',
    'settings.theme.dark': '深色',
    'settings.language': '语言',
    'settings.language.zh': '简体中文',
    'settings.language.en': 'English',
    'settings.autoScan': '启动后自动扫描',
    'settings.autoScan.description': '打开应用时自动刷新本地 Skill 和目录状态。',
    'settings.resources.title': '资源占用',
    'settings.resources.description': '查看当前应用进程的内存占用和运行信息。',
    'settings.resources.refresh': '刷新资源信息',
    'settings.resources.rss': '常驻内存',
    'settings.resources.heapUsed': '已用堆内存',
    'settings.resources.heapTotal': '堆内存总量',
    'settings.resources.external': '外部内存',
    'settings.resources.appVersion': '应用版本',
    'settings.resources.runtime': '运行环境',
    'settings.directories.title': '技能目录',
    'settings.directories.description': '管理当前应用检测到的 Skill 来源目录。',
    'settings.backups.title': '删除备份',
    'settings.backups.description': '查看删除 Skill 时自动保留的备份记录。',
    'settings.backups.empty': '还没有备份记录',
    'settings.metrics.detectedRoots': '已检测目录',
    'settings.metrics.customRoots': '自定义目录',
    'settings.metrics.backups': '删除备份',
    'settings.metrics.skills': '全部 Skill',
    'settings.status.on': '开启',
    'settings.status.off': '关闭',
    'skills.title': '技能库',
    'skills.count': '{count} 个 Skill',
    'skills.refresh': '重新扫描',
    'skills.search': '搜索名称、描述或路径',
    'skills.filter.source': '来源筛选',
    'skills.filter.status': '状态筛选',
    'skills.metric.all': '全部',
    'skills.metric.apps': '应用',
    'skills.status.all': '全部状态',
    'skills.status.issues': '仅看异常',
    'skills.root.all': '全部来源',
    'skills.root.shared': '共享目录',
    'skills.root.application': '应用目录',
    'skills.root.custom': '自定义目录',
    'skills.detail.empty': '选择一个 Skill',
    'skills.noMatches': '没有匹配的 Skill',
    'skills.validated': '已校验',
    'skills.modified': '修改时间',
    'skills.reveal': '在 Finder 中显示',
    'skills.copyPath': '复制技能目录路径',
    'skills.deleteConfirm': '删除并备份 {name}？',
    'skills.apply.title': '转移技能',
    'skills.apply.description': '把当前 Skill 转移到已检测的软件目录。',
    'skills.apply.close': '关闭',
    'skills.apply.empty': '未检测到可应用的软件。可以在设置里添加技能目录。',
    'skills.apply.running': '执行中',
    'skills.apply.add': '转移到选中软件',
    'skills.apply.remove': '从选中软件移除',
    'command.done': '执行完成',
    'command.failed': '执行失败',
    'command.empty': '命令没有输出。',
    'format.script': '脚本',
    'format.text': '文本',
    'format.image': '图片',
    'format.file': '文件',
    'root.unregistered': '未登记来源',
    'root.codex': 'Codex',
    'root.shared': '共享目录',
    'root.application': '应用目录',
    'root.custom': '自定义目录',
    'root.default': '默认目录',
    'access.systemReadonly': '系统只读',
    'access.readonly': '只读',
    'access.editable': '可编辑',
    'market.title': '技能市场',
    'market.sources': '{count} 个来源',
    'market.importLocal': '导入本地技能',
    'market.builtin': '内置',
    'market.loadingSources': '加载来源',
    'market.source': '市场源',
    'market.sourcePlaceholder': 'owner/repo、Git URL 或本地路径',
    'market.name': '名称',
    'market.optional': '可选',
    'market.addSource': '添加来源',
    'market.searchMarket': '搜索市场',
    'market.searchPlaceholder': '搜索公开技能',
    'market.search': '搜索',
    'market.refresh': '刷新来源',
    'market.sourceContext': '市场源',
    'market.searchResults': '搜索结果',
    'market.skillCount': '{count} 个 Skill',
    'market.emptyBrowse': '当前来源没有可展示的 Skill',
    'market.emptySearch': '没有搜索结果',
    'market.loading': '正在加载',
    'market.selectSkill': '选择一个 Skill',
    'market.deleteSourceConfirm': '删除市场源 {name}？',
    'market.installFailed': '安装失败。',
    'market.imported': '已导入 {name}',
    'market.installed': '已安装',
    'market.reinstall': '重新安装',
    'market.install': '安装',
    'market.openSource': '打开来源页面',
    'market.removeSource': '删除市场源',
    'market.sourceLabel': '来源',
    'market.installSource': '安装源',
    'market.status': '状态',
    'market.type': '类型',
    'market.notInstalled': '未安装',
    'market.searchResult': '搜索结果',
    'market.installSkill': '安装 Skill',
    'market.reinstallSkill': '重新安装 Skill',
    'market.lastCommand': '最近命令',
    'market.noCommand': '尚未执行命令',
    'market.commandOutput': '最近命令输出',
    'market.noOutput': '暂无输出'
  },
  'en-US': {
    'app.loading': 'Scanning skill library...',
    'nav.local': 'Library',
    'nav.market': 'Market',
    'nav.settings': 'Settings',
    'sidebar.expand': 'Expand sidebar',
    'sidebar.collapse': 'Collapse sidebar',
    'settings.title': 'Settings',
    'settings.description': 'Manage preferences, resource usage, skill directories, and backups.',
    'settings.addSkillRoot': 'Add skill directory',
    'settings.tabs.general': 'General',
    'settings.tabs.resources': 'Resources',
    'settings.tabs.directories': 'Skill directories',
    'settings.tabs.backups': 'Backups',
    'settings.general.title': 'General',
    'settings.general.description': 'Adjust appearance, language, and startup behavior.',
    'settings.appearance': 'Appearance',
    'settings.theme.system': 'System',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.language': 'Language',
    'settings.language.zh': '简体中文',
    'settings.language.en': 'English',
    'settings.autoScan': 'Scan on launch',
    'settings.autoScan.description':
      'Refresh local skills and directory status when the app opens.',
    'settings.resources.title': 'Resource Usage',
    'settings.resources.description': 'Inspect current app memory usage and runtime information.',
    'settings.resources.refresh': 'Refresh resource info',
    'settings.resources.rss': 'Resident memory',
    'settings.resources.heapUsed': 'Heap used',
    'settings.resources.heapTotal': 'Heap total',
    'settings.resources.external': 'External memory',
    'settings.resources.appVersion': 'App version',
    'settings.resources.runtime': 'Runtime',
    'settings.directories.title': 'Skill Directories',
    'settings.directories.description': 'Manage detected Skill source directories.',
    'settings.backups.title': 'Deleted Backups',
    'settings.backups.description': 'Review backups kept automatically when Skills are deleted.',
    'settings.backups.empty': 'No backups yet',
    'settings.metrics.detectedRoots': 'Detected roots',
    'settings.metrics.customRoots': 'Custom roots',
    'settings.metrics.backups': 'Deleted backups',
    'settings.metrics.skills': 'Total Skills',
    'settings.status.on': 'On',
    'settings.status.off': 'Off',
    'skills.title': 'Library',
    'skills.count': '{count} Skills',
    'skills.refresh': 'Rescan',
    'skills.search': 'Search name, description, or path',
    'skills.filter.source': 'Source filter',
    'skills.filter.status': 'Status filter',
    'skills.metric.all': 'All',
    'skills.metric.apps': 'Apps',
    'skills.status.all': 'All statuses',
    'skills.status.issues': 'Issues only',
    'skills.root.all': 'All sources',
    'skills.root.shared': 'Shared directory',
    'skills.root.application': 'App directories',
    'skills.root.custom': 'Custom directories',
    'skills.detail.empty': 'Select a Skill',
    'skills.noMatches': 'No matching Skills',
    'skills.validated': 'Validated',
    'skills.modified': 'Modified',
    'skills.reveal': 'Reveal in Finder',
    'skills.copyPath': 'Copy skill directory path',
    'skills.deleteConfirm': 'Delete and back up {name}?',
    'skills.apply.title': 'Transfer Skill',
    'skills.apply.description': 'Transfer this Skill into detected software directories.',
    'skills.apply.close': 'Close',
    'skills.apply.empty': 'No applicable software detected. Add a skill directory in Settings.',
    'skills.apply.running': 'Running',
    'skills.apply.add': 'Transfer to selected apps',
    'skills.apply.remove': 'Remove from selected apps',
    'command.done': 'Completed',
    'command.failed': 'Failed',
    'command.empty': 'Command produced no output.',
    'format.script': 'Script',
    'format.text': 'Text',
    'format.image': 'Image',
    'format.file': 'File',
    'root.unregistered': 'Unregistered source',
    'root.codex': 'Codex',
    'root.shared': 'Shared directory',
    'root.application': 'App directory',
    'root.custom': 'Custom directory',
    'root.default': 'Default directory',
    'access.systemReadonly': 'System read-only',
    'access.readonly': 'Read-only',
    'access.editable': 'Editable',
    'market.title': 'Skill Market',
    'market.sources': '{count} sources',
    'market.importLocal': 'Import local skill',
    'market.builtin': 'Built in',
    'market.loadingSources': 'Loading sources',
    'market.source': 'Market source',
    'market.sourcePlaceholder': 'owner/repo, Git URL, or local path',
    'market.name': 'Name',
    'market.optional': 'Optional',
    'market.addSource': 'Add source',
    'market.searchMarket': 'Search market',
    'market.searchPlaceholder': 'Search public skills',
    'market.search': 'Search',
    'market.refresh': 'Refresh source',
    'market.sourceContext': 'Market source',
    'market.searchResults': 'Search results',
    'market.skillCount': '{count} Skills',
    'market.emptyBrowse': 'This source has no Skills to show',
    'market.emptySearch': 'No search results',
    'market.loading': 'Loading',
    'market.selectSkill': 'Select a Skill',
    'market.deleteSourceConfirm': 'Delete market source {name}?',
    'market.installFailed': 'Install failed.',
    'market.imported': 'Imported {name}',
    'market.installed': 'Installed',
    'market.reinstall': 'Reinstall',
    'market.install': 'Install',
    'market.openSource': 'Open source page',
    'market.removeSource': 'Delete market source',
    'market.sourceLabel': 'Source',
    'market.installSource': 'Install source',
    'market.status': 'Status',
    'market.type': 'Type',
    'market.notInstalled': 'Not installed',
    'market.searchResult': 'Search result',
    'market.installSkill': 'Install Skill',
    'market.reinstallSkill': 'Reinstall Skill',
    'market.lastCommand': 'Last Command',
    'market.noCommand': 'No command has run',
    'market.commandOutput': 'Last command output',
    'market.noOutput': 'No output yet'
  }
}

export function translate(
  language: AppLanguage,
  key: TranslationKey,
  replacements: Replacements = {}
): string {
  const template = translations[language][key] || translations['zh-CN'][key] || key
  return Object.entries(replacements).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    template
  )
}
