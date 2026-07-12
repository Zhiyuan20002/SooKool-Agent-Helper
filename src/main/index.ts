import { app, BrowserWindow, dialog, ipcMain, nativeImage, nativeTheme, session, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { resolveAppLanguage, SettingsStore, type AppLanguagePreference } from './settings/settings-store'
import { SkillMarketManager } from './skills/skill-market'
import { SkillManager } from './skills/skill-manager'
import { getAppDisplayName, installApplicationMenu } from './app-menu'
import { ResourceManager } from './resources/resource-manager'

let skillManager: SkillManager
let skillMarketManager: SkillMarketManager
let settingsStore: SettingsStore
let resourceManager: ResourceManager

app.setName('SooKool Agent Helper')

function applyAppLanguage(preference: AppLanguagePreference): void {
  const language = resolveAppLanguage(preference, app.getLocale())
  const displayName = getAppDisplayName(language)
  app.setName(displayName)
  app.setAboutPanelOptions({
    applicationName: displayName,
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()} SooKool`
  })
  BrowserWindow.getAllWindows().forEach((window) => window.setTitle(displayName))
  installApplicationMenu(language)
}

function getAppIconPath(dark = false): string {
  const filename =
    process.platform === 'win32'
      ? 'sookool-app-icon.ico'
      : dark
        ? 'sookool-app-icon-dark.png'
        : 'sookool-app-icon.png'
  if (app.isPackaged) return join(process.resourcesPath, filename)
  return join(app.getAppPath(), 'resources', filename)
}

function updateDockIcon(): void {
  // Packaged apps must use the ICNS embedded in their bundle so macOS can
  // apply its native sizing, caching and Dock presentation. Runtime PNG
  // replacement is only a development fallback for Electron.app.
  if (process.platform !== 'darwin' || app.isPackaged) return
  const icon = nativeImage.createFromPath(getAppIconPath(nativeTheme.shouldUseDarkColors))
  if (!icon.isEmpty()) app.dock?.setIcon(icon)
}

function createWindow(): void {
  const iconPath = getAppIconPath()
  updateDockIcon()

  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: false,
    icon: iconPath,
    title: getAppDisplayName(resolveAppLanguage(settingsStore.getAppPreferences().language, app.getLocale())),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: process.platform === 'darwin' ? '#00000000' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
    visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('skillRoot:list', async () => skillManager.getSkillRoots())
  ipcMain.handle('skillCatalog:get', async (_event, options?: { refresh?: boolean; mode?: 'quick' | 'deep' }) =>
    options?.refresh ? skillManager.refreshCatalogSnapshot(options.mode) : skillManager.getCatalogSnapshot()
  )
  ipcMain.handle('projectDiscovery:cancel', async () => skillManager.cancelProjectDiscovery())
  ipcMain.handle('projectScanRoot:list', async () => settingsStore.getProjectScanRoots())
  ipcMain.handle('projectScanRoot:add', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '添加项目扫描位置' })
    if (result.canceled || !result.filePaths[0]) return settingsStore.getProjectScanRoots()
    const roots = [...settingsStore.getProjectScanRoots(), result.filePaths[0]]
    settingsStore.saveProjectScanRoots(roots)
    return settingsStore.getProjectScanRoots()
  })
  ipcMain.handle('projectScanRoot:remove', async (_event, path: string) => {
    settingsStore.saveProjectScanRoots(settingsStore.getProjectScanRoots().filter((root) => root !== path))
    return settingsStore.getProjectScanRoots()
  })
  ipcMain.handle('applicationRule:save', async (_event, rule) =>
    skillManager.saveApplicationRule(rule)
  )
  ipcMain.handle('applicationRule:remove', async (_event, id: string) =>
    skillManager.removeApplicationRule(id)
  )
  ipcMain.handle('project:add', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '添加项目目录'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    return skillManager.saveProject({
      id: crypto.randomUUID(),
      name: path.split(/[\\/]/).pop() || '未命名项目',
      path
    })
  })
  ipcMain.handle('project:remove', async (_event, id: string) =>
    skillManager.removeProject(id)
  )

  ipcMain.handle('skillRoot:add', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Skill 根目录'
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const roots = skillManager.getSkillRoots()
    const customRoots = roots
      .filter((root) => root.source === 'custom')
      .map(({ id, label, path, readonly }) => ({ id, label, path, readonly }))

    customRoots.push({
      id: crypto.randomUUID(),
      label: result.filePaths[0].split('/').pop() || '自定义目录',
      path: result.filePaths[0],
      readonly: false
    })

    return skillManager.saveCustomRoots(customRoots)
  })

  ipcMain.handle('skillRoot:saveCustom', async (_event, roots) => {
    return skillManager.saveCustomRoots(roots)
  })

  ipcMain.handle('skill:list', async () => skillManager.listSkills())
  ipcMain.handle('skill:read', async (_event, skillPath: string) =>
    skillManager.readSkill(skillPath)
  )
  ipcMain.handle('skill:listFiles', async (_event, skillPath: string) =>
    skillManager.listSkillFiles(skillPath)
  )
  ipcMain.handle('skill:readFile', async (_event, input) => skillManager.readSkillFile(input))
  ipcMain.handle('skill:create', async (_event, input) => skillManager.createSkill(input))
  ipcMain.handle('skill:update', async (_event, input) => skillManager.updateSkill(input))
  ipcMain.handle('skill:delete', async (_event, skillPath: string) =>
    skillManager.deleteSkill(skillPath)
  )
  ipcMain.handle('skill:reveal', async (_event, skillPath: string) =>
    skillManager.revealSkill(skillPath)
  )
  ipcMain.handle('skill:transfer', async (_event, input) => skillManager.transferSkill(input))
  ipcMain.handle('backup:list', async () => skillManager.getBackups())
  ipcMain.handle('ecosystem:agents', async () =>
    skillManager.getCatalogSnapshot().applications.map((application) => ({
      id: application.id,
      name: application.name,
      projectPath: application.projectSkillPaths[0] || '',
      globalPath: application.systemSkillPaths[0] || null,
      installed: true
    }))
  )
  ipcMain.handle('market:listSources', async () => skillMarketManager.listSources())
  ipcMain.handle('market:listCachedSkills', async (_event, input) => skillMarketManager.listCachedSkills(input))
  ipcMain.handle('market:listCachedSkillsBatch', async (_event, input) => skillMarketManager.listCachedSkillsBatch(input))
  ipcMain.handle('market:searchPublic', async (_event, input) => skillMarketManager.searchPublic(input))
  ipcMain.handle('market:addSource', async (_event, input) => skillMarketManager.addSource(input))
  ipcMain.handle('market:removeSource', async (_event, sourceId: string) =>
    skillMarketManager.removeSource(sourceId)
  )
  ipcMain.handle('market:updateSourcePalette', async (_event, input) =>
    skillMarketManager.updateSourcePalette(input.sourceId, input.palette)
  )
  ipcMain.handle('market:listSkills', async (_event, input) => skillMarketManager.listSkills(input))
  ipcMain.handle('market:search', async (_event, input) => skillMarketManager.search(input))
  ipcMain.handle('market:preview', async (_event, input) => skillMarketManager.preview(input))
  ipcMain.handle('market:listInstallTargets', async () => skillMarketManager.listInstallTargets())
  ipcMain.handle('market:lobehubStatus', async () => skillMarketManager.getLobeHubStatus())
  ipcMain.handle('market:registerLobehub', async (_event, input) => skillMarketManager.registerLobeHub(input))
  ipcMain.handle('market:install', async (_event, input) => skillMarketManager.install(input))
  ipcMain.handle('market:importLocal', async (_event, input) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择要导入的 Skill 目录'
    })
    if (result.canceled || result.filePaths.length === 0) return null

    return skillManager.importSkillDirectory({
      ...input,
      sourcePath: result.filePaths[0]
    })
  })
  ipcMain.handle('settings:get', async () => settingsStore.getAppPreferences())
  ipcMain.handle('settings:update', async (_event, input) => {
    const preferences = settingsStore.saveAppPreferences(input)
    applyAppLanguage(preferences.language)
    return preferences
  })
  ipcMain.handle('app:metrics', async () => {
    const memory = process.memoryUsage()
    const processes = app.getAppMetrics().map((metric) => ({
      pid: metric.pid,
      type: metric.type,
      name: metric.name,
      cpuPercent: metric.cpu.percentCPUUsage,
      idleWakeupsPerSecond: metric.cpu.idleWakeupsPerSecond,
      memory: metric.memory ? {
        workingSet: metric.memory.workingSetSize * 1024,
        peakWorkingSet: metric.memory.peakWorkingSetSize * 1024,
        privateBytes: (metric.memory.privateBytes ?? 0) * 1024
      } : null
    }))
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers
      },
      processes,
      storage: await resourceManager.inspect()
    }
  })
  ipcMain.handle('app:clearResource', async (_event, id) => resourceManager.clear(id))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.sookool.agenthelper')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  settingsStore = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
  applyAppLanguage(settingsStore.getAppPreferences().language)
  skillManager = new SkillManager(settingsStore, () => {
    const catalog = skillManager.getCatalogSnapshot()
    BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('skillCatalog:changed', catalog))
  })
  skillMarketManager = new SkillMarketManager(
    settingsStore,
    skillManager,
    join(app.getPath('userData'), 'market-cache')
  )
  resourceManager = new ResourceManager({
    userDataPath: app.getPath('userData'),
    logsPath: app.getPath('logs'),
    clearBrowserCache: () => session.defaultSession.clearCache()
  })
  registerIpc()
  nativeTheme.on('updated', updateDockIcon)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => skillManager?.dispose())
