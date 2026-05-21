import { AppShell } from "@/components/layout/app-shell"

export const dynamic = "force-dynamic"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <link rel="preload" href="/pdf.worker.min.mjs" as="script" crossOrigin="anonymous" />
      <AppShell>{children}</AppShell>
    </>
  )
}
