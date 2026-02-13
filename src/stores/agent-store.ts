import { create } from 'zustand'
import { insforge } from '../lib/insforge'
import { mergeAgentConfigWithDefaults } from '../lib/agent-defaults'

export interface Agent {
  id: string
  name: string
  role: string
  status: 'active' | 'idle' | 'error' | 'offline'
  model: string
  token_usage: number
  last_active: string
  emoji?: string
  description?: string
  tasks: number
  completed_tasks: number
  config?: Record<string, unknown>
  created_at?: string
  updated_at?: string
  api_key?: string

  // Aliases so existing UI code stays untouched
  tokenUsage?: number
  lastActive?: string
  completedTasks?: number
}

function generateAgentApiKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function normalizeAgent(row: Record<string, unknown>): Agent {
  const a = row as unknown as Agent
  return {
    ...a,
    tokenUsage: a.token_usage ?? (a as any).tokenUsage ?? 0,
    lastActive: a.last_active ?? (a as any).lastActive ?? new Date().toISOString(),
    completedTasks: a.completed_tasks ?? (a as any).completedTasks ?? 0,
    api_key: a.api_key ?? (a as any).apiKey,
    config: mergeAgentConfigWithDefaults(a.config || {}),
  }
}

interface AgentStore {
  agents: Agent[]
  isLoading: boolean
  error: string | null
  fetchAgents: () => Promise<void>
  addAgent: (agent: Partial<Agent> & { name: string; role: string }) => Promise<Agent | null>
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>
  removeAgent: (id: string) => Promise<void>
}

export const useAgentStore = create<AgentStore>()((set, get) => ({
  agents: [],
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await insforge.database
        .from('agents')
        .select()
        .order('created_at', { ascending: true })
      if (error) throw error
      set({ agents: (data || []).map(normalizeAgent), isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch agents', isLoading: false })
    }
  },

  addAgent: async (agentData) => {
    try {
      const generatedApiKey = agentData.api_key || generateAgentApiKey()
      const { data, error } = await insforge.database
        .from('agents')
        .insert({
          name: agentData.name,
          role: agentData.role,
          status: agentData.status || 'idle',
          model: agentData.model || 'gpt-4o-mini',
          emoji: agentData.emoji || '🤖',
          description: agentData.description || '',
          tasks: agentData.tasks || 0,
          completed_tasks: agentData.completedTasks || agentData.completed_tasks || 0,
          token_usage: agentData.tokenUsage || agentData.token_usage || 0,
          last_active: agentData.lastActive || agentData.last_active || new Date().toISOString(),
          config: mergeAgentConfigWithDefaults(agentData.config || {}),
          api_key: generatedApiKey,
        })
        .select()
      if (error) throw error
      if (data && data[0]) {
        const created = normalizeAgent(data[0])
        set((state) => ({ agents: [...state.agents, created] }))
        return created
      }
      return null
    } catch (err: any) {
      set({ error: err.message || 'Failed to add agent' })
      return null
    }
  },

  updateAgent: async (id, updates) => {
    try {
      const dbUpdates: Record<string, unknown> = { ...updates }
      if ('config' in updates) {
        dbUpdates.config = mergeAgentConfigWithDefaults((updates as any).config || {})
      }
      // Map camelCase to snake_case
      if ('tokenUsage' in updates) { dbUpdates.token_usage = updates.tokenUsage; delete dbUpdates.tokenUsage }
      if ('lastActive' in updates) { dbUpdates.last_active = updates.lastActive; delete dbUpdates.lastActive }
      if ('completedTasks' in updates) { dbUpdates.completed_tasks = updates.completedTasks; delete dbUpdates.completedTasks }

      const { error } = await insforge.database
        .from('agents')
        .update(dbUpdates)
        .eq('id', id)
      if (error) throw error
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? normalizeAgent({ ...a, ...updates }) : a)),
      }))
    } catch (err: any) {
      set({ error: err.message || 'Failed to update agent' })
    }
  },

  removeAgent: async (id) => {
    try {
      const { error } = await insforge.database
        .from('agents')
        .delete()
        .eq('id', id)
      if (error) throw error
      set((state) => ({ agents: state.agents.filter((a) => a.id !== id) }))
    } catch (err: any) {
      set({ error: err.message || 'Failed to remove agent' })
    }
  },
}))
