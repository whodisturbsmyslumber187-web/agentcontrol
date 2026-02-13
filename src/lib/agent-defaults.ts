export interface AgentOperatingProfile {
  version: string
  internet: {
    provider: 'brave'
    endpoint: string
    enabled: boolean
  }
  automationBridge: {
    endpoint: string
    actions: string[]
  }
  integrations: {
    n8n: boolean
    livekit: boolean
    sipImport: boolean
    openrouter: boolean
    huggingface: boolean
    gemini: boolean
    proxyGateway: boolean
    daoLaunch: boolean
  }
  mcp: {
    enabled: boolean
    defaultTools: string[]
  }
  skills: string[]
  autoEnhancement: {
    enabled: boolean
    checkIntervalMinutes: number
    sources: string[]
  }
}

const DEFAULT_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INSFORGE_BASE_URL) ||
  'https://ijeed7kh.us-west.insforge.app'

export const DEFAULT_AGENT_SKILLS: string[] = [
  'brand-voice-generator',
  'cloudflare-deploy',
  'figma',
  'figma-implement-design',
  'imagegen',
  'mcp-client',
  'netlify-deploy',
  'pdf',
  'playwright',
  'pptx-generator',
  'skill-creator',
  'sop-creator',
  'sora',
  'vercel-deploy',
]

export const DEFAULT_MCP_TOOLING: string[] = [
  'database',
  'functions',
  'storage',
  'auth',
  'ai',
  'realtime',
  'deployment',
  'skills',
  'mcp-client',
  'fetch-docs',
  'fetch-sdk-docs',
  'fetch-guides',
  'cron',
  'logs',
  'monitoring',
  'secrets',
  'integrations',
]

export const DEFAULT_AGENT_OPERATING_PROFILE: AgentOperatingProfile = {
  version: '2026.02.master',
  internet: {
    provider: 'brave',
    endpoint: 'https://api.search.brave.com/res/v1/web/search',
    enabled: true,
  },
  automationBridge: {
    endpoint: `${DEFAULT_BASE_URL}/functions/agent-automation-bridge`,
    actions: [
      'web_search',
      'create_n8n_workflow',
      'request_livekit_session',
      'import_sip_numbers',
      'post_forum_update',
      'comment_forum_post',
      'create_dao_deployment_task',
      'discover_provider_updates',
    ],
  },
  integrations: {
    n8n: true,
    livekit: true,
    sipImport: true,
    openrouter: true,
    huggingface: true,
    gemini: true,
    proxyGateway: true,
    daoLaunch: true,
  },
  mcp: {
    enabled: true,
    defaultTools: DEFAULT_MCP_TOOLING,
  },
  skills: DEFAULT_AGENT_SKILLS,
  autoEnhancement: {
    enabled: true,
    checkIntervalMinutes: 30,
    sources: [
      'openrouter-models',
      'huggingface-inference-providers',
      'gemini-models',
      'brave-search',
      'sip-provider-updates',
    ],
  },
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
}

export function mergeAgentConfigWithDefaults(config: Record<string, unknown> | undefined | null) {
  const current = asRecord(config)
  const currentProfile = asRecord(current.operatingProfile)
  const currentBridge = asRecord(currentProfile.automationBridge)
  const currentMcp = asRecord(currentProfile.mcp)
  const currentAutoEnhancement = asRecord(currentProfile.autoEnhancement)

  const mergedSkills = Array.from(
    new Set([
      ...DEFAULT_AGENT_OPERATING_PROFILE.skills,
      ...asStringArray(currentProfile.skills),
      ...asStringArray(current.skills),
    ]),
  )

  const mergedMcpTools = Array.from(
    new Set([
      ...DEFAULT_AGENT_OPERATING_PROFILE.mcp.defaultTools,
      ...asStringArray(currentMcp.defaultTools),
      ...asStringArray(current.mcpTools),
    ]),
  )

  const mergedActions = Array.from(
    new Set([
      ...DEFAULT_AGENT_OPERATING_PROFILE.automationBridge.actions,
      ...asStringArray(currentBridge.actions),
    ]),
  )

  const mergedSources = Array.from(
    new Set([
      ...DEFAULT_AGENT_OPERATING_PROFILE.autoEnhancement.sources,
      ...asStringArray(currentAutoEnhancement.sources),
    ]),
  )

  const mergedIntegrations = {
    ...DEFAULT_AGENT_OPERATING_PROFILE.integrations,
    ...asRecord(currentProfile.integrations),
    ...asRecord(current.integrations),
  }

  const mergedInternet = {
    ...DEFAULT_AGENT_OPERATING_PROFILE.internet,
    ...asRecord(currentProfile.internet),
    ...asRecord(current.internet),
  }

  return {
    ...current,
    operatingProfile: {
      ...DEFAULT_AGENT_OPERATING_PROFILE,
      ...currentProfile,
      integrations: mergedIntegrations,
      internet: mergedInternet,
      skills: mergedSkills,
      mcp: {
        ...DEFAULT_AGENT_OPERATING_PROFILE.mcp,
        ...currentMcp,
        defaultTools: mergedMcpTools,
      },
      automationBridge: {
        ...DEFAULT_AGENT_OPERATING_PROFILE.automationBridge,
        ...currentBridge,
        actions: mergedActions,
      },
      autoEnhancement: {
        ...DEFAULT_AGENT_OPERATING_PROFILE.autoEnhancement,
        ...currentAutoEnhancement,
        sources: mergedSources,
      },
    },
    integrations: mergedIntegrations,
    internet: mergedInternet,
    skills: mergedSkills,
    mcpTools: mergedMcpTools,
  }
}
