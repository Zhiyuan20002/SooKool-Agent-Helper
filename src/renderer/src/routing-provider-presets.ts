import type {
  RoutingApiKeyField,
  RoutingAppType,
  RoutingProviderAppConfig,
  RoutingProviderInput
} from '../../shared/routing-types'

export type NewRoutingProviderForm = RoutingProviderInput & { apiKey: string }

export interface RoutingProviderPreset {
  id: string
  name: string
  description: string
  baseUrl: string
  model: string
  defaultHaikuModel: string
  defaultSonnetModel: string
  defaultOpusModel: string
  websiteUrl: string
  apiKeyUrl: string
  category: string
  apiKeyField: RoutingApiKeyField
  icon: string
  iconColor: string
  applications: RoutingAppType[]
  applicationConfigs: Partial<Record<RoutingAppType, RoutingProviderAppConfig>>
}

const claudeApplications: RoutingAppType[] = ['claude']
const directCodexApplications: RoutingAppType[] = ['claude', 'codex']

function adapters(
  claude: RoutingProviderAppConfig,
  codex?: RoutingProviderAppConfig
): Partial<Record<RoutingAppType, RoutingProviderAppConfig>> {
  return {
    claude,
    'claude-desktop': { ...claude },
    ...(codex ? { codex } : {})
  }
}

