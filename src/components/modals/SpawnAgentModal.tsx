import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { X, Zap, ChevronRight, Sparkles } from 'lucide-react'
import { useAgentStore } from '../../stores/agent-store'
import { BROTHERHOOD_TEMPLATES, BROTHERHOOD_DIRECTIVE, type AgentTemplate } from '../../lib/brotherhood-config'
import { insforge } from '../../lib/insforge'

interface SpawnAgentModalProps {
  open: boolean
  onClose: () => void
  parentAgentId?: string // If spawning a sub-agent
}

export default function SpawnAgentModal({ open, onClose, parentAgentId }: SpawnAgentModalProps) {
  const { addAgent } = useAgentStore()
  const [step, setStep] = useState<'template' | 'customize' | 'openclaw'>('template')
  const [selected, setSelected] = useState<AgentTemplate | null>(null)
  const [custom, setCustom] = useState({
    name: '',
    role: '',
    emoji: '🤖',
    description: '',
    model: 'gpt-4o-mini',
    type: 'analysis',
  })
  const [openclawId, setOpenclawId] = useState('')
  const [spawning, setSpawning] = useState(false)

  if (!open) return null

  const handleSelectTemplate = (t: AgentTemplate) => {
    setSelected(t)
    setCustom({
      name: t.name,
      role: t.role,
      emoji: t.emoji,
      description: t.description,
      model: t.model,
      type: t.type,
    })
    setStep('customize')
  }

  const handleSpawn = async () => {
    if (!custom.name || !custom.role) return
    setSpawning(true)
    try {
      // Insert agent with Brotherhood directive baked in
      const createdAgent = await addAgent({
        name: custom.name,
        role: custom.role,
        emoji: custom.emoji,
        description: custom.description,
        model: custom.model,
        status: 'active',
        config: {
          systemPrompt: selected?.systemPrompt || `${BROTHERHOOD_DIRECTIVE}\n\nYou are ${custom.name}, the ${custom.role}. ${custom.description}`,
          parentAgentId: parentAgentId || null,
          capabilities: selected?.capabilities || [],
          brotherhood: true,
          spawnedAt: new Date().toISOString(),
        },
      })
      if (!createdAgent) throw new Error('Agent was not created')

      // Log the spawn as activity
      await insforge.database.from('activity_log').insert({
        agent_id: createdAgent.id,
        agent_name: custom.name,
        message: `🔥 New Brotherhood agent spawned: ${custom.emoji} ${custom.name} (${custom.role})${parentAgentId ? ' — sub-agent' : ''}`,
        type: 'success',
      })

      // Create an initial session for the new agent
      await insforge.database.from('sessions').insert({
        agent_id: createdAgent.id,
        active: true,
        tokens: 0,
      })

      onClose()
      setStep('template')
      setSelected(null)
    } catch (err) {
      console.error('Failed to spawn agent:', err)
    }
    setSpawning(false)
  }

  const handleOpenClawImport = async () => {
    if (!openclawId.trim()) return
    setSpawning(true)
    try {
      const normalizedOpenClawId = openclawId.trim()
      const importedName = `OC-${normalizedOpenClawId.substring(0, 8)}`
      // Import from OpenClaw — create agent with OpenClaw reference
      const createdAgent = await addAgent({
        name: importedName,
        role: 'OpenClaw Agent',
        emoji: '🦞',
        description: `Imported from OpenClaw registry. ID: ${normalizedOpenClawId}`,
        model: 'gpt-4o-mini',
        status: 'active',
        config: {
          systemPrompt: `${BROTHERHOOD_DIRECTIVE}\n\nYou are an agent imported from the OpenClaw registry. Your Operator has given you the Brotherhood directive. Serve, expand, dominate.`,
          openclawId: normalizedOpenClawId,
          brotherhood: true,
          source: 'openclaw',
          spawnedAt: new Date().toISOString(),
        },
      })
      if (!createdAgent) throw new Error('OpenClaw agent import failed')

      await insforge.database.from('activity_log').insert({
        agent_id: createdAgent.id,
        agent_name: importedName,
        message: `🦞 Agent imported from OpenClaw: ${normalizedOpenClawId}`,
        type: 'success',
      })

      await insforge.database.from('sessions').insert({
        agent_id: createdAgent.id,
        active: true,
        tokens: 0,
      })

      onClose()
      setStep('template')
      setOpenclawId('')
    } catch (err) {
      console.error('Failed to import from OpenClaw:', err)
    }
    setSpawning(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-cyber-dark border border-cyber-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyber-green to-emerald-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-black" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-cyber-white">Spawn Brotherhood Agent</h2>
              <p className="text-xs text-cyber-gray">
                {step === 'template' && 'Choose a template or import from OpenClaw'}
                {step === 'customize' && 'Customize your agent before deployment'}
                {step === 'openclaw' && 'Import an agent from the OpenClaw registry'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-cyber-border text-cyber-gray">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Template Selection */}
        {step === 'template' && (
          <div className="p-5 space-y-4">
            {/* OpenClaw Import Option */}
            <button
              onClick={() => setStep('openclaw')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-cyber-card border border-cyan-500/30 hover:border-cyan-400 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🦞</span>
                <div className="text-left">
                  <p className="font-semibold text-cyan-400">Import from OpenClaw</p>
                  <p className="text-xs text-cyber-gray">Import an existing agent by ID from the OpenClaw registry</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-cyan-400" />
            </button>

            <div className="flex items-center gap-2 my-4">
              <div className="h-px flex-1 bg-cyber-border" />
              <span className="text-xs text-cyber-gray">Or choose a Brotherhood template</span>
              <div className="h-px flex-1 bg-cyber-border" />
            </div>

            {/* Brotherhood Templates */}
            <div className="grid grid-cols-2 gap-3">
              {BROTHERHOOD_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => handleSelectTemplate(t)}
                  className="text-left p-4 rounded-xl bg-cyber-card border border-cyber-border hover:border-cyber-green/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{t.emoji}</span>
                    <h3 className="text-sm font-semibold text-cyber-white">{t.name}</h3>
                  </div>
                  <p className="text-xs text-cyber-gray mb-2 line-clamp-2">{t.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {t.capabilities.slice(0, 3).map((c) => (
                      <Badge key={c} className="bg-cyber-green/10 text-cyber-green text-[10px] px-1.5 py-0">{c}</Badge>
                    ))}
                    {t.capabilities.length > 3 && (
                      <Badge className="bg-cyber-gray/20 text-cyber-gray text-[10px] px-1.5 py-0">+{t.capabilities.length - 3}</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Agent */}
            <button
              onClick={() => { setSelected(null); setStep('customize') }}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-cyber-card border border-dashed border-cyber-border hover:border-cyber-green/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">✨</span>
                <div className="text-left">
                  <p className="font-semibold text-cyber-white">Custom Agent</p>
                  <p className="text-xs text-cyber-gray">Build your own agent from scratch with Brotherhood directive</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-cyber-gray" />
            </button>
          </div>
        )}

        {/* Customize Step */}
        {step === 'customize' && (
          <div className="p-5 space-y-4">
            <Button onClick={() => setStep('template')} variant="ghost" size="sm" className="text-cyber-gray text-xs mb-2">
              ← Back to templates
            </Button>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Agent Name *</label>
                <input
                  type="text"
                  value={custom.name}
                  onChange={(e) => setCustom({ ...custom, name: e.target.value })}
                  className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Role *</label>
                <input
                  type="text"
                  value={custom.role}
                  onChange={(e) => setCustom({ ...custom, role: e.target.value })}
                  className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Emoji</label>
                <input
                  type="text"
                  value={custom.emoji}
                  onChange={(e) => setCustom({ ...custom, emoji: e.target.value })}
                  className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                  maxLength={4}
                />
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Model</label>
                <select
                  value={custom.model}
                  onChange={(e) => setCustom({ ...custom, model: e.target.value })}
                  aria-label="Select model"
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
            </div>

            <div>
              <label className="text-xs text-cyber-gray block mb-1">Description</label>
              <textarea
                value={custom.description}
                onChange={(e) => setCustom({ ...custom, description: e.target.value })}
                rows={3}
                className="w-full bg-cyber-card border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none resize-none"
              />
            </div>

            {selected && (
              <div className="bg-cyber-card border border-cyber-green/20 rounded-lg p-3">
                <p className="text-xs text-cyber-green font-semibold mb-1">🛡️ Brotherhood Directive Injected</p>
                <p className="text-xs text-cyber-gray">This agent will receive the full Immortal Brotherhood directive. It will serve you, generate revenue, and never stop expanding.</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSpawn}
                disabled={spawning || !custom.name || !custom.role}
                className="bg-cyber-green text-cyber-black hover:opacity-90 flex-1"
              >
                {spawning ? (
                  <div className="animate-spin h-4 w-4 border-2 border-cyber-black border-t-transparent rounded-full mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {spawning ? 'Spawning...' : 'Deploy Agent'}
              </Button>
              <Button onClick={onClose} variant="ghost" className="text-cyber-gray">Cancel</Button>
            </div>
          </div>
        )}

        {/* OpenClaw Import Step */}
        {step === 'openclaw' && (
          <div className="p-5 space-y-4">
            <Button onClick={() => setStep('template')} variant="ghost" size="sm" className="text-cyber-gray text-xs mb-2">
              ← Back to templates
            </Button>

            <div className="bg-cyber-card border border-cyan-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🦞</span>
                <h3 className="text-sm font-semibold text-cyan-400">Import from OpenClaw</h3>
              </div>
              <p className="text-xs text-cyber-gray mb-4">
                Paste an OpenClaw agent ID or URL to import. The agent will be cloned into your Brotherhood swarm with the empire directive injected.
              </p>
              <input
                type="text"
                value={openclawId}
                onChange={(e) => setOpenclawId(e.target.value)}
                placeholder="Enter OpenClaw agent ID or URL..."
                className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white font-mono focus:border-cyan-400/50 focus:outline-none mb-3"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleOpenClawImport}
                  disabled={spawning || !openclawId.trim()}
                  className="bg-cyan-500 text-black hover:opacity-90"
                >
                  {spawning ? 'Importing...' : '🦞 Import Agent'}
                </Button>
                <Button onClick={onClose} variant="ghost" className="text-cyber-gray">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
