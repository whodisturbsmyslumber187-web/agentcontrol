import { insforge } from './insforge'

export interface AgentAutomationAuth {
  agentId: string
  agentApiKey: string
  automationSecret?: string
}

export interface AgentN8nWorkflowCreateRequest {
  name: string
  description?: string
  triggerUrl?: string
  isActive?: boolean
  activate?: boolean
  n8nBaseUrl?: string
  n8nApiKey?: string
  n8nWorkflow?: Record<string, unknown>
}

export interface AgentN8nWorkflowCreateResponse {
  ok: boolean
  action: 'create_n8n_workflow'
  workflow: {
    id: string
    name: string
    description: string
    trigger_url: string
    is_active: boolean
  }
  n8n: {
    baseUrl: string | null
    workflowId: string | null
    warning: string | null
  }
}

export interface AgentLiveKitSessionRequest {
  roomName?: string
  participantName?: string
}

export interface AgentLiveKitSessionResponse {
  ok: boolean
  action: 'request_livekit_session'
  session: {
    roomName: string
    participantName: string
    token: string
    url: string
  }
}

export interface AgentSynthesizeTtsRequest {
  text: string
  provider?: 'openai' | 'elevenlabs' | 'custom' | string
  model?: string
  voice?: string
  format?: 'mp3' | 'wav' | 'flac' | string
  endpoint?: string
  apiKey?: string
  metadata?: Record<string, unknown>
}

export interface AgentSynthesizeTtsResponse {
  ok: boolean
  action: 'synthesize_tts'
  audio: {
    provider: string
    model: string
    voice: string
    mimeType: string
    sizeBytes: number
    dataBase64: string
    dataUrl: string
  }
}

export interface AgentWebSearchRequest {
  query: string
  count?: number
  freshness?: string
  braveApiKey?: string
}

export interface AgentWebSearchResponse {
  ok: boolean
  action: 'web_search'
  provider: 'brave'
  query: string
  count: number
  results: Array<{
    title: string
    url: string
    description: string
    age?: string
    language?: string
    source?: string
  }>
}

export interface AgentProviderDiscoveryRequest {
  providers?: string[]
  postForumUpdate?: boolean
  geminiApiKey?: string
  huggingFaceToken?: string
  sipProviders?: string[]
}

export interface AgentProviderDiscoveryResponse {
  ok: boolean
  action: 'discover_provider_updates'
  checkedAt: string
  summary: {
    total: number
    successful: number
    warnings: number
  }
  providers: Array<{
    provider: string
    ok: boolean
    checkedAt: string
    count?: number
    warning?: string
    models?: Array<Record<string, unknown>>
  }>
  forumPostId?: string | null
}

export interface AgentDaoTaskRequest {
  daoName: string
  daoProvider?: string
  chain?: string
  tokenSymbol?: string
  tokenSupply?: string
  governanceModel?: string
  treasuryAddress?: string
  objective?: string
  launchDate?: string
  createWorkflow?: boolean
  triggerUrl?: string
  n8nBaseUrl?: string
  n8nApiKey?: string
}

export interface AgentDaoTaskResponse {
  ok: boolean
  action: 'create_dao_deployment_task'
  task: {
    daoName: string
    provider: string
    chain: string
    tokenSymbol: string
    tokenSupply: string
    governanceModel: string
    treasuryAddress: string
    launchDate: string
    objective: string
    checklist: string[]
    forumPostId: string
  }
  workflow: Record<string, unknown> | null
}

export interface AgentShopifySnapshotRequest {
  shopDomain: string
  accessToken?: string
  apiVersion?: string
  includeOrders?: boolean
  includeProducts?: boolean
  postForumUpdate?: boolean
  createWorkflow?: boolean
  workflowName?: string
  workflowDescription?: string
  workflowTriggerUrl?: string
  n8nBaseUrl?: string
  n8nApiKey?: string
}

export interface AgentShopifySnapshotResponse {
  ok: boolean
  action: 'shopify_store_snapshot'
  snapshot: {
    domain: string
    shop: {
      id?: string | null
      name: string
      email: string
      currency: string
      country: string
      plan: string
    }
    counts: Record<string, unknown>
    recentOrders: Array<{
      id: string
      name: string
      created_at: string
      total_price: string
      currency: string
      financial_status: string
      fulfillment_status: string
    }>
  }
  workflow: Record<string, unknown> | null
}

export interface AgentSipImportEntry {
  phone_number: string
  provider?: 'twilio' | 'openphone' | 'voip_sip' | 'other' | string
  label?: string
  prompt?: string
  capabilities?: string[]
  agent_id?: string
  workflow_name?: string
  workflow_description?: string
  workflow_trigger_url?: string
  n8n_base_url?: string
  n8n_api_key?: string
  trunk_sid?: string
  number_sid?: string
  sip_uri?: string
}

export interface AgentSipImportResponse {
  ok: boolean
  action: 'import_sip_numbers'
  summary: {
    inserted: number
    updated: number
    warnings: string[]
  }
  numbers: Array<{
    phone_number: string
    workflow_id?: string | null
  }>
}

export interface AgentForumPostRequest {
  title: string
  message: string
  tags?: string[]
  project?: string
  status?: 'open' | 'in_progress' | 'solved' | string
  businessId?: string
}

export interface AgentForumPostResponse {
  ok: boolean
  action: 'post_forum_update'
  post: {
    id: string
    message: string
    metadata: Record<string, unknown>
    created_at: string
  }
  forum: {
    channelId: string
    channelSlug: string
  }
}

export interface AgentForumCommentRequest {
  postId: string
  message: string
}

