import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Mic, Play, Users, Clock } from 'lucide-react'
import { insforge } from '../lib/insforge'

interface Standup {
  id: string
  title: string
  participants: string[]
  duration: number
  summary: string | null
  action_items: { text: string; assignee?: string }[]
  recording_url: string | null
  started_at: string
  created_at: string
}

export default function VoiceStandups() {
  const [standups, setStandups] = useState<Standup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from('standups')
        .select()
        .order('started_at', { ascending: false })
      if (data) setStandups(data as Standup[])
      setLoading(false)
    }
    load()
  }, [])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyber-white">Voice Standups</h2>
          <p className="text-cyber-gray text-sm">Agent team meetings and voice reports</p>
        </div>
        <button className="px-4 py-2 rounded-lg bg-cyber-green text-cyber-black font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
          <Mic className="h-4 w-4" />
          New Standup
        </button>
      </div>

      {loading && <p className="text-cyber-gray text-sm">Loading standups...</p>}

      {!loading && standups.length === 0 && (
        <Card className="bg-cyber-card border-cyber-border">
          <CardContent className="p-8 text-center">
            <Mic className="h-12 w-12 text-cyber-gray mx-auto mb-4" />
            <p className="text-cyber-white font-semibold mb-1">No standups yet</p>
            <p className="text-cyber-gray text-sm">Start a voice standup to coordinate your agent fleet</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {standups.map((standup) => (
          <Card key={standup.id} className="bg-cyber-card border-cyber-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-cyber-white text-base">{standup.title}</CardTitle>
                <div className="flex items-center gap-4 text-xs text-cyber-gray">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {standup.participants.length} participants
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(standup.duration)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {standup.summary && (
                <p className="text-sm text-cyber-gray">{standup.summary}</p>
              )}

              {standup.action_items && standup.action_items.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-cyber-white mb-1">Action Items:</p>
                  <ul className="space-y-1">
                    {standup.action_items.map((item, i) => (
                      <li key={i} className="text-xs text-cyber-gray flex items-start gap-2">
                        <span className="text-cyber-green mt-0.5">•</span>
                        <span>
                          {item.text}
                          {item.assignee && (
                            <span className="text-cyber-green ml-1">→ {item.assignee}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {standup.recording_url && (
                <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-cyber-dark border border-cyber-border text-xs text-cyber-gray hover:text-cyber-white transition-colors">
                  <Play className="h-3 w-3" />
                  Play Recording
                </button>
              )}

              <p className="text-xs text-cyber-gray/50">
                {new Date(standup.started_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
