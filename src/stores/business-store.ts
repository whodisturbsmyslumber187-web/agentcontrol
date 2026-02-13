import { create } from 'zustand'
import { insforge } from '../lib/insforge'

export interface Business {
  id: string
  name: string
  type: 'ecommerce' | 'saas' | 'consulting' | 'trading' | 'other'
  status: 'active' | 'paused' | 'archived'
  revenue: number
  expenses: number
  profit: number
  agents: string[]
  pending_tasks: number
  metrics: {
    conversionRate?: number
    customerCount?: number
    monthlyGrowth?: number
  }
  created_at?: string
  updated_at?: string

  // Aliases for existing UI
  pendingTasks?: number
  lastUpdated?: string
}

function normalizeBusiness(row: Record<string, unknown>): Business {
  const b = row as unknown as Business
  return {
    ...b,
    pendingTasks: b.pending_tasks ?? (b as any).pendingTasks ?? 0,
    lastUpdated: b.updated_at ?? (b as any).lastUpdated ?? new Date().toISOString(),
    metrics: typeof b.metrics === 'object' && b.metrics ? b.metrics : { conversionRate: 0, customerCount: 0, monthlyGrowth: 0 },
  }
}

export interface BusinessMetrics {
  totalRevenue: number
  totalProfit: number
  activeBusinesses: number
  totalAgentsAssigned: number
  averageConversionRate: number
}

interface BusinessStore {
  businesses: Business[]
  metrics: BusinessMetrics
  isLoading: boolean
  error: string | null

  fetchBusinesses: () => Promise<void>
  setBusinesses: (businesses: Business[]) => void
  addBusiness: (business: Partial<Business> & { name: string }) => Promise<void>
  updateBusiness: (id: string, updates: Partial<Business>) => Promise<void>
  removeBusiness: (id: string) => Promise<void>
  assignAgent: (businessId: string, agentId: string) => Promise<void>
  unassignAgent: (businessId: string, agentId: string) => Promise<void>
  calculateMetrics: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useBusinessStore = create<BusinessStore>()((set, get) => ({
  businesses: [],
  metrics: {
    totalRevenue: 0,
    totalProfit: 0,
    activeBusinesses: 0,
    totalAgentsAssigned: 0,
    averageConversionRate: 0,
  },
  isLoading: false,
  error: null,

  fetchBusinesses: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await insforge.database
        .from('businesses')
        .select()
        .order('created_at', { ascending: true })
      if (error) throw error
      const businesses = (data || []).map(normalizeBusiness)
      set({ businesses, isLoading: false })
      get().calculateMetrics()
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch businesses', isLoading: false })
    }
  },

  setBusinesses: (businesses) => {
    set({ businesses })
    get().calculateMetrics()
  },

  addBusiness: async (businessData) => {
    try {
      const { data, error } = await insforge.database
        .from('businesses')
        .insert({
          name: businessData.name,
          type: businessData.type || 'other',
          status: businessData.status || 'active',
          revenue: businessData.revenue || 0,
          expenses: businessData.expenses || 0,
          profit: businessData.profit || 0,
          agents: businessData.agents || [],
          pending_tasks: businessData.pendingTasks || businessData.pending_tasks || 0,
          metrics: businessData.metrics || { conversionRate: 0, customerCount: 0, monthlyGrowth: 0 },
        })
        .select()
      if (error) throw error
      if (data && data[0]) {
        set((state) => ({ businesses: [...state.businesses, normalizeBusiness(data[0])] }))
        get().calculateMetrics()
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to add business' })
    }
  },

  updateBusiness: async (id, updates) => {
    try {
      const dbUpdates: Record<string, unknown> = { ...updates }
      if ('pendingTasks' in updates) { dbUpdates.pending_tasks = updates.pendingTasks; delete dbUpdates.pendingTasks }
      if ('lastUpdated' in updates) { delete dbUpdates.lastUpdated }

      const { error } = await insforge.database
        .from('businesses')
        .update(dbUpdates)
        .eq('id', id)
      if (error) throw error
      set((state) => ({
        businesses: state.businesses.map((biz) =>
          biz.id === id ? normalizeBusiness({ ...biz, ...updates }) : biz
        ),
      }))
      get().calculateMetrics()
    } catch (err: any) {
      set({ error: err.message || 'Failed to update business' })
    }
  },

  removeBusiness: async (id) => {
    try {
      const { error } = await insforge.database
        .from('businesses')
        .delete()
        .eq('id', id)
      if (error) throw error
      set((state) => ({ businesses: state.businesses.filter((biz) => biz.id !== id) }))
      get().calculateMetrics()
    } catch (err: any) {
      set({ error: err.message || 'Failed to remove business' })
    }
  },

  assignAgent: async (businessId, agentId) => {
    const biz = get().businesses.find((b) => b.id === businessId)
    if (!biz || biz.agents.includes(agentId)) return
    const newAgents = [...biz.agents, agentId]
    try {
      const { error } = await insforge.database
        .from('businesses')
        .update({ agents: newAgents })
        .eq('id', businessId)
      if (error) throw error
      set((state) => ({
        businesses: state.businesses.map((b) =>
          b.id === businessId ? { ...b, agents: newAgents } : b
        ),
      }))
      get().calculateMetrics()
    } catch (err: any) {
      set({ error: err.message || 'Failed to assign agent' })
    }
  },

  unassignAgent: async (businessId, agentId) => {
    const biz = get().businesses.find((b) => b.id === businessId)
    if (!biz) return
    const newAgents = biz.agents.filter((id) => id !== agentId)
    try {
      const { error } = await insforge.database
        .from('businesses')
        .update({ agents: newAgents })
        .eq('id', businessId)
      if (error) throw error
      set((state) => ({
        businesses: state.businesses.map((b) =>
          b.id === businessId ? { ...b, agents: newAgents } : b
        ),
      }))
      get().calculateMetrics()
    } catch (err: any) {
      set({ error: err.message || 'Failed to unassign agent' })
    }
  },

  calculateMetrics: () => {
    const { businesses } = get()
    const activeBusinesses = businesses.filter((b) => b.status === 'active')
    const totalRevenue = activeBusinesses.reduce((sum, biz) => sum + Number(biz.revenue), 0)
    const totalProfit = activeBusinesses.reduce((sum, biz) => sum + Number(biz.profit), 0)
    const totalAgentsAssigned = activeBusinesses.reduce((sum, biz) => sum + biz.agents.length, 0)
    const conversionRates = activeBusinesses
      .map((b) => b.metrics?.conversionRate || 0)
      .filter((rate) => rate > 0)
    const averageConversionRate =
      conversionRates.length > 0
        ? conversionRates.reduce((sum, rate) => sum + rate, 0) / conversionRates.length
        : 0

    set({
      metrics: {
        totalRevenue,
        totalProfit,
        activeBusinesses: activeBusinesses.length,
        totalAgentsAssigned,
        averageConversionRate,
      },
    })
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))