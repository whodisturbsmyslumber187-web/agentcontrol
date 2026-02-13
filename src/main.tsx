import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './components/providers/theme-provider'
import { Toaster } from './components/ui/toaster'
import { TooltipProvider } from './components/ui/tooltip'
import { AgentProvider } from './components/providers/agent-provider'
import { WebSocketProvider } from './components/providers/websocket-provider'
import App from './App'
import './index.css'

// Initialize error tracking
if (import.meta.env.PROD) {
  // TODO: Add Sentry or similar error tracking
  console.log('Production mode enabled')
}

// Initialize performance monitoring
if ('performance' in window) {
  const perf = window.performance
  console.log('Performance API available:', perf.timing)
}

// Initialize service worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}

// Initialize global error handler
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error)
  // TODO: Send to error tracking service
})

// Initialize unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  // TODO: Send to error tracking service
})

// Initialize beforeunload handler for data persistence
window.addEventListener('beforeunload', (event) => {
  // Save any unsaved data
  const hasUnsavedChanges = false // TODO: Implement check
  if (hasUnsavedChanges) {
    event.preventDefault()
    event.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark" storageKey="agentforge-theme">
        <TooltipProvider>
          <WebSocketProvider>
            <AgentProvider>
              <App />
              <Toaster />
            </AgentProvider>
          </WebSocketProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)