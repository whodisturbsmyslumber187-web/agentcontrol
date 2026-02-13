import { useMemo, useState, useEffect, type ChangeEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useToast } from '../components/ui/use-toast'
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

interface WorkflowImportDraft {
  name: string
  description: string
  trigger_url: string
  is_active: boolean
  source: 'json' | 'n8n-export' | 'line'
}

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

function sanitizeBaseUrl(input: string) {
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

function normalizeUrl(raw: string, baseUrl: string) {
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

export default function Workflows() {
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [newWorkflow, setNewWorkflow] = useState({ name: '', description: '', trigger_url: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [bulkInput, setBulkInput] = useState('')
  const [bulkBaseUrl, setBulkBaseUrl] = useState('')
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkPreview, setBulkPreview] = useState<WorkflowImportDraft[]>([])
  const [bulkWarnings, setBulkWarnings] = useState<string[]>([])
  const [isParsingBulk, setIsParsingBulk] = useState(false)
  const [isImportingBulk, setIsImportingBulk] = useState(false)

  useEffect(() => {
    void fetchWorkflows()
  }, [])

  const existingTriggerSet = useMemo(
    () => new Set(workflows.map((workflow) => workflow.trigger_url.trim().toLowerCase())),
    [workflows],
  )

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
      const normalizedBaseUrl = sanitizeBaseUrl(bulkBaseUrl)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold text-cyber-white">
            <Webhook className="h-7 w-7 animate-pulse text-pink-500" />
            n8n Workflows
          </h2>
          <p className="text-sm text-cyber-gray">Manage automation pipelines and bulk-import n8n webhooks.</p>
        </div>
        <div className="flex gap-2">
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
                    onClick={() => void navigator.clipboard.writeText(SAMPLE_BULK_INPUT)}
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
