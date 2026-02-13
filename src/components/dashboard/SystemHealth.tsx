import { useAgentStore } from '../../stores/agent-store'
import { useOpenClawStore } from '../../stores/openclaw-store'
import { useWebSocket } from '../providers/websocket-provider'
import { Card, CardContent } from '../ui/card'
import { Activity, Cpu, HardDrive, Wifi, WifiOff, Users, Database } from 'lucide-react'

export default function SystemHealth() {
  const { agents } = useAgentStore()
  const { sessions } = useOpenClawStore()
  const { isConnected } = useWebSocket()

  const activeAgents = agents.filter(a => a.status === 'active').length
  const activeSessions = sessions.filter(s => s.active).length
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokenUsage || a.token_usage || 0), 0)

  const metrics = [
    { label: 'Active Agents', value: `${activeAgents}/${agents.length}`, icon: Users, color: activeAgents > 0 ? 'text-cyber-green' : 'text-yellow-500' },
    { label: 'Sessions', value: `${activeSessions}`, icon: Activity, color: activeSessions > 0 ? 'text-cyber-green' : 'text-cyber-gray' },
    { label: 'Total Tokens', value: totalTokens >= 1000 ? `${(totalTokens/1000).toFixed(1)}K` : `${totalTokens}`, icon: Cpu, color: 'text-cyber-green' },
    { label: 'Real-time', value: isConnected ? 'Connected' : 'Offline', icon: isConnected ? Wifi : WifiOff, color: isConnected ? 'text-cyber-green' : 'text-red-400' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map(m => (
        <Card key={m.label} className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-cyber-gray">{m.label}</p>
                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              </div>
              <m.icon className={`h-6 w-6 ${m.color} opacity-50`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
