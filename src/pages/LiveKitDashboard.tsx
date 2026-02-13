import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useToast } from '../components/ui/use-toast'
import { VoiceAgentPanel } from '../components/voice/VoiceAgentPanel'
import { useAgentStore } from '../stores/agent-store'
import { insforge } from '../lib/insforge'
import { generateLiveKitToken } from '../lib/livekit'
import { invokeAgentImportSipNumbers, invokeAgentSynthesizeTts } from '../lib/agent-automation'
import { mergeAgentConfigWithDefaults } from '../lib/agent-defaults'
import {
  Phone,
  Mic,
  RefreshCw,
  Plus,
  Copy,
  X,
  Headphones,
  Server,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Upload,
  Save,
  AudioLines,
} from 'lucide-react'

type PhoneProvider =
  | 'twilio'
  | 'telnyx'
  | 'plivo'
  | 'bandwidth'
  | 'vonage'
  | 'signalwire'
  | 'flowroute'
  | 'voipms'
  | 'openphone'
  | 'aircall'
  | 'ringcentral'
  | 'dialpad'
  | 'voip_sip'
  | 'other'

interface AgentPhoneRecord {
  id: string
  phone_number: string
  provider: PhoneProvider
  agent_id: string | null
  agent_name: string | null
  capabilities: string[] | null
  routing_config: { action?: string; fallback?: string } | null
  status: 'active' | 'inactive' | 'pending'
  label: string | null
  created_at: string
}

interface WorkflowRecord {
  id: string
  name: string
  trigger_url: string
  is_active: boolean
}

interface SipImportDraft {
  phone_number: string
  provider: PhoneProvider
  label: string
  prompt: string
  workflow_name: string
  workflow_trigger_url: string
  agent_id: string
}

interface PhoneRoutingConfig {
  action?: string
  fallback?: string
  prompt?: string
  n8n_workflow_id?: string
  n8n_trigger_url?: string
  sip?: Record<string, unknown>
}

interface AgentTtsConfig {
  provider: string
  model: string
  voice: string
  endpoint?: string
  apiKey?: string
}

const SUPPORTED_PHONE_PROVIDERS: PhoneProvider[] = [
  'twilio',
  'telnyx',
  'plivo',
  'bandwidth',
  'vonage',
  'signalwire',
  'flowroute',
  'voipms',
  'openphone',
  'aircall',
  'ringcentral',
  'dialpad',
  'voip_sip',
  'other',
]

const PHONE_PROVIDER_LABELS: Record<PhoneProvider, string> = {
  twilio: 'Twilio',
  telnyx: 'Telnyx',
  plivo: 'Plivo',
  bandwidth: 'Bandwidth',
  vonage: 'Vonage',
  signalwire: 'SignalWire',
  flowroute: 'Flowroute',
  voipms: 'VoIP.ms',
  openphone: 'OpenPhone',
  aircall: 'Aircall',
  ringcentral: 'RingCentral',
  dialpad: 'Dialpad',
  voip_sip: 'Generic VoIP/SIP',
  other: 'Other',
}

const DEFAULT_AGENT_FORM = {
  agentName: '',
  role: 'phone-agent',
  model: 'gpt-4o-mini',
  emoji: '🎧',
  createPhoneLine: true,
  phoneNumber: '',
  phoneLabel: '',
  provider: 'voip_sip' as PhoneProvider,
  capabilities: ['voice', 'sms'] as string[],
  routingAction: 'ai_answer',
  routingFallback: 'voicemail',
}

