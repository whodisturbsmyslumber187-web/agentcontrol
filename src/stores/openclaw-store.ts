import { create } from 'zustand'
import { insforge } from '../lib/insforge'

export interface Session {
  id: string
  agent_id: string
  active: boolean
  started_at: string
  ended_at?: string
  tokens: number
  metadata?: Record<string, unknown>
  created_at?: string

  // Aliases for existing UI
  agentId?: string
  startedAt?: string
}

function normalizeSession(row: Record<string, unknown>): Session {
  const s = row as unknown as Session
  return {
    ...s,
    agentId: s.agent_id ?? (s as any).agentId,
    startedAt: s.started_at ?? (s as any).startedAt,
  }
}

interface OpenClawStore {
  sessions: Session[]
  isLoading: boolean
  error: string | null
  fetchSessions: () => Promise<void>
  addSession: (session: { agent_id: string; tokens?: number }) => Promise<void>
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>
  endSession: (id: string) => Promise<void>
  removeSession: (id: string) => Promise<void>
}

export const useOpenClawStore = create<OpenClawStore>()((set) => ({
  sessions: [],
  isLoading: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await insforge.database
        .from('sessions')
        .select()
        .order('started_at', { ascending: false })
      if (error) throw error
      set({ sessions: (data || []).map(normalizeSession), isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch sessions', isLoading: false })
    }
  },

  addSession: async (sessionData) => {
    try {
      const { data, error } = await insforge.database
        .from('sessions')
        .insert({
          agent_id: sessionData.agent_id,
          active: true,
          tokens: sessionData.tokens || 0,
        })
        .select()
      if (error) throw error
      if (data && data[0]) {
        set((state) => ({ sessions: [normalizeSession(data[0]), ...state.sessions] }))
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to add session' })
    }
  },

  updateSession: async (id, updates) => {
    try {
      const { error } = await insforge.database
        .from('sessions')
        .update(updates)
        .eq('id', id)
      if (error) throw error
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? normalizeSession({ ...s, ...updates }) : s)),
      }))
    } catch (err: any) {
      set({ error: err.message || 'Failed to update session' })
    }
  },

  endSession: async (id) => {
    try {
      const { error } = await insforge.database
        .from('sessions')
        .update({ active: false, ended_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, active: false, ended_at: new Date().toISOString() } : s
        ),
      }))
    } catch (err: any) {
      set({ error: err.message || 'Failed to end session' })
    }
  },

  removeSession: async (id) => {
    try {
      const { error } = await insforge.database
        .from('sessions')
        .delete()
        .eq('id', id)
      if (error) throw error
      set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }))
    } catch (err: any) {
      set({ error: err.message || 'Failed to remove session' })
    }
  },
}))
