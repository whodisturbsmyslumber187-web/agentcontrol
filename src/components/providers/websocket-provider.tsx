import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { insforge } from '../../lib/insforge'
import { useAgentStore } from '../../stores/agent-store'
import { useOpenClawStore } from '../../stores/openclaw-store'
import { useBusinessStore } from '../../stores/business-store'

interface WebSocketContextValue {
  isConnected: boolean
  connectionState: string
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  connectionState: 'disconnected',
})

export function useWebSocket() {
  return useContext(WebSocketContext)
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState('disconnected')

  const setupRealtime = useCallback(async () => {
    try {
      await insforge.realtime.connect()

      insforge.realtime.on('connect', () => {
        setIsConnected(true)
        setConnectionState('connected')
      })

      insforge.realtime.on('disconnect', () => {
        setIsConnected(false)
        setConnectionState('disconnected')
      })

      insforge.realtime.on('connect_error', () => {
        setConnectionState('error')
      })

      // Subscribe to all data channels
      await insforge.realtime.subscribe('agents')
      await insforge.realtime.subscribe('sessions')
      await insforge.realtime.subscribe('businesses')
      await insforge.realtime.subscribe('activity')

      // Listen for agent updates
      insforge.realtime.on('INSERT_agent', () => {
        useAgentStore.getState().fetchAgents()
      })
      insforge.realtime.on('UPDATE_agent', () => {
        useAgentStore.getState().fetchAgents()
      })

      // Listen for session updates
      insforge.realtime.on('INSERT_session', () => {
        useOpenClawStore.getState().fetchSessions()
      })
      insforge.realtime.on('UPDATE_session', () => {
        useOpenClawStore.getState().fetchSessions()
      })

      // Listen for business updates
      insforge.realtime.on('INSERT_business', () => {
        useBusinessStore.getState().fetchBusinesses()
      })
      insforge.realtime.on('UPDATE_business', () => {
        useBusinessStore.getState().fetchBusinesses()
      })

      setIsConnected(true)
      setConnectionState('connected')
    } catch (err) {
      console.warn('Real-time connection failed, data will still load via API:', err)
      setConnectionState('fallback')
    }
  }, [])

  useEffect(() => {
    setupRealtime()
    return () => {
      insforge.realtime.disconnect()
    }
  }, [setupRealtime])

  return (
    <WebSocketContext.Provider value={{ isConnected, connectionState }}>
      {children}
    </WebSocketContext.Provider>
  )
}
