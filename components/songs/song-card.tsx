import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, MusicNoteSquare01Icon } from "@hugeicons/core-free-icons";
import type { Song } from "@/lib/types";

interface SongCardProps {
  song: Song;
}

export function SongCard({ song }: SongCardProps) {
  const formattedDate = new Date(song.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Link
      href={`/songs/${song.id}`}
      className="group flex min-h-24 flex-col justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-muted/35"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
          <HugeiconsIcon icon={MusicNoteSquare01Icon} strokeWidth={2} className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-base font-semibold text-foreground">{song.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{formattedDate} 등록</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-sm font-medium text-muted-foreground group-hover:text-primary">
        열기
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
      </div>
    </Link>
  );
}
