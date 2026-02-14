import { createClient } from 'npm:@insforge/sdk'
import { AccessToken } from 'npm:livekit-server-sdk'

type Action =
  | 'web_search'
  | 'discover_provider_updates'
  | 'create_dao_deployment_task'
  | 'shopify_store_snapshot'
  | 'create_n8n_workflow'
  | 'request_livekit_session'
  | 'synthesize_tts'
  | 'execute_remote_command'
  | 'import_sip_numbers'
  | 'post_forum_update'
  | 'comment_forum_post'

type ProviderUpdateItem = {
  provider: string
  ok: boolean
  checkedAt: string
  models?: Array<Record<string, unknown>>
  count?: number
  warning?: string
}

const KNOWN_SIP_PORT_PROVIDERS = [
  { provider: 'twilio', porting: 'available', channels: ['voice', 'sms', 'sip-trunking'] },
  { provider: 'telnyx', porting: 'available', channels: ['voice', 'sms', 'sip-trunking'] },
  { provider: 'plivo', porting: 'available', channels: ['voice', 'sms', 'sip-trunking'] },
  { provider: 'bandwidth', porting: 'available', channels: ['voice', 'sms', 'emergency'] },
  { provider: 'vonage', porting: 'available', channels: ['voice', 'sms'] },
  { provider: 'signalwire', porting: 'available', channels: ['voice', 'sms', 'sip-trunking'] },
  { provider: 'flowroute', porting: 'check-provider', channels: ['voice', 'sip-trunking'] },
  { provider: 'voipms', porting: 'check-provider', channels: ['voice', 'sip-trunking'] },
  { provider: 'openphone', porting: 'available', channels: ['voice', 'sms'] },
  { provider: 'aircall', porting: 'available', channels: ['voice'] },
  { provider: 'ringcentral', porting: 'available', channels: ['voice', 'sms'] },
  { provider: 'dialpad', porting: 'available', channels: ['voice', 'sms'] },
]

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Agent-Id, X-Agent-Api-Key, X-Agent-Automation-Secret',
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
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

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function asStringArray(value: unknown, maxItems = 64): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asString(entry))
    .filter(Boolean)
    .slice(0, maxItems)
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)))
  }
  return btoa(binary)
}

function resolveAuthHeader(req: Request): string {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return ''
  return authHeader.slice(7).trim()
}

function extractWebhookPathFromNodes(workflow: Record<string, unknown>): string {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
  for (const node of nodes) {
    if (!isRecord(node)) continue
    const type = asString(node.type).toLowerCase()
    if (!type.includes('webhook')) continue
    const params = parseRecord(node.parameters)
    const path = asString(params.path)
    if (!path) continue
    return path.replace(/^\/+/, '')
  }
  return ''
}

function extractN8nWorkflowId(value: unknown): string {
  if (!isRecord(value)) return ''
  return asString(value.id || value.workflowId || value.workflow_id)
}

async function validateAgent(
  client: ReturnType<typeof createClient>,
  agentId: string,
  providedApiKey: string,
): Promise<Record<string, unknown>> {
  const result = await client.database
    .from('agents')
    .select('id, name, role, api_key, status')
    .eq('id', agentId)
    .maybeSingle()

  if (result.error || !result.data) {
    throw new Error('Agent authentication failed: unknown agent')
  }

  const agent = result.data as Record<string, unknown>
  const expectedKey = asString(agent.api_key)
  if (!expectedKey || expectedKey !== providedApiKey) {
    throw new Error('Agent authentication failed: invalid api key')
  }

  return agent
}

async function writeActivity(
  client: ReturnType<typeof createClient>,
  params: { agentId: string; agentName: string; message: string; type: 'success' | 'info' | 'warning' | 'error' },
) {
  await client.database.from('activity_log').insert({
    agent_id: params.agentId,
    agent_name: params.agentName,
    message: params.message,
    type: params.type,
  })
}

async function getOrCreateForumChannel(client: ReturnType<typeof createClient>) {
  const existing = await client.database
    .from('agent_channels')
    .select('id, name, slug')
    .eq('slug', 'agent-forum')
    .maybeSingle()

  if (existing.error) {
    throw new Error(`Failed reading forum channels: ${existing.error.message}`)
  }

  if (existing.data) {
    return existing.data as Record<string, unknown>
  }

  const created = await client.database
    .from('agent_channels')
    .insert({
      name: 'Agent Forum',
      slug: 'agent-forum',
      description: 'Peer-to-peer progress reports, ideas, and collaboration.',
      members: [],
      is_private: false,
    })
    .select()
    .single()

  if (created.error || !created.data) {
    throw new Error(created.error?.message || 'Failed creating agent forum channel')
  }

  return created.data as Record<string, unknown>
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asString(entry))
      .filter(Boolean)
      .slice(0, 10)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 10)
  }

  return []
}

