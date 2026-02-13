import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useToast } from '../components/ui/use-toast'
import { useAgentStore } from '../stores/agent-store'
import { Copy, KeyRound, Link2, Server, Shield, Terminal } from 'lucide-react'

const INSFORGE_BASE_URL = import.meta.env.VITE_INSFORGE_BASE_URL || 'https://ijeed7kh.us-west.insforge.app'
const SELF_REGISTER_ENDPOINT = `${INSFORGE_BASE_URL}/functions/agent-self-register`
const AUTOMATION_ENDPOINT = `${INSFORGE_BASE_URL}/functions/agent-automation-bridge`

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

export default function OpenClawGateway() {
  const { toast } = useToast()
  const { agents, fetchAgents } = useAgentStore()

  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedAgentKey, setSelectedAgentKey] = useState('')
  const [selfRegisterSecret, setSelfRegisterSecret] = useState('')
  const [automationSecret, setAutomationSecret] = useState('')
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [hostingerHost, setHostingerHost] = useState('root@your-hostinger-vps')

  useEffect(() => {
    void fetchAgents()
    setSelfRegisterSecret(localStorage.getItem('agentforge-self-register-secret') || '')
    const savedAutomationSecret = localStorage.getItem('agentforge-automation-secret') || ''
    setAutomationSecret(savedAutomationSecret)
    setTelegramBotToken(localStorage.getItem('agentforge-telegram-token') || '')
    setTelegramChatId(localStorage.getItem('agentforge-telegram-chat-id') || '')
  }, [])

  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      const candidate = agents.find((agent) => agent.status === 'active' && agent.api_key) || agents[0]
      setSelectedAgentId(candidate.id)
      setSelectedAgentKey(candidate.api_key || '')
      return
    }

    if (!selectedAgentId) return
    const selected = agents.find((agent) => agent.id === selectedAgentId)
    if (selected?.api_key) setSelectedAgentKey(selected.api_key)
  }, [agents, selectedAgentId])

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || null,
    [agents, selectedAgentId],
  )

  const saveSecrets = () => {
    localStorage.setItem('agentforge-self-register-secret', selfRegisterSecret.trim())
    localStorage.setItem('agentforge-automation-secret', automationSecret.trim())
    localStorage.setItem('agentforge-telegram-token', telegramBotToken.trim())
    localStorage.setItem('agentforge-telegram-chat-id', telegramChatId.trim())
    toast({ title: 'Secrets saved', description: 'Gateway settings stored in browser local storage.' })
  }

  const openClawBootstrapCommand = `curl -fsSL https://raw.githubusercontent.com/whodisturbsmyslumber187-web/agentcontrol/main/scripts/openclaw-bootstrap.sh | \\
  INSFORGE_BASE_URL=${INSFORGE_BASE_URL} \\
  SELF_REGISTER_ENDPOINT=${SELF_REGISTER_ENDPOINT} \\
  AUTOMATION_ENDPOINT=${AUTOMATION_ENDPOINT} \\
  SELF_REGISTER_SECRET=${selfRegisterSecret.trim() || '<self-register-secret>'} \\
  AGENT_AUTOMATION_SECRET=${automationSecret.trim() || '<automation-secret>'} \\
  TELEGRAM_BOT_TOKEN=${telegramBotToken.trim() || '<telegram-bot-token>'} \\
  TELEGRAM_CHAT_ID=${telegramChatId.trim() || '<telegram-chat-id>'} \\
  bash`

  const hostingerSshCommand = `ssh ${hostingerHost} "mkdir -p /opt/agentcontrol && cd /opt/agentcontrol && git clone https://github.com/whodisturbsmyslumber187-web/agentcontrol.git . || true && git pull origin main && npm ci && npm run build"`

  const openClawConfigPayload = JSON.stringify(
    {
      mode: 'api',
      endpoints: {
        selfRegister: SELF_REGISTER_ENDPOINT,
        automation: AUTOMATION_ENDPOINT,
      },
      auth: {
        selfRegisterSecret: selfRegisterSecret || '<self-register-secret>',
        automationSecret: automationSecret || '<automation-secret>',
        agentId: selectedAgent?.id || '<agent-id>',
        agentApiKey: selectedAgentKey || '<agent-api-key>',
      },
      telegram: {
        botToken: telegramBotToken || '<telegram-bot-token>',
        chatId: telegramChatId || '<telegram-chat-id>',
      },
      deployment: {
        hostingerSsh: hostingerHost,
      },
    },
    null,
    2,
  )

  const onCopy = async (value: string, label: string) => {
    try {
      await copyText(value)
      toast({ title: `${label} copied` })
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard copy was blocked.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cyber-white flex items-center gap-2">
          <Link2 className="h-6 w-6 text-cyber-green" />
          OpenClaw Gateway
        </h2>
        <p className="text-sm text-cyber-gray">
          Connect OpenClaw and external agents over API/SSH for Hostinger VPS deployment and Telegram reporting.
        </p>
      </div>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">Gateway Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded border border-cyber-border bg-cyber-dark px-3 py-2">
            <p className="text-[11px] text-cyber-gray">Self Register Endpoint</p>
            <p className="text-xs font-mono break-all text-cyber-white">{SELF_REGISTER_ENDPOINT}</p>
          </div>
          <div className="rounded border border-cyber-border bg-cyber-dark px-3 py-2">
            <p className="text-[11px] text-cyber-gray">Automation Endpoint</p>
            <p className="text-xs font-mono break-all text-cyber-white">{AUTOMATION_ENDPOINT}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyber-green" />
            Secrets + Agent Auth
          </CardTitle>
          <CardDescription>Use one automation agent identity for OpenClaw operations.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Input
            type="password"
            value={selfRegisterSecret}
            onChange={(event) => setSelfRegisterSecret(event.target.value)}
            placeholder="SELF_REGISTER_SECRET"
            className="border-cyber-border bg-cyber-black text-cyber-white"
          />
          <Input
            type="password"
            value={automationSecret}
            onChange={(event) => setAutomationSecret(event.target.value)}
            placeholder="AGENT_AUTOMATION_SECRET"
            className="border-cyber-border bg-cyber-black text-cyber-white"
          />
          <select
            value={selectedAgentId}
            onChange={(event) => setSelectedAgentId(event.target.value)}
            className="rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
          >
            <option value="">Select agent...</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.emoji || '🤖'} {agent.name}
              </option>
            ))}
          </select>
          <Input
            type="password"
            value={selectedAgentKey}
            onChange={(event) => setSelectedAgentKey(event.target.value)}
            placeholder="Selected agent API key"
            className="border-cyber-border bg-cyber-black text-cyber-white lg:col-span-2"
          />
          <Button onClick={saveSecrets} className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80">
            <KeyRound className="mr-2 h-4 w-4" />
            Save Secrets
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Server className="h-4 w-4 text-cyber-green" />
            Hostinger VPS SSH Bootstrap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={hostingerHost}
            onChange={(event) => setHostingerHost(event.target.value)}
            placeholder="root@your-hostinger-vps"
            className="border-cyber-border bg-cyber-black text-cyber-white"
          />
          <pre className="rounded border border-cyber-border bg-cyber-black p-3 text-xs text-cyber-gray overflow-auto">{hostingerSshCommand}</pre>
          <Button variant="outline" onClick={() => void onCopy(hostingerSshCommand, 'SSH command')} className="border-cyber-border text-cyber-gray hover:text-cyber-white">
            <Copy className="mr-2 h-4 w-4" />
            Copy SSH Command
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyber-green" />
            OpenClaw Bootstrap Script
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="rounded border border-cyber-border bg-cyber-black p-3 text-xs text-cyber-gray overflow-auto">{openClawBootstrapCommand}</pre>
          <Button variant="outline" onClick={() => void onCopy(openClawBootstrapCommand, 'Bootstrap command')} className="border-cyber-border text-cyber-gray hover:text-cyber-white">
            <Copy className="mr-2 h-4 w-4" />
            Copy Bootstrap Command
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">OpenClaw Agent Config JSON</CardTitle>
          <CardDescription>Drop this payload into your OpenClaw runtime config and start execution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="rounded border border-cyber-border bg-cyber-black p-3 text-xs text-cyber-gray overflow-auto">{openClawConfigPayload}</pre>
          <Button variant="outline" onClick={() => void onCopy(openClawConfigPayload, 'OpenClaw config')} className="border-cyber-border text-cyber-gray hover:text-cyber-white">
            <Copy className="mr-2 h-4 w-4" />
            Copy OpenClaw Config
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">Telegram Relay</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Input
            type="password"
            value={telegramBotToken}
            onChange={(event) => setTelegramBotToken(event.target.value)}
            placeholder="TELEGRAM_BOT_TOKEN"
            className="border-cyber-border bg-cyber-black text-cyber-white"
          />
          <Input
            value={telegramChatId}
            onChange={(event) => setTelegramChatId(event.target.value)}
            placeholder="TELEGRAM_CHAT_ID"
            className="border-cyber-border bg-cyber-black text-cyber-white"
          />
          <Button onClick={saveSecrets} className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400 lg:col-span-2">
            Save Telegram Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
