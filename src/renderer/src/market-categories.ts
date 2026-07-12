import type { AppLanguage } from '@/i18n'

export type MarketCategoryKey =
  | 'all' | 'efficiency' | 'qualitySecurity' | 'designFrontend' | 'development'
  | 'contentOffice' | 'dataResearch' | 'communication' | 'creative' | 'devops'
  | 'email' | 'finance' | 'health' | 'research' | 'security'
  | 'softwareDevelopment' | 'webDevelopment' | 'machineLearning' | 'blockchain' | 'other'

const labels: Record<AppLanguage, Record<MarketCategoryKey, string>> = {
  'zh-CN': { all: '全部', efficiency: '效率工具', qualitySecurity: '质量与安全', designFrontend: '设计与前端', development: '开发工具', contentOffice: '内容与办公', dataResearch: '数据与研究', communication: '沟通协作', creative: '创意创作', devops: '开发运维', email: '邮件', finance: '金融', health: '健康', research: '研究', security: '安全', softwareDevelopment: '软件开发', webDevelopment: 'Web 开发', machineLearning: '机器学习', blockchain: '区块链', other: '其他' },
  'zh-TW': { all: '全部', efficiency: '效率工具', qualitySecurity: '品質與安全', designFrontend: '設計與前端', development: '開發工具', contentOffice: '內容與辦公', dataResearch: '資料與研究', communication: '溝通協作', creative: '創意創作', devops: '開發運維', email: '電子郵件', finance: '金融', health: '健康', research: '研究', security: '安全', softwareDevelopment: '軟體開發', webDevelopment: 'Web 開發', machineLearning: '機器學習', blockchain: '區塊鏈', other: '其他' },
  'en-US': { all: 'All', efficiency: 'Productivity', qualitySecurity: 'Quality & Safety', designFrontend: 'Design & Frontend', development: 'Developer Tools', contentOffice: 'Content & Office', dataResearch: 'Data & Research', communication: 'Communication', creative: 'Creative', devops: 'DevOps', email: 'Email', finance: 'Finance', health: 'Health', research: 'Research', security: 'Security', softwareDevelopment: 'Software Development', webDevelopment: 'Web Development', machineLearning: 'Machine Learning', blockchain: 'Blockchain', other: 'Other' },
  'ja-JP': { all: 'すべて', efficiency: '生産性ツール', qualitySecurity: '品質と安全', designFrontend: 'デザインとフロントエンド', development: '開発ツール', contentOffice: 'コンテンツとオフィス', dataResearch: 'データと調査', communication: 'コミュニケーション', creative: 'クリエイティブ', devops: 'DevOps', email: 'メール', finance: '金融', health: '健康', research: '調査', security: 'セキュリティ', softwareDevelopment: 'ソフトウェア開発', webDevelopment: 'Web 開発', machineLearning: '機械学習', blockchain: 'ブロックチェーン', other: 'その他' },
  'fr-FR': { all: 'Tout', efficiency: 'Productivité', qualitySecurity: 'Qualité et sécurité', designFrontend: 'Design et frontend', development: 'Outils de développement', contentOffice: 'Contenu et bureautique', dataResearch: 'Données et recherche', communication: 'Communication', creative: 'Création', devops: 'DevOps', email: 'E-mail', finance: 'Finance', health: 'Santé', research: 'Recherche', security: 'Sécurité', softwareDevelopment: 'Développement logiciel', webDevelopment: 'Développement web', machineLearning: 'Apprentissage automatique', blockchain: 'Blockchain', other: 'Autres' },
  'ko-KR': { all: '전체', efficiency: '생산성 도구', qualitySecurity: '품질 및 안전', designFrontend: '디자인 및 프론트엔드', development: '개발 도구', contentOffice: '콘텐츠 및 오피스', dataResearch: '데이터 및 연구', communication: '커뮤니케이션', creative: '크리에이티브', devops: 'DevOps', email: '이메일', finance: '금융', health: '건강', research: '연구', security: '보안', softwareDevelopment: '소프트웨어 개발', webDevelopment: 'Web 개발', machineLearning: '머신러닝', blockchain: '블록체인', other: '기타' },
  'es-ES': { all: 'Todo', efficiency: 'Productividad', qualitySecurity: 'Calidad y seguridad', designFrontend: 'Diseño y frontend', development: 'Herramientas de desarrollo', contentOffice: 'Contenido y oficina', dataResearch: 'Datos e investigación', communication: 'Comunicación', creative: 'Creatividad', devops: 'DevOps', email: 'Correo', finance: 'Finanzas', health: 'Salud', research: 'Investigación', security: 'Seguridad', softwareDevelopment: 'Desarrollo de software', webDevelopment: 'Desarrollo web', machineLearning: 'Aprendizaje automático', blockchain: 'Cadena de bloques', other: 'Otros' },
  'pt-BR': { all: 'Todos', efficiency: 'Produtividade', qualitySecurity: 'Qualidade e segurança', designFrontend: 'Design e frontend', development: 'Ferramentas de desenvolvimento', contentOffice: 'Conteúdo e escritório', dataResearch: 'Dados e pesquisa', communication: 'Comunicação', creative: 'Criatividade', devops: 'DevOps', email: 'E-mail', finance: 'Finanças', health: 'Saúde', research: 'Pesquisa', security: 'Segurança', softwareDevelopment: 'Desenvolvimento de software', webDevelopment: 'Desenvolvimento web', machineLearning: 'Aprendizado de máquina', blockchain: 'Blockchain', other: 'Outros' },
  ar: { all: 'الكل', efficiency: 'الإنتاجية', qualitySecurity: 'الجودة والسلامة', designFrontend: 'التصميم والواجهة', development: 'أدوات التطوير', contentOffice: 'المحتوى والمكتب', dataResearch: 'البيانات والبحث', communication: 'التواصل', creative: 'الإبداع', devops: 'التطوير والتشغيل', email: 'البريد', finance: 'المالية', health: 'الصحة', research: 'البحث', security: 'الأمان', softwareDevelopment: 'تطوير البرمجيات', webDevelopment: 'تطوير الويب', machineLearning: 'تعلم الآلة', blockchain: 'سلسلة الكتل', other: 'أخرى' }
}

const aliases: Record<string, MarketCategoryKey> = {
  '全部': 'all', all: 'all', '效率工具': 'efficiency', efficiency: 'efficiency', productivity: 'efficiency',
  '质量与安全': 'qualitySecurity', 'quality-and-safety': 'qualitySecurity', quality: 'qualitySecurity',
  '设计与前端': 'designFrontend', 'design-media': 'designFrontend', frontend: 'designFrontend',
  '开发工具': 'development', 'developer-tools': 'development', development: 'development',
  '内容与办公': 'contentOffice', 'content-creation': 'contentOffice', 'office-efficiency': 'contentOffice', content: 'contentOffice',
  '数据与研究': 'dataResearch', 'data-analysis': 'dataResearch', data: 'dataResearch',
  communication: 'communication', creative: 'creative', devops: 'devops', email: 'email', finance: 'finance', health: 'health', research: 'research', security: 'security',
  'software-development': 'softwareDevelopment', 'web-development': 'webDevelopment', 'machine-learning': 'machineLearning', blockchain: 'blockchain'
}

export function marketCategoryKey(value: string): MarketCategoryKey {
  return aliases[value.trim().toLowerCase()] || 'other'
}

export function localizeMarketCategory(value: string | MarketCategoryKey, language: AppLanguage): string {
  const key = value in labels[language] ? value as MarketCategoryKey : marketCategoryKey(value)
  return labels[language][key]
}
