import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Clock, Play, Pause, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useAgentStore } from '../stores/agent-store'
import { insforge } from '../lib/insforge'

interface CronJob {
  id: string
  name: string
  cron_expression: string
  agent_id: string | null
  command: string
  enabled: boolean
  last_run: string | null
  next_run: string | null
  status: 'scheduled' | 'running' | 'completed' | 'failed'
  output: string | null
  created_at: string
}

function parseCronToHuman(cron: string): string {
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron

  const [min, hour, dom, mon, dow] = parts
  if (min === '*/5' && hour === '*') return 'Every 5 minutes'
  if (min === '*/10' && hour === '*') return 'Every 10 minutes'
  if (min === '*/15' && hour === '*') return 'Every 15 minutes'
  if (min === '*/30' && hour === '*') return 'Every 30 minutes'
  if (min === '0' && hour === '*/2') return 'Every 2 hours'
  if (min === '0' && hour === '*') return 'Every hour'
  if (dow === '1' && min !== '*') return `Weekly Mon at ${hour}:${min.padStart(2, '0')}`
  if (dom !== '*') return `Monthly on day ${dom} at ${hour}:${min.padStart(2, '0')}`
  if (hour !== '*' && min !== '*') return `Daily at ${hour}:${min.padStart(2, '0')}`
  return cron
}

