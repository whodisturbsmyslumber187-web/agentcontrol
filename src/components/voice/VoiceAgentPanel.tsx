import React, { useState, useEffect } from 'react'
import { LiveKitRoom, RoomAudioRenderer, BarVisualizer, ControlBar } from '@livekit/components-react'
import '@livekit/components-styles'
import { generateLiveKitToken } from '../../lib/livekit'
import { Phone, Mic, MicOff, X } from 'lucide-react'
import { Button } from '../ui/button'

interface VoiceAgentPanelProps {
  agentId: string
  agentName: string
  onClose: () => void
}

export function VoiceAgentPanel({ agentId, agentName, onClose }: VoiceAgentPanelProps) {
  const [token, setToken] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const roomName = `call-${agentId}-${Date.now()}`
        const participantName = 'Operator'
        const { token: t, url: u } = await generateLiveKitToken(roomName, participantName)
        setToken(t)
        setUrl(u)
      } catch (err) {
        setError('Failed to connect to voice server')
      }
    }
    init()
  }, [agentId])

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500 rounded text-red-500">
        {error}
        <Button onClick={onClose} variant="ghost" className="ml-2">Close</Button>
      </div>
    )
  }

  if (!token || !url) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyber-green"></div>
        <span className="ml-3 text-cyber-white">Connecting to secure line...</span>
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={onClose}
      className="flex flex-col h-full bg-cyber-darker"
    >
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="relative">
          <div className="absolute inset-0 bg-cyber-green/20 blur-xl rounded-full animate-pulse"></div>
          <div className="relative h-24 w-24 rounded-full bg-cyber-dark border-2 border-cyber-green flex items-center justify-center">
            <Phone className="h-10 w-10 text-cyber-green" />
          </div>
        </div>
        
        <h3 className="mt-6 text-xl font-bold text-cyber-white">{agentName}</h3>
        <p className="text-cyber-green font-mono text-sm animate-pulse">VOICE LINK ACTIVE</p>

        <div className="h-16 w-full max-w-md mt-8 flex items-end justify-center gap-1">
          {/* <BarVisualizer
            state="expanded"
            barCount={7}
            trackRef={{ publication: undefined, source: undefined }} 
          /> */}
{/* VoiceStatus removed */}
        </div>
      </div>

      <div className="p-4 border-t border-cyber-border bg-cyber-card">
        <ControlBar 
            controls={{ microphone: true, camera: false, screenShare: false, chat: false, leave: true }}
            variation="minimal"
        />
      </div>
      
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

