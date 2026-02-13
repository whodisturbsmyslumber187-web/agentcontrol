import React from 'react'
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
  Settings
} from 'lucide-react'
import { useAgentStore } from '../../stores/agent-store'

interface AgentGridProps {
  agents: any[]
}

export default function AgentGrid({ agents }: AgentGridProps) {
  const { updateAgent, removeAgent } = useAgentStore()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-cyber-green text-cyber-black'
      case 'idle': return 'bg-cyber-yellow text-cyber-black'
      case 'error': return 'bg-cyber-red text-cyber-white'
      case 'offline': return 'bg-cyber-gray text-cyber-white'
      default: return 'bg-cyber-gray text-cyber-white'
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

  const handleToggleStatus = (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'idle' : 'active'
    updateAgent(agentId, { status: newStatus })
  }

  const handleDeleteAgent = (agentId: string) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
      removeAgent(agentId)
    }
  }

  return (
    <Card className="bg-cyber-card border-cyber-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-cyber-white">Agent Army</CardTitle>
            <CardDescription className="text-cyber-gray">
              Manage your AI agents across all business operations
            </CardDescription>
          </div>
          <Button className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
            <Users className="h-4 w-4 mr-2" />
            Spawn New Agent
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card 
              key={agent.id} 
              className="bg-cyber-dark border-cyber-border hover:border-cyber-green transition-colors"
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      agent.status === 'active' ? 'bg-cyber-green/20' : 'bg-cyber-gray/20'
                    }`}>
                      {getAgentIcon(agent.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-cyber-white">{agent.name}</h3>
                      <p className="text-sm text-cyber-gray">{agent.description}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(agent.status)}>
                    {agent.status}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-cyber-gray">Type:</span>
                    <span className="text-cyber-white">{agent.type}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-cyber-gray">Token Usage:</span>
                    <span className="text-cyber-green font-mono">
                      {agent.tokenUsage?.toLocaleString() || '0'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-cyber-gray">Uptime:</span>
                    <span className="text-cyber-white">{agent.uptime || 'N/A'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-cyber-gray">Business:</span>
                    <span className="text-cyber-white">{agent.business || 'Unassigned'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-cyber-border">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleStatus(agent.id, agent.status)}
                      className="h-8 px-2 hover:bg-cyber-green/20"
                    >
                      {agent.status === 'active' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 hover:bg-cyber-green/20"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="h-8 px-2 hover:bg-cyber-red/20 text-cyber-red"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="text-xs text-cyber-gray">
                    Last active: {agent.lastActive || 'Recently'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {agents.length === 0 && (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-cyber-green/20 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-cyber-green" />
            </div>
            <h3 className="text-lg font-semibold text-cyber-white mb-2">No Agents Found</h3>
            <p className="text-cyber-gray mb-6">
              Get started by spawning your first AI agent
            </p>
            <Button className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
              <Zap className="h-4 w-4 mr-2" />
              Create First Agent
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}