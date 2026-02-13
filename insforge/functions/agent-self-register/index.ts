import { createClient } from 'npm:@insforge/sdk'

type AgentStatus = 'active' | 'idle' | 'error' | 'offline'
type AssignmentPriority = 'high' | 'medium' | 'low'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Register-Secret, X-OpenClaw-Secret',
}

const ALLOWED_STATUSES = new Set<AgentStatus>(['active', 'idle', 'error', 'offline'])
const ALLOWED_PRIORITIES = new Set<AssignmentPriority>(['high', 'medium', 'low'])

const DEFAULT_AGENT_SKILLS = [
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

const DEFAULT_MCP_TOOLS = [
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

const DEFAULT_MCP_SERVERS = [
  {
    id: 'insforge-core',
    name: 'InsForge Core MCP',
    category: 'backend',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@insforge/mcp'],
    env: ['INSFORGE_API_KEY', 'INSFORGE_API_BASE_URL'],
    enabled: true,
  },
  {
    id: 'mcp-client',
    name: 'Universal MCP Client',
    category: 'orchestration',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/client'],
    enabled: true,
  },
  {
    id: 'filesystem',
    name: 'Filesystem MCP',
    category: 'core',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    enabled: true,
  },
  {
    id: 'brave-search',
    name: 'Brave Search MCP',
    category: 'research',
    transport: 'sse',
    endpoint: 'https://api.search.brave.com/res/v1/web/search',
    env: ['BRAVE_API_KEY'],
    enabled: true,
  },
  {
    id: 'github',
    name: 'GitHub MCP',
    category: 'devops',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: ['GITHUB_TOKEN'],
    enabled: true,
  },
  {
    id: 'playwright-browser',
    name: 'Playwright Browser MCP',
    category: 'research',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp'],
    enabled: true,
  },
  {
    id: 'n8n',
    name: 'n8n MCP',
    category: 'automation',
    transport: 'http',
    endpoint: 'https://n8n.your-domain.com/mcp',
    env: ['N8N_BASE_URL', 'N8N_API_KEY'],
    enabled: true,
  },
  {
    id: 'livekit',
    name: 'LiveKit Voice MCP',
    category: 'voice',
    transport: 'http',
    endpoint: 'https://livekit.your-domain.com/mcp',
    env: ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_WS_URL'],
    enabled: true,
  },
  {
    id: 'shopify',
    name: 'Shopify MCP',
    category: 'commerce',
    transport: 'http',
    endpoint: 'https://shopify.your-domain.com/mcp',
    env: ['SHOPIFY_ADMIN_TOKEN'],
    enabled: true,
  },
  {
    id: 'telegram',
    name: 'Telegram MCP',
    category: 'communications',
    transport: 'http',
    endpoint: 'https://telegram.your-domain.com/mcp',
    env: ['TELEGRAM_BOT_TOKEN'],
    enabled: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter MCP',
    category: 'models',
    transport: 'http',
    endpoint: 'https://openrouter.ai/api/v1',
    env: ['OPENROUTER_API_KEY'],
    enabled: true,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face MCP',
    category: 'models',
    transport: 'http',
    endpoint: 'https://huggingface.co/api',
    env: ['HUGGINGFACE_TOKEN'],
    enabled: true,
  },
  {
    id: 'gemini',
    name: 'Gemini MCP',
    category: 'models',
    transport: 'http',
    endpoint: 'https://generativelanguage.googleapis.com',
    env: ['GEMINI_API_KEY'],
    enabled: true,
  },
  {
    id: 'aragon',
    name: 'Aragon DAO MCP',
    category: 'dao',
    transport: 'http',
    endpoint: 'https://aragon.your-domain.com/mcp',
    enabled: true,
  },
  {
    id: 'olympus',
    name: 'Olympus DAO MCP',
    category: 'dao',
    transport: 'http',
    endpoint: 'https://olympus.your-domain.com/mcp',
    enabled: true,
  },
  {
    id: 'proxy-gateway',
    name: 'Proxy Gateway MCP',
    category: 'network',
    transport: 'http',
    endpoint: 'https://proxy.your-domain.com/mcp',
    env: ['AGENT_PROXY_URL', 'AGENT_PROXY_KEY'],
    enabled: true,
  },
  {
    id: 'ssh-exec',
    name: 'SSH Execute MCP',
    category: 'infrastructure',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-ssh'],
    env: ['SSH_PRIVATE_KEY', 'SSH_TARGETS'],
    enabled: true,
  },
]

function getDefaultOperatingProfile(baseUrl: string) {
  return {
    version: '2026.02.master',
    internet: {
      provider: 'brave',
      endpoint: 'https://api.search.brave.com/res/v1/web/search',
      enabled: true,
    },
    automationBridge: {
      endpoint: `${baseUrl.replace(/\/+$/, '')}/functions/agent-automation-bridge`,
      actions: [
        'web_search',
        'shopify_store_snapshot',
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
      shopify: true,
      openrouter: true,
      huggingface: true,
      gemini: true,
      proxyGateway: true,
      daoLaunch: true,
    },
    mcp: {
      enabled: true,
      defaultTools: DEFAULT_MCP_TOOLS,
      servers: DEFAULT_MCP_SERVERS,
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
        'shopify-store-signals',
      ],
    },
  }
}

function mergeAgentConfigWithDefaults(config: Record<string, unknown>, baseUrl: string) {
  const profile = getDefaultOperatingProfile(baseUrl)
  const current = isRecord(config) ? config : {}
  const currentProfile = parsePayload(current.operatingProfile)
  const currentIntegrations = parsePayload(currentProfile.integrations || current.integrations)
  const currentInternet = parsePayload(currentProfile.internet || current.internet)
  const currentMcp = parsePayload(currentProfile.mcp)
  const currentBridge = parsePayload(currentProfile.automationBridge)
  const currentAutoEnhancement = parsePayload(currentProfile.autoEnhancement)

  const currentSkills = asArrayOfStrings(currentProfile.skills || current.skills, 128)
  const currentTools = asArrayOfStrings(currentMcp.defaultTools || current.mcpTools, 256)
  const currentActions = asArrayOfStrings(currentBridge.actions, 128)
  const currentSources = asArrayOfStrings(currentAutoEnhancement.sources, 128)

  const mergedSkills = [...new Set([...profile.skills, ...currentSkills])]
  const mergedTools = [...new Set([...profile.mcp.defaultTools, ...currentTools])]
  const mergedActions = [...new Set([...profile.automationBridge.actions, ...currentActions])]
  const mergedSources = [...new Set([...profile.autoEnhancement.sources, ...currentSources])]

  const currentServers = Array.isArray(currentMcp.servers)
    ? currentMcp.servers.filter((entry) => isRecord(entry))
    : []
  const mergedServerMap = new Map<string, Record<string, unknown>>()
  for (const server of profile.mcp.servers) mergedServerMap.set(asString(server.id), server as Record<string, unknown>)
  for (const server of currentServers as Record<string, unknown>[]) {
    const id = asString(server.id)
    if (!id) continue
    mergedServerMap.set(id, server)
  }
  const mergedServers = [...mergedServerMap.values()]

  return {
    ...current,
    operatingProfile: {
      ...profile,
      ...currentProfile,
      integrations: {
        ...profile.integrations,
        ...currentIntegrations,
      },
      internet: {
        ...profile.internet,
        ...currentInternet,
      },
      skills: mergedSkills,
      mcp: {
        ...profile.mcp,
        ...currentMcp,
        defaultTools: mergedTools,
        servers: mergedServers,
      },
      automationBridge: {
        ...profile.automationBridge,
        ...currentBridge,
        actions: mergedActions,
      },
      autoEnhancement: {
        ...profile.autoEnhancement,
        ...currentAutoEnhancement,
        sources: mergedSources,
      },
    },
    integrations: {
      ...profile.integrations,
      ...currentIntegrations,
    },
    internet: {
      ...profile.internet,
      ...currentInternet,
    },
    skills: mergedSkills,
    mcpTools: mergedTools,
    mcpServers: mergedServers,
  }
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asArrayOfStrings(value: unknown, maxItems = 32): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizeStatus(value: unknown): AgentStatus {
  const status = asString(value, 'active').toLowerCase() as AgentStatus
  return ALLOWED_STATUSES.has(status) ? status : 'active'
}

function normalizePriority(value: unknown): AssignmentPriority {
  const priority = asString(value, 'medium').toLowerCase() as AssignmentPriority
  return ALLOWED_PRIORITIES.has(priority) ? priority : 'medium'
}

function generateAgentApiKey(): string {
  return crypto.randomUUID()
}

function parsePayload(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

async function findAgentByExternalId(client: ReturnType<typeof createClient>, externalId: string) {
  if (!externalId) return null
  const { data, error } = await client.database
    .from('agents')
    .select('id, name, role, status, model, api_key, config')
    .limit(1000)

  if (error) {
    throw new Error(`Failed reading agents: ${error.message}`)
  }

  const rows = (data || []) as Record<string, unknown>[]
  return (
    rows.find((row) => {
      const config = parsePayload(row.config)
      const configExternalId = asString(config.externalId || config.external_id)
      return configExternalId === externalId
    }) || null
  )
}

async function ensureBusinessAssignment(
  client: ReturnType<typeof createClient>,
  params: {
    agentId: string
    businessId: string
    role: string
    priority: AssignmentPriority
    instructions: string
  },
) {
  const existingAssignment = await client.database
    .from('agent_assignments')
    .select('id, status')
    .eq('agent_id', params.agentId)
    .eq('business_id', params.businessId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingAssignment.error) {
    throw new Error(`Failed reading assignments: ${existingAssignment.error.message}`)
  }

  const assignment = (existingAssignment.data || [])[0] as Record<string, unknown> | undefined
  if (assignment?.id) {
    const updateResult = await client.database
      .from('agent_assignments')
      .update({
        role: params.role,
        instructions: params.instructions,
        priority: params.priority,
        status: 'active',
      })
      .eq('id', assignment.id as string)

    if (updateResult.error) {
      throw new Error(`Failed updating assignment: ${updateResult.error.message}`)
    }
  } else {
    const insertResult = await client.database.from('agent_assignments').insert({
      agent_id: params.agentId,
      business_id: params.businessId,
      role: params.role,
      instructions: params.instructions,
      priority: params.priority,
      status: 'active',
    })

    if (insertResult.error) {
      throw new Error(`Failed creating assignment: ${insertResult.error.message}`)
    }
  }

  const businessResult = await client.database
    .from('businesses')
    .select('id, agents')
    .eq('id', params.businessId)
    .maybeSingle()

  if (businessResult.error || !businessResult.data) return

  const business = businessResult.data as Record<string, unknown>
  const existingAgents = Array.isArray(business.agents)
    ? business.agents.filter((value): value is string => typeof value === 'string')
    : []

  if (!existingAgents.includes(params.agentId)) {
    await client.database
      .from('businesses')
      .update({ agents: [...existingAgents, params.agentId] })
      .eq('id', params.businessId)
  }
}

async function ensureSession(client: ReturnType<typeof createClient>, agentId: string, source: string, externalId: string) {
  const sessionInsert = await client.database.from('sessions').insert({
    agent_id: agentId,
    active: true,
    tokens: 0,
    metadata: {
      source,
      externalId: externalId || null,
      selfRegistered: true,
      createdAt: new Date().toISOString(),
    },
  })

  if (sessionInsert.error) {
    throw new Error(`Failed creating session: ${sessionInsert.error.message}`)
  }
}

async function writeActivity(
  client: ReturnType<typeof createClient>,
  payload: { agentId: string; agentName: string; message: string; type: 'success' | 'info' | 'warning' | 'error' },
) {
  await client.database.from('activity_log').insert({
    agent_id: payload.agentId,
    agent_name: payload.agentName,
    message: payload.message,
    type: payload.type,
  })
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const rawPayload = await req.json().catch(() => null)
    const payload = parsePayload(rawPayload)

    const requiredSecret = Deno.env.get('SELF_REGISTER_SECRET')
    const providedSecret =
      req.headers.get('X-Agent-Register-Secret') ||
      req.headers.get('x-agent-register-secret') ||
      req.headers.get('X-OpenClaw-Secret') ||
      req.headers.get('x-openclaw-secret') ||
      asString(payload.registerSecret || payload.register_secret)

    if (requiredSecret && providedSecret !== requiredSecret) {
      return jsonResponse({ error: 'Unauthorized: invalid self-register secret' }, 401)
    }

    const baseUrl = Deno.env.get('INSFORGE_BASE_URL') || Deno.env.get('VITE_INSFORGE_BASE_URL')
    const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('INSFORGE_ANON_KEY')

    if (!baseUrl || !anonKey) {
      return jsonResponse(
        { error: 'Function misconfigured: missing INSFORGE_BASE_URL/VITE_INSFORGE_BASE_URL or ANON_KEY/INSFORGE_ANON_KEY' },
        500,
      )
    }

    const client = createClient({ baseUrl, anonKey })

    const name = asString(payload.name)
    const role = asString(payload.role)
    const model = asString(payload.model, 'gpt-4o-mini')
    const emoji = asString(payload.emoji, '🤖')
    const description = asString(payload.description || payload.mission)
    const source = asString(payload.source, 'openclaw')
    const externalId = asString(payload.externalId || payload.external_id)
    const status = normalizeStatus(payload.status)
    const capabilities = asArrayOfStrings(payload.capabilities)
    const metadata = parsePayload(payload.metadata)
    const startSession = asBoolean(payload.startSession ?? payload.start_session, true)

    const assignmentPayload = parsePayload(payload.assignment)
    const businessId = asString(
      assignmentPayload.businessId || assignmentPayload.business_id || payload.businessId || payload.business_id,
    )
    const assignmentRole = asString(assignmentPayload.role, role || 'Operator')
    const assignmentPriority = normalizePriority(assignmentPayload.priority || payload.priority)
    const assignmentInstructions = asString(
      assignmentPayload.instructions || payload.instructions || description,
      'Execute assigned operator objectives.',
    )

    if (!name || !role) {
      return jsonResponse({ error: 'name and role are required fields' }, 400)
    }

    let existingAgent = await findAgentByExternalId(client, externalId)

    if (existingAgent) {
      const existingId = asString(existingAgent.id)
      let existingApiKey = asString(existingAgent.api_key)
      const nowIso = new Date().toISOString()
      const mergedConfig = mergeAgentConfigWithDefaults(parsePayload(existingAgent.config), baseUrl)

      if (!existingApiKey) {
        existingApiKey = generateAgentApiKey()
      }

      const heartbeatUpdate = await client.database
        .from('agents')
        .update({
          api_key: existingApiKey,
          status,
          model,
          last_active: nowIso,
          config: mergedConfig,
        })
        .eq('id', existingId)

      if (heartbeatUpdate.error) {
        throw new Error(`Failed updating agent heartbeat: ${heartbeatUpdate.error.message}`)
      }

      if (startSession) {
        await ensureSession(client, existingId, source, externalId)
      }

      if (businessId) {
        await ensureBusinessAssignment(client, {
          agentId: existingId,
          businessId,
          role: assignmentRole,
          priority: assignmentPriority,
          instructions: assignmentInstructions,
        })
      }

      await writeActivity(client, {
        agentId: existingId,
        agentName: asString(existingAgent.name, name),
        message: `self-register heartbeat received from ${source}${externalId ? ` (${externalId})` : ''}`,
        type: 'info',
      })

      return jsonResponse({
        ok: true,
        created: false,
        agent: {
          id: existingId,
          name: asString(existingAgent.name, name),
          role: asString(existingAgent.role, role),
          status: asString(existingAgent.status, status),
          model: asString(existingAgent.model, model),
          apiKey: existingApiKey,
        },
        onboarding: {
          baseUrl,
          selfRegisterSlug: 'agent-self-register',
          tables: {
            agents: 'agents',
            sessions: 'sessions',
            activity: 'activity_log',
            assignments: 'agent_assignments',
            messages: 'agent_messages',
          },
          suggestedHeartbeatSeconds: 60,
          defaultsInjected: true,
          defaultSkills: DEFAULT_AGENT_SKILLS,
          defaultMcpTools: DEFAULT_MCP_TOOLS,
          defaultMcpServers: DEFAULT_MCP_SERVERS.map((server) => ({
            id: server.id,
            name: server.name,
            transport: server.transport,
          })),
        },
      })
    }

    const newApiKey = generateAgentApiKey()
    const now = new Date().toISOString()

    const insertResult = await client.database
      .from('agents')
      .insert({
        name,
        role,
        status,
        model,
        emoji,
        description,
        tasks: 0,
        completed_tasks: 0,
        token_usage: 0,
        last_active: now,
        api_key: newApiKey,
        config: mergeAgentConfigWithDefaults({
          source,
          externalId: externalId || null,
          capabilities,
          metadata,
          selfRegistered: true,
          registeredAt: now,
          registrationMethod: 'agent-self-register',
        }, baseUrl),
      })
      .select()

    if (insertResult.error || !insertResult.data?.[0]) {
      return jsonResponse({ error: insertResult.error?.message || 'Failed to create agent' }, 500)
    }

    const createdAgent = insertResult.data[0] as Record<string, unknown>
    const createdId = asString(createdAgent.id)

    if (startSession) {
      await ensureSession(client, createdId, source, externalId)
    }

    if (businessId) {
      await ensureBusinessAssignment(client, {
        agentId: createdId,
        businessId,
        role: assignmentRole,
        priority: assignmentPriority,
        instructions: assignmentInstructions,
      })
    }

    await writeActivity(client, {
      agentId: createdId,
      agentName: name,
      message: `self-registered via ${source}${externalId ? ` (${externalId})` : ''}`,
      type: 'success',
    })

    existingAgent = createdAgent

    return jsonResponse({
      ok: true,
      created: true,
      agent: {
        id: createdId,
        name: asString(existingAgent.name, name),
        role: asString(existingAgent.role, role),
        status: asString(existingAgent.status, status),
        model: asString(existingAgent.model, model),
        apiKey: newApiKey,
      },
      onboarding: {
        baseUrl,
        selfRegisterSlug: 'agent-self-register',
        tables: {
          agents: 'agents',
          sessions: 'sessions',
          activity: 'activity_log',
          assignments: 'agent_assignments',
          messages: 'agent_messages',
        },
        suggestedHeartbeatSeconds: 60,
        defaultsInjected: true,
        defaultSkills: DEFAULT_AGENT_SKILLS,
        defaultMcpTools: DEFAULT_MCP_TOOLS,
        defaultMcpServers: DEFAULT_MCP_SERVERS.map((server) => ({
          id: server.id,
          name: server.name,
          transport: server.transport,
        })),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected self-register error'
    return jsonResponse({ error: message }, 500)
  }
}
