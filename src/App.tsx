import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@insforge/react'
import Layout from './components/layout/Layout'
import LoadingScreen from './components/common/LoadingScreen'
import ErrorBoundary from './components/common/ErrorBoundary'

// Lazy-loaded pages
const EmpireControl = React.lazy(() => import('./pages/EmpireControl'))
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const TaskManager = React.lazy(() => import('./pages/TaskManager'))
const OrgChart = React.lazy(() => import('./pages/OrgChart'))
const VoiceStandups = React.lazy(() => import('./pages/VoiceStandups'))
const Workspaces = React.lazy(() => import('./pages/Workspaces'))
const Documentation = React.lazy(() => import('./pages/Documentation'))
const Settings = React.lazy(() => import('./pages/Settings'))
const Chat = React.lazy(() => import('./pages/Chat'))
const AgentForum = React.lazy(() => import('./pages/AgentForum'))
const CronJobs = React.lazy(() => import('./pages/CronJobs'))
const Logs = React.lazy(() => import('./pages/Logs'))
const Assignments = React.lazy(() => import('./pages/Assignments'))
const PhoneRegistry = React.lazy(() => import('./pages/PhoneRegistry'))
const LiveKitDashboard = React.lazy(() => import('./pages/LiveKitDashboard'))
const OperationsCenter = React.lazy(() => import('./pages/OperationsCenter'))
const Workflows = React.lazy(() => import('./pages/Workflows'))
const McpControl = React.lazy(() => import('./pages/McpControl'))
const CommerceOps = React.lazy(() => import('./pages/CommerceOps'))
const OpenClawGateway = React.lazy(() => import('./pages/OpenClawGateway'))
const Login = React.lazy(() => import('./pages/Login'))

function AppContent() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return <LoadingScreen />
  }

  if (!isSignedIn) {
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
    <Layout>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<EmpireControl />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/task-manager" element={<TaskManager />} />
          <Route path="/org-chart" element={<OrgChart />} />
          <Route path="/voice-standups" element={<VoiceStandups />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/forum" element={<AgentForum />} />
          <Route path="/cron-jobs" element={<CronJobs />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/phones" element={<PhoneRegistry />} />
          <Route path="/livekit" element={<LiveKitDashboard />} />
          <Route path="/ops-center" element={<OperationsCenter />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/mcp-control" element={<McpControl />} />
          <Route path="/commerce" element={<CommerceOps />} />
          <Route path="/openclaw-gateway" element={<OpenClawGateway />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}
