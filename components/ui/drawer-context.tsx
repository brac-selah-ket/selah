"use client"

import { createContext, useCallback, useContext, useState } from "react"

interface DrawerContextValue {
  portalRef: React.RefCallback<HTMLDivElement>
  portalNode: HTMLDivElement | null
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

export function useDrawerPortal() {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error("useDrawerPortal must be used within DrawerProvider")
  return ctx
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [portalNode, setPortalNode] = useState<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const portalRef = useCallback((node: HTMLDivElement | null) => {
    setPortalNode(node)
  }, [])

  return (
    <DrawerContext.Provider value={{ portalRef, portalNode, isOpen, setIsOpen }}>
      {children}
    </DrawerContext.Provider>
  )
}
