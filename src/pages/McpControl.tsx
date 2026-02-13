import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useToast } from '../components/ui/use-toast'
import { useAgentStore } from '../stores/agent-store'
import { insforge } from '../lib/insforge'
import { mergeAgentConfigWithDefaults } from '../lib/agent-defaults'
import {
  DEFAULT_MCP_SERVERS,
  buildActiveMcpServers,
  loadEnabledMcpIds,
  loadMcpRegistry,
  saveEnabledMcpIds,
  saveMcpRegistry,
  type McpServerConfig,
} from '../lib/mcp-registry'
import { Blocks, Copy, Download, Plus, RefreshCw, Save, Server, Sparkles, Trash2, Upload } from 'lucide-react'

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export default function McpControl() {
  const { toast } = useToast()
  const { agents, fetchAgents } = useAgentStore()

  const [servers, setServers] = useState<McpServerConfig[]>(DEFAULT_MCP_SERVERS)
  const [enabledIds, setEnabledIds] = useState<string[]>(DEFAULT_MCP_SERVERS.filter((server) => server.enabled).map((server) => server.id))
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [importPayload, setImportPayload] = useState('')

  const [newServerName, setNewServerName] = useState('')
  const [newServerCategory, setNewServerCategory] = useState('custom')
  const [newServerTransport, setNewServerTransport] = useState<'http' | 'sse' | 'stdio'>('http')
  const [newServerEndpoint, setNewServerEndpoint] = useState('')
  const [newServerCommand, setNewServerCommand] = useState('')

  useEffect(() => {
    setServers(loadMcpRegistry())
    setEnabledIds(loadEnabledMcpIds())
    void fetchAgents()
  }, [])

  const activeServers = useMemo(() => buildActiveMcpServers(servers, enabledIds), [servers, enabledIds])

  const grouped = useMemo(() => {
    const map = new Map<string, McpServerConfig[]>()
    for (const server of servers) {
      const category = server.category || 'other'
      const list = map.get(category) || []
      list.push(server)
      map.set(category, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [servers])

  const toggleEnabled = (id: string) => {
    setEnabledIds((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id)
      return [...current, id]
    })
  }

  const persistRegistry = () => {
    saveMcpRegistry(servers)
    saveEnabledMcpIds(enabledIds)
    toast({
      title: 'MCP registry saved',
      description: `${enabledIds.length} servers enabled for next profile application.`,
    })
  }

  const addCustomServer = () => {
    const name = newServerName.trim()
    if (!name) {
      toast({ title: 'Server name required', description: 'Set a name before adding custom MCP.', variant: 'destructive' })
      return
    }

    const id = `custom-${slugify(name)}`
    if (servers.some((server) => server.id === id)) {
      toast({ title: 'Duplicate server id', description: 'Rename the server and try again.', variant: 'destructive' })
      return
    }

    const custom: McpServerConfig = {
      id,
      name,
      category: newServerCategory.trim() || 'custom',
      description: 'User-defined MCP server',
      transport: newServerTransport,
      endpoint: newServerEndpoint.trim() || undefined,
      command: newServerCommand.trim() || undefined,
      args: [],
      env: [],
      enabled: true,
      source: 'custom',
    }

    setServers((current) => [...current, custom])
    setEnabledIds((current) => [...new Set([...current, id])])

    setNewServerName('')
    setNewServerCategory('custom')
    setNewServerTransport('http')
    setNewServerEndpoint('')
    setNewServerCommand('')
  }

  const removeCustomServer = (id: string) => {
    setServers((current) => current.filter((server) => server.id !== id))
    setEnabledIds((current) => current.filter((entry) => entry !== id))
  }

  const exportRegistry = async () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      enabledIds,
      servers,
    }

    const text = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Registry copied', description: 'MCP registry JSON copied to clipboard.' })
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard copy failed, use the download button.', variant: 'destructive' })
    }

    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mcp-registry-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importRegistry = () => {
    const raw = importPayload.trim()
    if (!raw) {
      toast({ title: 'No import payload', description: 'Paste registry JSON first.', variant: 'destructive' })
      return
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const rows = Array.isArray(parsed.servers) ? (parsed.servers as unknown[]) : []
      const importedServers = rows
        .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => {
          const row = entry as Record<string, unknown>
          const id = typeof row.id === 'string' ? row.id.trim() : ''
          const name = typeof row.name === 'string' ? row.name.trim() : ''
          if (!id || !name) return null
          const transport = row.transport === 'sse' || row.transport === 'stdio' ? row.transport : 'http'
          return {
            id,
            name,
            category: typeof row.category === 'string' ? row.category : 'custom',
            description: typeof row.description === 'string' ? row.description : '',
            transport,
            endpoint: typeof row.endpoint === 'string' ? row.endpoint : undefined,
            command: typeof row.command === 'string' ? row.command : undefined,
            args: Array.isArray(row.args) ? row.args.filter((value): value is string => typeof value === 'string') : [],
            env: Array.isArray(row.env) ? row.env.filter((value): value is string => typeof value === 'string') : [],
            enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
            source: row.source === 'custom' ? 'custom' : 'default',
          } as McpServerConfig
        })
        .filter(Boolean) as McpServerConfig[]

      if (importedServers.length === 0) {
        toast({ title: 'Invalid import', description: 'No valid servers found in payload.', variant: 'destructive' })
        return
      }

      const importedEnabled = Array.isArray(parsed.enabledIds)
        ? (parsed.enabledIds as unknown[]).filter((value): value is string => typeof value === 'string')
        : importedServers.filter((server) => server.enabled).map((server) => server.id)

      setServers(importedServers)
      setEnabledIds(importedEnabled)
      setImportPayload('')
      toast({ title: 'Registry imported', description: `${importedServers.length} MCP servers loaded.` })
    } catch (error: any) {
      toast({ title: 'Import failed', description: error.message || 'Invalid JSON payload.', variant: 'destructive' })
    }
  }

  const applyToAllAgents = async () => {
    if (agents.length === 0) {
      toast({ title: 'No agents found', description: 'Create agents before applying MCP profiles.', variant: 'destructive' })
      return
    }

    setApplying(true)
    try {
      let success = 0
      const failed: string[] = []

      for (const agent of agents) {
        const currentConfig = asRecord(agent.config)
        const merged = mergeAgentConfigWithDefaults(currentConfig)
        const mergedProfile = asRecord(merged.operatingProfile)
        const mergedMcp = asRecord(mergedProfile.mcp)

        const nextConfig = mergeAgentConfigWithDefaults({
          ...merged,
          operatingProfile: {
            ...mergedProfile,
            mcp: {
              ...mergedMcp,
              enabled: true,
              servers: activeServers,
            },
          },
          mcpServers: activeServers,
        })

        const { error } = await insforge.database.from('agents').update({ config: nextConfig }).eq('id', agent.id)
        if (error) {
          failed.push(`${agent.name}: ${error.message}`)
          continue
        }
        success += 1
      }

      saveMcpRegistry(servers)
      saveEnabledMcpIds(enabledIds)
      await fetchAgents()

      if (failed.length > 0) {
        toast({
          title: `Applied to ${success}/${agents.length} agents`,
          description: failed.slice(0, 2).join(' | '),
          variant: 'destructive',
        })
      } else {
        toast({ title: 'MCP profile deployed', description: `Applied to all ${success} agents.` })
      }
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white flex items-center gap-2">
            <Blocks className="h-6 w-6 text-cyber-green" />
            MCP Control Plane
          </h2>
          <p className="text-sm text-cyber-gray">
            Manage the shared MCP stack for every agent. Inspired by Archon-style central context + tool control.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportRegistry} className="border-cyber-border text-cyber-gray hover:text-cyber-white">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={persistRegistry} className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80">
            <Save className="mr-2 h-4 w-4" />
            Save Registry
          </Button>
          <Button onClick={() => void applyToAllAgents()} disabled={applying} className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400">
            {applying ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {applying ? 'Applying...' : 'Apply To All Agents'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Total MCP Servers</p>
            <p className="mt-1 text-2xl font-bold text-cyber-white">{servers.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Enabled</p>
            <p className="mt-1 text-2xl font-bold text-cyber-green">{enabledIds.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Custom MCPs</p>
            <p className="mt-1 text-2xl font-bold text-cyber-white">{servers.filter((server) => server.source === 'custom').length}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-4">
            <p className="text-xs text-cyber-gray">Agents</p>
            <p className="mt-1 text-2xl font-bold text-cyber-white">{agents.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-cyber-green" />
            Add Custom MCP Server
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <Input value={newServerName} onChange={(event) => setNewServerName(event.target.value)} placeholder="Server name" className="border-cyber-border bg-cyber-black text-cyber-white" />
          <Input value={newServerCategory} onChange={(event) => setNewServerCategory(event.target.value)} placeholder="Category" className="border-cyber-border bg-cyber-black text-cyber-white" />
          <select
            value={newServerTransport}
            onChange={(event) => setNewServerTransport(event.target.value as 'http' | 'sse' | 'stdio')}
            className="rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-sm text-cyber-white"
          >
            <option value="http">HTTP</option>
            <option value="sse">SSE</option>
            <option value="stdio">STDIO</option>
          </select>
          <Input
            value={newServerTransport === 'stdio' ? newServerCommand : newServerEndpoint}
            onChange={(event) => {
              if (newServerTransport === 'stdio') setNewServerCommand(event.target.value)
              else setNewServerEndpoint(event.target.value)
            }}
            placeholder={newServerTransport === 'stdio' ? 'Command (e.g. npx -y @server/mcp)' : 'Endpoint URL'}
            className="border-cyber-border bg-cyber-black text-cyber-white"
          />
          <Button onClick={addCustomServer} className="bg-cyber-green text-cyber-black hover:bg-cyber-green/80">
            <Plus className="mr-2 h-4 w-4" />
            Add MCP
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">MCP Server Catalog</CardTitle>
          <CardDescription>
            Toggle the servers each agent should get by default. Save registry, then apply to all agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {grouped.map(([category, rows]) => (
            <div key={category} className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-cyber-gray">{category}</p>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {rows.map((server) => {
                  const enabled = enabledIds.includes(server.id)
                  return (
                    <div key={server.id} className="rounded-lg border border-cyber-border bg-cyber-dark px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-cyber-white flex items-center gap-2">
                            <Server className="h-3.5 w-3.5 text-cyber-green" />
                            {server.name}
                          </p>
                          <p className="mt-1 text-[11px] text-cyber-gray">{server.description}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge className={enabled ? 'bg-cyber-green/20 text-cyber-green' : 'bg-cyber-gray/20 text-cyber-gray'}>
                            {enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {server.source === 'custom' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-400 hover:text-red-300"
                              onClick={() => removeCustomServer(server.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                        <Badge className="bg-cyber-black text-cyber-gray border border-cyber-border">{server.transport}</Badge>
                        {server.endpoint && (
                          <span className="font-mono text-cyber-gray break-all">{server.endpoint}</span>
                        )}
                        {server.command && (
                          <span className="font-mono text-cyber-gray break-all">{server.command} {(server.args || []).join(' ')}</span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={enabled ? 'outline' : 'default'}
                          className={enabled ? 'border-cyber-border text-cyber-gray hover:text-cyber-white' : 'bg-cyber-green text-cyber-black hover:bg-cyber-green/80'}
                          onClick={() => toggleEnabled(server.id)}
                        >
                          {enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">Import Registry JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-cyber-gray text-xs">Paste export payload</Label>
          <textarea
            value={importPayload}
            onChange={(event) => setImportPayload(event.target.value)}
            rows={6}
            className="w-full resize-none rounded-md border border-cyber-border bg-cyber-black px-3 py-2 text-xs font-mono text-cyber-white focus:border-cyber-green/40 focus:outline-none"
            placeholder='{"servers": [...], "enabledIds": [...]}'
          />
          <div className="flex gap-2">
            <Button onClick={importRegistry} className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button
              variant="outline"
              className="border-cyber-border text-cyber-gray hover:text-cyber-white"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  JSON.stringify({ servers, enabledIds }, null, 2),
                )
                toast({ title: 'Copied', description: 'Current registry JSON copied.' })
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Current JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white text-sm">Active MCP Deployment Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-cyber-border bg-cyber-dark p-2">
            {activeServers.map((server) => (
              <div key={server.id} className="rounded border border-cyber-border bg-cyber-black px-2 py-1.5">
                <p className="text-xs text-cyber-white">{server.name}</p>
                <p className="text-[10px] text-cyber-gray">{server.id} • {server.transport}</p>
              </div>
            ))}
            {activeServers.length === 0 && <p className="text-xs text-cyber-gray">No active MCP servers selected.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