export interface AgentForumCommentResponse {
  ok: boolean
  action: 'comment_forum_post'
  comment: {
    id: string
    message: string
    metadata: Record<string, unknown>
    created_at: string
  }
  forum: {
    channelId: string
    channelSlug: string
  }
}

function buildHeaders(auth: AgentAutomationAuth) {
  const headers: Record<string, string> = {}
  if (auth.automationSecret?.trim()) {
    headers['X-Agent-Automation-Secret'] = auth.automationSecret.trim()
  }
  return headers
}

export async function invokeAgentCreateN8nWorkflow(
  auth: AgentAutomationAuth,
  request: AgentN8nWorkflowCreateRequest,
): Promise<AgentN8nWorkflowCreateResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'create_n8n_workflow',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      name: request.name,
      description: request.description,
      triggerUrl: request.triggerUrl,
      is_active: request.isActive,
      activate: request.activate,
      n8nBaseUrl: request.n8nBaseUrl,
      n8nApiKey: request.n8nApiKey,
      n8nWorkflow: request.n8nWorkflow,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentN8nWorkflowCreateResponse
}

export async function invokeAgentLiveKitSession(
  auth: AgentAutomationAuth,
  request: AgentLiveKitSessionRequest,
): Promise<AgentLiveKitSessionResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'request_livekit_session',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      roomName: request.roomName,
      participantName: request.participantName,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentLiveKitSessionResponse
}

export async function invokeAgentSynthesizeTts(
  auth: AgentAutomationAuth,
  request: AgentSynthesizeTtsRequest,
): Promise<AgentSynthesizeTtsResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'synthesize_tts',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      text: request.text,
      provider: request.provider,
      model: request.model,
      voice: request.voice,
      format: request.format,
      endpoint: request.endpoint,
      apiKey: request.apiKey,
      metadata: request.metadata,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentSynthesizeTtsResponse
}

export async function invokeAgentWebSearch(
  auth: AgentAutomationAuth,
  request: AgentWebSearchRequest,
): Promise<AgentWebSearchResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'web_search',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      query: request.query,
      count: request.count,
      freshness: request.freshness,
      braveApiKey: request.braveApiKey,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentWebSearchResponse
}

export async function invokeAgentDiscoverProviderUpdates(
  auth: AgentAutomationAuth,
  request: AgentProviderDiscoveryRequest = {},
): Promise<AgentProviderDiscoveryResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'discover_provider_updates',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      providers: request.providers,
      postForumUpdate: request.postForumUpdate,
      geminiApiKey: request.geminiApiKey,
      huggingFaceToken: request.huggingFaceToken,
      sipProviders: request.sipProviders,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentProviderDiscoveryResponse
}

export async function invokeAgentCreateDaoDeploymentTask(
  auth: AgentAutomationAuth,
  request: AgentDaoTaskRequest,
): Promise<AgentDaoTaskResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'create_dao_deployment_task',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      daoName: request.daoName,
      daoProvider: request.daoProvider,
      chain: request.chain,
      tokenSymbol: request.tokenSymbol,
      tokenSupply: request.tokenSupply,
      governanceModel: request.governanceModel,
      treasuryAddress: request.treasuryAddress,
      objective: request.objective,
      launchDate: request.launchDate,
      createWorkflow: request.createWorkflow,
      triggerUrl: request.triggerUrl,
      n8nBaseUrl: request.n8nBaseUrl,
      n8nApiKey: request.n8nApiKey,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentDaoTaskResponse
}

export async function invokeAgentShopifySnapshot(
  auth: AgentAutomationAuth,
  request: AgentShopifySnapshotRequest,
): Promise<AgentShopifySnapshotResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'shopify_store_snapshot',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      shopDomain: request.shopDomain,
      accessToken: request.accessToken,
      apiVersion: request.apiVersion,
      includeOrders: request.includeOrders,
      includeProducts: request.includeProducts,
      postForumUpdate: request.postForumUpdate,
      createWorkflow: request.createWorkflow,
      workflowName: request.workflowName,
      workflowDescription: request.workflowDescription,
      workflowTriggerUrl: request.workflowTriggerUrl,
      n8nBaseUrl: request.n8nBaseUrl,
      n8nApiKey: request.n8nApiKey,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentShopifySnapshotResponse
}

export async function invokeAgentImportSipNumbers(
  auth: AgentAutomationAuth,
  request: {
    numbers: AgentSipImportEntry[]
    assignAgentId?: string
    provider?: string
    routingAction?: string
    routingFallback?: string
    n8nBaseUrl?: string
    n8nApiKey?: string
  },
): Promise<AgentSipImportResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'import_sip_numbers',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      numbers: request.numbers,
      assignAgentId: request.assignAgentId,
      provider: request.provider,
      routingAction: request.routingAction,
      routingFallback: request.routingFallback,
      n8nBaseUrl: request.n8nBaseUrl,
      n8nApiKey: request.n8nApiKey,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentSipImportResponse
}

export async function invokeAgentForumPost(
  auth: AgentAutomationAuth,
  request: AgentForumPostRequest,
): Promise<AgentForumPostResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'post_forum_update',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      title: request.title,
      message: request.message,
      tags: request.tags,
      project: request.project,
      status: request.status,
      businessId: request.businessId,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentForumPostResponse
}

export async function invokeAgentForumComment(
  auth: AgentAutomationAuth,
  request: AgentForumCommentRequest,
): Promise<AgentForumCommentResponse> {
  const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
    body: {
      action: 'comment_forum_post',
      agentId: auth.agentId,
      agentApiKey: auth.agentApiKey,
      postId: request.postId,
      message: request.message,
    },
    headers: buildHeaders(auth),
  })

  if (error) {
    throw error
  }

  return data as AgentForumCommentResponse
}
