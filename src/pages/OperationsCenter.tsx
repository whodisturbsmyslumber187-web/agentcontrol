import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Radar, Users, Briefcase, Phone, MessageSquare, Activity,
  Zap, ArrowUp, ArrowDown, Clock, Hash, Play, Pause,
  TrendingUp, Eye, RefreshCw, Mic, X
} from 'lucide-react'
import { VoiceAgentPanel } from '../components/voice/VoiceAgentPanel'
import { useAgentStore } from '../stores/agent-store'
import { useOpenClawStore, Session } from '../stores/openclaw-store'
import { useBusinessStore } from '../stores/business-store'
import { insforge } from '../lib/insforge'

interface ActivityEntry {
  id: string
  agent_name: string
  message: string
  type: string
  created_at: string
}

interface Assignment {
  id: string
  agent_id: string
  business_id: string
  role: string
  status: string
  priority: string
}

interface PhoneEntry {
  id: string
  phone_number: string
  agent_name: string | null
  status: string
  provider: string
}

interface Channel {
  id: string
  name: string
  slug: string
  members: string[]
}

export default function OperationsCenter() {
  const { agents, fetchAgents } = useAgentStore()
  const { sessions, fetchSessions } = useOpenClawStore()
  const { businesses, fetchBusinesses, metrics } = useBusinessStore()
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [phones, setPhones] = useState<PhoneEntry[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [voiceAgent, setVoiceAgent] = useState<{ id: string; name: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setRefreshing(true)
    await Promise.all([fetchAgents(), fetchSessions(), fetchBusinesses()])

    const [actRes, asnRes, phRes, chRes] = await Promise.all([
      insforge.database.from('activity_log').select().order('created_at', { ascending: false }).limit(20),
      insforge.database.from('agent_assignments').select().order('created_at', { ascending: false }),
      insforge.database.from('agent_phones').select().order('created_at', { ascending: false }),
      insforge.database.from('agent_channels').select(),
    ])

    if (actRes.data) setActivityLog(actRes.data as ActivityEntry[])
    if (asnRes.data) setAssignments(asnRes.data as Assignment[])
    if (phRes.data) setPhones(phRes.data as PhoneEntry[])
    if (chRes.data) setChannels(chRes.data as Channel[])
    setRefreshing(false)
  }

  // metrics is now from store, not calculated here
  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'idle')
  const activeSessions = sessions.filter(s => s.active)
  const activePhones = phones.filter(p => p.status === 'active')
  const activeAssignments = assignments.filter(a => a.status === 'active')
  const totalRevenue = businesses.reduce((sum, b) => sum + (b.revenue || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white flex items-center gap-3">
            <Radar className="h-7 w-7 text-cyber-green animate-pulse" />
            Operations Center
          </h2>
          <p className="text-cyber-gray text-sm">Full empire overview — agents, businesses, phones, channels, sessions</p>
        </div>
        <Button onClick={loadAll} disabled={refreshing} className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh All'}
        </Button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Active Agents', value: activeAgents.length, total: agents.length, icon: Users, color: 'text-cyber-green' },
          { label: 'Businesses', value: businesses.filter(b => b.status === 'active').length, total: businesses.length, icon: Briefcase, color: 'text-blue-400' },
          { label: 'Assignments', value: activeAssignments.length, total: assignments.length, icon: Zap, color: 'text-yellow-400' },
          { label: 'Phone Lines', value: activePhones.length, total: phones.length, icon: Phone, color: 'text-purple-400' },
          { label: 'Chat Channels', value: channels.length, total: channels.length, icon: Hash, color: 'text-cyan-400' },
          { label: 'Revenue', value: `$${(totalRevenue / 1000).toFixed(0)}k`, total: null, icon: TrendingUp, color: 'text-emerald-400' },
        ].map((kpi, i) => (
          <Card key={i} className="bg-cyber-card border-cyber-border">
            <CardContent className="p-4 text-center">
              <kpi.icon className={`h-5 w-5 mx-auto mb-2 ${kpi.color}`} />
              <p className="text-xl font-bold text-cyber-white">{kpi.value}</p>
              <p className="text-[10px] text-cyber-gray">
                {kpi.label} {kpi.total !== null && `(${kpi.total} total)`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Agent Swarm Panel */}
        <div className="col-span-4">
          <Card className="bg-cyber-card border-cyber-border h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-cyber-green" />
                Agent Swarm ({agents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {agents.map(a => {
                const agentAssignments = assignments.filter(asn => asn.agent_id === a.id)
                const agentPhone = phones.find(p => p.agent_name === a.name)
                return (
                  <div key={a.id} className="p-2 rounded-lg bg-cyber-dark border border-cyber-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{a.emoji || '🤖'}</span>
                        <div>
                          <p className="text-xs text-cyber-white font-medium">{a.name}</p>
                          <p className="text-[10px] text-cyber-gray">{a.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-cyber-gray hover:text-cyber-green"
                          onClick={() => setVoiceAgent({ id: a.id, name: a.name })}
                          title="Test Voice Agent"
                        >
                          <Mic className="h-3 w-3" />
                        </Button>
                        <div className={`h-2 w-2 rounded-full ${a.status === 'active' ? 'bg-cyber-green animate-pulse' : 'bg-cyber-gray'}`} />
                        {agentPhone && <Phone className="h-3 w-3 text-purple-400" />}
                      </div>
                    </div>
                    {agentAssignments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {agentAssignments.map(asn => {
                          const biz = businesses.find(b => b.id === asn.business_id)
                          return (
                            <Badge key={asn.id} className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {biz?.name || 'Business'}
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                    {agentPhone && (
                      <p className="text-[10px] text-purple-400 mt-1 font-mono">{agentPhone.phone_number}</p>
                    )}
                  </div>
                )
              })}
              {agents.length === 0 && <p className="text-xs text-cyber-gray/50 text-center py-4">No agents spawned</p>}
            </CardContent>
          </Card>
        </div>

        {/* Business Pipeline */}
        <div className="col-span-4">
          <Card className="bg-cyber-card border-cyber-border h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-400" />
                Business Pipeline ({businesses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {businesses.map(biz => {
                const bizAssignments = assignments.filter(a => a.business_id === biz.id)
                return (
                  <div key={biz.id} className="p-2 rounded-lg bg-cyber-dark border border-cyber-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-cyber-white font-medium">{biz.name}</p>
                        <p className="text-[10px] text-cyber-gray">{biz.type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-cyber-green font-mono">${biz.revenue.toLocaleString()}</p>
                        <Badge className={`text-[9px] ${biz.status === 'active' ? 'bg-cyber-green/20 text-cyber-green' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {biz.status}
                        </Badge>
                      </div>
                    </div>
                    {bizAssignments.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <Users className="h-3 w-3 text-cyber-gray" />
                        {bizAssignments.map(asn => {
                          const agent = agents.find(a => a.id === asn.agent_id)
                          return (
                            <span key={asn.id} className="text-sm" title={agent?.name}>{agent?.emoji || '🤖'}</span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {businesses.length === 0 && <p className="text-xs text-cyber-gray/50 text-center py-4">No businesses</p>}
            </CardContent>
          </Card>
        </div>

        {/* Live Activity Feed */}
        <div className="col-span-4">
          <Card className="bg-cyber-card border-cyber-border h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-yellow-400 animate-pulse" />
                Live Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {activityLog.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 py-1 border-b border-cyber-border/30 last:border-0">
                  <div className={`h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    entry.type === 'error' ? 'bg-red-400' : entry.type === 'warning' ? 'bg-yellow-400' : 'bg-cyber-green'
                  }`} />
                  <div>
                    <p className="text-[11px] text-cyber-white">
                      <span className="font-semibold text-cyber-green">{entry.agent_name}</span>{' '}
                      {entry.message}
                    </p>
                    <p className="text-[9px] text-cyber-gray">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {activityLog.length === 0 && <p className="text-xs text-cyber-gray/50 text-center py-4">No activity yet</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row: Sessions + Channels + Phones */}
      <div className="grid grid-cols-3 gap-4">
        {/* Active Sessions */}
        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-orange-400" />
              OpenClaw Sessions ({activeSessions.length} active)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
            {sessions.slice(0, 10).map((s: Session) => {
              const agent = agents.find(a => a.id === s.agent_id)
              return (
                <div key={s.id} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-xs text-cyber-white">{agent?.name || 'Unknown Agent'}</p>
                    <p className="text-[10px] text-cyber-gray font-mono">{agent?.model || 'unknown'}</p>
                  </div>
                  <Badge className={`text-[9px] ${s.active ? 'bg-cyber-green/20 text-cyber-green' : 'bg-cyber-gray/20 text-cyber-gray'}`}>
                    {s.active ? 'Active' : 'Ended'}
                  </Badge>
                </div>
              )
            })}
            {sessions.length === 0 && <p className="text-xs text-cyber-gray/50 text-center py-2">No sessions</p>}
          </CardContent>
        </Card>

        {/* Channels */}
        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
              <Hash className="h-4 w-4 text-cyan-400" />
              Chat Channels ({channels.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
            {channels.map(ch => (
              <div key={ch.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <Hash className="h-3 w-3 text-cyan-400" />
                  <p className="text-xs text-cyber-white">{ch.name}</p>
                </div>
                <Badge className="text-[9px] bg-cyan-500/10 text-cyan-400">{ch.members?.length || 0} agents</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Phone Lines */}
        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
              <Phone className="h-4 w-4 text-purple-400" />
              Phone Lines ({phones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
            {phones.map(p => (
              <div key={p.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs text-cyber-white font-mono">{p.phone_number}</p>
                  <p className="text-[10px] text-cyber-gray">{p.agent_name || 'Unassigned'} • {p.provider}</p>
                </div>
                <div className={`h-2 w-2 rounded-full ${p.status === 'active' ? 'bg-cyber-green' : 'bg-red-400'}`} />
              </div>
            ))}
            {phones.length === 0 && <p className="text-xs text-cyber-gray/50 text-center py-2">No phone lines</p>}
          </CardContent>
        </Card>
      </div>

      {/* Voice Agent Modal */}
      {voiceAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl h-[600px] bg-cyber-darker border border-cyber-green/30 rounded-xl shadow-2xl overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-cyber-gray hover:text-white"
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