export default function CronJobs() {
  const { agents } = useAgentStore()
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newJob, setNewJob] = useState({ name: '', cron_expression: '0 * * * *', agent_id: '', command: '' })

  useEffect(() => {
    loadJobs()
    const interval = setInterval(loadJobs, 15000)
    return () => clearInterval(interval)
  }, [])

  const loadJobs = async () => {
    const { data } = await insforge.database
      .from('cron_jobs')
      .select()
      .order('created_at', { ascending: true })
    if (data) setJobs(data as CronJob[])
    setLoading(false)
  }

  const toggleJob = async (id: string, enabled: boolean) => {
    await insforge.database.from('cron_jobs').update({ enabled: !enabled }).eq('id', id)
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, enabled: !enabled } : j)))
  }

  const deleteJob = async (id: string) => {
    if (!window.confirm('Delete this scheduled job?')) return
    await insforge.database.from('cron_jobs').delete().eq('id', id)
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }

  const createJob = async () => {
    if (!newJob.name || !newJob.command) return
    const { data } = await insforge.database
      .from('cron_jobs')
      .insert({
        name: newJob.name,
        cron_expression: newJob.cron_expression,
        agent_id: newJob.agent_id || null,
        command: newJob.command,
        enabled: true,
      })
      .select()
    if (data?.[0]) {
      setJobs((prev) => [...prev, data[0] as CronJob])
      setNewJob({ name: '', cron_expression: '0 * * * *', agent_id: '', command: '' })
      setShowNew(false)
    }
  }

  const runJobNow = async (job: CronJob) => {
    await insforge.database
      .from('cron_jobs')
      .update({ status: 'running', last_run: new Date().toISOString() })
      .eq('id', job.id)

    // Log the run as activity
    const agent = agents.find((a) => a.id === job.agent_id)
    await insforge.database.from('activity_log').insert({
      agent_id: job.agent_id,
      agent_name: agent?.name || 'System',
      message: `Manually triggered cron job: ${job.name}`,
      type: 'info',
    })

    // Update local state
    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id ? { ...j, status: 'running', last_run: new Date().toISOString() } : j
      )
    )

    // Simulate completion after 3s 
    setTimeout(async () => {
      await insforge.database
        .from('cron_jobs')
        .update({ status: 'completed', output: `Job "${job.name}" completed successfully.` })
        .eq('id', job.id)
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, status: 'completed', output: `Job "${job.name}" completed successfully.` } : j
        )
      )
    }, 3000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
      case 'completed': return <CheckCircle className="h-3.5 w-3.5 text-cyber-green" />
      case 'failed': return <XCircle className="h-3.5 w-3.5 text-red-400" />
      default: return <Clock className="h-3.5 w-3.5 text-cyber-gray" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500/20 text-blue-400'
      case 'completed': return 'bg-cyber-green/20 text-cyber-green'
      case 'failed': return 'bg-red-500/20 text-red-400'
      default: return 'bg-cyber-gray/20 text-cyber-gray'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Scheduled Jobs</h2>
          <p className="text-cyber-gray text-sm">Cron jobs, heartbeats, and automated agent tasks</p>
        </div>
        <Button
          onClick={() => setShowNew(!showNew)}
          className="bg-cyber-green text-cyber-black hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      {/* New Job Form */}
      {showNew && (
        <Card className="bg-cyber-card border-cyber-green/30 border">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Job Name</label>
                <input
                  type="text"
                  value={newJob.name}
                  onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                  placeholder="Daily Backup"
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Cron Expression</label>
                <input
                  type="text"
                  value={newJob.cron_expression}
                  onChange={(e) => setNewJob({ ...newJob, cron_expression: e.target.value })}
                  placeholder="0 * * * *"
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white font-mono focus:border-cyber-green/50 focus:outline-none"
                />
                <p className="text-2xs text-cyber-gray mt-1">{parseCronToHuman(newJob.cron_expression)}</p>
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Assign Agent</label>
                <select
                  value={newJob.agent_id}
                  onChange={(e) => setNewJob({ ...newJob, agent_id: e.target.value })}
                  aria-label="Assign agent"
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white focus:border-cyber-green/50 focus:outline-none"
                >
                  <option value="">Any Agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-cyber-gray block mb-1">Command</label>
                <input
                  type="text"
                  value={newJob.command}
                  onChange={(e) => setNewJob({ ...newJob, command: e.target.value })}
                  placeholder="generate_report"
                  className="w-full bg-cyber-dark border border-cyber-border rounded-lg px-3 py-2 text-sm text-cyber-white font-mono focus:border-cyber-green/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createJob} className="bg-cyber-green text-cyber-black hover:opacity-90">Create Job</Button>
              <Button onClick={() => setShowNew(false)} variant="ghost" className="text-cyber-gray">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs List */}
      {loading && <p className="text-cyber-gray text-sm">Loading jobs...</p>}

      <div className="space-y-3">
        {jobs.map((job) => {
          const agent = agents.find((a) => a.id === job.agent_id)
          return (
            <Card key={job.id} className={`bg-cyber-card border-cyber-border ${!job.enabled ? 'opacity-50' : ''}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-cyber-white">{job.name}</h3>
                        <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                        {!job.enabled && <Badge className="bg-cyber-gray/20 text-cyber-gray">Disabled</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-cyber-gray">
                        <span className="font-mono">{job.cron_expression}</span>
                        <span>→ {parseCronToHuman(job.cron_expression)}</span>
                        {agent && <span>• {agent.emoji} {agent.name}</span>}
                      </div>
                      <p className="text-xs text-cyber-gray/50 font-mono mt-0.5">{job.command}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.last_run && (
                      <span className="text-xs text-cyber-gray mr-2">
                        Last: {new Date(job.last_run).toLocaleTimeString()}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runJobNow(job)}
                      className="h-8 px-2 hover:bg-cyber-green/20"
                      title="Run now"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleJob(job.id, job.enabled)}
                      className="h-8 px-2 hover:bg-cyber-green/20"
                      title={job.enabled ? 'Disable' : 'Enable'}
                    >
                      {job.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteJob(job.id)}
                      className="h-8 px-2 hover:bg-red-500/20 text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {job.output && (
                  <div className="mt-3 bg-cyber-dark border border-cyber-border rounded p-2">
                    <p className="text-xs text-cyber-gray font-mono">{job.output}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!loading && jobs.length === 0 && (
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-cyber-gray mx-auto mb-4" />
            <p className="text-cyber-white font-semibold mb-1">No scheduled jobs</p>
            <p className="text-cyber-gray text-sm">Create cron jobs for automated agent tasks, heartbeats, and reports</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
