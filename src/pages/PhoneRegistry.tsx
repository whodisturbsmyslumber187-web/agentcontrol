import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Phone, Plus, Trash2, X, Save, Settings, Smartphone,
  PhoneCall, MessageSquare as SmsIcon, Mic, Voicemail, ArrowRight
} from 'lucide-react'
import { useAgentStore } from '../stores/agent-store'
import { insforge } from '../lib/insforge'
import { mergeAgentConfigWithDefaults } from '../lib/agent-defaults'

type PhoneProvider =
  | 'twilio'
  | 'telnyx'
  | 'plivo'
  | 'bandwidth'
  | 'vonage'
  | 'signalwire'
  | 'flowroute'
  | 'voipms'
  | 'openphone'
  | 'aircall'
  | 'ringcentral'
  | 'dialpad'
  | 'voip_sip'
  | 'other'

const PHONE_PROVIDER_OPTIONS: Array<{ value: PhoneProvider; label: string; icon: string }> = [
  { value: 'twilio', label: 'Twilio', icon: '📞' },
  { value: 'telnyx', label: 'Telnyx', icon: '📶' },
  { value: 'plivo', label: 'Plivo', icon: '📳' },
  { value: 'bandwidth', label: 'Bandwidth', icon: '🛰️' },
  { value: 'vonage', label: 'Vonage', icon: '☎️' },
  { value: 'signalwire', label: 'SignalWire', icon: '📡' },
  { value: 'flowroute', label: 'Flowroute', icon: '🧭' },
  { value: 'voipms', label: 'VoIP.ms', icon: '🌐' },
  { value: 'openphone', label: 'OpenPhone', icon: '📱' },
  { value: 'aircall', label: 'Aircall', icon: '🎧' },
  { value: 'ringcentral', label: 'RingCentral', icon: '⭕' },
  { value: 'dialpad', label: 'Dialpad', icon: '⌨️' },
  { value: 'voip_sip', label: 'VoIP / SIP', icon: '🔌' },
  { value: 'other', label: 'Other', icon: '☎️' },
]

interface AgentPhone {
  id: string
  phone_number: string
  provider: PhoneProvider
  agent_id: string | null
  agent_name: string | null
  capabilities: string[]
  routing_config: { action: string; fallback: string }
  status: 'active' | 'inactive' | 'pending'
  label: string
  created_at: string
}

