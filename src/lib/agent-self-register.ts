import { insforge } from './insforge'

export interface AgentSelfRegisterRequest {
  name: string
  role: string
  model?: string
  emoji?: string
  description?: string
  mission?: string
  source?: string
  externalId?: string
  status?: 'active' | 'idle' | 'error' | 'offline'
  startSession?: boolean
  capabilities?: string[]
  metadata?: Record<string, unknown>
  businessId?: string
  priority?: 'high' | 'medium' | 'low'
  instructions?: string
}

export interface AgentSelfRegisterResponse {
  ok: boolean
  created: boolean
  agent: {
    id: string
    name: string
    role: string
    status: string
    model: string
    apiKey: string
  }
  onboarding: {
    baseUrl: string
    selfRegisterSlug: string
    tables: {
      agents: string
      sessions: string
      activity: string
      assignments: string
      messages: string
    }
    suggestedHeartbeatSeconds: number
  }
}

export async function invokeAgentSelfRegister(
  payload: AgentSelfRegisterRequest,
  registerSecret?: string,
): Promise<AgentSelfRegisterResponse> {
  const headers: Record<string, string> = {}
  if (registerSecret?.trim()) {
    headers['X-Agent-Register-Secret'] = registerSecret.trim()
  }

  const { data, error } = await insforge.functions.invoke('agent-self-register', {
    body: {
      ...payload,
      external_id: payload.externalId,
      start_session: payload.startSession,
      business_id: payload.businessId,
    },
    headers,
  })

  if (error) {
    throw error
  }

  return data as AgentSelfRegisterResponse
}
