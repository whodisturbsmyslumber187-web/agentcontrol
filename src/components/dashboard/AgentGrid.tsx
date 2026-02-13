import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { 
  Users, 
  Cpu, 
  MessageSquare, 
  Zap, 
  Shield, 
  AlertCircle,
  Play,
  Pause,
  Trash2,
  Settings,
  Sparkles,
  Copy
} from 'lucide-react'
import { useAgentStore, type Agent } from '../../stores/agent-store'
import { useOpenClawStore } from '../../stores/openclaw-store'
import SpawnAgentModal from '../modals/SpawnAgentModal'
import EditAgentModal from '../modals/EditAgentModal'
import { insforge } from '../../lib/insforge'

interface AgentGridProps {
  agents: Agent[]
}

export default function AgentGrid({ agents }: AgentGridProps) {
  const { updateAgent, removeAgent } = useAgentStore()
  const { addSession } = useOpenClawStore()
  const [showSpawn, setShowSpawn] = useState(false)
  const [editAgent, setEditAgent] = useState<Agent | null>(null)
  const [spawnParent, setSpawnParent] = useState<string | undefined>(undefined)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-cyber-green text-cyber-black'
      case 'idle': return 'bg-yellow-500/80 text-black'
      case 'error': return 'bg-red-500 text-white'
      case 'offline': return 'bg-gray-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'monitoring': return <AlertCircle className="h-5 w-5" />
      case 'trading': return <Zap className="h-5 w-5" />
      case 'analysis': return <Cpu className="h-5 w-5" />
      case 'security': return <Shield className="h-5 w-5" />
      case 'communication': return <MessageSquare className="h-5 w-5" />
      default: return <Users className="h-5 w-5" />
    }
  }

  const handleToggleStatus = async (agent: Agent) => {
    setActionLoading(agent.id)
    const newStatus = agent.status === 'active' ? 'idle' : 'active'
    await updateAgent(agent.id, { status: newStatus })

    // Log the action
    await insforge.database.from('activity_log').insert({
      agent_id: agent.id,
      agent_name: agent.name,
      message: `${agent.emoji || '🤖'} ${agent.name} ${newStatus === 'active' ? 'activated' : 'paused'}`,
      type: newStatus === 'active' ? 'success' : 'info',
    })

    // If activating, create a new session
    if (newStatus === 'active') {
      await addSession({ agent_id: agent.id })
    }

    setActionLoading(null)
  }

  const handleDeleteAgent = async (agent: Agent) => {
    if (!window.confirm(`Delete ${agent.name}? This will remove the agent and all its data permanently.`)) return
    setActionLoading(agent.id)

    // Log before deleting
    await insforge.database.from('activity_log').insert({
      agent_name: agent.name,
      message: `🗑️ Agent ${agent.emoji || '🤖'} ${agent.name} (${agent.role}) was terminated`,
      type: 'warning',
    })

    await removeAgent(agent.id)
    setActionLoading(null)
  }

  const handleSpawnSubAgent = (parentId: string) => {
    setSpawnParent(parentId)
    setShowSpawn(true)
  }

  const handleCloneAgent = async (agent: Agent) => {
    setActionLoading(agent.id)
    const { addAgent } = useAgentStore.getState()
    await addAgent({
      name: `${agent.name} (Clone)`,
      role: agent.role,
      emoji: agent.emoji,
      description: agent.description,
      model: agent.model,
      status: 'idle',
      config: agent.config,
    })

    await insforge.database.from('activity_log').insert({
      agent_name: agent.name,
      message: `🧬 Cloned agent: ${agent.emoji || '🤖'} ${agent.name} → ${agent.name} (Clone)`,
      type: 'success',
    })
    setActionLoading(null)
  }

  return (
    <>
      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-cyber-white">Brotherhood Agent Army</CardTitle>
              <CardDescription className="text-cyber-gray">
                {agents.length} agents deployed • {agents.filter(a => a.status === 'active').length} active
              </CardDescription>
            </div>
            <Button 
              onClick={() => { setSpawnParent(undefined); setShowSpawn(true) }}
              className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Spawn Agent
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <Card 
                key={agent.id} 
                className={`bg-cyber-dark border-cyber-border hover:border-cyber-green transition-colors ${
                  actionLoading === agent.id ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${
                        agent.status === 'active' ? 'bg-cyber-green/20' : 'bg-gray-500/20'
                      }`}>
                        {agent.emoji || getAgentIcon((agent.role || 'analysis').toLowerCase())}
                      </div>
                      <div>
                        <h3 className="font-semibold text-cyber-white">{agent.name}</h3>
                        <p className="text-xs text-cyber-gray">{agent.role}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-cyber-gray mb-3 line-clamp-2">{agent.description || 'No description'}</p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-cyber-gray">Model:</span>
                      <span className="text-cyber-white font-mono">{agent.model}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-cyber-gray">Tokens:</span>
                      <span className="text-cyber-green font-mono">
                        {(agent.tokenUsage || agent.token_usage || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-cyber-gray">Tasks:</span>
                      <span className="text-cyber-white">
                        {agent.completed_tasks || 0}/{agent.tasks || 0}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-cyber-border">
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(agent)}
                        className="h-8 px-2 hover:bg-cyber-green/20"
                        title={agent.status === 'active' ? 'Pause' : 'Activate'}
                      >
                        {agent.status === 'active' ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5 text-cyber-green" />
                        )}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditAgent(agent)}
                        className="h-8 px-2 hover:bg-cyber-green/20"
                        title="Edit agent"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCloneAgent(agent)}
                        className="h-8 px-2 hover:bg-blue-500/20 text-blue-400"
                        title="Clone agent"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSpawnSubAgent(agent.id)}
                        className="h-8 px-2 hover:bg-purple-500/20 text-purple-400"
                        title="Spawn sub-agent"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAgent(agent)}
                        className="h-8 px-2 hover:bg-red-500/20 text-red-400"
                        title="Delete agent"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {agents.length === 0 && (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-cyber-green/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-cyber-green" />
              </div>
              <h3 className="text-lg font-semibold text-cyber-white mb-2">No Agents Deployed</h3>
              <p className="text-cyber-gray mb-6">
                Spawn your first Brotherhood agent to begin empire operations
              </p>
              <Button 
                onClick={() => setShowSpawn(true)}
                className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black"
              >
                <Zap className="h-4 w-4 mr-2" />
                Deploy First Agent
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <SpawnAgentModal
        open={showSpawn}
        onClose={() => { setShowSpawn(false); setSpawnParent(undefined) }}
        parentAgentId={spawnParent}
      />

      <EditAgentModal
        open={!!editAgent}
        onClose={() => setEditAgent(null)}
        agent={editAgent}
      />
    </>
  )
}