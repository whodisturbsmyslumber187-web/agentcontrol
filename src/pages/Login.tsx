import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const success = signIn(email, password)
      if (!success) {
        setError('Invalid credentials. Access denied.')
      }
      setLoading(false)
    }, 600)
  }

  return (
    <div className="min-h-screen bg-cyber-black flex items-center justify-center">
      <div className="w-full max-w-md p-8 rounded-2xl bg-cyber-card border border-cyber-border">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-cyber-green mb-2">AgentForge OS</h1>
          <p className="text-cyber-gray text-sm">Agent Control Panel — Owner Access Only</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-cyber-gray text-xs mb-1 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-cyber-black border border-cyber-border text-white placeholder:text-cyber-gray/50 focus:border-cyber-green focus:outline-none transition-colors"
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-cyber-gray text-xs mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-cyber-black border border-cyber-border text-white placeholder:text-cyber-gray/50 focus:border-cyber-green focus:outline-none transition-colors"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-red-400 text-sm text-center py-2 bg-red-500/10 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 rounded-lg bg-cyber-green text-cyber-black font-semibold text-center hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-xs text-cyber-gray mt-6">
          Private System • Owner Access Only
        </p>
      </div>
    </div>
  )
}
