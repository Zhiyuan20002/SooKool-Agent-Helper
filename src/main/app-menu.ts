import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import type { AppLanguage } from './settings/settings-store'

type AppView = 'local' | 'market' | 'settings'

interface MenuLabels {
  about: string
  app: string
  close: string
  copy: string
  cut: string
  edit: string
  file: string
  forceReload: string
  help: string
  hide: string
  hideOthers: string
  local: string
  market: string
  minimize: string
  paste: string
  quit: string
  redo: string
  reload: string
  selectAll: string
  services: string
  settings: string
  showAll: string
  toggleDevTools: string
  undo: string
  view: string
  window: string
  zoom: string
  zoomIn: string
  zoomOut: string
  zoomReset: string
}

const labels: Record<AppLanguage, MenuLabels> = {
  'zh-CN': {
    app: 'SooKool 智能体助手',
    about: '关于 SooKool 智能体助手',
    services: '服务',
    hide: '隐藏 SooKool 智能体助手',
    hideOthers: '隐藏其他应用',
    showAll: '全部显示',
    quit: '退出 SooKool 智能体助手',
    file: '文件',
    local: '技能库',
    market: '技能市场',
    settings: '设置…',
    close: '关闭窗口',
    edit: '编辑',
    undo: '撤销',
    redo: '重做',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    selectAll: '全选',
    view: '显示',
    reload: '重新载入界面',
    forceReload: '强制重新载入',
    toggleDevTools: '开发者工具',
    zoomReset: '实际大小',
    zoomIn: '放大',
    zoomOut: '缩小',
    window: '窗口',
    minimize: '最小化',
    zoom: '缩放',
    help: '帮助'
  },
  'en-US': {
    app: 'SooKool Agent Helper',
    about: 'About SooKool Agent Helper',
    services: 'Services',
    hide: 'Hide SooKool Agent Helper',
    hideOthers: 'Hide Others',
    showAll: 'Show All',
    quit: 'Quit SooKool Agent Helper',
    file: 'File',
    local: 'Skill Library',
    market: 'Skill Market',
    settings: 'Settings…',
    close: 'Close Window',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    reload: 'Reload Interface',
    forceReload: 'Force Reload',
    toggleDevTools: 'Developer Tools',
    zoom: 'Zoom',
    zoomReset: 'Actual Size',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    window: 'Window',
    minimize: 'Minimize',
    help: 'Help'
  },
  'zh-HK': {
    app: 'SooKool 智能體助手', about: '關於 SooKool 智能體助手', services: '服務',
    hide: '隱藏 SooKool 智能體助手', hideOthers: '隱藏其他應用程式', showAll: '全部顯示',
    quit: '結束 SooKool 智能體助手', file: '檔案', local: '技能庫', market: '技能市場',
    settings: '設定…', close: '關閉視窗', edit: '編輯', undo: '還原', redo: '重做',
    cut: '剪下', copy: '複製', paste: '貼上', selectAll: '全選', view: '顯示',
    reload: '重新載入介面', forceReload: '強制重新載入', toggleDevTools: '開發者工具',
    zoom: '縮放', zoomReset: '實際大小', zoomIn: '放大', zoomOut: '縮小',
    window: '視窗', minimize: '最小化', help: '幫助'
  },
  'ja-JP': {
    app: 'SooKool エージェントアシスタント', about: 'SooKool エージェントアシスタントについて',
    services: 'サービス', hide: 'SooKool エージェントアシスタントを隠す', hideOthers: 'ほかを隠す',
    showAll: 'すべてを表示', quit: 'SooKool エージェントアシスタントを終了', file: 'ファイル',
    local: 'スキルライブラリ', market: 'スキルマーケット', settings: '設定…', close: 'ウインドウを閉じる',
    edit: '編集', undo: '取り消す', redo: 'やり直す', cut: 'カット', copy: 'コピー', paste: 'ペースト',
    selectAll: 'すべてを選択', view: '表示', reload: 'インターフェイスを再読み込み',
    forceReload: '強制再読み込み', toggleDevTools: 'デベロッパーツール', zoom: 'ズーム',
    zoomReset: '実際のサイズ', zoomIn: '拡大', zoomOut: '縮小', window: 'ウインドウ',
    minimize: 'しまう', help: 'ヘルプ'
  },
  'fr-FR': {
    app: 'Assistant d’agents SooKool', about: 'À propos de l’Assistant d’agents SooKool',
    services: 'Services', hide: 'Masquer l’Assistant d’agents SooKool', hideOthers: 'Masquer les autres',
    showAll: 'Tout afficher', quit: 'Quitter l’Assistant d’agents SooKool', file: 'Fichier',
    local: 'Bibliothèque de compétences', market: 'Marché des compétences', settings: 'Réglages…',
    close: 'Fermer la fenêtre', edit: 'Édition', undo: 'Annuler', redo: 'Rétablir', cut: 'Couper',
    copy: 'Copier', paste: 'Coller', selectAll: 'Tout sélectionner', view: 'Présentation',
    reload: 'Recharger l’interface', forceReload: 'Forcer le rechargement',
    toggleDevTools: 'Outils de développement', zoom: 'Zoom', zoomReset: 'Taille réelle',
    zoomIn: 'Zoom avant', zoomOut: 'Zoom arrière', window: 'Fenêtre', minimize: 'Réduire', help: 'Aide'
  },
  'ko-KR': {
    app: 'SooKool 에이전트 도우미', about: 'SooKool 에이전트 도우미에 관하여', services: '서비스',
    hide: 'SooKool 에이전트 도우미 가리기', hideOthers: '기타 가리기', showAll: '모두 보기',
    quit: 'SooKool 에이전트 도우미 종료', file: '파일', local: '스킬 라이브러리', market: '스킬 마켓',
    settings: '설정…', close: '윈도우 닫기', edit: '편집', undo: '실행 취소', redo: '실행 복귀',
    cut: '오려두기', copy: '복사', paste: '붙여넣기', selectAll: '모두 선택', view: '보기',
    reload: '인터페이스 다시 로드', forceReload: '강제로 다시 로드', toggleDevTools: '개발자 도구',
    zoom: '확대/축소', zoomReset: '실제 크기', zoomIn: '확대', zoomOut: '축소', window: '윈도우',
    minimize: '최소화', help: '도움말'
  },
  'es-ES': {
    app: 'Asistente de agentes SooKool', about: 'Acerca del Asistente de agentes SooKool',
    services: 'Servicios', hide: 'Ocultar el Asistente de agentes SooKool', hideOthers: 'Ocultar otros',
    showAll: 'Mostrar todo', quit: 'Salir del Asistente de agentes SooKool', file: 'Archivo',
    local: 'Biblioteca de habilidades', market: 'Mercado de habilidades', settings: 'Ajustes…',
    close: 'Cerrar ventana', edit: 'Edición', undo: 'Deshacer', redo: 'Rehacer', cut: 'Cortar',
    copy: 'Copiar', paste: 'Pegar', selectAll: 'Seleccionar todo', view: 'Visualización',
    reload: 'Recargar interfaz', forceReload: 'Forzar recarga', toggleDevTools: 'Herramientas de desarrollo',
    zoom: 'Zoom', zoomReset: 'Tamaño real', zoomIn: 'Ampliar', zoomOut: 'Reducir', window: 'Ventana',
    minimize: 'Minimizar', help: 'Ayuda'
  },
  'pt-BR': {
    app: 'Assistente de agentes SooKool', about: 'Sobre o Assistente de agentes SooKool',
    services: 'Serviços', hide: 'Ocultar Assistente de agentes SooKool', hideOthers: 'Ocultar outros',
    showAll: 'Mostrar tudo', quit: 'Sair do Assistente de agentes SooKool', file: 'Arquivo',
    local: 'Biblioteca de habilidades', market: 'Mercado de habilidades', settings: 'Configurações…',
    close: 'Fechar janela', edit: 'Editar', undo: 'Desfazer', redo: 'Refazer', cut: 'Recortar',
    copy: 'Copiar', paste: 'Colar', selectAll: 'Selecionar tudo', view: 'Visualizar',
    reload: 'Recarregar interface', forceReload: 'Forçar recarregamento',
    toggleDevTools: 'Ferramentas de desenvolvimento', zoom: 'Zoom', zoomReset: 'Tamanho real',
    zoomIn: 'Ampliar', zoomOut: 'Reduzir', window: 'Janela', minimize: 'Minimizar', help: 'Ajuda'
  },
  ar: {
    app: 'مساعد الوكلاء SooKool', about: 'حول مساعد الوكلاء SooKool', services: 'الخدمات',
    hide: 'إخفاء مساعد الوكلاء SooKool', hideOthers: 'إخفاء التطبيقات الأخرى', showAll: 'إظهار الكل',
    quit: 'إنهاء مساعد الوكلاء SooKool', file: 'ملف', local: 'مكتبة المهارات', market: 'سوق المهارات',
    settings: 'الإعدادات…', close: 'إغلاق النافذة', edit: 'تحرير', undo: 'تراجع', redo: 'إعادة',
    cut: 'قص', copy: 'نسخ', paste: 'لصق', selectAll: 'تحديد الكل', view: 'عرض',
    reload: 'إعادة تحميل الواجهة', forceReload: 'فرض إعادة التحميل', toggleDevTools: 'أدوات المطور',
    zoom: 'تكبير/تصغير', zoomReset: 'الحجم الفعلي', zoomIn: 'تكبير', zoomOut: 'تصغير',
    window: 'نافذة', minimize: 'تصغير النافذة', help: 'مساعدة'
  }
}

