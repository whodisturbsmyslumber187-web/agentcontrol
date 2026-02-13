import { SignInButton, SignUpButton } from '@insforge/react'

export default function Login() {
  return (
    <div className="min-h-screen bg-cyber-black flex items-center justify-center">
      <div className="w-full max-w-md p-8 rounded-2xl bg-cyber-card border border-cyber-border">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-cyber-green mb-2">AgentForge OS</h1>
          <p className="text-cyber-gray text-sm">Agent Control Panel — Sign in to manage your fleet</p>
        </div>
        <div className="space-y-4">
          <SignInButton className="w-full px-6 py-3 rounded-lg bg-cyber-green text-cyber-black font-semibold text-center hover:opacity-90 transition-opacity cursor-pointer block" />
          {/* Registration Closed: Private System */}
        </div>
        <p className="text-center text-xs text-cyber-gray mt-6">
          Powered by InsForge • Unlimited Agent Scalability
        </p>
      </div>
    </div>
  )
}
