import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { useToast } from '../components/ui/use-toast'
import { useAgentStore } from '../stores/agent-store'
import { invokeAgentShopifySnapshot } from '../lib/agent-automation'
import { Activity, Globe, Package, Plus, RefreshCw, ShoppingBag, Trash2, Truck, Workflow } from 'lucide-react'

interface ShopifyStoreConfig {
  id: string
  name: string
  domain: string
  accessToken: string
  n8nBaseUrl?: string
  n8nApiKey?: string
}

interface SnapshotResult {
  storeId: string
  takenAt: string
  result: Awaited<ReturnType<typeof invokeAgentShopifySnapshot>>
}

const STORAGE_KEY = 'agentforge-shopify-stores'

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadStores(): ShopifyStoreConfig[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
      .map((entry) => {
        const row = entry as Record<string, unknown>
        return {
          id: typeof row.id === 'string' ? row.id : createId(),
          name: typeof row.name === 'string' ? row.name : '',
          domain: typeof row.domain === 'string' ? row.domain : '',
          accessToken: typeof row.accessToken === 'string' ? row.accessToken : '',
          n8nBaseUrl: typeof row.n8nBaseUrl === 'string' ? row.n8nBaseUrl : undefined,
          n8nApiKey: typeof row.n8nApiKey === 'string' ? row.n8nApiKey : undefined,
        }
      })
      .filter((store) => store.name && store.domain)
  } catch {
    return []
  }
}

function saveStores(stores: ShopifyStoreConfig[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stores))
}