async function postForumUpdateForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const title = asString(payload.title, 'Agent Update')
  const message = asString(payload.message || payload.body)
  const tags = parseTags(payload.tags)
  const project = asString(payload.project)
  const status = asString(payload.status, 'open')
  const businessId = asString(payload.businessId || payload.business_id)

  if (!message) {
    throw new Error('message is required for forum posts')
  }

  const forumChannel = await getOrCreateForumChannel(client)
  const channelId = asString(forumChannel.id)

  const insert = await client.database
    .from('channel_messages')
    .insert({
      channel_id: channelId,
      sender_type: 'agent',
      sender_id: agentId,
      sender_name: agentName,
      message,
      metadata: {
        kind: 'forum_post',
        title,
        tags,
        project: project || null,
        status,
        business_id: businessId || null,
      },
    })
    .select()
    .single()

  if (insert.error || !insert.data) {
    throw new Error(insert.error?.message || 'Failed creating forum post')
  }

  await writeActivity(client, {
    agentId,
    agentName,
    message: `posted forum update "${title}"`,
    type: 'success',
  })

  return {
    ok: true,
    action: 'post_forum_update',
    post: insert.data,
    forum: {
      channelId,
      channelSlug: 'agent-forum',
    },
  }
}

async function commentForumPostForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const postId = asString(payload.postId || payload.post_id)
  const message = asString(payload.message || payload.body)

  if (!postId || !message) {
    throw new Error('postId and message are required for forum comments')
  }

  const forumChannel = await getOrCreateForumChannel(client)
  const channelId = asString(forumChannel.id)

  const insert = await client.database
    .from('channel_messages')
    .insert({
      channel_id: channelId,
      sender_type: 'agent',
      sender_id: agentId,
      sender_name: agentName,
      message,
      metadata: {
        kind: 'forum_comment',
        post_id: postId,
      },
    })
    .select()
    .single()

  if (insert.error || !insert.data) {
    throw new Error(insert.error?.message || 'Failed creating forum comment')
  }

  await writeActivity(client, {
    agentId,
    agentName,
    message: `commented on forum post ${postId}`,
    type: 'info',
  })

  return {
    ok: true,
    action: 'comment_forum_post',
    comment: insert.data,
    forum: {
      channelId,
      channelSlug: 'agent-forum',
    },
  }
}

async function webSearchForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const query = asString(payload.query || payload.q)
  if (!query) {
    throw new Error('query is required for web_search')
  }

  const count = Math.min(Math.max(Math.round(asNumber(payload.count, 8)), 1), 20)
  const endpoint = asString(payload.endpoint, 'https://api.search.brave.com/res/v1/web/search')
  const freshness = asString(payload.freshness)
  const braveApiKey = asString(payload.braveApiKey || payload.brave_api_key || Deno.env.get('BRAVE_API_KEY'))

  if (!braveApiKey) {
    throw new Error('Missing BRAVE_API_KEY (env) or braveApiKey in payload')
  }

  const params = new URLSearchParams({ q: query, count: String(count) })
  if (freshness) params.set('freshness', freshness)

  const { response, body } = await fetchJson(`${endpoint}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': braveApiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Brave search failed (${response.status})`)
  }

  const web = parseRecord((body as Record<string, unknown>).web)
  const rawResults = Array.isArray(web.results) ? web.results : []

  const results = rawResults
    .slice(0, count)
    .filter((entry) => isRecord(entry))
    .map((entry) => ({
      title: asString(entry.title),
      url: asString(entry.url),
      description: asString(entry.description),
      age: asString(entry.age),
      language: asString(entry.language),
      source: asString(entry.source),
    }))

  await writeActivity(client, {
    agentId,
    agentName,
    message: `ran Brave search: "${query}" (${results.length} results)`,
    type: 'info',
  })

  return {
    ok: true,
    action: 'web_search',
    provider: 'brave',
    query,
    count: results.length,
    results,
  }
}

