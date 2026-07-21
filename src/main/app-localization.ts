import type { AppLanguage } from './settings/settings-store'

export const appDisplayNames: Record<AppLanguage, string> = {
  'zh-CN': 'SooKool 智能体助手',
  'en-US': 'SooKool Agent Helper',
  'zh-HK': 'SooKool 智能體助手',
  'ja-JP': 'SooKool エージェントアシスタント',
  'fr-FR': 'Assistant d’agents SooKool',
  'ko-KR': 'SooKool 에이전트 도우미',
  'es-ES': 'Asistente de agentes SooKool',
  'pt-BR': 'Assistente de agentes SooKool',
  ar: 'مساعد الوكلاء SooKool'
}

export function getAppDisplayName(language: AppLanguage): string {
  return appDisplayNames[language]
}
