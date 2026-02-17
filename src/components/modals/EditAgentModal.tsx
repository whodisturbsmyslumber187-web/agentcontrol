import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { X, Save, Key, Copy, RefreshCw } from 'lucide-react'
import { useAgentStore, type Agent } from '../../stores/agent-store'
import { insforge } from '../../lib/insforge'

interface EditAgentModalProps {
  open: boolean
  onClose: () => void
  agent: Agent | null
}

export default function EditAgentModal({ open, onClose, agent }: EditAgentModalProps) {
  const { updateAgent } = useAgentStore()
  const [activeTab, setActiveTab] = useState<'general' | 'api'>('general')
  const [form, setForm] = useState({
    name: '',
    role: '',
    emoji: '',
    description: '',
    model: '',
    status: '' as Agent['status'],
  })
  const [saving, setSaving] = useState(false)
  const [apiKey, setApiKey] = useState<string>('')
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name || '',
        role: agent.role || '',
        emoji: agent.emoji || '🤖',
        description: agent.description || '',
        model: agent.model || 'gpt-4o-mini',
        status: agent.status || 'idle',
      })
      setApiKey(agent.api_key || '')
    }
  }, [agent])

  if (!open || !agent) return null

  const handleSave = async () => {
    setSaving(true)
    await updateAgent(agent.id, {
      name: form.name,
      role: form.role,
      emoji: form.emoji,
      description: form.description,
      model: form.model,
      status: form.status,
    })
    setSaving(false)
    onClose()
  }

  const handleRegenerateKey = async () => {
    if (!confirm('Are you sure? The old key will stop working immediately.')) return
    setRegenerating(true)
    try {
      // 1. Generate new UUID via SQL or just let DB do it (difficult to update with default)
      // We will generate client side for now or use a clean update
      const newKey = crypto.randomUUID()
      await updateAgent(agent.id, { api_key: newKey })
      setApiKey(newKey)
    } catch (e) {
      console.error('Failed to regenerate key', e)
    } finally {
      setRegenerating(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey)
    // alert('Copied!') - optional toast
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-cyber-dark border border-cyber-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{form.emoji}</span>
            <div>
              <h2 className="text-lg font-bold text-cyber-white">Edit Agent</h2>
              <p className="text-xs text-cyber-gray">Manage settings & API access</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-cyber-border text-cyber-gray" aria-label="Close modal" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cyber-border px-5">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general' ? 'border-cyber-green text-cyber-green' : 'border-transparent text-cyber-gray hover:text-cyber-white'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'api' ? 'border-cyber-green text-cyber-green' : 'border-transparent text-cyber-gray hover:text-cyber-white'
            }`}
          >
            API Access
          </button>
        </div>

        <div className="p-5 space-y-4 min-h-[300px]">
          {activeTab === 'general' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-cyber-gray block mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Agent name"
                    className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-cyber-gray block mb-1">Emoji</label>
                  <input
                    type="text"
                    value={form.emoji}
                    onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                    className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                    maxLength={4}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-cyber-gray block mb-1">Role</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Agent role"
                  className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-cyber-gray block mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="What does this agent do?"
                  className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-cyber-gray block mb-1">Model</label>
                  <select
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    aria-label="Agent model"
                    className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  >
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="deepseek-r1">DeepSeek R1</option>
                    <option value="grok-3">Grok 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-cyber-gray block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as Agent['status'] })}
                    aria-label="Agent status"
                    className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  >
                    <option value="active">🟢 Active</option>
                    <option value="idle">🟡 Idle</option>
                    <option value="error">🔴 Error</option>
                    <option value="offline">⚫ Offline</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-500 font-medium mb-1">⚠️ Private Access Key</p>
                <p className="text-[11px] text-cyber-gray">
                  This key grants this agent full programmatic access to the system. Keep it secure.
                  Do not share it with unauthorized users.
                </p>
              </div>

              <div>
                <label className="text-xs text-cyber-gray block mb-1">Agent API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={apiKey}
                      readOnly
                      placeholder="No API key generated"
                      className="w-full bg-cyber-black border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-green font-mono focus:outline-none"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-cyber-gray hover:text-white"
                        onClick={copyToClipboard}
                        title="Copy to clipboard"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-cyber-border">
                <h3 className="text-sm font-medium text-cyber-white mb-2">Danger Zone</h3>
                <Button
                  variant="outline"
                  onClick={handleRegenerateKey}
                  disabled={regenerating}
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                  {regenerating ? 'Regenerating...' : 'Regenerate API Key'}
                </Button>
                <p className="text-[10px] text-cyber-gray mt-2 text-center">
                  Regenerating will invalidate the old key immediately.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving || !form.name || !form.role}
                className="bg-cyber-green text-cyber-black hover:opacity-90 flex-1"
              >
                {saving ? (
                  <div className="animate-spin h-4 w-4 border-2 border-cyber-black border-t-transparent rounded-full mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button onClick={onClose} variant="ghost" className="text-cyber-gray">Cancel</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
