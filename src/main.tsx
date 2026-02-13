import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { InsforgeProvider } from '@insforge/react'
import { insforge } from './lib/insforge'
import { ThemeProvider } from './components/providers/theme-provider'
import { TooltipProvider } from './components/ui/tooltip'
import { WebSocketProvider } from './components/providers/websocket-provider'
import { AgentProvider } from './components/providers/agent-provider'
import { Toaster } from './components/ui/toaster'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <InsforgeProvider client={insforge}>
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
      </InsforgeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)