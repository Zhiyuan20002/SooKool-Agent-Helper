import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { SettingsStore } from './settings/settings-store'
import { listSkillAgentAdapters, runSkillsCommand } from './skills/ecosystem'
import { SkillMarketManager } from './skills/skill-market'
import { SkillManager } from './skills/skill-manager'

let skillManager: SkillManager
let skillMarketManager: SkillMarketManager
let settingsStore: SettingsStore

function getAppIconPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'sookool-app-icon.png')
  return join(app.getAppPath(), 'resources/sookool-app-icon.png')
}

function createWindow(): void {
  const iconPath = getAppIconPath()
  const icon = nativeImage.createFromPath(iconPath)

  if (process.platform === 'darwin' && !icon.isEmpty()) {
    app.dock?.setIcon(icon)
  }

  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    title: 'SooKool-Agent-Helper',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
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
  ipcMain.handle('backup:list', async () => skillManager.getBackups())
  ipcMain.handle('ecosystem:agents', async () => listSkillAgentAdapters())
  ipcMain.handle('ecosystem:run', async (_event, input) => runSkillsCommand(input))
  ipcMain.handle('market:listSources', async () => skillMarketManager.listSources())
  ipcMain.handle('market:addSource', async (_event, input) => skillMarketManager.addSource(input))
  ipcMain.handle('market:removeSource', async (_event, sourceId: string) =>
    skillMarketManager.removeSource(sourceId)
  )
  ipcMain.handle('market:listSkills', async (_event, input) => skillMarketManager.listSkills(input))
  ipcMain.handle('market:search', async (_event, input) => skillMarketManager.search(input))
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
  ipcMain.handle('settings:update', async (_event, input) =>
    settingsStore.saveAppPreferences(input)
  )
  ipcMain.handle('app:metrics', async () => {
    const memory = process.memoryUsage()
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external
      }
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.sookool.agenthelper')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  settingsStore = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
  skillManager = new SkillManager(settingsStore)
  skillMarketManager = new SkillMarketManager(settingsStore, skillManager)
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