export const routingProviderPresets: RoutingProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek 官方 Anthropic 兼容服务',
    baseUrl: 'https://api.deepseek.com/anthropic',
    model: 'deepseek-v4-pro',
    defaultHaikuModel: 'deepseek-v4-flash',
    defaultSonnetModel: 'deepseek-v4-pro',
    defaultOpusModel: 'deepseek-v4-pro',
    websiteUrl: 'https://platform.deepseek.com',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    category: 'cn_official',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'deepseek',
    iconColor: '#1e88e5',
    applications: claudeApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://api.deepseek.com/anthropic', model: 'deepseek-v4-pro', defaultHaikuModel: 'deepseek-v4-flash', defaultSonnetModel: 'deepseek-v4-pro', defaultOpusModel: 'deepseek-v4-pro' },
      undefined
    )
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM',
    description: '智谱 GLM Coding Plan',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    model: 'glm-5.1',
    defaultHaikuModel: 'glm-5.1',
    defaultSonnetModel: 'glm-5.1',
    defaultOpusModel: 'glm-5.1',
    websiteUrl: 'https://open.bigmodel.cn',
    apiKeyUrl: 'https://www.bigmodel.cn/claude-code',
    category: 'cn_official',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'zhipu',
    iconColor: '#0f62fe',
    applications: claudeApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://open.bigmodel.cn/api/anthropic', model: 'glm-5.1', defaultHaikuModel: 'glm-5.1', defaultSonnetModel: 'glm-5.1', defaultOpusModel: 'glm-5.1' },
      undefined
    )
  },
  {
    id: 'kimi-coding',
    name: 'Kimi For Coding',
    description: 'Kimi Coding Plan',
    baseUrl: 'https://api.kimi.com/coding/',
    model: '',
    defaultHaikuModel: '',
    defaultSonnetModel: '',
    defaultOpusModel: '',
    websiteUrl: 'https://www.kimi.com/code/',
    apiKeyUrl: 'https://www.kimi.com/code/',
    category: 'cn_official',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'kimicodingplan',
    iconColor: '#6366f1',
    applications: claudeApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://api.kimi.com/coding/', autoCompactWindow: '262144' },
      undefined
    )
  },
  {
    id: 'modelscope',
    name: 'ModelScope',
    description: '魔搭社区模型推理服务',
    baseUrl: 'https://api-inference.modelscope.cn',
    model: 'ZhipuAI/GLM-5.1',
    defaultHaikuModel: 'ZhipuAI/GLM-5.1',
    defaultSonnetModel: 'ZhipuAI/GLM-5.1',
    defaultOpusModel: 'ZhipuAI/GLM-5.1',
    websiteUrl: 'https://modelscope.cn',
    apiKeyUrl: 'https://modelscope.cn/my/myaccesstoken',
    category: 'aggregator',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'modelscope',
    iconColor: '#624aff',
    applications: claudeApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://api-inference.modelscope.cn', model: 'ZhipuAI/GLM-5.1', defaultHaikuModel: 'ZhipuAI/GLM-5.1', defaultSonnetModel: 'ZhipuAI/GLM-5.1', defaultOpusModel: 'ZhipuAI/GLM-5.1' },
      undefined
    )
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    description: 'MiniMax Coding Plan',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    model: 'MiniMax-M2.7',
    defaultHaikuModel: 'MiniMax-M2.7',
    defaultSonnetModel: 'MiniMax-M2.7',
    defaultOpusModel: 'MiniMax-M2.7',
    websiteUrl: 'https://platform.minimaxi.com',
    apiKeyUrl: 'https://platform.minimaxi.com/subscribe/coding-plan',
    category: 'cn_official',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'minimaxcodingplan',
    iconColor: '#ff6b6b',
    applications: directCodexApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://api.minimaxi.com/anthropic', model: 'MiniMax-M2.7', defaultHaikuModel: 'MiniMax-M2.7', defaultSonnetModel: 'MiniMax-M2.7', defaultOpusModel: 'MiniMax-M2.7', apiTimeoutMs: '3000000', disableNonessentialTraffic: true },
      { baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-M3', wireApi: 'responses' }
    )
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '聚合多个模型供应商',
    baseUrl: 'https://openrouter.ai/api',
    model: 'anthropic/claude-sonnet-5',
    defaultHaikuModel: 'anthropic/claude-haiku-4.5',
    defaultSonnetModel: 'anthropic/claude-sonnet-5',
    defaultOpusModel: 'anthropic/claude-opus-4.8',
    websiteUrl: 'https://openrouter.ai',
    apiKeyUrl: 'https://openrouter.ai/keys',
    category: 'aggregator',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'openrouter',
    iconColor: '#6566f1',
    applications: directCodexApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://openrouter.ai/api', model: 'anthropic/claude-sonnet-5', defaultHaikuModel: 'anthropic/claude-haiku-4.5', defaultSonnetModel: 'anthropic/claude-sonnet-5', defaultOpusModel: 'anthropic/claude-opus-4.8' },
      { baseUrl: 'https://openrouter.ai/api/v1', model: 'gpt-5.5', wireApi: 'responses' }
    )
  },
  {
    id: 'stepfun',
    name: 'StepFun',
    description: '阶跃星辰 Step Plan',
    baseUrl: 'https://api.stepfun.com/step_plan',
    model: 'step-3.5-flash-2603',
    defaultHaikuModel: 'step-3.5-flash-2603',
    defaultSonnetModel: 'step-3.5-flash-2603',
    defaultOpusModel: 'step-3.5-flash-2603',
    websiteUrl: 'https://platform.stepfun.com/step-plan',
    apiKeyUrl: 'https://platform.stepfun.com/interface-key',
    category: 'cn_official',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'stepfuncodingplan',
    iconColor: '#16d6d2',
    applications: claudeApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://api.stepfun.com/step_plan', model: 'step-3.5-flash-2603', defaultHaikuModel: 'step-3.5-flash-2603', defaultSonnetModel: 'step-3.5-flash-2603', defaultOpusModel: 'step-3.5-flash-2603' },
      undefined
    )
  },
  {
    id: 'bailian-coding',
    name: 'Bailian For Coding',
    description: '阿里云百炼 Coding Plan',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
    model: '',
    defaultHaikuModel: '',
    defaultSonnetModel: '',
    defaultOpusModel: '',
    websiteUrl: 'https://bailian.console.aliyun.com',
    apiKeyUrl: 'https://bailian.console.aliyun.com/#/api-key',
    category: 'cn_official',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'bailiancodingplan',
    iconColor: '#624aff',
    applications: directCodexApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://coding.dashscope.aliyuncs.com/apps/anthropic' },
      { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3-coder-plus', wireApi: 'responses' }
    )
  },
  {
    id: 'silicon-flow',
    name: 'SiliconFlow',
    description: '硅基流动模型聚合服务',
    baseUrl: 'https://api.siliconflow.cn',
    model: 'Pro/MiniMaxAI/MiniMax-M2.7',
    defaultHaikuModel: 'Pro/MiniMaxAI/MiniMax-M2.7',
    defaultSonnetModel: 'Pro/MiniMaxAI/MiniMax-M2.7',
    defaultOpusModel: 'Pro/MiniMaxAI/MiniMax-M2.7',
    websiteUrl: 'https://siliconflow.cn',
    apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
    category: 'aggregator',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: 'siliconcloud',
    iconColor: '#6e29f6',
    applications: claudeApplications,
    applicationConfigs: adapters(
      { baseUrl: 'https://api.siliconflow.cn', model: 'Pro/MiniMaxAI/MiniMax-M2.7', defaultHaikuModel: 'Pro/MiniMaxAI/MiniMax-M2.7', defaultSonnetModel: 'Pro/MiniMaxAI/MiniMax-M2.7', defaultOpusModel: 'Pro/MiniMaxAI/MiniMax-M2.7' },
      undefined
    )
  }
]

export function createProviderFormFromPreset(
  preset: RoutingProviderPreset
): NewRoutingProviderForm {
  return {
    applications: [...preset.applications],
    applicationConfigs: structuredClone(preset.applicationConfigs),
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiKey: '',
    model: preset.model,
    defaultHaikuModel: preset.defaultHaikuModel,
    defaultSonnetModel: preset.defaultSonnetModel,
    defaultOpusModel: preset.defaultOpusModel,
    websiteUrl: preset.websiteUrl,
    apiKeyUrl: preset.apiKeyUrl,
    category: preset.category,
    apiKeyField: preset.apiKeyField,
    icon: preset.icon,
    iconColor: preset.iconColor,
    notes: ''
  }
}

export function createBlankProviderForm(): NewRoutingProviderForm {
  return {
    applications: ['claude', 'codex', 'gemini'],
    applicationConfigs: {
      claude: {},
      codex: { wireApi: 'responses' },
      gemini: {}
    },
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    defaultHaikuModel: '',
    defaultSonnetModel: '',
    defaultOpusModel: '',
    websiteUrl: '',
    apiKeyUrl: '',
    category: 'custom',
    apiKeyField: 'ANTHROPIC_AUTH_TOKEN',
    icon: '',
    iconColor: '',
    notes: ''
  }
}
