export type ThemeMode = 'system' | 'light' | 'dark'

export type AppLanguage =
  | 'zh-CN'
  | 'zh-TW'
  | 'en-US'
  | 'ja-JP'
  | 'fr-FR'
  | 'ko-KR'
  | 'es-ES'
  | 'pt-BR'
  | 'ar'
export type AppLanguagePreference = AppLanguage | 'system'

export interface AppPreferences {
  themeMode: ThemeMode
  language: AppLanguagePreference
  autoScanOnStart: boolean
}

export interface AppMetrics {
  version: string
  platform: string
  arch: string
  uptime: number
  memory: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
  }
  processes: Array<{
    pid: number
    type: string
    name?: string
    cpuPercent: number
    idleWakeupsPerSecond: number
    memory: null | { workingSet: number; peakWorkingSet: number; privateBytes: number }
  }>
  storage: {
    totalBytes: number
    scannedAt: string
    categories: Array<{
      id: 'market-catalogs' | 'market-previews' | 'browser-cache' | 'logs'
      bytes: number
      files: number
      directories: number
      path: string
    }>
  }
}

export type TranslationKey =
  | 'app.loading'
  | 'app.title'
  | 'app.subtitle'
  | 'nav.local'
  | 'nav.market'
  | 'nav.skillSettings'
  | 'nav.settings'
  | 'sidebar.expand'
  | 'sidebar.collapse'
  | 'settings.title'
  | 'settings.description'
  | 'settings.skill.title'
  | 'settings.skill.description'
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
  | 'settings.language.system'
  | 'settings.language.zh'
  | 'settings.language.zhTW'
  | 'settings.language.en'
  | 'settings.language.ja'
  | 'settings.language.fr'
  | 'settings.language.ko'
  | 'settings.language.es'
  | 'settings.language.pt'
  | 'settings.language.ar'
  | 'settings.autoScan'
  | 'settings.autoScan.description'
  | 'settings.resources.title'
  | 'settings.resources.description'
  | 'settings.resources.refresh'
  | 'settings.resources.rss'
  | 'settings.resources.heapUsed'
  | 'settings.resources.heapTotal'
  | 'settings.resources.external'
  | 'settings.resources.arrayBuffers'
  | 'settings.resources.uptime'
  | 'settings.resources.processes'
  | 'settings.resources.storage'
  | 'settings.resources.storageDescription'
  | 'settings.resources.storageTotal'
  | 'settings.resources.marketCatalogs'
  | 'settings.resources.marketCatalogsDescription'
  | 'settings.resources.marketPreviews'
  | 'settings.resources.marketPreviewsDescription'
  | 'settings.resources.browserCache'
  | 'settings.resources.browserCacheDescription'
  | 'settings.resources.logs'
  | 'settings.resources.logsDescription'
  | 'settings.resources.files'
  | 'settings.resources.directories'
  | 'settings.resources.clean'
  | 'settings.resources.cleanAll'
  | 'settings.resources.cleaning'
  | 'settings.resources.cleaned'
  | 'settings.resources.cleanConfirm'
  | 'settings.resources.processType'
  | 'settings.resources.cpu'
  | 'settings.resources.memory'
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
  | 'skills.apply.heading'
  | 'skills.apply.description'
  | 'skills.apply.select'
  | 'skills.apply.selected'
  | 'skills.apply.close'
  | 'skills.apply.empty'
  | 'skills.apply.running'
  | 'skills.apply.add'
  | 'skills.apply.remove'
  | 'skills.apply.transferring'
  | 'skills.apply.removing'
  | 'skills.apply.details'
  | 'skills.scope.system'
  | 'skills.scope.project'
  | 'skills.tree.systemDirectory'
  | 'skills.tree.projectDirectory'
  | 'skills.tree.application'
  | 'topology.applicationRules'
  | 'topology.projectDirectories'
  | 'topology.byApplication'
  | 'topology.byProject'
  | 'topology.addApplicationRule'
  | 'topology.addProjectDirectory'
  | 'topology.applicationDescription'
  | 'topology.applicationName'
  | 'topology.systemSkillPath'
  | 'topology.projectSkillPath'
  | 'topology.cancel'
  | 'topology.saveRule'
  | 'topology.systemDirectory'
  | 'topology.projectPath'
  | 'topology.builtin'
  | 'topology.removeRule'
  | 'topology.unclassified'
  | 'topology.projectDescription'
  | 'topology.nestedProject'
  | 'topology.rootProject'
  | 'topology.removeRegistration'
  | 'topology.removeProjectConfirm'
  | 'topology.noProjects'
  | 'discovery.quickScan'
  | 'discovery.deepScan'
  | 'discovery.cancel'
  | 'discovery.scanning'
  | 'discovery.ready'
  | 'discovery.found'
  | 'discovery.checked'
  | 'discovery.lastScan'
  | 'discovery.scanLocations'
  | 'discovery.scanLocationsDescription'
  | 'discovery.addLocation'
  | 'discovery.removeLocation'
  | 'discovery.ignoreProject'
  | 'discovery.ignoreProjectConfirm'
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