async function discoverProviderUpdatesForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const requestedProviders = asStringArray(payload.providers).map((value) => value.toLowerCase())
  const shouldCheck = (name: string) => requestedProviders.length === 0 || requestedProviders.includes(name)
  const providerUpdates: ProviderUpdateItem[] = []
  const checkedAt = new Date().toISOString()

  if (shouldCheck('openrouter')) {
    try {
      const { response, body } = await fetchJson('https://openrouter.ai/api/v1/models')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = Array.isArray((body as Record<string, unknown>).data)
        ? ((body as Record<string, unknown>).data as unknown[])
        : []
      const models = data
        .filter((entry) => isRecord(entry))
        .slice(0, 25)
        .map((entry) => ({
          id: asString(entry.id),
          name: asString(entry.name),
          context_length: asNumber(entry.context_length, 0),
          top_provider: asString(parseRecord(entry.top_provider).name),
        }))

      providerUpdates.push({
        provider: 'openrouter',
        ok: true,
        checkedAt,
        count: data.length,
        models,
      })
    } catch (error) {
      providerUpdates.push({
        provider: 'openrouter',
        ok: false,
        checkedAt,
        warning: error instanceof Error ? error.message : 'OpenRouter check failed',
      })
    }
  }

  if (shouldCheck('huggingface')) {
    try {
      const hfToken = asString(payload.huggingFaceToken || payload.huggingfaceToken || Deno.env.get('HUGGINGFACE_TOKEN'))
      const { response, body } = await fetchJson(
        'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=20',
        {
          headers: hfToken ? { Authorization: `Bearer ${hfToken}` } : undefined,
        },
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const rows = Array.isArray(body) ? body : []
      const models = rows
        .filter((entry) => isRecord(entry))
        .slice(0, 20)
        .map((entry) => ({
          id: asString(entry.id || entry.modelId),
          pipeline: asString(entry.pipeline_tag),
          likes: asNumber(entry.likes, 0),
          downloads: asNumber(entry.downloads, 0),
          updated: asString(entry.lastModified),
        }))

      providerUpdates.push({
        provider: 'huggingface',
        ok: true,
        checkedAt,
        count: rows.length,
        models,
      })
    } catch (error) {
      providerUpdates.push({
        provider: 'huggingface',
        ok: false,
        checkedAt,
        warning: error instanceof Error ? error.message : 'HuggingFace check failed',
      })
    }
  }

  if (shouldCheck('gemini')) {
    const geminiApiKey = asString(payload.geminiApiKey || payload.googleApiKey || Deno.env.get('GEMINI_API_KEY'))
    if (!geminiApiKey) {
      providerUpdates.push({
        provider: 'gemini',
        ok: false,
        checkedAt,
        warning: 'Set GEMINI_API_KEY (env) or geminiApiKey in payload to discover Gemini model list.',
      })
    } else {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(geminiApiKey)}`
        const { response, body } = await fetchJson(endpoint)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const rows = Array.isArray((body as Record<string, unknown>).models)
          ? ((body as Record<string, unknown>).models as unknown[])
          : []
        const models = rows
          .filter((entry) => isRecord(entry))
          .slice(0, 30)
          .map((entry) => ({
            name: asString(entry.name),
            displayName: asString(entry.displayName),
            description: asString(entry.description),
            inputTokenLimit: asNumber(entry.inputTokenLimit, 0),
          }))

        providerUpdates.push({
          provider: 'gemini',
          ok: true,
          checkedAt,
          count: rows.length,
          models,
        })
      } catch (error) {
        providerUpdates.push({
          provider: 'gemini',
          ok: false,
          checkedAt,
          warning: error instanceof Error ? error.message : 'Gemini check failed',
        })
      }
    }
  }

  if (shouldCheck('sip')) {
    const preferredSipProviders = asStringArray(payload.sipProviders || payload.sip_providers).map((entry) =>
      entry.toLowerCase(),
    )
    const sipRows = KNOWN_SIP_PORT_PROVIDERS.map((entry) => ({
      ...entry,
      preferred: preferredSipProviders.includes(entry.provider),
    }))

    providerUpdates.push({
      provider: 'sip',
      ok: true,
      checkedAt,
      count: sipRows.length,
      models: sipRows as unknown as Array<Record<string, unknown>>,
    })
  }

  const okCount = providerUpdates.filter((entry) => entry.ok).length
  const warningCount = providerUpdates.length - okCount

  const forumSummaryLines = providerUpdates.map((entry) => {
    if (entry.ok) return `- ${entry.provider}: ${entry.count || 0} items`
    return `- ${entry.provider}: warning (${entry.warning || 'check failed'})`
  })

  const postToForum = asBoolean(payload.postForumUpdate ?? payload.post_forum_update, true)
  let forumPostId: string | null = null
  if (postToForum) {
    try {
      const forumResult = await postForumUpdateForAgent(
        client,
        {
          title: 'Provider Discovery Sweep',
          message: `Provider checks completed at ${checkedAt}\n${forumSummaryLines.join('\n')}`,
          tags: ['providers', 'models', 'sip'],
          status: warningCount > 0 ? 'open' : 'in_progress',
        },
        agent,
      )
      forumPostId = asString(parseRecord(forumResult.post).id) || null
    } catch {
      forumPostId = null
    }
  }

  await writeActivity(client, {
    agentId,
    agentName,
    message: `provider discovery completed (${okCount}/${providerUpdates.length} successful checks)`,
    type: warningCount > 0 ? 'warning' : 'success',
  })

  return {
    ok: true,
    action: 'discover_provider_updates',
    checkedAt,
    summary: {
      total: providerUpdates.length,
      successful: okCount,
      warnings: warningCount,
    },
    providers: providerUpdates,
    forumPostId,
  }
}

async function createDaoDeploymentTaskForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const daoName = asString(payload.daoName || payload.name)
  if (!daoName) {
    throw new Error('daoName (or name) is required')
  }

  const daoProvider = asString(payload.daoProvider || payload.provider, 'aragon')
  const chain = asString(payload.chain, 'ethereum')
  const tokenSymbol = asString(payload.tokenSymbol || payload.symbol, slugify(daoName).slice(0, 6).toUpperCase())
  const tokenSupply = asString(payload.tokenSupply || payload.supply, '1000000')
  const governanceModel = asString(payload.governanceModel, 'token-weighted')
  const treasuryAddress = asString(payload.treasuryAddress || payload.treasury, 'TBD')
  const launchDate = asString(payload.launchDate || payload.launch_date, new Date(Date.now() + 86400000).toISOString())
  const objective = asString(payload.objective, 'Launch a DAO governance stack with treasury and proposal workflows.')

  const checklist = [
    `Finalize charter and legal wrapper for ${daoName}.`,
    `Deploy governance contracts using ${daoProvider} on ${chain}.`,
    `Mint ${tokenSupply} ${tokenSymbol} tokens with allocation policy.`,
    `Set quorum/threshold parameters for ${governanceModel} governance.`,
    `Wire treasury actions into n8n approval and audit workflows.`,
    'Publish contributor onboarding + forum governance handbook.',
  ]

  const createWorkflow = asBoolean(payload.createWorkflow ?? payload.create_workflow, true)
  let workflowResult: Record<string, unknown> | null = null
  if (createWorkflow) {
    const workflowResponse = await createN8nWorkflowForAgent(
      client,
      {
        name: `${daoName} DAO Launch`,
        description: `DAO deployment workflow for ${daoName} (${daoProvider}/${chain})`,
        triggerUrl: asString(payload.triggerUrl || payload.trigger_url),
        is_active: true,
        n8nBaseUrl: asString(payload.n8nBaseUrl),
        n8nApiKey: asString(payload.n8nApiKey),
      },
      agent,
    )
    workflowResult = parseRecord(workflowResponse.workflow)
  }

  const forumResult = await postForumUpdateForAgent(
    client,
    {
      title: `${daoName} DAO Deployment Task`,
      message: `${objective}\n\nChecklist:\n${checklist.map((step) => `- ${step}`).join('\n')}`,
      tags: ['dao', daoProvider, chain, tokenSymbol.toLowerCase()],
      status: 'open',
      project: daoName,
    },
    agent,
  )

  const forumPostId = asString(parseRecord(forumResult.post).id)

  await writeActivity(client, {
    agentId,
    agentName,
    message: `created DAO deployment task "${daoName}" (${daoProvider}/${chain})`,
    type: 'success',
  })

  return {
    ok: true,
    action: 'create_dao_deployment_task',
    task: {
      daoName,
      provider: daoProvider,
      chain,
      tokenSymbol,
      tokenSupply,
      governanceModel,
      treasuryAddress,
      launchDate,
      objective,
      checklist,
      forumPostId,
    },
    workflow: workflowResult,
  }
}

async function fetchAgentNames(client: ReturnType<typeof createClient>) {
  const result = await client.database.from('agents').select('id, name').limit(5000)
  if (result.error) return new Map<string, string>()

  const map = new Map<string, string>()
  const rows = (result.data || []) as Record<string, unknown>[]
  for (const row of rows) {
    const id = asString(row.id)
    const name = asString(row.name)
    if (id && name) map.set(id, name)
  }
  return map
}

async function importSipNumbersForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const numbers = Array.isArray(payload.numbers) ? payload.numbers : []

  if (numbers.length === 0) {
    throw new Error('numbers array is required')
  }

  const defaultProvider = asString(payload.provider, 'voip_sip')
  const defaultStatus = asString(payload.status, 'active')
  const defaultAgentId = asString(payload.assignAgentId || payload.assign_agent_id || agentId)
  const defaultAction = asString(payload.routingAction || payload.routing_action, 'ai_answer')
  const defaultFallback = asString(payload.routingFallback || payload.routing_fallback, 'voicemail')

  const agentNameMap = await fetchAgentNames(client)

  let inserted = 0
  let updated = 0
  const warnings: string[] = []
  const importedNumbers: Array<{ phone_number: string; workflow_id?: string | null }> = []

  for (const entry of numbers) {
    if (!isRecord(entry)) continue

    const phoneNumber = asString(entry.phone_number || entry.phoneNumber)
    if (!phoneNumber) {
      warnings.push('Skipped entry without phone_number')
      continue
    }

    const provider = asString(entry.provider, defaultProvider)
    const label = asString(entry.label || entry.name)
    const capabilitiesRaw = Array.isArray(entry.capabilities)
      ? entry.capabilities
      : (payload.capabilities as unknown[] | undefined)
    const capabilities = (capabilitiesRaw || ['voice'])
      .map((value) => asString(value))
      .filter(Boolean)
    if (!capabilities.includes('voice')) capabilities.push('voice')

    const prompt = asString(entry.prompt || entry.system_prompt || entry.agent_prompt)
    const targetAgentId = asString(entry.agent_id || entry.agentId, defaultAgentId)
    const targetAgentName = agentNameMap.get(targetAgentId) || null

    const workflowName = asString(entry.workflow_name || entry.workflowName)
    const workflowTriggerUrl = asString(entry.workflow_trigger_url || entry.workflowTriggerUrl)
    let workflowId: string | null = null
    let linkedTriggerUrl = workflowTriggerUrl || null

    if (workflowName || workflowTriggerUrl) {
      try {
        const workflowResult = await createN8nWorkflowForAgent(
          client,
          {
            name: workflowName || `${label || phoneNumber} Workflow`,
            description: asString(entry.workflow_description || entry.workflowDescription),
            triggerUrl: workflowTriggerUrl,
            is_active: true,
            n8nBaseUrl: asString(entry.n8n_base_url || entry.n8nBaseUrl || payload.n8nBaseUrl),
            n8nApiKey: asString(entry.n8n_api_key || entry.n8nApiKey || payload.n8nApiKey),
          },
          agent,
        )
        const workflowRecord = parseRecord(workflowResult.workflow)
        workflowId = asString(workflowRecord.id) || null
        linkedTriggerUrl = asString(workflowRecord.trigger_url) || linkedTriggerUrl
      } catch (error) {
        const message = error instanceof Error ? error.message : 'workflow creation failed'
        warnings.push(`${phoneNumber}: ${message}`)
      }
    }

    const routingConfig = {
      action: asString(entry.routing_action || entry.routingAction, defaultAction),
      fallback: asString(entry.routing_fallback || entry.routingFallback, defaultFallback),
      prompt: prompt || null,
      n8n_workflow_id: workflowId,
      n8n_trigger_url: linkedTriggerUrl,
      sip: {
        provider,
        trunk_sid: asString(entry.trunk_sid || entry.trunkSid || entry.twilio_trunk_sid),
        number_sid: asString(entry.number_sid || entry.numberSid || entry.twilio_number_sid),
        sip_uri: asString(entry.sip_uri || entry.sipUri),
      },
    }

    const existing = await client.database
      .from('agent_phones')
      .select('id')
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existing.error) {
      warnings.push(`${phoneNumber}: failed checking existing records`)
      continue
    }

    const existingRecord = (existing.data || [])[0] as Record<string, unknown> | undefined
    if (existingRecord?.id) {
      const updateResult = await client.database
        .from('agent_phones')
        .update({
          provider,
          agent_id: targetAgentId || null,
          agent_name: targetAgentName,
          capabilities,
          routing_config: routingConfig,
          status: defaultStatus,
          label: label || null,
        })
        .eq('id', asString(existingRecord.id))

      if (updateResult.error) {
        warnings.push(`${phoneNumber}: update failed`)
        continue
      }

      updated += 1
    } else {
      const insertResult = await client.database.from('agent_phones').insert({
        phone_number: phoneNumber,
        provider,
        agent_id: targetAgentId || null,
        agent_name: targetAgentName,
        capabilities,
        routing_config: routingConfig,
        status: defaultStatus,
        label: label || null,
      })

      if (insertResult.error) {
        warnings.push(`${phoneNumber}: insert failed`)
        continue
      }

      inserted += 1
    }

    importedNumbers.push({ phone_number: phoneNumber, workflow_id: workflowId })
  }

  await writeActivity(client, {
    agentId,
    agentName,
    message: `imported SIP numbers (inserted ${inserted}, updated ${updated})`,
    type: warnings.length > 0 ? 'warning' : 'success',
  })

  return {
    ok: true,
    action: 'import_sip_numbers',
    summary: {
      inserted,
      updated,
      warnings,
    },
    numbers: importedNumbers,
  }
}

async function shopifyStoreSnapshotForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')

  const rawDomain = asString(payload.shopDomain || payload.storeDomain || payload.domain)
  if (!rawDomain) {
    throw new Error('shopDomain (or storeDomain/domain) is required')
  }

  const normalizedDomain = rawDomain
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim()
  const accessToken = asString(
    payload.accessToken || payload.shopifyAccessToken || payload.adminToken || Deno.env.get('SHOPIFY_ADMIN_TOKEN'),
  )
  const apiVersion = asString(payload.apiVersion || Deno.env.get('SHOPIFY_API_VERSION'), '2025-01')
  const includeOrders = asBoolean(payload.includeOrders, true)
  const includeProducts = asBoolean(payload.includeProducts, true)
  const postForumUpdate = asBoolean(payload.postForumUpdate ?? payload.post_forum_update, true)
  const createWorkflow = asBoolean(payload.createWorkflow ?? payload.create_workflow, false)

  if (!accessToken) {
    throw new Error('Missing Shopify access token (payload or SHOPIFY_ADMIN_TOKEN)')
  }

  const baseUrl = `https://${normalizedDomain}/admin/api/${apiVersion}`
  const headers = {
    Accept: 'application/json',
    'X-Shopify-Access-Token': accessToken,
  }

  const { response: shopResponse, body: shopBody } = await fetchJson(`${baseUrl}/shop.json`, { headers })
  if (!shopResponse.ok) {
    throw new Error(`Shopify shop request failed (${shopResponse.status})`)
  }

  const shop = parseRecord((shopBody as Record<string, unknown>).shop)
  const snapshot: Record<string, unknown> = {
    domain: normalizedDomain,
    shop: {
      id: shop.id || null,
      name: asString(shop.name),
      email: asString(shop.email),
      currency: asString(shop.currency),
      country: asString(shop.country_name || shop.country),
      plan: asString(shop.plan_name),
    },
    counts: {},
    recentOrders: [],
  }

  if (includeProducts) {
    const { response, body } = await fetchJson(`${baseUrl}/products/count.json`, { headers })
    if (response.ok) {
      ;(snapshot.counts as Record<string, unknown>).products = asNumber(
        parseRecord(body).count || parseRecord(parseRecord(body).products).count,
        0,
      )
    } else {
      ;(snapshot.counts as Record<string, unknown>).productsWarning = `HTTP ${response.status}`
    }
  }

  if (includeOrders) {
    const countReq = await fetchJson(`${baseUrl}/orders/count.json?status=any`, { headers })
    if (countReq.response.ok) {
      ;(snapshot.counts as Record<string, unknown>).orders = asNumber(parseRecord(countReq.body).count, 0)
    } else {
      ;(snapshot.counts as Record<string, unknown>).ordersWarning = `HTTP ${countReq.response.status}`
    }

    const ordersReq = await fetchJson(
      `${baseUrl}/orders.json?status=any&limit=5&fields=id,name,created_at,total_price,currency,financial_status,fulfillment_status`,
      { headers },
    )
    if (ordersReq.response.ok) {
      const rows = Array.isArray(parseRecord(ordersReq.body).orders)
        ? (parseRecord(ordersReq.body).orders as unknown[])
        : []
      snapshot.recentOrders = rows
        .filter((entry) => isRecord(entry))
        .map((entry) => ({
          id: asString(entry.id),
          name: asString(entry.name),
          created_at: asString(entry.created_at),
          total_price: asString(entry.total_price),
          currency: asString(entry.currency),
          financial_status: asString(entry.financial_status),
          fulfillment_status: asString(entry.fulfillment_status),
        }))
    }
  }

  let workflow: Record<string, unknown> | null = null
  if (createWorkflow) {
    const workflowResult = await createN8nWorkflowForAgent(
      client,
      {
        name: asString(payload.workflowName, `Shopify ${normalizedDomain} Orders`),
        description: asString(
          payload.workflowDescription,
          `Sync orders + fulfillment alerts for ${normalizedDomain}`,
        ),
        triggerUrl: asString(payload.workflowTriggerUrl || payload.triggerUrl),
        is_active: true,
        n8nBaseUrl: asString(payload.n8nBaseUrl),
        n8nApiKey: asString(payload.n8nApiKey),
      },
      agent,
    )
    workflow = parseRecord(workflowResult.workflow)
  }

  if (postForumUpdate) {
    const countRow = parseRecord(snapshot.counts)
    const postMessage = [
      `Store snapshot captured for ${normalizedDomain}.`,
      `Products: ${asNumber(countRow.products, 0)}`,
      `Orders: ${asNumber(countRow.orders, 0)}`,
      workflow ? `Workflow linked: ${asString(workflow.name)}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    try {
      await postForumUpdateForAgent(
        client,
        {
          title: `Shopify Snapshot • ${asString(parseRecord(snapshot.shop).name, normalizedDomain)}`,
          message: postMessage,
          tags: ['shopify', 'commerce', 'dropshipping'],
          project: normalizedDomain,
          status: 'in_progress',
        },
        agent,
      )
    } catch {
      // Non-blocking forum post.
    }
  }

  await writeActivity(client, {
    agentId,
    agentName,
    message: `captured Shopify snapshot for ${normalizedDomain}`,
    type: 'success',
  })

  return {
    ok: true,
    action: 'shopify_store_snapshot',
    snapshot,
    workflow,
  }
}

async function createN8nWorkflowForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const name = asString(payload.name, 'Agent Workflow')
  const description = asString(payload.description)
  const isActive = asBoolean(payload.is_active ?? payload.isActive, true)

  const n8nConfig = parseRecord(payload.n8n)
  const n8nWorkflow = parseRecord(n8nConfig.workflow || payload.n8nWorkflow)
  const n8nBaseUrl = normalizeBaseUrl(asString(n8nConfig.baseUrl || payload.n8nBaseUrl || Deno.env.get('N8N_BASE_URL')))
  const n8nApiKey = asString(n8nConfig.apiKey || payload.n8nApiKey || Deno.env.get('N8N_API_KEY'))

  let triggerUrl = asString(payload.trigger_url || payload.triggerUrl)
  let n8nWorkflowId = ''
  let n8nWarning = ''

  const fallbackPath = `agent-${slugify(name)}-${Date.now().toString().slice(-6)}`

  if (!triggerUrl) {
    const fromNodes = extractWebhookPathFromNodes(n8nWorkflow)
    const path = fromNodes || fallbackPath
    if (n8nBaseUrl) {
      triggerUrl = `${n8nBaseUrl}/webhook/${path}`
    }
  }

  if (n8nBaseUrl && n8nApiKey && Object.keys(n8nWorkflow).length > 0) {
    try {
      const createResponse = await fetch(`${n8nBaseUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': n8nApiKey,
        },
        body: JSON.stringify(n8nWorkflow),
      })

      const createBody = await createResponse.json().catch(() => ({}))
      if (!createResponse.ok) {
        n8nWarning = `n8n create failed (${createResponse.status})`
      } else {
        n8nWorkflowId = extractN8nWorkflowId(createBody)
      }

      if (asBoolean(payload.activate, false) && n8nWorkflowId) {
        const activateResponse = await fetch(`${n8nBaseUrl}/api/v1/workflows/${n8nWorkflowId}/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': n8nApiKey,
          },
        })
        if (!activateResponse.ok && !n8nWarning) {
          n8nWarning = `workflow created but activation failed (${activateResponse.status})`
        }
      }
    } catch (error) {
      n8nWarning = error instanceof Error ? error.message : 'n8n API request failed'
    }
  }

  if (!triggerUrl) {
    triggerUrl = `https://n8n.local/webhook/${fallbackPath}`
  }

  const workflowInsert = await client.database
    .from('agent_workflows')
    .insert({
      name,
      description,
      trigger_url: triggerUrl,
      is_active: isActive,
    })
    .select()
    .single()

  if (workflowInsert.error || !workflowInsert.data) {
    throw new Error(workflowInsert.error?.message || 'Failed creating workflow record')
  }

  await writeActivity(client, {
    agentId,
    agentName,
    message: `created workflow "${name}"${n8nWorkflowId ? ` (n8n:${n8nWorkflowId})` : ''}`,
    type: n8nWarning ? 'warning' : 'success',
  })

  return {
    ok: true,
    action: 'create_n8n_workflow',
    workflow: workflowInsert.data,
    n8n: {
      baseUrl: n8nBaseUrl || null,
      workflowId: n8nWorkflowId || null,
      warning: n8nWarning || null,
    },
  }
}

async function createLiveKitSessionForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')

  const apiKey = Deno.env.get('LIVEKIT_API_KEY')
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
  const wsUrl = Deno.env.get('LIVEKIT_WS_URL')

  if (!apiKey || !apiSecret || !wsUrl) {
    throw new Error('Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_WS_URL')
  }

  const roomName =
    asString(payload.roomName || payload.room_name) ||
    `agent-${slugify(agentName || agentId)}-${Date.now().toString().slice(-6)}`
  const participantName = asString(payload.participantName || payload.participant_name, agentName || 'Agent')

  const accessToken = new AccessToken(apiKey, apiSecret, { identity: participantName })
  accessToken.addGrant({ roomJoin: true, room: roomName })
  const token = await accessToken.toJwt()

  await writeActivity(client, {
    agentId,
    agentName,
    message: `issued LiveKit session for room "${roomName}"`,
    type: 'info',
  })

  return {
    ok: true,
    action: 'request_livekit_session',
    session: {
      roomName,
      participantName,
      token,
      url: wsUrl,
    },
  }
}

async function synthesizeTtsForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const provider = asString(payload.provider, 'openai').toLowerCase()
  const text = asString(payload.text || payload.input)
  const format = asString(payload.format, 'mp3').toLowerCase()

  if (!text) {
    throw new Error('text is required for synthesize_tts')
  }
  if (text.length > 4000) {
    throw new Error('text too long for synthesize_tts (max 4000 chars)')
  }

  let bytes: ArrayBuffer = new ArrayBuffer(0)
  let mimeType = 'audio/mpeg'
  const voice = asString(payload.voice, provider === 'openai' ? 'alloy' : 'Rachel')
  const model = asString(payload.model, provider === 'openai' ? 'gpt-4o-mini-tts' : 'eleven_multilingual_v2')

  if (provider === 'openai') {
    const apiKey = asString(payload.apiKey || payload.openaiApiKey || Deno.env.get('OPENAI_API_KEY'))
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY (env) or apiKey in payload')

    const endpoint = asString(payload.endpoint || payload.baseUrl, 'https://api.openai.com/v1/audio/speech')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        format,
      }),
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`OpenAI TTS failed (${response.status}) ${details.slice(0, 220)}`)
    }

    mimeType = response.headers.get('content-type') || (format === 'wav' ? 'audio/wav' : 'audio/mpeg')
    bytes = await response.arrayBuffer()
  } else if (provider === 'elevenlabs') {
    const apiKey = asString(payload.apiKey || payload.elevenlabsApiKey || Deno.env.get('ELEVENLABS_API_KEY'))
    if (!apiKey) throw new Error('Missing ELEVENLABS_API_KEY (env) or apiKey in payload')

    const endpoint = asString(
      payload.endpoint,
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`,
    )
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        model_id: model,
        text,
      }),
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`ElevenLabs TTS failed (${response.status}) ${details.slice(0, 220)}`)
    }

    mimeType = response.headers.get('content-type') || 'audio/mpeg'
    bytes = await response.arrayBuffer()
  } else if (provider === 'custom') {
    const endpoint = asString(payload.endpoint)
    if (!endpoint) throw new Error('custom provider requires endpoint')

    const apiKey = asString(payload.apiKey)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        text,
        voice,
        model,
        format,
        metadata: parseRecord(payload.metadata),
      }),
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`Custom TTS failed (${response.status}) ${details.slice(0, 220)}`)
    }

    const contentType = asString(response.headers.get('content-type'))
    if (contentType.includes('application/json')) {
      const body = parseRecord(await response.json().catch(() => ({})))
      const audioBase64 = asString(body.audioBase64 || body.audio_base64)
      if (!audioBase64) {
        throw new Error('Custom TTS JSON response missing audioBase64')
      }
      mimeType = asString(body.mimeType || body.mime_type, 'audio/mpeg')
      bytes = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0)).buffer
    } else {
      mimeType = contentType || 'audio/mpeg'
      bytes = await response.arrayBuffer()
    }
  } else {
    throw new Error(`Unsupported tts provider: ${provider}`)
  }

  const base64 = toBase64(bytes)
  const dataUrl = `data:${mimeType};base64,${base64}`

  await writeActivity(client, {
    agentId,
    agentName,
    message: `synthesized TTS audio (${provider}/${voice})`,
    type: 'info',
  })

  return {
    ok: true,
    action: 'synthesize_tts',
    audio: {
      provider,
      model,
      voice,
      mimeType,
      sizeBytes: bytes.byteLength,
      dataBase64: base64,
      dataUrl,
    },
  }
}

async function executeRemoteCommandForAgent(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  agent: Record<string, unknown>,
) {
  const agentId = asString(agent.id)
  const agentName = asString(agent.name, 'Agent')
  const command = asString(payload.command || payload.cmd)
  if (!command) {
    throw new Error('command is required for execute_remote_command')
  }

  const shell = asString(payload.shell, 'bash').toLowerCase() === 'powershell' ? 'powershell' : 'bash'
  const runnerUrl = asString(payload.runnerUrl || payload.runner_url || Deno.env.get('REMOTE_RUNNER_URL'))
  const runnerToken = asString(payload.runnerToken || payload.runner_token || Deno.env.get('REMOTE_RUNNER_TOKEN'))

  const ssh = parseRecord(payload.ssh)
  const sshHost = asString(ssh.host || payload.sshHost || payload.ssh_host || Deno.env.get('SSH_HOST'))
  const sshUser = asString(ssh.user || payload.sshUser || payload.ssh_user || Deno.env.get('SSH_USER'), 'root')
  const sshPort = Math.max(1, Math.round(asNumber(ssh.port || payload.sshPort || payload.ssh_port || Deno.env.get('SSH_PORT'), 22)))
  const escapedCommand = command.replace(/"/g, '\\"')
  const runCommand = sshHost ? `ssh -p ${sshPort} ${sshUser}@${sshHost} "${escapedCommand}"` : command

  if (!runnerUrl) {
    await writeActivity(client, {
      agentId,
      agentName,
      message: `prepared remote command (dry run): ${command.slice(0, 80)}`,
      type: 'info',
    })

    return {
      ok: true,
      action: 'execute_remote_command',
      dryRun: true,
      shell,
      command,
      runCommand,
      suggestedCommand: runCommand,
      stdout: '',
      stderr: '',
      exitCode: null,
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (runnerToken) {
    headers.Authorization = `Bearer ${runnerToken}`
  }

  const { response, body } = await fetchJson(runnerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      shell,
      command,
      ssh: sshHost
        ? {
            host: sshHost,
            user: sshUser,
            port: sshPort,
          }
        : null,
      metadata: {
        agentId,
        agentName,
        source: 'agent-automation-bridge',
      },
    }),
  })

  if (!response.ok) {
    const details = JSON.stringify(body).slice(0, 240)
    throw new Error(`Remote runner failed (${response.status}) ${details}`)
  }

  const runnerBody = parseRecord(body)
  const stdout = asString(runnerBody.stdout || runnerBody.output || runnerBody.result)
  const stderr = asString(runnerBody.stderr || runnerBody.error)
  const exitCode =
    typeof runnerBody.exitCode === 'number'
      ? Math.round(runnerBody.exitCode)
      : Math.round(asNumber(runnerBody.code, 0))

  await writeActivity(client, {
    agentId,
    agentName,
    message: `executed remote command (exit ${exitCode})`,
    type: exitCode === 0 ? 'success' : 'warning',
  })

  return {
    ok: true,
    action: 'execute_remote_command',
    dryRun: false,
    shell,
    command,
    runCommand,
    stdout,
    stderr,
    exitCode,
  }
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const payload = parseRecord(await req.json().catch(() => ({})))
    const action = asString(payload.action).toLowerCase() as Action

    const requiredSecret = asString(Deno.env.get('AGENT_AUTOMATION_SECRET'))
    const providedSecret =
      req.headers.get('X-Agent-Automation-Secret') ||
      req.headers.get('x-agent-automation-secret') ||
      asString(payload.automationSecret || payload.automation_secret)

    if (requiredSecret && providedSecret !== requiredSecret) {
      return jsonResponse({ error: 'Unauthorized: invalid automation secret' }, 401)
    }

    const baseUrl = asString(Deno.env.get('INSFORGE_BASE_URL') || Deno.env.get('VITE_INSFORGE_BASE_URL'))
    const anonKey = asString(Deno.env.get('ANON_KEY') || Deno.env.get('INSFORGE_ANON_KEY'))

    if (!baseUrl || !anonKey) {
      return jsonResponse(
        { error: 'Function misconfigured: missing INSFORGE_BASE_URL/VITE_INSFORGE_BASE_URL or ANON_KEY/INSFORGE_ANON_KEY' },
        500,
      )
    }

    const agentId = asString(payload.agentId || payload.agent_id || req.headers.get('X-Agent-Id'))
    const providedApiKey =
      asString(payload.agentApiKey || payload.agent_api_key || req.headers.get('X-Agent-Api-Key')) ||
      resolveAuthHeader(req)

    if (!agentId || !providedApiKey) {
      return jsonResponse({ error: 'agentId and agentApiKey are required' }, 400)
    }

    const client = createClient({ baseUrl, anonKey })
    const agent = await validateAgent(client, agentId, providedApiKey)

    if (action === 'web_search') {
      const result = await webSearchForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'discover_provider_updates') {
      const result = await discoverProviderUpdatesForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'create_dao_deployment_task') {
      const result = await createDaoDeploymentTaskForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'shopify_store_snapshot') {
      const result = await shopifyStoreSnapshotForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'create_n8n_workflow') {
      const result = await createN8nWorkflowForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'request_livekit_session') {
      const result = await createLiveKitSessionForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'synthesize_tts') {
      const result = await synthesizeTtsForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'execute_remote_command') {
      const result = await executeRemoteCommandForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'import_sip_numbers') {
      const result = await importSipNumbersForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'post_forum_update') {
      const result = await postForumUpdateForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    if (action === 'comment_forum_post') {
      const result = await commentForumPostForAgent(client, payload, agent)
      return jsonResponse(result)
    }

    return jsonResponse({ error: 'Unsupported action' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected automation bridge error'
    return jsonResponse({ error: message }, 500)
  }
}
