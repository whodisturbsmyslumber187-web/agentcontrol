export type McpTransport = 'http' | 'sse' | 'stdio'

export interface McpServerConfig {
  id: string
  name: string
  category: string
  description: string
  transport: McpTransport
  endpoint?: string
  command?: string
  args?: string[]
  env?: string[]
  enabled: boolean
  source: 'default' | 'custom'
}

export const DEFAULT_MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'insforge-core',
    name: 'InsForge Core MCP',
    category: 'backend',
    description: 'Database, auth, storage, functions, realtime, and docs tools.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@insforge/mcp'],
    env: ['INSFORGE_API_KEY', 'INSFORGE_API_BASE_URL'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'mcp-client',
    name: 'Universal MCP Client',
    category: 'orchestration',
    description: 'Wrapper client for discovering and invoking other MCP servers.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/client'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'filesystem',
    name: 'Filesystem MCP',
    category: 'core',
    description: 'Controlled filesystem access for project generation and maintenance.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'brave-search',
    name: 'Brave Search MCP',
    category: 'research',
    description: 'Internet search and web intelligence via Brave Search API.',
    transport: 'sse',
    endpoint: 'https://api.search.brave.com/res/v1/web/search',
    env: ['BRAVE_API_KEY'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'playwright-browser',
    name: 'Playwright Browser MCP',
    category: 'research',
    description: 'Browser automation for scraping flows and UI operations.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'github',
    name: 'GitHub MCP',
    category: 'devops',
    description: 'Repository automation, issues, PRs, and CI workflows.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: ['GITHUB_TOKEN'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'docker',
    name: 'Docker MCP',
    category: 'devops',
    description: 'Container lifecycle controls for deployment workloads.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@docker/mcp-server'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'n8n',
    name: 'n8n MCP',
    category: 'automation',
    description: 'Workflow creation, execution, and telemetry in n8n.',
    transport: 'http',
    endpoint: 'https://n8n.your-domain.com/mcp',
    env: ['N8N_BASE_URL', 'N8N_API_KEY'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'livekit',
    name: 'LiveKit Voice MCP',
    category: 'voice',
    description: 'Voice rooms, SIP routing, and call automation controls.',
    transport: 'http',
    endpoint: 'https://livekit.your-domain.com/mcp',
    env: ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_WS_URL'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'shopify',
    name: 'Shopify MCP',
    category: 'commerce',
    description: 'Shopify store catalog, order, and fulfillment operations.',
    transport: 'http',
    endpoint: 'https://shopify.your-domain.com/mcp',
    env: ['SHOPIFY_ADMIN_TOKEN'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'telegram',
    name: 'Telegram MCP',
    category: 'communications',
    description: 'Telegram bot command execution and reporting.',
    transport: 'http',
    endpoint: 'https://telegram.your-domain.com/mcp',
    env: ['TELEGRAM_BOT_TOKEN'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter MCP',
    category: 'models',
    description: 'Model discovery and routing over OpenRouter.',
    transport: 'http',
    endpoint: 'https://openrouter.ai/api/v1',
    env: ['OPENROUTER_API_KEY'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face MCP',
    category: 'models',
    description: 'Inference provider and model catalog controls.',
    transport: 'http',
    endpoint: 'https://huggingface.co/api',
    env: ['HUGGINGFACE_TOKEN'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'gemini',
    name: 'Gemini MCP',
    category: 'models',
    description: 'Google Gemini model access and feature introspection.',
    transport: 'http',
    endpoint: 'https://generativelanguage.googleapis.com',
    env: ['GEMINI_API_KEY'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'aragon',
    name: 'Aragon DAO MCP',
    category: 'dao',
    description: 'DAO governance deployment and management tasks.',
    transport: 'http',
    endpoint: 'https://aragon.your-domain.com/mcp',
    enabled: true,
    source: 'default',
  },
  {
    id: 'olympus',
    name: 'Olympus DAO MCP',
    category: 'dao',
    description: 'Token treasury and protocol-level DAO tooling.',
    transport: 'http',
    endpoint: 'https://olympus.your-domain.com/mcp',
    enabled: true,
    source: 'default',
  },
  {
    id: 'proxy-gateway',
    name: 'Proxy Gateway MCP',
    category: 'network',
    description: 'Outbound proxy/routing layer for multi-region agent traffic.',
    transport: 'http',
    endpoint: 'https://proxy.your-domain.com/mcp',
    env: ['AGENT_PROXY_URL', 'AGENT_PROXY_KEY'],
    enabled: true,
    source: 'default',
  },
  {
    id: 'ssh-exec',
    name: 'SSH Execute MCP',
    category: 'infrastructure',
    description: 'Secure SSH command execution for VPS fleet operations.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-ssh'],
    env: ['SSH_PRIVATE_KEY', 'SSH_TARGETS'],
    enabled: true,
    source: 'default',
  },
]

const MCP_REGISTRY_KEY = 'agentforge-mcp-registry'
const MCP_ENABLED_KEY = 'agentforge-mcp-enabled-ids'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
}

export function loadMcpRegistry(): McpServerConfig[] {
  if (typeof window === 'undefined') return DEFAULT_MCP_SERVERS

  const raw = window.localStorage.getItem(MCP_REGISTRY_KEY)
  if (!raw) return DEFAULT_MCP_SERVERS

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_MCP_SERVERS

    const rows = parsed
      .filter((entry) => isRecord(entry))
      .map((entry) => {
        const id = typeof entry.id === 'string' ? entry.id.trim() : ''
        const name = typeof entry.name === 'string' ? entry.name.trim() : ''
        const category = typeof entry.category === 'string' ? entry.category.trim() : 'custom'
        const description = typeof entry.description === 'string' ? entry.description.trim() : ''
        const transport =
          entry.transport === 'http' || entry.transport === 'sse' || entry.transport === 'stdio'
            ? entry.transport
            : 'http'
        if (!id || !name) return null

        return {
          id,
          name,
          category,
          description,
          transport,
          endpoint: typeof entry.endpoint === 'string' ? entry.endpoint.trim() : undefined,
          command: typeof entry.command === 'string' ? entry.command.trim() : undefined,
          args: asStringArray(entry.args),
          env: asStringArray(entry.env),
          enabled: typeof entry.enabled === 'boolean' ? entry.enabled : true,
          source: entry.source === 'custom' ? 'custom' : 'default',
        } as McpServerConfig
      })
      .filter(Boolean) as McpServerConfig[]

    if (rows.length === 0) return DEFAULT_MCP_SERVERS
    return rows
  } catch {
    return DEFAULT_MCP_SERVERS
  }
}

export function saveMcpRegistry(servers: McpServerConfig[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MCP_REGISTRY_KEY, JSON.stringify(servers))
}

export function loadEnabledMcpIds(): string[] {
  if (typeof window === 'undefined') {
    return DEFAULT_MCP_SERVERS.filter((server) => server.enabled).map((server) => server.id)
  }

  const raw = window.localStorage.getItem(MCP_ENABLED_KEY)
  if (!raw) {
    return loadMcpRegistry().filter((server) => server.enabled).map((server) => server.id)
  }

  try {
    const parsed = JSON.parse(raw)
    return asStringArray(parsed)
  } catch {
    return loadMcpRegistry().filter((server) => server.enabled).map((server) => server.id)
  }
}

export function saveEnabledMcpIds(ids: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MCP_ENABLED_KEY, JSON.stringify([...new Set(ids)]))
}

export function buildActiveMcpServers(servers: McpServerConfig[], enabledIds: string[]) {
  const enabledSet = new Set(enabledIds)
  return servers
    .map((server) => ({ ...server, enabled: enabledSet.has(server.id) }))
    .filter((server) => server.enabled)
}

export function withDefaultMcpServers(custom: McpServerConfig[]) {
  const merged = new Map<string, McpServerConfig>()
  for (const server of DEFAULT_MCP_SERVERS) merged.set(server.id, server)
  for (const server of custom) merged.set(server.id, server)
  return [...merged.values()]
}
