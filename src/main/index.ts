import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  nativeTheme,
  session,
  shell
} from 'electron'
import { join, resolve, sep } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import {
  resolveAppLanguage,
  SettingsStore,
  type AppLanguagePreference
} from './settings/settings-store'
import { SkillMarketManager } from './skills/skill-market'
import { SkillManager } from './skills/skill-manager'
import { installApplicationMenu } from './app-menu'
import { getAppDisplayName } from './app-localization'
import { ResourceManager } from './resources/resource-manager'
import { focusExistingWindow } from './window-lifecycle'
import { LocalShareManager } from './local-share/local-share-manager'
import electronUpdater from 'electron-updater'
import { UpdateManager } from './update/update-manager'

let skillManager: SkillManager
let skillMarketManager: SkillMarketManager
let resourceManager: ResourceManager
let localShareManager: LocalShareManager
let updateManager: UpdateManager | null = null

const appUserDataPath = app.getPath('userData')
const settingsStore = new SettingsStore(join(appUserDataPath, 'settings.json'))
const initialLanguage = resolveAppLanguage(
  settingsStore.getAppPreferences().language,
  app.getLocale()
)
app.setName(getAppDisplayName(initialLanguage))

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()

app.on('second-instance', () => {
  focusExistingWindow(BrowserWindow.getAllWindows())
})

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
  installApplicationMenu(language, {
    checkForUpdates: () => void updateManager?.checkForUpdates()
  })
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
    title: getAppDisplayName(
      resolveAppLanguage(settingsStore.getAppPreferences().language, app.getLocale())
    ),
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
  ipcMain.handle(
    'skillCatalog:get',
    async (_event, options?: { refresh?: boolean; mode?: 'quick' | 'deep' }) =>
      options?.refresh
        ? skillManager.refreshCatalogSnapshot(options.mode)
        : skillManager.getCatalogSnapshot()
  )
  ipcMain.handle('projectDiscovery:cancel', async () => skillManager.cancelProjectDiscovery())
  ipcMain.handle('projectScanRoot:list', async () => settingsStore.getProjectScanRoots())
  ipcMain.handle('projectScanRoot:add', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '添加项目扫描位置'
    })
    if (result.canceled || !result.filePaths[0]) return settingsStore.getProjectScanRoots()
    const roots = [...settingsStore.getProjectScanRoots(), result.filePaths[0]]
    settingsStore.saveProjectScanRoots(roots)
    return settingsStore.getProjectScanRoots()
  })
  ipcMain.handle('projectScanRoot:remove', async (_event, path: string) => {
    settingsStore.saveProjectScanRoots(
      settingsStore.getProjectScanRoots().filter((root) => root !== path)
    )
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
  ipcMain.handle('project:remove', async (_event, id: string) => skillManager.removeProject(id))

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
  ipcMain.handle('localShare:getState', async () => localShareManager.getState())
  ipcMain.handle('localShare:enable', async (_event, durationMs?: number) =>
    localShareManager.enable(durationMs)
  )
  ipcMain.handle('localShare:disable', async () => localShareManager.disable())
  ipcMain.handle('localShare:addManualDevice', async (_event, input) =>
    localShareManager.addManualDevice(input.address, input.port)
  )
  ipcMain.handle('localShare:forgetTrustedDevice', async (_event, deviceId: string) =>
    localShareManager.forgetTrustedDevice(deviceId)
  )
  ipcMain.handle('localShare:respond', async (_event, input) =>
    localShareManager.respondToRequest(input.requestId, input.decision)
  )
  ipcMain.handle('localShare:send', async (_event, input) => {
    const skill = skillManager.readSkill(input.skillPath)
    return localShareManager.sendSkill(input.deviceId, skill.path, input.parentHash ?? null)
  })
  ipcMain.handle('localShare:inspectInbox', async (_event, input) => {
    const target = resolveLocalShareTarget(input.rootId, input.skillName)
    return localShareManager.inspectInbox(input.itemId, target)
  })
  ipcMain.handle('localShare:applyInbox', async (_event, input) => {
    const target = resolveLocalShareTarget(input.rootId, input.targetName || input.skillName)
    const state = localShareManager.applyInbox(input.itemId, target)
    await skillManager.refreshCatalogSnapshot('quick')
    return state
  })
  ipcMain.handle('localShare:restore', async (_event, eventId: string) => {
    const state = localShareManager.restoreHistoryToRecordedTarget(eventId)
    await skillManager.refreshCatalogSnapshot('quick')
    return state
  })
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
  ipcMain.handle('market:listCachedSkills', async (_event, input) =>
    skillMarketManager.listCachedSkills(input)
  )
  ipcMain.handle('market:listCachedSkillsBatch', async (_event, input) =>
    skillMarketManager.listCachedSkillsBatch(input)
  )
  ipcMain.handle('market:searchPublic', async (_event, input) =>
    skillMarketManager.searchPublic(input)
  )
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
    const previousPreferences = settingsStore.getAppPreferences()
    const preferences = settingsStore.saveAppPreferences(input)
    applyAppLanguage(preferences.language)
    if (preferences.automaticUpdateChecks !== previousPreferences.automaticUpdateChecks) {
      updateManager?.setAutomaticChecks(preferences.automaticUpdateChecks)
    }
    return preferences
  })
  ipcMain.handle('update:getState', async () => updateManager?.getState())
  ipcMain.handle('update:check', async () => updateManager?.checkForUpdates())
  ipcMain.handle('update:install', async () => updateManager?.installDownloadedUpdate() ?? false)
  ipcMain.handle('app:metrics', async () => {
    const memory = process.memoryUsage()
    const processes = app.getAppMetrics().map((metric) => ({
      pid: metric.pid,
      type: metric.type,
      name: metric.name,
      cpuPercent: metric.cpu.percentCPUUsage,
      idleWakeupsPerSecond: metric.cpu.idleWakeupsPerSecond,
      memory: metric.memory
        ? {
            workingSet: metric.memory.workingSetSize * 1024,
            peakWorkingSet: metric.memory.peakWorkingSetSize * 1024,
            privateBytes: (metric.memory.privateBytes ?? 0) * 1024
          }
        : null
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

function resolveLocalShareTarget(rootId: string, rawName: string): string {
  const root = skillManager.getSkillRoots().find((candidate) => candidate.id === rootId)
  if (!root || root.readonly) throw new Error('请选择可写入的技能空间。')
  const name = rawName
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/^\.+$/, '')
  if (!name || name === '.' || name === '..') throw new Error('Skill 名称无效。')
  const target = resolve(root.path, name)
  const rootPath = resolve(root.path)
  if (target !== rootPath && !target.startsWith(`${rootPath}${sep}`))
    throw new Error('目标路径越出了技能空间。')
  return target
}

if (hasSingleInstanceLock)
  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.sookool.agenthelper')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    applyAppLanguage(settingsStore.getAppPreferences().language)
    skillManager = new SkillManager(settingsStore, () => {
      const catalog = skillManager.getCatalogSnapshot()
      BrowserWindow.getAllWindows().forEach((window) =>
        window.webContents.send('skillCatalog:changed', catalog)
      )
    })
    skillMarketManager = new SkillMarketManager(
      settingsStore,
      skillManager,
      join(appUserDataPath, 'market-cache'),
      join(app.getAppPath(), 'node_modules/skills/bin/cli.mjs')
    )
    localShareManager = new LocalShareManager({
      rootPath: join(appUserDataPath, 'local-share'),
      onChange: (state) =>
        BrowserWindow.getAllWindows().forEach((window) =>
          window.webContents.send('localShare:changed', state)
        )
    })
    resourceManager = new ResourceManager({
      userDataPath: appUserDataPath,
      logsPath: app.getPath('logs'),
      clearBrowserCache: () => session.defaultSession.clearCache()
    })
    const { autoUpdater } = electronUpdater
    updateManager = new UpdateManager({
      updater: autoUpdater,
      enabled: app.isPackaged && (process.platform === 'darwin' || process.platform === 'win32'),
      automaticChecks: settingsStore.getAppPreferences().automaticUpdateChecks,
      currentVersion: app.getVersion(),
      onStateChanged: (state) =>
        BrowserWindow.getAllWindows().forEach((window) => {
          if (!window.isDestroyed()) window.webContents.send('update:stateChanged', state)
        })
    })
    registerIpc()
    nativeTheme.on('updated', updateDockIcon)
    createWindow()
    updateManager.start()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  updateManager?.dispose()
  localShareManager?.dispose()
  skillManager?.dispose()
})
