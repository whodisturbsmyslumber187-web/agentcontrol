import { insforge } from './insforge'

export async function generateLiveKitToken(roomName: string, participantName: string) {
  const { data, error } = await insforge.functions.invoke('livekit-token', {
    body: { roomName, participantName },
  })

  if (error) {
    console.error('Error generating LiveKit token:', error)
    throw error
  }

  return data as { token: string; url: string }
}
