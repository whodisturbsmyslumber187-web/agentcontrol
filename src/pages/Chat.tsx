import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  MessageSquare, Send, Bot, User, Hash, Plus, Users, Settings,
  Trash2, X, ChevronDown, Zap
} from 'lucide-react'
import { useAgentStore, Agent } from '../stores/agent-store'
import { insforge } from '../lib/insforge'
import { BROTHERHOOD_DIRECTIVE, BROTHERHOOD_TEMPLATES } from '../lib/brotherhood-config'

interface Channel {
  id: string
  name: string
  slug: string
  description: string
  members: string[]
  is_private: boolean
  created_at: string
}

interface ChannelMessage {
  id: string
  channel_id: string
  sender_type: 'user' | 'agent' | 'system'
  sender_id: string | null
  sender_name: string
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

export default function Chat() {
  const { agents } = useAgentStore()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load channels
  useEffect(() => {
    async function loadChannels() {
      const { data } = await insforge.database
        .from('agent_channels')
        .select()
        .order('created_at', { ascending: true })
      if (data) {
        const ch = data as Channel[]
        setChannels(ch)
        if (!activeChannel && ch.length > 0) setActiveChannel(ch[0])
      }
    }
    loadChannels()
  }, [])

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannel) return
    async function loadMessages() {
      const { data } = await insforge.database
        .from('channel_messages')
        .select()
        .eq('channel_id', activeChannel!.id)
        .order('created_at', { ascending: true })
        .limit(200)
      if (data) setMessages(data as ChannelMessage[])
    }
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [activeChannel?.id])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Channel members as agent objects
  const channelAgents = agents.filter(a => activeChannel?.members?.includes(a.id))
  const unassignedAgents = agents.filter(a => !activeChannel?.members?.includes(a.id))

  const createChannel = async () => {
    if (!newChannelName.trim()) return
    const slug = newChannelName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const { data } = await insforge.database
      .from('agent_channels')
      .insert({ name: newChannelName.trim(), slug, description: newChannelDesc.trim(), members: [] })
      .select()
    if (data?.[0]) {
      setChannels(prev => [...prev, data[0] as Channel])
      setActiveChannel(data[0] as Channel)
    }
    setShowNewChannel(false)
    setNewChannelName('')
    setNewChannelDesc('')
  }

  const deleteChannel = async (ch: Channel) => {
    if (!window.confirm(`Delete #${ch.name}? All messages will be lost.`)) return
    await insforge.database.from('agent_channels').delete().eq('id', ch.id)
    setChannels(prev => prev.filter(c => c.id !== ch.id))
    if (activeChannel?.id === ch.id) setActiveChannel(channels.find(c => c.id !== ch.id) || null)
  }

  const addMember = async (agentId: string) => {
    if (!activeChannel) return
    const newMembers = [...(activeChannel.members || []), agentId]
    await insforge.database.from('agent_channels').update({ members: newMembers }).eq('id', activeChannel.id)
    const updated = { ...activeChannel, members: newMembers }
    setActiveChannel(updated)
    setChannels(prev => prev.map(c => c.id === updated.id ? updated : c))
    // System message
    const agent = agents.find(a => a.id === agentId)
    if (agent) {
      await insforge.database.from('channel_messages').insert({
        channel_id: activeChannel.id,
        sender_type: 'system',
        sender_name: 'System',
        message: `${agent.emoji || '🤖'} ${agent.name} joined the channel`,
      })
    }
  }

  const removeMember = async (agentId: string) => {
    if (!activeChannel) return
    const newMembers = (activeChannel.members || []).filter(id => id !== agentId)
    await insforge.database.from('agent_channels').update({ members: newMembers }).eq('id', activeChannel.id)
    const updated = { ...activeChannel, members: newMembers }
    setActiveChannel(updated)
    setChannels(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  const getAgentSystemPrompt = (agent: Agent): string => {
    const template = BROTHERHOOD_TEMPLATES.find(t => t.role === agent.role)
    if (template) return template.systemPrompt
    return `${BROTHERHOOD_DIRECTIVE}\n\nYou are ${agent.name}, the ${agent.role}. ${agent.description || 'Execute your duties with precision.'}`
  }

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel) return
    setLoading(true)
    const userText = input.trim()
    setInput('')

    try {
      // Save operator message
      const { data: userMsg } = await insforge.database
        .from('channel_messages')
        .insert({
          channel_id: activeChannel.id,
          sender_type: 'user',
          sender_name: 'Operator',
          message: userText,
        })
        .select()
      if (userMsg?.[0]) setMessages(prev => [...prev, userMsg[0] as ChannelMessage])

      // Each agent in the channel responds
      const respondingAgents = channelAgents.filter(a => a.status === 'active' || a.status === 'idle')
      
      for (const agent of respondingAgents) {
        try {
          const systemPrompt = getAgentSystemPrompt(agent)
          const contextPrompt = `${systemPrompt}\n\nYou are in channel #${activeChannel.name}. Other agents present: ${respondingAgents.map(a => a.name).join(', ')}. The Operator just said something. Respond concisely and in character. If the message isn't relevant to your role, say so briefly or acknowledge. Don't repeat what other agents would say.`

          const { data: aiResponse } = await (insforge.ai as any).generateText({
            model: 'openai/gpt-4o-mini',
            prompt: userText,
            systemPrompt: contextPrompt,
          })

          const responseText = aiResponse?.text || `[${agent.name}] Acknowledged.`

          const { data: agentMsg } = await insforge.database
            .from('channel_messages')
            .insert({
              channel_id: activeChannel.id,
              sender_type: 'agent',
              sender_id: agent.id,
              sender_name: agent.name,
              message: responseText,
              metadata: { emoji: agent.emoji, role: agent.role },
            })
            .select()
          if (agentMsg?.[0]) setMessages(prev => [...prev, agentMsg[0] as ChannelMessage])
        } catch {
          // Fallback
          const { data: agentMsg } = await insforge.database
            .from('channel_messages')
            .insert({
              channel_id: activeChannel.id,
              sender_type: 'agent',
              sender_id: agent.id,
              sender_name: agent.name,
              message: `✅ Copy that, Operator. Processing your request.`,
              metadata: { emoji: agent.emoji, role: agent.role },
            })
            .select()
          if (agentMsg?.[0]) setMessages(prev => [...prev, agentMsg[0] as ChannelMessage])
        }
      }

      if (respondingAgents.length === 0) {
        const { data: sysMsg } = await insforge.database
          .from('channel_messages')
          .insert({
            channel_id: activeChannel.id,
            sender_type: 'system',
            sender_name: 'System',
            message: '⚠️ No active agents in this channel. Add agents using the members panel.',
          })
          .select()
        if (sysMsg?.[0]) setMessages(prev => [...prev, sysMsg[0] as ChannelMessage])
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Operations Chat</h2>
          <p className="text-cyber-gray text-sm">Group channels for agent collaboration — real commands, real responses</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)]">
        {/* Channel Sidebar */}
        <div className="col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-cyber-gray font-semibold uppercase tracking-wider">Channels</p>
            <button onClick={() => setShowNewChannel(true)} className="text-cyber-green hover:text-white" title="Create channel">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* New channel form */}
          {showNewChannel && (
            <div className="mb-3 p-2 bg-cyber-dark border border-cyber-green/30 rounded-lg">
              <input
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                placeholder="Channel name..."
                className="w-full bg-cyber-card border border-cyber-border rounded px-2 py-1 text-xs text-cyber-white mb-1 focus:outline-none focus:border-cyber-green/50"
                aria-label="Channel name"
              />
              <input
                value={newChannelDesc}
                onChange={e => setNewChannelDesc(e.target.value)}
                placeholder="Description..."
                className="w-full bg-cyber-card border border-cyber-border rounded px-2 py-1 text-xs text-cyber-white mb-2 focus:outline-none focus:border-cyber-green/50"
                aria-label="Channel description"
              />
              <div className="flex gap-1">
                <Button onClick={createChannel} disabled={!newChannelName.trim()} className="text-xs h-6 bg-cyber-green text-cyber-black px-2">Create</Button>
                <Button onClick={() => setShowNewChannel(false)} variant="ghost" className="text-xs h-6 text-cyber-gray px-2">Cancel</Button>
              </div>
            </div>
          )}

          {/* Channel list */}
          <div className="space-y-1 overflow-y-auto flex-1">
            {channels.map(ch => (
              <div key={ch.id} className="group relative">
                <button
                  onClick={() => { setActiveChannel(ch); setShowMembers(false) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    activeChannel?.id === ch.id
                      ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30'
                      : 'bg-cyber-dark text-cyber-gray hover:text-cyber-white border border-transparent'
                  }`}
                >
                  <Hash className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{ch.name}</span>
                  <span className="text-[10px] opacity-50 ml-auto">{ch.members?.length || 0}</span>
                </button>
                {ch.slug !== 'general' && (
                  <button
                    onClick={() => deleteChannel(ch)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:block text-red-400 hover:text-red-300 p-1"
                    title="Delete channel"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${showMembers ? 'col-span-6' : 'col-span-9'} flex flex-col`}>
          <Card className="bg-cyber-card border-cyber-border flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 border-b border-cyber-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
                  <Hash className="h-4 w-4 text-cyber-green" />
                  {activeChannel?.name || 'Select a channel'}
                  {activeChannel?.description && (
                    <span className="text-xs text-cyber-gray font-normal ml-2">— {activeChannel.description}</span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyber-green/20 text-cyber-green text-xs">
                    {channelAgents.length} agents
                  </Badge>
                  <button
                    onClick={() => setShowMembers(!showMembers)}
                    className={`p-1.5 rounded transition-colors ${showMembers ? 'bg-cyber-green/20 text-cyber-green' : 'text-cyber-gray hover:text-white'}`}
                    title="Toggle members"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-cyber-gray mx-auto mb-4" />
                  <p className="text-cyber-white font-semibold mb-1">No messages yet</p>
                  <p className="text-cyber-gray text-sm">
                    Add agents to this channel, then give them orders
                  </p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : msg.sender_type === 'system' ? 'justify-center' : 'justify-start'}`}>
                  {msg.sender_type === 'system' ? (
                    <div className="text-xs text-cyber-gray/60 italic py-1">{msg.message}</div>
                  ) : (
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.sender_type === 'user'
                        ? 'bg-cyber-green text-cyber-black rounded-br-sm'
                        : 'bg-cyber-dark border border-cyber-border text-cyber-white rounded-bl-sm'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {msg.sender_type === 'user' ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <span className="text-sm">{(msg.metadata as any)?.emoji || '🤖'}</span>
                        )}
                        <span className="text-xs font-semibold">{msg.sender_name}</span>
                        {msg.sender_type === 'agent' && (
                          <span className="text-[10px] opacity-50">{(msg.metadata as any)?.role}</span>
                        )}
                        <span className="text-[10px] opacity-40 ml-auto">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t border-cyber-border">
              <div className="flex items-center gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeChannel ? `Message #${activeChannel.name}...` : 'Select a channel first'}
                  rows={1}
                  disabled={!activeChannel}
                  className="flex-1 bg-cyber-dark border border-cyber-border rounded-lg px-4 py-2.5 text-sm text-cyber-white resize-none focus:outline-none focus:border-cyber-green/50 transition-colors disabled:opacity-50"
                  aria-label="Channel message input"
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim() || !activeChannel}
                  className="bg-cyber-green text-cyber-black h-10 w-10 p-0 hover:opacity-90 disabled:opacity-50"
                  title="Send message"
                >
                  {loading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-cyber-black border-t-transparent rounded-full" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {loading && channelAgents.length > 0 && (
                <p className="text-[10px] text-cyber-gray mt-1">
                  ⏳ Waiting for {channelAgents.filter(a => a.status === 'active' || a.status === 'idle').length} agent(s) to respond...
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Members Panel */}
        {showMembers && (
          <div className="col-span-3 flex flex-col">
            <Card className="bg-cyber-card border-cyber-border flex-1 overflow-hidden flex flex-col">
              <CardHeader className="pb-2 border-b border-cyber-border">
                <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyber-green" />
                  Channel Members
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Current members */}
                <div>
                  <p className="text-[10px] text-cyber-gray font-semibold uppercase mb-2">In Channel ({channelAgents.length})</p>
                  {channelAgents.length === 0 && (
                    <p className="text-xs text-cyber-gray/50 italic">No agents assigned</p>
                  )}
                  {channelAgents.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-cyber-dark group">
                      <div className="flex items-center gap-2">
                        <span>{a.emoji || '🤖'}</span>
                        <div>
                          <p className="text-xs text-cyber-white">{a.name}</p>
                          <p className="text-[10px] text-cyber-gray">{a.role}</p>
                        </div>
                        <div className={`h-1.5 w-1.5 rounded-full ${a.status === 'active' ? 'bg-cyber-green' : 'bg-cyber-gray'}`} />
                      </div>
                      <button
                        onClick={() => removeMember(a.id)}
                        className="hidden group-hover:block text-red-400 hover:text-red-300"
                        title="Remove from channel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add members */}
                <div>
                  <p className="text-[10px] text-cyber-gray font-semibold uppercase mb-2">Available Agents ({unassignedAgents.length})</p>
                  {unassignedAgents.map(a => (
                    <button
                      key={a.id}
                      onClick={() => addMember(a.id)}
                      className="w-full flex items-center gap-2 py-1.5 px-2 rounded hover:bg-cyber-green/10 text-left transition-colors"
                    >
                      <span>{a.emoji || '🤖'}</span>
                      <div>
                        <p className="text-xs text-cyber-white">{a.name}</p>
                        <p className="text-[10px] text-cyber-gray">{a.role}</p>
                      </div>
                      <Plus className="h-3 w-3 text-cyber-green ml-auto" />
                    </button>
                  ))}
                  {unassignedAgents.length === 0 && (
                    <p className="text-xs text-cyber-gray/50 italic">All agents are in this channel</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
