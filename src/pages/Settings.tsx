import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Settings as SettingsIcon, Key, Bell, Database, Brain, Globe, Zap, Search, RefreshCw, Shield, Rocket } from 'lucide-react'
import { UserButton, useUser } from '@insforge/react'
import { useToast } from '../components/ui/use-toast'
import { useAgentStore } from '../stores/agent-store'
import {
  invokeAgentWebSearch,
  invokeAgentDiscoverProviderUpdates,
  invokeAgentCreateDaoDeploymentTask,
  type AgentAutomationAuth,
  type AgentProviderDiscoveryResponse,
  type AgentWebSearchResponse,
  type AgentDaoTaskResponse,
} from '../lib/agent-automation'

const LLM_MODELS = [
  {
    group: 'InsForge AI (Built-in)',
    models: [
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
      { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
      { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek' },
      { id: 'google/gemini-3-pro-image-preview', name: 'Gemini 3 Pro', provider: 'Google' },
      { id: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast', provider: 'xAI' },
    ],
  },
  {
    group: 'OpenRouter Aggregated',
    models: [
      { id: 'openrouter/openai/gpt-4o', name: 'GPT-4o via OpenRouter', provider: 'OpenRouter' },
      { id: 'openrouter/anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet via OpenRouter', provider: 'OpenRouter' },
      { id: 'openrouter/google/gemini-2.5-pro', name: 'Gemini 2.5 Pro via OpenRouter', provider: 'OpenRouter' },
      { id: 'openrouter/meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B via OpenRouter', provider: 'OpenRouter' },
      { id: 'openrouter/deepseek/deepseek-r1', name: 'DeepSeek R1 via OpenRouter', provider: 'OpenRouter' },
    ],
  },
  {
    group: 'Hugging Face Inference',
    models: [
      { id: 'hf/meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', provider: 'Hugging Face' },
      { id: 'hf/Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', provider: 'Hugging Face' },
      { id: 'hf/mistralai/Mistral-Large-Instruct', name: 'Mistral Large', provider: 'Hugging Face' },
    ],
  },
  {
    group: 'Direct Providers',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
      { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
      { id: 'grok-2', name: 'Grok 2', provider: 'xAI' },
    ],
  },
]

export default function Settings() {
  const { user } = useUser()
  const { toast } = useToast()
  const { agents, fetchAgents } = useAgentStore()

  const [defaultModel, setDefaultModel] = useState('openai/gpt-4o-mini')
  const [openclawUrl, setOpenclawUrl] = useState('')
  const [telegramToken, setTelegramToken] = useState('')

  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [openrouterKey, setOpenrouterKey] = useState('')
  const [huggingfaceToken, setHuggingfaceToken] = useState('')
  const [braveApiKey, setBraveApiKey] = useState('')

  const [proxyUrl, setProxyUrl] = useState('')
  const [proxyKey, setProxyKey] = useState('')

  const [autoEnhanceEnabled, setAutoEnhanceEnabled] = useState(true)
  const [autoEnhanceInterval, setAutoEnhanceInterval] = useState(30)

  const [automationAgentId, setAutomationAgentId] = useState('')
  const [automationAgentApiKey, setAutomationAgentApiKey] = useState('')
  const [automationSecret, setAutomationSecret] = useState('')

  const [searchQuery, setSearchQuery] = useState('latest SIP trunk providers with fast porting support')
  const [daoName, setDaoName] = useState('Empire Business DAO')
  const [daoProvider, setDaoProvider] = useState('aragon')
  const [daoChain, setDaoChain] = useState('ethereum')
  const [daoToken, setDaoToken] = useState('EBD')

  const [searchResult, setSearchResult] = useState<AgentWebSearchResponse | null>(null)
  const [providerResult, setProviderResult] = useState<AgentProviderDiscoveryResponse | null>(null)
  const [daoResult, setDaoResult] = useState<AgentDaoTaskResponse | null>(null)

  const [runningSearch, setRunningSearch] = useState(false)
  const [runningDiscovery, setRunningDiscovery] = useState(false)
  const [runningDaoTask, setRunningDaoTask] = useState(false)

  useEffect(() => {
    setDefaultModel(localStorage.getItem('agentforge-default-model') || 'openai/gpt-4o-mini')
    setOpenclawUrl(localStorage.getItem('agentforge-openclaw-url') || '')
    setTelegramToken(localStorage.getItem('agentforge-telegram-token') || '')

    setOpenaiKey(localStorage.getItem('agentforge-openai-key') || '')
    setAnthropicKey(localStorage.getItem('agentforge-anthropic-key') || '')
    setGoogleKey(localStorage.getItem('agentforge-google-key') || '')
    setOpenrouterKey(localStorage.getItem('agentforge-openrouter-key') || '')
    setHuggingfaceToken(localStorage.getItem('agentforge-huggingface-token') || '')
    setBraveApiKey(localStorage.getItem('agentforge-brave-key') || '')

    setProxyUrl(localStorage.getItem('agentforge-proxy-url') || '')
    setProxyKey(localStorage.getItem('agentforge-proxy-key') || '')

    setAutoEnhanceEnabled((localStorage.getItem('agentforge-auto-enhance-enabled') || 'true') === 'true')
    setAutoEnhanceInterval(Number(localStorage.getItem('agentforge-auto-enhance-interval') || 30))

    setAutomationSecret(localStorage.getItem('agentforge-automation-secret') || '')
    void fetchAgents()
  }, [])

  useEffect(() => {
    if (!automationAgentId && agents.length > 0) {
      setAutomationAgentId(agents[0].id)
      setAutomationAgentApiKey(agents[0].api_key || '')
      return
    }

    if (!automationAgentId) return
    const selectedAgent = agents.find((agent) => agent.id === automationAgentId)
    if (selectedAgent?.api_key) {
      setAutomationAgentApiKey(selectedAgent.api_key)
    }
  }, [agents, automationAgentId])

  const saveSettings = () => {
    localStorage.setItem('agentforge-default-model', defaultModel)
    localStorage.setItem('agentforge-openclaw-url', openclawUrl)
    localStorage.setItem('agentforge-telegram-token', telegramToken)

    localStorage.setItem('agentforge-openai-key', openaiKey)
    localStorage.setItem('agentforge-anthropic-key', anthropicKey)
    localStorage.setItem('agentforge-google-key', googleKey)
    localStorage.setItem('agentforge-openrouter-key', openrouterKey)
    localStorage.setItem('agentforge-huggingface-token', huggingfaceToken)
    localStorage.setItem('agentforge-brave-key', braveApiKey)

    localStorage.setItem('agentforge-proxy-url', proxyUrl)
    localStorage.setItem('agentforge-proxy-key', proxyKey)

    localStorage.setItem('agentforge-auto-enhance-enabled', String(autoEnhanceEnabled))
    localStorage.setItem('agentforge-auto-enhance-interval', String(autoEnhanceInterval))
    localStorage.setItem('agentforge-automation-secret', automationSecret)

    toast({ title: 'Settings saved', description: 'Provider keys and automation profile updated.' })
  }

  const resolveAutomationAuth = (): AgentAutomationAuth | null => {
    if (!automationAgentId || !automationAgentApiKey) {
      toast({
        title: 'Automation auth missing',
        description: 'Select an automation agent and API key first.',
        variant: 'destructive',
      })
      return null
    }

    return {
      agentId: automationAgentId,
      agentApiKey: automationAgentApiKey,
      automationSecret: automationSecret.trim() || undefined,
    }
  }

  const runBraveSearch = async () => {
    const auth = resolveAutomationAuth()
    if (!auth) return

    setRunningSearch(true)
    try {
      const result = await invokeAgentWebSearch(auth, {
        query: searchQuery,
        count: 8,
        braveApiKey: braveApiKey.trim() || undefined,
      })
      setSearchResult(result)
      toast({ title: 'Brave search complete', description: `${result.count} results returned.` })
    } catch (error: any) {
      toast({
        title: 'Search failed',
        description: error.message || 'Unable to run Brave search via automation bridge.',
        variant: 'destructive',
      })
    } finally {
      setRunningSearch(false)
    }
  }

  const runProviderDiscovery = async () => {
    const auth = resolveAutomationAuth()
    if (!auth) return

    setRunningDiscovery(true)
    try {
      const result = await invokeAgentDiscoverProviderUpdates(auth, {
        providers: ['openrouter', 'huggingface', 'gemini', 'sip'],
        postForumUpdate: true,
        geminiApiKey: googleKey.trim() || undefined,
        huggingFaceToken: huggingfaceToken.trim() || undefined,
        sipProviders: ['twilio', 'telnyx', 'plivo', 'bandwidth', 'vonage', 'signalwire', 'openphone', 'voip_sip'],
      })
      setProviderResult(result)
      toast({
        title: 'Discovery completed',
        description: `${result.summary.successful}/${result.summary.total} provider checks succeeded.`,
      })
    } catch (error: any) {
      toast({
        title: 'Discovery failed',
        description: error.message || 'Could not check providers.',
        variant: 'destructive',
      })
    } finally {
      setRunningDiscovery(false)
    }
  }

  const runDaoTask = async () => {
    const auth = resolveAutomationAuth()
    if (!auth) return

    if (!daoName.trim()) {
      toast({ title: 'DAO name required', description: 'Set a DAO name first.', variant: 'destructive' })
      return
    }

    setRunningDaoTask(true)
    try {
      const result = await invokeAgentCreateDaoDeploymentTask(auth, {
        daoName: daoName.trim(),
        daoProvider,
        chain: daoChain,
        tokenSymbol: daoToken,
        objective: 'Launch governance-ready DAO with treasury controls and automation hooks.',
        createWorkflow: false,
      })
      setDaoResult(result)
      toast({ title: 'DAO task created', description: `Task posted for ${result.task.daoName}.` })
    } catch (error: any) {
      toast({
        title: 'DAO task failed',
        description: error.message || 'Could not create DAO deployment task.',
        variant: 'destructive',
      })
    } finally {
      setRunningDaoTask(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Settings</h2>
          <p className="text-cyber-gray text-sm">Master config for models, providers, agents, and backend automation.</p>
        </div>
        <button
          onClick={saveSettings}
          className="px-4 py-2 rounded-lg bg-cyber-green text-cyber-black font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Save All Settings
        </button>
      </div>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyber-green" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <UserButton />
            <div>
              <p className="text-sm text-cyber-white">{user?.email || 'Not signed in'}</p>
              <p className="text-xs text-cyber-gray">Managed by InsForge Auth</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">Control Centers</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Link to="/mcp-control" className="rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2 text-sm text-cyber-white hover:border-cyber-green/40">
            MCP Control
            <p className="text-[11px] text-cyber-gray">Deploy MCP stack to all agents</p>
          </Link>
          <Link to="/commerce" className="rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2 text-sm text-cyber-white hover:border-cyber-green/40">
            Commerce Ops
            <p className="text-[11px] text-cyber-gray">Shopify dropshipping automation</p>
          </Link>
          <Link to="/openclaw-gateway" className="rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2 text-sm text-cyber-white hover:border-cyber-green/40">
            OpenClaw Gateway
            <p className="text-[11px] text-cyber-gray">Hostinger SSH/API onboarding</p>
          </Link>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-cyber-green" />
            Default LLM Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-cyber-gray">
            New agents inherit this default model. OpenRouter + Hugging Face options are included for broader model coverage.
          </p>
          <select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
            aria-label="Default LLM model"
          >
            {LLM_MODELS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.provider})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Key className="h-4 w-4 text-cyber-green" />
            Provider Keys + Proxy
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-cyber-gray block mb-1">OpenAI API Key</label>
            <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white" />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">Anthropic API Key</label>
            <input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white" />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">Google/Gemini API Key</label>
            <input type="password" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} placeholder="AIza..." className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white" />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">OpenRouter API Key</label>
            <input type="password" value={openrouterKey} onChange={(e) => setOpenrouterKey(e.target.value)} placeholder="sk-or-..." className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white" />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">Hugging Face Token</label>
            <input type="password" value={huggingfaceToken} onChange={(e) => setHuggingfaceToken(e.target.value)} placeholder="hf_..." className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white" />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">Brave Search API Key</label>
            <input type="password" value={braveApiKey} onChange={(e) => setBraveApiKey(e.target.value)} placeholder="BSA..." className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white" />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">Proxy URL</label>
            <input type="text" value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} placeholder="https://proxy.your-domain.com" className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white" />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">Proxy Key</label>
            <input type="password" value={proxyKey} onChange={(e) => setProxyKey(e.target.value)} placeholder="proxy_..." className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-cyber-green" />
            Integration Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-cyber-gray block mb-1">OpenClaw API URL</label>
            <input
              type="text"
              value={openclawUrl}
              onChange={(e) => setOpenclawUrl(e.target.value)}
              placeholder="https://api.openclaw.io/v1"
              className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white"
            />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">Telegram Bot Token</label>
            <input
              type="password"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white"
            />
          </div>
          <div>
            <label className="text-xs text-cyber-gray block mb-1">Auto-Enhancement Interval (minutes)</label>
            <input
              type="number"
              min={5}
              value={autoEnhanceInterval}
              onChange={(e) => setAutoEnhanceInterval(Math.max(5, Number(e.target.value || 30)))}
              placeholder="30"
              className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white"
            />
          </div>
          <label className="flex items-center justify-between rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2 text-sm text-cyber-white">
            Auto discovery + enhancement
            <input type="checkbox" checked={autoEnhanceEnabled} onChange={(e) => setAutoEnhanceEnabled(e.target.checked)} className="h-4 w-4" />
          </label>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyber-green" />
            Agent Automation Console
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={automationAgentId}
              onChange={(e) => setAutomationAgentId(e.target.value)}
              aria-label="Automation agent"
              className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white"
            >
              <option value="">Select automation agent...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.emoji || '🤖'} {agent.name}
                </option>
              ))}
            </select>
            <input
              type="password"
              value={automationAgentApiKey}
              onChange={(e) => setAutomationAgentApiKey(e.target.value)}
              placeholder="Agent API key"
              className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white"
            />
            <input
              type="password"
              value={automationSecret}
              onChange={(e) => setAutomationSecret(e.target.value)}
              placeholder="AGENT_AUTOMATION_SECRET (optional)"
              className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs text-cyber-gray">Brave Web Search Test</label>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white"
                placeholder="search query"
              />
              <button
                onClick={runBraveSearch}
                disabled={runningSearch}
                className="px-3 py-2 rounded-lg bg-cyber-green text-cyber-black text-sm font-semibold disabled:opacity-50"
              >
                <Search className="inline h-4 w-4 mr-1" />
                {runningSearch ? 'Searching...' : 'Run Brave Search'}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-cyber-gray">Provider/Model Discovery</label>
              <button
                onClick={runProviderDiscovery}
                disabled={runningDiscovery}
                className="px-3 py-2 rounded-lg bg-cyan-500 text-cyan-950 text-sm font-semibold disabled:opacity-50"
              >
                <RefreshCw className="inline h-4 w-4 mr-1" />
                {runningDiscovery ? 'Checking...' : 'Run Discovery Sweep'}
              </button>

              <div className="grid grid-cols-3 gap-2">
                <input
                  value={daoName}
                  onChange={(e) => setDaoName(e.target.value)}
                  placeholder="DAO name"
                  className="bg-cyber-dark border border-cyber-border rounded-lg px-2 py-2 text-xs text-cyber-white"
                />
                <input
                  value={daoChain}
                  onChange={(e) => setDaoChain(e.target.value)}
                  placeholder="Chain"
                  className="bg-cyber-dark border border-cyber-border rounded-lg px-2 py-2 text-xs text-cyber-white"
                />
                <input
                  value={daoToken}
                  onChange={(e) => setDaoToken(e.target.value)}
                  placeholder="Token"
                  className="bg-cyber-dark border border-cyber-border rounded-lg px-2 py-2 text-xs text-cyber-white"
                />
              </div>
              <select
                value={daoProvider}
                onChange={(e) => setDaoProvider(e.target.value)}
                aria-label="DAO provider"
                className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-xs text-cyber-white"
              >
                <option value="aragon">Aragon</option>
                <option value="olympus">Olympus-style governance</option>
                <option value="safe">Safe + Snapshot stack</option>
                <option value="custom">Custom governance</option>
              </select>
              <button
                onClick={runDaoTask}
                disabled={runningDaoTask}
                className="px-3 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                <Rocket className="inline h-4 w-4 mr-1" />
                {runningDaoTask ? 'Creating...' : 'Create DAO Task'}
              </button>
            </div>
          </div>

          {(searchResult || providerResult || daoResult) && (
            <div className="rounded-lg border border-cyber-border bg-cyber-dark p-3 space-y-2">
              {searchResult && (
                <div>
                  <p className="text-xs text-cyber-gray">Brave Search Results</p>
                  <div className="space-y-1 mt-1">
                    {searchResult.results.slice(0, 5).map((entry, index) => (
                      <p key={`${entry.url}-${index}`} className="text-xs text-cyber-white truncate">
                        {index + 1}. {entry.title || entry.url}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {providerResult && (
                <div>
                  <p className="text-xs text-cyber-gray">Provider Discovery Summary</p>
                  <p className="text-xs text-cyber-white mt-1">
                    {providerResult.summary.successful}/{providerResult.summary.total} checks successful
                  </p>
                </div>
              )}

              {daoResult && (
                <div>
                  <p className="text-xs text-cyber-gray">DAO Task</p>
                  <p className="text-xs text-cyber-white mt-1">
                    {daoResult.task.daoName} • {daoResult.task.provider} • {daoResult.task.chain}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-cyber-green" />
            Backend
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-cyber-gray">Platform</span>
            <span className="text-cyber-white">InsForge</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-cyber-gray">API URL</span>
            <span className="text-cyber-white font-mono text-2xs">{import.meta.env.VITE_INSFORGE_BASE_URL}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-cyber-gray">Default Search</span>
            <span className="text-cyber-white">Brave API</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-cyber-gray">Agent Defaults</span>
            <span className="text-cyber-green">MCP + Skills + Auto-Enhance Enabled</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
