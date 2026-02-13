import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from './components/providers/theme-provider'
import { useAgentStore } from './stores/agent-store'
import { useWebSocket } from './components/providers/websocket-provider'
import Layout from './components/layout/Layout'
import LoadingScreen from './components/common/LoadingScreen'
import ErrorBoundary from './components/common/ErrorBoundary'
import { Toaster } from './components/ui/toaster'
import { useToast } from './components/ui/use-toast'

// Lazy load pages for code splitting
const TaskManager = lazy(() => import('./pages/TaskManager'))
const OrgChart = lazy(() => import('./pages/OrgChart'))
const VoiceStandups = lazy(() => import('./pages/VoiceStandups'))
const Workspaces = lazy(() => import('./pages/Workspaces'))
const Documentation = lazy(() => import('./pages/Documentation'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))

function AppContent() {
  const { theme } = useTheme()
  const { isConnected, connectionStatus } = useWebSocket()
  const { agents, isLoading, error } = useAgentStore()
  const { toast } = useToast()

  // Show connection status toasts
  React.useEffect(() => {
    if (connectionStatus === 'connected') {
      toast({
        title: 'Connected',
        description: 'Real-time updates enabled',
        variant: 'default',
      })
    } else if (connectionStatus === 'disconnected') {
      toast({
        title: 'Disconnected',
        description: 'Real-time updates paused',
        variant: 'destructive',
      })
    } else if (connectionStatus === 'connecting') {
      toast({
        title: 'Connecting',
        description: 'Establishing real-time connection...',
        variant: 'default',
      })
    }
  }, [connectionStatus, toast])

  // Show agent loading status
  React.useEffect(() => {
    if (isLoading) {
      toast({
        title: 'Loading Agents',
        description: 'Fetching agent data...',
        variant: 'default',
      })
    }
  }, [isLoading, toast])

  // Show agent count on load
  React.useEffect(() => {
    if (agents.length > 0 && !isLoading) {
      toast({
        title: 'Agents Loaded',
        description: `${agents.length} agents ready`,
        variant: 'default',
      })
    }
  }, [agents.length, isLoading, toast])

  // Show errors
  React.useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      })
    }
  }, [error, toast])

  // Check authentication (simplified for now)
  const isAuthenticated = true // TODO: Implement proper auth

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <div className={`min-h-screen bg-cyber-black ${theme === 'dark' ? 'dark' : ''}`}>
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Navigate to="/task-manager" replace />} />
              <Route path="/task-manager" element={<TaskManager />} />
              <Route path="/org-chart" element={<OrgChart />} />
              <Route path="/voice-standups" element={<VoiceStandups />} />
              <Route path="/workspaces" element={<Workspaces />} />
              <Route path="/documentation" element={<Documentation />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/task-manager" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
      <Toaster />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

export default App