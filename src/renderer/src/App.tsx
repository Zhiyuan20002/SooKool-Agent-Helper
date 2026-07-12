import React, { useEffect, useState } from 'react'
import { Button, Spinner } from '@heroui/react'
import { BookText, PanelLeftClose, PanelLeftOpen, Settings, Settings2, Store } from 'lucide-react'
import { SkillLibrary } from '@/components/SkillLibrary'
import { resolveAppLanguage, translate } from '@/i18n'
import { useAppStore, type ViewType } from '@/stores/app-store'
import sookoolLogo from './assets/sookool-app-icon-ui.png'
import sookoolLogoDark from './assets/sookool-app-icon-ui-dark.png'
import sookoolWordmark from './assets/sookool-wordmark.png'

const navItems: Array<{
  id: ViewType
  labelKey: Parameters<typeof translate>[1]
  icon: React.ElementType
}> = [
  { id: 'local', labelKey: 'nav.local', icon: BookText },
  { id: 'market', labelKey: 'nav.market', icon: Store },
  { id: 'skill-settings', labelKey: 'nav.skillSettings', icon: Settings2 }
]

export function App(): React.JSX.Element {
  const { initialized, initialize, currentView, setCurrentView, skills, preferences } =
    useAppStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const t = (
    key: Parameters<typeof translate>[1],
    replacements?: Parameters<typeof translate>[2]
  ) => translate(preferences.language, key, replacements)

  useEffect(() => {
    if (!initialized) void initialize()
  }, [initialized, initialize])

  useEffect(() => window.aiHelper.onNavigate(setCurrentView), [setCurrentView])

  useEffect(() => {
    const root = document.documentElement
    if (preferences.themeMode === 'system') root.removeAttribute('data-theme')
    else root.dataset.theme = preferences.themeMode
  }, [preferences.themeMode])

  useEffect(() => {
    const language = resolveAppLanguage(preferences.language)
    document.title = t('app.title')
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [preferences.language])

  if (!initialized) {
    return (
      <div className="loading-screen">
        <Spinner color="accent" size="lg" />
        <span>{t('app.loading')}</span>
      </div>
    )
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar drag-region">
        <div className="traffic-space" />
        <div className="brand no-drag">
          <span className="brand-mark" aria-hidden="true">
            <img className="brand-mark-light" src={sookoolLogo} alt="" />
            <img className="brand-mark-dark" src={sookoolLogoDark} alt="" />
          </span>
          <div className="brand-copy">
            <img className="brand-wordmark" src={sookoolWordmark} alt="SooKool" />
            <span>{t('app.subtitle')}</span>
          </div>
          <Button
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </Button>
        </div>
        <nav className="nav no-drag">
          {navItems.map((item) => {
            const Icon = item.icon
            const label = t(item.labelKey)
            return (
              <Button
                key={item.id}
                className="nav-button"
                aria-label={label}
                fullWidth
                variant={currentView === item.id ? 'tertiary' : 'ghost'}
                onPress={() => setCurrentView(item.id)}
              >
                <Icon size={20} />
                <span className="nav-label">{label}</span>
                {item.id === 'local' && <span className="nav-count">{skills.length}</span>}
              </Button>
            )
          })}
        </nav>
        <div className="sidebar-footer no-drag">
          <Button className="nav-button" aria-label={t('nav.settings')} fullWidth variant={currentView === 'settings' ? 'tertiary' : 'ghost'} onPress={() => setCurrentView('settings')}>
            <Settings size={20} /><span className="nav-label">{t('nav.settings')}</span>
          </Button>
        </div>
      </aside>

      <section className="main-panel">
        <main className="content">
          <SkillLibrary view={currentView} />
        </main>
      </section>
    </div>
  )
}
