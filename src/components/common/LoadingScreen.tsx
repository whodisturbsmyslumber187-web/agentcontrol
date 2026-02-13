export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-cyber-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyber-green mx-auto" />
        <p className="mt-4 text-cyber-gray text-sm">Loading AgentForge OS...</p>
      </div>
    </div>
  )
}
