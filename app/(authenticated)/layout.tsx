import { Suspense } from "react"
import { AppShell } from "@/components/layout/app-shell"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <link rel="preload" href="/pdf.worker.min.mjs" as="script" crossOrigin="anonymous" />
      <Suspense fallback={null}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </>
  )
}
