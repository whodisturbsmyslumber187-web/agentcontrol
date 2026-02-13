import { useEffect } from 'react'
import { useAuth } from '@insforge/react'
import { useAgentStore } from '../../stores/agent-store'
import { useOpenClawStore } from '../../stores/openclaw-store'
import { useBusinessStore } from '../../stores/business-store'
import { invokeAgentDiscoverProviderUpdates, invokeAgentShopifySnapshot } from '../../lib/agent-automation'

async function runAutoEnhancementSweep() {
  const enabled = (localStorage.getItem('agentforge-auto-enhance-enabled') || 'true') === 'true'
  if (!enabled) return

  const agents = useAgentStore.getState().agents
  const automationAgent =
    agents.find((agent) => agent.status === 'active' && Boolean(agent.api_key)) ||
    agents.find((agent) => Boolean(agent.api_key))

  if (!automationAgent?.id || !automationAgent.api_key) return

  try {
    await invokeAgentDiscoverProviderUpdates(
      {
        agentId: automationAgent.id,
        agentApiKey: automationAgent.api_key,
        automationSecret: localStorage.getItem('agentforge-automation-secret') || undefined,
      },
      {
        providers: ['openrouter', 'huggingface', 'gemini', 'sip'],
        postForumUpdate: false,
        geminiApiKey: localStorage.getItem('agentforge-google-key') || undefined,
        huggingFaceToken: localStorage.getItem('agentforge-huggingface-token') || undefined,
      },
    )

    // Optional commerce sweep for configured Shopify stores.
    const rawStores = localStorage.getItem('agentforge-shopify-stores') || '[]'
    const stores = JSON.parse(rawStores)
    if (Array.isArray(stores)) {
      for (const store of stores.slice(0, 3)) {
        const row = store && typeof store === 'object' ? (store as Record<string, unknown>) : null
        const domain = typeof row?.domain === 'string' ? row.domain.trim() : ''
        const accessToken = typeof row?.accessToken === 'string' ? row.accessToken.trim() : ''
        if (!domain || !accessToken) continue

        await invokeAgentShopifySnapshot(
          {
            agentId: automationAgent.id,
            agentApiKey: automationAgent.api_key,
            automationSecret: localStorage.getItem('agentforge-automation-secret') || undefined,
          },
          {
            shopDomain: domain,
            accessToken,
            includeOrders: true,
            includeProducts: true,
            postForumUpdate: false,
            createWorkflow: false,
          },
        )
      }
    }
  } catch (error) {
    console.warn('Auto enhancement sweep failed:', error)
  }
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth()

  useEffect(() => {
    if (!isSignedIn) return

    // Fetch all data from InsForge on login
    useAgentStore.getState().fetchAgents()
    useOpenClawStore.getState().fetchSessions()
    useBusinessStore.getState().fetchBusinesses()

    // Periodic refresh every 30 seconds
    const interval = setInterval(() => {
      useAgentStore.getState().fetchAgents()
      useOpenClawStore.getState().fetchSessions()
      useBusinessStore.getState().fetchBusinesses()
    }, 30000)

    const autoEnhancementMinutes = Math.max(
      5,
      Number(localStorage.getItem('agentforge-auto-enhance-interval') || 30),
    )
    const autoEnhancementInterval = setInterval(() => {
      void runAutoEnhancementSweep()
    }, autoEnhancementMinutes * 60 * 1000)

    // Trigger one delayed sweep after initial data fetch.
    const bootstrapSweep = setTimeout(() => {
      void runAutoEnhancementSweep()
    }, 8000)

    return () => {
      clearInterval(interval)
      clearInterval(autoEnhancementInterval)
      clearTimeout(bootstrapSweep)
    }
  }, [isSignedIn])

  return <>{children}</>
}
