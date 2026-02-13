import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { BookOpen } from 'lucide-react'

export default function Documentation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cyber-white">Documentation</h1>
        <p className="text-cyber-gray mt-1">Living docs auto-updated from agent activities</p>
      </div>
      <Card className="bg-cyber-card border-cyber-border">
        <CardHeader>
          <CardTitle className="text-cyber-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-cyber-green" />
            Agent Documentation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-cyber-gray text-sm">Documentation will be auto-generated from agent activities and standups. Connect your OpenClaw API to start building living documentation.</p>
        </CardContent>
      </Card>
    </div>
  )
}
