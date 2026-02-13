import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Clock } from 'lucide-react'
import { insforge } from '../../lib/insforge'

interface Activity {
  id: string
  agent_name: string
  message: string
  type: 'success' | 'info' | 'warning' | 'error'
  created_at: string
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from('activity_log')
        .select()
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setActivities(data as Activity[])
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="bg-cyber-card border-cyber-border">
      <CardHeader>
        <CardTitle className="text-cyber-white text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyber-green" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activities.length === 0 && (
          <p className="text-xs text-cyber-gray">No activity yet</p>
        )}
        {activities.map((a) => (
          <div key={a.id} className="flex items-start gap-2 text-xs">
            <div className={`h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.type === 'success' ? 'bg-cyber-green' : a.type === 'error' ? 'bg-red-500' : a.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-400'}`} />
            <div>
              <p className="text-cyber-gray">
                <span className="text-cyber-white font-medium">{a.agent_name}</span>{' '}
                {a.message}
              </p>
              <p className="text-cyber-gray/50">{timeAgo(a.created_at)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
