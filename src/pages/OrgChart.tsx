import { useAgentStore } from '../stores/agent-store'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { GitBranch } from 'lucide-react'

export default function OrgChart() {
  const { agents } = useAgentStore()
  const mainAgent = agents.find(a => a.role === 'Main Orchestrator') || agents[0]
  const subAgents = agents.filter(a => a.id !== mainAgent?.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cyber-white">Org Chart</h1>
        <p className="text-cyber-gray mt-1">Hierarchical agent organization tree</p>
      </div>

      <div className="flex flex-col items-center">
        {/* Main Agent */}
        {mainAgent && (
          <Card className="bg-cyber-card border-cyber-green w-72 mb-4">
            <CardContent className="p-4 text-center">
              <span className="text-4xl">{mainAgent.emoji}</span>
              <p className="font-bold text-cyber-white mt-2">{mainAgent.name}</p>
              <p className="text-xs text-cyber-green">{mainAgent.role}</p>
              <div className={`mt-2 h-2 w-2 rounded-full mx-auto ${mainAgent.status === 'active' ? 'bg-cyber-green animate-pulse' : 'bg-gray-500'}`} />
            </CardContent>
          </Card>
        )}

        {/* Connector Line */}
        <div className="w-px h-8 bg-cyber-border" />

        {/* Horizontal connector */}
        <div className="flex items-start relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-px bg-cyber-border" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {subAgents.map(agent => (
              <div key={agent.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-cyber-border" />
                <Card className="bg-cyber-card border-cyber-border w-48 hover:border-cyber-green/50 transition-colors">
                  <CardContent className="p-3 text-center">
                    <span className="text-2xl">{agent.emoji}</span>
                    <p className="font-semibold text-cyber-white text-sm mt-1">{agent.name}</p>
                    <p className="text-xs text-cyber-gray">{agent.role}</p>
                    <div className={`mt-2 h-2 w-2 rounded-full mx-auto ${
                      agent.status === 'active' ? 'bg-cyber-green animate-pulse' :
                      agent.status === 'idle' ? 'bg-yellow-500' : 'bg-gray-500'
                    }`} />
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
