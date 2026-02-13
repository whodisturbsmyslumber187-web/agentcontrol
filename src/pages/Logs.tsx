import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { ScrollText, Search, Filter, Download, RefreshCw, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'
import { insforge } from '../lib/insforge'

interface LogEntry {
  id: string
  agent_name: string
  agent_id: string | null
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
  created_at: string
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadLogs = async () => {
    let query = insforge.database
      .from('activity_log')
      .select()
      .order('created_at', { ascending: false })
      .limit(200)

    const { data } = await query
    if (data) setLogs(data as LogEntry[])
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 10000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = search === '' ||
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.agent_name.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || log.type === typeFilter
    return matchesSearch && matchesType
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-3.5 w-3.5 text-cyber-green" />
      case 'error': return <XCircle className="h-3.5 w-3.5 text-red-400" />
      case 'warning': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
      default: return <Info className="h-3.5 w-3.5 text-blue-400" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-cyber-green'
      case 'error': return 'text-red-400'
      case 'warning': return 'text-yellow-400'
      default: return 'text-blue-400'
    }
  }

  const exportLogs = () => {
    const csvContent = [
      'Timestamp,Agent,Type,Message',
      ...filteredLogs.map((l) =>
        `"${l.created_at}","${l.agent_name}","${l.type}","${l.message.replace(/"/g, '""')}"`
      ),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentforge-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Group logs by date
  const groupedLogs: Record<string, LogEntry[]> = {}
  filteredLogs.forEach((log) => {
    const date = new Date(log.created_at).toLocaleDateString()
    if (!groupedLogs[date]) groupedLogs[date] = []
    groupedLogs[date].push(log)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Overnight Logs</h2>
          <p className="text-cyber-gray text-sm">Full activity feed — what your agents did while you slept</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant="ghost"
            size="sm"
            className={`text-xs ${autoRefresh ? 'text-cyber-green' : 'text-cyber-gray'}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button onClick={exportLogs} variant="ghost" size="sm" className="text-cyber-gray text-xs">
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyber-gray" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs by agent or message..."
            className="w-full bg-cyber-dark border border-cyber-border rounded-lg pl-10 pr-4 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {['all', 'success', 'info', 'warning', 'error'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-cyber-green/20 text-cyber-green'
                  : 'bg-cyber-dark text-cyber-gray hover:text-cyber-white'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        {['success', 'info', 'warning', 'error'].map((type) => {
          const count = logs.filter((l) => l.type === type).length
          return (
            <Card key={type} className="bg-cyber-card border-cyber-border">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(type)}
                    <span className="text-xs text-cyber-gray capitalize">{type}</span>
                  </div>
                  <span className={`text-sm font-bold ${getTypeColor(type)}`}>{count}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Log entries grouped by date */}
      {loading && <p className="text-cyber-gray text-sm">Loading logs...</p>}

      {Object.entries(groupedLogs).map(([date, entries]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-cyber-border" />
            <span className="text-xs text-cyber-gray font-semibold">{date}</span>
            <Badge className="bg-cyber-gray/20 text-cyber-gray">{entries.length}</Badge>
            <div className="h-px flex-1 bg-cyber-border" />
          </div>
          <div className="space-y-1">
            {entries.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 px-3 py-2 rounded hover:bg-cyber-dark/50 transition-colors group"
              >
                <div className="mt-0.5">{getTypeIcon(log.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-cyber-white">{log.agent_name}</span>
                    <span className="text-2xs text-cyber-gray/50 font-mono">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-cyber-gray mt-0.5 break-words">{log.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!loading && filteredLogs.length === 0 && (
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-8 text-center">
            <ScrollText className="h-12 w-12 text-cyber-gray mx-auto mb-4" />
            <p className="text-cyber-white font-semibold mb-1">No logs found</p>
            <p className="text-cyber-gray text-sm">
              {search || typeFilter !== 'all' ? 'Try adjusting your filters' : 'Activity will appear here as agents work'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
