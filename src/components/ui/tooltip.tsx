import React, { createContext, useContext } from 'react'

const TooltipContext = createContext({})

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipContext.Provider value={{}}>{children}</TooltipContext.Provider>
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function TooltipTrigger({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>
}

export function TooltipContent({ children }: { children: React.ReactNode }) {
  return null
}
