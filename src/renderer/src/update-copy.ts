import type { AppLanguage } from './i18n'
import type { UpdateErrorCode, UpdatePhase } from '../../shared/update-types'

interface UpdateCopy {
  tab: string
  title: string
  description: string
  automatic: string
  automaticDescription: string
  currentVersion: string
  check: string
  checkingButton: string
  install: string
  installingButton: string
  later: string
  bannerTitle: string
  bannerDescription: string
  status: Record<UpdatePhase, string>
  errors: Record<UpdateErrorCode, string>
}

const copy: Record<AppLanguage, UpdateCopy> = {
  'zh-CN': {
    tab: '软件更新',
    title: '软件更新',
    description: '自动获取正式版本，并由你决定何时安装。',
    automatic: '自动检查更新',
    automaticDescription: '启动后静默检查，并在后台自动下载新版本。',
    currentVersion: '当前版本',
    check: '检查更新',
    checkingButton: '正在检查…',
    install: '重新启动并安装',
    installingButton: '正在安装…',
    later: '稍后安装',
    bannerTitle: '新版本已准备好',
    bannerDescription: 'SooKool 智能体助手将在重新启动后完成更新。',
    status: {
      disabled: '自动更新仅在正式安装版中可用',
      idle: '等待检查更新',
      checking: '正在检查更新…',
      available: '发现新版本，正在准备下载',
      downloading: '正在后台下载',
      downloaded: '新版本已下载完成',
      installing: '正在重新启动并安装',
      'up-to-date': '当前已是最新版本',
      error: '暂时无法检查更新'
    },
    errors: {
      network: '网络连接不可用，请稍后重试。',
      metadata: '更新服务暂时不可用，请稍后重试。',
      verification: '更新包未通过安全校验，已停止安装。',
      unknown: '更新过程中出现问题，请稍后重试。'
    }
  },
  'zh-HK': {
    tab: '軟件更新',
    title: '軟件更新',
    description: '自動取得正式版本，並由你決定何時安裝。',
    automatic: '自動檢查更新',
    automaticDescription: '啟動後靜默檢查，並在背景自動下載新版本。',
    currentVersion: '目前版本',
    check: '檢查更新',
    checkingButton: '正在檢查…',
    install: '重新啟動並安裝',
    installingButton: '正在安裝…',
    later: '稍後安裝',
    bannerTitle: '新版本已準備好',
    bannerDescription: 'SooKool 智能體助手將在重新啟動後完成更新。',
    status: {
      disabled: '自動更新僅在正式安裝版本中可用',
      idle: '等待檢查更新',
      checking: '正在檢查更新…',
      available: '發現新版本，正在準備下載',
      downloading: '正在背景下載',
      downloaded: '新版本已下載完成',
      installing: '正在重新啟動並安裝',
      'up-to-date': '目前已是最新版本',
      error: '暫時無法檢查更新'
    },
    errors: {
      network: '網絡連線不可用，請稍後重試。',
      metadata: '更新服務暫時不可用，請稍後重試。',
      verification: '更新套件未通過安全驗證，已停止安裝。',
      unknown: '更新期間發生問題，請稍後重試。'
    }
  },
  'en-US': {
    tab: 'Software Update',
    title: 'Software Update',
    description: 'Get stable releases automatically and choose when to install.',
    automatic: 'Automatically check for updates',
    automaticDescription: 'Check quietly after launch and download new releases in the background.',
    currentVersion: 'Current version',
    check: 'Check for Updates',
    checkingButton: 'Checking…',
    install: 'Restart and Install',
    installingButton: 'Installing…',
    later: 'Later',
    bannerTitle: 'A new version is ready',
    bannerDescription: 'SooKool Agent Helper will finish updating after it restarts.',
    status: {
      disabled: 'Automatic updates are available in installed builds',
      idle: 'Waiting to check for updates',
      checking: 'Checking for updates…',
      available: 'New version found, preparing download',
      downloading: 'Downloading in the background',
      downloaded: 'The new version has downloaded',
      installing: 'Restarting to install',
      'up-to-date': 'You are up to date',
      error: 'Unable to check for updates right now'
    },
    errors: {
      network: 'The network is unavailable. Try again later.',
      metadata: 'The update service is temporarily unavailable.',
      verification: 'The update failed its security check and was not installed.',
      unknown: 'Something went wrong while updating. Try again later.'
    }
  },
  'ja-JP': {
    tab: 'ソフトウェアアップデート',
    title: 'ソフトウェアアップデート',
    description: '正式版を自動取得し、インストールするタイミングを選べます。',
    automatic: 'アップデートを自動確認',
    automaticDescription:
      '起動後に静かに確認し、新しいバージョンをバックグラウンドでダウンロードします。',
    currentVersion: '現在のバージョン',
    check: 'アップデートを確認',
    checkingButton: '確認中…',
    install: '再起動してインストール',
    installingButton: 'インストール中…',
    later: 'あとで',
    bannerTitle: '新しいバージョンを利用できます',
    bannerDescription: '再起動後にアップデートが完了します。',
    status: {
      disabled: '自動更新はインストール版で利用できます',
      idle: 'アップデートの確認を待機中',
      checking: 'アップデートを確認中…',
      available: '新しいバージョンを検出しました',
      downloading: 'バックグラウンドでダウンロード中',
      downloaded: 'ダウンロードが完了しました',
      installing: '再起動してインストール中',
      'up-to-date': '最新バージョンです',
      error: '現在アップデートを確認できません'
    },
    errors: {
      network: 'ネットワークに接続できません。後でもう一度お試しください。',
      metadata: 'アップデートサービスを一時的に利用できません。',
      verification: '安全性を確認できなかったため、インストールを中止しました。',
      unknown: 'アップデート中に問題が発生しました。'
    }
  },
  'fr-FR': {
    tab: 'Mise à jour',
    title: 'Mise à jour logicielle',
    description: 'Recevez automatiquement les versions stables et choisissez quand les installer.',
    automatic: 'Rechercher automatiquement les mises à jour',
    automaticDescription: 'Vérifie discrètement au démarrage et télécharge en arrière-plan.',
    currentVersion: 'Version actuelle',
    check: 'Rechercher les mises à jour',
    checkingButton: 'Recherche…',
    install: 'Redémarrer et installer',
    installingButton: 'Installation…',
    later: 'Plus tard',
    bannerTitle: 'Une nouvelle version est prête',
    bannerDescription: 'La mise à jour sera terminée après le redémarrage.',
    status: {
      disabled: 'Les mises à jour sont disponibles dans la version installée',
      idle: 'En attente de vérification',
      checking: 'Recherche de mises à jour…',
      available: 'Nouvelle version trouvée',
      downloading: 'Téléchargement en arrière-plan',
      downloaded: 'La nouvelle version est téléchargée',
      installing: 'Redémarrage et installation',
      'up-to-date': 'Vous êtes à jour',
      error: 'Impossible de rechercher les mises à jour'
    },
    errors: {
      network: 'Le réseau est indisponible. Réessayez plus tard.',
      metadata: 'Le service de mise à jour est temporairement indisponible.',
      verification: 'Le contrôle de sécurité a échoué. Installation annulée.',
      unknown: 'Un problème est survenu pendant la mise à jour.'
    }
  },
  'ko-KR': {
    tab: '소프트웨어 업데이트',
    title: '소프트웨어 업데이트',
    description: '정식 버전을 자동으로 받고 설치 시점을 선택하세요.',
    automatic: '업데이트 자동 확인',
    automaticDescription: '실행 후 조용히 확인하고 새 버전을 백그라운드에서 다운로드합니다.',
    currentVersion: '현재 버전',
    check: '업데이트 확인',
    checkingButton: '확인 중…',
    install: '재시작 및 설치',
    installingButton: '설치 중…',
    later: '나중에',
    bannerTitle: '새 버전이 준비되었습니다',
    bannerDescription: '재시작 후 업데이트가 완료됩니다.',
    status: {
      disabled: '자동 업데이트는 설치된 앱에서 사용할 수 있습니다',
      idle: '업데이트 확인 대기 중',
      checking: '업데이트 확인 중…',
      available: '새 버전을 찾았습니다',
      downloading: '백그라운드에서 다운로드 중',
      downloaded: '새 버전 다운로드 완료',
      installing: '재시작하여 설치 중',
      'up-to-date': '최신 버전입니다',
      error: '지금은 업데이트를 확인할 수 없습니다'
    },
    errors: {
      network: '네트워크를 사용할 수 없습니다. 나중에 다시 시도하세요.',
      metadata: '업데이트 서비스를 일시적으로 사용할 수 없습니다.',
      verification: '보안 확인에 실패하여 설치를 중단했습니다.',
      unknown: '업데이트 중 문제가 발생했습니다.'
    }
  },
  'es-ES': {
    tab: 'Actualización',
    title: 'Actualización de software',
    description: 'Recibe versiones estables automáticamente y elige cuándo instalarlas.',
    automatic: 'Buscar actualizaciones automáticamente',
    automaticDescription: 'Comprueba al iniciar y descarga nuevas versiones en segundo plano.',
    currentVersion: 'Versión actual',
    check: 'Buscar actualizaciones',
    checkingButton: 'Buscando…',
    install: 'Reiniciar e instalar',
    installingButton: 'Instalando…',
    later: 'Más tarde',
    bannerTitle: 'Hay una nueva versión lista',
    bannerDescription: 'La actualización terminará después de reiniciar.',
    status: {
      disabled: 'Las actualizaciones están disponibles en la versión instalada',
      idle: 'Esperando para buscar actualizaciones',
      checking: 'Buscando actualizaciones…',
      available: 'Nueva versión encontrada',
      downloading: 'Descargando en segundo plano',
      downloaded: 'La nueva versión se ha descargado',
      installing: 'Reiniciando para instalar',
      'up-to-date': 'Tienes la última versión',
      error: 'No se pueden buscar actualizaciones ahora'
    },
    errors: {
      network: 'La red no está disponible. Inténtalo más tarde.',
      metadata: 'El servicio de actualización no está disponible temporalmente.',
      verification: 'La actualización no superó la comprobación de seguridad.',
      unknown: 'Se produjo un problema durante la actualización.'
    }
  },
  'pt-BR': {
    tab: 'Atualização',
    title: 'Atualização de software',
    description: 'Receba versões estáveis automaticamente e escolha quando instalar.',
    automatic: 'Verificar atualizações automaticamente',
    automaticDescription: 'Verifica ao iniciar e baixa novas versões em segundo plano.',
    currentVersion: 'Versão atual',
    check: 'Buscar atualizações',
    checkingButton: 'Verificando…',
    install: 'Reiniciar e instalar',
    installingButton: 'Instalando…',
    later: 'Mais tarde',
    bannerTitle: 'Uma nova versão está pronta',
    bannerDescription: 'A atualização será concluída após reiniciar.',
    status: {
      disabled: 'Atualizações estão disponíveis na versão instalada',
      idle: 'Aguardando verificação',
      checking: 'Verificando atualizações…',
      available: 'Nova versão encontrada',
      downloading: 'Baixando em segundo plano',
      downloaded: 'A nova versão foi baixada',
      installing: 'Reiniciando para instalar',
      'up-to-date': 'Você está atualizado',
      error: 'Não foi possível verificar atualizações'
    },
    errors: {
      network: 'A rede está indisponível. Tente novamente mais tarde.',
      metadata: 'O serviço de atualização está temporariamente indisponível.',
      verification: 'A atualização falhou na verificação de segurança.',
      unknown: 'Ocorreu um problema durante a atualização.'
    }
  },
  ar: {
    tab: 'تحديث البرنامج',
    title: 'تحديث البرنامج',
    description: 'احصل على الإصدارات المستقرة تلقائياً واختر وقت التثبيت.',
    automatic: 'التحقق من التحديثات تلقائياً',
    automaticDescription: 'يتحقق بهدوء بعد التشغيل وينزّل الإصدارات الجديدة في الخلفية.',
    currentVersion: 'الإصدار الحالي',
    check: 'التحقق من التحديثات',
    checkingButton: 'جارٍ التحقق…',
    install: 'إعادة التشغيل والتثبيت',
    installingButton: 'جارٍ التثبيت…',
    later: 'لاحقاً',
    bannerTitle: 'إصدار جديد جاهز',
    bannerDescription: 'سيكتمل التحديث بعد إعادة التشغيل.',
    status: {
      disabled: 'التحديثات التلقائية متاحة في النسخة المثبتة',
      idle: 'في انتظار التحقق من التحديثات',
      checking: 'جارٍ التحقق من التحديثات…',
      available: 'تم العثور على إصدار جديد',
      downloading: 'جارٍ التنزيل في الخلفية',
      downloaded: 'اكتمل تنزيل الإصدار الجديد',
      installing: 'جارٍ إعادة التشغيل والتثبيت',
      'up-to-date': 'لديك أحدث إصدار',
      error: 'يتعذر التحقق من التحديثات الآن'
    },
    errors: {
      network: 'الشبكة غير متاحة. حاول لاحقاً.',
      metadata: 'خدمة التحديث غير متاحة مؤقتاً.',
      verification: 'لم يجتز التحديث فحص الأمان وتم إيقاف التثبيت.',
      unknown: 'حدثت مشكلة أثناء التحديث.'
    }
  }
}

export function softwareUpdateCopy(language: AppLanguage): UpdateCopy {
  return copy[language]
}
