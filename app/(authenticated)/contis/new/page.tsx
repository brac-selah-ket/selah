import { PageHeader } from "@/components/layout/page-header"
import { ContiForm } from "@/components/contis/conti-form"
import { getSongs } from "@/lib/queries/songs"

export default async function NewContiPage() {
  const songs = await getSongs()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="새 콘티 만들기" />
      <ContiForm allSongs={songs} enableInlineYouTubeImport />
    </div>
  )
}