const translations: Record<AppLanguage, Partial<Record<TranslationKey, string>>> = {
  'zh-CN': {
    'app.loading': '正在扫描技能库...',
    'app.title': 'SooKool 智能体助手',
    'app.subtitle': '智能体助手',
    'nav.local': '技能库',
    'nav.market': '技能市场',
    'nav.skillSettings': '技能设置',
    'nav.settings': '设置',
    'sidebar.expand': '展开侧栏',
    'sidebar.collapse': '收起侧栏',
    'settings.title': '设置',
    'settings.description': '管理应用外观、语言和资源占用。',
    'settings.skill.title': '技能设置',
    'settings.skill.description': '管理技能目录和删除备份。',
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
    'settings.language.system': '跟随系统',
    'settings.language.zh': '简体中文',
    'settings.language.zhTW': '繁體中文',
    'settings.language.en': 'English',
    'settings.language.ja': '日本語',
    'settings.language.fr': 'Français',
    'settings.language.ko': '한국어',
    'settings.language.es': 'Español',
    'settings.language.pt': 'Português',
    'settings.language.ar': 'العربية',
    'settings.autoScan': '启动后自动扫描',
    'settings.autoScan.description': '打开应用时自动刷新本地 Skill 和目录状态。',
    'settings.resources.title': '资源占用',
    'settings.resources.description': '查看当前应用进程的内存占用和运行信息。',
    'settings.resources.refresh': '刷新资源信息',
    'settings.resources.rss': '常驻内存',
    'settings.resources.heapUsed': '已用堆内存',
    'settings.resources.heapTotal': '堆内存总量',
    'settings.resources.external': '外部内存',
    'settings.resources.arrayBuffers': '二进制缓冲区',
    'settings.resources.uptime': '本次运行时长',
    'settings.resources.processes': '进程明细',
    'settings.resources.storage': '可清理存储',
    'settings.resources.storageDescription': '仅统计应用自身可重新生成的数据，不包含已安装的 Skill。',
    'settings.resources.storageTotal': '可清理总量',
    'settings.resources.marketCatalogs': '市场目录缓存',
    'settings.resources.marketCatalogsDescription': '各市场的列表索引和搜索快照。',
    'settings.resources.marketPreviews': '技能预览缓存',
    'settings.resources.marketPreviewsDescription': '预览和安装时下载、解压的市场技能包。',
    'settings.resources.browserCache': '界面与网络缓存',
    'settings.resources.browserCacheDescription': 'Electron 页面、脚本和图形缓存。',
    'settings.resources.logs': '运行日志',
    'settings.resources.logsDescription': '应用运行期间生成的诊断日志。',
    'settings.resources.files': '{count} 个文件',
    'settings.resources.directories': '{count} 个目录',
    'settings.resources.clean': '清理',
    'settings.resources.cleanAll': '清理全部',
    'settings.resources.cleaning': '正在清理…',
    'settings.resources.cleaned': '已释放 {size}',
    'settings.resources.cleanConfirm': '确定清理这些可重新生成的数据吗？',
    'settings.resources.processType': '进程',
    'settings.resources.cpu': 'CPU',
    'settings.resources.memory': '内存',
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
    'skills.modified': '更新时间',
    'skills.reveal': '在 Finder 中显示',
    'skills.copyPath': '复制技能目录路径',
    'skills.deleteConfirm': '删除并备份 {name}？',
    'skills.apply.title': '转移技能',
    'skills.apply.heading': '转移到其他应用',
    'skills.apply.description': '选择接收当前 Skill 的应用。',
    'skills.apply.select': '可用应用',
    'skills.apply.selected': '已选择 {count} 个应用',
    'skills.apply.close': '关闭',
    'skills.apply.empty': '未检测到可应用的软件。可以在设置里添加技能目录。',
    'skills.apply.running': '执行中',
    'skills.apply.add': '转移到选中应用',
    'skills.apply.remove': '从选中应用移除',
    'skills.apply.transferring': '正在转移…',
    'skills.apply.removing': '正在移除…',
    'skills.apply.details': '查看执行详情',
    'skills.scope.system': '系统技能',
    'skills.scope.project': '项目技能',
    'skills.tree.systemDirectory': '应用系统目录',
    'skills.tree.projectDirectory': '项目目录',
    'skills.tree.application': '应用',
    'topology.applicationRules': '应用规则',
    'topology.projectDirectories': '项目目录',
    'topology.byApplication': '按应用',
    'topology.byProject': '按项目',
    'topology.addApplicationRule': '添加应用规则',
    'topology.addProjectDirectory': '添加项目目录',
    'topology.applicationDescription': '定义每个应用的系统技能目录和项目内相对目录。',
    'topology.applicationName': '应用名称',
    'topology.systemSkillPath': '系统技能目录，例如 ~/.my-agent/skills',
    'topology.projectSkillPath': '项目技能相对路径，例如 .my-agent/skills',
    'topology.cancel': '取消',
    'topology.saveRule': '保存规则',
    'topology.systemDirectory': '系统目录',
    'topology.projectPath': '项目路径',
    'topology.builtin': '内置规则',
    'topology.removeRule': '删除规则',
    'topology.unclassified': '待归类目录',
    'topology.projectDescription': '登记项目根目录后，应用规则会自动解析项目技能。',
    'topology.nestedProject': '嵌套项目',
    'topology.rootProject': '根项目',
    'topology.removeRegistration': '移除登记',
    'topology.removeProjectConfirm': '只移除项目登记，不会删除任何文件。继续吗？',
    'topology.noProjects': '尚未添加项目目录。',
    'discovery.quickScan': '快速扫描',
    'discovery.deepScan': '深度扫描',
    'discovery.cancel': '停止扫描',
    'discovery.scanning': '正在发现项目',
    'discovery.ready': '项目索引已就绪',
    'discovery.found': '已发现 {count} 个项目',
    'discovery.checked': '已检查 {count} 个目录',
    'discovery.lastScan': '上次扫描：{time}',
    'discovery.scanLocations': '额外扫描位置',
    'discovery.scanLocationsDescription': '添加常用开发目录、外接磁盘或其他项目位置。',
    'discovery.addLocation': '添加位置',
    'discovery.removeLocation': '移除扫描位置',
    'discovery.ignoreProject': '忽略自动项目',
    'discovery.ignoreProjectConfirm': '忽略这个自动发现的项目？以后扫描将不再显示它。',
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
    'app.title': 'SooKool Agent Helper',
    'app.subtitle': 'Agent Helper',
    'nav.local': 'Library',
    'nav.market': 'Market',
    'nav.skillSettings': 'Skill Settings',
    'nav.settings': 'Settings',
    'sidebar.expand': 'Expand sidebar',
    'sidebar.collapse': 'Collapse sidebar',
    'settings.title': 'Settings',
    'settings.description': 'Manage app appearance, language, and resource usage.',
    'settings.skill.title': 'Skill Settings',
    'settings.skill.description': 'Manage Skill directories and deleted backups.',
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
    'settings.language.system': 'Follow system',
    'settings.language.zh': '简体中文',
    'settings.language.zhTW': '繁體中文',
    'settings.language.en': 'English',
    'settings.language.ja': '日本語',
    'settings.language.fr': 'Français',
    'settings.language.ko': '한국어',
    'settings.language.es': 'Español',
    'settings.language.pt': 'Português',
    'settings.language.ar': 'العربية',
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
    'settings.resources.arrayBuffers': 'Binary buffers',
    'settings.resources.uptime': 'Session uptime',
    'settings.resources.processes': 'Process details',
    'settings.resources.storage': 'Cleanable storage',
    'settings.resources.storageDescription': 'Only regenerable app data is counted. Installed Skills are never included.',
    'settings.resources.storageTotal': 'Cleanable total',
    'settings.resources.marketCatalogs': 'Market catalog cache',
    'settings.resources.marketCatalogsDescription': 'Market indexes and search snapshots.',
    'settings.resources.marketPreviews': 'Skill preview cache',
    'settings.resources.marketPreviewsDescription': 'Downloaded and extracted market packages used for previews and installs.',
    'settings.resources.browserCache': 'UI and network cache',
    'settings.resources.browserCacheDescription': 'Electron page, script, and graphics caches.',
    'settings.resources.logs': 'Runtime logs',
    'settings.resources.logsDescription': 'Diagnostic logs generated while the app runs.',
    'settings.resources.files': '{count} files',
    'settings.resources.directories': '{count} folders',
    'settings.resources.clean': 'Clean',
    'settings.resources.cleanAll': 'Clean all',
    'settings.resources.cleaning': 'Cleaning…',
    'settings.resources.cleaned': 'Freed {size}',
    'settings.resources.cleanConfirm': 'Clean this regenerable data?',
    'settings.resources.processType': 'Process',
    'settings.resources.cpu': 'CPU',
    'settings.resources.memory': 'Memory',
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
    'skills.modified': 'Updated',
    'skills.reveal': 'Reveal in Finder',
    'skills.copyPath': 'Copy skill directory path',
    'skills.deleteConfirm': 'Delete and back up {name}?',
    'skills.apply.title': 'Transfer Skill',
    'skills.apply.heading': 'Transfer to other apps',
    'skills.apply.description': 'Choose the apps that should receive this Skill.',
    'skills.apply.select': 'Available apps',
    'skills.apply.selected': '{count} apps selected',
    'skills.apply.close': 'Close',
    'skills.apply.empty': 'No applicable software detected. Add a skill directory in Settings.',
    'skills.apply.running': 'Running',
    'skills.apply.add': 'Transfer to selected apps',
    'skills.apply.remove': 'Remove from selected apps',
    'skills.apply.transferring': 'Transferring…',
    'skills.apply.removing': 'Removing…',
    'skills.apply.details': 'View execution details',
    'skills.scope.system': 'System skills',
    'skills.scope.project': 'Project skills',
    'skills.tree.systemDirectory': 'Application system directory',
    'skills.tree.projectDirectory': 'Project directory',
    'skills.tree.application': 'Application',
    'topology.applicationRules': 'Application rules',
    'topology.projectDirectories': 'Project directories',
    'topology.byApplication': 'By application',
    'topology.byProject': 'By project',
    'topology.addApplicationRule': 'Add application rule',
    'topology.addProjectDirectory': 'Add project directory',
    'topology.applicationDescription': 'Define system skill directories and project-relative skill paths for each application.',
    'topology.applicationName': 'Application name',
    'topology.systemSkillPath': 'System skill directory, e.g. ~/.my-agent/skills',
    'topology.projectSkillPath': 'Project-relative skill path, e.g. .my-agent/skills',
    'topology.cancel': 'Cancel',
    'topology.saveRule': 'Save rule',
    'topology.systemDirectory': 'System directory',
    'topology.projectPath': 'Project path',
    'topology.builtin': 'Built in',
    'topology.removeRule': 'Remove rule',
    'topology.unclassified': 'Unclassified directory',
    'topology.projectDescription': 'Register project roots so application rules can resolve their project skills.',
    'topology.nestedProject': 'Nested project',
    'topology.rootProject': 'Root project',
    'topology.removeRegistration': 'Remove registration',
    'topology.removeProjectConfirm': 'Remove this registration without deleting any files?',
    'topology.noProjects': 'No project directories added yet.',
    'discovery.quickScan': 'Quick scan',
    'discovery.deepScan': 'Deep scan',
    'discovery.cancel': 'Stop scan',
    'discovery.scanning': 'Discovering projects',
    'discovery.ready': 'Project index ready',
    'discovery.found': '{count} projects found',
    'discovery.checked': '{count} directories checked',
    'discovery.lastScan': 'Last scan: {time}',
    'discovery.scanLocations': 'Additional scan locations',
    'discovery.scanLocationsDescription': 'Add development folders, external drives, or other project locations.',
    'discovery.addLocation': 'Add location',
    'discovery.removeLocation': 'Remove scan location',
    'discovery.ignoreProject': 'Ignore discovered project',
    'discovery.ignoreProjectConfirm': 'Ignore this automatically discovered project in future scans?',
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
  },
  'zh-TW': {
    'app.loading': '正在掃描技能庫…',
    'app.title': 'SooKool 智能體助手',
    'app.subtitle': '智能體助手',
    'nav.local': '技能庫',
    'nav.market': '技能市集',
    'nav.skillSettings': '技能設定',
    'nav.settings': '設定',
    'sidebar.expand': '展開側邊欄',
    'sidebar.collapse': '收合側邊欄',
    'settings.title': '設定',
    'settings.description': '管理應用程式外觀、語言與資源使用。',
    'settings.skill.title': '技能設定',
    'settings.skill.description': '管理技能目錄與刪除備份。',
    'settings.addSkillRoot': '新增技能目錄',
    'settings.tabs.general': '一般',
    'settings.tabs.resources': '資源',
    'settings.tabs.directories': '技能目錄',
    'settings.tabs.backups': '備份',
    'settings.general.title': '一般設定',
    'settings.general.description': '調整外觀、語言與啟動行為。',
    'settings.appearance': '外觀',
    'settings.theme.system': '跟隨系統',
    'settings.theme.light': '淺色',
    'settings.theme.dark': '深色',
    'settings.language': '語言',
    'settings.language.system': '跟隨系統',
    'settings.autoScan': '啟動時自動掃描',
    'settings.autoScan.description': '開啟應用程式時重新整理本機 Skill 與目錄狀態。',
    'settings.resources.title': '資源使用',
    'settings.resources.refresh': '重新整理資源資訊',
    'settings.directories.title': '技能目錄',
    'settings.backups.title': '已刪除的備份',
    'settings.backups.empty': '尚無備份記錄',
    'settings.metrics.detectedRoots': '已偵測目錄',
    'settings.metrics.customRoots': '自訂目錄',
    'settings.metrics.backups': '已刪除備份',
    'settings.metrics.skills': '全部 Skill',
    'settings.status.on': '開啟',
    'settings.status.off': '關閉',
    'skills.title': '技能庫',
    'skills.count': '{count} 個 Skill',
    'skills.refresh': '重新掃描',
    'skills.search': '搜尋名稱、描述或路徑',
    'skills.metric.all': '全部',
    'skills.metric.apps': '應用程式',
    'skills.status.all': '所有狀態',
    'skills.status.issues': '僅顯示異常',
    'skills.root.all': '所有來源',
    'skills.detail.empty': '選擇一個 Skill',
    'skills.noMatches': '沒有符合的 Skill',
    'skills.validated': '已驗證',
    'skills.modified': '更新時間',
    'skills.reveal': '在 Finder 中顯示',
    'skills.copyPath': '複製技能目錄路徑',
    'skills.apply.title': '轉移技能',
    'skills.apply.heading': '轉移至其他應用程式',
    'skills.apply.description': '選擇要接收目前 Skill 的應用程式。',
    'skills.apply.selected': '已選擇 {count} 個應用程式',
    'skills.apply.close': '關閉',
    'skills.apply.add': '轉移至選取的應用程式',
    'skills.apply.remove': '從選取的應用程式移除',
    'discovery.quickScan': '快速掃描', 'discovery.deepScan': '深度掃描', 'discovery.cancel': '停止掃描',
    'discovery.scanning': '正在探索專案', 'discovery.ready': '專案索引已就緒', 'discovery.found': '已找到 {count} 個專案',
    'discovery.checked': '已檢查 {count} 個目錄', 'discovery.lastScan': '上次掃描：{time}',
    'discovery.scanLocations': '額外掃描位置', 'discovery.scanLocationsDescription': '新增開發目錄、外接磁碟或其他專案位置。',
    'discovery.addLocation': '新增位置', 'discovery.removeLocation': '移除掃描位置',
    'discovery.ignoreProject': '忽略自動專案', 'discovery.ignoreProjectConfirm': '忽略這個自動探索的專案？之後掃描將不再顯示。',
    'command.done': '執行完成',
    'command.failed': '執行失敗',
    'market.title': '技能市集',
    'market.importLocal': '匯入本機技能',
    'market.addSource': '新增來源',
    'market.searchMarket': '搜尋市集',
    'market.search': '搜尋',
    'market.refresh': '重新整理來源',
    'market.install': '安裝',
    'market.reinstall': '重新安裝',
    'market.installed': '已安裝',
    'market.removeSource': '刪除市集來源',
    'skills.scope.system': '系統技能', 'skills.scope.project': '專案技能', 'skills.tree.systemDirectory': '應用系統目錄', 'skills.tree.projectDirectory': '專案目錄', 'skills.tree.application': '應用程式',
    'topology.applicationRules': '應用規則', 'topology.projectDirectories': '專案目錄', 'topology.byApplication': '按應用', 'topology.byProject': '按專案', 'topology.addApplicationRule': '新增應用規則', 'topology.addProjectDirectory': '新增專案目錄',
    'topology.applicationDescription': '定義每個應用的系統技能目錄和專案內相對目錄。', 'topology.applicationName': '應用名稱', 'topology.systemSkillPath': '系統技能目錄，例如 ~/.my-agent/skills', 'topology.projectSkillPath': '專案技能相對路徑，例如 .my-agent/skills',
    'topology.cancel': '取消', 'topology.saveRule': '儲存規則', 'topology.systemDirectory': '系統目錄', 'topology.projectPath': '專案路徑', 'topology.builtin': '內建規則', 'topology.removeRule': '刪除規則', 'topology.unclassified': '待分類目錄',
    'topology.projectDescription': '登記專案根目錄後，應用規則會自動解析專案技能。', 'topology.nestedProject': '巢狀專案', 'topology.rootProject': '根專案', 'topology.removeRegistration': '移除登記', 'topology.removeProjectConfirm': '只移除專案登記，不會刪除任何檔案。繼續嗎？', 'topology.noProjects': '尚未新增專案目錄。',
    'root.shared': '共享 Skill 目錄'
  },
  'ja-JP': {
    'app.loading': 'スキルライブラリをスキャンしています…',
    'app.title': 'SooKool エージェントアシスタント',
    'app.subtitle': 'エージェントアシスタント',
    'nav.local': 'ライブラリ',
    'nav.market': 'マーケット',
    'nav.skillSettings': 'Skill 設定',
    'nav.settings': '設定',
    'sidebar.expand': 'サイドバーを展開',
    'sidebar.collapse': 'サイドバーを折りたたむ',
    'settings.title': '設定',
    'settings.description': 'アプリの外観、言語、リソース使用量を管理します。',
    'settings.skill.title': 'Skill 設定',
    'settings.skill.description': 'Skill ディレクトリと削除済みバックアップを管理します。',
    'settings.addSkillRoot': 'スキルディレクトリを追加',
    'settings.tabs.general': '一般',
    'settings.tabs.resources': 'リソース',
    'settings.tabs.directories': 'スキルディレクトリ',
    'settings.tabs.backups': 'バックアップ',
    'settings.general.title': '一般設定',
    'settings.general.description': '外観、言語、起動時の動作を調整します。',
    'settings.appearance': '外観',
    'settings.theme.system': 'システム',
    'settings.theme.light': 'ライト',
    'settings.theme.dark': 'ダーク',
    'settings.language': '言語',
    'settings.language.system': 'システムに従う',
    'settings.autoScan': '起動時にスキャン',
    'settings.autoScan.description': 'アプリ起動時にローカル Skill とディレクトリの状態を更新します。',
    'settings.resources.title': 'リソース使用量',
    'settings.resources.refresh': 'リソース情報を更新',
    'settings.directories.title': 'スキルディレクトリ',
    'settings.backups.title': '削除済みバックアップ',
    'settings.backups.empty': 'バックアップはありません',
    'settings.metrics.detectedRoots': '検出済みディレクトリ',
    'settings.metrics.customRoots': 'カスタムディレクトリ',
    'settings.metrics.backups': '削除済みバックアップ',
    'settings.metrics.skills': 'すべての Skill',
    'settings.status.on': 'オン',
    'settings.status.off': 'オフ',
    'skills.title': 'ライブラリ',
    'skills.count': '{count} 件の Skill',
    'skills.refresh': '再スキャン',
    'skills.search': '名前、説明、パスを検索',
    'skills.metric.all': 'すべて',
    'skills.metric.apps': 'アプリ',
    'skills.status.all': 'すべての状態',
    'skills.status.issues': '問題のみ',
    'skills.root.all': 'すべてのソース',
    'skills.detail.empty': 'Skill を選択',
    'skills.noMatches': '一致する Skill はありません',
    'skills.validated': '検証済み',
    'skills.modified': '更新日時',
    'skills.reveal': 'Finder で表示',
    'skills.copyPath': 'スキルディレクトリのパスをコピー',
    'skills.apply.title': 'スキルを転送',
    'skills.apply.heading': '他のアプリへ転送',
    'skills.apply.description': 'この Skill を受け取るアプリを選択します。',
    'skills.apply.selected': '{count} 個のアプリを選択',
    'skills.apply.close': '閉じる',
    'skills.apply.add': '選択したアプリへ転送',
    'skills.apply.remove': '選択したアプリから削除',
    'discovery.quickScan': 'クイックスキャン', 'discovery.deepScan': '詳細スキャン', 'discovery.cancel': 'スキャンを停止',
    'discovery.scanning': 'プロジェクトを検出中', 'discovery.ready': 'プロジェクト索引は準備完了', 'discovery.found': '{count} 件のプロジェクト',
    'discovery.checked': '{count} 個のディレクトリを確認', 'discovery.lastScan': '前回のスキャン：{time}',
    'discovery.scanLocations': '追加のスキャン場所', 'discovery.scanLocationsDescription': '開発フォルダー、外付けドライブ、その他の場所を追加します。',
    'discovery.addLocation': '場所を追加', 'discovery.removeLocation': 'スキャン場所を削除',
    'discovery.ignoreProject': '検出したプロジェクトを無視', 'discovery.ignoreProjectConfirm': '今後のスキャンでこのプロジェクトを無視しますか？',
    'command.done': '完了',
    'command.failed': '失敗',
    'market.title': 'スキルマーケット',
    'market.importLocal': 'ローカルスキルをインポート',
    'market.addSource': 'ソースを追加',
    'market.searchMarket': 'マーケットを検索',
    'market.search': '検索',
    'market.refresh': 'ソースを更新',
    'market.install': 'インストール',
    'market.reinstall': '再インストール',
    'market.installed': 'インストール済み',
    'market.removeSource': 'マーケットソースを削除',
    'skills.scope.system': 'システム Skill', 'skills.scope.project': 'プロジェクト Skill', 'skills.tree.systemDirectory': 'アプリのシステムディレクトリ', 'skills.tree.projectDirectory': 'プロジェクトディレクトリ', 'skills.tree.application': 'アプリ',
    'topology.applicationRules': 'アプリルール', 'topology.projectDirectories': 'プロジェクトディレクトリ', 'topology.byApplication': 'アプリ別', 'topology.byProject': 'プロジェクト別', 'topology.addApplicationRule': 'アプリルールを追加', 'topology.addProjectDirectory': 'プロジェクトディレクトリを追加',
    'topology.applicationDescription': '各アプリのシステム Skill ディレクトリとプロジェクト内の相対パスを定義します。', 'topology.applicationName': 'アプリ名', 'topology.systemSkillPath': 'システム Skill ディレクトリ、例: ~/.my-agent/skills', 'topology.projectSkillPath': 'プロジェクト内の相対 Skill パス、例: .my-agent/skills',
    'topology.cancel': 'キャンセル', 'topology.saveRule': 'ルールを保存', 'topology.systemDirectory': 'システムディレクトリ', 'topology.projectPath': 'プロジェクトパス', 'topology.builtin': '組み込みルール', 'topology.removeRule': 'ルールを削除', 'topology.unclassified': '未分類ディレクトリ',
    'topology.projectDescription': 'プロジェクトルートを登録すると、アプリルールがプロジェクト Skill を解決します。', 'topology.nestedProject': 'ネストしたプロジェクト', 'topology.rootProject': 'ルートプロジェクト', 'topology.removeRegistration': '登録を解除', 'topology.removeProjectConfirm': 'ファイルを削除せずに登録のみ解除します。続行しますか？', 'topology.noProjects': 'プロジェクトディレクトリがまだ追加されていません。',
    'root.shared': '共有 Skill ディレクトリ'
  },
  'fr-FR': {
    'app.loading': 'Analyse de la bibliothèque de compétences…',
    'app.title': 'Assistant d’agents SooKool',
    'app.subtitle': 'Assistant d’agents',
    'nav.local': 'Bibliothèque',
    'nav.market': 'Marché',
    'nav.skillSettings': 'Réglages Skill',
    'nav.settings': 'Réglages',
    'sidebar.expand': 'Développer la barre latérale',
    'sidebar.collapse': 'Réduire la barre latérale',
    'settings.title': 'Réglages',
    'settings.description': 'Gérez l’apparence, la langue et les ressources de l’application.',
    'settings.skill.title': 'Réglages Skill',
    'settings.skill.description': 'Gérez les dossiers Skill et les sauvegardes supprimées.',
    'settings.addSkillRoot': 'Ajouter un dossier de compétences',
    'settings.tabs.general': 'Général',
    'settings.tabs.resources': 'Ressources',
    'settings.tabs.directories': 'Dossiers de compétences',
    'settings.tabs.backups': 'Sauvegardes',
    'settings.general.title': 'Réglages généraux',
    'settings.general.description': 'Réglez l’apparence, la langue et le comportement au démarrage.',
    'settings.appearance': 'Apparence',
    'settings.theme.system': 'Système',
    'settings.theme.light': 'Clair',
    'settings.theme.dark': 'Sombre',
    'settings.language': 'Langue',
    'settings.language.system': 'Langue du système',
    'settings.autoScan': 'Analyser au démarrage',
    'settings.autoScan.description': 'Actualise les Skill locales et les dossiers à l’ouverture.',
    'settings.resources.title': 'Utilisation des ressources',
    'settings.resources.refresh': 'Actualiser les ressources',
    'settings.directories.title': 'Dossiers de compétences',
    'settings.backups.title': 'Sauvegardes supprimées',
    'settings.backups.empty': 'Aucune sauvegarde',
    'settings.metrics.detectedRoots': 'Dossiers détectés',
    'settings.metrics.customRoots': 'Dossiers personnalisés',
    'settings.metrics.backups': 'Sauvegardes supprimées',
    'settings.metrics.skills': 'Toutes les Skill',
    'settings.status.on': 'Activé',
    'settings.status.off': 'Désactivé',
    'skills.title': 'Bibliothèque',
    'skills.count': '{count} Skill',
    'skills.refresh': 'Réanalyser',
    'skills.search': 'Rechercher par nom, description ou chemin',
    'skills.metric.all': 'Toutes',
    'skills.metric.apps': 'Applications',
    'skills.status.all': 'Tous les états',
    'skills.status.issues': 'Problèmes uniquement',
    'skills.root.all': 'Toutes les sources',
    'skills.detail.empty': 'Sélectionnez une Skill',
    'skills.noMatches': 'Aucune Skill correspondante',
    'skills.validated': 'Validée',
    'skills.modified': 'Mise à jour',
    'skills.reveal': 'Afficher dans le Finder',
    'skills.copyPath': 'Copier le chemin du dossier',
    'skills.apply.title': 'Transférer la Skill',
    'skills.apply.heading': 'Transférer vers d’autres applications',
    'skills.apply.description': 'Choisissez les applications qui recevront cette Skill.',
    'skills.apply.selected': '{count} applications sélectionnées',
    'skills.apply.close': 'Fermer',
    'skills.apply.add': 'Transférer vers les applications sélectionnées',
    'skills.apply.remove': 'Retirer des applications sélectionnées',
    'discovery.quickScan': 'Analyse rapide', 'discovery.deepScan': 'Analyse approfondie', 'discovery.cancel': 'Arrêter',
    'discovery.scanning': 'Recherche des projets', 'discovery.ready': 'Index des projets prêt', 'discovery.found': '{count} projets trouvés',
    'discovery.checked': '{count} dossiers vérifiés', 'discovery.lastScan': 'Dernière analyse : {time}',
    'discovery.scanLocations': 'Emplacements supplémentaires', 'discovery.scanLocationsDescription': 'Ajoutez des dossiers de développement, disques externes ou autres emplacements.',
    'discovery.addLocation': 'Ajouter', 'discovery.removeLocation': 'Retirer l’emplacement',
    'discovery.ignoreProject': 'Ignorer le projet détecté', 'discovery.ignoreProjectConfirm': 'Ignorer ce projet lors des prochaines analyses ?',
    'command.done': 'Terminé',
    'command.failed': 'Échec',
    'market.title': 'Marché des compétences',
    'market.importLocal': 'Importer une compétence locale',
    'market.addSource': 'Ajouter une source',
    'market.searchMarket': 'Rechercher sur le marché',
    'market.search': 'Rechercher',
    'market.refresh': 'Actualiser la source',
    'market.install': 'Installer',
    'market.reinstall': 'Réinstaller',
    'market.installed': 'Installée',
    'market.removeSource': 'Supprimer la source',
    'skills.scope.system': 'Skills système', 'skills.scope.project': 'Skills du projet', 'skills.tree.systemDirectory': 'Répertoire système de l’application', 'skills.tree.projectDirectory': 'Répertoire du projet', 'skills.tree.application': 'Application',
    'topology.applicationRules': 'Règles d’application', 'topology.projectDirectories': 'Répertoires de projet', 'topology.byApplication': 'Par application', 'topology.byProject': 'Par projet', 'topology.addApplicationRule': 'Ajouter une règle d’application', 'topology.addProjectDirectory': 'Ajouter un répertoire de projet',
    'topology.applicationDescription': 'Définissez les répertoires Skill système et les chemins relatifs au projet pour chaque application.', 'topology.applicationName': 'Nom de l’application', 'topology.systemSkillPath': 'Répertoire Skill système, p. ex. ~/.my-agent/skills', 'topology.projectSkillPath': 'Chemin Skill relatif au projet, p. ex. .my-agent/skills',
    'topology.cancel': 'Annuler', 'topology.saveRule': 'Enregistrer la règle', 'topology.systemDirectory': 'Répertoire système', 'topology.projectPath': 'Chemin du projet', 'topology.builtin': 'Intégrée', 'topology.removeRule': 'Supprimer la règle', 'topology.unclassified': 'Répertoire non classé',
    'topology.projectDescription': 'Enregistrez les racines de projet afin que les règles d’application résolvent leurs Skills de projet.', 'topology.nestedProject': 'Projet imbriqué', 'topology.rootProject': 'Projet racine', 'topology.removeRegistration': 'Retirer l’enregistrement', 'topology.removeProjectConfirm': 'Retirer cet enregistrement sans supprimer de fichiers ?', 'topology.noProjects': 'Aucun répertoire de projet ajouté.',
    'root.shared': 'Dossier Skill partagé'
  },
  'ko-KR': {
    'app.loading': '스킬 라이브러리를 검색하는 중…',
    'app.title': 'SooKool 에이전트 도우미',
    'app.subtitle': '에이전트 도우미',
    'nav.local': '라이브러리',
    'nav.market': '마켓',
    'nav.skillSettings': 'Skill 설정',
    'nav.settings': '설정',
    'sidebar.expand': '사이드바 펼치기',
    'sidebar.collapse': '사이드바 접기',
    'settings.title': '설정',
    'settings.description': '앱 모양, 언어 및 리소스 사용량을 관리합니다.',
    'settings.skill.title': 'Skill 설정',
    'settings.skill.description': 'Skill 디렉터리와 삭제된 백업을 관리합니다.',
    'settings.addSkillRoot': '스킬 디렉터리 추가',
    'settings.tabs.general': '일반',
    'settings.tabs.resources': '리소스',
    'settings.tabs.directories': '스킬 디렉터리',
    'settings.tabs.backups': '백업',
    'settings.general.title': '일반 설정',
    'settings.general.description': '모양, 언어 및 시작 동작을 조정합니다.',
    'settings.appearance': '모양',
    'settings.theme.system': '시스템',
    'settings.theme.light': '라이트',
    'settings.theme.dark': '다크',
    'settings.language': '언어',
    'settings.language.system': '시스템 설정 따르기',
    'settings.autoScan': '시작할 때 검색',
    'settings.autoScan.description': '앱을 열 때 로컬 Skill 및 디렉터리 상태를 새로 고칩니다.',
    'settings.resources.title': '리소스 사용량',
    'settings.resources.refresh': '리소스 정보 새로 고침',
    'settings.directories.title': '스킬 디렉터리',
    'settings.backups.title': '삭제된 백업',
    'settings.backups.empty': '백업이 없습니다',
    'settings.metrics.detectedRoots': '감지된 디렉터리',
    'settings.metrics.customRoots': '사용자 디렉터리',
    'settings.metrics.backups': '삭제된 백업',
    'settings.metrics.skills': '전체 Skill',
    'settings.status.on': '켜짐',
    'settings.status.off': '꺼짐',
    'skills.title': '라이브러리',
    'skills.count': 'Skill {count}개',
    'skills.refresh': '다시 검색',
    'skills.search': '이름, 설명 또는 경로 검색',
    'skills.metric.all': '전체',
    'skills.metric.apps': '앱',
    'skills.status.all': '모든 상태',
    'skills.status.issues': '문제만',
    'skills.root.all': '모든 소스',
    'skills.detail.empty': 'Skill 선택',
    'skills.noMatches': '일치하는 Skill이 없습니다',
    'skills.validated': '검증됨',
    'skills.modified': '업데이트됨',
    'skills.reveal': 'Finder에서 보기',
    'skills.copyPath': '스킬 디렉터리 경로 복사',
    'skills.apply.title': '스킬 전송',
    'skills.apply.heading': '다른 앱으로 전송',
    'skills.apply.description': '이 Skill을 받을 앱을 선택하세요.',
    'skills.apply.selected': '앱 {count}개 선택됨',
    'skills.apply.close': '닫기',
    'skills.apply.add': '선택한 앱으로 전송',
    'skills.apply.remove': '선택한 앱에서 제거',
    'discovery.quickScan': '빠른 스캔', 'discovery.deepScan': '정밀 스캔', 'discovery.cancel': '스캔 중지',
    'discovery.scanning': '프로젝트 검색 중', 'discovery.ready': '프로젝트 색인 준비됨', 'discovery.found': '프로젝트 {count}개 발견',
    'discovery.checked': '디렉터리 {count}개 확인', 'discovery.lastScan': '마지막 스캔: {time}',
    'discovery.scanLocations': '추가 스캔 위치', 'discovery.scanLocationsDescription': '개발 폴더, 외장 드라이브 또는 기타 프로젝트 위치를 추가합니다.',
    'discovery.addLocation': '위치 추가', 'discovery.removeLocation': '스캔 위치 제거',
    'discovery.ignoreProject': '발견된 프로젝트 무시', 'discovery.ignoreProjectConfirm': '향후 스캔에서 이 프로젝트를 무시할까요?',
    'command.done': '완료',
    'command.failed': '실패',
    'market.title': '스킬 마켓',
    'market.importLocal': '로컬 스킬 가져오기',
    'market.addSource': '소스 추가',
    'market.searchMarket': '마켓 검색',
    'market.search': '검색',
    'market.refresh': '소스 새로 고침',
    'market.install': '설치',
    'market.reinstall': '다시 설치',
    'market.installed': '설치됨',
    'market.removeSource': '마켓 소스 삭제',
    'skills.scope.system': '시스템 Skill', 'skills.scope.project': '프로젝트 Skill', 'skills.tree.systemDirectory': '앱 시스템 디렉터리', 'skills.tree.projectDirectory': '프로젝트 디렉터리', 'skills.tree.application': '앱',
    'topology.applicationRules': '앱 규칙', 'topology.projectDirectories': '프로젝트 디렉터리', 'topology.byApplication': '앱별', 'topology.byProject': '프로젝트별', 'topology.addApplicationRule': '앱 규칙 추가', 'topology.addProjectDirectory': '프로젝트 디렉터리 추가',
    'topology.applicationDescription': '각 앱의 시스템 Skill 디렉터리와 프로젝트 상대 경로를 정의합니다.', 'topology.applicationName': '앱 이름', 'topology.systemSkillPath': '시스템 Skill 디렉터리(예: ~/.my-agent/skills)', 'topology.projectSkillPath': '프로젝트 상대 Skill 경로(예: .my-agent/skills)',
    'topology.cancel': '취소', 'topology.saveRule': '규칙 저장', 'topology.systemDirectory': '시스템 디렉터리', 'topology.projectPath': '프로젝트 경로', 'topology.builtin': '기본 규칙', 'topology.removeRule': '규칙 삭제', 'topology.unclassified': '분류되지 않은 디렉터리',
    'topology.projectDescription': '프로젝트 루트를 등록하면 앱 규칙이 프로젝트 Skill을 찾습니다.', 'topology.nestedProject': '중첩 프로젝트', 'topology.rootProject': '루트 프로젝트', 'topology.removeRegistration': '등록 해제', 'topology.removeProjectConfirm': '파일을 삭제하지 않고 등록만 해제할까요?', 'topology.noProjects': '추가된 프로젝트 디렉터리가 없습니다.',
    'root.shared': '공유 Skill 디렉터리'
  },
  'es-ES': {
    'app.loading': 'Analizando la biblioteca de habilidades…',
    'app.title': 'Asistente de agentes SooKool',
    'app.subtitle': 'Asistente de agentes',
    'nav.local': 'Biblioteca',
    'nav.market': 'Mercado',
    'nav.skillSettings': 'Ajustes de Skill',
    'nav.settings': 'Ajustes',
    'sidebar.expand': 'Expandir barra lateral',
    'sidebar.collapse': 'Contraer barra lateral',
    'settings.title': 'Ajustes',
    'settings.description': 'Gestiona la apariencia, el idioma y los recursos de la aplicación.',
    'settings.skill.title': 'Ajustes de Skill',
    'settings.skill.description': 'Gestiona directorios Skill y copias eliminadas.',
    'settings.addSkillRoot': 'Añadir directorio de habilidades',
    'settings.tabs.general': 'General',
    'settings.tabs.resources': 'Recursos',
    'settings.tabs.directories': 'Directorios de habilidades',
    'settings.tabs.backups': 'Copias de seguridad',
    'settings.general.title': 'Ajustes generales',
    'settings.general.description': 'Ajusta la apariencia, el idioma y el comportamiento de inicio.',
    'settings.appearance': 'Apariencia',
    'settings.theme.system': 'Sistema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'settings.language': 'Idioma',
    'settings.language.system': 'Seguir el sistema',
    'settings.autoScan': 'Analizar al iniciar',
    'settings.autoScan.description': 'Actualiza las Skill locales y los directorios al abrir la aplicación.',
    'settings.resources.title': 'Uso de recursos',
    'settings.resources.refresh': 'Actualizar recursos',
    'settings.directories.title': 'Directorios de habilidades',
    'settings.backups.title': 'Copias eliminadas',
    'settings.backups.empty': 'Aún no hay copias',
    'settings.metrics.detectedRoots': 'Directorios detectados',
    'settings.metrics.customRoots': 'Directorios personalizados',
    'settings.metrics.backups': 'Copias eliminadas',
    'settings.metrics.skills': 'Todas las Skill',
    'settings.status.on': 'Activado',
    'settings.status.off': 'Desactivado',
    'skills.title': 'Biblioteca',
    'skills.count': '{count} Skill',
    'skills.refresh': 'Volver a analizar',
    'skills.search': 'Buscar por nombre, descripción o ruta',
    'skills.metric.all': 'Todas',
    'skills.metric.apps': 'Aplicaciones',
    'skills.status.all': 'Todos los estados',
    'skills.status.issues': 'Solo problemas',
    'skills.root.all': 'Todas las fuentes',
    'skills.detail.empty': 'Selecciona una Skill',
    'skills.noMatches': 'No hay Skill coincidentes',
    'skills.validated': 'Validada',
    'skills.modified': 'Actualizada',
    'skills.reveal': 'Mostrar en Finder',
    'skills.copyPath': 'Copiar ruta del directorio',
    'skills.apply.title': 'Transferir Skill',
    'skills.apply.heading': 'Transferir a otras aplicaciones',
    'skills.apply.description': 'Elige las aplicaciones que recibirán esta Skill.',
    'skills.apply.selected': '{count} aplicaciones seleccionadas',
    'skills.apply.close': 'Cerrar',
    'skills.apply.add': 'Transferir a las aplicaciones seleccionadas',
    'skills.apply.remove': 'Eliminar de las aplicaciones seleccionadas',
    'discovery.quickScan': 'Análisis rápido', 'discovery.deepScan': 'Análisis profundo', 'discovery.cancel': 'Detener análisis',
    'discovery.scanning': 'Buscando proyectos', 'discovery.ready': 'Índice de proyectos listo', 'discovery.found': '{count} proyectos encontrados',
    'discovery.checked': '{count} directorios revisados', 'discovery.lastScan': 'Último análisis: {time}',
    'discovery.scanLocations': 'Ubicaciones adicionales', 'discovery.scanLocationsDescription': 'Añade carpetas de desarrollo, discos externos u otras ubicaciones.',
    'discovery.addLocation': 'Añadir ubicación', 'discovery.removeLocation': 'Quitar ubicación',
    'discovery.ignoreProject': 'Ignorar proyecto detectado', 'discovery.ignoreProjectConfirm': '¿Ignorar este proyecto en futuros análisis?',
    'command.done': 'Completado',
    'command.failed': 'Error',
    'market.title': 'Mercado de habilidades',
    'market.importLocal': 'Importar habilidad local',
    'market.addSource': 'Añadir fuente',
    'market.searchMarket': 'Buscar en el mercado',
    'market.search': 'Buscar',
    'market.refresh': 'Actualizar fuente',
    'market.install': 'Instalar',
    'market.reinstall': 'Reinstalar',
    'market.installed': 'Instalada',
    'market.removeSource': 'Eliminar fuente',
    'skills.scope.system': 'Skills del sistema', 'skills.scope.project': 'Skills del proyecto', 'skills.tree.systemDirectory': 'Directorio del sistema de la aplicación', 'skills.tree.projectDirectory': 'Directorio del proyecto', 'skills.tree.application': 'Aplicación',
    'topology.applicationRules': 'Reglas de aplicación', 'topology.projectDirectories': 'Directorios de proyecto', 'topology.byApplication': 'Por aplicación', 'topology.byProject': 'Por proyecto', 'topology.addApplicationRule': 'Añadir regla de aplicación', 'topology.addProjectDirectory': 'Añadir directorio de proyecto',
    'topology.applicationDescription': 'Define los directorios de Skills del sistema y las rutas relativas al proyecto para cada aplicación.', 'topology.applicationName': 'Nombre de la aplicación', 'topology.systemSkillPath': 'Directorio de Skills del sistema, p. ej. ~/.my-agent/skills', 'topology.projectSkillPath': 'Ruta de Skills relativa al proyecto, p. ej. .my-agent/skills',
    'topology.cancel': 'Cancelar', 'topology.saveRule': 'Guardar regla', 'topology.systemDirectory': 'Directorio del sistema', 'topology.projectPath': 'Ruta del proyecto', 'topology.builtin': 'Integrada', 'topology.removeRule': 'Eliminar regla', 'topology.unclassified': 'Directorio sin clasificar',
    'topology.projectDescription': 'Registra las raíces de proyecto para que las reglas de aplicación resuelvan sus Skills de proyecto.', 'topology.nestedProject': 'Proyecto anidado', 'topology.rootProject': 'Proyecto raíz', 'topology.removeRegistration': 'Quitar registro', 'topology.removeProjectConfirm': '¿Quitar este registro sin eliminar ningún archivo?', 'topology.noProjects': 'Aún no se han añadido directorios de proyecto.',
    'root.shared': 'Directorio Skill compartido'
  },
  'pt-BR': {
    'app.loading': 'Verificando a biblioteca de habilidades…',
    'app.title': 'Assistente de agentes SooKool',
    'app.subtitle': 'Assistente de agentes',
    'nav.local': 'Biblioteca',
    'nav.market': 'Mercado',
    'nav.skillSettings': 'Configurações de Skill',
    'nav.settings': 'Configurações',
    'sidebar.expand': 'Expandir barra lateral',
    'sidebar.collapse': 'Recolher barra lateral',
    'settings.title': 'Configurações',
    'settings.description': 'Gerencie a aparência, o idioma e os recursos do aplicativo.',
    'settings.skill.title': 'Configurações de Skill',
    'settings.skill.description': 'Gerencie diretórios Skill e backups excluídos.',
    'settings.addSkillRoot': 'Adicionar diretório de habilidades',
    'settings.tabs.general': 'Geral',
    'settings.tabs.resources': 'Recursos',
    'settings.tabs.directories': 'Diretórios de habilidades',
    'settings.tabs.backups': 'Backups',
    'settings.general.title': 'Configurações gerais',
    'settings.general.description': 'Ajuste a aparência, o idioma e o comportamento de inicialização.',
    'settings.appearance': 'Aparência',
    'settings.theme.system': 'Sistema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Escuro',
    'settings.language': 'Idioma',
    'settings.language.system': 'Seguir o sistema',
    'settings.autoScan': 'Verificar ao iniciar',
    'settings.autoScan.description': 'Atualiza Skill locais e diretórios ao abrir o aplicativo.',
    'settings.resources.title': 'Uso de recursos',
    'settings.resources.refresh': 'Atualizar recursos',
    'settings.directories.title': 'Diretórios de habilidades',
    'settings.backups.title': 'Backups excluídos',
    'settings.backups.empty': 'Nenhum backup',
    'settings.metrics.detectedRoots': 'Diretórios detectados',
    'settings.metrics.customRoots': 'Diretórios personalizados',
    'settings.metrics.backups': 'Backups excluídos',
    'settings.metrics.skills': 'Todas as Skill',
    'settings.status.on': 'Ativado',
    'settings.status.off': 'Desativado',
    'skills.title': 'Biblioteca',
    'skills.count': '{count} Skill',
    'skills.refresh': 'Verificar novamente',
    'skills.search': 'Buscar por nome, descrição ou caminho',
    'skills.metric.all': 'Todas',
    'skills.metric.apps': 'Aplicativos',
    'skills.status.all': 'Todos os estados',
    'skills.status.issues': 'Somente problemas',
    'skills.root.all': 'Todas as fontes',
    'skills.detail.empty': 'Selecione uma Skill',
    'skills.noMatches': 'Nenhuma Skill encontrada',
    'skills.validated': 'Validada',
    'skills.modified': 'Atualizada',
    'skills.reveal': 'Mostrar no Finder',
    'skills.copyPath': 'Copiar caminho do diretório',
    'skills.apply.title': 'Transferir Skill',
    'skills.apply.heading': 'Transferir para outros aplicativos',
    'skills.apply.description': 'Escolha os aplicativos que receberão esta Skill.',
    'skills.apply.selected': '{count} aplicativos selecionados',
    'skills.apply.close': 'Fechar',
    'skills.apply.add': 'Transferir para os aplicativos selecionados',
    'skills.apply.remove': 'Remover dos aplicativos selecionados',
    'discovery.quickScan': 'Varredura rápida', 'discovery.deepScan': 'Varredura profunda', 'discovery.cancel': 'Parar varredura',
    'discovery.scanning': 'Localizando projetos', 'discovery.ready': 'Índice de projetos pronto', 'discovery.found': '{count} projetos encontrados',
    'discovery.checked': '{count} diretórios verificados', 'discovery.lastScan': 'Última varredura: {time}',
    'discovery.scanLocations': 'Locais adicionais', 'discovery.scanLocationsDescription': 'Adicione pastas de desenvolvimento, unidades externas ou outros locais.',
    'discovery.addLocation': 'Adicionar local', 'discovery.removeLocation': 'Remover local',
    'discovery.ignoreProject': 'Ignorar projeto encontrado', 'discovery.ignoreProjectConfirm': 'Ignorar este projeto em futuras varreduras?',
    'command.done': 'Concluído',
    'command.failed': 'Falhou',
    'market.title': 'Mercado de habilidades',
    'market.importLocal': 'Importar habilidade local',
    'market.addSource': 'Adicionar fonte',
    'market.searchMarket': 'Buscar no mercado',
    'market.search': 'Buscar',
    'market.refresh': 'Atualizar fonte',
    'market.install': 'Instalar',
    'market.reinstall': 'Reinstalar',
    'market.installed': 'Instalada',
    'market.removeSource': 'Excluir fonte',
    'skills.scope.system': 'Skills do sistema', 'skills.scope.project': 'Skills do projeto', 'skills.tree.systemDirectory': 'Diretório do sistema do aplicativo', 'skills.tree.projectDirectory': 'Diretório do projeto', 'skills.tree.application': 'Aplicativo',
    'topology.applicationRules': 'Regras de aplicativo', 'topology.projectDirectories': 'Diretórios de projeto', 'topology.byApplication': 'Por aplicativo', 'topology.byProject': 'Por projeto', 'topology.addApplicationRule': 'Adicionar regra de aplicativo', 'topology.addProjectDirectory': 'Adicionar diretório de projeto',
    'topology.applicationDescription': 'Defina os diretórios de Skills do sistema e os caminhos relativos ao projeto para cada aplicativo.', 'topology.applicationName': 'Nome do aplicativo', 'topology.systemSkillPath': 'Diretório de Skills do sistema, ex.: ~/.my-agent/skills', 'topology.projectSkillPath': 'Caminho de Skills relativo ao projeto, ex.: .my-agent/skills',
    'topology.cancel': 'Cancelar', 'topology.saveRule': 'Salvar regra', 'topology.systemDirectory': 'Diretório do sistema', 'topology.projectPath': 'Caminho do projeto', 'topology.builtin': 'Integrada', 'topology.removeRule': 'Remover regra', 'topology.unclassified': 'Diretório não classificado',
    'topology.projectDescription': 'Registre as raízes de projeto para que as regras do aplicativo resolvam as Skills do projeto.', 'topology.nestedProject': 'Projeto aninhado', 'topology.rootProject': 'Projeto raiz', 'topology.removeRegistration': 'Remover registro', 'topology.removeProjectConfirm': 'Remover este registro sem excluir arquivos?', 'topology.noProjects': 'Nenhum diretório de projeto foi adicionado.',
    'root.shared': 'Diretório Skill compartilhado'
  },
  ar: {
    'app.loading': 'جارٍ فحص مكتبة المهارات…',
    'app.title': 'مساعد الوكلاء SooKool',
    'app.subtitle': 'مساعد الوكلاء',
    'nav.local': 'المكتبة',
    'nav.market': 'السوق',
    'nav.skillSettings': 'إعدادات Skill',
    'nav.settings': 'الإعدادات',
    'sidebar.expand': 'توسيع الشريط الجانبي',
    'sidebar.collapse': 'طي الشريط الجانبي',
    'settings.title': 'الإعدادات',
    'settings.description': 'إدارة مظهر التطبيق واللغة واستخدام الموارد.',
    'settings.skill.title': 'إعدادات Skill',
    'settings.skill.description': 'إدارة مجلدات Skill والنسخ المحذوفة.',
    'settings.addSkillRoot': 'إضافة مجلد مهارات',
    'settings.tabs.general': 'عام',
    'settings.tabs.resources': 'الموارد',
    'settings.tabs.directories': 'مجلدات المهارات',
    'settings.tabs.backups': 'النسخ الاحتياطية',
    'settings.general.title': 'الإعدادات العامة',
    'settings.general.description': 'ضبط المظهر واللغة وسلوك بدء التشغيل.',
    'settings.appearance': 'المظهر',
    'settings.theme.system': 'النظام',
    'settings.theme.light': 'فاتح',
    'settings.theme.dark': 'داكن',
    'settings.language': 'اللغة',
    'settings.language.system': 'اتباع النظام',
    'settings.autoScan': 'الفحص عند التشغيل',
    'settings.autoScan.description': 'تحديث Skill المحلية وحالة المجلدات عند فتح التطبيق.',
    'settings.resources.title': 'استخدام الموارد',
    'settings.resources.refresh': 'تحديث معلومات الموارد',
    'settings.directories.title': 'مجلدات المهارات',
    'settings.backups.title': 'النسخ المحذوفة',
    'settings.backups.empty': 'لا توجد نسخ احتياطية',
    'settings.metrics.detectedRoots': 'المجلدات المكتشفة',
    'settings.metrics.customRoots': 'المجلدات المخصصة',
    'settings.metrics.backups': 'النسخ المحذوفة',
    'settings.metrics.skills': 'كل Skill',
    'settings.status.on': 'تشغيل',
    'settings.status.off': 'إيقاف',
    'skills.title': 'المكتبة',
    'skills.count': '{count} Skill',
    'skills.refresh': 'إعادة الفحص',
    'skills.search': 'البحث بالاسم أو الوصف أو المسار',
    'skills.metric.all': 'الكل',
    'skills.metric.apps': 'التطبيقات',
    'skills.status.all': 'كل الحالات',
    'skills.status.issues': 'المشكلات فقط',
    'skills.root.all': 'كل المصادر',
    'skills.detail.empty': 'اختر Skill',
    'skills.noMatches': 'لا توجد Skill مطابقة',
    'skills.validated': 'تم التحقق',
    'skills.modified': 'آخر تحديث',
    'skills.reveal': 'إظهار في Finder',
    'skills.copyPath': 'نسخ مسار مجلد المهارة',
    'skills.apply.title': 'نقل Skill',
    'skills.apply.heading': 'النقل إلى تطبيقات أخرى',
    'skills.apply.description': 'اختر التطبيقات التي ستستلم هذه Skill.',
    'skills.apply.selected': 'تم تحديد {count} من التطبيقات',
    'skills.apply.close': 'إغلاق',
    'skills.apply.add': 'النقل إلى التطبيقات المحددة',
    'skills.apply.remove': 'الإزالة من التطبيقات المحددة',
    'discovery.quickScan': 'فحص سريع', 'discovery.deepScan': 'فحص شامل', 'discovery.cancel': 'إيقاف الفحص',
    'discovery.scanning': 'جارٍ اكتشاف المشاريع', 'discovery.ready': 'فهرس المشاريع جاهز', 'discovery.found': 'تم العثور على {count} مشروع',
    'discovery.checked': 'تم فحص {count} مجلد', 'discovery.lastScan': 'آخر فحص: {time}',
    'discovery.scanLocations': 'مواقع فحص إضافية', 'discovery.scanLocationsDescription': 'أضف مجلدات التطوير أو الأقراص الخارجية أو مواقع المشاريع الأخرى.',
    'discovery.addLocation': 'إضافة موقع', 'discovery.removeLocation': 'إزالة موقع الفحص',
    'discovery.ignoreProject': 'تجاهل المشروع المكتشف', 'discovery.ignoreProjectConfirm': 'هل تريد تجاهل هذا المشروع في عمليات الفحص القادمة؟',
    'command.done': 'اكتمل',
    'command.failed': 'فشل',
    'market.title': 'سوق المهارات',
    'market.importLocal': 'استيراد مهارة محلية',
    'market.addSource': 'إضافة مصدر',
    'market.searchMarket': 'البحث في السوق',
    'market.search': 'بحث',
    'market.refresh': 'تحديث المصدر',
    'market.install': 'تثبيت',
    'market.reinstall': 'إعادة التثبيت',
    'market.installed': 'مثبّتة',
    'market.removeSource': 'حذف مصدر السوق',
    'skills.scope.system': 'مهارات النظام', 'skills.scope.project': 'مهارات المشروع', 'skills.tree.systemDirectory': 'مجلد نظام التطبيق', 'skills.tree.projectDirectory': 'مجلد المشروع', 'skills.tree.application': 'التطبيق',
    'topology.applicationRules': 'قواعد التطبيق', 'topology.projectDirectories': 'مجلدات المشروع', 'topology.byApplication': 'حسب التطبيق', 'topology.byProject': 'حسب المشروع', 'topology.addApplicationRule': 'إضافة قاعدة تطبيق', 'topology.addProjectDirectory': 'إضافة مجلد مشروع',
    'topology.applicationDescription': 'حدّد مجلدات مهارات النظام ومسارات المهارات النسبية للمشروع لكل تطبيق.', 'topology.applicationName': 'اسم التطبيق', 'topology.systemSkillPath': 'مجلد مهارات النظام، مثال: ~/.my-agent/skills', 'topology.projectSkillPath': 'مسار مهارات نسبي للمشروع، مثال: .my-agent/skills',
    'topology.cancel': 'إلغاء', 'topology.saveRule': 'حفظ القاعدة', 'topology.systemDirectory': 'مجلد النظام', 'topology.projectPath': 'مسار المشروع', 'topology.builtin': 'مدمجة', 'topology.removeRule': 'حذف القاعدة', 'topology.unclassified': 'مجلد غير مصنف',
    'topology.projectDescription': 'سجّل جذور المشروع لكي تتمكن قواعد التطبيق من تحديد مهارات المشروع.', 'topology.nestedProject': 'مشروع متداخل', 'topology.rootProject': 'المشروع الجذر', 'topology.removeRegistration': 'إزالة التسجيل', 'topology.removeProjectConfirm': 'هل تريد إزالة هذا التسجيل دون حذف أي ملفات؟', 'topology.noProjects': 'لم تتم إضافة مجلدات مشروع بعد.',
    'root.shared': 'مجلد Skill مشترك'
  }
}

export function translate(
  language: AppLanguagePreference,
  key: TranslationKey,
  replacements: Replacements = {}
): string {
  const template = translations[resolveAppLanguage(language)][key] || translations['en-US'][key] || key
  return Object.entries(replacements).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    template
  )
}

export function resolveAppLanguage(language: AppLanguagePreference, systemLocale?: string): AppLanguage {
  if (language !== 'system') return language
  const locale = (systemLocale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')).toLowerCase()
  if (locale.startsWith('zh-tw') || locale.startsWith('zh-hk') || locale.startsWith('zh-hant')) return 'zh-TW'
  if (locale.startsWith('zh')) return 'zh-CN'
  if (locale.startsWith('ja')) return 'ja-JP'
  if (locale.startsWith('fr')) return 'fr-FR'
  if (locale.startsWith('ko')) return 'ko-KR'
  if (locale.startsWith('es')) return 'es-ES'
  if (locale.startsWith('pt')) return 'pt-BR'
  if (locale.startsWith('ar')) return 'ar'
  return 'en-US'
}
