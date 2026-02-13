import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Zap, RefreshCw, Download, Sparkles, Radar, Blocks, ShoppingBag, Link2 } from 'lucide-react'
import { useAgentStore } from '../../stores/agent-store'
import { useOpenClawStore } from '../../stores/openclaw-store'
import { useBusinessStore } from '../../stores/business-store'
import SpawnAgentModal from '../modals/SpawnAgentModal'

export default function QuickActions() {
  const navigate = useNavigate()
  const { fetchAgents, agents } = useAgentStore()
  const { fetchSessions, sessions } = useOpenClawStore()
  const { fetchBusinesses, businesses } = useBusinessStore()
  const [showSpawn, setShowSpawn] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefreshAll = async () => {
    setRefreshing(true)
    await Promise.all([fetchAgents(), fetchSessions(), fetchBusinesses()])
    setRefreshing(false)
  }

  const handleExportData = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      agents,
      sessions,
      businesses,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `brotherhood-empire-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const actions = [
    { 
      label: 'Spawn Agent', 
      icon: Sparkles, 
      onClick: () => setShowSpawn(true),
      highlight: true,
    },
    { 
      label: refreshing ? 'Refreshing...' : 'Refresh All', 
      icon: RefreshCw, 
      onClick: handleRefreshAll,
      spinning: refreshing,
    },
    { 
      label: 'Export Data', 
      icon: Download, 
      onClick: handleExportData,
    },
    {
      label: 'Empire Control',
      icon: Radar,
      onClick: () => navigate('/'),
    },
    {
      label: 'MCP Control',
      icon: Blocks,
      onClick: () => navigate('/mcp-control'),
    },
    {
      label: 'Commerce Ops',
      icon: ShoppingBag,
      onClick: () => navigate('/commerce'),
    },
    {
      label: 'OpenClaw Gateway',
      icon: Link2,
      onClick: () => navigate('/openclaw-gateway'),
    },
  ]

  return (
    <>
      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyber-green" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.map(a => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-cyber-dark border text-sm transition-colors ${
                a.highlight 
                  ? 'border-cyber-green/50 text-cyber-green hover:bg-cyber-green/10' 
                  : 'border-cyber-border text-cyber-gray hover:text-cyber-white hover:border-cyber-green/50'
              }`}
            >
              <a.icon className={`h-4 w-4 ${a.spinning ? 'animate-spin' : ''}`} />
              {a.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <SpawnAgentModal open={showSpawn} onClose={() => setShowSpawn(false)} />
    </>
  )
}