export default function CommerceOps() {
  const { toast } = useToast()
  const { agents, fetchAgents } = useAgentStore()

  const [stores, setStores] = useState<ShopifyStoreConfig[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotResult[]>([])
  const [runningStoreId, setRunningStoreId] = useState<string | null>(null)

  const [automationAgentId, setAutomationAgentId] = useState('')
  const [automationAgentApiKey, setAutomationAgentApiKey] = useState('')
  const [automationSecret, setAutomationSecret] = useState('')

  const [storeName, setStoreName] = useState('')
  const [storeDomain, setStoreDomain] = useState('')
  const [storeToken, setStoreToken] = useState('')
  const [storeN8nBaseUrl, setStoreN8nBaseUrl] = useState('')
  const [storeN8nApiKey, setStoreN8nApiKey] = useState('')

  useEffect(() => {
    const loaded = loadStores()
    setStores(loaded)
    setAutomationSecret(localStorage.getItem('agentforge-automation-secret') || '')
    void fetchAgents()
  }, [])

  useEffect(() => {
    if (!automationAgentId && agents.length > 0) {
      const candidate = agents.find((agent) => agent.status === 'active' && agent.api_key) || agents[0]
      setAutomationAgentId(candidate.id)
      setAutomationAgentApiKey(candidate.api_key || '')
      return
    }

    if (!automationAgentId) return
    const selected = agents.find((agent) => agent.id === automationAgentId)
    if (selected?.api_key) setAutomationAgentApiKey(selected.api_key)
  }, [agents, automationAgentId])

  const totalOrders = useMemo(
    () => snapshots.reduce((sum, snap) => sum + Number((snap.result.snapshot.counts.orders as number) || 0), 0),
    [snapshots],
  )

  const addStore = () => {
    const name = storeName.trim()
    const domain = storeDomain.trim()
    const token = storeToken.trim()

    if (!name || !domain || !token) {
      toast({
        title: 'Missing fields',
        description: 'Store name, domain, and admin token are required.',
        variant: 'destructive',
      })
      return
    }

    const next: ShopifyStoreConfig = {
      id: createId(),
      name,
      domain,
      accessToken: token,
      n8nBaseUrl: storeN8nBaseUrl.trim() || undefined,
      n8nApiKey: storeN8nApiKey.trim() || undefined,
    }

    setStores((current) => {
      const updated = [next, ...current.filter((entry) => entry.domain !== domain)]
      saveStores(updated)
      return updated
    })

    setStoreName('')
    setStoreDomain('')
    setStoreToken('')
    setStoreN8nBaseUrl('')
    setStoreN8nApiKey('')

    toast({ title: 'Store saved', description: `${name} is ready for automation.` })
  }

  const removeStore = (id: string) => {
    setStores((current) => {
      const updated = current.filter((entry) => entry.id !== id)
      saveStores(updated)
      return updated
    })
  }

  const runSnapshot = async (store: ShopifyStoreConfig) => {
    if (!automationAgentId || !automationAgentApiKey) {
      toast({
        title: 'Automation agent required',
        description: 'Select an automation agent and API key first.',
        variant: 'destructive',
      })
      return
    }

    setRunningStoreId(store.id)
    try {
      const result = await invokeAgentShopifySnapshot(
        {
          agentId: automationAgentId,
          agentApiKey: automationAgentApiKey,
          automationSecret: automationSecret.trim() || undefined,
        },
        {
          shopDomain: store.domain,
          accessToken: store.accessToken,
          includeOrders: true,
          includeProducts: true,
          postForumUpdate: true,
          createWorkflow: true,
          workflowName: `${store.name} Shopify Watcher`,
          workflowDescription: `Track orders and fulfillment for ${store.domain}`,
          n8nBaseUrl: store.n8nBaseUrl,
          n8nApiKey: store.n8nApiKey,
        },
      )

      setSnapshots((current) => [
        {
          storeId: store.id,
          takenAt: new Date().toISOString(),
          result,
        },
        ...current.filter((entry) => entry.storeId !== store.id),
      ])

      toast({
        title: `Snapshot ready for ${store.name}`,
        description: `Orders: ${Number(result.snapshot.counts.orders || 0)} | Products: ${Number(result.snapshot.counts.products || 0)}`,
      })
    } catch (error: any) {
      toast({
        title: 'Snapshot failed',
        description: error.message || `Could not pull Shopify snapshot for ${store.name}.`,
        variant: 'destructive',
      })
    } finally {
      setRunningStoreId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-cyber-green" />
            Commerce Ops (Shopify)
          </h2>
          <p className="text-sm text-cyber-gray">Run dropshipping stores with agent snapshots, forum reporting, and n8n workflow links.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Stores</p>
            <p className="mt-1 text-2xl font-bold text-cyber-white">{stores.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Snapshots</p>
            <p className="mt-1 text-2xl font-bold text-cyber-green">{snapshots.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Tracked Orders</p>
            <p className="mt-1 text-2xl font-bold text-cyber-white">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Automation Agent</p>
            <p className="mt-1 text-sm font-semibold text-cyber-white truncate">
              {agents.find((agent) => agent.id === automationAgentId)?.name || 'Not set'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">Automation Auth</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={automationAgentId}
            onChange={(event) => setAutomationAgentId(event.target.value)}
            className="rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
          >
            <option value="">Select automation agent...</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.emoji || '🤖'} {agent.name}
              </option>
            ))}
          </select>
          <Input
            type="password"
            value={automationAgentApiKey}
            onChange={(event) => setAutomationAgentApiKey(event.target.value)}
            placeholder="Automation agent API key"
            className="border-cyber-border bg-cyber-black text-cyber-white"
          />
          <Input
            type="password"
            value={automationSecret}
            onChange={(event) => setAutomationSecret(event.target.value)}
            placeholder="AGENT_AUTOMATION_SECRET (optional)"
            className="border-cyber-border bg-cyber-black text-cyber-white"
          />
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-cyber-green" />
            Add Shopify Store
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <Input value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Store name" className="border-cyber-border bg-cyber-black text-cyber-white" />
          <Input value={storeDomain} onChange={(event) => setStoreDomain(event.target.value)} placeholder="mystore.myshopify.com" className="border-cyber-border bg-cyber-black text-cyber-white" />
          <Input type="password" value={storeToken} onChange={(event) => setStoreToken(event.target.value)} placeholder="Admin API token" className="border-cyber-border bg-cyber-black text-cyber-white" />
          <Input value={storeN8nBaseUrl} onChange={(event) => setStoreN8nBaseUrl(event.target.value)} placeholder="n8n base url (optional)" className="border-cyber-border bg-cyber-black text-cyber-white" />
          <Input type="password" value={storeN8nApiKey} onChange={(event) => setStoreN8nApiKey(event.target.value)} placeholder="n8n key (optional)" className="border-cyber-border bg-cyber-black text-cyber-white" />
          <Button onClick={addStore} className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80">
            <Plus className="mr-2 h-4 w-4" />
            Save Store
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">Store Control Grid</CardTitle>
          <CardDescription>
            Snapshot pulls shop health, order volume, product count, recent order records, and creates/links workflow automation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stores.map((store) => {
            const latest = snapshots.find((entry) => entry.storeId === store.id)
            return (
              <div key={store.id} className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-cyber-white">{store.name}</p>
                    <p className="text-xs text-cyber-gray font-mono">{store.domain}</p>
                    {latest && (
                      <p className="mt-1 text-[11px] text-cyber-gray">Last snapshot: {new Date(latest.takenAt).toLocaleString()}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void runSnapshot(store)}
                      disabled={runningStoreId === store.id}
                      className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
                    >
                      {runningStoreId === store.id ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-1.5 h-3.5 w-3.5" />}
                      {runningStoreId === store.id ? 'Running...' : 'Run Snapshot'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => removeStore(store.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {latest && (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                    <div className="rounded border border-cyber-border bg-cyber-black px-2 py-1.5">
                      <p className="text-[10px] text-cyber-gray">Products</p>
                      <p className="text-sm font-semibold text-cyber-white">{Number(latest.result.snapshot.counts.products || 0)}</p>
                    </div>
                    <div className="rounded border border-cyber-border bg-cyber-black px-2 py-1.5">
                      <p className="text-[10px] text-cyber-gray">Orders</p>
                      <p className="text-sm font-semibold text-cyber-white">{Number(latest.result.snapshot.counts.orders || 0)}</p>
                    </div>
                    <div className="rounded border border-cyber-border bg-cyber-black px-2 py-1.5">
                      <p className="text-[10px] text-cyber-gray">Currency</p>
                      <p className="text-sm font-semibold text-cyber-white">{latest.result.snapshot.shop.currency || '—'}</p>
                    </div>
                    <div className="rounded border border-cyber-border bg-cyber-black px-2 py-1.5">
                      <p className="text-[10px] text-cyber-gray">Plan</p>
                      <p className="text-sm font-semibold text-cyber-white">{latest.result.snapshot.shop.plan || '—'}</p>
                    </div>
                  </div>
                )}

                {latest?.result.workflow && (
                  <div className="mt-2 rounded border border-cyber-border bg-cyber-black px-2 py-1.5 text-[11px] text-cyber-gray">
                    <Workflow className="inline h-3 w-3 mr-1 text-cyber-green" />
                    Linked workflow: {String(latest.result.workflow.name || latest.result.workflow.id || 'created')}
                  </div>
                )}

                {latest && latest.result.snapshot.recentOrders.length > 0 && (
                  <div className="mt-2 rounded border border-cyber-border bg-cyber-black p-2">
                    <p className="text-[10px] uppercase tracking-wide text-cyber-gray">Recent Orders</p>
                    <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-2">
                      {latest.result.snapshot.recentOrders.slice(0, 4).map((order) => (
                        <div key={order.id} className="rounded border border-cyber-border bg-cyber-dark px-2 py-1">
                          <p className="text-[11px] text-cyber-white">{order.name}</p>
                          <p className="text-[10px] text-cyber-gray">{order.total_price} {order.currency} • {order.financial_status}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {stores.length === 0 && (
            <div className="rounded-lg border border-dashed border-cyber-border bg-cyber-dark/30 py-10 text-center">
              <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-cyber-gray" />
              <p className="text-sm text-cyber-white">No Shopify stores configured.</p>
              <p className="text-xs text-cyber-gray mt-1">Add your stores and let agents run dropshipping operations.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">Dropshipping Automation Playbook</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
            <p className="text-xs text-cyber-gray flex items-center gap-1"><Globe className="h-3.5 w-3.5 text-cyber-green" />Traffic</p>
            <p className="mt-1 text-xs text-cyber-white">Use Brave search + ad/SEO workflows to discover products and niches weekly.</p>
          </div>
          <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
            <p className="text-xs text-cyber-gray flex items-center gap-1"><Package className="h-3.5 w-3.5 text-cyber-green" />Catalog</p>
            <p className="mt-1 text-xs text-cyber-white">Agents monitor SKU counts, stale products, and conversion drop-offs per store.</p>
          </div>
          <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
            <p className="text-xs text-cyber-gray flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-cyber-green" />Fulfillment</p>
            <p className="mt-1 text-xs text-cyber-white">Orders + fulfillment status can trigger support or supplier escalation workflows in n8n.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