export default function PhoneRegistry() {
  const { agents } = useAgentStore()
  const [phones, setPhones] = useState<AgentPhone[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    phone_number: '',
    provider: 'twilio' as AgentPhone['provider'],
    agent_id: '',
    create_new_agent: false,
    new_agent_name: '',
    new_agent_role: 'support',
    label: '',
    capabilities: ['voice', 'sms'] as string[],
    routing_action: 'ai_answer',
    routing_fallback: 'voicemail',
  })

  useEffect(() => {
    loadPhones()
  }, [])

  const loadPhones = async () => {
    const { data } = await insforge.database
      .from('agent_phones')
      .select()
      .order('created_at', { ascending: false })
    if (data) setPhones(data as AgentPhone[])
  }

  const addPhone = async () => {
    if (!form.phone_number) return
    setSaving(true)
    
    let agentIdToUse = form.agent_id || null
    let agentName = agents.find(a => a.id === form.agent_id)?.name || null

    // Create new agent if requested
    if (form.create_new_agent && form.new_agent_name) {
      const nowIso = new Date().toISOString()
      const { data: newAgent, error: agentError } = await insforge.database
        .from('agents')
        .insert({
          name: form.new_agent_name,
          role: form.new_agent_role,
          status: 'active',
          model: 'gpt-4o-mini',
          emoji: '🤖',
          description: 'Phone registry agent created during number provisioning',
          tasks: 0,
          completed_tasks: 0,
          token_usage: 0,
          last_active: nowIso,
          config: mergeAgentConfigWithDefaults({
            source: 'phone-registry',
            capabilities: ['voice', 'chat'],
            createdAt: nowIso,
          }),
        })
        .select()
        .single()
      
      if (!agentError && newAgent) {
        agentIdToUse = newAgent.id
        agentName = newAgent.name
      }
    }

    const { data, error } = await insforge.database
      .from('agent_phones')
      .insert({
        phone_number: form.phone_number,
        provider: form.provider,
        agent_id: agentIdToUse,
        agent_name: agentName,
        capabilities: form.capabilities,
        routing_config: { action: form.routing_action, fallback: form.routing_fallback },
        status: 'active',
        label: form.label,
      })
      .select()
      
    if (!error && data?.[0]) {
      setPhones(prev => [data[0] as AgentPhone, ...prev])
      // Log activity
      await insforge.database.from('activity_log').insert({
        agent_name: agentName || 'System',
        message: `phone number ${form.phone_number} provisioned${agentName ? ` for ${agentName}` : ''}`,
        type: 'info',
      })
    }
    setShowAdd(false)
    setForm({ 
      phone_number: '', provider: 'twilio', agent_id: '', 
      create_new_agent: false, new_agent_name: '', new_agent_role: 'support',
      label: '', capabilities: ['voice', 'sms'], routing_action: 'ai_answer', routing_fallback: 'voicemail' 
    })
    setSaving(false)
  }

  const togglePhone = async (phone: AgentPhone) => {
    const newStatus = phone.status === 'active' ? 'inactive' : 'active'
    await insforge.database.from('agent_phones').update({ status: newStatus }).eq('id', phone.id)
    setPhones(prev => prev.map(p => p.id === phone.id ? { ...p, status: newStatus } : p))
  }

  const deletePhone = async (phone: AgentPhone) => {
    if (!window.confirm(`Delete phone ${phone.phone_number}?`)) return
    await insforge.database.from('agent_phones').delete().eq('id', phone.id)
    setPhones(prev => prev.filter(p => p.id !== phone.id))
  }

  const assignPhone = async (phoneId: string, agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    await insforge.database.from('agent_phones').update({
      agent_id: agentId || null,
      agent_name: agent?.name || null,
    }).eq('id', phoneId)
    setPhones(prev => prev.map(p => p.id === phoneId ? { ...p, agent_id: agentId, agent_name: agent?.name || null } : p))
  }

  const toggleCapability = (cap: string) => {
    setForm(f => ({
      ...f,
      capabilities: f.capabilities.includes(cap)
        ? f.capabilities.filter(c => c !== cap)
        : [...f.capabilities, cap]
    }))
  }

  const providerIcon = (provider: PhoneProvider) =>
    PHONE_PROVIDER_OPTIONS.find((entry) => entry.value === provider)?.icon || '☎️'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Phone Registry</h2>
          <p className="text-cyber-gray text-sm">Provision and manage phone numbers for your agents</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-cyber-green hover:bg-cyber-green/80 text-cyber-black">
          <Plus className="h-4 w-4 mr-2" /> Add Number
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Total Numbers</p>
            <p className="text-2xl font-bold text-cyber-white">{phones.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Active</p>
            <p className="text-2xl font-bold text-cyber-green">{phones.filter(p => p.status === 'active').length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Assigned to Agents</p>
            <p className="text-2xl font-bold text-cyber-white">{phones.filter(p => p.agent_id).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Unassigned</p>
            <p className="text-2xl font-bold text-yellow-400">{phones.filter(p => !p.agent_id).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Phone Form */}
      {showAdd && (
        <Card className="bg-cyber-card border-cyber-green/30">
          <CardHeader>
            <CardTitle className="text-cyber-white text-sm">Provision New Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Phone Number *</label>
                <input
                  value={form.phone_number}
                  onChange={e => setForm({ ...form, phone_number: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Phone number"
                />
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => setForm({ ...form, provider: e.target.value as PhoneProvider })}
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Phone provider"
                >
                  {PHONE_PROVIDER_OPTIONS.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Assign to Agent</label>
                {!form.create_new_agent ? (
                  <div className="flex gap-2">
                    <select
                      value={form.agent_id}
                      onChange={e => setForm({ ...form, agent_id: e.target.value })}
                      className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                      aria-label="Assign to agent"
                    >
                      <option value="">Unassigned</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.emoji || '🤖'} {a.name}</option>
                      ))}
                    </select>
                    <Button 
                      variant="outline" 
                      onClick={() => setForm({ ...form, create_new_agent: true, agent_id: '' })}
                      className="whitespace-nowrap bg-cyber-dark text-xs border-dashed border-cyber-green text-cyber-green hover:bg-cyber-green/10"
                    >
                      <Plus className="h-3 w-3 mr-1" /> New Agent
                    </Button>
                  </div>
                ) : (
                   <div className="space-y-2 p-3 border border-cyber-green/30 rounded-lg bg-cyber-green/5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-cyber-green">Creating New Agent</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setForm({ ...form, create_new_agent: false })}
                          className="h-5 w-5 p-0 text-cyber-gray hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <input
                        value={form.new_agent_name}
                        onChange={e => setForm({ ...form, new_agent_name: e.target.value })}
                        placeholder="Agent Name"
                        className="w-full bg-cyber-dark border border-cyber-border rounded px-2 py-1 text-xs text-cyber-white"
                      />
                      <select
                        value={form.new_agent_role}
                        onChange={e => setForm({ ...form, new_agent_role: e.target.value })}
                        className="w-full bg-cyber-dark border border-cyber-border rounded px-2 py-1 text-xs text-cyber-white"
                      >
                         <option value="support">Support</option>
                         <option value="sales">Sales</option>
                         <option value="access">Access Control</option>
                      </select>
                   </div>
                )}
              </div>

              <div>
                <label className="text-xs text-cyber-gray block mb-1">Label</label>
                <input
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. Sales Hotline, Support..."
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Phone label"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-cyber-gray block mb-1">Capabilities</label>
              <div className="flex gap-2">
                {['voice', 'sms', 'mms', 'fax'].map(cap => (
                  <button
                    key={cap}
                    onClick={() => toggleCapability(cap)}
                    className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                      form.capabilities.includes(cap)
                        ? 'bg-cyber-green/20 text-cyber-green border-cyber-green/30'
                        : 'bg-cyber-dark text-cyber-gray border-cyber-border hover:border-cyber-green/30'
                    }`}
                  >
                    {cap === 'voice' && <PhoneCall className="h-3 w-3 inline mr-1" />}
                    {cap === 'sms' && <SmsIcon className="h-3 w-3 inline mr-1" />}
                    {cap.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Inbound Action</label>
                <select
                  value={form.routing_action}
                  onChange={e => setForm({ ...form, routing_action: e.target.value })}
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Routing action"
                >
                  <option value="ai_answer">🤖 AI Answer (Agent)</option>
                  <option value="forward">📲 Forward to Operator</option>
                  <option value="voicemail">📬 Voicemail</option>
                  <option value="sms_auto">💬 SMS Auto-Reply</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Fallback</label>
                <select
                  value={form.routing_fallback}
                  onChange={e => setForm({ ...form, routing_fallback: e.target.value })}
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:outline-none focus:border-cyber-green/50"
                  aria-label="Fallback action"
                >
                  <option value="voicemail">Voicemail</option>
                  <option value="forward">Forward to Operator</option>
                  <option value="hangup">Hang Up</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={addPhone} disabled={saving || !form.phone_number} className="bg-cyber-green text-cyber-black">
                {saving ? 'Saving...' : <><Save className="h-4 w-4 mr-1" /> Provision Number</>}
              </Button>
              <Button onClick={() => setShowAdd(false)} variant="ghost" className="text-cyber-gray">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phone List */}
      <div className="space-y-3">
        {phones.map(phone => {
          const agent = phone.agent_id ? agents.find(a => a.id === phone.agent_id) : null
          return (
            <Card key={phone.id} className="bg-cyber-card border-cyber-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-cyber-green/10 flex items-center justify-center text-xl">
                      {providerIcon(phone.provider)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-semibold text-cyber-white">{phone.phone_number}</p>
                        {phone.label && <Badge className="bg-cyber-green/10 text-cyber-green text-[10px]">{phone.label}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-cyber-gray">{phone.provider}</span>
                        <span className="text-[10px] text-cyber-gray">•</span>
                        <div className="flex gap-1">
                          {phone.capabilities?.map(cap => (
                            <Badge key={cap} className="text-[9px] bg-cyber-dark text-cyber-gray border border-cyber-border">{cap}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Agent assignment */}
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3 w-3 text-cyber-gray" />
                      {agent ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-cyber-dark border border-cyber-border">
                          <span>{agent.emoji || '🤖'}</span>
                          <span className="text-xs text-cyber-white">{agent.name}</span>
                        </div>
                      ) : (
                        <select
                          onChange={e => { if (e.target.value) assignPhone(phone.id, e.target.value) }}
                          className="bg-cyber-dark border border-cyber-border rounded px-2 py-1 text-xs text-cyber-gray focus:outline-none"
                          aria-label="Assign phone to agent"
                          defaultValue=""
                        >
                          <option value="">Assign agent...</option>
                          {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.emoji || '🤖'} {a.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Routing */}
                    <Badge className="bg-cyber-dark text-cyber-gray border border-cyber-border text-[10px]">
                      {phone.routing_config?.action === 'ai_answer' ? '🤖 AI' : phone.routing_config?.action === 'forward' ? '📲 FWD' : '📬 VM'}
                    </Badge>

                    {/* Status */}
                    <button onClick={() => togglePhone(phone)}>
                      <Badge className={`cursor-pointer text-[10px] ${
                        phone.status === 'active' ? 'bg-cyber-green/20 text-cyber-green' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {phone.status === 'active' ? '● Active' : '○ Inactive'}
                      </Badge>
                    </button>

                    <button onClick={() => deletePhone(phone)} className="text-red-400 hover:text-red-300 p-1" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {phones.length === 0 && (
          <div className="text-center py-16">
            <Phone className="h-16 w-16 text-cyber-gray mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-cyber-white mb-2">No Phone Numbers</h3>
            <p className="text-cyber-gray mb-6">Provision your first number to give agents voice and SMS capabilities</p>
            <Button onClick={() => setShowAdd(true)} className="bg-cyber-green text-cyber-black">
              <Plus className="h-4 w-4 mr-2" /> Provision First Number
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