function hasVoiceCapability(phone: AgentPhoneRecord) {
  return (phone.capabilities || []).includes('voice')
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function parseCsvLine(line: string) {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  result.push(current.trim())
  return result
}

export default function LiveKitDashboard() {
  const { toast } = useToast()
  const { agents, fetchAgents, updateAgent } = useAgentStore()
  const [phones, setPhones] = useState<AgentPhoneRecord[]>([])
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [assigningPhoneId, setAssigningPhoneId] = useState<string | null>(null)
  const [agentForm, setAgentForm] = useState(DEFAULT_AGENT_FORM)

  const [sipBulkInput, setSipBulkInput] = useState('')
  const [sipBulkFileName, setSipBulkFileName] = useState('')
  const [sipImportPreview, setSipImportPreview] = useState<SipImportDraft[]>([])
  const [sipImportWarnings, setSipImportWarnings] = useState<string[]>([])
  const [sipImporting, setSipImporting] = useState(false)
  const [sipParseBusy, setSipParseBusy] = useState(false)
  const [sipDefaultProvider, setSipDefaultProvider] = useState<PhoneProvider>('twilio')
  const [sipDefaultAgentId, setSipDefaultAgentId] = useState('')
  const [sipAutomationAgentId, setSipAutomationAgentId] = useState('')
  const [sipAutomationSecret, setSipAutomationSecret] = useState('')
  const [sipN8nBaseUrl, setSipN8nBaseUrl] = useState('')
  const [sipN8nApiKey, setSipN8nApiKey] = useState('')
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [editingPromptValue, setEditingPromptValue] = useState('')

  const [voiceAgent, setVoiceAgent] = useState<{ id: string; name: string } | null>(null)

  const [roomName, setRoomName] = useState('phone-ops-room')
  const [participantName, setParticipantName] = useState('Operator')
  const [tokenResult, setTokenResult] = useState<{ token: string; url: string } | null>(null)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [ttsAgentId, setTtsAgentId] = useState('')
  const [ttsText, setTtsText] = useState('Hello from your LiveKit voice agent network.')
  const [ttsProvider, setTtsProvider] = useState('openai')
  const [ttsModel, setTtsModel] = useState('gpt-4o-mini-tts')
  const [ttsVoice, setTtsVoice] = useState('alloy')
  const [ttsEndpoint, setTtsEndpoint] = useState('')
  const [ttsApiKey, setTtsApiKey] = useState('')
  const [ttsSynthesizing, setTtsSynthesizing] = useState(false)
  const [ttsPreview, setTtsPreview] = useState<{ dataUrl: string; provider: string; voice: string } | null>(null)

  useEffect(() => {
    void refreshData()
  }, [])

  useEffect(() => {
    if (!sipDefaultAgentId && agents.length > 0) {
      setSipDefaultAgentId(agents[0].id)
    }
    if (!sipAutomationAgentId && agents.length > 0) {
      setSipAutomationAgentId(agents[0].id)
    }
    if (!ttsAgentId && agents.length > 0) {
      setTtsAgentId(agents[0].id)
    }
  }, [agents, sipAutomationAgentId, sipDefaultAgentId, ttsAgentId])

  useEffect(() => {
    if (!ttsAgentId) return
    const selected = agents.find((agent) => agent.id === ttsAgentId)
    if (!selected) return
    const config = asRecord(selected.config)
    const voice = asRecord(config.voice)
    const tts = asRecord(voice.tts)
    if (Object.keys(tts).length === 0) return

    setTtsProvider(asString(tts.provider, 'openai'))
    setTtsModel(asString(tts.model, 'gpt-4o-mini-tts'))
    setTtsVoice(asString(tts.voice, 'alloy'))
    setTtsEndpoint(asString(tts.endpoint))
  }, [agents, ttsAgentId])

  const refreshData = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchAgents(), loadPhones(), loadWorkflows()])
    } finally {
      setRefreshing(false)
    }
  }

  const loadPhones = async () => {
    try {
      const { data, error } = await insforge.database
        .from('agent_phones')
        .select()
        .order('created_at', { ascending: false })

      if (error) throw error
      setPhones((data || []) as AgentPhoneRecord[])
    } catch (error: any) {
      toast({
        title: 'Failed to load phone lines',
        description: error.message || 'Could not fetch phone lines.',
        variant: 'destructive',
      })
    }
  }

  const loadWorkflows = async () => {
    try {
      const { data, error } = await insforge.database
        .from('agent_workflows')
        .select()
        .order('created_at', { ascending: false })

      if (error) throw error
      setWorkflows((data || []) as WorkflowRecord[])
    } catch (error: any) {
      toast({
        title: 'Failed to load workflows',
        description: error.message || 'Could not fetch workflow list.',
        variant: 'destructive',
      })
    }
  }

  const liveKitAgentIds = useMemo(() => {
    const ids = new Set<string>()

    for (const agent of agents) {
      const config = agent.config
      if (!config || typeof config !== 'object') continue

      const record = config as Record<string, unknown>
      const voiceConfig = record.voice
      if (!voiceConfig || typeof voiceConfig !== 'object') continue

      const voiceRecord = voiceConfig as Record<string, unknown>
      if (voiceRecord.provider === 'livekit') {
        ids.add(agent.id)
      }
    }

    for (const phone of phones) {
      if (phone.agent_id && hasVoiceCapability(phone)) {
        ids.add(phone.agent_id)
      }
    }

    return ids
  }, [agents, phones])

  const liveKitAgents = useMemo(
    () => agents.filter((agent) => liveKitAgentIds.has(agent.id)),
    [agents, liveKitAgentIds],
  )

  const voicePhones = useMemo(() => phones.filter((phone) => hasVoiceCapability(phone)), [phones])

  const phoneByAgentId = useMemo(() => {
    const map = new Map<string, AgentPhoneRecord[]>()
    for (const phone of phones) {
      if (!phone.agent_id) continue
      const list = map.get(phone.agent_id) || []
      list.push(phone)
      map.set(phone.agent_id, list)
    }
    return map
  }, [phones])

  const toggleCapability = (capability: string) => {
    if (capability === 'voice') return

    setAgentForm((current) => {
      const exists = current.capabilities.includes(capability)
      const capabilities = exists
        ? current.capabilities.filter((entry) => entry !== capability)
        : [...current.capabilities, capability]

      return { ...current, capabilities: ['voice', ...capabilities.filter((entry) => entry !== 'voice')] }
    })
  }

  const createLiveKitAgent = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!agentForm.agentName.trim()) {
      toast({
        title: 'Agent name required',
        description: 'Set an agent name before creating.',
        variant: 'destructive',
      })
      return
    }

    if (agentForm.createPhoneLine && !agentForm.phoneNumber.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Provide a phone number to provision a line.',
        variant: 'destructive',
      })
      return
    }

    setCreatingAgent(true)
    try {
      const nowIso = new Date().toISOString()
      const { data: createdAgent, error: agentError } = await insforge.database
        .from('agents')
        .insert({
          name: agentForm.agentName.trim(),
          role: agentForm.role,
          status: 'active',
          model: agentForm.model,
          emoji: agentForm.emoji,
          description: 'LiveKit voice agent created from dashboard',
          tasks: 0,
          completed_tasks: 0,
          token_usage: 0,
          last_active: nowIso,
          config: mergeAgentConfigWithDefaults({
            voice: {
              provider: 'livekit',
              phone_mode: agentForm.createPhoneLine,
              created_from: 'livekit-dashboard',
              created_at: nowIso,
            },
          }),
        })
        .select()
        .single()

      if (agentError || !createdAgent) {
        throw agentError || new Error('Agent creation failed')
      }

      let phoneInsertError: string | null = null

      if (agentForm.createPhoneLine) {
        const { error: lineError } = await insforge.database.from('agent_phones').insert({
          phone_number: agentForm.phoneNumber.trim(),
          provider: agentForm.provider,
          agent_id: createdAgent.id,
          agent_name: createdAgent.name,
          capabilities: Array.from(new Set(agentForm.capabilities)),
          routing_config: {
            action: agentForm.routingAction,
            fallback: agentForm.routingFallback,
          },
          status: 'active',
          label: agentForm.phoneLabel.trim(),
        })

        if (lineError) {
          phoneInsertError = lineError.message || 'Phone line provisioning failed'
        }
      }

      await insforge.database.from('activity_log').insert({
        agent_name: createdAgent.name,
        message: agentForm.createPhoneLine
          ? `livekit agent created with line ${agentForm.phoneNumber.trim()}`
          : 'livekit voice agent created',
        type: phoneInsertError ? 'warning' : 'info',
      })

      if (phoneInsertError) {
        toast({
          title: `Agent ${createdAgent.name} created`,
          description: `Phone line provisioning failed: ${phoneInsertError}`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: `LiveKit agent ${createdAgent.name} created`,
          description: agentForm.createPhoneLine
            ? 'Agent and phone line are active.'
            : 'Voice-only agent is active.',
        })
      }

      setAgentForm(DEFAULT_AGENT_FORM)
      await refreshData()
    } catch (error: any) {
      toast({
        title: 'Failed to create LiveKit agent',
        description: error.message || 'Could not create agent.',
        variant: 'destructive',
      })
    } finally {
      setCreatingAgent(false)
    }
  }

  const assignPhoneToAgent = async (phoneId: string, agentId: string) => {
    setAssigningPhoneId(phoneId)
    try {
      const selectedAgent = agents.find((entry) => entry.id === agentId)
      const { error } = await insforge.database
        .from('agent_phones')
        .update({
          agent_id: selectedAgent?.id || null,
          agent_name: selectedAgent?.name || null,
        })
        .eq('id', phoneId)

      if (error) throw error

      setPhones((current) =>
        current.map((phone) =>
          phone.id === phoneId
            ? {
                ...phone,
                agent_id: selectedAgent?.id || null,
                agent_name: selectedAgent?.name || null,
              }
            : phone,
        ),
      )

      toast({
        title: selectedAgent ? 'Phone line assigned' : 'Phone line unassigned',
      })
    } catch (error: any) {
      toast({
        title: 'Phone assignment failed',
        description: error.message || 'Could not assign phone line.',
        variant: 'destructive',
      })
    } finally {
      setAssigningPhoneId(null)
    }
  }

  const generateToken = async () => {
    if (!roomName.trim() || !participantName.trim()) {
      toast({
        title: 'Room and participant required',
        description: 'Set both values before generating a token.',
        variant: 'destructive',
      })
      return
    }

    setGeneratingToken(true)
    try {
      const data = await generateLiveKitToken(roomName.trim(), participantName.trim())
      setTokenResult(data)
      toast({ title: 'LiveKit token generated' })
    } catch (error: any) {
      toast({
        title: 'Token generation failed',
        description: error.message || 'Could not generate token from backend function.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingToken(false)
    }
  }

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: `${label} copied` })
    } catch {
      toast({
        title: `Failed to copy ${label.toLowerCase()}`,
        description: 'Clipboard permission may be blocked in this browser.',
        variant: 'destructive',
      })
    }
  }

  const ensureAgentApiKey = async (agentId: string) => {
    const target = agents.find((agent) => agent.id === agentId)
    if (!target) {
      throw new Error('Selected automation agent not found')
    }
    if (target.api_key) {
      return target.api_key
    }

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)

    await updateAgent(agentId, { api_key: generated })
    return generated
  }

  const saveTtsConfigToAgent = async () => {
    if (!ttsAgentId) {
      toast({
        title: 'Select a TTS agent',
        description: 'Choose which LiveKit agent should receive this TTS server config.',
        variant: 'destructive',
      })
      return
    }

    const target = agents.find((agent) => agent.id === ttsAgentId)
    if (!target) {
      toast({
        title: 'Agent not found',
        description: 'Selected agent no longer exists.',
        variant: 'destructive',
      })
      return
    }

    const currentConfig = asRecord(target.config)
    const currentVoice = asRecord(currentConfig.voice)
    const ttsConfig: AgentTtsConfig = {
      provider: ttsProvider.trim() || 'openai',
      model: ttsModel.trim() || 'gpt-4o-mini-tts',
      voice: ttsVoice.trim() || 'alloy',
      endpoint: ttsEndpoint.trim() || undefined,
      apiKey: ttsApiKey.trim() || undefined,
    }

    const nextConfig = mergeAgentConfigWithDefaults({
      ...currentConfig,
      voice: {
        ...currentVoice,
        provider: 'livekit',
        tts: ttsConfig,
      },
    })

    await updateAgent(ttsAgentId, { config: nextConfig })
    toast({
      title: 'TTS config saved',
      description: 'LiveKit + TTS settings are now embedded in this agent config.',
    })
  }

  const synthesizeTtsPreview = async () => {
    if (!ttsAgentId) {
      toast({
        title: 'Select a TTS agent',
        description: 'Choose which agent should execute TTS generation.',
        variant: 'destructive',
      })
      return
    }

    if (!ttsText.trim()) {
      toast({
        title: 'TTS text required',
        description: 'Enter a test sentence before synthesizing.',
        variant: 'destructive',
      })
      return
    }

    setTtsSynthesizing(true)
    try {
      const agentApiKey = await ensureAgentApiKey(ttsAgentId)
      const result = await invokeAgentSynthesizeTts(
        {
          agentId: ttsAgentId,
          agentApiKey,
        },
        {
          text: ttsText.trim(),
          provider: ttsProvider.trim() || 'openai',
          model: ttsModel.trim() || undefined,
          voice: ttsVoice.trim() || undefined,
          endpoint: ttsEndpoint.trim() || undefined,
          apiKey: ttsApiKey.trim() || undefined,
        },
      )

      setTtsPreview({
        dataUrl: result.audio.dataUrl,
        provider: result.audio.provider,
        voice: result.audio.voice,
      })
      toast({
        title: 'TTS audio generated',
        description: `${result.audio.provider}/${result.audio.voice} preview ready.`,
      })
    } catch (error: any) {
      toast({
        title: 'TTS synthesis failed',
        description: error.message || 'Could not generate server-side TTS audio.',
        variant: 'destructive',
      })
    } finally {
      setTtsSynthesizing(false)
    }
  }

  const parseSipImportPayload = () => {
    const lines = sipBulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    const drafts: SipImportDraft[] = []
    const warnings: string[] = []

    for (const line of lines) {
      const parts = parseCsvLine(line)
      if (parts.length === 0) continue

      const phone = (parts[0] || '').trim()
      if (!phone) {
        warnings.push(`Skipped line without phone number: ${line.slice(0, 80)}`)
        continue
      }

      const provider = (parts[1] || sipDefaultProvider).trim() as PhoneProvider
      const label = (parts[2] || '').trim()
      const prompt = (parts[3] || '').trim()
      const workflowName = (parts[4] || '').trim()
      const workflowTriggerUrl = (parts[5] || '').trim()
      const agentId = (parts[6] || sipDefaultAgentId || '').trim()

      drafts.push({
        phone_number: phone,
        provider: SUPPORTED_PHONE_PROVIDERS.includes(provider) ? provider : sipDefaultProvider,
        label,
        prompt,
        workflow_name: workflowName,
        workflow_trigger_url: workflowTriggerUrl,
        agent_id: agentId,
      })
    }

    const deduped: SipImportDraft[] = []
    const seen = new Set<string>()
    const existing = new Set(phones.map((phone) => phone.phone_number.trim()))

    for (const draft of drafts) {
      const key = draft.phone_number
      if (seen.has(key)) {
        warnings.push(`Skipped duplicate in file: ${draft.phone_number}`)
        continue
      }
      seen.add(key)
      if (existing.has(key)) {
        warnings.push(`Will update existing line: ${draft.phone_number}`)
      }
      deduped.push(draft)
    }

    setSipImportPreview(deduped)
    setSipImportWarnings(warnings)
    return { drafts: deduped, warnings }
  }

  const parseSipImport = () => {
    if (!sipBulkInput.trim()) {
      toast({
        title: 'No SIP import data',
        description: 'Paste CSV rows first.',
        variant: 'destructive',
      })
      return
    }
    setSipParseBusy(true)
    try {
      const parsed = parseSipImportPayload()
      toast({
        title: `Prepared ${parsed.drafts.length} lines`,
        description: parsed.warnings.length > 0 ? `${parsed.warnings.length} warnings found.` : 'Ready to import.',
      })
    } finally {
      setSipParseBusy(false)
    }
  }

  const handleSipFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    try {
      const content = await selectedFile.text()
      setSipBulkInput(content)
      setSipBulkFileName(selectedFile.name)
      toast({
        title: `${selectedFile.name} loaded`,
        description: 'Run Parse SIP Import to preview.',
      })
    } catch {
      toast({
        title: 'File load failed',
        description: 'Could not read SIP import file.',
        variant: 'destructive',
      })
    } finally {
      event.target.value = ''
    }
  }

  const runSipImport = async () => {
    if (sipImportPreview.length === 0) {
      const parsed = parseSipImportPayload()
      if (parsed.drafts.length === 0) {
        toast({
          title: 'No valid SIP rows',
          description: 'Import payload did not contain any valid rows.',
          variant: 'destructive',
        })
        return
      }
    }

    if (!sipAutomationAgentId) {
      toast({
        title: 'Select automation agent',
        description: 'Choose which agent should perform the SIP import action.',
        variant: 'destructive',
      })
      return
    }

    setSipImporting(true)
    try {
      const agentApiKey = await ensureAgentApiKey(sipAutomationAgentId)
      const result = await invokeAgentImportSipNumbers(
        {
          agentId: sipAutomationAgentId,
          agentApiKey,
          automationSecret: sipAutomationSecret.trim() || undefined,
        },
        {
          numbers: sipImportPreview.map((entry) => ({
            phone_number: entry.phone_number,
            provider: entry.provider,
            label: entry.label,
            prompt: entry.prompt,
            agent_id: entry.agent_id || undefined,
            workflow_name: entry.workflow_name || undefined,
            workflow_trigger_url: entry.workflow_trigger_url || undefined,
          })),
          assignAgentId: sipDefaultAgentId || undefined,
          provider: sipDefaultProvider,
          routingAction: 'ai_answer',
          routingFallback: 'voicemail',
          n8nBaseUrl: sipN8nBaseUrl.trim() || undefined,
          n8nApiKey: sipN8nApiKey.trim() || undefined,
        },
      )

      setSipImportWarnings((current) => [...current, ...result.summary.warnings])
      toast({
        title: `SIP import complete`,
        description: `Inserted ${result.summary.inserted}, updated ${result.summary.updated}.`,
      })

      setSipBulkInput('')
      setSipBulkFileName('')
      setSipImportPreview([])
      await refreshData()
    } catch (error: any) {
      toast({
        title: 'SIP import failed',
        description: error.message || 'Could not import SIP lines.',
        variant: 'destructive',
      })
    } finally {
      setSipImporting(false)
    }
  }

  const updatePhoneRouting = async (phone: AgentPhoneRecord, updates: Partial<PhoneRoutingConfig>) => {
    const currentConfig = asRecord(phone.routing_config) as PhoneRoutingConfig
    const nextConfig = { ...currentConfig, ...updates }

    const result = await insforge.database
      .from('agent_phones')
      .update({ routing_config: nextConfig })
      .eq('id', phone.id)

    if (result.error) {
      throw result.error
    }

    setPhones((current) =>
      current.map((entry) =>
        entry.id === phone.id
          ? {
              ...entry,
              routing_config: nextConfig,
            }
          : entry,
      ),
    )
  }

  const startPromptEdit = (phone: AgentPhoneRecord) => {
    const config = asRecord(phone.routing_config) as PhoneRoutingConfig
    setEditingPromptId(phone.id)
    setEditingPromptValue(asString(config.prompt))
  }

  const savePromptEdit = async (phone: AgentPhoneRecord) => {
    try {
      await updatePhoneRouting(phone, { prompt: editingPromptValue.trim() || undefined })
      toast({ title: 'Prompt updated' })
      setEditingPromptId(null)
      setEditingPromptValue('')
    } catch (error: any) {
      toast({
        title: 'Prompt update failed',
        description: error.message || 'Could not save prompt.',
        variant: 'destructive',
      })
    }
  }

  const linkWorkflowToPhone = async (phone: AgentPhoneRecord, workflowId: string) => {
    const workflow = workflows.find((entry) => entry.id === workflowId)
    try {
      await updatePhoneRouting(phone, {
        n8n_workflow_id: workflow?.id || undefined,
        n8n_trigger_url: workflow?.trigger_url || undefined,
      })
      toast({
        title: workflow ? 'Workflow linked' : 'Workflow unlinked',
      })
    } catch (error: any) {
      toast({
        title: 'Workflow link failed',
        description: error.message || 'Could not link workflow to phone line.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold text-cyber-white">
            <Headphones className="h-7 w-7 text-cyber-green" />
            LiveKit Phone Agent Dashboard
          </h2>
          <p className="text-sm text-cyber-gray">
            Create voice agents, provision lines, and open live voice consoles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void refreshData()}
            disabled={refreshing}
            variant="outline"
            className="border-cyber-border text-cyber-gray hover:text-cyber-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild variant="outline" className="border-cyber-border text-cyan-300 hover:text-cyan-200">
            <Link to="/phones">
              <Phone className="mr-2 h-4 w-4" />
              Full Phone Registry
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-cyber-border bg-cyber-card">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">LiveKit Agents</p>
            <p className="mt-1 text-2xl font-bold text-cyber-white">{liveKitAgents.length}</p>
          </CardContent>
        </Card>
        <Card className="border-cyber-border bg-cyber-card">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Voice Lines</p>
            <p className="mt-1 text-2xl font-bold text-cyber-green">{voicePhones.length}</p>
          </CardContent>
        </Card>
        <Card className="border-cyber-border bg-cyber-card">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Assigned Lines</p>
            <p className="mt-1 text-2xl font-bold text-cyber-white">
              {voicePhones.filter((phone) => Boolean(phone.agent_id)).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-cyber-border bg-cyber-card">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Unassigned Lines</p>
            <p className="mt-1 text-2xl font-bold text-yellow-300">
              {voicePhones.filter((phone) => !phone.agent_id).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-cyber-border bg-cyber-card">
        <CardHeader>
          <CardTitle className="text-cyber-white">SIP Number Import + Prompt Routing</CardTitle>
          <CardDescription>
            Import Twilio/Telnyx/Plivo/Bandwidth/OpenPhone/SIP numbers in bulk, assign default agents, and connect each line to n8n workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <select
              value={sipDefaultProvider}
              onChange={(event) => setSipDefaultProvider(event.target.value as PhoneProvider)}
              className="rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
            >
              {SUPPORTED_PHONE_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {PHONE_PROVIDER_LABELS[provider]}
                </option>
              ))}
            </select>
            <select
              value={sipDefaultAgentId}
              onChange={(event) => setSipDefaultAgentId(event.target.value)}
              className="rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
            >
              <option value="">No default assignee</option>
              {liveKitAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            <select
              value={sipAutomationAgentId}
              onChange={(event) => setSipAutomationAgentId(event.target.value)}
              className="rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
            >
              <option value="">Automation agent (required)</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Input
              value={sipN8nBaseUrl}
              onChange={(event) => setSipN8nBaseUrl(event.target.value)}
              className="border-cyber-border bg-cyber-black text-cyber-white"
              placeholder="Optional n8n base URL"
            />
            <Input
              type="password"
              value={sipN8nApiKey}
              onChange={(event) => setSipN8nApiKey(event.target.value)}
              className="border-cyber-border bg-cyber-black text-cyber-white"
              placeholder="Optional n8n API key"
            />
            <Input
              type="password"
              value={sipAutomationSecret}
              onChange={(event) => setSipAutomationSecret(event.target.value)}
              className="border-cyber-border bg-cyber-black text-cyber-white"
              placeholder="Optional AGENT_AUTOMATION_SECRET"
            />
          </div>

          <div className="rounded-lg border border-cyber-border bg-cyber-dark/40 p-3">
            <p className="text-xs text-cyber-gray">
              CSV format per row: <span className="font-mono">phone_number,provider,label,prompt,workflow_name,workflow_trigger_url,agent_id</span>
            </p>
            <p className="mt-1 text-[11px] text-cyber-gray">
              Example: <span className="font-mono">+15550001111,twilio,Sales Line,Qualify inbound leads,Sales Intake,https://n8n.your-domain.com/webhook/sales-intake,</span>
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-md border border-cyber-border px-3 py-1.5 text-xs text-cyber-gray hover:text-cyber-white">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Load SIP CSV/TXT
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={handleSipFileUpload}
                />
              </label>
              {sipBulkFileName && <span className="text-[11px] text-cyber-gray">Loaded: {sipBulkFileName}</span>}
            </div>
            <textarea
              value={sipBulkInput}
              onChange={(event) => setSipBulkInput(event.target.value)}
              rows={6}
              className="w-full resize-none rounded-md border border-cyber-border bg-cyber-black px-3 py-2 font-mono text-xs text-cyber-white"
              placeholder="Paste SIP import rows here..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={parseSipImport}
              disabled={sipParseBusy}
              variant="outline"
              className="border-cyber-border text-cyber-gray hover:text-cyber-white"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${sipParseBusy ? 'animate-spin' : ''}`} />
              Parse SIP Import
            </Button>
            <Button
              onClick={() => void runSipImport()}
              disabled={sipImporting || sipImportPreview.length === 0}
              className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
            >
              <Upload className="mr-2 h-4 w-4" />
              {sipImporting ? 'Importing...' : `Import ${sipImportPreview.length} SIP Lines`}
            </Button>
          </div>

          {(sipImportPreview.length > 0 || sipImportWarnings.length > 0) && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-cyber-border bg-cyber-black p-2">
                {sipImportPreview.map((entry) => (
                  <div key={`${entry.phone_number}-${entry.label}`} className="rounded border border-cyber-border/60 bg-cyber-dark p-2">
                    <p className="font-mono text-xs text-cyber-white">{entry.phone_number}</p>
                    <p className="text-[10px] text-cyber-gray">
                      {entry.provider} • {entry.label || 'No label'} • {entry.workflow_name || 'No workflow name'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2">
                {sipImportWarnings.length === 0 && <p className="text-xs text-cyber-green">No warnings.</p>}
                {sipImportWarnings.map((warning, index) => (
                  <p key={`${warning}-${index}`} className="text-xs text-yellow-300">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader>
            <CardTitle className="text-cyber-white">Create LiveKit Agent</CardTitle>
            <CardDescription>Create agent + phone line in one action.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createLiveKitAgent} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="agent-name" className="text-cyber-white">
                    Agent Name
                  </Label>
                  <Input
                    id="agent-name"
                    value={agentForm.agentName}
                    onChange={(event) => setAgentForm((current) => ({ ...current, agentName: event.target.value }))}
                    className="border-cyber-border bg-cyber-black text-cyber-white"
                    placeholder="Phone Ops Alpha"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-role" className="text-cyber-white">
                    Role
                  </Label>
                  <Input
                    id="agent-role"
                    value={agentForm.role}
                    onChange={(event) => setAgentForm((current) => ({ ...current, role: event.target.value }))}
                    className="border-cyber-border bg-cyber-black text-cyber-white"
                    placeholder="phone-agent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-model" className="text-cyber-white">
                    Model
                  </Label>
                  <Input
                    id="agent-model"
                    value={agentForm.model}
                    onChange={(event) => setAgentForm((current) => ({ ...current, model: event.target.value }))}
                    className="border-cyber-border bg-cyber-black text-cyber-white"
                    placeholder="gpt-4o-mini"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-emoji" className="text-cyber-white">
                    Emoji
                  </Label>
                  <Input
                    id="agent-emoji"
                    value={agentForm.emoji}
                    onChange={(event) => setAgentForm((current) => ({ ...current, emoji: event.target.value }))}
                    className="border-cyber-border bg-cyber-black text-cyber-white"
                    placeholder="🎧"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-cyber-border bg-cyber-dark/40 p-3 space-y-3">
                <label className="flex items-center justify-between text-sm text-cyber-white">
                  Provision Phone Line
                  <input
                    type="checkbox"
                    checked={agentForm.createPhoneLine}
                    onChange={(event) => setAgentForm((current) => ({ ...current, createPhoneLine: event.target.checked }))}
                    className="h-4 w-4 rounded border-cyber-border bg-cyber-black"
                  />
                </label>

                {agentForm.createPhoneLine && (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Input
                        value={agentForm.phoneNumber}
                        onChange={(event) => setAgentForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                        className="border-cyber-border bg-cyber-black text-cyber-white"
                        placeholder="+1 555 123 4567"
                      />
                      <Input
                        value={agentForm.phoneLabel}
                        onChange={(event) => setAgentForm((current) => ({ ...current, phoneLabel: event.target.value }))}
                        className="border-cyber-border bg-cyber-black text-cyber-white"
                        placeholder="Sales Inbound"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <select
                        value={agentForm.provider}
                        onChange={(event) =>
                          setAgentForm((current) => ({ ...current, provider: event.target.value as PhoneProvider }))
                        }
                        className="w-full rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
                      >
                        {SUPPORTED_PHONE_PROVIDERS.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider === 'voip_sip'
                              ? `${PHONE_PROVIDER_LABELS[provider]} (LiveKit bridge)`
                              : PHONE_PROVIDER_LABELS[provider]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={agentForm.routingAction}
                        onChange={(event) => setAgentForm((current) => ({ ...current, routingAction: event.target.value }))}
                        className="w-full rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
                      >
                        <option value="ai_answer">AI Answer</option>
                        <option value="forward">Forward</option>
                        <option value="voicemail">Voicemail</option>
                        <option value="sms_auto">SMS Auto Reply</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-cyber-white">Capabilities</Label>
                      {['voice', 'sms', 'mms'].map((capability) => {
                        const enabled = agentForm.capabilities.includes(capability)
                        const locked = capability === 'voice'
                        return (
                          <button
                            key={capability}
                            type="button"
                            disabled={locked}
                            onClick={() => toggleCapability(capability)}
                            className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                              enabled
                                ? 'border-cyber-green/40 bg-cyber-green/20 text-cyber-green'
                                : 'border-cyber-border bg-cyber-black text-cyber-gray'
                            } ${locked ? 'cursor-not-allowed opacity-80' : ''}`}
                          >
                            {capability.toUpperCase()} {locked ? '(required)' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={creatingAgent}
                  className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {creatingAgent ? 'Creating...' : 'Create LiveKit Agent'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAgentForm(DEFAULT_AGENT_FORM)}
                  className="text-cyber-gray hover:text-cyber-white"
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader>
            <CardTitle className="text-cyber-white">LiveKit Token Studio</CardTitle>
            <CardDescription>Generate room tokens from `livekit-token` function.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="phone-ops-room"
              />
              <Input
                value={participantName}
                onChange={(event) => setParticipantName(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="Operator"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => void generateToken()}
                disabled={generatingToken}
                className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
              >
                <Server className="mr-2 h-4 w-4" />
                {generatingToken ? 'Generating...' : 'Generate Token'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setTokenResult(null)
                  setRoomName('phone-ops-room')
                  setParticipantName('Operator')
                }}
                className="text-cyber-gray hover:text-cyber-white"
              >
                Clear
              </Button>
            </div>

            {!tokenResult && (
              <div className="rounded-lg border border-dashed border-cyber-border bg-cyber-dark/40 p-5 text-center text-xs text-cyber-gray">
                Generate a token to validate your LiveKit backend function.
              </div>
            )}

            {tokenResult && (
              <div className="space-y-3 rounded-lg border border-cyber-green/30 bg-cyber-green/5 p-3">
                <div className="flex items-center gap-2 text-cyber-green">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-sm font-medium">Token generated successfully</p>
                </div>

                <div className="rounded-md border border-cyber-border bg-cyber-black p-2">
                  <p className="text-[11px] text-cyber-gray">LiveKit URL</p>
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="break-all font-mono text-xs text-cyber-white">{tokenResult.url}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-cyber-gray hover:text-cyber-white"
                      onClick={() => void copyValue(tokenResult.url, 'LiveKit URL')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border border-cyber-border bg-cyber-black p-2">
                  <p className="text-[11px] text-cyber-gray">Token</p>
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="break-all font-mono text-xs text-cyber-white">{tokenResult.token}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-cyber-gray hover:text-cyber-white"
                      onClick={() => void copyValue(tokenResult.token, 'Token')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader>
            <CardTitle className="text-cyber-white">Voice Synthesis Studio (TTS + LiveKit)</CardTitle>
            <CardDescription>
              Bind a server-side TTS provider to an agent, then generate preview audio that can be used in voice flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              value={ttsAgentId}
              onChange={(event) => setTtsAgentId(event.target.value)}
              className="w-full rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
            >
              <option value="">Select LiveKit agent</option>
              {liveKitAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-1 gap-2">
              <Input
                value={ttsProvider}
                onChange={(event) => setTtsProvider(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="Provider (openai / elevenlabs / custom)"
              />
              <Input
                value={ttsModel}
                onChange={(event) => setTtsModel(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="Model (e.g. gpt-4o-mini-tts)"
              />
              <Input
                value={ttsVoice}
                onChange={(event) => setTtsVoice(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="Voice (e.g. alloy)"
              />
              <Input
                value={ttsEndpoint}
                onChange={(event) => setTtsEndpoint(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="Optional custom endpoint"
              />
              <Input
                type="password"
                value={ttsApiKey}
                onChange={(event) => setTtsApiKey(event.target.value)}
                className="border-cyber-border bg-cyber-black text-cyber-white"
                placeholder="Optional API key override"
              />
              <textarea
                value={ttsText}
                onChange={(event) => setTtsText(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
                placeholder="Test phrase for your voice agents..."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void saveTtsConfigToAgent()}
                className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
              >
                <Save className="mr-2 h-4 w-4" />
                Save To Agent
              </Button>
              <Button
                onClick={() => void synthesizeTtsPreview()}
                disabled={ttsSynthesizing}
                className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
              >
                <AudioLines className="mr-2 h-4 w-4" />
                {ttsSynthesizing ? 'Synthesizing...' : 'Generate TTS Preview'}
              </Button>
            </div>

            {ttsPreview && (
              <div className="space-y-2 rounded-lg border border-cyber-green/30 bg-cyber-green/5 p-3">
                <p className="text-xs text-cyber-gray">
                  Preview ready: <span className="text-cyber-white">{ttsPreview.provider}</span> /{' '}
                  <span className="text-cyber-white">{ttsPreview.voice}</span>
                </p>
                <audio controls src={ttsPreview.dataUrl} className="h-8 w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader>
            <CardTitle className="text-cyber-white">LiveKit Agent Fleet</CardTitle>
            <CardDescription>Launch voice consoles and monitor assigned lines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {liveKitAgents.map((agent) => {
              const assignedPhones = phoneByAgentId.get(agent.id) || []
              return (
                <div key={agent.id} className="rounded-lg border border-cyber-border bg-cyber-dark/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-cyber-green" />
                      <div>
                        <p className="text-sm font-medium text-cyber-white">{agent.name}</p>
                        <p className="text-[11px] text-cyber-gray">{agent.role || 'voice-agent'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          agent.status === 'active'
                            ? 'bg-cyber-green/20 text-cyber-green'
                            : 'bg-cyber-gray/20 text-cyber-gray'
                        }
                      >
                        {agent.status}
                      </Badge>
                      <Button
                        size="sm"
                        className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
                        onClick={() => setVoiceAgent({ id: agent.id, name: agent.name })}
                      >
                        <Headphones className="mr-1.5 h-3.5 w-3.5" />
                        Open Console
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {assignedPhones.length > 0 ? (
                      assignedPhones.map((phone) => (
                        <Badge key={phone.id} className="bg-cyber-black text-cyber-gray border border-cyber-border">
                          <Phone className="mr-1 h-3 w-3" />
                          {phone.phone_number}
                        </Badge>
                      ))
                    ) : (
                      <Badge className="bg-yellow-500/15 text-yellow-300">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        No line assigned
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}

            {liveKitAgents.length === 0 && (
              <div className="rounded-lg border border-dashed border-cyber-border bg-cyber-dark/30 p-6 text-center">
                <p className="text-sm text-cyber-gray">No LiveKit agents yet.</p>
                <p className="mt-1 text-xs text-cyber-gray">Create one above to start voice sessions.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyber-border bg-cyber-card">
          <CardHeader>
            <CardTitle className="text-cyber-white">Voice Line Routing</CardTitle>
            <CardDescription>Assign voice lines to LiveKit agents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {voicePhones.map((phone) => {
              const routing = asRecord(phone.routing_config) as PhoneRoutingConfig
              const linkedWorkflow = workflows.find((workflow) => workflow.id === asString(routing.n8n_workflow_id))
              const promptValue = asString(routing.prompt)
              return (
                <div key={phone.id} className="rounded-lg border border-cyber-border bg-cyber-dark/40 p-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm text-cyber-white">{phone.phone_number}</p>
                        {phone.label && <Badge className="bg-cyber-green/20 text-cyber-green">{phone.label}</Badge>}
                      </div>
                      <p className="mt-1 text-[11px] text-cyber-gray">
                        {phone.provider} • route: {asString(routing.action, 'ai_answer')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-cyber-gray" />
                      <select
                        value={phone.agent_id || ''}
                        onChange={(event) => void assignPhoneToAgent(phone.id, event.target.value)}
                        disabled={assigningPhoneId === phone.id}
                        className="rounded-md border border-cyber-border bg-cyber-black px-2 py-1.5 text-xs text-cyber-white"
                      >
                        <option value="">Unassigned</option>
                        {liveKitAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                      <Badge
                        className={
                          phone.status === 'active'
                            ? 'bg-cyber-green/20 text-cyber-green'
                            : 'bg-red-500/20 text-red-400'
                        }
                      >
                        {phone.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
                    <select
                      value={asString(routing.n8n_workflow_id)}
                      onChange={(event) => void linkWorkflowToPhone(phone, event.target.value)}
                      className="rounded-md border border-cyber-border bg-cyber-black px-2 py-1.5 text-xs text-cyber-white"
                    >
                      <option value="">No workflow linked</option>
                      {workflows
                        .filter((workflow) => workflow.is_active)
                        .map((workflow) => (
                          <option key={workflow.id} value={workflow.id}>
                            {workflow.name}
                          </option>
                        ))}
                    </select>
                    <Badge className="bg-cyber-black text-cyan-300 border border-cyber-border text-[10px]">
                      {linkedWorkflow ? 'Workflow linked' : 'No workflow'}
                    </Badge>
                  </div>

                  {asString(routing.n8n_trigger_url) && (
                    <p className="mt-1 break-all font-mono text-[10px] text-cyber-gray">{asString(routing.n8n_trigger_url)}</p>
                  )}

                  <div className="mt-3 rounded-md border border-cyber-border bg-cyber-black p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-cyber-gray">Per-number prompt</p>
                      {editingPromptId !== phone.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                          onClick={() => startPromptEdit(phone)}
                        >
                          Edit
                        </Button>
                      )}
                    </div>

                    {editingPromptId === phone.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editingPromptValue}
                          onChange={(event) => setEditingPromptValue(event.target.value)}
                          rows={3}
                          className="w-full resize-none rounded border border-cyber-border bg-cyber-dark px-2 py-1 text-xs text-cyber-white"
                          placeholder="Prompt for this number..."
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 bg-cyber-green text-cyber-black hover:bg-cyber-green/80"
                            onClick={() => void savePromptEdit(phone)}
                          >
                            <Save className="mr-1 h-3.5 w-3.5" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 border border-cyber-border text-cyber-gray hover:text-cyber-white"
                            onClick={() => {
                              setEditingPromptId(null)
                              setEditingPromptValue('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-cyber-gray">
                        {promptValue || 'No prompt configured for this number.'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {voicePhones.length === 0 && (
              <div className="rounded-lg border border-dashed border-cyber-border bg-cyber-dark/30 p-6 text-center">
                <p className="text-sm text-cyber-gray">No voice phone lines found.</p>
                <p className="mt-1 text-xs text-cyber-gray">Provision one when creating an agent.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {voiceAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative h-[620px] w-full max-w-3xl overflow-hidden rounded-xl border border-cyber-green/30 bg-cyber-darker shadow-2xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 text-cyber-gray hover:text-cyber-white"
              onClick={() => setVoiceAgent(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            <VoiceAgentPanel
              agentId={voiceAgent.id}
              agentName={voiceAgent.name}
              onClose={() => setVoiceAgent(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
