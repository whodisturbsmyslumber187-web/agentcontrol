import { useMemo, useState, useEffect, type ChangeEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useToast } from '../components/ui/use-toast'
import { useAgentStore } from '../stores/agent-store'
import {
  Webhook,
  Play,
  Plus,
  RefreshCw,
  Clock,
  Trash2,
  Upload,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Link2,
  Monitor,
  Server,
  TerminalSquare,
} from 'lucide-react'
import { insforge } from '../lib/insforge'

interface Workflow {
  id: string
  name: string
  description: string
  trigger_url: string
  is_active: boolean
  last_run_at?: string
  last_status?: 'success' | 'failure'
  created_at: string
}

export interface WorkflowImportDraft {
  name: string
  description: string
  trigger_url: string
  is_active: boolean
  source: 'json' | 'n8n-export' | 'line'
  n8n_workflow?: Record<string, unknown>
}

interface N8nWorkflowRecord {
  id: string
  name: string
  active: boolean
  updatedAt?: string
  webhookPaths: string[]
  triggerUrls: string[]
  raw?: Record<string, unknown>
}

interface N8nFetchResult {
  rows: N8nWorkflowRecord[]
  warnings: string[]
}

const N8N_BASE_URL_KEY = 'agentforge-n8n-base-url'
const N8N_API_KEY_KEY = 'agentforge-n8n-api-key'
const N8N_MCP_ENDPOINT_KEY = 'agentforge-n8n-mcp-endpoint'
const N8N_SSH_HOST_KEY = 'agentforge-n8n-ssh-host'
const N8N_SSH_USER_KEY = 'agentforge-n8n-ssh-user'
const N8N_SSH_PORT_KEY = 'agentforge-n8n-ssh-port'
const N8N_RUNNER_URL_KEY = 'agentforge-n8n-runner-url'
const N8N_RUNNER_TOKEN_KEY = 'agentforge-n8n-runner-token'
const N8N_WORKSPACE_PATH_KEY = 'agentforge-n8n-workspace-path'

const N8N_OFFICIAL_LINKS = [
  { label: 'Official n8n Repo', url: 'https://github.com/n8n-io/n8n' },
  { label: 'Official n8n Docs', url: 'https://docs.n8n.io' },
  { label: 'Official Templates', url: 'https://n8n.io/workflows/' },
  { label: 'AI Starter Kit Repo', url: 'https://github.com/n8n-io/self-hosted-ai-starter-kit' },
]

const SAMPLE_BULK_INPUT = `# CSV format (name,url,description)
Daily SEO Report,https://n8n.example.com/webhook/daily-seo,Daily SEO automation
Lead Sync,https://n8n.example.com/webhook/lead-sync,Sync leads into CRM

# JSON format (single object)
{
  "name": "Revenue Digest",
  "trigger_url": "https://n8n.example.com/webhook/revenue-digest",
  "description": "Daily revenue snapshot"
}

# n8n workflow export (object or array) also supported`

