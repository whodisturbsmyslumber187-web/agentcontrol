import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { FolderOpen, Save, FileText } from 'lucide-react'
import { useAgentStore } from '../stores/agent-store'
import { insforge } from '../lib/insforge'
import localProjectInventory from '../data/local-project-inventory.json'

const FILE_TYPES = ['SOUL.md', 'IDENTITY.md', 'USER.md', 'INSTRUCTIONS.md', 'KNOWLEDGE.md']

interface LocalProjectEntry {
  name: string
  path: string
  root: string
  type: string
  markers: string[]
  updatedAt: string | null
}

interface LocalInventoryPayload {
  generatedAt: string
  roots: string[]
  total: number
  projects: LocalProjectEntry[]
}

const INVENTORY = localProjectInventory as LocalInventoryPayload

export default function Workspaces() {
  const { agents } = useAgentStore()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState('SOUL.md')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [projectQuery, setProjectQuery] = useState('')

  // Load file content when agent or file changes
  useEffect(() => {
    if (!selectedAgent) {
      if (agents.length > 0) setSelectedAgent(agents[0].id)
      return
    }
    async function load() {
      const { data } = await insforge.database
        .from('workspace_files')
        .select()
        .eq('agent_id', selectedAgent)
        .eq('filename', selectedFile)
        .maybeSingle()
      setContent(data?.content || '')
      setLastSaved(data?.updated_at || null)
    }
    load()
  }, [selectedAgent, selectedFile, agents])

  const saveFile = async () => {
    if (!selectedAgent) return
    setSaving(true)
    try {
      // Upsert: insert or update on conflict
      const { data: existing } = await insforge.database
        .from('workspace_files')
        .select('id')
        .eq('agent_id', selectedAgent)
        .eq('filename', selectedFile)
        .maybeSingle()

      if (existing) {
        await insforge.database
          .from('workspace_files')
          .update({ content })
          .eq('id', existing.id)
      } else {
        await insforge.database
          .from('workspace_files')
          .insert({ agent_id: selectedAgent, filename: selectedFile, content })
      }
      setLastSaved(new Date().toISOString())
    } catch (err) {
      console.error('Failed to save:', err)
    }
    setSaving(false)
  }

  const agent = agents.find((a) => a.id === selectedAgent)
  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase()
    if (!query) return INVENTORY.projects.slice(0, 40)
    return INVENTORY.projects
      .filter((project) => {
        const haystack = `${project.name} ${project.path} ${project.type} ${project.markers.join(' ')}`.toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 40)
  }, [projectQuery])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Workspaces</h2>
          <p className="text-cyber-gray text-sm">Edit agent configuration and identity files. Browse local project inventory for agent context.</p>
        </div>
      </div>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">
            Local Project Inventory ({INVENTORY.total})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2">
              <p className="text-[11px] text-cyber-gray">Inventory Generated</p>
              <p className="text-xs text-cyber-white mt-1">
                {new Date(INVENTORY.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2 md:col-span-2">
              <p className="text-[11px] text-cyber-gray">Scan Roots</p>
              <p className="text-xs text-cyber-white mt-1 break-all">
                {INVENTORY.roots.join(' | ')}
              </p>
            </div>
          </div>

          <p className="text-xs text-cyber-gray">
            Refresh inventory with <span className="font-mono text-cyber-white">npm run scan:local-projects</span>.
          </p>

          <input
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            placeholder="Filter projects by name/path/type..."
            className="w-full rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/40 focus:outline-none"
          />

          <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-cyber-border bg-cyber-dark/30 p-2">
            {filteredProjects.map((project) => (
              <div key={project.path} className="rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-cyber-white">{project.name}</p>
                  <span className="text-[10px] uppercase text-cyber-green">{project.type}</span>
                </div>
                <p className="mt-1 break-all font-mono text-[10px] text-cyber-gray">{project.path}</p>
                <p className="mt-1 text-[10px] text-cyber-gray">Markers: {project.markers.join(', ') || 'none'}</p>
              </div>
            ))}

            {filteredProjects.length === 0 && (
              <p className="px-3 py-4 text-xs text-cyber-gray">No projects match this filter.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        {/* Agent Sidebar */}
        <div className="col-span-3 space-y-2 overflow-y-auto">
          <p className="text-xs text-cyber-gray font-semibold uppercase tracking-wider mb-2">Agents</p>
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedAgent === a.id
                  ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30'
                  : 'bg-cyber-dark text-cyber-gray hover:text-cyber-white border border-transparent'
              }`}
            >
              <span className="mr-2">{a.emoji || '🤖'}</span>
              {a.name}
              <span className="text-xs ml-1 opacity-60">({a.role})</span>
            </button>
          ))}

          {selectedAgent && (
            <>
              <hr className="border-cyber-border my-3" />
              <p className="text-xs text-cyber-gray font-semibold uppercase tracking-wider mb-2">Files</p>
              {FILE_TYPES.map((file) => (
                <button
                  key={file}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                    selectedFile === file
                      ? 'text-cyber-green bg-cyber-green/10'
                      : 'text-cyber-gray hover:text-cyber-white'
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  {file}
                </button>
              ))}
            </>
          )}
        </div>

        {/* File Editor */}
        <div className="col-span-9">
          <Card className="bg-cyber-card border-cyber-border h-full flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-cyber-green" />
                  {agent ? `${agent.emoji || '🤖'} ${agent.name}` : 'Select an agent'} / {selectedFile}
                </CardTitle>
                <div className="flex items-center gap-3">
                  {lastSaved && (
                    <span className="text-xs text-cyber-gray">
                      Saved: {new Date(lastSaved).toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    onClick={saveFile}
                    disabled={saving || !selectedAgent}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyber-green text-cyber-black text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={selectedAgent ? `Write ${selectedFile} content for ${agent?.name || 'agent'}...` : 'Select an agent from the sidebar'}
                className="w-full h-full bg-cyber-dark border border-cyber-border rounded-lg p-4 text-sm text-cyber-white font-mono resize-none focus:outline-none focus:border-cyber-green/50 transition-colors"
                aria-label={`Editor for ${selectedFile}`}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
