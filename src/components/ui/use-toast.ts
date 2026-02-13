import React, { useState, useCallback } from 'react'

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

const toasts: Toast[] = []
const listeners: Set<() => void> = new Set()

function addToast(toast: Omit<Toast, 'id'>) {
  const id = `toast-${Date.now()}`
  toasts.push({ ...toast, id })
  listeners.forEach((l) => l())
  setTimeout(() => {
    const idx = toasts.findIndex((t) => t.id === id)
    if (idx > -1) toasts.splice(idx, 1)
    listeners.forEach((l) => l())
  }, 3000)
}

export function useToast() {
  const [, forceUpdate] = useState(0)
  React.useEffect(() => {
    const listener = () => forceUpdate((c) => c + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  return {
    toast: useCallback((t: Omit<Toast, 'id'>) => addToast(t), []),
    toasts,
  }
}