export function sanitizeBaseUrl(input: string) {
  return input.trim().replace(/\/+$/, '')
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

export function normalizeUrl(raw: string, baseUrl: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (isHttpUrl(trimmed)) return trimmed
  if (!baseUrl) return ''

  const normalizedBase = sanitizeBaseUrl(baseUrl)
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${normalizedBase}${normalizedPath}`
}

function deriveNameFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const finalSegment = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname
    return finalSegment
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  } catch {
    return 'Imported Workflow'
  }
}

function parseCsvLine(line: string) {
  const parts: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  parts.push(current.trim())
  return parts
}

function extractN8nDrafts(item: Record<string, unknown>, baseUrl: string): WorkflowImportDraft[] {
  const workflowName = typeof item.name === 'string' ? item.name.trim() : 'Imported n8n Workflow'
  const workflowDescription = typeof item.description === 'string' ? item.description.trim() : ''
  const active = typeof item.active === 'boolean' ? item.active : true

  const nodes = Array.isArray(item.nodes) ? item.nodes : []
  const webhookDrafts: WorkflowImportDraft[] = []

  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue
    const record = node as Record<string, unknown>
    const nodeType = typeof record.type === 'string' ? record.type : ''
    if (!nodeType.toLowerCase().includes('webhook')) continue

    const parameters =
      record.parameters && typeof record.parameters === 'object' && !Array.isArray(record.parameters)
        ? (record.parameters as Record<string, unknown>)
        : {}
    const rawPath = typeof parameters.path === 'string' ? parameters.path : ''
    const webhookPath = rawPath ? `/webhook/${rawPath.replace(/^\/+/, '')}` : ''
    const triggerUrl = normalizeUrl(webhookPath, baseUrl)
    if (!triggerUrl) continue

    const nodeName = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Webhook'
    webhookDrafts.push({
      name: `${workflowName} - ${nodeName}`,
      description: workflowDescription || `Imported from n8n (${nodeName})`,
      trigger_url: triggerUrl,
      is_active: active,
      source: 'n8n-export',
      n8n_workflow: item,
    })
  }

  if (webhookDrafts.length > 0) return webhookDrafts

  const fallbackPath = `/webhook/${slugify(workflowName || 'workflow')}`
  const fallbackUrl = normalizeUrl(fallbackPath, baseUrl)
  if (!fallbackUrl) return []

  return [
    {
      name: workflowName,
      description: workflowDescription || 'Imported from n8n export (fallback webhook path)',
      trigger_url: fallbackUrl,
      is_active: active,
      source: 'n8n-export',
      n8n_workflow: item,
    },
  ]
}

function toDraftsFromObject(item: Record<string, unknown>, baseUrl: string): WorkflowImportDraft[] {
  const triggerValue =
    (typeof item.trigger_url === 'string' && item.trigger_url) ||
    (typeof item.triggerUrl === 'string' && item.triggerUrl) ||
    (typeof item.webhook_url === 'string' && item.webhook_url) ||
    (typeof item.webhookUrl === 'string' && item.webhookUrl) ||
    (typeof item.url === 'string' && item.url) ||
    ''

  const nameValue = typeof item.name === 'string' ? item.name.trim() : ''
  const descriptionValue = typeof item.description === 'string' ? item.description.trim() : ''
  const activeValue = typeof item.is_active === 'boolean' ? item.is_active : typeof item.active === 'boolean' ? item.active : true

  if (triggerValue) {
    const triggerUrl = normalizeUrl(triggerValue, baseUrl)
    if (!triggerUrl) return []
    return [
      {
        name: nameValue || deriveNameFromUrl(triggerUrl),
        description: descriptionValue,
        trigger_url: triggerUrl,
        is_active: activeValue,
        source: 'json',
      },
    ]
  }

  if (Array.isArray(item.nodes)) {
    return extractN8nDrafts(item, baseUrl)
  }

  return []
}

export function extractN8nWebhookPaths(workflow: Record<string, unknown>): string[] {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
  const paths = new Set<string>()

  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue
    const row = node as Record<string, unknown>
    const type = typeof row.type === 'string' ? row.type.toLowerCase() : ''
    if (!type.includes('webhook')) continue

    const parameters =
      row.parameters && typeof row.parameters === 'object' && !Array.isArray(row.parameters)
        ? (row.parameters as Record<string, unknown>)
        : {}
    const path =
      (typeof parameters.path === 'string' ? parameters.path : '') ||
      (typeof parameters.webhookPath === 'string' ? parameters.webhookPath : '')

    if (path) paths.add(path.replace(/^\/+/, ''))
  }

  return [...paths]
}

export function webhookPathFromTriggerUrl(triggerUrl: string, baseUrl: string): string {
  try {
    const parsed = new URL(triggerUrl)
    const normalizedBase = sanitizeBaseUrl(baseUrl)
    const baseHost = normalizedBase ? new URL(normalizedBase).host : ''
    if (baseHost && parsed.host !== baseHost) return ''
    const segments = parsed.pathname.split('/').filter(Boolean)
    const webhookIndex = segments.indexOf('webhook')
    if (webhookIndex === -1) return ''
    const path = segments.slice(webhookIndex + 1).join('/')
    return path
  } catch {
    return ''
  }
}

export function createTemplateWorkflowFromDraft(
  draft: WorkflowImportDraft,
  n8nBaseUrl: string,
): Record<string, unknown> {
  const pathFromTrigger = webhookPathFromTriggerUrl(draft.trigger_url, n8nBaseUrl)
  const fallbackPath = slugify(draft.name || deriveNameFromUrl(draft.trigger_url)) || `workflow-${Date.now()}`
  const webhookPath = pathFromTrigger || fallbackPath

  return {
    name: draft.name,
    active: draft.is_active,
    settings: {},
    nodes: [
      {
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [260, 320],
        parameters: {
          path: webhookPath,
          httpMethod: 'POST',
          responseMode: 'responseNode',
        },
      },
      {
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.2,
        position: [560, 320],
        parameters: {
          respondWith: 'json',
          responseBody: '={{ { "ok": true, "workflow": $workflow.name } }}',
        },
      },
    ],
    connections: {
      Webhook: {
        main: [
          [
            {
              node: 'Respond to Webhook',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    },
  }
}

export function normalizeN8nWorkflowRows(payload: unknown): N8nWorkflowRecord[] {
  const records: N8nWorkflowRecord[] = []
  const rows = (() => {
    if (Array.isArray(payload)) return payload
    if (payload && typeof payload === 'object') {
      const root = payload as Record<string, unknown>
      if (Array.isArray(root.data)) return root.data
      if (Array.isArray(root.workflows)) return root.workflows
    }
    return []
  })()

  for (const entry of rows) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : typeof row.id === 'number' ? String(row.id) : ''
    const name = typeof row.name === 'string' ? row.name.trim() : 'n8n Workflow'
    const active = typeof row.active === 'boolean' ? row.active : Boolean(row.isActive)
    const updatedAt =
      (typeof row.updatedAt === 'string' && row.updatedAt) ||
      (typeof row.updated_at === 'string' && row.updated_at) ||
      undefined
    const webhookPaths = extractN8nWebhookPaths(row)
    const webhookUrls = Array.isArray(row.webhookUrls)
      ? row.webhookUrls
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(Boolean)
      : []

    records.push({
      id,
      name,
      active,
      updatedAt,
      webhookPaths,
      triggerUrls: webhookUrls,
      raw: row,
    })
  }

  return records
}

export default function Workflows() {
  const { toast } = useToast()
  const { agents, fetchAgents, updateAgent } = useAgentStore()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [remoteWorkflows, setRemoteWorkflows] = useState<N8nWorkflowRecord[]>([])
  const [remoteWarnings, setRemoteWarnings] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [isSyncingN8n, setIsSyncingN8n] = useState(false)
  const [isPushingBulkToN8n, setIsPushingBulkToN8n] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [newWorkflow, setNewWorkflow] = useState({ name: '', description: '', trigger_url: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [n8nBaseUrl, setN8nBaseUrl] = useState('')
  const [n8nApiKey, setN8nApiKey] = useState('')
  const [n8nMcpEndpoint, setN8nMcpEndpoint] = useState('')
  const [sshHost, setSshHost] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [sshPort, setSshPort] = useState('22')
  const [runnerUrl, setRunnerUrl] = useState('')
  const [runnerToken, setRunnerToken] = useState('')
  const [workspacePath, setWorkspacePath] = useState('/home/workflows')
  const [showEmbeddedWorkspace, setShowEmbeddedWorkspace] = useState(false)
  const [automationAgentId, setAutomationAgentId] = useState('')
  const [consoleShell, setConsoleShell] = useState<'bash' | 'powershell'>('bash')
  const [consoleCommand, setConsoleCommand] = useState('')
  const [consoleOutput, setConsoleOutput] = useState('')
  const [isConsoleRunning, setIsConsoleRunning] = useState(false)
  const [syncRemoteToLocal, setSyncRemoteToLocal] = useState(true)
  const [activateRemoteImports, setActivateRemoteImports] = useState(true)

  const [bulkInput, setBulkInput] = useState('')
  const [bulkBaseUrl, setBulkBaseUrl] = useState('')
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkPreview, setBulkPreview] = useState<WorkflowImportDraft[]>([])
  const [bulkWarnings, setBulkWarnings] = useState<string[]>([])
  const [isParsingBulk, setIsParsingBulk] = useState(false)
  const [isImportingBulk, setIsImportingBulk] = useState(false)

  useEffect(() => {
    void fetchWorkflows()
    void fetchAgents()
  }, [])

  useEffect(() => {
    const storedBase = localStorage.getItem(N8N_BASE_URL_KEY) || ''
    const storedApiKey = localStorage.getItem(N8N_API_KEY_KEY) || ''
    const storedMcpEndpoint = localStorage.getItem(N8N_MCP_ENDPOINT_KEY) || ''
    const storedSshHost = localStorage.getItem(N8N_SSH_HOST_KEY) || ''
    const storedSshUser = localStorage.getItem(N8N_SSH_USER_KEY) || 'root'
    const storedSshPort = localStorage.getItem(N8N_SSH_PORT_KEY) || '22'
    const storedRunnerUrl = localStorage.getItem(N8N_RUNNER_URL_KEY) || ''
    const storedRunnerToken = localStorage.getItem(N8N_RUNNER_TOKEN_KEY) || ''
    const storedWorkspacePath = localStorage.getItem(N8N_WORKSPACE_PATH_KEY) || '/home/workflows'

    setN8nBaseUrl(storedBase)
    setN8nApiKey(storedApiKey)
    setN8nMcpEndpoint(storedMcpEndpoint || (storedBase ? `${sanitizeBaseUrl(storedBase)}/mcp` : ''))
    setSshHost(storedSshHost)
    setSshUser(storedSshUser)
    setSshPort(storedSshPort)
    setRunnerUrl(storedRunnerUrl)
    setRunnerToken(storedRunnerToken)
    setWorkspacePath(storedWorkspacePath.startsWith('/') ? storedWorkspacePath : `/${storedWorkspacePath}`)
  }, [])

  useEffect(() => {
    if (agents.length === 0 || automationAgentId) return
    const withApiKey = agents.find((agent) => Boolean(agent.api_key))
    setAutomationAgentId(withApiKey?.id || agents[0].id)
  }, [agents, automationAgentId])

  useEffect(() => {
    if (!n8nBaseUrl.trim()) return
    if (n8nMcpEndpoint.trim()) return
    setN8nMcpEndpoint(`${sanitizeBaseUrl(n8nBaseUrl)}/mcp`)
  }, [n8nBaseUrl, n8nMcpEndpoint])

  const existingTriggerSet = useMemo(
    () => new Set(workflows.map((workflow) => workflow.trigger_url.trim().toLowerCase())),
    [workflows],
  )

  const sshConnectCommand = useMemo(() => {
    if (!sshHost.trim()) return ''
    const user = sshUser.trim() || 'root'
    const port = sshPort.trim() || '22'
    return `ssh -p ${port} ${user}@${sshHost.trim()}`
  }, [sshHost, sshPort, sshUser])

  const runbookCommand = useMemo(() => {
    if (!sshConnectCommand) return ''
    return `${sshConnectCommand} \"docker ps | grep n8n && docker logs --tail 80 n8n\"`
  }, [sshConnectCommand])

  const workspaceUrl = useMemo(() => {
    const base = sanitizeBaseUrl(n8nBaseUrl)
    if (!base) return ''
    const path = workspacePath.trim() || '/home/workflows'
    return `${base}${path.startsWith('/') ? path : `/${path}`}`
  }, [n8nBaseUrl, workspacePath])

  const commandPresets = useMemo(
    () => [
      {
        label: 'n8n container status',
        command: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" | grep n8n',
      },
      {
        label: 'n8n recent logs',
        command: 'docker logs --tail 120 n8n',
      },
      {
        label: 'n8n update (docker)',
        command:
          'docker pull n8nio/n8n:latest && docker stop n8n && docker rm n8n && docker run -d --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n --restart unless-stopped n8nio/n8n:latest',
      },
      {
        label: 'n8n API ping',
        command: `curl -s ${sanitizeBaseUrl(n8nBaseUrl) || 'https://n8n.example.com'}/healthz`,
      },
    ],
    [n8nBaseUrl],
  )

  useEffect(() => {
    if (consoleCommand.trim()) return
    setConsoleCommand('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" | grep n8n')
  }, [consoleCommand])

  const copyValue = async (value: string, label: string) => {
    if (!value.trim()) {
      toast({
        title: `${label} is empty`,
        variant: 'destructive',
      })
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: `${label} copied` })
    } catch {
      toast({
        title: `Failed to copy ${label.toLowerCase()}`,
        description: 'Clipboard access may be blocked by browser permissions.',
        variant: 'destructive',
      })
    }
  }

  const persistConnectionSettings = () => {
    const normalizedBase = sanitizeBaseUrl(n8nBaseUrl)
    const derivedMcp = n8nMcpEndpoint.trim() || (normalizedBase ? `${normalizedBase}/mcp` : '')

    localStorage.setItem(N8N_BASE_URL_KEY, normalizedBase)
    localStorage.setItem(N8N_API_KEY_KEY, n8nApiKey.trim())
    localStorage.setItem(N8N_MCP_ENDPOINT_KEY, derivedMcp)
    localStorage.setItem(N8N_SSH_HOST_KEY, sshHost.trim())
    localStorage.setItem(N8N_SSH_USER_KEY, sshUser.trim() || 'root')
    localStorage.setItem(N8N_SSH_PORT_KEY, sshPort.trim() || '22')
    localStorage.setItem(N8N_RUNNER_URL_KEY, runnerUrl.trim())
    localStorage.setItem(N8N_RUNNER_TOKEN_KEY, runnerToken.trim())
    localStorage.setItem(N8N_WORKSPACE_PATH_KEY, workspacePath.trim() || '/home/workflows')

    setN8nBaseUrl(normalizedBase)
    setN8nMcpEndpoint(derivedMcp)
    toast({
      title: 'Connection settings saved',
      description: 'n8n, MCP, SSH, console runner, and workspace defaults saved in this browser.',
    })
  }

  const ensureAgentApiKey = async (agentId: string) => {
    const target = agents.find((agent) => agent.id === agentId)
    if (!target) throw new Error('Selected automation agent not found')
    if (target.api_key) return target.api_key

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)

    await updateAgent(agentId, { api_key: generated })
    return generated
  }

  const openN8nPage = (path: string) => {
    const base = sanitizeBaseUrl(n8nBaseUrl)
    if (!base) {
      toast({
        title: 'n8n Base URL required',
        description: 'Set and save your n8n base URL first.',
        variant: 'destructive',
      })
      return
    }
    window.open(`${base}${path}`, '_blank', 'noopener,noreferrer')
  }

  const fetchN8nWorkflows = async (): Promise<N8nFetchResult> => {
    const base = sanitizeBaseUrl(n8nBaseUrl)
    const apiKey = n8nApiKey.trim()
    if (!base || !apiKey) {
      throw new Error('n8n base URL and API key are required')
    }

    const attempts = [`${base}/api/v1/workflows`, `${base}/rest/workflows`]
    const warnings: string[] = []

    for (const endpoint of attempts) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            Accept: 'application/json',
            'X-N8N-API-KEY': apiKey,
          },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          warnings.push(`${endpoint}: HTTP ${response.status}`)
          continue
        }
        const rows = normalizeN8nWorkflowRows(payload)
        if (rows.length === 0) {
          warnings.push(`${endpoint}: no workflows returned`)
        }
        return { rows, warnings }
      } catch (error: any) {
        warnings.push(`${endpoint}: ${error.message || 'request failed'}`)
      }
    }

    return { rows: [], warnings }
  }

  const syncRemoteWorkflows = async () => {
    setIsSyncingN8n(true)
    try {
      const result = await fetchN8nWorkflows()
      setRemoteWorkflows(result.rows)
      setRemoteWarnings(result.warnings)

      let importedCount = 0
      if (syncRemoteToLocal && result.rows.length > 0) {
        const existing = new Set(workflows.map((workflow) => workflow.trigger_url.trim().toLowerCase()))
        const inserts: Array<{ name: string; description: string; trigger_url: string; is_active: boolean }> = []

        for (const row of result.rows) {
          const directUrls = row.triggerUrls.filter((entry) => isHttpUrl(entry))
          const derivedUrls = row.webhookPaths
            .map((path) => normalizeUrl(`/webhook/${path.replace(/^\/+/, '')}`, n8nBaseUrl))
            .filter(Boolean)
          const candidateUrls = [...directUrls, ...derivedUrls]

          if (candidateUrls.length === 0) continue
          const triggerUrl = candidateUrls[0]
          const key = triggerUrl.toLowerCase()
          if (existing.has(key)) continue

          existing.add(key)
          inserts.push({
            name: row.name,
            description: row.webhookPaths.length
              ? `Synced from n8n (${row.webhookPaths.join(', ')})`
              : 'Synced from n8n',
            trigger_url: triggerUrl,
            is_active: row.active,
          })
        }

        if (inserts.length > 0) {
          const { error } = await insforge.database.from('agent_workflows').insert(inserts)
          if (error) throw error
          importedCount = inserts.length
          await fetchWorkflows()
        }
      }

      toast({
        title: `n8n sync complete (${result.rows.length} remote workflows)`,
        description: importedCount > 0 ? `${importedCount} new workflows added locally.` : 'Local catalog is up to date.',
      })
    } catch (error: any) {
      toast({
        title: 'n8n sync failed',
        description: error.message || 'Could not fetch workflows from n8n API.',
        variant: 'destructive',
      })
    } finally {
      setIsSyncingN8n(false)
    }
  }

  const fetchWorkflows = async () => {
    setRefreshing(true)
    try {
      const { data, error } = await insforge.database
        .from('agent_workflows')
        .select()
        .order('created_at', { ascending: false })
      if (error) throw error
      setWorkflows((data || []) as Workflow[])
    } catch (error: any) {
      toast({
        title: 'Failed to load workflows',
        description: error.message || 'Could not fetch workflows.',
        variant: 'destructive',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const { error } = await insforge.database.from('agent_workflows').insert([
        {
          name: newWorkflow.name.trim(),
          description: newWorkflow.description.trim(),
          trigger_url: newWorkflow.trigger_url.trim(),
          is_active: true,
        },
      ])

      if (error) throw error

      setNewWorkflow({ name: '', description: '', trigger_url: '' })
      setShowAddModal(false)
      await fetchWorkflows()
      toast({ title: 'Workflow added', description: 'New workflow is ready.' })
    } catch (error: any) {
      toast({
        title: 'Workflow create failed',
        description: error.message || 'Could not create workflow.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this workflow?')) return
    try {
      const { error } = await insforge.database.from('agent_workflows').delete().eq('id', id)
      if (error) throw error
      await fetchWorkflows()
      toast({ title: 'Workflow deleted' })
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message || 'Could not delete workflow.',
        variant: 'destructive',
      })
    }
  }

  const handleToggleActive = async (workflow: Workflow) => {
    try {
      const { error } = await insforge.database
        .from('agent_workflows')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id)
      if (error) throw error

      setWorkflows((current) =>
        current.map((entry) => (entry.id === workflow.id ? { ...entry, is_active: !workflow.is_active } : entry)),
      )
    } catch (error: any) {
      toast({
        title: 'Status update failed',
        description: error.message || 'Could not update workflow status.',
        variant: 'destructive',
      })
    }
  }

  const handleTrigger = async (workflow: Workflow) => {
    try {
      const response = await fetch(workflow.trigger_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'agentforge-dashboard' }),
      })

      const nextStatus = response.ok ? 'success' : 'failure'
      await insforge.database
        .from('agent_workflows')
        .update({ last_run_at: new Date().toISOString(), last_status: nextStatus })
        .eq('id', workflow.id)

      setWorkflows((current) =>
        current.map((entry) =>
          entry.id === workflow.id
            ? { ...entry, last_run_at: new Date().toISOString(), last_status: nextStatus }
            : entry,
        ),
      )

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      toast({ title: `Triggered ${workflow.name}` })
    } catch (error) {
      console.error('Failed to trigger webhook', error)
      toast({
        title: 'Trigger failed',
        description: 'Check URL, auth, or CORS on the n8n webhook.',
        variant: 'destructive',
      })
    }
  }

  const resetBulkImport = () => {
    setBulkInput('')
    setBulkBaseUrl('')
    setBulkFileName('')
    setBulkPreview([])
    setBulkWarnings([])
    setShowBulkModal(false)
  }

  const handleBulkFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    try {
      const text = await selectedFile.text()
      setBulkInput(text)
      setBulkFileName(selectedFile.name)
      toast({
        title: `Loaded ${selectedFile.name}`,
        description: 'Now click Preview Import to parse entries.',
      })
    } catch {
      toast({
        title: 'File read failed',
        description: 'Could not read selected file.',
        variant: 'destructive',
      })
    } finally {
      event.target.value = ''
    }
  }

  const parseBulkPayload = () => {
    const raw = bulkInput.trim()
    if (!raw) {
      toast({
        title: 'No bulk data provided',
        description: 'Paste n8n JSON export or CSV lines first.',
        variant: 'destructive',
      })
      return
    }

    setIsParsingBulk(true)
    try {
      const drafts: WorkflowImportDraft[] = []
      const warnings: string[] = []
      const normalizedBaseUrl = sanitizeBaseUrl(bulkBaseUrl || n8nBaseUrl)

      let parsedAsJson = false
      try {
        const parsed = JSON.parse(raw) as unknown
        parsedAsJson = true

        const sourceItems = (() => {
          if (Array.isArray(parsed)) return parsed
          if (parsed && typeof parsed === 'object') {
            const record = parsed as Record<string, unknown>
            if (Array.isArray(record.workflows)) return record.workflows
            return [record]
          }
          return []
        })()

        for (const item of sourceItems) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) continue
          drafts.push(...toDraftsFromObject(item as Record<string, unknown>, normalizedBaseUrl))
        }
      } catch {
        parsedAsJson = false
      }

      if (!parsedAsJson) {
        const lines = raw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'))

        for (const line of lines) {
          if (!line) continue

          if (line.startsWith('{') && line.endsWith('}')) {
            try {
              const row = JSON.parse(line) as Record<string, unknown>
              drafts.push(...toDraftsFromObject(row, normalizedBaseUrl))
            } catch {
              warnings.push(`Skipped invalid JSON line: ${line.slice(0, 80)}`)
            }
            continue
          }

          const parts = parseCsvLine(line)
          if (parts.length === 0) continue

          let name = ''
          let trigger = ''
          let description = ''

          if (parts.length === 1) {
            trigger = normalizeUrl(parts[0], normalizedBaseUrl)
            name = trigger ? deriveNameFromUrl(trigger) : ''
          } else if (isHttpUrl(parts[0]) || parts[0].startsWith('/')) {
            trigger = normalizeUrl(parts[0], normalizedBaseUrl)
            name = parts[1] || (trigger ? deriveNameFromUrl(trigger) : '')
            description = parts.slice(2).join(', ')
          } else {
            name = parts[0]
            trigger = normalizeUrl(parts[1] || '', normalizedBaseUrl)
            description = parts.slice(2).join(', ')
          }

          if (!name || !trigger) {
            warnings.push(`Skipped line (missing name or url): ${line.slice(0, 80)}`)
            continue
          }

          drafts.push({
            name: name.trim(),
            description: description.trim(),
            trigger_url: trigger.trim(),
            is_active: true,
            source: 'line',
          })
        }
      }

      const deduped: WorkflowImportDraft[] = []
      const localSeen = new Set<string>()

      for (const draft of drafts) {
        const key = draft.trigger_url.trim().toLowerCase()
        if (!isHttpUrl(draft.trigger_url)) {
          warnings.push(`Skipped invalid URL: ${draft.trigger_url}`)
          continue
        }
        if (existingTriggerSet.has(key)) {
          warnings.push(`Skipped existing workflow URL: ${draft.trigger_url}`)
          continue
        }
        if (localSeen.has(key)) {
          warnings.push(`Skipped duplicate import URL: ${draft.trigger_url}`)
          continue
        }
        localSeen.add(key)
        deduped.push(draft)
      }

      setBulkPreview(deduped)
      setBulkWarnings(warnings)

      if (deduped.length === 0) {
        toast({
          title: 'No valid workflows found',
          description: 'All entries were invalid or already imported.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: `Prepared ${deduped.length} workflows`,
          description: warnings.length > 0 ? `${warnings.length} entries were skipped.` : 'Ready to import.',
        })
      }
    } finally {
      setIsParsingBulk(false)
    }
  }

  const importBulkWorkflows = async () => {
    if (bulkPreview.length === 0) {
      parseBulkPayload()
      return
    }

    setIsImportingBulk(true)
    try {
      const rows = bulkPreview.map((item) => ({
        name: item.name,
        description: item.description,
        trigger_url: item.trigger_url,
        is_active: item.is_active,
      }))

      const { error } = await insforge.database.from('agent_workflows').insert(rows)
      if (error) throw error

      toast({
        title: `Imported ${rows.length} workflows`,
        description: 'Bulk n8n workflow import complete.',
      })

      await fetchWorkflows()
      resetBulkImport()
    } catch (error: any) {
      toast({
        title: 'Bulk import failed',
        description: error.message || 'Could not import workflows.',
        variant: 'destructive',
      })
    } finally {
      setIsImportingBulk(false)
    }
  }

  const pushBulkPreviewToN8n = async () => {
    if (bulkPreview.length === 0) {
      parseBulkPayload()
      return
    }

    if (!automationAgentId) {
      toast({
        title: 'Select an automation agent',
        description: 'Choose which agent should import workflows into n8n.',
        variant: 'destructive',
      })
      return
    }

    if (!sanitizeBaseUrl(n8nBaseUrl) || !n8nApiKey.trim()) {
      toast({
        title: 'n8n connection missing',
        description: 'Set n8n base URL and API key before remote import.',
        variant: 'destructive',
      })
      return
    }

    setIsPushingBulkToN8n(true)
    try {
      const agentApiKey = await ensureAgentApiKey(automationAgentId)
      let success = 0
      const warnings: string[] = []
      const failed: WorkflowImportDraft[] = []

      for (const draft of bulkPreview) {
        const templateWorkflow = createTemplateWorkflowFromDraft(draft, n8nBaseUrl)
        const n8nWorkflow = draft.n8n_workflow || templateWorkflow

        const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
          body: {
            action: 'create_n8n_workflow',
            agentId: automationAgentId,
            agentApiKey,
            name: draft.name,
            description: draft.description,
            triggerUrl: draft.trigger_url,
            is_active: draft.is_active,
            activate: activateRemoteImports,
            n8nBaseUrl: sanitizeBaseUrl(n8nBaseUrl),
            n8nApiKey: n8nApiKey.trim(),
            n8nWorkflow,
          },
        })

        if (error) {
          warnings.push(`${draft.name}: ${error.message || 'bridge request failed'}`)
          failed.push(draft)
          continue
        }

        const row = (data || {}) as Record<string, unknown>
        const remote = row.n8n && typeof row.n8n === 'object' ? (row.n8n as Record<string, unknown>) : {}
        const bridgeWarning = typeof remote.warning === 'string' ? remote.warning : ''
        if (bridgeWarning) {
          warnings.push(`${draft.name}: ${bridgeWarning}`)
        }
        success += 1
      }

      setBulkPreview(failed)
      setBulkWarnings((current) => [...current, ...warnings])

      toast({
        title: `Remote import complete (${success}/${bulkPreview.length})`,
        description: failed.length > 0 ? `${failed.length} workflows need retry.` : 'All workflows imported into n8n.',
      })

      await fetchWorkflows()
      if (failed.length === 0) {
        resetBulkImport()
      }
    } catch (error: any) {
      toast({
        title: 'Remote n8n import failed',
        description: error.message || 'Could not import workflows via automation bridge.',
        variant: 'destructive',
      })
    } finally {
      setIsPushingBulkToN8n(false)
    }
  }

  const applyCommandPreset = (command: string) => {
    setConsoleCommand(command)
  }

  const executeConsoleCommand = async () => {
    if (!automationAgentId) {
      toast({
        title: 'Automation agent required',
        description: 'Pick an agent so execution can be authenticated.',
        variant: 'destructive',
      })
      return
    }

    if (!consoleCommand.trim()) {
      toast({
        title: 'Command required',
        description: 'Enter a command before running.',
        variant: 'destructive',
      })
      return
    }

    setIsConsoleRunning(true)
    try {
      const agentApiKey = await ensureAgentApiKey(automationAgentId)
      const { data, error } = await insforge.functions.invoke('agent-automation-bridge', {
        body: {
          action: 'execute_remote_command',
          agentId: automationAgentId,
          agentApiKey,
          command: consoleCommand.trim(),
          shell: consoleShell,
          runnerUrl: runnerUrl.trim(),
          runnerToken: runnerToken.trim(),
          ssh: {
            host: sshHost.trim(),
            user: sshUser.trim() || 'root',
            port: sshPort.trim() || '22',
          },
        },
      })

      if (error) throw error

      const payload = (data || {}) as Record<string, unknown>
      const stdout = typeof payload.stdout === 'string' ? payload.stdout : ''
      const stderr = typeof payload.stderr === 'string' ? payload.stderr : ''
      const runCommand = typeof payload.runCommand === 'string' ? payload.runCommand : ''
      const suggestedCommand = typeof payload.suggestedCommand === 'string' ? payload.suggestedCommand : ''
      const dryRun = payload.dryRun === true
      const exitCode = typeof payload.exitCode === 'number' ? payload.exitCode : undefined

      const outputSections = [
        `$ ${consoleCommand.trim()}`,
        typeof exitCode === 'number' ? `exitCode: ${exitCode}` : '',
        stdout ? `--- stdout ---\n${stdout}` : '',
        stderr ? `--- stderr ---\n${stderr}` : '',
        runCommand ? `--- ssh command ---\n${runCommand}` : '',
        suggestedCommand ? `--- suggested ---\n${suggestedCommand}` : '',
        dryRun ? 'Runner URL missing: command was prepared but not executed remotely.' : '',
      ].filter(Boolean)

      setConsoleOutput(outputSections.join('\n\n') || 'No output returned.')
      toast({
        title: dryRun ? 'Command prepared (dry run)' : 'Command executed',
        description: dryRun ? 'Add runner URL/token to execute on your VPS from the panel.' : 'Remote command completed.',
      })
    } catch (error: any) {
      toast({
        title: 'Remote command failed',
        description: error.message || 'Could not execute command through agent bridge.',
        variant: 'destructive',
      })
    } finally {
      setIsConsoleRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold text-cyber-white">
            <Webhook className="h-7 w-7 animate-pulse text-pink-500" />
            n8n Workflows
          </h2>
          <p className="text-sm text-cyber-gray">
            Native-style workflow control with n8n sync, bulk import, MCP endpoint, and SSH runbook access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void fetchWorkflows()}
            disabled={refreshing}
            variant="outline"
            className="border-cyber-border text-cyber-gray hover:text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => void syncRemoteWorkflows()}
            disabled={isSyncingN8n}
            variant="outline"
            className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            <Monitor className={`mr-2 h-4 w-4 ${isSyncingN8n ? 'animate-pulse' : ''}`} />
            {isSyncingN8n ? 'Syncing n8n...' : 'Sync n8n'}
          </Button>
          <Button
            onClick={() => setShowBulkModal(true)}
            variant="outline"
            className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-pink-600 text-white hover:bg-pink-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="border-cyber-border bg-cyber-card xl:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyber-white">
              <Server className="h-4 w-4 text-cyan-300" />
              n8n Connection Studio
            </CardTitle>
            <CardDescription>Match native n8n workflow control: connect, open editor, and sync catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-cyber-white">n8n Base URL</Label>
                <Input
                  value={n8nBaseUrl}
                  onChange={(event) => setN8nBaseUrl(event.target.value)}
                  className="border-cyber-border bg-cyber-black text-cyber-white"
                  placeholder="https://n8n.your-domain.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-cyber-white">n8n API Key</Label>
                <Input
                  type="password"
                  value={n8nApiKey}
                  onChange={(event) => setN8nApiKey(event.target.value)}
                  className="border-cyber-border bg-cyber-black text-cyber-white"
                  placeholder="n8n_api_..."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-cyber-white">n8n MCP Endpoint</Label>
                <Input
                  value={n8nMcpEndpoint}
                  onChange={(event) => setN8nMcpEndpoint(event.target.value)}
                  className="border-cyber-border bg-cyber-black font-mono text-xs text-cyber-white"
                  placeholder="https://n8n.your-domain.com/mcp"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={persistConnectionSettings} className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80">
                Save Connection
              </Button>
              <Button
                variant="outline"
                className="border-cyber-border text-cyber-gray hover:text-cyber-white"
                onClick={() => openN8nPage('/home/workflows')}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open Workflow Editor
              </Button>
              <Button
                variant="outline"
                className="border-cyber-border text-cyber-gray hover:text-cyber-white"
                onClick={() => openN8nPage('/executions')}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open Executions
              </Button>
              <Button
                variant="outline"
                className="border-cyber-border text-cyber-gray hover:text-cyber-white"
                onClick={() => openN8nPage('/credentials')}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open Credentials
              </Button>
              <Button
                variant="outline"
                className="border-cyber-border text-cyber-gray hover:text-cyber-white"
                onClick={() => openN8nPage('/signin')}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open n8n Login
              </Button>
              <Button
                variant="outline"
                className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                onClick={() => setShowEmbeddedWorkspace((current) => !current)}
              >
                <Monitor className="mr-1.5 h-3.5 w-3.5" />
                {showEmbeddedWorkspace ? 'Hide Embedded n8n' : 'Embed n8n Workspace'}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-cyber-white">Workspace Path</Label>
                <Input
                  value={workspacePath}
                  onChange={(event) => setWorkspacePath(event.target.value)}
                  className="border-cyber-border bg-cyber-black text-cyber-white"
                  placeholder="/home/workflows"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-cyber-white">Embedded Workspace URL</Label>
                <div className="flex items-center gap-2 rounded-md border border-cyber-border bg-cyber-black px-3 py-2">
                  <p className="flex-1 truncate font-mono text-xs text-cyber-white">{workspaceUrl || 'Set n8n base URL first'}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                    onClick={() => void copyValue(workspaceUrl, 'Embedded workspace URL')}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-cyber-border bg-cyber-black/60 p-3">
              <p className="text-xs text-cyber-white">Official n8n Sources</p>
              <div className="flex flex-wrap gap-2">
                {N8N_OFFICIAL_LINKS.map((link) => (
                  <Button
                    key={link.url}
                    variant="outline"
                    className="border-cyber-border text-cyber-gray hover:text-cyber-white"
                    onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    {link.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded border border-cyber-border bg-cyber-dark/40 p-2 text-xs text-cyber-gray">
                <input
                  type="checkbox"
                  checked={syncRemoteToLocal}
                  onChange={(event) => setSyncRemoteToLocal(event.target.checked)}
                  className="h-4 w-4 rounded border-cyber-border bg-cyber-black"
                />
                Add remote n8n workflows into local catalog during sync
              </label>
              <label className="flex items-center gap-2 rounded border border-cyber-border bg-cyber-dark/40 p-2 text-xs text-cyber-gray">
                <input
                  type="checkbox"
                  checked={activateRemoteImports}
                  onChange={(event) => setActivateRemoteImports(event.target.checked)}
                  className="h-4 w-4 rounded border-cyber-border bg-cyber-black"
                />
                Auto-activate workflows when importing via agent bridge
              </label>
            </div>

            {showEmbeddedWorkspace && (
              <div className="space-y-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-cyan-100">Embedded n8n Workspace (official UI)</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 border border-cyan-500/40 text-cyan-300 hover:text-cyan-100"
                    onClick={() => {
                      if (workspaceUrl) window.open(workspaceUrl, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Open Full Tab
                  </Button>
                </div>
                {workspaceUrl ? (
                  <iframe
                    title="Embedded n8n Workspace"
                    src={workspaceUrl}
                    className="h-[560px] w-full rounded-md border border-cyber-border bg-black"
                    loading="lazy"
                  />
                ) : (
                  <p className="text-xs text-yellow-300">Set n8n base URL before embedding the workspace.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyber-border bg-cyber-card xl:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyber-white">
              <TerminalSquare className="h-4 w-4 text-cyan-300" />
              Agent Access (MCP + SSH)
            </CardTitle>
            <CardDescription>Ready-to-use access values your agents can consume by API, MCP, or SSH runbooks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input
                value={sshHost}
                onChange={(event) => setSshHost(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="host"
              />
              <Input
                value={sshUser}
                onChange={(event) => setSshUser(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="user"
              />
              <Input
                value={sshPort}
                onChange={(event) => setSshPort(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="22"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-cyber-border bg-cyber-black/60 p-3">
              <p className="text-[11px] text-cyber-gray">n8n MCP Endpoint</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 truncate font-mono text-xs text-cyber-white">{n8nMcpEndpoint || 'Not set'}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                  onClick={() => void copyValue(n8nMcpEndpoint, 'MCP endpoint')}
                >
                  <Link2 className="mr-1 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-cyber-border bg-cyber-black/60 p-3">
              <p className="text-[11px] text-cyber-gray">SSH Connect Command</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 truncate font-mono text-xs text-cyber-white">{sshConnectCommand || 'Not set'}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                  onClick={() => void copyValue(sshConnectCommand, 'SSH command')}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-cyber-border bg-cyber-black/60 p-3">
              <p className="text-[11px] text-cyber-gray">Runbook Health Check</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 truncate font-mono text-xs text-cyber-white">{runbookCommand || 'Not set'}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                  onClick={() => void copyValue(runbookCommand, 'Runbook command')}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
              <p className="text-xs text-cyan-100">Remote Command Console (Agent + SSH + PowerShell/Bash)</p>

              <div className="grid grid-cols-1 gap-2">
                <Label className="text-[11px] text-cyber-gray">Automation Agent</Label>
                <select
                  value={automationAgentId}
                  onChange={(event) => setAutomationAgentId(event.target.value)}
                  className="w-full rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
                >
                  <option value="">Select agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} {agent.api_key ? '' : '(api key will be generated)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label className="text-[11px] text-cyber-gray">Runner Endpoint (optional, for real execution)</Label>
                <Input
                  value={runnerUrl}
                  onChange={(event) => setRunnerUrl(event.target.value)}
                  className="border-cyber-border bg-cyber-black text-cyber-white"
                  placeholder="https://your-vps-runner.example.com/execute"
                />
                <Input
                  type="password"
                  value={runnerToken}
                  onChange={(event) => setRunnerToken(event.target.value)}
                  className="border-cyber-border bg-cyber-black text-cyber-white"
                  placeholder="Runner token (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-cyber-gray">Command Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {commandPresets.map((preset) => (
                    <Button
                      key={preset.label}
                      size="sm"
                      variant="outline"
                      className="border-cyber-border text-cyber-gray hover:text-cyber-white"
                      onClick={() => applyCommandPreset(preset.command)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[11px] text-cyber-gray">Shell Mode</Label>
                  <select
                    value={consoleShell}
                    onChange={(event) => setConsoleShell(event.target.value === 'powershell' ? 'powershell' : 'bash')}
                    className="rounded-md border border-cyber-border bg-cyber-black px-2 py-1 text-xs text-cyber-white"
                  >
                    <option value="bash">bash</option>
                    <option value="powershell">powershell</option>
                  </select>
                </div>
                <textarea
                  value={consoleCommand}
                  onChange={(event) => setConsoleCommand(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-md border border-cyber-border bg-cyber-black px-3 py-2 font-mono text-xs text-cyber-white"
                  placeholder="Enter remote command..."
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void executeConsoleCommand()}
                    disabled={isConsoleRunning}
                    className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
                  >
                    <TerminalSquare className="mr-2 h-4 w-4" />
                    {isConsoleRunning ? 'Running...' : 'Run Command'}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-cyber-border text-cyber-gray hover:text-cyber-white"
                    onClick={() => void copyValue(consoleCommand, 'Console command')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Command
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-cyber-gray">Console Output</Label>
                <pre className="max-h-56 overflow-auto rounded-md border border-cyber-border bg-cyber-black p-3 text-[11px] text-cyber-gray">
                  {consoleOutput || 'No output yet. Run a command to see results.'}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-cyber-border bg-cyber-card">
        <CardHeader>
          <CardTitle className="text-cyber-white">Remote n8n Catalog</CardTitle>
          <CardDescription>Latest sync from n8n API (closer to native n8n workflow list).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-cyan-500/20 text-cyan-200">Remote: {remoteWorkflows.length}</Badge>
            <Badge className="bg-cyber-green/20 text-cyber-green">Local: {workflows.length}</Badge>
            {remoteWarnings.length > 0 && <Badge className="bg-yellow-500/20 text-yellow-300">Warnings: {remoteWarnings.length}</Badge>}
          </div>

          {remoteWorkflows.length > 0 ? (
            <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-cyber-border bg-cyber-black p-2">
              {remoteWorkflows.map((workflow) => {
                const workflowMcpEndpoint =
                  n8nMcpEndpoint && workflow.id
                    ? `${sanitizeBaseUrl(n8nMcpEndpoint)}?workflowId=${encodeURIComponent(workflow.id)}`
                    : ''

                return (
                  <div
                    key={`${workflow.id}-${workflow.name}`}
                    className="rounded-md border border-cyber-border/60 bg-cyber-dark/70 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-cyber-white">
                        {workflow.name} {workflow.id ? <span className="text-cyber-gray">#{workflow.id}</span> : ''}
                      </p>
                      <Badge className={workflow.active ? 'bg-cyber-green/20 text-cyber-green' : 'bg-cyber-gray/20 text-cyber-gray'}>
                        {workflow.active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-cyber-gray">
                      {workflow.webhookPaths.length > 0 ? workflow.webhookPaths.join(', ') : 'No webhook path detected'}
                    </p>
                    {workflow.updatedAt && <p className="mt-1 text-[10px] text-cyber-gray">Updated {new Date(workflow.updatedAt).toLocaleString()}</p>}

                    {workflowMcpEndpoint && (
                      <div className="mt-2 flex items-center gap-2 rounded-md border border-cyber-border/60 bg-cyber-black/50 px-2 py-1.5">
                        <p className="flex-1 truncate font-mono text-[10px] text-cyan-200">{workflowMcpEndpoint}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 border border-cyber-border px-2 text-[10px] text-cyber-gray hover:text-cyber-white"
                          onClick={() => void copyValue(workflowMcpEndpoint, 'Workflow MCP endpoint')}
                        >
                          Copy MCP
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-cyber-border bg-cyber-dark/40 p-4 text-center text-sm text-cyber-gray">
              No remote workflows loaded yet. Run <span className="font-mono">Sync n8n</span>.
            </div>
          )}

          {remoteWarnings.length > 0 && (
            <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
              {remoteWarnings.map((warning, index) => (
                <div key={`${warning}-${index}`} className="flex items-start gap-2 text-xs text-yellow-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="border-cyber-border bg-cyber-card transition-colors hover:border-pink-500/50">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="truncate pr-2 text-base text-cyber-white" title={workflow.name}>
                  {workflow.name}
                </CardTitle>
                <button onClick={() => void handleToggleActive(workflow)}>
                  <Badge
                    variant={workflow.is_active ? 'default' : 'secondary'}
                    className={
                      workflow.is_active
                        ? 'bg-cyber-green/20 text-cyber-green'
                        : 'bg-cyber-gray/20 text-cyber-gray'
                    }
                  >
                    {workflow.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </button>
              </div>
              <CardDescription className="min-h-[2.5em] line-clamp-2 text-xs text-cyber-gray">
                {workflow.description || 'No description provided'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded border border-cyber-border/50 bg-cyber-dark/50 p-2 font-mono text-xs text-cyber-gray break-all">
                  <Webhook className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{workflow.trigger_url}</span>
                </div>

                <div className="text-[10px] text-cyber-gray">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created {new Date(workflow.created_at).toLocaleDateString()}
                  </div>
                  {workflow.last_run_at && (
                    <div className="mt-1 flex items-center gap-1">
                      {workflow.last_status === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 text-cyber-green" />
                      ) : workflow.last_status === 'failure' ? (
                        <XCircle className="h-3 w-3 text-red-400" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      Last run {new Date(workflow.last_run_at).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-cyber-green font-medium text-cyber-black hover:bg-cyber-green/80"
                      onClick={() => void handleTrigger(workflow)}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                      onClick={() => void handleDelete(workflow.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {workflows.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-cyber-border bg-cyber-card/50 py-12 text-center text-cyber-gray">
            <Webhook className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <h3 className="text-lg font-medium text-cyber-white">No workflows configured</h3>
            <p className="mx-auto mt-1 max-w-sm">
              Add one manually or use bulk import for n8n exports and webhook lists.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button onClick={() => setShowAddModal(true)} variant="link" className="text-pink-500">
                Create first workflow
              </Button>
              <Button onClick={() => setShowBulkModal(true)} variant="link" className="text-cyan-400">
                Bulk import
              </Button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-cyber-border bg-cyber-dark">
            <CardHeader>
              <CardTitle className="text-cyber-white">Connect n8n Workflow</CardTitle>
              <CardDescription>Add a single webhook trigger URL.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-cyber-white">
                    Workflow Name
                  </Label>
                  <Input
                    id="name"
                    value={newWorkflow.name}
                    onChange={(event) => setNewWorkflow({ ...newWorkflow, name: event.target.value })}
                    className="border-cyber-border bg-cyber-black text-cyber-white"
                    placeholder="e.g. Daily SEO Report"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url" className="text-cyber-white">
                    Webhook URL
                  </Label>
                  <Input
                    id="url"
                    value={newWorkflow.trigger_url}
                    onChange={(event) => setNewWorkflow({ ...newWorkflow, trigger_url: event.target.value })}
                    className="border-cyber-border bg-cyber-black font-mono text-xs text-cyber-white"
                    placeholder="https://n8n.your-domain.com/webhook/..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc" className="text-cyber-white">
                    Description
                  </Label>
                  <Input
                    id="desc"
                    value={newWorkflow.description}
                    onChange={(event) => setNewWorkflow({ ...newWorkflow, description: event.target.value })}
                    className="border-cyber-border bg-cyber-black text-cyber-white"
                    placeholder="What does this automation do?"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddModal(false)}
                    className="text-cyber-gray hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-pink-600 text-white hover:bg-pink-700">
                    {isSubmitting ? 'Saving...' : 'Add Workflow'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-5xl border-cyber-border bg-cyber-dark">
            <CardHeader>
              <CardTitle className="text-cyber-white">Bulk Import n8n Workflows</CardTitle>
              <CardDescription>
                Paste n8n export JSON, JSON array, or CSV lines (`name,url,description`). Preview before insert.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bulk-base" className="text-cyber-white">
                    Optional n8n Base URL
                  </Label>
                  <Input
                    id="bulk-base"
                    value={bulkBaseUrl}
                    onChange={(event) => setBulkBaseUrl(event.target.value)}
                    className="border-cyber-border bg-cyber-black text-cyber-white"
                    placeholder="https://n8n.your-domain.com"
                  />
                  <p className="text-[11px] text-cyber-gray">
                    Needed when importing n8n exports that only include webhook paths.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-cyber-white">Example Formats</Label>
                  <pre className="h-[124px] overflow-auto rounded-lg border border-cyber-border bg-cyber-black p-3 text-[10px] text-cyber-gray">
                    {SAMPLE_BULK_INPUT}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-cyber-border text-cyber-gray hover:text-cyber-white"
                    onClick={() => void copyValue(SAMPLE_BULK_INPUT, 'Sample payload')}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy Sample
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-input" className="text-cyber-white">
                  Bulk Data
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-cyber-border px-3 py-1.5 text-xs text-cyber-gray hover:text-cyber-white">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Load File (.json/.csv/.txt)
                    <input
                      type="file"
                      accept=".json,.csv,.txt,application/json,text/csv,text/plain"
                      className="hidden"
                      onChange={handleBulkFileUpload}
                    />
                  </label>
                  {bulkFileName && (
                    <span className="text-[11px] text-cyber-gray">Loaded: {bulkFileName}</span>
                  )}
                </div>
                <textarea
                  id="bulk-input"
                  value={bulkInput}
                  onChange={(event) => setBulkInput(event.target.value)}
                  rows={10}
                  className="w-full resize-none rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 font-mono text-xs text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  placeholder="Paste n8n JSON export or CSV lines here..."
                />
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg border border-cyber-border bg-cyber-black/50 p-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-cyber-white">Automation Agent (for n8n push)</Label>
                  <select
                    value={automationAgentId}
                    onChange={(event) => setAutomationAgentId(event.target.value)}
                    className="w-full rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
                  >
                    <option value="">Select agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} {agent.api_key ? '' : '(api key will be generated)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-cyber-white">Remote Import Options</Label>
                  <label className="flex items-center gap-2 text-xs text-cyber-gray">
                    <input
                      type="checkbox"
                      checked={activateRemoteImports}
                      onChange={(event) => setActivateRemoteImports(event.target.checked)}
                      className="h-4 w-4 rounded border-cyber-border bg-cyber-black"
                    />
                    Activate on import in n8n
                  </label>
                  <p className="text-[11px] text-cyber-gray">
                    Uses <span className="font-mono">agent-automation-bridge</span> so agents can import/export workflows consistently.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={parseBulkPayload}
                  disabled={isParsingBulk}
                  variant="outline"
                  className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isParsingBulk ? 'animate-spin' : ''}`} />
                  {isParsingBulk ? 'Parsing...' : 'Preview Import'}
                </Button>
                <Button
                  onClick={() => void importBulkWorkflows()}
                  disabled={isImportingBulk || bulkPreview.length === 0}
                  className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isImportingBulk ? 'Importing...' : `Import ${bulkPreview.length} Workflows`}
                </Button>
                <Button
                  onClick={() => void pushBulkPreviewToN8n()}
                  disabled={isPushingBulkToN8n || bulkPreview.length === 0}
                  className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
                >
                  <Server className="mr-2 h-4 w-4" />
                  {isPushingBulkToN8n ? 'Pushing To n8n...' : `Push ${bulkPreview.length} To n8n`}
                </Button>
                <Button variant="ghost" onClick={resetBulkImport} className="text-cyber-gray hover:text-white">
                  Cancel
                </Button>
              </div>

              {(bulkPreview.length > 0 || bulkWarnings.length > 0) && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-cyber-white">Ready To Import ({bulkPreview.length})</p>
                    <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-cyber-border bg-cyber-black p-2">
                      {bulkPreview.map((entry, index) => (
                        <div key={`${entry.trigger_url}-${index}`} className="rounded border border-cyber-border/60 bg-cyber-dark p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-medium text-cyber-white">{entry.name}</p>
                            <Badge className="bg-cyber-green/20 text-[10px] text-cyber-green">{entry.source}</Badge>
                          </div>
                          <p className="mt-1 truncate font-mono text-[10px] text-cyber-gray">{entry.trigger_url}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-cyber-white">Skipped / Warnings ({bulkWarnings.length})</p>
                    <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2">
                      {bulkWarnings.length === 0 && (
                        <div className="flex items-center gap-2 text-xs text-cyber-green">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          No warnings.
                        </div>
                      )}
                      {bulkWarnings.map((warning, index) => (
                        <div key={`${warning}-${index}`} className="flex items-start gap-2 text-xs text-yellow-300">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
