import React, { useEffect, useState } from 'react'
import { Button, Spinner, useTheme } from '@heroui/react'
import { BookText, PanelLeftClose, PanelLeftOpen, RadioTower, RefreshCw, Settings, Settings2, Store, X } from 'lucide-react'
import { SkillLibrary } from '@/components/SkillLibrary'
import { resolveAppLanguage, translate } from '@/i18n'
import { useAppStore, type ViewType } from '@/stores/app-store'
import sookoolLogo from './assets/sookool-app-icon-ui.png'
import sookoolLogoDark from './assets/sookool-app-icon-ui-dark.png'
import sookoolWordmark from './assets/sookool-wordmark.png'
import { softwareUpdateCopy } from './update-copy'

const navItems: Array<{
  id: ViewType
  labelKey: Parameters<typeof translate>[1]
  icon: React.ElementType
}> = [
  { id: 'local', labelKey: 'nav.local', icon: BookText },
  { id: 'market', labelKey: 'nav.market', icon: Store },
  { id: 'local-share', labelKey: 'nav.localShare', icon: RadioTower },
  { id: 'skill-settings', labelKey: 'nav.skillSettings', icon: Settings2 }
]

export function App(): React.JSX.Element {
  const { initialized, initialize, currentView, setCurrentView, skills, preferences, updateState, installUpdate } =
    useAppStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | null>(null)
  const { setTheme } = useTheme(preferences.themeMode)
  const t = (
    key: Parameters<typeof translate>[1],
    replacements?: Parameters<typeof translate>[2]
  ) => translate(preferences.language, key, replacements)
  const updateCopy = softwareUpdateCopy(resolveAppLanguage(preferences.language))
  const showUpdateReady = updateState.phase === 'downloaded' && updateState.availableVersion !== dismissedUpdateVersion

  useEffect(() => {
    if (!initialized) void initialize()
  }, [initialized, initialize])

  useEffect(() => window.aiHelper.onNavigate(setCurrentView), [setCurrentView])

  useEffect(() => {
    setTheme(preferences.themeMode)
  }, [preferences.themeMode, setTheme])

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

      {showUpdateReady && (
        <aside className="update-ready-banner no-drag" aria-live="polite" aria-label={updateCopy.bannerTitle}>
          <div className="update-ready-banner-icon" aria-hidden="true"><RefreshCw size={18} /></div>
          <div className="update-ready-banner-copy">
            <strong>{updateCopy.bannerTitle}</strong>
            <p>{updateCopy.bannerDescription}</p>
            <div className="update-ready-banner-actions">
              <Button size="sm" variant="primary" onPress={() => void installUpdate()}>{updateCopy.install}</Button>
              <Button size="sm" variant="ghost" onPress={() => setDismissedUpdateVersion(updateState.availableVersion)}>{updateCopy.later}</Button>
            </div>
          </div>
          <Button className="update-ready-banner-close" aria-label={updateCopy.later} isIconOnly size="sm" variant="ghost" onPress={() => setDismissedUpdateVersion(updateState.availableVersion)}><X size={15} /></Button>
        </aside>
      )}
    </div>
  )
}
