import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Business {
  id: string
  name: string
  type: 'ecommerce' | 'saas' | 'consulting' | 'trading' | 'other'
  status: 'active' | 'paused' | 'archived'
  revenue: number
  expenses: number
  profit: number
  agents: string[] // Agent IDs assigned to this business
  pendingTasks: number
  lastUpdated: string
  metrics: {
    conversionRate?: number
    customerCount?: number
    monthlyGrowth?: number
  }
}

interface BusinessMetrics {
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
  
  // Actions
  setBusinesses: (businesses: Business[]) => void
  addBusiness: (business: Omit<Business, 'id' | 'lastUpdated'>) => void
  updateBusiness: (id: string, updates: Partial<Business>) => void
  removeBusiness: (id: string) => void
  assignAgent: (businessId: string, agentId: string) => void
  unassignAgent: (businessId: string, agentId: string) => void
  calculateMetrics: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

// Sample initial businesses
const initialBusinesses: Business[] = [
  {
    id: 'biz-1',
    name: 'Silver Trading Desk',
    type: 'trading',
    status: 'active',
    revenue: 125000,
    expenses: 25000,
    profit: 100000,
    agents: ['agent-silver-1', 'agent-silver-2'],
    pendingTasks: 3,
    lastUpdated: new Date().toISOString(),
    metrics: {
      conversionRate: 4.2,
      customerCount: 42,
      monthlyGrowth: 12.5
    }
  },
  {
    id: 'biz-2',
    name: 'AI Consulting',
    type: 'consulting',
    status: 'active',
    revenue: 75000,
    expenses: 15000,
    profit: 60000,
    agents: ['agent-consult-1'],
    pendingTasks: 5,
    lastUpdated: new Date().toISOString(),
    metrics: {
      conversionRate: 8.7,
      customerCount: 15,
      monthlyGrowth: 25.3
    }
  },
  {
    id: 'biz-3',
    name: 'E-commerce Store',
    type: 'ecommerce',
    status: 'active',
    revenue: 50000,
    expenses: 20000,
    profit: 30000,
    agents: ['agent-ecom-1', 'agent-ecom-2'],
    pendingTasks: 8,
    lastUpdated: new Date().toISOString(),
    metrics: {
      conversionRate: 2.8,
      customerCount: 1200,
      monthlyGrowth: 8.2
    }
  }
]

export const useBusinessStore = create<BusinessStore>()(
  persist(
    (set, get) => ({
      businesses: initialBusinesses,
      metrics: {
        totalRevenue: 0,
        totalProfit: 0,
        activeBusinesses: 0,
        totalAgentsAssigned: 0,
        averageConversionRate: 0
      },
      isLoading: false,
      error: null,

      setBusinesses: (businesses) => {
        set({ businesses })
        get().calculateMetrics()
      },

      addBusiness: (businessData) => {
        const newBusiness: Business = {
          ...businessData,
          id: `biz-${Date.now()}`,
          lastUpdated: new Date().toISOString()
        }
        set((state) => ({
          businesses: [...state.businesses, newBusiness]
        }))
        get().calculateMetrics()
      },

      updateBusiness: (id, updates) => {
        set((state) => ({
          businesses: state.businesses.map((biz) =>
            biz.id === id
              ? { ...biz, ...updates, lastUpdated: new Date().toISOString() }
              : biz
          )
        }))
        get().calculateMetrics()
      },

      removeBusiness: (id) => {
        set((state) => ({
          businesses: state.businesses.filter((biz) => biz.id !== id)
        }))
        get().calculateMetrics()
      },

      assignAgent: (businessId, agentId) => {
        set((state) => ({
          businesses: state.businesses.map((biz) =>
            biz.id === businessId && !biz.agents.includes(agentId)
              ? { ...biz, agents: [...biz.agents, agentId] }
              : biz
          )
        }))
        get().calculateMetrics()
      },

      unassignAgent: (businessId, agentId) => {
        set((state) => ({
          businesses: state.businesses.map((biz) =>
            biz.id === businessId
              ? { ...biz, agents: biz.agents.filter((id) => id !== agentId) }
              : biz
          )
        }))
        get().calculateMetrics()
      },

      calculateMetrics: () => {
        const { businesses } = get()
        
        const activeBusinesses = businesses.filter(b => b.status === 'active')
        const totalRevenue = activeBusinesses.reduce((sum, biz) => sum + biz.revenue, 0)
        const totalProfit = activeBusinesses.reduce((sum, biz) => sum + biz.profit, 0)
        const totalAgentsAssigned = activeBusinesses.reduce((sum, biz) => sum + biz.agents.length, 0)
        
        const conversionRates = activeBusinesses
          .map(b => b.metrics.conversionRate || 0)
          .filter(rate => rate > 0)
        
        const averageConversionRate = conversionRates.length > 0
          ? conversionRates.reduce((sum, rate) => sum + rate, 0) / conversionRates.length
          : 0

        set({
          metrics: {
            totalRevenue,
            totalProfit,
            activeBusinesses: activeBusinesses.length,
            totalAgentsAssigned,
            averageConversionRate
          }
        })
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error })
    }),
    {
      name: 'business-store',
      version: 1
    }
  )
)

// Initialize metrics on store creation
const store = useBusinessStore.getState()
store.calculateMetrics()