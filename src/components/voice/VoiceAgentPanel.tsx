import React, { useEffect, useMemo, useState } from 'react'
import { LiveKitRoom, RoomAudioRenderer, ControlBar } from '@livekit/components-react'
import '@livekit/components-styles'
import { generateLiveKitToken } from '../../lib/livekit'
import { invokeAgentSynthesizeTts } from '../../lib/agent-automation'
import { useAgentStore } from '../../stores/agent-store'
import { Phone, AudioLines } from 'lucide-react'
import { Button } from '../ui/button'

interface VoiceAgentPanelProps {
  agentId: string
  agentName: string
  onClose: () => void
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

export function VoiceAgentPanel({ agentId, agentName, onClose }: VoiceAgentPanelProps) {
  const { agents, updateAgent } = useAgentStore()
  const [token, setToken] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ttsText, setTtsText] = useState('Thanks for calling. Your automation agent is ready to help.')
  const [ttsBusy, setTtsBusy] = useState(false)
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null)
  const [fallbackSpeaking, setFallbackSpeaking] = useState(false)

  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === agentId) || null, [agents, agentId])
  const voiceConfig = useMemo(() => asRecord(asRecord(selectedAgent?.config).voice), [selectedAgent])
  const ttsConfig = useMemo(() => asRecord(voiceConfig.tts), [voiceConfig])

  useEffect(() => {
    const init = async () => {
      try {
        const roomName = `call-${agentId}-${Date.now()}`
        const participantName = 'Operator'
        const { token: t, url: u } = await generateLiveKitToken(roomName, participantName)
        setToken(t)
        setUrl(u)
      } catch {
        setError('Failed to connect to voice server')
      }
    }
    void init()
  }, [agentId])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const ensureAgentApiKey = async () => {
    const target = selectedAgent
    if (!target) throw new Error('Agent record not found for TTS request')
    if (target.api_key) return target.api_key

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)

    await updateAgent(target.id, { api_key: generated })
    return generated
  }

  const runFallbackBrowserSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      throw new Error('No server TTS configured and browser speech is unavailable')
    }

    if (fallbackSpeaking) {
      window.speechSynthesis.cancel()
      setFallbackSpeaking(false)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(ttsText.trim())
    utterance.onend = () => setFallbackSpeaking(false)
    utterance.onerror = () => setFallbackSpeaking(false)
    setFallbackSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const runServerTts = async () => {
    if (!ttsText.trim()) return

    const provider = asString(ttsConfig.provider, '')
    if (!provider) {
      runFallbackBrowserSpeech()
      return
    }

    setTtsBusy(true)
    try {
      const agentApiKey = await ensureAgentApiKey()
      const response = await invokeAgentSynthesizeTts(
        {
          agentId,
          agentApiKey,
        },
        {
          text: ttsText.trim(),
          provider,
          model: asString(ttsConfig.model),
          voice: asString(ttsConfig.voice),
          endpoint: asString(ttsConfig.endpoint),
          apiKey: asString(ttsConfig.apiKey),
        },
      )
      setTtsAudioUrl(response.audio.dataUrl)
    } catch (err: any) {
      setError(err.message || 'TTS synthesis failed')
    } finally {
      setTtsBusy(false)
    }
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500 rounded text-red-500">
        {error}
        <Button onClick={onClose} variant="ghost" className="ml-2">
          Close
        </Button>
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

        <div className="mt-5 w-full max-w-xl rounded-lg border border-cyber-border bg-cyber-card/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-cyber-gray">
              TTS source:{' '}
              <span className="text-cyber-white">
                {asString(ttsConfig.provider) ? `${asString(ttsConfig.provider)} / ${asString(ttsConfig.voice, 'default')}` : 'Browser fallback'}
              </span>
            </p>
            <Button
              size="sm"
              onClick={() => void runServerTts()}
              disabled={ttsBusy || !ttsText.trim()}
              className="bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
            >
              <AudioLines className="mr-1.5 h-3.5 w-3.5" />
              {ttsBusy ? 'Synthesizing...' : fallbackSpeaking ? 'Stop Speech' : 'Speak'}
            </Button>
          </div>
          <textarea
            value={ttsText}
            onChange={(event) => setTtsText(event.target.value)}
            rows={2}
            className="mt-2 w-full resize-none rounded border border-cyber-border bg-cyber-black px-2 py-1.5 text-xs text-cyber-white"
            placeholder="Message for TTS playback..."
          />
          {ttsAudioUrl && <audio controls src={ttsAudioUrl} className="mt-2 h-8 w-full" />}
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

