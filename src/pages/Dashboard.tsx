import React, { useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useAgentStore } from '../stores/agent-store'
import { useOpenClawStore } from '../stores/openclaw-store'
import { useBusinessStore } from '../stores/business-store'
import { 
  Activity, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Cpu, 
  Shield, 
  FileText,
  MessageSquare,
  Zap,
  Clock
} from 'lucide-react'
import AgentGrid from '../components/dashboard/AgentGrid'
import BusinessMetrics from '../components/dashboard/BusinessMetrics'
import SystemHealth from '../components/dashboard/SystemHealth'
import RecentActivity from '../components/dashboard/RecentActivity'
import QuickActions from '../components/dashboard/QuickActions'
import MarketMonitor from '../components/dashboard/MarketMonitor'

export default function Dashboard() {
  const { agents, isLoading: agentsLoading } = useAgentStore()
  const { sessions, isLoading: sessionsLoading } = useOpenClawStore()
  const { businesses, metrics, isLoading: businessLoading } = useBusinessStore()

  const activeAgents = agents.filter(a => a.status === 'active')
  const totalTokenUsage = agents.reduce((sum, agent) => sum + (agent.tokenUsage || 0), 0)
  const activeSessions = sessions.filter(s => s.active)
  
  // Business metrics
  const totalRevenue = businesses.reduce((sum, biz) => sum + (biz.revenue || 0), 0)
  const activeBusinesses = businesses.filter(b => b.status === 'active').length
  const pendingTasks = businesses.reduce((sum, biz) => sum + (biz.pendingTasks || 0), 0)

  if (agentsLoading || sessionsLoading || businessLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyber-green mx-auto"></div>
          <p className="mt-4 text-cyber-gray">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyber-white">Brotherhood Empire Command Center</h1>
          <p className="text-cyber-gray mt-2">Monitor and control your AI agent army</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-cyber-gray">Operator</p>
            <p className="font-semibold text-cyber-green">Christ Benzion</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-cyber-green/20 flex items-center justify-center">
            <Shield className="h-6 w-6 text-cyber-green" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyber-gray">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-white">{activeAgents.length}</div>
            <p className="text-xs text-cyber-gray">
              {agents.length} total agents
            </p>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyber-gray">Business Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-white">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-cyber-gray">
              {activeBusinesses} active businesses
            </p>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyber-gray">Token Usage</CardTitle>
            <Cpu className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-white">{totalTokenUsage.toLocaleString()}</div>
            <p className="text-xs text-cyber-gray">
              {activeSessions.length} active sessions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyber-gray">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-cyber-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-white">{pendingTasks}</div>
            <p className="text-xs text-cyber-gray">
              Across all businesses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="bg-cyber-card border border-cyber-border">
          <TabsTrigger value="agents" className="data-[state=active]:bg-cyber-green">
            <Users className="h-4 w-4 mr-2" />
            Agent Army
          </TabsTrigger>
          <TabsTrigger value="business" className="data-[state=active]:bg-cyber-green">
            <TrendingUp className="h-4 w-4 mr-2" />
            Business Ops
          </TabsTrigger>
          <TabsTrigger value="market" className="data-[state=active]:bg-cyber-green">
            <Activity className="h-4 w-4 mr-2" />
            Market Watch
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-cyber-green">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-cyber-green">
            <Shield className="h-4 w-4 mr-2" />
            System Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AgentGrid agents={agents} />
            </div>
            <div className="space-y-6">
              <QuickActions />
              <RecentActivity />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <BusinessMetrics businesses={businesses} />
        </TabsContent>

        <TabsContent value="market" className="space-y-4">
          <MarketMonitor />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card className="bg-cyber-card border-cyber-border">
            <CardHeader>
              <CardTitle className="text-cyber-white">Report Generation</CardTitle>
              <CardDescription className="text-cyber-gray">
                Click to generate and download detailed reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card 
                  className="bg-cyber-dark border-cyber-border hover:border-cyber-green cursor-pointer transition-colors"
                  onClick={() => {
                    const report = {
                      title: 'Revenue Report',
                      generatedAt: new Date().toISOString(),
                      businesses: businesses.map(b => ({ name: b.name, type: b.type, revenue: b.revenue, expenses: b.expenses, profit: b.profit, status: b.status })),
                      totals: { revenue: totalRevenue, businesses: businesses.length, active: activeBusinesses },
                    }
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = `revenue-report-${new Date().toISOString().split('T')[0]}.json`; a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-cyber-green/20 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-cyber-green" />
                      </div>
                      <div>
                        <p className="font-medium text-cyber-white">Revenue Report</p>
                        <p className="text-sm text-cyber-gray">Click to download earnings data</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="bg-cyber-dark border-cyber-border hover:border-cyber-green cursor-pointer transition-colors"
                  onClick={() => {
                    const report = {
                      title: 'Agent Performance Report',
                      generatedAt: new Date().toISOString(),
                      agents: agents.map(a => ({ name: a.name, role: a.role, status: a.status, model: a.model, tokenUsage: a.tokenUsage || a.token_usage, tasks: a.tasks, completed: a.completed_tasks })),
                      totals: { agents: agents.length, active: activeAgents.length, totalTokens: totalTokenUsage, sessions: activeSessions.length },
                    }
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = `agent-report-${new Date().toISOString().split('T')[0]}.json`; a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-cyber-green/20 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-cyber-green" />
                      </div>
                      <div>
                        <p className="font-medium text-cyber-white">Agent Performance</p>
                        <p className="text-sm text-cyber-gray">Click to download agent metrics</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="bg-cyber-dark border-cyber-border hover:border-cyber-green cursor-pointer transition-colors"
                  onClick={() => {
                    const report = {
                      title: 'Standup Summary',
                      generatedAt: new Date().toISOString(),
                      agentCount: agents.length,
                      activeCount: activeAgents.length,
                      sessionsActive: activeSessions.length,
                      businesses: businesses.length,
                      note: 'Full standup transcripts available in the Logs tab',
                    }
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = `standup-summary-${new Date().toISOString().split('T')[0]}.json`; a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-cyber-green/20 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-cyber-green" />
                      </div>
                      <div>
                        <p className="font-medium text-cyber-white">Standup Summary</p>
                        <p className="text-sm text-cyber-gray">Click to download summary</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <SystemHealth />
        </TabsContent>
      </Tabs>

      {/* Bottom Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-cyber-dark border-t border-cyber-border p-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-cyber-green animate-pulse"></div>
              <span className="text-cyber-gray">OpenClaw Connected</span>
            </div>
            <div className="text-cyber-gray">
              Last update: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-cyber-gray">
              CPU: <span className="text-cyber-green">42%</span>
            </div>
            <div className="text-cyber-gray">
              Memory: <span className="text-cyber-green">68%</span>
            </div>
            <div className="text-cyber-gray">
              Network: <span className="text-cyber-green">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}