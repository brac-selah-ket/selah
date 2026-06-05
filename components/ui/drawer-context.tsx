"use client"

import { createContext, useCallback, useContext, useState } from "react"

export type DrawerSize = "default" | "wide"

interface DrawerContextValue {
  portalRef: React.RefCallback<HTMLDivElement>
  portalNode: HTMLDivElement | null
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  drawerSize: DrawerSize
  setDrawerSize: (size: DrawerSize) => void
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

export function useDrawerPortal() {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error("useDrawerPortal must be used within DrawerProvider")
  return ctx
}

export function useOptionalDrawerState() {
  const ctx = useContext(DrawerContext)
  return {
    isOpen: ctx?.isOpen ?? false,
    drawerSize: ctx?.drawerSize ?? "default",
  }
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [portalNode, setPortalNode] = useState<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [drawerSize, setDrawerSize] = useState<DrawerSize>("default")
  const portalRef = useCallback((node: HTMLDivElement | null) => {
    setPortalNode(node)
  }, [])

  return (
    <DrawerContext.Provider
      value={{
        portalRef,
        portalNode,
        isOpen,
        setIsOpen,
        drawerSize,
        setDrawerSize,
      }}
    >
      {children}
    </DrawerContext.Provider>
  )
}
