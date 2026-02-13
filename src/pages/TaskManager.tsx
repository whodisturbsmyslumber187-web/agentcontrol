import React from 'react'
import { useAgentStore } from '../stores/agent-store'
import { useOpenClawStore } from '../stores/openclaw-store'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Activity, Users, Cpu, Clock, Zap, CheckCircle } from 'lucide-react'

export default function TaskManager() {
  const { agents } = useAgentStore()
  const { sessions } = useOpenClawStore()

  const activeAgents = agents.filter(a => a.status === 'active')
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokenUsage || 0), 0)
  const activeSessions = sessions.filter(s => s.active)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cyber-white">Task Manager</h1>
        <p className="text-cyber-gray mt-1">Real-time agent sessions, token usage, and task monitoring</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyber-gray">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-white">{activeAgents.length}</div>
            <p className="text-xs text-cyber-gray">{agents.length} total</p>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyber-gray">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-white">{activeSessions.length}</div>
            <p className="text-xs text-cyber-gray">{sessions.length} total sessions</p>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyber-gray">Token Usage</CardTitle>
            <Cpu className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-white">{(totalTokens / 1000).toFixed(0)}k</div>
            <p className="text-xs text-cyber-gray">All time</p>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyber-gray">Tasks Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-white">{agents.reduce((s, a) => s + (a.completedTasks || 0), 0)}</div>
            <p className="text-xs text-cyber-gray">of {agents.reduce((s, a) => s + (a.tasks || 0), 0)} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent List */}
      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-cyber-green" />
            Agent Army Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-cyber-dark border border-cyber-border hover:border-cyber-green/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{agent.emoji}</span>
                  <div>
                    <p className="font-semibold text-cyber-white">{agent.name}</p>
                    <p className="text-xs text-cyber-gray">{agent.role} · {agent.model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-cyber-white">{((agent.tokenUsage || 0) / 1000).toFixed(0)}k tokens</p>
                    <p className="text-xs text-cyber-gray">{agent.completedTasks || 0}/{agent.tasks} tasks</p>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${
                    agent.status === 'active' ? 'bg-cyber-green animate-pulse' :
                    agent.status === 'idle' ? 'bg-yellow-500' :
                    agent.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
