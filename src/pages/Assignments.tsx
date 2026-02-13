import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Link2, Plus, Trash2, ArrowRight, Users, Briefcase, AlertTriangle,
  CheckCircle, Pause, Play, X, Save, ChevronDown
} from 'lucide-react'
import { useAgentStore, Agent } from '../stores/agent-store'
import { useBusinessStore, Business } from '../stores/business-store'
import { insforge } from '../lib/insforge'

interface Assignment {
  id: string
  agent_id: string
  business_id: string
  role: string
  instructions: string
  priority: 'high' | 'medium' | 'low'
  status: 'active' | 'paused' | 'completed'
  created_at: string
}

export default function Assignments() {
  const { agents } = useAgentStore()
  const { businesses } = useBusinessStore()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [showAssign, setShowAssign] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('')
  const [selectedBusiness, setSelectedBusiness] = useState('')
  const [role, setRole] = useState('')
  const [instructions, setInstructions] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [saving, setSaving] = useState(false)
  const [viewBusiness, setViewBusiness] = useState<string | null>(null)

  useEffect(() => {
    loadAssignments()
  }, [])

  const loadAssignments = async () => {
    const { data } = await insforge.database
      .from('agent_assignments')
      .select()
      .order('created_at', { ascending: false })
    if (data) setAssignments(data as Assignment[])
  }

  const createAssignment = async () => {
    if (!selectedAgent || !selectedBusiness) return
    setSaving(true)
    const agent = agents.find(a => a.id === selectedAgent)
    const { data, error } = await insforge.database
      .from('agent_assignments')
      .insert({
        agent_id: selectedAgent,
        business_id: selectedBusiness,
        role: role || agent?.role || 'general',
        instructions: instructions,
        priority,
        status: 'active',
      })
      .select()
    if (!error && data?.[0]) {
      setAssignments(prev => [data[0] as Assignment, ...prev])
      // Also update business agents array
      const biz = businesses.find(b => b.id === selectedBusiness)
      if (biz && !biz.agents.includes(selectedAgent)) {
        const newAgents = [...biz.agents, selectedAgent]
        await insforge.database.from('businesses').update({ agents: newAgents }).eq('id', selectedBusiness)
      }
      // Log activity
      await insforge.database.from('activity_log').insert({
        agent_name: agent?.name || 'Unknown',
        message: `assigned to business "${businesses.find(b => b.id === selectedBusiness)?.name}"`,
        type: 'info',
      })
    }
    setShowAssign(false)
    setSelectedAgent('')
    setSelectedBusiness('')
    setRole('')
    setInstructions('')
    setPriority('medium')
    setSaving(false)
  }

  const toggleAssignment = async (assignment: Assignment) => {
    const newStatus = assignment.status === 'active' ? 'paused' : 'active'
    await insforge.database.from('agent_assignments').update({ status: newStatus }).eq('id', assignment.id)
    setAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, status: newStatus } : a))
  }

  const removeAssignment = async (assignment: Assignment) => {
    await insforge.database.from('agent_assignments').delete().eq('id', assignment.id)
    setAssignments(prev => prev.filter(a => a.id !== assignment.id))
    // Remove from business agents
    const biz = businesses.find(b => b.id === assignment.business_id)
    if (biz) {
      const newAgents = biz.agents.filter(id => id !== assignment.agent_id)
      await insforge.database.from('businesses').update({ agents: newAgents }).eq('id', assignment.business_id)
    }
  }

  const getAgent = (id: string) => agents.find(a => a.id === id)
  const getBusiness = (id: string) => businesses.find(b => b.id === id)
  const getAssignmentsForBusiness = (bizId: string) => assignments.filter(a => a.business_id === bizId)
  const assignedAgentIds = new Set(assignments.map(a => a.agent_id))
  const unassignedAgents = agents.filter(a => !assignedAgentIds.has(a.id))

  const priorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-cyber-gray/20 text-cyber-gray'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Agent Assignments</h2>
          <p className="text-cyber-gray text-sm">Assign agents to businesses with specific roles and instructions</p>
        </div>
        <Button onClick={() => setShowAssign(true)} className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
          <Plus className="h-4 w-4 mr-2" /> New Assignment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Total Assignments</p>
            <p className="text-2xl font-bold text-cyber-white">{assignments.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Active</p>
            <p className="text-2xl font-bold text-cyber-green">{assignments.filter(a => a.status === 'active').length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Unassigned Agents</p>
            <p className="text-2xl font-bold text-yellow-400">{unassignedAgents.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Businesses Covered</p>
            <p className="text-2xl font-bold text-cyber-white">{new Set(assignments.map(a => a.business_id)).size}</p>
          </CardContent>
        </Card>
      </div>

      {/* New Assignment Modal */}
      {showAssign && (
        <Card className="bg-cyber-card border-cyber-green/30">
          <CardHeader>
            <CardTitle className="text-cyber-white text-sm">Create Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Agent *</label>
                <select
                  value={selectedAgent}
                  onChange={e => setSelectedAgent(e.target.value)}
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Select agent"
                >
                  <option value="">Select agent...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.emoji || '🤖'} {a.name} — {a.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Business *</label>
                <select
                  value={selectedBusiness}
                  onChange={e => setSelectedBusiness(e.target.value)}
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Select business"
                >
                  <option value="">Select business...</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Role / Title</label>
                <input
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Lead SEO, Account Manager..."
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Assignment role"
                />
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Priority level"
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🔵 Low</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-cyber-gray block mb-1">Instructions</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Tell this agent exactly what to do for this business..."
                rows={3}
                className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white resize-none focus:outline-none focus:border-cyber-green/50"
                aria-label="Assignment instructions"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createAssignment} disabled={saving || !selectedAgent || !selectedBusiness} className="bg-cyber-green text-cyber-black">
                {saving ? 'Assigning...' : <><Save className="h-4 w-4 mr-1" /> Assign Agent</>}
              </Button>
              <Button onClick={() => setShowAssign(false)} variant="ghost" className="text-cyber-gray">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business-centric view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {businesses.map(biz => {
          const bizAssignments = getAssignmentsForBusiness(biz.id)
          return (
            <Card key={biz.id} className="bg-cyber-card border-cyber-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${biz.status === 'active' ? 'bg-cyber-green/20' : 'bg-cyber-gray/20'}`}>
                      <Briefcase className={`h-5 w-5 ${biz.status === 'active' ? 'text-cyber-green' : 'text-cyber-gray'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-cyber-white text-sm">{biz.name}</CardTitle>
                      <CardDescription className="text-cyber-gray text-xs">{biz.type} • ${biz.revenue.toLocaleString()} revenue</CardDescription>
                    </div>
                  </div>
                  <Badge className={biz.status === 'active' ? 'bg-cyber-green/20 text-cyber-green' : 'bg-yellow-500/20 text-yellow-400'}>
                    {biz.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {bizAssignments.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-cyber-gray/50">No agents assigned</p>
                    <button
                      onClick={() => { setShowAssign(true); setSelectedBusiness(biz.id) }}
                      className="text-xs text-cyber-green hover:underline mt-1"
                    >
                      + Assign an agent
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bizAssignments.map(asn => {
                      const agent = getAgent(asn.agent_id)
                      return (
                        <div key={asn.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-cyber-dark border border-cyber-border/50 group">
                          <div className="flex items-center gap-2">
                            <span>{agent?.emoji || '🤖'}</span>
                            <div>
                              <p className="text-xs text-cyber-white font-medium">{agent?.name || 'Unknown Agent'}</p>
                              <p className="text-[10px] text-cyber-gray">{asn.role} {asn.instructions ? `• ${asn.instructions.substring(0, 50)}...` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge className={`text-[10px] ${priorityColor(asn.priority)}`}>{asn.priority}</Badge>
                            <button onClick={() => toggleAssignment(asn)} className="p-1 text-cyber-gray hover:text-cyber-white" title="Toggle status">
                              {asn.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            </button>
                            <button onClick={() => removeAssignment(asn)} className="p-1 text-red-400 hover:text-red-300 hidden group-hover:block" title="Remove">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Unassigned agents pool */}
      {unassignedAgents.length > 0 && (
        <Card className="bg-cyber-card border-cyber-border">
          <CardHeader>
            <CardTitle className="text-yellow-400 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Unassigned Agents ({unassignedAgents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unassignedAgents.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setShowAssign(true); setSelectedAgent(a.id) }}
                  className="flex items-center gap-2 py-2 px-3 rounded-lg bg-cyber-dark border border-yellow-500/20 hover:border-cyber-green/30 transition-colors"
                >
                  <span>{a.emoji || '🤖'}</span>
                  <div className="text-left">
                    <p className="text-xs text-cyber-white">{a.name}</p>
                    <p className="text-[10px] text-cyber-gray">{a.role}</p>
                  </div>
                  <Plus className="h-3 w-3 text-cyber-green" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
