import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useWebSocket } from '../providers/websocket-provider'
// @ts-ignore - insforge realtime may not expose exact TS types
import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
  Mic, 
  FolderOpen, 
  BookOpen, 
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Lightbulb,
  Clock,
  ScrollText,
  Wifi,
  WifiOff,
  Link2,
  Phone,
  Headphones,
  Radar,
  Webhook,
  Server,
  Shield,
  Blocks,
  ShoppingBag,
  Search,
  X
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'Empire Control', icon: Shield },
  { path: '/dashboard', label: 'Classic Dashboard', icon: LayoutDashboard },
  { path: '/task-manager', label: 'Task Manager', icon: Users },
  { path: '/org-chart', label: 'Org Chart', icon: GitBranch },
  { path: '/chat', label: 'Agent Chat', icon: MessageSquare },
  { path: '/forum', label: 'Agent Forum', icon: Lightbulb },
  { path: '/voice-standups', label: 'Standups', icon: Mic },
  { path: '/workspaces', label: 'Workspaces', icon: FolderOpen },
  { path: '/assignments', label: 'Assignments', icon: Link2 },
  { path: '/phones', label: 'Phone Registry', icon: Phone },
  { path: '/livekit', label: 'LiveKit', icon: Headphones },
  { path: '/ops-center', label: 'Ops Center', icon: Radar },
  { path: '/workflows', label: 'Workflows', icon: Webhook },
  { path: '/commerce', label: 'Commerce Ops', icon: ShoppingBag },
  { path: '/mcp-control', label: 'MCP Control', icon: Blocks },
  { path: '/openclaw-gateway', label: 'OpenClaw Gateway', icon: Server },
  { path: '/cron-jobs', label: 'Cron Jobs', icon: Clock },
  { path: '/logs', label: 'Overnight Logs', icon: ScrollText },
  { path: '/documentation', label: 'Docs', icon: BookOpen },
  { path: '/settings', label: 'Settings', icon: Settings },
]

interface CommandAction {
  id: string
  label: string
  keywords: string
  run: () => void
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = React.useState(false)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [paletteQuery, setPaletteQuery] = React.useState('')
  const { isConnected, connectionState } = useWebSocket()

  const commandActions = React.useMemo<CommandAction[]>(
    () => [
      ...navItems.map((item) => ({
        id: `nav-${item.path}`,
        label: `Go to ${item.label}`,
        keywords: `navigate route ${item.label} ${item.path}`,
        run: () => navigate(item.path),
      })),
      {
        id: 'toggle-sidebar',
        label: collapsed ? 'Expand Sidebar' : 'Collapse Sidebar',
        keywords: 'sidebar collapse expand',
        run: () => setCollapsed((current) => !current),
      },
      {
        id: 'reload-view',
        label: 'Reload Current View',
        keywords: 'refresh reload page',
        run: () => window.location.reload(),
      },
    ],
    [collapsed, navigate]
  )

  const filteredActions = React.useMemo(() => {
    const query = paletteQuery.trim().toLowerCase()
    if (!query) return commandActions
    return commandActions.filter(
      (action) =>
        action.label.toLowerCase().includes(query) ||
        action.keywords.toLowerCase().includes(query)
    )
  }, [commandActions, paletteQuery])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }

      if (event.key === 'Escape') {
        setPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  React.useEffect(() => {
    if (!paletteOpen) {
      setPaletteQuery('')
    }
  }, [paletteOpen])

  return (
    <div className="flex h-screen bg-cyber-black">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-cyber-dark border-r border-cyber-border flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-cyber-border flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyber-green to-emerald-600 flex items-center justify-center">
                <Activity className="h-5 w-5 text-black" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-cyber-white">AgentForge OS</h1>
                <p className="text-[10px] text-cyber-gray">Agent Control Panel</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-cyber-border text-cyber-gray"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="p-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-between rounded-lg border border-cyber-border px-2.5 py-2 text-cyber-gray hover:text-cyber-white hover:border-cyber-green/40"
          >
            <span className="flex items-center gap-2 text-xs">
              <Search className="h-3.5 w-3.5" />
              {!collapsed && 'Command Palette'}
            </span>
            {!collapsed && <span className="text-[10px] text-cyber-gray">Ctrl+K</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30'
                    : 'text-cyber-gray hover:text-cyber-white hover:bg-cyber-border/50'
                }`
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Status Footer */}
        <div className="p-4 border-t border-cyber-border space-y-2">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 text-cyber-green" />
                {!collapsed && <span className="text-xs text-cyber-green">Real-time Connected</span>}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-red-400" />
                {!collapsed && <span className="text-xs text-red-400">Disconnected</span>}
              </>
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyber-green animate-pulse" />
              <span className="text-xs text-cyber-gray">InsForge Online</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-cyber-border bg-cyber-dark shadow-2xl">
            <div className="flex items-center gap-2 border-b border-cyber-border px-3 py-2">
              <Search className="h-4 w-4 text-cyber-gray" />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Search actions and routes..."
                className="w-full bg-transparent text-sm text-cyber-white placeholder:text-cyber-gray focus:outline-none"
              />
              <button
                onClick={() => setPaletteOpen(false)}
                className="rounded p-1 text-cyber-gray hover:bg-cyber-border hover:text-cyber-white"
                aria-label="Close command palette"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto p-2">
              {filteredActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    action.run()
                    setPaletteOpen(false)
                  }}
                  className="mb-1 w-full rounded-lg border border-transparent px-3 py-2 text-left text-sm text-cyber-gray hover:border-cyber-green/30 hover:bg-cyber-border/40 hover:text-cyber-white"
                >
                  {action.label}
                </button>
              ))}

              {filteredActions.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-cyber-gray">No actions found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
