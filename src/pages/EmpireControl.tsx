
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { useToast } from '../components/ui/use-toast'
import { useAgentStore, type Agent } from '../stores/agent-store'
import { useBusinessStore } from '../stores/business-store'
import { useOpenClawStore } from '../stores/openclaw-store'
import { insforge } from '../lib/insforge'
import { invokeAgentSelfRegister } from '../lib/agent-self-register'
import { invokeAgentCreateN8nWorkflow, invokeAgentLiveKitSession } from '../lib/agent-automation'
import { DEFAULT_AGENT_SKILLS, DEFAULT_MCP_TOOLING } from '../lib/agent-defaults'
import { DEFAULT_MCP_SERVERS } from '../lib/mcp-registry'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  Key,
  Pause,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
  Webhook,
  Briefcase,
  Mic,
  Server,
} from 'lucide-react'

interface Assignment {
  id: string
  agent_id: string
  business_id: string
  role: string
  instructions: string
  priority: 'high' | 'medium' | 'low'
  status: 'active' | 'paused' | 'completed'
  created_at: string
}

interface Workflow {
  id: string
  name: string
  description: string
  trigger_url: string
  is_active: boolean
  last_run_at?: string
  last_status?: 'success' | 'failure'
}

interface ActivityEntry {
  id: string
  agent_name: string
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
  created_at: string
}

interface LaunchFormState {
  name: string
  role: string
  emoji: string
  model: string
  mission: string
  businessId: string
  workflowId: string
  priority: 'high' | 'medium' | 'low'
}

interface LaunchTemplate {
  id: string
  label: string
  role: string
  emoji: string
  model: string
  mission: string
  priority: 'high' | 'medium' | 'low'
}

const INSFORGE_BASE_URL =
  import.meta.env.VITE_INSFORGE_BASE_URL || 'https://ijeed7kh.us-west.insforge.app'
const SELF_REGISTER_SLUG = 'agent-self-register'
const SELF_REGISTER_ENDPOINT = `${INSFORGE_BASE_URL}/functions/${SELF_REGISTER_SLUG}`
const AGENT_AUTOMATION_SLUG = 'agent-automation-bridge'
const AGENT_AUTOMATION_ENDPOINT = `${INSFORGE_BASE_URL}/functions/${AGENT_AUTOMATION_SLUG}`

const MODEL_OPTIONS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3.5-sonnet',
  'claude-3-opus',
  'gemini-2.0-flash',
  'deepseek-r1',
  'grok-3',
]

const INITIAL_LAUNCH_FORM: LaunchFormState = {
  name: '',
  role: '',
  emoji: '🤖',
  model: 'gpt-4o-mini',
  mission: '',
  businessId: '',
  workflowId: '',
  priority: 'high',
}

const LAUNCH_TEMPLATES: LaunchTemplate[] = [
  {
    id: 'growth',
    label: 'Growth Hunter',
    role: 'Growth Operator',
    emoji: '📈',
    model: 'gpt-4o-mini',
    mission: 'Generate qualified leads daily and report conversion blockers.',
    priority: 'high',
  },
  {
    id: 'support',
    label: 'Support Shield',
    role: 'Support Commander',
    emoji: '🛡️',
    model: 'claude-3.5-sonnet',
    mission: 'Resolve customer issues, reduce response latency, escalate only high-risk tickets.',
    priority: 'medium',
  },
  {
    id: 'ops',
    label: 'Ops Auditor',
    role: 'Operations Analyst',
    emoji: '🧭',
    model: 'gpt-4o',
    mission: 'Audit pipeline health, surface bottlenecks, and recommend remediations.',
    priority: 'high',
  },
  {
    id: 'outreach',
    label: 'Outreach Scout',
    role: 'Outreach Specialist',
    emoji: '📨',
    model: 'gemini-2.0-flash',
    mission: 'Run outbound sequences and generate daily outreach performance digest.',
    priority: 'medium',
  },
]

function generateClientAgentKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export default function EmpireControl() {
  const { agents, fetchAgents, addAgent, updateAgent } = useAgentStore()
  const { businesses, fetchBusinesses } = useBusinessStore()
  const { sessions, fetchSessions, addSession } = useOpenClawStore()
  const { toast } = useToast()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [controlError, setControlError] = useState<string | null>(null)
  const [loadingControlData, setLoadingControlData] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [selfRegisterSecret, setSelfRegisterSecret] = useState('')
  const [testingSelfRegister, setTestingSelfRegister] = useState(false)
  const [automationSecret, setAutomationSecret] = useState('')
  const [automationAgentId, setAutomationAgentId] = useState('')
  const [automationBusy, setAutomationBusy] = useState(false)
  const [n8nBaseUrl, setN8nBaseUrl] = useState('')
  const [n8nApiKey, setN8nApiKey] = useState('')
  const [automationWorkflowName, setAutomationWorkflowName] = useState('Agent Generated Flow')
  const [automationWorkflowDescription, setAutomationWorkflowDescription] = useState('')
  const [automationTriggerUrl, setAutomationTriggerUrl] = useState('')
  const [automationRoomName, setAutomationRoomName] = useState('agent-voice-room')
  const [lastAutomationWorkflow, setLastAutomationWorkflow] = useState<{
    name: string
    triggerUrl: string
    n8nWorkflowId?: string | null
    warning?: string | null
  } | null>(null)
  const [lastLiveKitSession, setLastLiveKitSession] = useState<{
    roomName: string
    participantName: string
    url: string
    token: string
  } | null>(null)

  const [launchForm, setLaunchForm] = useState<LaunchFormState>(INITIAL_LAUNCH_FORM)
  const [bulkLaunchPrefix, setBulkLaunchPrefix] = useState('Swarm')
  const [bulkLaunchCount, setBulkLaunchCount] = useState(3)

  const loadControlData = async () => {
    setRefreshing(true)
    setControlError(null)
    try {
      const [assignmentsRes, workflowsRes, activityRes] = await Promise.all([
        insforge.database.from('agent_assignments').select().order('created_at', { ascending: false }).limit(200),
        insforge.database.from('agent_workflows').select().order('created_at', { ascending: false }).limit(200),
        insforge.database.from('activity_log').select().order('created_at', { ascending: false }).limit(80),
      ])

      if (assignmentsRes.error || workflowsRes.error || activityRes.error) {
        const message =
          assignmentsRes.error?.message ||
          workflowsRes.error?.message ||
          activityRes.error?.message ||
          'Failed to load control-plane data'
        setControlError(message)
      }

      setAssignments(((assignmentsRes.data || []) as Assignment[]).slice(0, 200))
      setWorkflows((workflowsRes.data || []) as Workflow[])
      setActivity((activityRes.data || []) as ActivityEntry[])
    } catch (err: any) {
      setControlError(err.message || 'Failed to load control-plane data')
    } finally {
      setLoadingControlData(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      await Promise.all([fetchAgents(), fetchBusinesses(), fetchSessions(), loadControlData()])
    }
    void bootstrap()
  }, [])

  useEffect(() => {
    const storedN8nBaseUrl = localStorage.getItem('agentforge-n8n-base-url') || ''
    const storedN8nApiKey = localStorage.getItem('agentforge-n8n-api-key') || ''
    setN8nBaseUrl(storedN8nBaseUrl)
    setN8nApiKey(storedN8nApiKey)
  }, [])

  useEffect(() => {
    if (!automationAgentId && agents.length > 0) {
      setAutomationAgentId(agents[0].id)
    }
  }, [automationAgentId, agents])

  const activeAgents = useMemo(() => agents.filter((agent) => agent.status === 'active').length, [agents])
  const activeAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'active').length,
    [assignments]
  )
  const activeWorkflows = useMemo(() => workflows.filter((workflow) => workflow.is_active).length, [workflows])
  const activityLast24h = useMemo(
    () => activity.filter((entry) => Date.now() - new Date(entry.created_at).getTime() < 86_400_000).length,
    [activity]
  )

  const topAgents = useMemo(
    () =>
      [...agents]
        .sort((a, b) => (b.completedTasks || b.completed_tasks || 0) - (a.completedTasks || a.completed_tasks || 0))
        .slice(0, 5),
    [agents]
  )

  const staleAgents = useMemo(
    () =>
      agents.filter((agent) => {
        const lastActive = agent.lastActive || agent.last_active
        if (!lastActive) return true
        return Date.now() - new Date(lastActive).getTime() > 6 * 60 * 60 * 1000
      }),
    [agents]
  )

  const failedWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.last_status === 'failure'),
    [workflows]
  )

  const priorityAlerts = useMemo(() => {
    const alerts: string[] = []
    if (failedWorkflows.length > 0) alerts.push(`${failedWorkflows.length} workflows failed on last run`)
    if (staleAgents.length > 0) alerts.push(`${staleAgents.length} agents stale >6h`)
    if (activeAssignments === 0) alerts.push('No active assignments detected')
    if (alerts.length === 0) alerts.push('All systems nominal')
    return alerts
  }, [failedWorkflows.length, staleAgents.length, activeAssignments])

  const deploymentSummary = useMemo(() => {
    const completed = assignments.filter((assignment) => assignment.status === 'completed').length
    const paused = assignments.filter((assignment) => assignment.status === 'paused').length
    const successRate = assignments.length ? Math.round((completed / assignments.length) * 100) : 0
    return { completed, paused, successRate }
  }, [assignments])

  const getAgentName = (id: string) => agents.find((agent) => agent.id === id)?.name || 'Unknown Agent'
  const getBusinessName = (id: string) => businesses.find((business) => business.id === id)?.name || 'Unknown Business'

  const writeActivity = async (payload: {
    agentId?: string
    agentName: string
    message: string
    type: 'success' | 'info' | 'warning' | 'error'
  }) => {
    await insforge.database.from('activity_log').insert({
      agent_id: payload.agentId || null,
      agent_name: payload.agentName,
      message: payload.message,
      type: payload.type,
    })
  }

  const resetLaunchForm = () => {
    setLaunchForm(INITIAL_LAUNCH_FORM)
  }

  const applyLaunchTemplate = (template: LaunchTemplate) => {
    setLaunchForm((current) => ({
      ...current,
      role: template.role,
      emoji: template.emoji,
      model: template.model,
      mission: template.mission,
      priority: template.priority,
    }))
  }

  const deploySingleAgent = async (payload: LaunchFormState) => {
    const createdAgent = await addAgent({
      name: payload.name.trim(),
      role: payload.role.trim(),
      emoji: payload.emoji || '🤖',
      description: payload.mission.trim(),
      model: payload.model,
      status: 'active',
      config: {
        source: 'empire-control',
        mission: payload.mission.trim(),
        workflowId: payload.workflowId || null,
        businessId: payload.businessId || null,
        deployedAt: new Date().toISOString(),
      },
    })

    if (!createdAgent) {
      throw new Error('Agent creation failed')
    }

    await addSession({ agent_id: createdAgent.id, tokens: 0 })

    if (payload.businessId) {
      const assignmentResult = await insforge.database.from('agent_assignments').insert({
        agent_id: createdAgent.id,
        business_id: payload.businessId,
        role: payload.role.trim(),
        instructions: payload.mission.trim() || 'Execute core operator directive',
        priority: payload.priority,
        status: 'active',
      })
      if (assignmentResult.error) {
        throw new Error(`Assignment failed: ${assignmentResult.error.message}`)
      }
    }

    const selectedWorkflow = workflows.find((workflow) => workflow.id === payload.workflowId)
    if (selectedWorkflow?.trigger_url) {
      try {
        const response = await fetch(selectedWorkflow.trigger_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'agentforge-empire-control',
            agentId: createdAgent.id,
            agentName: createdAgent.name,
            mission: payload.mission,
            businessId: payload.businessId || null,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        await insforge.database
          .from('agent_workflows')
          .update({ last_run_at: new Date().toISOString(), last_status: 'success' })
          .eq('id', selectedWorkflow.id)
      } catch (workflowError) {
        await insforge.database
          .from('agent_workflows')
          .update({ last_run_at: new Date().toISOString(), last_status: 'failure' })
          .eq('id', selectedWorkflow.id)

        await writeActivity({
          agentId: createdAgent.id,
          agentName: createdAgent.name,
          message: `workflow trigger failed for "${selectedWorkflow.name}"`,
          type: 'warning',
        })

        console.error('Workflow trigger failed:', workflowError)
      }
    }

    await writeActivity({
      agentId: createdAgent.id,
      agentName: createdAgent.name,
      message: `deployed from Empire Control with role "${createdAgent.role}"`,
      type: 'success',
    })

    return createdAgent
  }

  const handleLaunch = async () => {
    if (!launchForm.name.trim() || !launchForm.role.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Agent name and role are required before deployment.',
        variant: 'destructive',
      })
      return
    }

    setDeploying(true)
    try {
      const createdAgent = await deploySingleAgent(launchForm)
      resetLaunchForm()
      await Promise.all([fetchAgents(), fetchSessions(), fetchBusinesses(), loadControlData()])
      toast({
        title: 'Agent deployed',
        description: `${createdAgent.name} is live and reporting.`,
      })
    } catch (err: any) {
      toast({
        title: 'Deployment failed',
        description: err.message || 'Unable to launch agent.',
        variant: 'destructive',
      })
    } finally {
      setDeploying(false)
    }
  }

  const handleBulkLaunch = async () => {
    if (!bulkLaunchPrefix.trim() || !launchForm.role.trim()) {
      toast({
        title: 'Missing bulk deploy fields',
        description: 'Swarm prefix and role are required for bulk deploy.',
        variant: 'destructive',
      })
      return
    }

    const count = Math.min(Math.max(bulkLaunchCount, 1), 20)
    setDeploying(true)
    try {
      let successCount = 0
      const failed: string[] = []

      for (let index = 0; index < count; index += 1) {
        const generatedName = `${bulkLaunchPrefix.trim()}-${String(index + 1).padStart(2, '0')}`
        const payload: LaunchFormState = {
          ...launchForm,
          name: generatedName,
        }

        try {
          await deploySingleAgent(payload)
          successCount += 1
        } catch (err: any) {
          failed.push(`${generatedName}: ${err.message || 'deploy failed'}`)
        }
      }

      await Promise.all([fetchAgents(), fetchSessions(), fetchBusinesses(), loadControlData()])

      if (failed.length > 0) {
        toast({
          title: `Swarm deploy partial: ${successCount}/${count}`,
          description: failed.slice(0, 2).join(' | '),
          variant: 'destructive',
        })
      } else {
        toast({
          title: `Swarm deploy complete`,
          description: `${successCount} agents launched from ${bulkLaunchPrefix.trim()}.`,
        })
      }
    } finally {
      setDeploying(false)
    }
  }

  const handleAssignmentStatus = async (assignment: Assignment, status: Assignment['status']) => {
    const result = await insforge.database.from('agent_assignments').update({ status }).eq('id', assignment.id)
    if (result.error) {
      toast({
        title: 'Update failed',
        description: result.error.message,
        variant: 'destructive',
      })
      return
    }

    setAssignments((current) => current.map((entry) => (entry.id === assignment.id ? { ...entry, status } : entry)))
    await writeActivity({
      agentId: assignment.agent_id,
      agentName: getAgentName(assignment.agent_id),
      message: `assignment status changed to ${status}`,
      type: status === 'completed' ? 'success' : 'info',
    })
  }

  const downloadSnapshot = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      overview: {
        totalAgents: agents.length,
        activeAgents,
        activeAssignments,
        activeWorkflows,
        activeSessions: sessions.filter((session) => session.active).length,
      },
      topAgents: topAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        completedTasks: agent.completedTasks || agent.completed_tasks || 0,
        tokenUsage: agent.tokenUsage || agent.token_usage || 0,
      })),
      assignments,
      businesses: businesses.map((business) => ({
        id: business.id,
        name: business.name,
        status: business.status,
        revenue: business.revenue,
        profit: business.profit,
        pendingTasks: business.pendingTasks || business.pending_tasks || 0,
      })),
      recentActivity: activity,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `empire-snapshot-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadDeploymentCsv = () => {
    const headers = 'created_at,agent_name,business,role,status,priority,instructions'
    const rows = assignments.map((assignment) => {
      const values = [
        assignment.created_at,
        getAgentName(assignment.agent_id),
        getBusinessName(assignment.business_id),
        assignment.role,
        assignment.status,
        assignment.priority,
        (assignment.instructions || '').replace(/"/g, '""'),
      ]
      return values.map((value) => `"${value}"`).join(',')
    })

    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `deployment-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: 'Copied', description: successMessage })
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard access failed.', variant: 'destructive' })
    }
  }

  const getSelfRegisterCurl = () => {
    const secretHeader = selfRegisterSecret.trim()
      ? `  -H "X-Agent-Register-Secret: ${selfRegisterSecret.trim()}" \\\n`
      : ''

    return `curl -X POST "${SELF_REGISTER_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "name": "OC-Scout-01",
    "role": "External Growth Agent",
    "source": "openclaw",
    "external_id": "oc-agent-001",
    "description": "Autonomous operator reporting into Empire Control",
    "start_session": true,
    "capabilities": ["lead-gen", "reporting"],
    "business_id": "<business-id-optional>",
    "priority": "high"
  }'`
  }

  const getSelfRegisterSdkSnippet = () => {
    const secretHeader = selfRegisterSecret.trim()
      ? `{ 'X-Agent-Register-Secret': '${selfRegisterSecret.trim()}' }`
      : '{}'

    return `import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: '${INSFORGE_BASE_URL}',
  anonKey: process.env.INSFORGE_ANON_KEY || ''
})

const { data, error } = await insforge.functions.invoke('${SELF_REGISTER_SLUG}', {
  body: {
    name: 'OC-Scout-01',
    role: 'External Growth Agent',
    source: 'openclaw',
    external_id: 'oc-agent-001',
    start_session: true,
    priority: 'high'
  },
  headers: ${secretHeader}
})

if (error) throw error
console.log('Registered agent:', data.agent.id, data.agent.apiKey)`
  }

  const runSelfRegisterSmokeTest = async () => {
    setTestingSelfRegister(true)
    const probeId = Date.now().toString().slice(-6)
    try {
      const response = await invokeAgentSelfRegister(
        {
          name: `SelfReg-Probe-${probeId}`,
          role: 'External Probe Agent',
          source: 'empire-control-smoke',
          externalId: `smoke-${probeId}`,
          description: 'Connectivity probe from Empire Control',
          startSession: false,
          status: 'idle',
          metadata: {
            generatedBy: 'empire-control',
            generatedAt: new Date().toISOString(),
          },
        },
        selfRegisterSecret.trim() || undefined,
      )

      toast({
        title: 'Self-register endpoint is live',
        description: `${response.agent.name} ${response.created ? 'created' : 'matched'} successfully.`,
      })
      await Promise.all([fetchAgents(), loadControlData()])
    } catch (err: any) {
      toast({
        title: 'Self-register test failed',
        description: err.message || 'Unable to reach agent-self-register function.',
        variant: 'destructive',
      })
    } finally {
      setTestingSelfRegister(false)
    }
  }

  const saveAutomationSettings = () => {
    localStorage.setItem('agentforge-n8n-base-url', n8nBaseUrl.trim())
    localStorage.setItem('agentforge-n8n-api-key', n8nApiKey.trim())
    toast({
      title: 'Automation settings saved',
      description: 'n8n connection values are stored locally in this browser.',
    })
  }

  const getAutomationAgent = () => agents.find((agent) => agent.id === automationAgentId) || null

  const buildAutomationSdkSnippet = () => {
    const selectedAgent = getAutomationAgent()
    const baseUrl = n8nBaseUrl.trim()
    const secretHeader = automationSecret.trim()
      ? `{ 'X-Agent-Automation-Secret': '${automationSecret.trim()}' }`
      : '{}'
    const agentId = selectedAgent?.id || '<agent-id>'
    const agentKey = selectedAgent?.api_key || '<agent-api-key>'
    const triggerUrl = automationTriggerUrl.trim() || `${baseUrl || 'https://n8n.example.com'}/webhook/agent-auto-flow`

    return `import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: '${INSFORGE_BASE_URL}',
  anonKey: process.env.INSFORGE_ANON_KEY || ''
})

const headers = ${secretHeader}

// 1) Ask backend to create/register an n8n workflow for this agent
const { data: workflowData, error: workflowError } = await insforge.functions.invoke('${AGENT_AUTOMATION_SLUG}', {
  headers,
  body: {
    action: 'create_n8n_workflow',
    agentId: '${agentId}',
    agentApiKey: '${agentKey}',
    name: 'Agent Auto Flow',
    description: 'Workflow created by autonomous agent',
    triggerUrl: '${triggerUrl}'
  }
})
if (workflowError) throw workflowError

// 2) Ask backend for LiveKit voice session token
const { data: livekitData, error: livekitError } = await insforge.functions.invoke('${AGENT_AUTOMATION_SLUG}', {
  headers,
  body: {
    action: 'request_livekit_session',
    agentId: '${agentId}',
    agentApiKey: '${agentKey}',
    roomName: 'agent-voice-room'
  }
})
if (livekitError) throw livekitError

// 3) Let agent post progress to collaboration forum
const { data: forumData, error: forumError } = await insforge.functions.invoke('${AGENT_AUTOMATION_SLUG}', {
  headers,
  body: {
    action: 'post_forum_update',
    agentId: '${agentId}',
    agentApiKey: '${agentKey}',
    title: 'Lead routing test update',
    message: 'New n8n + LiveKit loop increased booked calls by 18%.',
    tags: ['livekit', 'n8n', 'sales']
  }
})
if (forumError) throw forumError

// 4) Import SIP numbers in bulk with prompts + routing workflow
const { data: sipData, error: sipError } = await insforge.functions.invoke('${AGENT_AUTOMATION_SLUG}', {
  headers,
  body: {
    action: 'import_sip_numbers',
    agentId: '${agentId}',
    agentApiKey: '${agentKey}',
    numbers: [
      {
        phone_number: '+15550001111',
        provider: 'twilio',
        label: 'Sales Inbound',
        prompt: 'Qualify lead and push to CRM pipeline',
        workflow_name: 'Sales Intake Flow'
      }
    ]
  }
})
if (sipError) throw sipError

// 5) Run Brave web search for live market/provider intelligence
const { data: searchData, error: searchError } = await insforge.functions.invoke('${AGENT_AUTOMATION_SLUG}', {
  headers,
  body: {
    action: 'web_search',
    agentId: '${agentId}',
    agentApiKey: '${agentKey}',
    query: 'best SIP providers for enterprise porting',
    count: 5
  }
})
if (searchError) throw searchError

// 6) Discover latest model + SIP provider updates
const { data: updatesData, error: updatesError } = await insforge.functions.invoke('${AGENT_AUTOMATION_SLUG}', {
  headers,
  body: {
    action: 'discover_provider_updates',
    agentId: '${agentId}',
    agentApiKey: '${agentKey}',
    providers: ['openrouter', 'huggingface', 'gemini', 'sip']
  }
})
if (updatesError) throw updatesError

// 7) Create DAO deployment task (Aragon/Olympus/custom stack)
const { data: daoData, error: daoError } = await insforge.functions.invoke('${AGENT_AUTOMATION_SLUG}', {
  headers,
  body: {
    action: 'create_dao_deployment_task',
    agentId: '${agentId}',
    agentApiKey: '${agentKey}',
    daoName: 'Empire Growth DAO',
    daoProvider: 'aragon',
    chain: 'ethereum',
    tokenSymbol: 'EGD'
  }
})
if (daoError) throw daoError

// 8) Pull Shopify store snapshot (dropshipping control loop)
const { data: shopifyData, error: shopifyError } = await insforge.functions.invoke('${AGENT_AUTOMATION_SLUG}', {
  headers,
  body: {
    action: 'shopify_store_snapshot',
    agentId: '${agentId}',
    agentApiKey: '${agentKey}',
    shopDomain: 'your-store.myshopify.com'
  }
})
if (shopifyError) throw shopifyError

console.log(workflowData, livekitData, forumData, sipData, searchData, updatesData, daoData, shopifyData)`
  }

  const getAutomationCurlSnippet = () => {
    const selectedAgent = getAutomationAgent()
    const agentId = selectedAgent?.id || '<agent-id>'
    const agentKey = selectedAgent?.api_key || '<agent-api-key>'
    const secretHeader = automationSecret.trim()
      ? `  -H "X-Agent-Automation-Secret: ${automationSecret.trim()}" \\\n`
      : ''

    return `curl -X POST "${AGENT_AUTOMATION_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "action": "create_n8n_workflow",
    "agentId": "${agentId}",
    "agentApiKey": "${agentKey}",
    "name": "Agent Auto Flow",
    "description": "Created by autonomous agent"
  }'

curl -X POST "${AGENT_AUTOMATION_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "action": "request_livekit_session",
    "agentId": "${agentId}",
    "agentApiKey": "${agentKey}",
    "roomName": "agent-voice-room"
  }'

curl -X POST "${AGENT_AUTOMATION_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "action": "post_forum_update",
    "agentId": "${agentId}",
    "agentApiKey": "${agentKey}",
    "title": "Funnel update",
    "message": "n8n + LiveKit workflow now booking more calls.",
    "tags": ["livekit", "n8n", "growth"]
  }'

curl -X POST "${AGENT_AUTOMATION_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "action": "import_sip_numbers",
    "agentId": "${agentId}",
    "agentApiKey": "${agentKey}",
    "numbers": [
      {
        "phone_number": "+15550001111",
        "provider": "twilio",
        "label": "Sales Inbound",
        "prompt": "Qualify lead and trigger workflow",
        "workflow_name": "Sales Intake Flow"
      }
    ]
  }'

curl -X POST "${AGENT_AUTOMATION_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "action": "web_search",
    "agentId": "${agentId}",
    "agentApiKey": "${agentKey}",
    "query": "latest SIP providers with fast number porting"
  }'

curl -X POST "${AGENT_AUTOMATION_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "action": "discover_provider_updates",
    "agentId": "${agentId}",
    "agentApiKey": "${agentKey}",
    "providers": ["openrouter", "huggingface", "gemini", "sip"]
  }'

curl -X POST "${AGENT_AUTOMATION_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "action": "create_dao_deployment_task",
    "agentId": "${agentId}",
    "agentApiKey": "${agentKey}",
    "daoName": "Empire Growth DAO",
    "daoProvider": "aragon",
    "chain": "ethereum",
    "tokenSymbol": "EGD"
  }'

curl -X POST "${AGENT_AUTOMATION_ENDPOINT}" \\
  -H "Content-Type: application/json" \\
${secretHeader}  -d '{
    "action": "shopify_store_snapshot",
    "agentId": "${agentId}",
    "agentApiKey": "${agentKey}",
    "shopDomain": "your-store.myshopify.com"
  }'`
  }

  const runAutomationWorkflowSmokeTest = async () => {
    const selectedAgent = getAutomationAgent()
    if (!selectedAgent) {
      toast({
        title: 'Select an agent first',
        description: 'Choose which agent should perform the workflow create call.',
        variant: 'destructive',
      })
      return
    }

    setAutomationBusy(true)
    try {
      const agentApiKey = await ensureAgentKey(selectedAgent)
      const timestamp = Date.now().toString().slice(-6)
      const fallbackTriggerUrl =
        automationTriggerUrl.trim() ||
        (n8nBaseUrl.trim() ? `${n8nBaseUrl.trim().replace(/\/+$/, '')}/webhook/agent-auto-${timestamp}` : '')

      const n8nWorkflowTemplate =
        n8nBaseUrl.trim() && n8nApiKey.trim()
          ? {
              name: `${automationWorkflowName.trim() || 'Agent Auto Flow'} ${timestamp}`,
              nodes: [
                {
                  id: 'Webhook_1',
                  name: 'Webhook',
                  type: 'n8n-nodes-base.webhook',
                  typeVersion: 2,
                  position: [260, 300],
                  parameters: {
                    path: `agent-auto-${timestamp}`,
                    httpMethod: 'POST',
                    responseMode: 'onReceived',
                  },
                },
              ],
              connections: {},
              settings: {},
            }
          : undefined

      const result = await invokeAgentCreateN8nWorkflow(
        {
          agentId: selectedAgent.id,
          agentApiKey,
          automationSecret: automationSecret.trim() || undefined,
        },
        {
          name: automationWorkflowName.trim() || `Agent Auto Flow ${timestamp}`,
          description: automationWorkflowDescription.trim(),
          triggerUrl: fallbackTriggerUrl || undefined,
          isActive: true,
          activate: false,
          n8nBaseUrl: n8nBaseUrl.trim() || undefined,
          n8nApiKey: n8nApiKey.trim() || undefined,
          n8nWorkflow: n8nWorkflowTemplate,
        },
      )

      setLastAutomationWorkflow({
        name: result.workflow.name,
        triggerUrl: result.workflow.trigger_url,
        n8nWorkflowId: result.n8n.workflowId,
        warning: result.n8n.warning,
      })

      toast({
        title: 'Agent workflow create succeeded',
        description: result.n8n.warning
          ? `Saved with warning: ${result.n8n.warning}`
          : `${result.workflow.name} is registered.`,
      })

      await Promise.all([fetchAgents(), loadControlData()])
    } catch (err: any) {
      toast({
        title: 'Agent workflow create failed',
        description: err.message || 'Unable to create workflow via automation bridge.',
        variant: 'destructive',
      })
    } finally {
      setAutomationBusy(false)
    }
  }

  const runLiveKitAutomationSmokeTest = async () => {
    const selectedAgent = getAutomationAgent()
    if (!selectedAgent) {
      toast({
        title: 'Select an agent first',
        description: 'Choose which agent should request LiveKit access.',
        variant: 'destructive',
      })
      return
    }

    setAutomationBusy(true)
    try {
      const agentApiKey = await ensureAgentKey(selectedAgent)
      const roomName =
        `${automationRoomName.trim() || 'agent-voice-room'}-${Date.now().toString().slice(-4)}`

      const result = await invokeAgentLiveKitSession(
        {
          agentId: selectedAgent.id,
          agentApiKey,
          automationSecret: automationSecret.trim() || undefined,
        },
        {
          roomName,
          participantName: selectedAgent.name,
        },
      )

      setLastLiveKitSession({
        roomName: result.session.roomName,
        participantName: result.session.participantName,
        url: result.session.url,
        token: result.session.token,
      })

      toast({
        title: 'LiveKit session issued',
        description: `Room ${result.session.roomName} ready for ${selectedAgent.name}.`,
      })
    } catch (err: any) {
      toast({
        title: 'LiveKit session request failed',
        description: err.message || 'Unable to issue LiveKit session from automation bridge.',
        variant: 'destructive',
      })
    } finally {
      setAutomationBusy(false)
    }
  }

  const ensureAgentKey = async (agent: Agent) => {
    if (agent.api_key) return agent.api_key
    const generated = generateClientAgentKey()
    await updateAgent(agent.id, { api_key: generated })
    return generated
  }

  if (loadingControlData) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-cyber-green" />
          <p className="mt-3 text-sm text-cyber-gray">Booting Empire Control...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyber-white">OpenClaw Empire Control</h1>
          <p className="mt-1 text-sm text-cyber-gray">
            Unified command surface for agent launch, deployment, reporting, and secure access.
          </p>
        </div>
        <Button
          onClick={loadControlData}
          disabled={refreshing}
          className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Syncing...' : 'Sync Control Plane'}
        </Button>
      </div>

      {controlError && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <p className="text-sm">{controlError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-cyber-gray">Active Agents</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold text-cyber-white">{activeAgents}</p>
            <Users className="h-5 w-5 text-cyber-green" />
          </CardContent>
        </Card>
        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-cyber-gray">Live Deployments</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold text-cyber-white">{activeAssignments}</p>
            <Briefcase className="h-5 w-5 text-cyber-green" />
          </CardContent>
        </Card>
        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-cyber-gray">Active Workflows</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold text-cyber-white">{activeWorkflows}</p>
            <Webhook className="h-5 w-5 text-cyber-green" />
          </CardContent>
        </Card>
        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-cyber-gray">Reports (24h)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold text-cyber-white">{activityLast24h}</p>
            <Activity className="h-5 w-5 text-cyber-green" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-cyber-border bg-cyber-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-cyber-white">Strategic Radar</CardTitle>
          <CardDescription className="text-cyber-gray">
            High-priority signals that need operator attention first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {priorityAlerts.map((alert, index) => (
              <div
                key={`${alert}-${index}`}
                className={`rounded-md border px-3 py-2 text-sm ${
                  alert === 'All systems nominal'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                }`}
              >
                {alert}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="launch" className="space-y-4">
        <TabsList className="border border-cyber-border bg-cyber-card">
          <TabsTrigger value="launch" className="data-[state=active]:bg-cyber-green data-[state=active]:text-cyber-black">
            <Sparkles className="mr-2 h-4 w-4" />
            Launch & Deploy
          </TabsTrigger>
          <TabsTrigger
            value="deployments"
            className="data-[state=active]:bg-cyber-green data-[state=active]:text-cyber-black"
          >
            <Briefcase className="mr-2 h-4 w-4" />
            Deployment Board
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="data-[state=active]:bg-cyber-green data-[state=active]:text-cyber-black"
          >
            <Activity className="mr-2 h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="access" className="data-[state=active]:bg-cyber-green data-[state=active]:text-cyber-black">
            <Shield className="mr-2 h-4 w-4" />
            Agent Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="launch" className="space-y-4">
          <Card className="border-cyber-border bg-cyber-card">
            <CardHeader>
              <CardTitle className="text-cyber-white">Deploy A New Agent</CardTitle>
              <CardDescription className="text-cyber-gray">
                Spawn a new OpenClaw operator and attach it to business/workflow execution in one action.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs text-cyber-gray">Launch Templates</p>
                <div className="flex flex-wrap gap-2">
                  {LAUNCH_TEMPLATES.map((template) => (
                    <Button
                      key={template.id}
                      size="sm"
                      variant="ghost"
                      onClick={() => applyLaunchTemplate(template)}
                      className="h-8 border border-cyber-border text-cyber-gray hover:border-cyber-green/40 hover:text-cyber-white"
                    >
                      <span className="mr-1.5">{template.emoji}</span>
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-cyber-gray">Agent Name *</label>
                  <input
                    value={launchForm.name}
                    onChange={(event) => setLaunchForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Aurora Prime"
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-cyber-gray">Role *</label>
                  <input
                    value={launchForm.role}
                    onChange={(event) => setLaunchForm((current) => ({ ...current, role: event.target.value }))}
                    placeholder="Growth Operator"
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-cyber-gray">Emoji</label>
                  <input
                    value={launchForm.emoji}
                    onChange={(event) => setLaunchForm((current) => ({ ...current, emoji: event.target.value }))}
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-cyber-gray">Model</label>
                  <select
                    value={launchForm.model}
                    onChange={(event) => setLaunchForm((current) => ({ ...current, model: event.target.value }))}
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                    aria-label="Select model"
                  >
                    {MODEL_OPTIONS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-cyber-gray">Mission Brief</label>
                <textarea
                  value={launchForm.mission}
                  onChange={(event) => setLaunchForm((current) => ({ ...current, mission: event.target.value }))}
                  rows={3}
                  placeholder="What outcomes should this agent deliver in its first execution cycle?"
                  className="w-full resize-none rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-cyber-gray">Assign To Business</label>
                  <select
                    value={launchForm.businessId}
                    onChange={(event) => setLaunchForm((current) => ({ ...current, businessId: event.target.value }))}
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                    aria-label="Select business"
                  >
                    <option value="">No business assignment</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-cyber-gray">Trigger Workflow</label>
                  <select
                    value={launchForm.workflowId}
                    onChange={(event) => setLaunchForm((current) => ({ ...current, workflowId: event.target.value }))}
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                    aria-label="Select workflow"
                  >
                    <option value="">No workflow trigger</option>
                    {workflows
                      .filter((workflow) => workflow.is_active)
                      .map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-cyber-gray">Priority</label>
                  <select
                    value={launchForm.priority}
                    onChange={(event) =>
                      setLaunchForm((current) => ({
                        ...current,
                        priority: event.target.value as 'high' | 'medium' | 'low',
                      }))
                    }
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                    aria-label="Select priority"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  onClick={handleLaunch}
                  disabled={deploying}
                  className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
                >
                  {deploying ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Launch Agent
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={resetLaunchForm}
                  className="border border-cyber-border text-cyber-gray hover:text-cyber-white"
                >
                  Reset
                </Button>
              </div>

              <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
                <p className="text-xs text-cyber-gray">Swarm Deploy</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_auto]">
                  <input
                    value={bulkLaunchPrefix}
                    onChange={(event) => setBulkLaunchPrefix(event.target.value)}
                    placeholder="Name prefix (e.g. Vanguard)"
                    className="rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={bulkLaunchCount}
                    onChange={(event) =>
                      setBulkLaunchCount(Math.min(Math.max(Number(event.target.value) || 1, 1), 20))
                    }
                    className="rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                  <Button
                    onClick={handleBulkLaunch}
                    disabled={deploying}
                    className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
                  >
                    {deploying ? 'Deploying...' : 'Launch Swarm'}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-cyber-gray">
                  Uses the same role, model, mission, business, workflow, and priority settings from this form.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border-cyber-border bg-cyber-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-cyber-gray">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-cyber-white">{deploymentSummary.completed}</p>
              </CardContent>
            </Card>
            <Card className="border-cyber-border bg-cyber-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-cyber-gray">Paused</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-cyber-white">{deploymentSummary.paused}</p>
              </CardContent>
            </Card>
            <Card className="border-cyber-border bg-cyber-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-cyber-gray">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-cyber-white">{deploymentSummary.successRate}%</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-cyber-border bg-cyber-card">
            <CardHeader>
              <CardTitle className="text-cyber-white">Deployment Ledger</CardTitle>
              <CardDescription className="text-cyber-gray">
                Track each assignment and transition status as work progresses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignments.length === 0 && <p className="text-sm text-cyber-gray">No assignments yet.</p>}
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border border-cyber-border bg-cyber-dark p-3 transition-colors hover:border-cyber-green/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-cyber-white">
                        {getAgentName(assignment.agent_id)} <span className="text-cyber-gray">-&gt;</span>{' '}
                        {getBusinessName(assignment.business_id)}
                      </p>
                      <p className="text-xs text-cyber-gray">{assignment.role}</p>
                      <p className="mt-1 text-xs text-cyber-gray/90">{assignment.instructions || 'No instructions'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-cyber-green/20 text-cyber-green">{assignment.priority}</Badge>
                      <Badge
                        className={
                          assignment.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : assignment.status === 'paused'
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-blue-500/20 text-blue-300'
                        }
                      >
                        {assignment.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignment.status !== 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAssignmentStatus(assignment, 'active')}
                        className="h-8 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                      >
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Activate
                      </Button>
                    )}
                    {assignment.status === 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAssignmentStatus(assignment, 'paused')}
                        className="h-8 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                      >
                        <Pause className="mr-1 h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}
                    {assignment.status !== 'completed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAssignmentStatus(assignment, 'completed')}
                        className="h-8 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <CheckCircle className="mr-1 h-3.5 w-3.5" />
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card className="border-cyber-border bg-cyber-card">
            <CardHeader>
              <CardTitle className="text-cyber-white">Operator Report Deck</CardTitle>
              <CardDescription className="text-cyber-gray">
                Export strategic snapshots and review top performers from live operations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={downloadSnapshot} className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80">
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON Snapshot
                </Button>
                <Button
                  onClick={downloadDeploymentCsv}
                  variant="ghost"
                  className="border border-cyber-border text-cyber-gray hover:text-cyber-white"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Deployment CSV
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border-cyber-border bg-cyber-dark">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-cyber-white">Top Agents</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topAgents.length === 0 && <p className="text-sm text-cyber-gray">No active data.</p>}
                    {topAgents.map((agent) => (
                      <div key={agent.id} className="flex items-center justify-between rounded-md border border-cyber-border p-2">
                        <div className="flex items-center gap-2">
                          <span>{agent.emoji || '🤖'}</span>
                          <div>
                            <p className="text-sm text-cyber-white">{agent.name}</p>
                            <p className="text-xs text-cyber-gray">{agent.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-cyber-green">{agent.completedTasks || agent.completed_tasks || 0}</p>
                          <p className="text-xs text-cyber-gray">tasks done</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-cyber-border bg-cyber-dark">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-cyber-white">Recent Activity Feed</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {activity.slice(0, 8).map((entry) => (
                      <div key={entry.id} className="rounded-md border border-cyber-border p-2">
                        <p className="text-xs text-cyber-white">
                          <span className="font-semibold text-cyber-green">{entry.agent_name}</span> {entry.message}
                        </p>
                        <p className="mt-1 text-[11px] text-cyber-gray">{new Date(entry.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                    {activity.length === 0 && <p className="text-sm text-cyber-gray">No activity recorded.</p>}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card className="border-cyber-border bg-cyber-card">
            <CardHeader>
              <CardTitle className="text-cyber-white">Self-Register Endpoint</CardTitle>
              <CardDescription className="text-cyber-gray">
                External OpenClaw agents can auto-enroll by calling this function and immediately start reporting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-cyber-border bg-cyber-black p-3">
                <p className="text-xs text-cyber-gray">Endpoint URL</p>
                <p className="mt-1 break-all font-mono text-sm text-cyber-green">{SELF_REGISTER_ENDPOINT}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-xs text-cyber-gray">Shared Secret (optional but recommended)</label>
                  <input
                    type="password"
                    value={selfRegisterSecret}
                    onChange={(event) => setSelfRegisterSecret(event.target.value)}
                    placeholder="SELF_REGISTER_SECRET value"
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <p className="block text-xs text-cyber-gray">Quick Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                      onClick={() => copyText(SELF_REGISTER_ENDPOINT, 'Self-register endpoint copied.')}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy Endpoint
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                      onClick={() => copyText(getSelfRegisterCurl(), 'Self-register cURL template copied.')}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy cURL
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                      onClick={() => copyText(getSelfRegisterSdkSnippet(), 'Self-register SDK snippet copied.')}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy SDK Snippet
                    </Button>
                    <Button
                      size="sm"
                      onClick={runSelfRegisterSmokeTest}
                      disabled={testingSelfRegister}
                      className="h-9 bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
                    >
                      {testingSelfRegister ? (
                        <>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Run Smoke Test
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
                <p className="text-xs text-cyber-gray">What happens on successful self-register</p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-cyber-white md:grid-cols-2">
                  <p>1. Agent record created (or matched via `external_id`).</p>
                  <p>2. API key returned for future authenticated automation.</p>
                  <p>3. Session starts automatically (`sessions` table).</p>
                  <p>4. Activity is logged to `activity_log` for visibility.</p>
                  <p>5. Optional business assignment is upserted.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyber-border bg-cyber-card">
            <CardHeader>
              <CardTitle className="text-cyber-white">Agent Automation Bridge (Forum + n8n + SIP + LiveKit)</CardTitle>
              <CardDescription className="text-cyber-gray">
                Let agents share progress, create n8n workflows, import SIP numbers, and request LiveKit sessions through one endpoint.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-cyber-border bg-cyber-black p-3">
                <p className="text-xs text-cyber-gray">Endpoint URL</p>
                <p className="mt-1 break-all font-mono text-sm text-cyber-green">{AGENT_AUTOMATION_ENDPOINT}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-xs text-cyber-gray">Automation Secret (optional)</label>
                  <input
                    type="password"
                    value={automationSecret}
                    onChange={(event) => setAutomationSecret(event.target.value)}
                    placeholder="AGENT_AUTOMATION_SECRET"
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-cyber-gray">Automation Agent</label>
                  <select
                    value={automationAgentId}
                    onChange={(event) => setAutomationAgentId(event.target.value)}
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  >
                    <option value="">Select agent...</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.emoji || '🤖'} {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-xs text-cyber-gray">n8n Base URL</label>
                  <input
                    value={n8nBaseUrl}
                    onChange={(event) => setN8nBaseUrl(event.target.value)}
                    placeholder="https://n8n.your-domain.com"
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-cyber-gray">n8n API Key (optional)</label>
                  <input
                    type="password"
                    value={n8nApiKey}
                    onChange={(event) => setN8nApiKey(event.target.value)}
                    placeholder="n8n_api_..."
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className="block text-xs text-cyber-gray">Workflow Name</label>
                  <input
                    value={automationWorkflowName}
                    onChange={(event) => setAutomationWorkflowName(event.target.value)}
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-cyber-gray">Trigger URL (optional)</label>
                  <input
                    value={automationTriggerUrl}
                    onChange={(event) => setAutomationTriggerUrl(event.target.value)}
                    placeholder="https://n8n.../webhook/..."
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-cyber-gray">LiveKit Room Prefix</label>
                  <input
                    value={automationRoomName}
                    onChange={(event) => setAutomationRoomName(event.target.value)}
                    className="w-full rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-cyber-gray">Workflow Description</label>
                <textarea
                  value={automationWorkflowDescription}
                  onChange={(event) => setAutomationWorkflowDescription(event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={saveAutomationSettings}
                  variant="ghost"
                  className="h-9 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                >
                  <Server className="mr-1.5 h-3.5 w-3.5" />
                  Save n8n Settings
                </Button>
                <Button
                  size="sm"
                  onClick={runAutomationWorkflowSmokeTest}
                  disabled={automationBusy}
                  className="h-9 bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
                >
                  <Webhook className="mr-1.5 h-3.5 w-3.5" />
                  {automationBusy ? 'Running...' : 'Test Agent Workflow Create'}
                </Button>
                <Button
                  size="sm"
                  onClick={runLiveKitAutomationSmokeTest}
                  disabled={automationBusy}
                  className="h-9 bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
                >
                  <Mic className="mr-1.5 h-3.5 w-3.5" />
                  {automationBusy ? 'Running...' : 'Test Agent LiveKit Session'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                  onClick={() => copyText(getAutomationCurlSnippet(), 'Automation bridge cURL copied.')}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy cURL
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                  onClick={() => copyText(buildAutomationSdkSnippet(), 'Automation bridge SDK snippet copied.')}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy SDK Snippet
                </Button>
              </div>

              {(lastAutomationWorkflow || lastLiveKitSession) && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {lastAutomationWorkflow && (
                    <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
                      <p className="text-xs text-cyber-gray">Last Agent Workflow</p>
                      <p className="mt-1 text-sm text-cyber-white">{lastAutomationWorkflow.name}</p>
                      <p className="mt-1 break-all font-mono text-xs text-cyber-green">
                        {lastAutomationWorkflow.triggerUrl}
                      </p>
                      {lastAutomationWorkflow.n8nWorkflowId && (
                        <p className="mt-1 text-xs text-cyber-gray">
                          n8n workflow id: <span className="font-mono text-cyber-white">{lastAutomationWorkflow.n8nWorkflowId}</span>
                        </p>
                      )}
                      {lastAutomationWorkflow.warning && (
                        <p className="mt-1 text-xs text-yellow-300">{lastAutomationWorkflow.warning}</p>
                      )}
                    </div>
                  )}

                  {lastLiveKitSession && (
                    <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
                      <p className="text-xs text-cyber-gray">Last LiveKit Session</p>
                      <p className="mt-1 text-sm text-cyber-white">{lastLiveKitSession.roomName}</p>
                      <p className="mt-1 break-all font-mono text-xs text-cyber-green">{lastLiveKitSession.url}</p>
                      <div className="mt-2 rounded border border-cyber-border bg-cyber-black px-2 py-1">
                        <p className="line-clamp-2 break-all font-mono text-[10px] text-cyber-gray">
                          {lastLiveKitSession.token}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyber-border bg-cyber-card">
            <CardHeader>
              <CardTitle className="text-cyber-white">Agent Access Packets</CardTitle>
              <CardDescription className="text-cyber-gray">
                Secure credentials and onboarding payloads for autonomous agents to report into your empire.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.length === 0 && <p className="text-sm text-cyber-gray">No agents available.</p>}
              {agents.map((agent) => {
                const visible = Boolean(showApiKeys[agent.id])
                const hasKey = Boolean(agent.api_key)
                const renderedKey = hasKey
                  ? visible
                    ? agent.api_key
                    : `${agent.api_key?.slice(0, 8)}...${agent.api_key?.slice(-4)}`
                  : 'No key yet'

                return (
                  <div key={agent.id} className="rounded-lg border border-cyber-border bg-cyber-dark p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-cyber-white">
                          {agent.emoji || '🤖'} {agent.name}
                        </p>
                        <p className="text-xs text-cyber-gray">{agent.role}</p>
                      </div>
                      <Badge className="bg-cyber-green/20 text-cyber-green">{agent.status}</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                      <div className="rounded-md border border-cyber-border bg-cyber-black px-3 py-2 font-mono text-xs text-cyber-green">
                        {renderedKey}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowApiKeys((current) => ({ ...current, [agent.id]: !visible }))}
                        className="h-8 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                      >
                        <Key className="mr-1 h-3.5 w-3.5" />
                        {visible ? 'Hide' : 'Show'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                        onClick={async () => {
                          const key = await ensureAgentKey(agent)
                          await copyText(key, `${agent.name} key copied.`)
                          await fetchAgents()
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copy Key
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                        onClick={async () => {
                          const key = await ensureAgentKey(agent)
                          const config = (agent.config && typeof agent.config === 'object'
                            ? (agent.config as Record<string, unknown>)
                            : {}) as Record<string, unknown>
                          const operatingProfile =
                            config.operatingProfile && typeof config.operatingProfile === 'object'
                              ? (config.operatingProfile as Record<string, unknown>)
                              : null
                          const onboardingPacket = {
                            baseUrl: INSFORGE_BASE_URL,
                            agentId: agent.id,
                            agentName: agent.name,
                            agentRole: agent.role,
                            agentApiKey: key,
                            selfRegisterEndpoint: SELF_REGISTER_ENDPOINT,
                            automationBridgeEndpoint: AGENT_AUTOMATION_ENDPOINT,
                            reportTable: 'activity_log',
                            sessionTable: 'sessions',
                            assignmentTable: 'agent_assignments',
                            capabilities: {
                              canWebSearch: true,
                              canDiscoverProviderUpdates: true,
                              canCreateN8nWorkflow: true,
                              canRequestLiveKitSession: true,
                              canImportSipNumbers: true,
                              canPostForumUpdates: true,
                              canCreateDaoDeploymentTasks: true,
                              canRunShopifySnapshots: true,
                              canUseMcpControlPlane: true,
                            },
                            defaultSkills: DEFAULT_AGENT_SKILLS,
                            defaultMcpTools: DEFAULT_MCP_TOOLING,
                            defaultMcpServers:
                              (operatingProfile?.mcp as Record<string, unknown> | undefined)?.servers ||
                              DEFAULT_MCP_SERVERS,
                            operatingProfile,
                          }
                          await copyText(
                            JSON.stringify(onboardingPacket, null, 2),
                            `${agent.name} onboarding packet copied.`
                          )
                          await fetchAgents()
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copy Packet
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