export function getAppDisplayName(language: AppLanguage): string {
  return labels[language].app
}

function navigate(view: AppView): void {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  window?.webContents.send('menu:navigate', view)
}

function navigationItems(text: MenuLabels): MenuItemConstructorOptions[] {
  return [
    { label: text.local, accelerator: 'CmdOrCtrl+1', click: () => navigate('local') },
    { label: text.market, accelerator: 'CmdOrCtrl+2', click: () => navigate('market') },
    { label: text.settings, accelerator: 'CmdOrCtrl+,', click: () => navigate('settings') }
  ]
}

export function installApplicationMenu(language: AppLanguage): void {
  const text = labels[language]
  const template: MenuItemConstructorOptions[] = []

  if (process.platform === 'darwin') {
    template.push({
      label: text.app,
      submenu: [
        { label: text.about, click: () => app.showAboutPanel() },
        { type: 'separator' },
        { label: text.services, role: 'services', submenu: [] },
        { type: 'separator' },
        { label: text.hide, role: 'hide' },
        { label: text.hideOthers, role: 'hideOthers' },
        { label: text.showAll, role: 'unhide' },
        { type: 'separator' },
        { label: text.quit, role: 'quit' }
      ]
    })
  }

  template.push(
    {
      label: text.file,
      submenu: [
        ...navigationItems(text),
        { type: 'separator' },
        process.platform === 'darwin'
          ? { label: text.close, role: 'close' }
          : { label: text.quit, role: 'quit' }
      ]
    },
    {
      label: text.edit,
      submenu: [
        { label: text.undo, role: 'undo' },
        { label: text.redo, role: 'redo' },
        { type: 'separator' },
        { label: text.cut, role: 'cut' },
        { label: text.copy, role: 'copy' },
        { label: text.paste, role: 'paste' },
        { label: text.selectAll, role: 'selectAll' }
      ]
    },
    {
      label: text.view,
      submenu: [
        { label: text.reload, role: 'reload' },
        { label: text.forceReload, role: 'forceReload' },
        ...(process.env.NODE_ENV === 'development'
          ? [{ label: text.toggleDevTools, role: 'toggleDevTools' as const }]
          : []),
        { type: 'separator' },
        {
          label: text.zoom,
          submenu: [
            { label: text.zoomReset, role: 'resetZoom' },
            { label: text.zoomIn, role: 'zoomIn' },
            { label: text.zoomOut, role: 'zoomOut' }
          ]
        }
      ]
    },
    {
      label: text.window,
      submenu: [
        { label: text.minimize, role: 'minimize' },
        { label: text.zoom, role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [
              { type: 'separator' as const },
              { label: text.showAll, role: 'front' as const }
            ]
          : [{ label: text.close, role: 'close' as const }])
      ]
    },
    {
      label: text.help,
      role: 'help',
      submenu:
        process.platform === 'darwin'
          ? []
          : [{ label: text.about, click: () => app.showAboutPanel() }]
    }
  )

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
