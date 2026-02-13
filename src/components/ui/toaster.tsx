import React from 'react'
import { useToast } from './use-toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border p-4 shadow-lg backdrop-blur-sm transition-all animate-in slide-in-from-bottom-5 ${
            toast.variant === 'destructive'
              ? 'bg-red-900/90 border-red-700 text-red-100'
              : 'bg-cyber-card/90 border-cyber-border text-cyber-white'
          }`}
        >
          {toast.title && <p className="font-semibold text-sm">{toast.title}</p>}
          {toast.description && <p className="text-xs opacity-80 mt-1">{toast.description}</p>}
        </div>
      ))}
    </div>
  )
}
