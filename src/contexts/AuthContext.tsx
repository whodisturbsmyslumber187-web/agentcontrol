import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface AuthContextType {
  isSignedIn: boolean
  isLoaded: boolean
  user: { email: string } | null
  signIn: (email: string, password: string) => boolean
  signOut: () => void
}

const OWNER_EMAIL = 'limaconnect187@gmail.com'
const OWNER_HASH = 'Rollout8032585!'

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  isLoaded: false,
  user: null,
  signIn: () => false,
  signOut: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('af_session')
    if (stored === OWNER_EMAIL) {
      setIsSignedIn(true)
    }
    setIsLoaded(true)
  }, [])

  const signIn = (email: string, password: string): boolean => {
    if (email === OWNER_EMAIL && password === OWNER_HASH) {
      localStorage.setItem('af_session', OWNER_EMAIL)
      setIsSignedIn(true)
      return true
    }
    return false
  }

  const signOut = () => {
    localStorage.removeItem('af_session')
    setIsSignedIn(false)
  }

  return (
    <AuthContext.Provider value={{
      isSignedIn,
      isLoaded,
      user: isSignedIn ? { email: OWNER_EMAIL } : null,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
